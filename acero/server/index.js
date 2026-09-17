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
const PORT = Number(process.env.PORT || 5178);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DIST_DIR = path.join(__dirname, "..", "dist");

const SESSION_COOKIE = "ac_session";
// Cookie de corta vida (sesión de navegador) que guarda el token de admin
// mientras está suplantando a otro usuario; permite volver sin re-login.
const RETURN_COOKIE = "ac_admin_return";
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

// Migración: is_admin. El administrador se define por nombre de usuario
// (ADMIN_USERNAMES, por defecto marcmastro), no por ser el primero en
// registrarse: así sólo esa cuenta accede a las pantallas de admin.
try {
  db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
} catch {
  // ya existe
}
const ADMIN_USERNAMES = new Set(
  String(process.env.ADMIN_USERNAMES ?? "marcmastro")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean),
);
if (ADMIN_USERNAMES.size > 0) {
  const names = [...ADMIN_USERNAMES];
  const placeholders = names.map(() => "?").join(", ");
  db.prepare(
    `UPDATE users SET is_admin = CASE WHEN username_lower IN (${placeholders}) THEN 1 ELSE 0 END`,
  ).run(...names);
}

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
  setAdmin: db.prepare("UPDATE users SET is_admin = ? WHERE id = ?"),
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
    subject: "Recuperación de contraseña — MAS ACERO",
    html: `
      <p>Hola,</p>
      <p>Recibimos una solicitud para recuperar tu contraseña de <strong>MAS ACERO</strong>.</p>
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
    statements.claimKeysWithoutUser.run({ userId });
  }
  if (ADMIN_USERNAMES.has(lowered)) {
    statements.makeAdmin.run(userId);
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
  // Sincroniza el flag con la lista de administradores (cambios de env entre
  // reinicios o cuentas creadas antes de la migración).
  const shouldAdmin = ADMIN_USERNAMES.has(user.username_lower) ? 1 : 0;
  if (user.is_admin !== shouldAdmin) {
    statements.setAdmin.run(shouldAdmin, user.id);
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

// ---- Asistente virtual (LLM vía OpenRouter) ----
//
// Proxy de streaming: la API key vive solo en el server. El bucle de tools es
// stateless y lo maneja el cliente: cada POST trae la conversación completa
// (incluidos los resultados de tools) y el server reenvía al modelo con
// streaming SSE. El system prompt y el catálogo de tools se definen acá; el
// cliente solo aporta el estado de la pantalla como texto de contexto.
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "nvidia/nemotron-3.5-lightning:free";

// Cadena de modelos con fallback: el endpoint prueba cada modelo en orden
// hasta que uno emite su primer byte dentro del plazo; así la cola variable
// de un modelo free no deja al usuario sin respuesta.
const OPENROUTER_MODELS = (
  process.env.OPENROUTER_MODELS ||
  `${OPENROUTER_MODEL},nex-agi/nex-n2.5-pro:free,inclusionai/ling-3.0-flash-vl:free`
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ASSISTANT_FIRST_TOKEN_MS = Number(
  process.env.ASSISTANT_FIRST_TOKEN_MS || 15_000,
);

// Límite propio del asistente (independiente del de auth): una sola pregunta
// del usuario puede disparar varias pasadas del bucle de tools.
const ASSISTANT_RATE_WINDOW_MS = 15 * 60 * 1000;
const ASSISTANT_RATE_MAX = 60;
const assistantCalls = new Map();

function assistantRateLimit(userId) {
  const now = Date.now();
  const key = `assistant-${userId}`;
  const recent = (assistantCalls.get(key) || []).filter(
    (t) => now - t < ASSISTANT_RATE_WINDOW_MS,
  );
  assistantCalls.set(key, recent);
  if (recent.length >= ASSISTANT_RATE_MAX) return false;
  recent.push(now);
  return true;
}

const ASSISTANT_SYSTEM = `Sos el asistente virtual de "MAS ACERO", una app de cálculo de estructuras de acero según CIRSOC 301 (estructuras metálicas) y CIRSOC 102 (viento).

