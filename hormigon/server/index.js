// hormigon backend: autenticación (registro abierto) + storage por usuario en
// SQLite. El frontend usa un shim de localStorage que sincroniza con
// /api/storage, así toda la lógica existente (que escribe en localStorage)
// sigue intacta; cada usuario solo ve su propio storage.
import express from "express";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5177);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DIST_DIR = path.join(__dirname, "..", "dist");

const SESSION_COOKIE = "hc_session";
// Cookie de corta vida (sesión de navegador) que guarda el token de admin
// mientras está suplantando a otro usuario; permite volver sin re-login.
const RETURN_COOKIE = "hc_admin_return";
const SESSION_DAYS = 30;
const RESET_TOKEN_MINUTES = 60;
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_LEN = 16;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_ATTEMPTS = 20;
const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "");

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "storage.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    username_lower TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kv (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, key)
  );
`);

// Migración: la columna email se agregó después del primer release.
try {
  db.exec("ALTER TABLE users ADD COLUMN email TEXT");
} catch {
  // ya existe
}

// Migración: is_admin (el primer usuario del server es el administrador).
try {
  db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
} catch {
  // ya existe
}
db.exec(`
  UPDATE users SET is_admin = 1
  WHERE id = (SELECT id FROM users ORDER BY id LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin = 1);
`);

// Hash dummy para comparar en time constante cuando el usuario no existe:
// evita que el login revele qué nombres están registrados.
const DUMMY_SALT = "dummy-salt";
const DUMMY_HASH = Buffer.from(
  crypto
    .scryptSync("dummy-password", DUMMY_SALT, SCRYPT_KEYLEN)
    .toString("hex"),
  "hex",
);

const statements = {
  userByLower: db.prepare("SELECT * FROM users WHERE username_lower = ?"),
  userById: db.prepare("SELECT id, username, is_admin FROM users WHERE id = ?"),
  userByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
  insertUser: db.prepare(
    "INSERT INTO users (username, username_lower, email, password_hash) VALUES (?, ?, ?, ?)",
  ),
  keysForUser: db.prepare("SELECT key, value FROM kv WHERE user_id = ?"),
  claimKeysWithoutUser: db.prepare(
    "UPDATE kv SET user_id = @userId WHERE user_id IS NULL AND key NOT IN (SELECT key FROM kv WHERE user_id = @userId)",
  ),
  upsertKey: db.prepare(`
    INSERT INTO kv (user_id, key, value, updated_at)
    VALUES (@userId, @key, @value, datetime('now'))
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `),
  deleteKey: db.prepare("DELETE FROM kv WHERE user_id = ? AND key = ?"),
  insertSession: db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', ?))",
  ),
  sessionUser: db.prepare(`
    SELECT u.id, u.username, u.is_admin FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `),
  deleteSession: db.prepare("DELETE FROM sessions WHERE token = ?"),
  deleteUserSessions: db.prepare("DELETE FROM sessions WHERE user_id = ?"),
  cleanupSessions: db.prepare(
    "DELETE FROM sessions WHERE expires_at <= datetime('now')",
  ),
  countUsers: db.prepare("SELECT COUNT(*) AS n FROM users"),
  makeAdmin: db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?"),
  adminUsers: db.prepare(`
    SELECT u.id, u.username, u.email, u.is_admin, u.created_at,
           (SELECT COUNT(*) FROM kv k WHERE k.user_id = u.id) AS key_count
    FROM users u
    ORDER BY u.id
  `),
  insertReset: db.prepare(
    "INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, datetime('now', ?))",
  ),
  resetUser: db.prepare(`
    SELECT r.token, r.user_id FROM password_resets r
    WHERE r.token = ? AND r.expires_at > datetime('now')
  `),
  deleteReset: db.prepare("DELETE FROM password_resets WHERE token = ?"),
  cleanupResets: db.prepare(
    "DELETE FROM password_resets WHERE expires_at <= datetime('now')",
  ),
  updatePassword: db.prepare("UPDATE users SET password_hash = ? WHERE id = ?"),
};

function hashPassword(password) {
  const salt = crypto.randomBytes(SCRYPT_SALT_LEN);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored).split(":");
  const expected = Buffer.from(hashHex || "", "hex");
  const actual = crypto.scryptSync(
    password,
    Buffer.from(saltHex || "", "hex"),
    expected.length || 1,
  );
  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}

function getCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const cookies = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const name = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

function secureRequest(req) {
  return Boolean(req.secure || req.headers["x-forwarded-proto"] === "https");
}

function setSessionCookie(res, token) {
  const secure = secureRequest(res.req);
  res.setHeader("Set-Cookie", [
    `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 24 * 3600}${secure ? "; Secure" : ""}`,
  ]);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", [
    `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
  ]);
}

