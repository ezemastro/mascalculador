/* eslint-disable react-refresh/only-export-components -- baseline: NavBar is a local helper; extraction to NavBar.tsx tracked in follow-up */
import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { flushCloudStorage, installCloudStorage } from "./lib/cloud-storage.ts";
import {
  createBrowserRouter,
  RouterProvider,
  Link,
  Outlet,
} from "react-router";
import AuthScreen from "./screens/AuthScreen.tsx";
import AdminScreen from "./screens/AdminScreen.tsx";
import VigaContinuaForm from "./screens/VigaContinuaForm.tsx";
import VigaContinuaResults from "./screens/VigaContinuaResults.tsx";
import PrintPage from "./screens/PrintPage.tsx";

// Route + URL contract (since PR1):
//   /                                  → VigaContinuaForm (default mode)
//   /viga-continua                     → VigaContinuaForm (default mode)
//   /viga-continua?mode=viga-continua  → beam form (default — the key may be omitted)
//   /viga-continua?mode=portico        → pórtico placeholder branch inside the form screen
//   /viga-continua-results             → VigaContinuaResults; branches on `location.state.mode`
//                                       ("portico" → pórtico placeholder until PR3/PR4 ship)
// The screens themselves read `useSearchParams` / `location.state` to switch.

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: "2rem",
            color: "#f87171",
            background: "#1e1e2e",
            minHeight: "100vh",
            fontFamily: "monospace",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            Error al cargar la aplicación
          </h1>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: "0.875rem",
              color: "#e0e0f0",
            }}
          >
            {this.state.error.message}
          </pre>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: "0.75rem",
              color: "#9090b0",
              marginTop: "1rem",
            }}
          >
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function NavBar({
  username,
  admin,
  onLogout,
}: {
  username: string;
  admin: boolean;
  onLogout: () => void;
}) {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-50 bg-surface border-b border-border px-4 py-2 flex gap-4 items-center">
        <Link to="/" className="text-sm text-text-muted hover:text-text">
          Viga Continua
        </Link>
        {admin && (
          <Link to="/admin" className="text-sm text-text-muted hover:text-text">
            Admin
          </Link>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-text-muted">{username}</span>
          <button
            type="button"
            onClick={onLogout}
            className="text-xs text-text-muted hover:text-danger"
          >
            Salir
          </button>
        </div>
      </header>
      <main className="px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}

function buildRouter(username: string, admin: boolean, onLogout: () => void) {
  return createBrowserRouter([
    { path: "/viga-continua-print", Component: PrintPage },
    {
      Component: () => (
        <NavBar username={username} admin={admin} onLogout={onLogout} />
      ),
      children: [
        { path: "/", Component: VigaContinuaForm },
        { path: "/viga-continua", Component: VigaContinuaForm },
        { path: "/viga-continua-results", Component: VigaContinuaResults },
        ...(admin ? [{ path: "/admin", Component: AdminScreen }] : []),
      ],
    },
  ]);
}

type Session = { username: string; admin: boolean } | null;

async function fetchSession(): Promise<Session> {
  try {
    const me = await fetch("/api/auth/me");
    if (me.ok) {
      const data = (await me.json()) as { username: string; admin?: boolean };
      return { username: data.username, admin: Boolean(data.admin) };
    }
  } catch {
    // Server inalcanzable: sin sesión confirmada, queda la pantalla de login.
  }
  return null;
}

async function main() {
  const root = createRoot(document.getElementById("root")!);
  const session = await fetchSession();
  if (session) await installCloudStorage();

  function render(s: Session) {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          {s ? (
            <RouterProvider
              router={buildRouter(s.username, s.admin, () => {
                void handleLogout(render);
              })}
            />
          ) : (
            <AuthScreen
              onAuthenticated={async () => {
                await installCloudStorage();
                render(await fetchSession());
              }}
            />
          )}
        </ErrorBoundary>
      </StrictMode>,
    );
  }

  async function handleLogout(doRender: typeof render) {
    try {
      await flushCloudStorage();
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    } catch {
      // Igual volvemos a la pantalla de login.
    }
    doRender(null);
  }

  render(session);
}

main();
