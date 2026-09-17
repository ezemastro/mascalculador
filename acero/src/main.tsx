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
import FormPage from "./screens/FormPage.tsx";
import ResultsPage from "./screens/ResultsPage.tsx";
import PrintPage from "./screens/PrintPage.tsx";
import ColumnForm from "./screens/ColumnForm.tsx";
import ColumnResults from "./screens/ColumnResults.tsx";
import ColumnPrintPage from "./screens/ColumnPrintPage.tsx";
import CartelForm from "./screens/CartelForm.tsx";
import CartelResults from "./screens/CartelResults.tsx";
import CartelPrintPage from "./screens/CartelPrintPage.tsx";
import SlabForm from "./screens/SlabForm.tsx";
import SlabResults from "./screens/SlabResults.tsx";
import BasesForm from "./screens/BasesForm.tsx";
import BasesResults from "./screens/BasesResults.tsx";
import SlabCompat from "./screens/SlabCompat.tsx";
import CompatList from "./screens/CompatList.tsx";
import ConcreteForm from "./screens/ConcreteForm.tsx";
import ConcreteResults from "./screens/ConcreteResults.tsx";
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
  onLogout,
}: {
  username: string;
  onLogout: () => void;
}) {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface border-b border-border px-4 py-2 flex gap-4 items-center">
        <Link to="/" className="text-sm text-text-muted hover:text-text">
          Viga Acero
        </Link>
        <Link to="/columns" className="text-sm text-text-muted hover:text-text">
          Columnas
        </Link>
        <Link to="/bases" className="text-sm text-text-muted hover:text-text">
          Bases
        </Link>
        <Link to="/slab" className="text-sm text-text-muted hover:text-text">
          Losas H°
        </Link>
        <Link
          to="/slab-compat"
          className="text-sm text-text-muted hover:text-text"
        >
          Compat. Losas
        </Link>
        <Link
          to="/slab-compats"
          className="text-sm text-text-muted hover:text-text"
        >
          Apoyos
        </Link>
        <Link
          to="/concrete"
          className="text-sm text-text-muted hover:text-text"
        >
          Viga H°
        </Link>
        <Link to="/cartel" className="text-sm text-text-muted hover:text-text">
          Carteles
        </Link>
        <Link
          to="/rc-column"
          className="text-sm text-text-muted hover:text-text"
        >
          Columna H°
        </Link>
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
      <main className="pt-10">
        <Outlet />
      </main>
    </div>
  );
}

function buildRouter(username: string, onLogout: () => void) {
  return createBrowserRouter([
    {
      Component: () => <NavBar username={username} onLogout={onLogout} />,
      children: [
        { path: "/", Component: FormPage },
        { path: "/results", Component: ResultsPage },
        { path: "/print", Component: PrintPage },
        { path: "/columns", Component: ColumnForm },
        { path: "/column-results", Component: ColumnResults },
        { path: "/column-print", Component: ColumnPrintPage },
        { path: "/cartel", Component: CartelForm },
        { path: "/cartel-results", Component: CartelResults },
        { path: "/cartel-print", Component: CartelPrintPage },
        { path: "/slab", Component: SlabForm },
        { path: "/slab-results", Component: SlabResults },
        { path: "/bases", Component: BasesForm },
        { path: "/bases-results", Component: BasesResults },
        { path: "/slab-compat", Component: SlabCompat },
        { path: "/slab-compats", Component: CompatList },
        { path: "/concrete", Component: ConcreteForm },
        { path: "/concrete-results", Component: ConcreteResults },
        { path: "/rc-column", Component: RCColumnForm },
        { path: "/rc-column-results", Component: RCColumnResults },
      ],
    },
  ]);
}

type Session = { username: string } | null;

async function fetchSession(): Promise<Session> {
  try {
    const me = await fetch("/api/auth/me");
    if (me.ok) {
      const data = (await me.json()) as { username: string };
      return { username: data.username };
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
              router={buildRouter(s.username, () => {
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