// Suplantación: la cookie de sesión pasa al usuario objetivo y la de retorno
// guarda el token de admin (cookie de sesión: muere al cerrar el navegador).
function setImpersonateCookies(res, sessionToken, returnToken) {
  const secure = secureRequest(res.req);
  res.setHeader("Set-Cookie", [
    `${SESSION_COOKIE}=${sessionToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 24 * 3600}${secure ? "; Secure" : ""}`,
    `${RETURN_COOKIE}=${returnToken}; HttpOnly; SameSite=Lax; Path=/${secure ? "; Secure" : ""}`,
  ]);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  statements.insertSession.run(token, userId, `+${SESSION_DAYS} days`);
  return token;
}

const rateAttempts = new Map();

function rateLimit(key) {
  const now = Date.now();
  const recent = (rateAttempts.get(key) || []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  rateAttempts.set(key, recent);
  if (recent.length >= RATE_MAX_ATTEMPTS) return false;
  recent.push(now);
  return true;
}

function authRequired(req, res, next) {
  const token = getCookies(req)[SESSION_COOKIE];
  const user = token && statements.sessionUser.get(token);
  if (!user) {
    return res.status(401).json({ error: "no autenticado" });
  }
  req.user = user;
  next();
}

const app = express();
app.use(express.json({ limit: "10mb" }));
app.set("trust proxy", 1);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const mailFrom = process.env.SMTP_FROM || process.env.SMTP_USER || "";

// Si BASE_URL está definido (producción), se usa tal cual. En dev se deriva
// del request, pero si el usuario entró por localhost/127.0.0.1 (que solo
// existe en esa máquina) el link usa la IP LAN de la RPi para que abra desde
// cualquier dispositivo de la red.
const LOOPBACK_RE = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

function lanIp() {
  for (const infos of Object.values(os.networkInterfaces())) {
    for (const info of infos || []) {
      if (info.family === "IPv4" && !info.internal) return info.address;
    }
  }
  return null;
}

function resetBaseUrl(req) {
  if (BASE_URL) return BASE_URL;
  const host = req.get("host") || "";
  const loopbackMatch = host.match(LOOPBACK_RE);
  if (loopbackMatch) {
    const lan = lanIp();
    if (lan) return `${req.protocol}://${lan}${loopbackMatch[2] || ""}`;
  }
  return `${req.protocol}://${host}`;
}

function buildResetLink(token, baseUrl = BASE_URL) {
  return `${baseUrl}/?reset=${token}`;
}

function sendResetMail(to, resetLink) {
  const mail = {
    from: mailFrom,
    to,
    subject: "Recuperación de contraseña — Hormigón",
    html: `
      <p>Hola,</p>
      <p>Recibimos una solicitud para recuperar tu contraseña de <strong>Hormigón</strong>.</p>
      <p><a href="${resetLink}">Hacé clic acá para crear una nueva contraseña</a></p>
      <p>El enlace vence en 1 hora. Si no pediste esto, ignorá este correo.</p>
    `,
  };
  return transporter.sendMail(mail);
}

function sendPasswordReset({ user, resetToken, baseUrl }) {
  const resetLink = buildResetLink(resetToken, baseUrl);
  const quiet = (reason) => {
    console.log(
      `[recuperacion] No se pudo enviar mail a ${user.email} (${reason}); link: ${resetLink}`,
    );
  };
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    quiet("SMTP no configurado");
    return;
  }
  sendResetMail(user.email, resetLink).catch((err) => {
    quiet(err.message);
  });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", (req, res) => {
  if (!rateLimit(`register-${req.ip}`)) {
    return res
      .status(429)
      .json({ error: "demasiados intentos, probá más tarde" });
  }
  const { username = "", password = "" } = req.body || {};
  const trimmed = String(username).trim();
  if (!USERNAME_RE.test(trimmed)) {
    return res.status(400).json({
      error: "el nombre debe tener 3 a 30 caracteres (letras, números o _)",
    });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res
      .status(400)
      .json({ error: "la contraseña debe tener al menos 8 caracteres" });
  }
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "ingresá un email válido" });
  }
  const lowered = trimmed.toLowerCase();
  if (statements.userByLower.get(lowered)) {
    return res.status(409).json({ error: "ese nombre ya está en uso" });
  }
  if (statements.userByEmail.get(email)) {
    return res.status(409).json({ error: "ese email ya está en uso" });
  }
  const result = statements.insertUser.run(
    trimmed,
    lowered,
    email,
    hashPassword(password),
  );
  const userId = Number(result.lastInsertRowid);
  const { n } = statements.countUsers.get();
  if (n === 1) {
    statements.makeAdmin.run(userId);
    statements.claimKeysWithoutUser.run({ userId });
  }
  const token = createSession(userId);
  setSessionCookie(res, token);
  res.status(201).json({ username: trimmed });
});

