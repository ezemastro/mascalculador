/**
 * Storage compartido entre apps/steel y apps/concrete.
 *
 * Estrategia de prefijos: todas las keys de localStorage usan el helper `key()`
 * que devuelve `${app}:${name}`. Asi steel y concrete no colisionan.
 *
 * - Funciones GENERICAS (sobre SavedBeam) reciben `app: App` como primer parametro.
 * - Funciones ESPECIFICAS de acero (viga, columna, cartel) hardcodean `app = "steel"`.
 * - Funciones ESPECIFICAS de hormigon (losas, compat, bases, RC column) hardcodean
 *   `app = "concrete"`. Aunque viven en shared (por reuso con acero), son de uso
 *   exclusivo de apps/concrete.
 */

import type {
  EdgeIndex,
  SlabInput,
  SlabResult,
  CompatResult,
} from "./slab-types";
import type { App, Load, SupportType } from "./types";

export type { App, SupportType };

export function key(app: App, name: string): string {
  return `${app}:${name}`;
}

// ---- Constantes (nombres base, sin prefijo — `key()` los prefijia) ----

const SAVES_KEY = "beam_saves";
const LAST_FORM_KEY = "last_form";
const LAST_COLUMN_FORM_KEY = "last_column_form";
const LAST_CARTEL_FORM_KEY = "last_cartel_form";
const LAST_BASES_FORM_KEY = "last_bases_form";
const LAST_RC_COLUMN_FORM_KEY = "last_rc_column_form";
const LAST_SLAB_FORM_KEY = "last_slab_form";
const LAST_VIGA_CONTINUA_FORM_KEY = "last_viga_continua_form";
const COMPAT_KEY = "saved-compats";

// ---- Tipos genericos ----

export type SaveType =
  | "acero"
  | "hormigon"
  | "bases"
  | "columna"
  | "cartel"
  | "losa"
  | "rc-columna"
  | "portico"
  | "viga-continua";

export interface SavedBeam {
  id: string;
  name: string;
  type: SaveType;
  date: string;
  data: Record<string, unknown>;
}

// ---- Funciones genericas (reciben `app`) ----

export function listSaves(app: App): SavedBeam[] {
  try {
    const raw = localStorage.getItem(key(app, SAVES_KEY));
    if (!raw) return [];
    return JSON.parse(raw) as SavedBeam[];
  } catch {
    return [];
  }
}

function writeSaves(app: App, saves: SavedBeam[]): void {
  localStorage.setItem(key(app, SAVES_KEY), JSON.stringify(saves));
}

/** Crea un nuevo guardado. Lanza error si ya existe uno con el mismo nombre. */
export function saveBeam(
  app: App,
  name: string,
  type: SaveType,
  data: Record<string, unknown>,
): SavedBeam {
  const saves = listSaves(app);

  const existing = saves.find(
    (s) => s.name.toLowerCase() === name.toLowerCase() && s.type === type,
  );
  if (existing) {
    throw new Error(`Ya existe un elemento guardado con el nombre "${name}".`);
  }

  const dataWithName = { ...data, name };

  const beam: SavedBeam = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    type,
    date: new Date().toLocaleString(),
    data: dataWithName,
  };
  saves.push(beam);
  writeSaves(app, saves);
  return beam;
}

/** Actualiza un guardado existente por id. Mantiene el mismo id, nombre y fecha original. */
export function updateSave(
  app: App,
  id: string,
  data: Record<string, unknown>,
): SavedBeam | null {
  const saves = listSaves(app);
  const idx = saves.findIndex((s) => s.id === id);
  if (idx === -1) return null;

  const dataWithName = { ...data, name: saves[idx].name };

  saves[idx] = {
    ...saves[idx],
    data: dataWithName,
    date: new Date().toLocaleString(),
  };
  writeSaves(app, saves);
  return saves[idx];
}

export function deleteSave(app: App, id: string): void {
  writeSaves(
    app,
    listSaves(app).filter((s) => s.id !== id),
  );
}

export function getSavedBeams(app: App, type: SaveType): SavedBeam[] {
  return listSaves(app).filter((s) => s.type === type);
}

// ---- Especificas de acero (viga) ----

