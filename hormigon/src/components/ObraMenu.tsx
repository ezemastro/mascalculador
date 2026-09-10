// Menú compacto de obras del header: cambiar la obra activa + crearla,
// renombrarla o eliminarla. Concentra en un solo control las acciones que
// antes vivían sueltas en la barra. Mismo patrón que GlobalPrintMenu: cierre
// con click afuera o Escape.
import { useEffect, useRef, useState } from "react";
import {
  createObra,
  deleteObra,
  getCurrentObraId,
  renameObra,
  type SavedObra,
} from "../lib/storage";

export default function ObraMenu({
  obraId,
  obras,
  onObraChange,
}: {
  obraId: string;
  obras: SavedObra[];
  onObraChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeName = obras.find((o) => o.id === obraId)?.name ?? "Sin obra";

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

  function fail(err: unknown) {
    alert(err instanceof Error ? err.message : String(err));
  }

  function handleNew() {
    const name = prompt("Nombre de la nueva obra:");
    if (name === null) return;
    try {
      onObraChange(createObra(name).id);
      setOpen(false);
    } catch (err) {
      fail(err);
    }
  }

  function handleRename() {
    const name = prompt("Nuevo nombre de la obra:", activeName);
    if (name === null) return;
    try {
      renameObra(obraId, name);
      onObraChange(obraId);
      setOpen(false);
    } catch (err) {
      fail(err);
    }
  }

  function handleDelete() {
    const confirmed = confirm(
      `¿Eliminar la obra "${activeName}"? Se borrarán todos sus elementos guardados.`,
    );
    if (!confirmed) return;
    try {
      const nextId = deleteObra(obraId);
      onObraChange(nextId ?? getCurrentObraId());
      setOpen(false);
    } catch (err) {
      fail(err);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={activeName}
        className="flex max-w-48 items-center gap-1.5 text-xs bg-surface-alt border border-border rounded-lg px-2 py-1 hover:bg-surface transition-colors"
      >
        <span className="text-text-muted">Obra</span>
        <span className="truncate font-medium text-text">{activeName}</span>
        <span className="text-[10px] text-text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 w-56 rounded-lg border border-border bg-surface shadow-lg z-[70] py-1"
        >
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Cambiar de obra
          </p>
          <div className="max-h-64 overflow-y-auto">
            {obras.map((o) => (
              <button
                key={o.id}
                type="button"
                role="menuitemradio"
                aria-checked={o.id === obraId}
                onClick={() => {
                  onObraChange(o.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm hover:bg-surface-alt"
              >
                <span className="w-3 shrink-0 text-primary">
                  {o.id === obraId ? "✓" : ""}
                </span>
                <span className="truncate">{o.name}</span>
              </button>
            ))}
          </div>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={handleNew}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-alt"
          >
            + Nueva obra…
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleRename}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-alt"
          >
            Renombrar obra…
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleDelete}
            className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
          >
            Eliminar obra…
          </button>
        </div>
      )}
    </div>
  );
}
