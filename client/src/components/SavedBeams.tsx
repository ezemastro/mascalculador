import { useState, useEffect } from "react";
import { listSaves, deleteSave, type SavedBeam } from "../lib/storage";

interface Props {
  type: "acero" | "hormigon" | "bases";
  onLoad: (data: Record<string, unknown>) => void;
}

export default function SavedBeams({ type, onLoad }: Props) {
  const [saves, setSaves] = useState<SavedBeam[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => { setSaves(listSaves().filter((s) => s.type === type)); }, [open]);

  function handleLoad(data: Record<string, unknown>) {
    onLoad(data);
    setOpen(false);
  }

  function handleDelete(id: string) {
    deleteSave(id);
    setSaves((prev) => prev.filter((s) => s.id !== id));
  }

  const items = saves.filter((s) => s.type === type);

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <button type="button" onClick={() => setOpen(!open)}
        className="text-sm font-semibold text-text-muted uppercase tracking-wider w-full text-left">
        {open ? "▼" : "▶"} Vigas guardadas ({items.length})
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {items.length === 0 && <p className="text-xs text-text-muted">No hay vigas guardadas.</p>}
          {items.map((s) => (
            <div key={s.id} className="flex items-center gap-2 p-2 bg-surface-alt rounded-lg">
              <span className="text-sm flex-1">{s.name}</span>
              <span className="text-xs text-text-muted">{s.date}</span>
              <button type="button" onClick={() => handleLoad(s.data)}
                className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Cargar</button>
              <button type="button" onClick={() => handleDelete(s.id)}
                className="text-xs bg-danger/10 text-danger px-2 py-1 rounded">Eliminar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
