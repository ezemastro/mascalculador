import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { createBrowserRouter, RouterProvider, Link, Outlet } from "react-router";
import FormPage from "./screens/FormPage.tsx";
import ResultsPage from "./screens/ResultsPage.tsx";
import ColumnForm from "./screens/ColumnForm.tsx";
import ColumnResults from "./screens/ColumnResults.tsx";
import ConcreteForm from "./screens/ConcreteForm.tsx";
import ConcreteResults from "./screens/ConcreteResults.tsx";
import PrintPage from "./screens/PrintPage.tsx";
import SlabForm from "./screens/SlabForm.tsx";
import SlabResults from "./screens/SlabResults.tsx";
import CartelForm from "./screens/CartelForm.tsx";
import BasesForm from "./screens/BasesForm.tsx";
import BasesResults from "./screens/BasesResults.tsx";

function NavBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-surface border-b border-border px-4 py-2 flex gap-4">
      <Link to="/" className="text-sm text-text-muted hover:text-text">Viga Acero</Link>
      <Link to="/columns" className="text-sm text-text-muted hover:text-text">Columnas</Link>
      <Link to="/concrete" className="text-sm text-text-muted hover:text-text">Viga H°</Link>
      <Link to="/print" className="text-sm text-text-muted hover:text-text">Imprimir</Link>
      <Link to="/slab" className="text-sm text-text-muted hover:text-text">Losas</Link>
      <Link to="/cartel" className="text-sm text-text-muted hover:text-text">Carteles</Link>
      <Link to="/bases" className="text-sm text-text-muted hover:text-text">Bases</Link>
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
      { path: "/", Component: FormPage },
      { path: "/results", Component: ResultsPage },
      { path: "/columns", Component: ColumnForm },
      { path: "/column-results", Component: ColumnResults },
      { path: "/concrete", Component: ConcreteForm },
      { path: "/concrete-results", Component: ConcreteResults },
      { path: "/print", Component: PrintPage },
      { path: "/slab", Component: SlabForm },
      { path: "/slab-results", Component: SlabResults },
      { path: "/cartel", Component: CartelForm },
      { path: "/bases", Component: BasesForm },
      { path: "/bases-results", Component: BasesResults },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />,
  </StrictMode>,
);
