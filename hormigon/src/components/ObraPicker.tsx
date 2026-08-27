// Modal imperativo de elección de obra para guardados nuevos.
//
// `pickObraIfNeeded()` decide si hace falta preguntar (QT-1: varias obras y
// activa "default") y, cuando no hace falta, resuelve al instante con la obra
// activa sin montar el modal (QT-3/QTE-1). Cuando sí hace falta, registra un
// resolver pendiente y devuelve la promesa que el `ObraPickerHost` resuelve
// cuando el usuario elige una obra (id) o cancela (null).
//
// El host se monta una sola vez en el Layout y solo renderiza (vía portal al
// body) mientras hay una elección pendiente. No hay cierre por backdrop, ni
// tecla Escape, ni botón ✕: solo elegir una obra o "Cancelar" (QU-2).
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { getCurrentObraId, getObras, shouldAskObraOnSave } from "../lib/storage";

type Resolver = (obraId: string | null) => void;

let pendingResolver: Resolver | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return pendingResolver !== null;
}

/**
 * Devuelve la obra destino de un guardado nuevo: la obra activa cuando no
 * hace falta preguntar, o la que elija el usuario en el modal. `null` = el
 * usuario canceló → el caller NO guarda (QU-3). "Sin obra" explícita llega
 * como id "default" (≠ null, TW-1).
 */
export function pickObraIfNeeded(): Promise<string | null> {
  if (!shouldAskObraOnSave()) {
    return Promise.resolve(getCurrentObraId());
  }
  return new Promise<string | null>((resolve) => {
    pendingResolver = resolve;
    emit();
  });
}

function resolvePick(obraId: string | null) {
  const resolver = pendingResolver;
  if (!resolver) return;
  pendingResolver = null;
  emit();
  resolver(obraId);
}

/** Host del modal de elección de obra (montado una vez en el Layout). */
export function ObraPickerHost() {
  const pending = useSyncExternalStore(subscribe, getSnapshot);
  if (!pending) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Elegir obra"
        className="w-full max-w-md rounded-xl border border-border bg-surface p-5"
      >
        <h2 className="text-base font-semibold text-text">
          ¿A qué obra corresponde este elemento?
        </h2>
        <div className="mt-4 flex flex-col gap-2">
          {getObras().map((obra) => (
            <button
              key={obra.id}
              type="button"
              onClick={() => resolvePick(obra.id)}
              className="w-full bg-surface-alt border border-border text-text hover:bg-surface rounded-lg px-4 py-2 text-sm"
            >
              {obra.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => resolvePick(null)}
            className="self-center mt-2 bg-surface-alt border-border text-text-muted text-sm hover:bg-surface rounded-lg px-4 py-2"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}