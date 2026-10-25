/* eslint-disable react-refresh/only-export-components -- el hook usePrintMenu, PRINT_ITEMS y buildSheets se comparten con HomeScreen */
import { useEffect, useRef, useState } from "react";
import { printSheets } from "../lib/print-sheets";
import {
  buildBasesSheet,
  buildTroncoSheet,
  buildCabezalVigaSheet,
  buildColumnaSheet,
  buildLosaSheet,
  buildMuroSheet,
  buildApoyosSheet,
  buildPileCapSheet,
  buildVigaSheet,
  type PlanillaSheet,
} from "../lib/print-planilla";
import {
  getSavedBeams,
  getSavedSlabs,
  getSavedSupports,
  getSavedCompats,
} from "../lib/storage";

export type PrintKind =
  | "losas"
  | "vigas"
  | "columnas"
  | "bases"
  | "vf-cabezales"
  | "cabezales"
  | "muros";

export const PRINT_ITEMS: { kind: PrintKind; label: string; hint: string }[] = [
  {
    kind: "losas",
    label: "Losas",
    hint: "Planilla de losas + planilla de apoyos",
  },
  { kind: "vigas", label: "Vigas", hint: "Planilla de vigas H° A°" },
  { kind: "columnas", label: "Columnas", hint: "Planilla de columnas" },
  {
    kind: "bases",
    label: "Bases",
    hint: "Planilla de bases + planilla de troncos",
  },
  {
    kind: "vf-cabezales",
    label: "Vigas de fundación",
    hint: "Planilla de vigas de fundación para cabezales",
  },
  {
    kind: "cabezales",
    label: "Cabezales",
    hint: "Planilla de cabezales sobre pilotes",
  },
  {
    kind: "muros",
    label: "Muros de contención",
    hint: "Planilla de muros de contención",
  },
];

export function buildSheets(kind: PrintKind): PlanillaSheet[] | null {
  switch (kind) {
    case "losas":
      return [
        buildLosaSheet(getSavedSlabs()),
        buildApoyosSheet([...getSavedSupports(), ...getSavedCompats()]),
      ];
    case "vigas":
      return [buildVigaSheet(getSavedBeams("hormigon"))];
    case "columnas":
      return [buildColumnaSheet(getSavedBeams("rc-columna"))];
    case "bases": {
      const bases = getSavedBeams("bases");
      return [buildBasesSheet(bases), buildTroncoSheet(bases)];
    }
    case "vf-cabezales":
      return [buildCabezalVigaSheet(getSavedBeams("cabezal"))];
    case "cabezales":
      return [buildPileCapSheet(getSavedBeams("pilecap"))];
    case "muros":
      return [buildMuroSheet(getSavedBeams("muro"))];
  }
}

/** Estado compartido del menú de impresión: abrir/cerrar el menú. Lo usan el
 *  botón de la barra superior y la tarjeta Imprimir de la página de inicio. */
export function usePrintMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function openItem(kind: PrintKind) {
    setMenuOpen(false);
    printSheets(() => buildSheets(kind));
  }

  return {
    menuOpen,
    setMenuOpen,
    openItem,
    rootRef,
  };
}

/** Botón Imprimir de la barra superior (junto a Salir): despliega las opciones
 *  de planilla e imprime directamente la elegida. */
export default function GlobalPrintMenu() {
  const { menuOpen, setMenuOpen, openItem, rootRef } = usePrintMenu();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="text-sm bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1.5"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
          />
        </svg>
        Imprimir
        <span className="text-[10px] text-text-muted">
          {menuOpen ? "▲" : "▼"}
        </span>
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-64 rounded-lg border border-border bg-surface shadow-lg z-[70] py-1"
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
    </div>
  );
}