export interface LastFormState {
  spanCount: number;
  spanLengths: number[];
  supportTypes: string[];
  loads: Load[];
  profileName: string;
  profileType?: string;
  Fy: number;
  Lb: number;
  Lb1: number;
  Lb2: number;
  Cb: number;
  deflectionLimit: number;
  loadPosition: string;
}

export function saveLastFormState(state: LastFormState): void {
  try {
    localStorage.setItem(key("steel", LAST_FORM_KEY), JSON.stringify(state));
  } catch {
    /* quota exceeded, ignore */
  }
}

export function loadLastFormState(): LastFormState | null {
  try {
    const raw = localStorage.getItem(key("steel", LAST_FORM_KEY));
    if (!raw) return null;
    return JSON.parse(raw) as LastFormState;
  } catch {
    return null;
  }
}

// ---- Especificas de acero (columna) ----

export interface ColumnFormState {
  profileType: string;
  profileName: string;
  upnName: string;
  upnGap: number;
  tubeName?: string;
  armadaBf?: number;
  armadaTf?: number;
  armadaHw?: number;
  armadaTw?: number;
  cajonH?: number;
  cajonB?: number;
  cajonT?: number;
  Pu: number;
  Mux: number;
  Muy: number;
  L: number;
  Kx: number;
  Ky: number;
  Fy: number;
}

export function saveLastColumnFormState(state: ColumnFormState): void {
  try {
    localStorage.setItem(
      key("steel", LAST_COLUMN_FORM_KEY),
      JSON.stringify(state),
    );
  } catch {
    /* quota exceeded, ignore */
  }
}

export function loadLastColumnFormState(): ColumnFormState | null {
  try {
    const raw = localStorage.getItem(key("steel", LAST_COLUMN_FORM_KEY));
    if (!raw) return null;
    return JSON.parse(raw) as ColumnFormState;
  } catch {
    return null;
  }
}

// ---- Especificas de acero (cartel) ----

export interface CartelFormState {
  anchoCartel: number;
  altoCartel: number;
  despegue: number;
  sepColumnas: number;
  sepCorreas: number;
  tipoColumna: number;
  tienePuntal: boolean;
  hPuntal: number;
  dPuntal: number;
  velocidadViento: number;
  categoria: string;
  exposicion: string;
  hCol: number;
  aCol: number;
  perfilCordon: string;
  perfilDiagonal: string;
  perfilMontante: string;
  Fy: number;
  perfilIPN?: string;
  separacionCol?: number;
  KGlobal?: number;
  cantColumnas?: number;
  vueloLateral?: number;
  tipoPuntal?: number;
}

export function saveLastCartelFormState(state: CartelFormState): void {
  try {
    localStorage.setItem(
      key("steel", LAST_CARTEL_FORM_KEY),
      JSON.stringify(state),
    );
  } catch {
    /* quota exceeded, ignore */
  }
}

export function loadLastCartelFormState(): CartelFormState | null {
  try {
    const raw = localStorage.getItem(key("steel", LAST_CARTEL_FORM_KEY));
    if (!raw) return null;
    return JSON.parse(raw) as CartelFormState;
  } catch {
    return null;
  }
}

// ---- Especificas de hormigon (bases) ----

export interface BasesFormState {
  qa: number;
  Df: number;
  PD: number;
  PL: number;
  cx: number;
  cy: number;
  fc: number;
  fy: number;
  type: "centrada" | "medianera";
  subType?: "viga-de-fundacion" | "tensor";
  B?: number;
  L?: number;
  h?: number;
  Lcol?: number;
  H?: number;
  mu?: number;
  cover?: number;
  rebD?: number;
  columnId?: string;
  columnName?: string;
}

export function saveLastBasesFormState(state: BasesFormState): void {
  try {
    localStorage.setItem(
      key("concrete", LAST_BASES_FORM_KEY),
      JSON.stringify(state),
    );
  } catch {
    /* quota exceeded, ignore */
  }
}

export function loadLastBasesFormState(): BasesFormState | null {
  try {
    const raw = localStorage.getItem(key("concrete", LAST_BASES_FORM_KEY));
    if (!raw) return null;
    return JSON.parse(raw) as BasesFormState;
  } catch {
    return null;
  }
}

// ---- Especificas de hormigon (RC column) ----