app.post("/api/auth/login", (req, res) => {
  if (!rateLimit(`login-${req.ip}`)) {
    return res
      .status(429)
      .json({ error: "demasiados intentos, probá más tarde" });
  }
  const { username = "", password = "" } = req.body || {};
  const lower = String(username).trim().toLowerCase();
  const user = statements.userByLower.get(lower);
  const ok = user
    ? verifyPassword(String(password), user.password_hash)
    : verifyPassword(
        String(password),
        `${DUMMY_SALT}:${DUMMY_HASH.toString("hex")}`,
      );
  if (!user || !ok) {
    return res.status(401).json({ error: "usuario o contraseña incorrectos" });
  }
  const token = createSession(user.id);
  setSessionCookie(res, token);
  res.json({ username: user.username });
});

app.post("/api/auth/forgot", (req, res) => {
  if (!rateLimit(`forgot-${req.ip}`)) {
    return res
      .status(429)
      .json({ error: "demasiados intentos, probá más tarde" });
  }
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "ingresá un email válido" });
  }
  statements.cleanupResets.run();
  const user = statements.userByEmail.get(email);
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    statements.insertReset.run(
      token,
      user.id,
      `+${RESET_TOKEN_MINUTES} minutes`,
    );
    sendPasswordReset({
      user,
      resetToken: token,
      baseUrl: resetBaseUrl(req),
    });
  }
  // Respuesta idéntica exista o no la cuenta: no revela emails registrados.
  res.json({ ok: true });
});

app.post("/api/auth/reset", (req, res) => {
  if (!rateLimit(`reset-${req.ip}`)) {
    return res
      .status(429)
      .json({ error: "demasiados intentos, probá más tarde" });
  }
  const { token = "", password = "" } = req.body || {};
  if (typeof password !== "string" || password.length < 8) {
    return res
      .status(400)
      .json({ error: "la contraseña debe tener al menos 8 caracteres" });
  }
  const reset = statements.resetUser.get(String(token));
  if (!reset) {
    return res.status(400).json({ error: "el enlace es inválido o ya venció" });
  }
  statements.deleteReset.run(reset.token);
  statements.deleteUserSessions.run(reset.user_id);
  statements.updatePassword.run(hashPassword(password), reset.user_id);
  res.json({ ok: true });
});

app.post("/api/auth/logout", authRequired, (req, res) => {
  const token = getCookies(req)[SESSION_COOKIE];
  if (token) statements.deleteSession.run(token);
  clearSessionCookie(res);
  res.status(204).end();
});

