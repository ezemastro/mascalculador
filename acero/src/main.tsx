/* eslint-disable react-refresh/only-export-components -- baseline: NavBar is a local helper; extraction to NavBar.tsx tracked in follow-up */
import { StrictMode, Component, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { flushCloudStorage } from "./lib/cloud-storage.ts";
import {
  bootstrapStorage,
  getCurrentObraId,
  getObras,
  setCurrentObraId,
  type SavedObra,
} from "./lib/storage";
import {
  createBrowserRouter,
  RouterProvider,
  Link,
  Outlet,
  useLocation,
} from "react-router";
import AuthScreen from "./screens/AuthScreen.tsx";
import HomeScreen from "./screens/HomeScreen.tsx";
import FormPage from "./screens/FormPage.tsx";
import ResultsPage from "./screens/ResultsPage.tsx";
import PrintPage from "./screens/PrintPage.tsx";
import ColumnForm from "./screens/ColumnForm.tsx";
import ColumnResults from "./screens/ColumnResults.tsx";
import ColumnPrintPage from "./screens/ColumnPrintPage.tsx";
import CartelForm from "./screens/CartelForm.tsx";
import CartelResults from "./screens/CartelResults.tsx";
import CartelPrintPage from "./screens/CartelPrintPage.tsx";
import BasesForm from "./screens/BasesForm.tsx";
import BasesResults from "./screens/BasesResults.tsx";
import RCColumnForm from "./screens/RCColumnForm.tsx";
import RCColumnResults from "./screens/RCColumnResults.tsx";
import { ObraPickerHost } from "./components/ObraPicker.tsx";
import ObraMenu from "./components/ObraMenu.tsx";

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
  obraId,
  obras,
  onObraChange,
}: {
  username: string;
  onLogout: () => void;
  obraId: string;
  obras: SavedObra[];
  onObraChange: (id: string) => void;
}) {
  const { pathname } = useLocation();
  // En la home los módulos ya se muestran como tarjetas: la barra queda solo
  // con la obra y la sesión (usuario / salir).
  const isHome = pathname === "/";

  return (
    <div className="no-print fixed top-0 left-0 right-0 z-50 bg-surface border-b border-border px-4 py-2 flex gap-4 items-center">
      {!isHome && (
        <ObraMenu obraId={obraId} obras={obras} onObraChange={onObraChange} />
      )}
      {!isHome && (
        <>
          <Link to="/" className="text-sm text-text-muted hover:text-text">
            Inicio
          </Link>
          <Link
            to="/viga-acero"
            className="text-sm text-text-muted hover:text-text"
          >
            Viga Acero
          </Link>
          <Link
            to="/columns"
            className="text-sm text-text-muted hover:text-text"
          >
            Columnas
          </Link>
          <Link to="/bases" className="text-sm text-text-muted hover:text-text">
            Bases
          </Link>
          <Link
            to="/cartel"
            className="text-sm text-text-muted hover:text-text"
          >
            Carteles
          </Link>
          <Link
            to="/rc-column"
            className="text-sm text-text-muted hover:text-text"
          >
            Columna H°
          </Link>
        </>
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

function VersionBadge() {
  return (
    <span className="no-print fixed bottom-1 right-2 z-50 select-none pointer-events-none text-[9px] text-text-muted/50">
      build {__APP_BUILD__}
    </span>
  );
}

function Layout({
  username,
  onLogout,
}: {
  username: string;
  onLogout: () => void;
}) {
  const [obraId, setObraId] = useState(getCurrentObraId);
  const [obras, setObras] = useState<SavedObra[]>(() => getObras());

  const handleObraChange = (id: string) => {
    setCurrentObraId(id);
    setObraId(id);
    setObras(getObras());
  };

  return (
    <>
      <NavBar
        username={username}
        onLogout={onLogout}
        obraId={obraId}
        obras={obras}
        onObraChange={handleObraChange}
      />
      <ObraPickerHost onObraCreated={handleObraChange} />
      <div className="pt-10">
        <Outlet
          key={obraId}
          context={{ obraId, obras, onObraChange: handleObraChange }}
        />
      </div>
    </>
  );
}

function buildRouter(username: string, onLogout: () => void) {
  return createBrowserRouter([
    {
      Component: () => <Layout username={username} onLogout={onLogout} />,
      children: [
        { path: "/", Component: HomeScreen },
        { path: "/viga-acero", Component: FormPage },
        { path: "/results", Component: ResultsPage },
        { path: "/print", Component: PrintPage },
        { path: "/columns", Component: ColumnForm },
        { path: "/column-results", Component: ColumnResults },
        { path: "/column-print", Component: ColumnPrintPage },
        { path: "/cartel", Component: CartelForm },
        { path: "/cartel-results", Component: CartelResults },
        { path: "/cartel-print", Component: CartelPrintPage },
        { path: "/bases", Component: BasesForm },
        { path: "/bases-results", Component: BasesResults },
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

// Auto-recarga ante deploy nuevo: al recuperar el foco, compara el sello del
// documento en ejecución contra el que sirve el server (fetch con no-cache,
// inmune al cache del navegador) y se recarga si difiere. Límite de 2
// recargas por sesión para nunca entrar en un bucle.
function watchForNewBuild() {
  const mine = document
    .querySelector('meta[name="app-build"]')
    ?.getAttribute("content");
  if (!mine) return;
  const RELOADS_KEY = "buildAutoReloads";
  let lastCheck = 0;
  async function check() {
    const now = Date.now();
    if (now - lastCheck < 30_000) return;
    lastCheck = now;
    try {
      const res = await fetch("/", { cache: "no-cache" });
      if (!res.ok) return;
      const m = (await res.text()).match(
        /<meta name="app-build" content="([^"]*)"/,
      );
      const latest = m?.[1];
      if (!latest || latest === mine) return;
      const reloads = Number(sessionStorage.getItem(RELOADS_KEY) || 0);
      if (reloads >= 2) return;
      sessionStorage.setItem(RELOADS_KEY, String(reloads + 1));
      window.location.reload();
    } catch {
      // server inalcanzable: nada que hacer
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check();
  });
  window.addEventListener("focus", () => void check());
}

async function main() {
  console.log(`[acero] build ${__APP_BUILD__}`);
  const root = createRoot(document.getElementById("root")!);
  const session = await fetchSession();
  if (session) await bootstrapStorage();

  function render(s: Session) {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <VersionBadge />
          {s ? (
            <RouterProvider
              router={buildRouter(s.username, () => {
                void handleLogout(render);
              })}
            />
          ) : (
            <AuthScreen
              onAuthenticated={async () => {
                await bootstrapStorage();
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
  watchForNewBuild();
}

main();
