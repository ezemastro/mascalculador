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
  Navigate,
} from "react-router";
import AuthScreen from "./screens/AuthScreen.tsx";
import AdminScreen from "./screens/AdminScreen.tsx";
import ConcreteForm from "./screens/ConcreteForm.tsx";
import ConcreteResults from "./screens/ConcreteResults.tsx";
import SlabForm from "./screens/SlabForm.tsx";
import SlabResults from "./screens/SlabResults.tsx";
import SlabCompat from "./screens/SlabCompat.tsx";
import CompatList from "./screens/CompatList.tsx";
import BasesForm from "./screens/BasesForm.tsx";
import BasesResults from "./screens/BasesResults.tsx";
import RCColumnForm from "./screens/RCColumnForm.tsx";
import RCColumnResults from "./screens/RCColumnResults.tsx";

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
    <div className="fixed top-0 left-0 right-0 z-50 bg-surface border-b border-border px-4 py-2 flex gap-4 items-center">
      <Link to="/slab" className="text-sm text-text-muted hover:text-text">
        Losas
      </Link>
      <Link
        to="/slab-compats"
        className="text-sm text-text-muted hover:text-text"
      >
        Apoyos losas
      </Link>
      <Link to="/concrete" className="text-sm text-text-muted hover:text-text">
        Vigas
      </Link>
      <Link to="/rc-column" className="text-sm text-text-muted hover:text-text">
        Columnas
      </Link>
      <Link to="/bases" className="text-sm text-text-muted hover:text-text">
        Bases
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
    </div>
  );
}

function HomeRedirect() {
  return <Navigate to="/slab" replace />;
}

function Layout({
  username,
  admin,
  onLogout,
}: {
  username: string;
  admin: boolean;
  onLogout: () => void;
}) {
  return (
    <>
      <NavBar username={username} admin={admin} onLogout={onLogout} />
      <div className="pt-10">
        <Outlet />
      </div>
    </>
  );
}

function buildRouter(username: string, admin: boolean, onLogout: () => void) {
  return createBrowserRouter([
    {
      Component: () => (
        <Layout username={username} admin={admin} onLogout={onLogout} />
      ),
      children: [
        { path: "/", Component: HomeRedirect },
        { path: "/results", Component: ConcreteResults },
        { path: "/concrete", Component: ConcreteForm },
        { path: "/concrete-results", Component: ConcreteResults },
        { path: "/slab", Component: SlabForm },
        { path: "/slab-results", Component: SlabResults },
        { path: "/slab-compat", Component: SlabCompat },
        { path: "/slab-compats", Component: CompatList },
        { path: "/bases", Component: BasesForm },
        { path: "/bases-results", Component: BasesResults },
        { path: "/rc-column", Component: RCColumnForm },
        { path: "/rc-column-results", Component: RCColumnResults },
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
