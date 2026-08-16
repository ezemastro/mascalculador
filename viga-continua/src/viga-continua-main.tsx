/* eslint-disable react-refresh/only-export-components -- baseline: NavBar is a local helper; extraction to NavBar.tsx tracked in follow-up */
import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import {
  createBrowserRouter,
  RouterProvider,
  Link,
  Outlet,
} from "react-router";
import VigaContinuaForm from "./screens/VigaContinuaForm.tsx";
import VigaContinuaResults from "./screens/VigaContinuaResults.tsx";

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

function NavBar() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-50 bg-surface border-b border-border px-4 py-2 flex gap-4">
        <Link to="/" className="text-sm text-text-muted hover:text-text">
          Viga Continua
        </Link>
      </header>
      <main className="px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}

const router = createBrowserRouter([
  {
    Component: NavBar,
    children: [
      { path: "/", Component: VigaContinuaForm },
      { path: "/viga-continua", Component: VigaContinuaForm },
      { path: "/viga-continua-results", Component: VigaContinuaResults },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>,
);
