import type { EnvelopeLoad } from "./beam-envelope";
import type { SupportType } from "@mascalculador/shared";

/**
 * Carga de análisis de viga continua: extiende `EnvelopeLoad` (la forma exacta
 * que consume `calculateBeamEnvelope`) agregando un `id` para las keys de React.
 * Así se elimina la capa de mapeo RC (`ConcreteLoad → EnvelopeLoad`) que existe
 * en `ConcreteResults` para este flujo de análisis puro.
 */
export interface AnalysisLoad extends EnvelopeLoad {
  id: string;
}

/**
 * Estado del análisis de viga continua (análisis estructural, sin diseño de
 * hormigón armado). Se pasa del formulario a los resultados vía `location.state`.
 */
export interface VigaContinuaState {
  /** Luces de cada tramo, en metros (1..5 entradas, todas > 0). */
  spans: number[];
  /** Tipos de apoyo; longitud = spans.length + 1. */
  supportTypes: SupportType[];
  /** Cargas D/L (puntuales y distribuidas); al menos una con D + L > 0. */
  loads: AnalysisLoad[];
  /**
   * Set together with `loadedSaveName`. Both fields are set by
   * `<SavedBeams>.onLoad`, the first-save success path, and the
   * `useEffect`-driven restore from `loadLastVigaContinuaFormState` when
   * they are present. Absent (or `undefined`) on a cold open.
   *
   * Setting one without the other is the BasesForm regression — forbidden
   * here. See `design.md §11` (Anti-Regression: the `BasesForm` Bug).
   */
  loadedSaveId?: string;
  /** See `loadedSaveId`. */
  loadedSaveName?: string;
}
