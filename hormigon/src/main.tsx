import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import {
  createBrowserRouter,
  RouterProvider,
  Link,
  Outlet,
} from "react-router";
import ConcreteForm from "./screens/ConcreteForm.tsx";
import ConcreteResults from "./screens/ConcreteResults.tsx";
import VigaContinuaForm from "./screens/VigaContinuaForm.tsx";
import VigaContinuaResults from "./screens/VigaContinuaResults.tsx";
import SlabForm from "./screens/SlabForm.tsx";
import SlabResults from "./screens/SlabResults.tsx";
import SlabCompat from "./screens/SlabCompat.tsx";
import CompatList from "./screens/CompatList.tsx";
import BasesForm from "./screens/BasesForm.tsx";
import BasesResults from "./screens/BasesResults.tsx";
import RCColumnForm from "./screens/RCColumnForm.tsx";
import RCColumnResults from "./screens/RCColumnResults.tsx";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "2rem", color: "#f87171", background: "#1e1e2e", minHeight: "100vh", fontFamily: "monospace" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Error al cargar la aplicación</h1>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.875rem", color: "#e0e0f0" }}>
            {this.state.error.message}
          </pre>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.75rem", color: "#9090b0", marginTop: "1rem" }}>
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
    <div className="fixed top-0 left-0 right-0 z-50 bg-surface border-b border-border px-4 py-2 flex gap-4">
      <Link to="/" className="text-sm text-text-muted hover:text-text">
        Viga H°
      </Link>
      <Link
        to="/viga-continua"
        className="text-sm text-text-muted hover:text-text"
      >
        Viga Continua
      </Link>
      <Link to="/bases" className="text-sm text-text-muted hover:text-text">
        Bases
      </Link>
      <Link to="/slab" className="text-sm text-text-muted hover:text-text">
        Losas H°
      </Link>
      <Link to="/slab-compat" className="text-sm text-text-muted hover:text-text">
        Compat. Losas
      </Link>
      <Link to="/slab-compats" className="text-sm text-text-muted hover:text-text">
        Apoyos
      </Link>
      <Link to="/rc-column" className="text-sm text-text-muted hover:text-text">
        Columna H°
      </Link>
    </div>
  );
}

function Layout() {
  return (
    <>
      <NavBar />
      <div className="pt-10">
        <Outlet />
      </div>
    </>
  );
}

const router = createBrowserRouter([
  {
    Component: Layout,
    children: [
      { path: "/", Component: ConcreteForm },
      { path: "/results", Component: ConcreteResults },
      { path: "/concrete", Component: ConcreteForm },
      { path: "/concrete-results", Component: ConcreteResults },
      { path: "/viga-continua", Component: VigaContinuaForm },
      { path: "/viga-continua-results", Component: VigaContinuaResults },
      { path: "/slab", Component: SlabForm },
      { path: "/slab-results", Component: SlabResults },
      { path: "/slab-compat", Component: SlabCompat },
      { path: "/slab-compats", Component: CompatList },
      { path: "/bases", Component: BasesForm },
      { path: "/bases-results", Component: BasesResults },
      { path: "/rc-column", Component: RCColumnForm },
      { path: "/rc-column-results", Component: RCColumnResults },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>
);
