import { useEffect, useRef, useState } from "react";
import PrintDialog from "./PrintDialog";
import {
  buildBasesSheet,
  buildColumnaSheet,
  buildLosaSheet,
  buildApoyosSheet,
  buildVigaSheet,
  type PlanillaSheet,
} from "../lib/print-planilla";
import {
  getSavedBeams,
  getSavedSlabs,
  getSavedSupports,
  getSavedCompats,
} from "../lib/storage";

type PrintKind = "losas" | "vigas" | "columnas" | "bases";

const ITEMS: { kind: PrintKind; label: string; hint: string }[] = [
  {
    kind: "losas",
    label: "Losas",
    hint: "Planilla de losas + planilla de apoyos",
  },
  { kind: "vigas", label: "Vigas", hint: "Planilla de vigas H° A°" },
  { kind: "columnas", label: "Columnas", hint: "Planilla de columnas" },
  { kind: "bases", label: "Bases", hint: "Planilla de bases" },
];

function buildSheets(kind: PrintKind): PlanillaSheet[] | null {
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
    case "bases":
      return [buildBasesSheet(getSavedBeams("bases"))];
  }
}

/** Botón Imprimir de la barra superior (junto a Salir): despliega las 4
 *  opciones de planilla y abre el diálogo de impresión correspondiente. */
export default function GlobalPrintMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<{
    kind: PrintKind;
    title: string;
  } | null>(null);
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
          {ITEMS.map((item) => (
            <button
              key={item.kind}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setDialog({
                  kind: item.kind,
                  title: `Imprimir planilla de ${item.label.toLowerCase()}`,
                });
              }}
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

      <PrintDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog?.title ?? ""}
        buildSheets={() => (dialog ? buildSheets(dialog.kind) : null)}
      />
    </div>
  );
}
