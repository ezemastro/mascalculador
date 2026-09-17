import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useOutletContext } from "react-router";
import ScreenHeader from "../components/ScreenHeader";
import ObraMenu from "../components/ObraMenu";
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
  vigaAcero: (
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
  losas: <path d="M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16" />,
  compatLosas: (
    <>
      <path d="M4 4h8v8H4z" />
      <path d="M12 12h8v8h-8z" />
      <path d="M8 4v3M4 8h3M16 12v3M12 16h3" />
    </>
  ),
  apoyos: (
    <>
      <circle cx="8" cy="12" r="3" />
      <circle cx="16" cy="12" r="3" />
      <path d="M11 12h2" />
    </>
  ),
  vigaH: (
    <>
      <path d="M4 6h16v6H4z" />
      <path d="M8 12v6M16 12v6" />
    </>
  ),
  cartel: (
    <>
      <path d="M4 4h16v10H4z" />
      <path d="M8 14v6M16 14v6" />
      <path d="M5 20h14" />
    </>
  ),
  columnaH: (
    <>
      <path d="M9 3h6v18H9z" />
      <path d="M9 8h6M9 13h6" />
      <path d="M6 3h12M6 21h12" />
    </>
  ),
  imprimir: (
    <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  ),
};

const CALC_MODULES: ModuleDef[] = [
  {
    to: "/viga-acero",
    name: "Viga de acero",
    description: "Vigas simplemente apoyadas y continuas de acero",
    icon: ICONS.vigaAcero,
  },
  {
    to: "/columns",
    name: "Columnas de acero",
    description: "Columnas de perfiles, tubos y armadas",
    icon: ICONS.columnas,
  },
  {
    to: "/bases",
    name: "Bases",
    description: "Bases de fundación",
    icon: ICONS.bases,
  },
  {
    to: "/slab",
    name: "Losas H°",
    description: "Losas macizas de hormigón armado",
    icon: ICONS.losas,
  },
  {
    to: "/slab-compat",
    name: "Compat. Losas",
    description: "Compatibilidad de losas colindantes",
    icon: ICONS.compatLosas,
  },
  {
    to: "/slab-compats",
    name: "Apoyos",
    description: "Apoyos compatibilizados entre losas",
    icon: ICONS.apoyos,
  },
  {
    to: "/concrete",
    name: "Viga H°",
    description: "Vigas de hormigón armado",
    icon: ICONS.vigaH,
  },
  {
    to: "/cartel",
    name: "Carteles",
    description: "Carteles publicitarios según CIRSOC 102",
    icon: ICONS.cartel,
  },
  {
    to: "/rc-column",
    name: "Columna H°",
    description: "Columnas de hormigón armado",
    icon: ICONS.columnaH,
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

/** Tarjeta Imprimir: menú con las planillas disponibles de MAS ACERO. */
function ImprimirCard() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    { to: "/print", label: "Vigas de acero", hint: "Planillas de vigas" },
    {
      to: "/column-print",
      label: "Columnas de acero",
      hint: "Planillas de columnas",
    },
    { to: "/cartel-print", label: "Carteles", hint: "Planillas de carteles" },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
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
                {open ? "▲" : "▼"}
              </span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
              Planillas de vigas, columnas y carteles
            </p>
          </div>
        </div>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-border bg-surface shadow-lg z-[70] py-1"
        >
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block w-full text-left px-3 py-2 hover:bg-surface-alt transition-colors"
            >
              <span className="block text-sm font-medium text-text">
                {item.label}
              </span>
              <span className="block text-xs text-text-muted">{item.hint}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Página de inicio: acceso a los módulos de cálculo y a las planillas de
 *  impresión. La obra activa se elige desde el header. */
export default function HomeScreen() {
  const { obraId, obras, onObraChange } = useOutletContext<HomeContext>();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <ScreenHeader
        title="MAS ACERO"
        subtitle="Herramientas de cálculo para estructuras de Acero y Hormigón Armado"
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
          <ImprimirCard />
        </div>
      </section>
    </div>
  );
}
