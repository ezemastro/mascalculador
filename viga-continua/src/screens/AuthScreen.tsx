import { useState, type FormEvent } from "react";

type Mode = "login" | "register" | "forgot" | "reset";

function getResetToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("reset");
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
    "w-full bg-surface-alt border border-border rounded px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary";

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
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "reset" ? "Nueva contraseña" : "Contraseña"}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={8}
              required
            />
          )}
          {mode === "reset" && (
            <input
              className={inputClass}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repetí la contraseña"
              autoComplete="new-password"
              minLength={8}
              required
            />
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
