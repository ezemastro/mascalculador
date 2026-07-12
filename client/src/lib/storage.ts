import type { SlabInput, SlabResult, CompatResult, EdgeIndex } from "./slab-calc";

const KEY = "mascalculador_beam_saves";
const LAST_FORM_KEY = "mascalculador_last_form";
const LAST_COLUMN_FORM_KEY = "mascalculador_last_column_form";
const LAST_CARTEL_FORM_KEY = "mascalculador_last_cartel_form";
const LAST_BASES_FORM_KEY = "mascalculador_last_bases_form";

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

export function saveLastFormState(state: LastFormState) {
  try {
    localStorage.setItem(LAST_FORM_KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded, ignore */
  }
}

export function loadLastFormState(): LastFormState | null {
  try {
    const raw = localStorage.getItem(LAST_FORM_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LastFormState;
  } catch {
    return null;
  }
}

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

export function saveLastColumnFormState(state: ColumnFormState) {
  try {
    localStorage.setItem(LAST_COLUMN_FORM_KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded, ignore */
  }
}

export function loadLastColumnFormState(): ColumnFormState | null {
  try {
    const raw = localStorage.getItem(LAST_COLUMN_FORM_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ColumnFormState;
  } catch {
    return null;
  }
}

export interface SavedBeam {
  id: string;
  name: string;
  type: "acero" | "hormigon" | "bases" | "columna" | "cartel" | "losa";
  date: string;
  data: Record<string, unknown>;
}

export function listSaves(): SavedBeam[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedBeam[];
  } catch {
    return [];
  }
}

function writeSaves(saves: SavedBeam[]) {
  localStorage.setItem(KEY, JSON.stringify(saves));
}

/** Crea un nuevo guardado. Lanza error si ya existe uno con el mismo nombre. */
export function saveBeam(
  name: string,
  type: "acero" | "hormigon" | "bases" | "columna" | "cartel" | "losa",
  data: Record<string, unknown>,
): SavedBeam {
  const saves = listSaves();

  // No puede haber dos elementos con el mismo nombre
  const existing = saves.find(
    (s) => s.name.toLowerCase() === name.toLowerCase() && s.type === type,
  );
  if (existing) {
    throw new Error(`Ya existe un elemento guardado con el nombre "${name}".`);
  }

  // Incluir el nombre dentro de los datos
  const dataWithName = { ...data, name };

  const beam: SavedBeam = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    type,
    date: new Date().toLocaleString(),
    data: dataWithName,
  };
  saves.push(beam);
  writeSaves(saves);
  return beam;
}

/** Actualiza un guardado existente por id. Mantiene el mismo id, nombre y fecha original. */
export function updateSave(
  id: string,
  data: Record<string, unknown>,
): SavedBeam | null {
  const saves = listSaves();
  const idx = saves.findIndex((s) => s.id === id);
  if (idx === -1) return null;

  // Incluir el nombre dentro de los datos actualizados
  const dataWithName = { ...data, name: saves[idx].name };

  saves[idx] = {
    ...saves[idx],
    data: dataWithName,
    date: new Date().toLocaleString(), // solo actualizar fecha
  };
  writeSaves(saves);
  return saves[idx];
}

export function deleteSave(id: string) {
  writeSaves(listSaves().filter((s) => s.id !== id));
}

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

export function saveLastBasesFormState(state: BasesFormState) {
  try {
    localStorage.setItem(LAST_BASES_FORM_KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded, ignore */
  }
}

export function loadLastBasesFormState(): BasesFormState | null {
  try {
    const raw = localStorage.getItem(LAST_BASES_FORM_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BasesFormState;
  } catch {
    return null;
  }
}

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

export function saveLastCartelFormState(state: CartelFormState) {
  try {
    localStorage.setItem(LAST_CARTEL_FORM_KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded, ignore */
  }
}

export function loadLastCartelFormState(): CartelFormState | null {
  try {
    const raw = localStorage.getItem(LAST_CARTEL_FORM_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CartelFormState;
  } catch {
    return null;
  }
}

// ---- Slab persistence ----

export interface SavedSlabData {
  input: SlabInput;
  result: SlabResult;
}

export function getSavedBeams(type: "acero" | "hormigon" | "bases" | "columna" | "cartel" | "losa"): SavedBeam[] {
  return listSaves().filter((s) => s.type === type);
}

export function saveSlab(name: string, input: SlabInput, result: SlabResult): SavedBeam {
  const data: SavedSlabData = { input, result };
  return saveBeam(name, "losa", data as unknown as Record<string, unknown>);
}

export function updateSlab(id: string, input: SlabInput, result: SlabResult): SavedBeam | null {
  const data: SavedSlabData = { input, result };
  return updateSave(id, data as unknown as Record<string, unknown>);
}

export function getSavedSlabs(): SavedBeam[] {
  return getSavedBeams("losa");
}

export function loadSlab(id: string): SavedSlabData | null {
  const items = getSavedBeams("losa");
  const item = items.find((b) => b.id === id);
  if (!item) return null;
  return item.data as unknown as SavedSlabData;
}

export function deleteSlab(id: string): void {
  deleteSave(id);
}

// ---- Saved Compatibilizations ----

const COMPAT_KEY = "saved-compats";

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
  const saved: SavedCompatData[] = JSON.parse(localStorage.getItem(COMPAT_KEY) || "[]");
  // Prevent duplicates by name
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
  localStorage.setItem(COMPAT_KEY, JSON.stringify(saved));
}

export function getSavedCompats(): SavedCompatData[] {
  return JSON.parse(localStorage.getItem(COMPAT_KEY) || "[]");
}

export function deleteCompat(name: string): void {
  const saved: SavedCompatData[] = JSON.parse(localStorage.getItem(COMPAT_KEY) || "[]");
  localStorage.setItem(COMPAT_KEY, JSON.stringify(saved.filter((c) => c.name !== name)));
}
