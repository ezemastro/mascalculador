/* eslint-disable react-refresh/only-export-components -- baseline: NavBar is a local helper; extraction to NavBar.tsx tracked in follow-up */
import { StrictMode, Component, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { flushCloudStorage } from "./lib/cloud-storage.ts";
import {
  bootstrapStorage,
  createObra,
  deleteObra,
  getCurrentObraId,
  getObras,
  renameObra,
  setCurrentObraId,
  type SavedObra,
} from "./lib/storage";
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
import ComputosObraScreen from "./screens/ComputosObraScreen.tsx";
import { ObraPickerHost } from "./components/ObraPicker.tsx";
import GlobalPrintMenu from "./components/GlobalPrintMenu.tsx";

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
  impersonating,
  onLogout,
  onExitImpersonate,
  obraId,
  obras,
  onObraChange,
}: {
  username: string;
  admin: boolean;
  impersonating: boolean;
  onLogout: () => void;
  onExitImpersonate: () => void;
  obraId: string;
  obras: SavedObra[];
  onObraChange: (id: string) => void;
}) {
  const activeName = obras.find((o) => o.id === obraId)?.name ?? "";

  const handleNewObra = () => {
    const name = prompt("Nombre de la nueva obra:");
    if (name === null) return;
    try {
      onObraChange(createObra(name).id);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRenameObra = () => {
    const name = prompt("Nuevo nombre de la obra:", activeName);
    if (name === null) return;
    try {
      renameObra(obraId, name);
      onObraChange(obraId);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteObra = () => {
    const confirmed = confirm(
      `¿Eliminar la obra "${activeName}"? Se borrarán todos sus elementos guardados.`,
    );
    if (!confirmed) return;
    try {
      const nextId = deleteObra(obraId);
      onObraChange(nextId ?? getCurrentObraId());
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="no-print fixed top-0 left-0 right-0 z-50 bg-surface border-b border-border px-4 py-2 flex gap-4 items-center">
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">Obra</span>
        <select
          value={obraId}
          onChange={(e) => onObraChange(e.target.value)}
          className="text-xs bg-surface border border-border rounded px-1 py-0.5 max-w-32"
        >
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleNewObra}
          className="text-xs text-text-muted hover:text-text"
        >
          Nueva obra
        </button>
        <button
          type="button"
          onClick={handleRenameObra}
          className="text-xs text-text-muted hover:text-text"
        >
          Renombrar obra
        </button>
        <button
          type="button"
          onClick={handleDeleteObra}
          className="text-xs text-text-muted hover:text-danger"
        >
          Eliminar obra
        </button>
      </div>
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
      <Link to="/computos" className="text-sm text-text-muted hover:text-text">
        Cómputos
      </Link>
      {admin && (
        <Link to="/admin" className="text-sm text-text-muted hover:text-text">
          Admin
        </Link>
      )}
      <div className="ml-auto flex items-center gap-3">
        <GlobalPrintMenu />
        {impersonating && (
          <button
            type="button"
            onClick={onExitImpersonate}
            title="Volver a tu sesión de administrador"
            className="text-xs font-semibold text-warning bg-warning/10 border border-warning/30 px-2 py-0.5 rounded hover:bg-warning/20"
          >
            Viendo como {username} — Volver a admin
          </button>
        )}
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

function HomeRedirect() {
  return <Navigate to="/slab" replace />;
}

function Layout({
  username,
  admin,
  impersonating,
  onLogout,
  onExitImpersonate,
}: {
  username: string;
  admin: boolean;
  impersonating: boolean;
  onLogout: () => void;
  onExitImpersonate: () => void;
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
        admin={admin}
        impersonating={impersonating}
        onLogout={onLogout}
        onExitImpersonate={onExitImpersonate}
        obraId={obraId}
        obras={obras}
        onObraChange={handleObraChange}
      />
      <ObraPickerHost onObraCreated={handleObraChange} />
      <div className="pt-10">
        <Outlet key={obraId} />
      </div>
    </>
  );
}

function buildRouter(
  username: string,
  admin: boolean,
  impersonating: boolean,
  onLogout: () => void,
  onExitImpersonate: () => void,
) {
  return createBrowserRouter([
    {
      Component: () => (
        <Layout
          username={username}
          admin={admin}
          impersonating={impersonating}
          onLogout={onLogout}
          onExitImpersonate={onExitImpersonate}
        />
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
        { path: "/computos", Component: ComputosObraScreen },
        { path: "/rc-column", Component: RCColumnForm },
        { path: "/rc-column-results", Component: RCColumnResults },
        ...(admin
          ? [
              {
                path: "/admin",
                Component: () => <AdminScreen selfUsername={username} />,
              },
            ]
          : []),
      ],
    },
  ]);
}

type Session = {
  username: string;
  admin: boolean;
  impersonating: boolean;
} | null;

async function fetchSession(): Promise<Session> {
  try {
    const me = await fetch("/api/auth/me");
    if (me.ok) {
      const data = (await me.json()) as {
        username: string;
        admin?: boolean;
        impersonating?: boolean;
      };
      return {
        username: data.username,
        admin: Boolean(data.admin),
        impersonating: Boolean(data.impersonating),
      };
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
  console.log(`[hormigon] build ${__APP_BUILD__}`);
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
              router={buildRouter(
                s.username,
                s.admin,
                s.impersonating,
                () => {
                  void handleLogout(render);
                },
                () => {
                  void handleExitImpersonate();
                },
              )}
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

  // Salir de la suplantación: sincroniza lo pendiente del usuario visto y
  // recarga la app completa para que bootstrapStorage cargue los datos del
  // admin. El server ya reponjo la cookie de sesión de admin.
  async function handleExitImpersonate() {
    try {
      await flushCloudStorage();
    } catch {
      // seguimos igual; el server reponjo la sesión de admin de todos modos
    }
    await fetch("/api/admin/exit-impersonate", { method: "POST" }).catch(
      () => {},
    );
    window.location.assign("/");
  }

  render(session);
  watchForNewBuild();
}

main();
