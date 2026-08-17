/**
 * portico-defaults — fábrica del pórtico precargado del modo Pórtico.
 *
 * Se usa por `PorticoForm` en dos puntos:
 *   - montaje inicial (cuando no hay auto-save en localStorage);
 *   - botón "Nueva" (limpia y vuelve a la geometría de ejemplo).
 *
 * El ejemplo es la geometría clásica: 3 nudos (apoyos A, cumbrera B y
 * apoyo C), 2 barras (A→B y B→C), 2 apoyos (articulado en A, fijo en C),
 * y 1 carga de ejemplo en la cumbrera B. El spec usa un ángulo inclinado
 * para validar la descomposición a global (fx, fy). El D y L están
 * separados para que el toggle Envolvente/Servicio sea inmediatamente
 * informativo.
 *
 * Importante: cada llamada retorna un objeto NUEVO (clonado superficial)
 * — no compartir referencias entre instancias, ya que PorticoForm muta
 * las IDs cuando se agregan filas nuevas.
 */

import type { PorticoState } from "./portico";

export const DEFAULT_PORTICO_STATE: PorticoState = {
  nodes: [
    { id: "A", x: 0, y: 0 },
    { id: "B", x: 2, y: 3 },
    { id: "C", x: 4, y: 0 },
  ],
  bars: [
    {
      id: "b1",
      fromNodeId: "A",
      toNodeId: "B",
      E: 1,
      A: 1e-2,
      I: 1e-4,
    },
    {
      id: "b2",
      fromNodeId: "B",
      toNodeId: "C",
      E: 1,
      A: 1e-2,
      I: 1e-4,
    },
  ],
  loads: [
    {
      id: "L1",
      barId: "b1",
      kind: "point",
      D: 10,
      L: 5,
      angle: 30,
      a: 0,
    },
  ],
  supports: [
    { id: "SupA", nodeId: "A", kind: "hinge" },
    { id: "SupC", nodeId: "C", kind: "fixed" },
  ],
};

/** Devuelve una copia independiente del estado precargado. */
export function createDefaultPorticoState(): PorticoState {
  return {
    nodes: DEFAULT_PORTICO_STATE.nodes.map((n) => ({ ...n })),
    bars: DEFAULT_PORTICO_STATE.bars.map((b) => ({ ...b })),
    loads: DEFAULT_PORTICO_STATE.loads.map((l) => ({ ...l })),
    supports: DEFAULT_PORTICO_STATE.supports.map((s) => ({ ...s })),
  };
}