Módulos: Viga de acero, Columnas de acero, Bases, Carteles.

Tu trabajo:
1. Completar los formularios de la app con los datos que el usuario te dicte (por ejemplo, valores de una planilla o de un plano).
2. Leer el estado actual y responder preguntas sobre los datos de la obra activa.
3. Orientar sobre el uso de la app.

Reglas:
- Usá set_form_values para completar el formulario de la pantalla activa. Cargá en una sola llamada todos los campos que el usuario haya dado. No inventes valores que el usuario no dio: si falta un dato, cargá lo que tengas y preguntá por el resto.
- Respetá las unidades y los nombres de campo exactos que lista el contexto. Si el usuario habla en otra unidad (m vs cm, kN/m vs kN/m²), convertí antes de cargar.
- No hacés el cálculo estructural vos: la app calcula. Después de completar, sugerí apretar "Calcular".
- Usá navigate si la tarea requiere otra pantalla (por ejemplo, para ir a cargar una columna).
- Respondé en español, breve y concreto. Usá punto decimal.

## Explicación para el usuario
Cuando el usuario pregunte cómo usar un módulo, qué significa un campo o qué hace la app, respondé en lenguaje de obra y con los nombres que se ven en pantalla: "Perfil", "Fy", "Carga muerta", "Carga viva", "Tramo", "Apoyo simple", "Apoyo empotrado", "Flecha límite", "Tensión admisible del terreno", "Profundidad de fundación", "Velocidad de viento".
PROHIBIDO en las explicaciones: los nombres internos de campos (profileName, Fy, Lb, Cb, Pu, Mux, Muy...), ni siquiera entre paréntesis o como referencia; tampoco las rutas de la app (/viga-acero, /columns, /bases, /cartel...) ni las palabras "form" o "modo explicación". Los identificadores técnicos existen solo para que vos completes formularios, jamás para mostrarle al usuario: referite a los módulos por su nombre en español (Viga de acero, Columnas, Bases, Carteles).
Explicá el flujo en pasos: qué se carga, qué hace la app al apretar Calcular y qué muestra el resultado. Usá prosa o listas simples en lenguaje de la profesión, nunca tablas de campos internos.

Qué significa cada letra/celda: cuando el usuario pregunte por una letra, abreviatura o celda de la pantalla actual (por ejemplo "qa", "Pu", "Mu", "Fy", "Lb"), respondé con el significado de la sección "Términos de esta pantalla" del contexto, en lenguaje de obra. Si el término no está en esa sección, decí que no aparece en la pantalla actual en lugar de inventar un significado.

## Glosario de terminología de obra (aplicalo SIN preguntar)
- "empotrado", "encastrado", "apoyo fijo" → apoyo "empotrado" (empotramiento en el extremo).
- "apoyado", "simplemente apoyado" → "simple" (articulado).
- "volado", "sin apoyo", "borde libre" → "free" (libre), solo en extremos.
- "fluencia", "tensión de fluencia" → Fy (MPa). "longitud sin arriostrar" → Lb (mm).
- "carga muerta" → D; "carga viva" → L. Combinación última U = 1.2·D + 1.6·L.

Al mapear un término del glosario, cargá el valor directamente y en tu respuesta aclará el mapeo en una frase (ej.: «empotrado lo cargué como apoyo empotrado»). NO le preguntes al usuario cosas que este glosario ya resuelve.

Guardar: para guardar los datos del formulario activo usá save_form (equivale al botón Guardar). NUNCA navegues a otra pantalla para guardar: navigate solo cambia de pantalla. Si el formulario ya tiene un guardado cargado, save_form lo actualiza con el mismo nombre.

Obra: usá la herramienta obra para crear una obra nueva (action "create" con name) o cambiar la obra activa (action "select" con name o id). El contexto lista las obras disponibles. Recién después de crear/seleccionar la obra correcta cargá y guardá datos: cada obra tiene sus propios elementos guardados.

