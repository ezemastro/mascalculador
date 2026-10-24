import { useState, type FormEvent } from "react";

type Mode = "login" | "register" | "forgot" | "reset";

function getResetToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("reset");
}

function PasswordToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  const label = visible ? "Ocultar contraseña" : "Mostrar contraseña";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-text-muted hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {visible ? (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" x2="22" y1="2" y2="22" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

export default function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (username: string) => void;
}) {
  const resetToken = getResetToken();
  const [mode, setMode] = useState<Mode>(resetToken ? "reset" : "login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "forgot") {
        const res = await fetch("/api/auth/forgot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error || "Error al enviar el enlace");
        }
        setMessage(
          "Si existe una cuenta con ese email, vas a recibir un enlace para recuperar la contraseña.",
        );
        return;
      }

      if (mode === "reset") {
        const res = await fetch("/api/auth/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resetToken, password }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok)
          throw new Error(data.error || "Error al cambiar la contraseña");
        if (window.history.replaceState) {
          window.history.replaceState({}, "", window.location.pathname);
        }
        setMode("login");
        setPassword("");
        setConfirm("");
        setMessage("Contraseña actualizada. Ingresá con tu nueva contraseña.");
        return;
      }

      const payload =
        mode === "register"
          ? { username, email, password }
          : { username, password };
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        username?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Error de autenticación");
      onAuthenticated(data.username || username);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function switchMode(target: Mode) {
    setMode(target);
    setError(null);
    setMessage(null);
  }

  const inputClass =
    "auth-field w-full bg-surface-alt border border-border rounded px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary";

  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-lg p-6">
        <h1 className="text-lg font-semibold mb-1">Viga Continua</h1>
        <p className="text-xs text-text-muted mb-5">
          {mode === "login" && "Ingresá con tu cuenta para ver tus datos"}
          {mode === "register" &&
            "Creá una cuenta para guardar tus datos por separado"}
          {mode === "forgot" && "Te enviamos un enlace al email de tu cuenta"}
          {mode === "reset" && "Elegí tu nueva contraseña"}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          {(mode === "login" || mode === "register") && (
            <input
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nombre de usuario"
              autoComplete="username"
              minLength={3}
              maxLength={30}
              required
            />
          )}
          {mode === "forgot" && (
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Tu email"
              autoComplete="email"
              required
            />
          )}
          {mode === "register" && (
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
            />
          )}
          {(mode === "login" || mode === "register" || mode === "reset") && (
            <div className="relative">
              <input
                className={`${inputClass} pr-10`}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === "reset" ? "Nueva contraseña" : "Contraseña"
                }
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={8}
                required
              />
              <PasswordToggle
                visible={showPassword}
                onToggle={() => setShowPassword((prev) => !prev)}
              />
            </div>
          )}
          {mode === "reset" && (
            <div className="relative">
              <input
                className={`${inputClass} pr-10`}
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repetí la contraseña"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <PasswordToggle
                visible={showConfirm}
                onToggle={() => setShowConfirm((prev) => !prev)}
              />
            </div>
          )}
          {mode === "reset" && password && confirm && password !== confirm && (
            <p className="text-xs text-danger">Las contraseñas no coinciden</p>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
          {message && <p className="text-xs text-success">{message}</p>}
          <button
            type="submit"
            disabled={busy || (mode === "reset" && password !== confirm)}
            className="w-full bg-primary hover:bg-primary-hover text-white rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy
              ? "Esperá..."
              : mode === "login"
                ? "Ingresar"
                : mode === "register"
                  ? "Crear cuenta"
                  : mode === "forgot"
                    ? "Enviar enlace"
                    : "Cambiar contraseña"}
          </button>
        </form>
        <div className="text-xs text-text-muted mt-4 space-y-2">
          {mode === "login" && (
            <>
              <p>
                ¿No tenés cuenta?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className="text-primary hover:text-primary-hover underline"
                >
                  Registrate
                </button>
              </p>
              <p>
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-primary hover:text-primary-hover underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </p>
            </>
          )}
          {mode === "register" && (
            <p>
              ¿Ya tenés cuenta?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-primary hover:text-primary-hover underline"
              >
                Ingresar
              </button>
            </p>
          )}
          {(mode === "forgot" || mode === "reset") && (
            <p>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-primary hover:text-primary-hover underline"
              >
                Volver a ingresar
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