export interface RCColumnFormState {
  fc: number;
  fy: number;
  PD: number;
  PL: number;
  lu: number;
  MxSup: number;
  MxInf: number;
  MySup: number;
  MyInf: number;
  Cx?: number;
  Cy?: number;
  betaD?: number;
  PD_direct?: number;
  PL_direct?: number;
  includeSelfWeight?: boolean;
  contributedColumns?: { id: string; name: string; PD: number; PL: number }[];
  contributedBeams?: {
    id: string;
    name: string;
    supportIdx: number;
    rD: number;
    rL: number;
  }[];
  nEsquinas?: number;
  nCarasX?: number;
  nCarasY?: number;
  dbEsquinas?: number;
  dbCarasX?: number;
  dbCarasY?: number;
}

export function saveLastRCColumnFormState(state: RCColumnFormState): void {
  try {
    localStorage.setItem(
      key("concrete", LAST_RC_COLUMN_FORM_KEY),
      JSON.stringify(state),
    );
  } catch {
    /* quota exceeded, ignore */
  }
}

export function loadLastRCColumnFormState(): RCColumnFormState | null {
  try {
    const raw = localStorage.getItem(key("concrete", LAST_RC_COLUMN_FORM_KEY));
    if (!raw) return null;
    return JSON.parse(raw) as RCColumnFormState;
  } catch {
    return null;
  }
}

// ---- Especificas de hormigon (slab) ----

export interface SlabLastFormState {
  lx: number;
  ly: number;
  edgeX0: string;
  edgeXL: string;
  edgeY0: string;
  edgeYL: string;
  D: number;
  L: number;
  fc: number;
  fy: number;
  cover: number;
  /**
   * @deprecated Use `hAdop` (cm) instead. Kept only so legacy localStorage
   * entries written by previous versions can still be read. New auto-saves
   * MUST NOT write this field.
   */
  h?: number;
  /**
   * Adopted slab height in cm. `0` (or undefined) means "fall back to the
   * live-predimensioned h computed from the edges and spans".
   */
  hAdop?: number;
  dBarX: number;
  dBarY: number;
  includeSelfWeight?: boolean;
}

export function saveLastSlabFormState(state: SlabLastFormState): void {
  try {
    localStorage.setItem(
      key("concrete", LAST_SLAB_FORM_KEY),
      JSON.stringify(state),
    );
  } catch {
    /* quota exceeded, ignore */
  }
}

