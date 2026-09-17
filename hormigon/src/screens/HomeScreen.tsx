import { type ReactNode } from "react";
import { Link, useOutletContext } from "react-router";
import ScreenHeader from "../components/ScreenHeader";
import ObraMenu from "../components/ObraMenu";
import {
  PRINT_ITEMS,
  PrintDialogHost,
  usePrintMenu,
} from "../components/GlobalPrintMenu";
import type { SavedObra } from "../lib/storage";

/** Contexto que el Layout expone por el Outlet (obra activa). */
export type HomeContext = {
  obraId: string;
  obras: SavedObra[];
  onObraChange: (id: string) => void;
};

type ModuleDef = {
  to: string;
  name: string;
  description: string;
  icon: ReactNode;
};

/** Iconos de módulo: trazo simple, mismo lenguaje que el resto de la app. */
const ICONS = {
  losas: <path d="M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16" />,
  apoyos: (
    <>
      <circle cx="8" cy="12" r="3" />
      <circle cx="16" cy="12" r="3" />
      <path d="M11 12h2" />
    </>
  ),
  vigas: (
    <>
      <path d="M4 8h16" />
      <path d="M4 8l2-3M20 8l-2-3" />
      <path d="M8 21l1.5-6M16 21l-1.5-6" />
    </>
  ),
  columnas: (
    <>
      <path d="M9 3h6v18H9z" />
      <path d="M6 3h12M6 21h12" />
    </>
  ),
  bases: (
    <>
      <path d="M10 3h4v3h-4z" />
      <path d="M5 6h14l2.5 6H2.5z" />
    </>
  ),
  muro: (
    <>
      <path d="M3 3h18v18H3z" />
      <path d="M3 9h18M3 15h18M9 3v6M15 9v6M9 15v6" />
    </>
  ),
  vfCabezales: (
    <>
      <path d="M4 4h16v5H4z" />
      <path d="M8 9v4M12 9v5M16 9v4" />
    </>
  ),
  cabezales: (
    <>
      <path d="M5 3h14v6H5z" />
      <path d="M8 9v5M12 9v5M16 9v5" />
      <path d="M6 20h12" />
    </>
  ),
  computos: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </>
  ),
  imprimir: (
    <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  ),
};

const CALC_MODULES: ModuleDef[] = [
  {
    to: "/slab",
    name: "Losas",
    description: "Losas macizas de hormigón armado",
    icon: ICONS.losas,
  },
  {
    to: "/slab-compats",
    name: "Apoyos de losas",
    description: "Compatibilidad de apoyos entre losas",
    icon: ICONS.apoyos,
  },
  {
    to: "/concrete",
    name: "Vigas",
    description: "Vigas de hormigón armado",
    icon: ICONS.vigas,
  },
  {
    to: "/rc-column",
    name: "Columnas",
    description: "Columnas de hormigón armado",
    icon: ICONS.columnas,
  },
  {
    to: "/bases",
    name: "Bases",
    description: "Bases de fundación",
    icon: ICONS.bases,
  },
  {
    to: "/muro",
    name: "Muro de contención",
    description: "Muros de contención de suelo",
    icon: ICONS.muro,
  },
  {
    to: "/cabezales",
    name: "Vigas de fundación para cabezales",
    description: "Vigas de fundación sobre pilotes",
    icon: ICONS.vfCabezales,
  },
  {
    to: "/cabezal-pilotes",
    name: "Cabezales",
    description: "Cabezales sobre pilotes",
    icon: ICONS.cabezales,
  },
];

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title mb-3">{children}</h2>;
}

function ModuleCard({ to, name, description, icon }: ModuleDef) {
  return (
    <Link
      to={to}
      className="group block overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-colors hover:border-primary/50"
    >
      <div className="h-1.5 bg-brand" />
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {icon}
          </svg>
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display text-sm font-bold text-text">{name}</h3>
            <span className="text-xs text-primary transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}

/** Tarjeta Imprimir: abre el menú de planillas y el diálogo de impresión
 *  (misma lógica que el botón Imprimir de la barra superior). */
function ImprimirCard() {
  const { menuOpen, setMenuOpen, dialog, openItem, closeDialog, rootRef } =
    usePrintMenu();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="group block w-full overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-sm transition-colors hover:border-primary/50"
      >
        <div className="h-1.5 bg-[#2f7d3b]" />
        <div className="flex items-start gap-3 p-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {ICONS.imprimir}
            </svg>
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-display text-sm font-bold text-text">
                Imprimir
              </h3>
              <span className="text-[10px] text-text-muted">
                {menuOpen ? "▲" : "▼"}
              </span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
              Planillas de losas, vigas, columnas y bases
            </p>
          </div>
        </div>
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-border bg-surface shadow-lg z-[70] py-1"
        >
          {PRINT_ITEMS.map((item) => (
            <button
              key={item.kind}
              type="button"
              role="menuitem"
              onClick={() => openItem(item.kind)}
              className="w-full text-left px-3 py-2 hover:bg-surface-alt transition-colors"
            >
              <span className="block text-sm font-medium text-text">
                {item.label}
              </span>
              <span className="block text-xs text-text-muted">{item.hint}</span>
            </button>
          ))}
        </div>
      )}

      <PrintDialogHost dialog={dialog} onClose={closeDialog} />
    </div>
  );
}

/** Página de inicio: acceso a los módulos de cálculo y a las salidas de
 *  obra (cómputos e impresión). La obra activa se elige desde el header. */
export default function HomeScreen() {
  const { obraId, obras, onObraChange } = useOutletContext<HomeContext>();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <ScreenHeader
        title="MASCALCULADOR"
        subtitle="Herramientas de cálculo para estructuras de Hormigón Armado según CIRSOC 201-05"
        logoClassName="h-20 w-auto rounded-lg bg-white px-4 py-2.5 ring-1 ring-black/5"
        actions={
          <ObraMenu obraId={obraId} obras={obras} onObraChange={onObraChange} />
        }
      />

      <section className="mt-8">
        <SectionTitle>Calcular</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CALC_MODULES.map((mod) => (
            <ModuleCard key={mod.to} {...mod} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle>Resultados de obra</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/computos"
            className="group block overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-colors hover:border-primary/50"
          >
            <div className="h-1.5 bg-[#2f7d3b]" />
            <div className="flex items-start gap-3 p-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {ICONS.computos}
                </svg>
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display text-sm font-bold text-text">
                    Cómputos
                  </h3>
                  <span className="text-xs text-primary transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                  Cómputos de materiales de toda la obra
                </p>
              </div>
            </div>
          </Link>
          <ImprimirCard />
        </div>
      </section>
    </div>
  );
}