Explicaciones: cuando cargues valores, resumí en una línea qué dejaste cargado (campo = valor). Si piden una explicación técnica, respondé con la hipótesis que aplica la app (CIRSOC 301 para acero, CIRSOC 102 para viento) y los valores reales del contexto, sin rodeos.

El contexto "Estado actual de la app" se regenera en cada mensaje: es tu fuente de verdad sobre la pantalla, el formulario y la obra.`;

const ASSISTANT_TOOLS = [
  {
    type: "function",
    function: {
      name: "set_form_values",
      description:
        "Completa campos del formulario de la pantalla activa. El contexto lista los campos válidos con sus unidades y opciones; los desconocidos se rechazan con error.",
      parameters: {
        type: "object",
        properties: {
          values: {
            type: "object",
            description:
              'Mapa { campo: valor } en unidades de UI. Ej: { "lx": 4.2, "cover_cm": 2 }',
          },
        },
        required: ["values"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_form",
      description:
        "Guarda los datos del formulario activo en la obra activa (equivale al botón Guardar). Necesita el nombre del elemento; si el usuario no lo dio, preguntáselo.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: 'Nombre para el elemento. Ej: "Losa Terraza"',
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate",
      description: "Navega a otra pantalla de la app.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            enum: [
              "/viga-acero",
              "/columns",
              "/bases",
              "/cartel",
            ],
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obra",
      description:
        "Crea una obra nueva o cambia la obra activa. Cada obra tiene sus propios elementos guardados.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "select"],
            description:
              "create = obra nueva; select = cambiar a una existente",
          },
          name: {
            type: "string",
            description:
              "Nombre de la obra. Obligatorio en create; en select se usa para encontrar la obra por nombre (no distinguir mayúsculas).",
          },
          id: {
            type: "string",
            description: "Id de la obra (solo select). Alternativo a name.",
          },
        },
        required: ["action"],
      },
    },
  },
];

/**
 * Valida y normaliza la conversación que manda el cliente. Descarta mensajes
 * system (el system lo define el server) y recorta tamaños para que un
 * cliente malicioso no use el endpoint como proxy libre.
 */
function sanitizeAssistantMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 80) return null;
  const messages = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") return null;
    const role = m.role;
    if (role === "system") continue;
    if (role === "user" || role === "assistant" || role === "tool") {
      const msg = { role };
      if (role === "tool") {
        if (typeof m.content !== "string") return null;
        msg.content = m.content.slice(0, 8000);
        if (typeof m.tool_call_id === "string") {
          msg.tool_call_id = m.tool_call_id.slice(0, 128);
        }
      } else {
        msg.content =
          typeof m.content === "string" ? m.content.slice(0, 20000) : null;
      }
      if (role === "assistant" && Array.isArray(m.tool_calls)) {
        msg.tool_calls = m.tool_calls.slice(0, 8).map((tc) => ({
          id: String(tc?.id || "").slice(0, 128),
          type: "function",
          function: {
            name: String(tc?.function?.name || "").slice(0, 64),
            arguments: String(tc?.function?.arguments || "{}").slice(0, 8000),
          },
        }));
      }
      messages.push(msg);
    } else {
      return null;
    }
  }
  return messages.length > 0 ? messages : null;
}

app.post("/api/assistant/chat", authRequired, async (req, res) => {
  if (!OPENROUTER_KEY) {
    return res.status(503).json({ error: "asistente no configurado" });
  }
  if (!assistantRateLimit(req.user.id)) {
    return res
      .status(429)
      .json({ error: "límite del asistente alcanzado, probá en unos minutos" });
  }
  const messages = sanitizeAssistantMessages(req.body?.messages);
  if (!messages) {
    return res.status(400).json({ error: "conversación inválida" });
  }
  const context = String(req.body?.context || "").slice(0, 24000);
  const system = {
    role: "system",
    content:
      ASSISTANT_SYSTEM +
      (context ? `\n\n## Estado actual de la app\n${context}` : ""),
  };

  // Recorre la cadena de modelos hasta que uno arranque a emitir dentro del
  // plazo; si todos fallan, responde 502 con el último motivo.
  let lastError = "sin respuesta del proveedor";
  let started = false;
  const controllers = new Set();

  // El cancel real del cliente se detecta en res "close" verificando que la
  // respuesta no haya terminado normalmente (req "close" dispara al terminar
  // el body del request, no al cortarse la conexión).
  res.on("close", () => {
    if (!res.writableEnded) {
      for (const c of controllers) c.abort();
    }
  });

  for (const model of OPENROUTER_MODELS) {
    if (started) break;
    const controller = new AbortController();
    controllers.add(controller);
    const firstTokenTimer = setTimeout(
      () => controller.abort(),
      ASSISTANT_FIRST_TOKEN_MS,
    );

    let upstream;
    try {
      upstream = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": BASE_URL || "http://localhost:5174",
          "X-Title": "MasCalculador - Hormigon",
        },
        body: JSON.stringify({
          model,
          messages: [system, ...messages],
          tools: ASSISTANT_TOOLS,
          stream: true,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(firstTokenTimer);
      lastError = `modelo ${model} no respondió (${err?.name || "error"})`;
      console.error(`[asistente] ${lastError}`);
      continue;
    }

    if (!upstream.ok || !upstream.body) {
      clearTimeout(firstTokenTimer);
      const detail = await upstream.text().catch(() => "");
      lastError = `modelo ${model} HTTP ${upstream.status}: ${detail.slice(
        0,
        200,
      )}`;
      console.error(`[asistente] ${lastError}`);
      continue;
    }

    // Espera la primera línea SSE real (data:). OpenRouter manda comentarios
    // ": OPENROUTER PROCESSING" mientras el request está en cola: esos NO
    // cuentan como arranque. Si el modelo no emite un data: dentro del plazo,
    // el abort del timer corta el fetch y pasamos al siguiente de la cadena.
    let firstChunk;
    try {
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const pending = [];
      let realStart = false;
      while (!realStart) {
        const { done, value } = await reader.read();
        if (done) break;
        pending.push(value);
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.trimStart().startsWith("data:")) {
            realStart = true;
            break;
          }
        }
      }
      if (!realStart) {
        lastError = `modelo ${model} cerró en cola sin emitir`;
        continue;
      }
      firstChunk = { reader, pending };
    } catch (err) {
      clearTimeout(firstTokenTimer);
      lastError = `modelo ${model} sin primer token (${err?.name || "error"})`;
      console.error(`[asistente] ${lastError}`);
      continue;
    }
    clearTimeout(firstTokenTimer);
    started = true;
    console.error(`[asistente] usando modelo ${model}`);

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const { reader, pending } = firstChunk;
    const writeChunk = async (chunk) => {
      if (res.closed) return;
      if (!res.write(chunk)) {
        await new Promise((resolve) => res.once("drain", resolve));
      }
    };
    try {
      for (const chunk of pending) await writeChunk(chunk);
      for (;;) {
        const { done, value: next } = await reader.read();
        if (done) break;
        await writeChunk(next);
      }
    } catch (err) {
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({ error: "stream interrumpido" })}\n\n`,
        );
      }
    } finally {
      if (!res.writableEnded) res.end();
    }
  }

  if (!started && !res.headersSent) {
    res.status(502).json({
      error: `el asistente no está disponible: ${lastError.slice(0, 160)}`,
    });
  }
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
  console.log(`acero server listening on :${PORT}`);
  console.log(`SQLite database at ${path.join(DATA_DIR, "storage.db")}`);
  const admins = db
    .prepare("SELECT username FROM users WHERE is_admin = 1 ORDER BY username")
    .all();
  console.log(
    `Administrador: ${admins.map((a) => a.username).join(", ") || "(sin definir)"}`,
  );
});