export function loadLastSlabFormState(): SlabLastFormState | null {
  try {
    const raw = localStorage.getItem(key("concrete", LAST_SLAB_FORM_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SlabLastFormState;
    // Migration: legacy `h` was stored in mm; the new field `hAdop` is in cm.
    // Only migrate when the new field is missing so we never clobber a newer save.
    if (parsed.hAdop === undefined && typeof parsed.h === "number") {
      parsed.hAdop = parsed.h / 10;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ---- Especificas de hormigon (slab saved) ----

export interface SavedSlabData {
  input: SlabInput;
  result: SlabResult;
}

export function getSavedSlabs(): SavedBeam[] {
  return getSavedBeams("concrete", "losa");
}

export function saveSlab(
  name: string,
  input: SlabInput,
  result: SlabResult,
): SavedBeam {
  const data: SavedSlabData = { input, result };
  return saveBeam(
    "concrete",
    name,
    "losa",
    data as unknown as Record<string, unknown>,
  );
}

export function updateSlab(
  id: string,
  input: SlabInput,
  result: SlabResult,
): SavedBeam | null {
  const data: SavedSlabData = { input, result };
  return updateSave("concrete", id, data as unknown as Record<string, unknown>);
}

export function saveSlabInput(name: string, input: SlabInput): SavedBeam {
  const data = { input };
  return saveBeam(
    "concrete",
    name,
    "losa",
    data as unknown as Record<string, unknown>,
  );
}

export function updateSlabInput(
  id: string,
  input: SlabInput,
): SavedBeam | null {
  const data = { input };
  return updateSave("concrete", id, data as unknown as Record<string, unknown>);
}

export function loadSlab(id: string): SavedSlabData | null {
  const items = getSavedBeams("concrete", "losa");
  const item = items.find((b) => b.id === id);
  if (!item) return null;
  return item.data as unknown as SavedSlabData;
}

export function deleteSlab(id: string): void {
  deleteSave("concrete", id);
}

// ---- Especificas de hormigon (portico) ----
//
// Persistence shell for the new pórtico mode of viga-continua. The canonical,
// richer domain types live in viga-continua/src/lib/portico.ts (R-portico-types).
// shared/ does NOT import from src/ (reverse-dep banned by tasks.md §1.1), so
// the shapes are re-declared here as minimal structural types. They are kept
// structurally identical to the domain types so app-side saves round-trip.

/**
 * Structural minimum of `PorticoState` (viga-continua/src/lib/portico.ts).
 * Used only as the persistence-shape argument for the portico helpers below.
 * Read-only accessors make this interface accept the mutable domain shape.
 *
 * Note: `loads[].a`/`b` use the new `(id, barId, kind, D, L, angle, a, b?)`
 * shape introduced in PR2; PR1 used `(barId, intensity, angleDeg, distanceFromOrigin)`
 * — auto-saved JSON from a PR1 session is structurally incompatible and
 * `loadLastPorticoFormState` returns null on parse failure, so the form
 * safely resets to defaults.
 */
export interface PorticoState {
  readonly nodes: ReadonlyArray<{
    readonly id: string;
    readonly x: number;
    readonly y: number;
  }>;
  readonly bars: ReadonlyArray<{
    readonly id: string;
    readonly fromNodeId: string;
    readonly toNodeId: string;
    readonly E: number;
    readonly A: number;
    readonly I: number;
  }>;
  readonly loads: ReadonlyArray<{
    readonly id: string;
    readonly barId: string;
    readonly kind: "point" | "distributed";
    readonly D: number;
    readonly L: number;
    readonly angle: number;
    readonly a: number;
    readonly b?: number;
  }>;
  readonly supports: ReadonlyArray<{
    readonly id: string;
    readonly nodeId: string;
    readonly kind: "hinge" | "fixed";
  }>;
}

/**
 * Named save for a pórtico state. Mirrors `SavedSlabData`'s structure but
 * reduced to `input` (no result snapshot until PR2 ships the solver).
 */
export interface PorticoSavedData {
  name: string;
  input: PorticoState;
}

/** localStorage key suffix for auto-saved portico form state. */
const PORTICO_LAST_FORM_STATE_KEY = "porticoLastFormState";

/** Save a named pórtico input under `type = "portico"`. */
export function savePorticoInput(data: PorticoSavedData): SavedBeam {
  const payload: Record<string, unknown> = {
    name: data.name,
    input: data.input,
  };
  return saveBeam("concrete", data.name, "portico", payload);
}

/** Auto-save the in-progress portico form state. Silently ignores quota errors. */
export function saveLastPorticoFormState(state: PorticoState): void {
  try {
    localStorage.setItem(
      key("concrete", PORTICO_LAST_FORM_STATE_KEY),
      JSON.stringify(state),
    );
  } catch {
    /* quota exceeded, ignore */
  }
}

/** Load the auto-saved portico form state; null if absent or unparseable. */
export function loadLastPorticoFormState(): PorticoState | null {
  try {
    const raw = localStorage.getItem(
      key("concrete", PORTICO_LAST_FORM_STATE_KEY),
    );
    if (!raw) return null;
    return JSON.parse(raw) as PorticoState;
  } catch {
    return null;
  }
}

// ---- Especificas de hormigon (viga continua) ----
//
// Persistence shell for viga-continua analysis. The canonical, richer domain
// types live in viga-continua/src/lib/viga-continua.ts (R-vc-state-payload).
// shared/ does NOT import from src/ (reverse-dep banned by tasks.md §1.1), so
// the shape is re-declared here as a minimal structural type. The optional
// `loadedSaveId` / `loadedSaveName` travel with the state so the form and
// results screens can re-find the same id without re-prompting the user.

/**
 * Structural minimum of `VigaContinuaState` (viga-continua/src/lib/viga-continua.ts).
 * The `loads` array carries position only (no React-key `id`) because ids are
 * regenerated on each mount — see `VigaContinuaForm.handleLoad` and
 * `handleSave` for round-trip details.
 */
export interface VigaContinuaInput {
  spans: number[];
  supportTypes: SupportType[];
  loads: Array<{
    type: "point" | "distributed";
    D: number;
    L: number;
    position?: number;
    start?: number;
    end?: number;
  }>;
  /**
   * Set together with `loadedSaveName`. Both fields are set by
   * `<SavedBeams>.onLoad` and the first-save path; absent on a cold open.
   * Setting one without the other is the BasesForm bug — forbidden here.
   */
  loadedSaveId?: string;
  /** See `loadedSaveId`. */
  loadedSaveName?: string;
}

/** Persisted shape for a viga-continua entry. Form saves input-only; results
 *  also include the envelope. The envelope field is opaque (`unknown`) so
 *  shared/ does not need to import `BeamEnvelopeResult` from `src/`. */
export interface VigaContinuaSavedData {
  input: VigaContinuaInput;
  envelope?: unknown;
}

/** Save a named viga-continua entry under `type = "viga-continua"`. Throws on
 *  duplicate `(name, "viga-continua")`. */
export function saveVigaContinuaInput(
  name: string,
  data: VigaContinuaSavedData,
): SavedBeam {
  return saveBeam(
    "concrete",
    name,
    "viga-continua",
    data as unknown as Record<string, unknown>,
  );
}

/** Update an existing viga-continua entry by id. Silent overwrite. */
export function updateVigaContinuaInput(
  id: string,
  data: VigaContinuaSavedData,
): SavedBeam | null {
  return updateSave("concrete", id, data as unknown as Record<string, unknown>);
}

/** All saved vigas-continuas (filtered by SaveType). */
export function getSavedVigasContinuas(): SavedBeam[] {
  return getSavedBeams("concrete", "viga-continua");
}

/** Load a viga-continua entry by id. Returns the persisted shape or null. */
export function loadVigaContinuaInput(
  id: string,
): VigaContinuaSavedData | null {
  const items = getSavedBeams("concrete", "viga-continua");
  const item = items.find((b) => b.id === id);
  if (!item) return null;
  return item.data as unknown as VigaContinuaSavedData;
}

/** Delete a viga-continua entry by id. */
export function deleteVigaContinuaInput(id: string): void {
  deleteSave("concrete", id);
}

/** Auto-save the in-progress form state. Silently ignores quota errors. */
export function saveLastVigaContinuaFormState(state: VigaContinuaInput): void {
  try {
    localStorage.setItem(
      key("concrete", LAST_VIGA_CONTINUA_FORM_KEY),
      JSON.stringify(state),
    );
  } catch {
    /* quota exceeded, ignore */
  }
}

/** Load the auto-saved form state. Returns the parsed state or null. */
export function loadLastVigaContinuaFormState(): VigaContinuaInput | null {
  try {
    const raw = localStorage.getItem(
      key("concrete", LAST_VIGA_CONTINUA_FORM_KEY),
    );
    if (!raw) return null;
    return JSON.parse(raw) as VigaContinuaInput;
  } catch {
    return null;
  }
}

// ---- Especificas de hormigon (compatibilizacion) ----

export interface SavedCompatData {
  name: string;
  savedAt: string;
  slabA: { id: string; name: string };
  slabB: { id: string; name: string };
  edgeA: EdgeIndex;
  edgeB: EdgeIndex;
  result: CompatResult;
}

export function saveCompat(
  name: string,
  slabA: { id: string; name: string },
  slabB: { id: string; name: string },
  edgeA: EdgeIndex,
  edgeB: EdgeIndex,
  result: CompatResult,
): void {
  const saved: SavedCompatData[] = JSON.parse(
    localStorage.getItem(key("concrete", COMPAT_KEY)) || "[]",
  );
  if (saved.some((c) => c.name === name)) {
    throw new Error(`Ya existe una compatibilización con nombre "${name}".`);
  }
  saved.push({
    name,
    savedAt: new Date().toISOString(),
    slabA,
    slabB,
    edgeA,
    edgeB,
    result,
  });
  localStorage.setItem(key("concrete", COMPAT_KEY), JSON.stringify(saved));
}

export function getSavedCompats(): SavedCompatData[] {
  return JSON.parse(localStorage.getItem(key("concrete", COMPAT_KEY)) || "[]");
}

export function deleteCompat(name: string): void {
  const saved: SavedCompatData[] = JSON.parse(
    localStorage.getItem(key("concrete", COMPAT_KEY)) || "[]",
  );
  localStorage.setItem(
    key("concrete", COMPAT_KEY),
    JSON.stringify(saved.filter((c) => c.name !== name)),
  );
}