app.get("/api/auth/me", (req, res) => {
  statements.cleanupSessions.run();
  const token = getCookies(req)[SESSION_COOKIE];
  const user = token && statements.sessionUser.get(token);
  if (!user) return res.status(401).json({ error: "no autenticado" });
  const returnToken = getCookies(req)[RETURN_COOKIE];
  const impersonating = Boolean(
    returnToken && statements.sessionUser.get(returnToken)?.is_admin,
  );
  res.json({
    username: user.username,
    admin: Boolean(user.is_admin),
    impersonating,
  });
});

function adminRequired(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: "no autorizado" });
  }
  next();
}

app.get("/api/admin/users", authRequired, adminRequired, (req, res) => {
  res.json({ users: statements.adminUsers.all() });
});

// El admin entra como otro usuario: sesión nueva para el objetivo y el token
// de admin original queda guardado en RETURN_COOKIE para poder volver.
app.post("/api/admin/impersonate", authRequired, adminRequired, (req, res) => {
  const userId = Number(req.body?.userId);
  const target =
    Number.isInteger(userId) && userId > 0
      ? statements.userById.get(userId)
      : null;
  if (!target) {
    return res.status(404).json({ error: "usuario inexistente" });
  }
  if (target.id === req.user.id) {
    return res.status(400).json({ error: "ya estás en tu propia sesión" });
  }
  const adminToken = getCookies(req)[SESSION_COOKIE] || "";
  const token = createSession(target.id);
  setImpersonateCookies(res, token, adminToken);
  res.json({ username: target.username });
});

// Vuelve a la sesión de admin guardada en RETURN_COOKIE y borra la sesión de
// suplantación actual. Si la sesión de admin ya no es válida, cierra todo.
// Ojo: setHeader("Set-Cookie") reemplaza el header completo, así que las dos
// cookies de cada rama van en una sola llamada.
app.post("/api/admin/exit-impersonate", authRequired, (req, res) => {
  const cookies = getCookies(req);
  const returnToken = cookies[RETURN_COOKIE] || "";
  if (cookies[SESSION_COOKIE]) {
    statements.deleteSession.run(cookies[SESSION_COOKIE]);
  }
  const admin = returnToken ? statements.sessionUser.get(returnToken) : null;
  const secure = secureRequest(req);
  const secureFlag = secure ? "; Secure" : "";
  const expired = `${RETURN_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
  if (!admin?.is_admin) {
    res.setHeader("Set-Cookie", [
      `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureFlag}`,
      expired,
    ]);
    return res.json({ ok: false, logout: true });
  }
  res.setHeader("Set-Cookie", [
    `${SESSION_COOKIE}=${returnToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 24 * 3600}${secureFlag}`,
    expired,
  ]);
  res.json({ ok: true });
});

app.get("/api/storage", authRequired, (req, res) => {
  const keys = {};
  for (const row of statements.keysForUser.all(req.user.id)) {
    keys[row.key] = row.value;
  }
  res.json({ keys });
});

app.post("/api/storage/sync", authRequired, (req, res) => {
  const { set = {}, remove = [] } = req.body || {};
  if (typeof set !== "object" || set === null || !Array.isArray(remove)) {
    return res.status(400).json({ error: "invalid payload" });
  }
  const upsert = db.transaction((entries) => {
    for (const [key, value] of entries) {
      if (typeof key !== "string" || typeof value !== "string") continue;
      statements.upsertKey.run({ userId: req.user.id, key, value });
    }
    for (const key of remove) {
      if (typeof key === "string") statements.deleteKey.run(req.user.id, key);
    }
  });
  upsert(Object.entries(set));
  res.status(204).end();
});

// SPA fallback: sirve dist/ si existe (producción). En dev sirve vite.
// Los assets con hash se cachean como immutables, pero el HTML SIEMPRE va
// fresh: se manda con no-store (el navegador no lo guarda NUNCA) para que
// una entrada vieja cacheada no pueda servir la app desactualizada. El HTML
// pesa ~500 bytes; los bundles pesados siguen cacheados por hash.
if (fs.existsSync(DIST_DIR)) {
  app.use(
    express.static(DIST_DIR, {
      maxAge: "30d",
      immutable: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-store");
        }
      },
    }),
  );
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`hormigon server listening on :${PORT}`);
  console.log(`SQLite database at ${path.join(DATA_DIR, "storage.db")}`);
});
