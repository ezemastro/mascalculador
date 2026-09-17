// Modal imperativo de elección de obra para guardados nuevos.
//
// `pickObraIfNeeded()` decide si hace falta preguntar (cuando la obra activa
// es "default"/Sin obra, que NO es un destino válido: es el bucket legacy) y,
// cuando no hace falta, resuelve al instante con la obra activa sin montar el
// modal. Cuando sí hace falta, registra un resolver pendiente y devuelve la
// promesa que el `ObraPickerHost` resuelve cuando el usuario elige una obra
// real, crea una obra nueva, o cancela (null).
//
// El host se monta una sola vez en el Layout y solo renderiza (vía portal al
// body) mientras hay una elección pendiente. No hay cierre por backdrop, ni
// tecla Escape, ni botón ✕: solo elegir una obra, crear una, o "Cancelar".
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  createObra,
  getCurrentObraId,
  getObras,
  shouldAskObraOnSave,
} from "../lib/storage";

type Resolver = (obraId: string | null) => void;

let pendingResolver: Resolver | null = null;
let onObraCreatedCb: ((id: string) => void) | undefined;
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
 * usuario canceló → el caller NO guarda. Nunca devuelve "default": "Sin obra"
 * no es un destino válido.
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

/**
 * Flujo "Nueva obra...": pide el nombre, crea la obra (queda activa
 * internamente vía createObra) y la notifica al Layout para refrescar el
 * selector del header; luego resuelve con el nuevo id para que el elemento se
 * guarde en ella. Si el nombre es nulo/vacío o ya existe, NO cierra el picker:
 * el usuario puede seguir eligiendo una obra existente o Cancelar.
 */
function handleNewObra() {
  const name = window.prompt("Nombre de la obra nueva");
  if (name === null || name.trim() === "") return;
  try {
    const obra = createObra(name);
    onObraCreatedCb?.(obra.id);
    resolvePick(obra.id);
  } catch (err) {
    alert(err instanceof Error ? err.message : String(err));
  }
}

/** Host del modal de elección de obra (montado una vez en el Layout). */
export function ObraPickerHost({
  onObraCreated,
}: {
  onObraCreated?: (id: string) => void;
} = {}) {
  // Captura el callback más reciente en cada render (incluso cuando el modal
  // no está pendiente y devolvemos null) para que handleNewObra lo tenga.
  onObraCreatedCb = onObraCreated;
  const pending = useSyncExternalStore(subscribe, getSnapshot);
  if (!pending) return null;

  // "Sin obra" (id "default") NUNCA es destino: se filtra de la lista.
  const realObras = getObras().filter((o) => o.id !== "default");

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
          {realObras.map((obra) => (
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
            onClick={handleNewObra}
            className="w-full bg-surface-alt border border-border text-text hover:bg-surface rounded-lg px-4 py-2 text-sm font-medium"
          >
            Nueva obra...
          </button>
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
