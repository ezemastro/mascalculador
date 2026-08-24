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
import type { App, Load } from "./types";

export type { App };

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
const COMPAT_KEY = "saved-compats";
const SUPPORT_KEY = "saved-supports";
const COMPAT_REINF_KEY = "compat-reinf";

// ---- Tipos genericos ----

export type SaveType =
  | "acero"
  | "hormigon"
  | "bases"
  | "columna"
  | "cartel"
  | "losa"
  | "rc-columna";

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
  removeCompatReinf(name);
}

// ---- Especificas de hormigon (apoyo individual) ----

export interface SavedSupportData {
  name: string;
  savedAt: string;
  slabId: string;
  slabName: string;
  edge: EdgeIndex;
  diam: number;
  sep: number;
}

export function getSavedSupports(): SavedSupportData[] {
  return JSON.parse(localStorage.getItem(key("concrete", SUPPORT_KEY)) || "[]");
}

/** Guarda (o actualiza si ya existe con el mismo nombre) un diseño de apoyo. */
export function saveSupport(data: Omit<SavedSupportData, "savedAt">): void {
  const saved = getSavedSupports();
  const entry: SavedSupportData = {
    ...data,
    savedAt: new Date().toISOString(),
  };
  const existing = saved.find((s) => s.name === data.name);
  if (existing) {
    Object.assign(existing, entry);
  } else {
    saved.push(entry);
  }
  localStorage.setItem(key("concrete", SUPPORT_KEY), JSON.stringify(saved));
}

export function deleteSupport(name: string): void {
  localStorage.setItem(
    key("concrete", SUPPORT_KEY),
    JSON.stringify(getSavedSupports().filter((s) => s.name !== name)),
  );
}

// ---- Especificas de hormigon (armadura elegida por compatibilizacion) ----

export interface CompatReinf {
  compatName: string;
  diam: number;
  sep: number;
}

export function getCompatReinf(compatName: string): CompatReinf | null {
  const saved: CompatReinf[] = JSON.parse(
    localStorage.getItem(key("concrete", COMPAT_REINF_KEY)) || "[]",
  );
  return saved.find((r) => r.compatName === compatName) ?? null;
}

export function saveCompatReinf(
  compatName: string,
  diam: number,
  sep: number,
): void {
  const saved: CompatReinf[] = JSON.parse(
    localStorage.getItem(key("concrete", COMPAT_REINF_KEY)) || "[]",
  );
  const existing = saved.find((r) => r.compatName === compatName);
  if (existing) {
    existing.diam = diam;
    existing.sep = sep;
  } else {
    saved.push({ compatName, diam, sep });
  }
  localStorage.setItem(
    key("concrete", COMPAT_REINF_KEY),
    JSON.stringify(saved),
  );
}

export function removeCompatReinf(compatName: string): void {
  const saved: CompatReinf[] = JSON.parse(
    localStorage.getItem(key("concrete", COMPAT_REINF_KEY)) || "[]",
  );
  localStorage.setItem(
    key("concrete", COMPAT_REINF_KEY),
    JSON.stringify(saved.filter((r) => r.compatName !== compatName)),
  );
}
