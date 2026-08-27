// Wrapper sobre @mascalculador/shared que hardcodea app="concrete".
//
// Los elementos guardados (vigas, losas, compatibilizaciones, apoyos y
// armaduras) viven en keys por obra: `concrete:obra:<id>:<base>`. La obra
// activa es estado de módulo y se persiste en `concrete:current_obra`; el
// directorio de obras vive en `concrete:obras`. Los borradores de formularios
// (`last_*_form`) quedan globales (OW-2): cambiar de obra no pierde lo
// escrito. Las keys legacy se migran una sola vez a la obra "default"
// (OC-4) y se conservan.
import * as shared from "@mascalculador/shared";
import { installCloudStorage } from "./cloud-storage.ts";

export type {
  App,
  SaveType,
  SavedBeam,
  LastFormState,
  ColumnFormState,
  CartelFormState,
  BasesFormState,
  RCColumnFormState,
  SlabLastFormState,
  SavedSlabData,
  SavedCompatData,
  SavedSupportData,
  CompatReinf,
  EdgeIndex,
  SlabInput,
  SlabResult,
  CompatResult,
  DirectionResult,
  EdgeCondition,
} from "@mascalculador/shared";

// ---- Re-exports globales (borradores de formularios, OW-2) ----

export const key = shared.key;
export const saveLastFormState = shared.saveLastFormState;
export const loadLastFormState = shared.loadLastFormState;
export const saveLastColumnFormState = shared.saveLastColumnFormState;
export const loadLastColumnFormState = shared.loadLastColumnFormState;
export const saveLastCartelFormState = shared.saveLastCartelFormState;
export const loadLastCartelFormState = shared.loadLastCartelFormState;
export const saveLastBasesFormState = shared.saveLastBasesFormState;
export const loadLastBasesFormState = shared.loadLastBasesFormState;
export const saveLastRCColumnFormState = shared.saveLastRCColumnFormState;
export const loadLastRCColumnFormState = shared.loadLastRCColumnFormState;
export const saveLastSlabFormState = shared.saveLastSlabFormState;
export const loadLastSlabFormState = shared.loadLastSlabFormState;

// ---- Obras ----

const OBRA_DIR_KEY = "concrete:obras";
const CURRENT_OBRA_KEY = "concrete:current_obra";
const MIGRATED_FLAG = "concrete:obra_migrated";
const ELEMENT_BASES = [
  "beam_saves",
  "saved-compats",
  "saved-supports",
  "compat-reinf",
];

export interface SavedObra {
  id: string;
  name: string;
  createdAt: string;
}

let currentObraId = "default";

export function getCurrentObraId(): string {
  return currentObraId;
}

export function setCurrentObraId(id: string): void {
  currentObraId = id;
  localStorage.setItem(CURRENT_OBRA_KEY, id);
}

/** Key del elemento `base` en la obra activa. */
export function obraKey(base: string): string {
  return `concrete:obra:${currentObraId}:${base}`;
}

/** Key del elemento `base` en una obra puntual (usada por deleteObra). */
export function obraKeyFor(id: string, base: string): string {
  return `concrete:obra:${id}:${base}`;
}

function readObras(): SavedObra[] {
  try {
    const raw = localStorage.getItem(OBRA_DIR_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedObra[];
  } catch {
    return [];
  }
}

function writeObras(obras: SavedObra[]): void {
  localStorage.setItem(OBRA_DIR_KEY, JSON.stringify(obras));
}

export function getObras(): SavedObra[] {
  return readObras();
}

export function createObra(name: string): SavedObra {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("El nombre de la obra no puede estar vacío.");
  }
  const obras = readObras();
  if (obras.some((o) => o.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error(`Ya existe una obra con el nombre "${trimmed}".`);
  }
  const obra: SavedObra = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
  obras.push(obra);
  writeObras(obras);
  setCurrentObraId(obra.id);
  return obra;
}

export function renameObra(id: string, name: string): SavedObra | null {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("El nombre de la obra no puede estar vacío.");
  }
  const obras = readObras();
  if (
    obras.some(
      (o) => o.id !== id && o.name.toLowerCase() === trimmed.toLowerCase(),
    )
  ) {
    throw new Error(`Ya existe una obra con el nombre "${trimmed}".`);
  }
  const target = obras.find((o) => o.id === id);
  if (!target) return null;
  target.name = trimmed;
  writeObras(obras);
  return target;
}

/**
 * Elimina una obra: purga sus 4 keys de elementos y su entrada del directorio.
 * Lanza si es la única obra. Si la obra eliminada era la activa, devuelve el
 * id de otra obra restante (el caller lo propaga al UI, que lo activa).
 */
export function deleteObra(id: string): string | null {
  const obras = readObras();
  if (obras.length <= 1) {
    throw new Error("No se puede eliminar la única obra.");
  }
  for (const base of ELEMENT_BASES) {
    localStorage.removeItem(obraKeyFor(id, base));
  }
  const rest = obras.filter((o) => o.id !== id);
  writeObras(rest);
  if (id === currentObraId) {
    return rest[0].id;
  }
  return null;
}

export function getActiveObraName(): string {
  return readObras().find((o) => o.id === currentObraId)?.name ?? "Sin obra";
}

/**
 * ¿Hay que preguntar a qué obra corresponde un guardado nuevo? Sí cuando la
 * obra activa es "default" (Sin obra). "Sin obra" es el bucket legacy de
 * migración, NO un destino válido: por eso se pregunta siempre que esté
 * activa, sin importar cuántas obras existan. El disparador es por id (no por
 * nombre): renombrar "Sin obra" no silencia la pregunta.
 */
export function shouldAskObraOnSave(): boolean {
  return getCurrentObraId() === "default";
}

// ---- Migración (OC-4) ----

/**
 * Migra las keys legacy de elementos a la obra "default". Idempotente por
 * pasos (StrictMode-safe) y offline-safe: corre sobre localStorage nativo si
 * el server no responde. Las keys legacy se conservan (su borrado queda para
 * una versión futura).
 */
export function migrateLegacyObras(): void {
  if (localStorage.getItem(MIGRATED_FLAG) === "1") return;

  const obras = readObras();
  if (!obras.some((o) => o.id === "default")) {
    obras.push({
      id: "default",
      name: "Sin obra",
      createdAt: new Date().toISOString(),
    });
    writeObras(obras);
  }

  for (const base of ELEMENT_BASES) {
    const legacy = localStorage.getItem(`concrete:${base}`);
    if (
      legacy !== null &&
      localStorage.getItem(obraKeyFor("default", base)) === null
    ) {
      localStorage.setItem(obraKeyFor("default", base), legacy);
    }
  }

  if (localStorage.getItem(CURRENT_OBRA_KEY) === null) {
    localStorage.setItem(CURRENT_OBRA_KEY, "default");
  }

  localStorage.setItem(MIGRATED_FLAG, "1");
}

/** Instala el shim de nube y migra los datos legacy antes del primer render. */
export async function bootstrapStorage(): Promise<{
  cloud: boolean;
  reason?: string;
}> {
  const result = await installCloudStorage();
  migrateLegacyObras();
  // Sincroniza el estado del módulo con la obra activa persistida (OS-1).
  currentObraId = localStorage.getItem(CURRENT_OBRA_KEY) ?? "default";
  return result;
}

// ---- Vigas (por obra) ----

function getElementSaves(obraId: string = getCurrentObraId()): shared.SavedBeam[] {
  try {
    const raw = localStorage.getItem(obraKeyFor(obraId, "beam_saves"));
    if (!raw) return [];
    return JSON.parse(raw) as shared.SavedBeam[];
  } catch {
    return [];
  }
}

function writeElementSaves(saves: shared.SavedBeam[], obraId?: string): void {
  localStorage.setItem(
    obraKeyFor(obraId ?? getCurrentObraId(), "beam_saves"),
    JSON.stringify(saves),
  );
}

export function listSaves(): shared.SavedBeam[] {
  return getElementSaves();
}

/**
 * Crea un nuevo guardado. Por defecto en la obra activa; con `obraId`
 * (elegida por el usuario) en esa obra puntual. Las lecturas y la
 * unicidad nombre+tipo corren contra la obra de destino. Lanza si ya
 * existe uno con el mismo nombre en esa obra.
 */
export function saveBeam(
  name: string,
  type: shared.SaveType,
  data: Record<string, unknown>,
  obraId?: string,
): shared.SavedBeam {
  const saves = getElementSaves(obraId);

  const existing = saves.find(
    (s) => s.name.toLowerCase() === name.toLowerCase() && s.type === type,
  );
  if (existing) {
    throw new Error(`Ya existe un elemento guardado con el nombre "${name}".`);
  }

  const dataWithName = { ...data, name };

  const beam: shared.SavedBeam = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    type,
    date: new Date().toLocaleString(),
    data: dataWithName,
  };
  saves.push(beam);
  writeElementSaves(saves, obraId);
  return beam;
}

/**
 * Actualiza un guardado existente por id en la obra que lo contiene, sin
 * importar cuál es la obra activa. Mantiene el mismo id, nombre y fecha
 * original. Devuelve null (y no escribe nada) si el id no está en ninguna
 * obra — nunca crea un elemento en silencio.
 */
export function updateSave(
  id: string,
  data: Record<string, unknown>,
): shared.SavedBeam | null {
  // La obra activa primero (caso más común), después el resto del directorio.
  const obraIds = Array.from(
    new Set([currentObraId, ...readObras().map((o) => o.id)]),
  );
  for (const obraId of obraIds) {
    const saves = getElementSaves(obraId);
    const idx = saves.findIndex((s) => s.id === id);
    if (idx === -1) continue;

    const dataWithName = { ...data, name: saves[idx].name };

    saves[idx] = {
      ...saves[idx],
      data: dataWithName,
      date: new Date().toLocaleString(),
    };
    writeElementSaves(saves, obraId);
    return saves[idx];
  }
  return null;
}

export function deleteSave(id: string): void {
  writeElementSaves(
    getElementSaves().filter((s) => s.id !== id),
  );
}

export function getSavedBeams(type: shared.SaveType): shared.SavedBeam[] {
  return getElementSaves().filter((s) => s.type === type);
}

// ---- Losas (por obra) ----

export function getSavedSlabs(): shared.SavedBeam[] {
  return getSavedBeams("losa");
}

export function saveSlab(
  name: string,
  input: shared.SlabInput,
  result: shared.SlabResult,
  obraId?: string,
): shared.SavedBeam {
  const data: shared.SavedSlabData = { input, result };
  return saveBeam(
    name,
    "losa",
    data as unknown as Record<string, unknown>,
    obraId,
  );
}

export function updateSlab(
  id: string,
  input: shared.SlabInput,
  result: shared.SlabResult,
): shared.SavedBeam | null {
  const data: shared.SavedSlabData = { input, result };
  return updateSave(id, data as unknown as Record<string, unknown>);
}

export function saveSlabInput(
  name: string,
  input: shared.SlabInput,
  obraId?: string,
): shared.SavedBeam {
  const data = { input };
  return saveBeam(name, "losa", data as unknown as Record<string, unknown>, obraId);
}

export function updateSlabInput(
  id: string,
  input: shared.SlabInput,
): shared.SavedBeam | null {
  const data = { input };
  return updateSave(id, data as unknown as Record<string, unknown>);
}

export function loadSlab(id: string): shared.SavedSlabData | null {
  const items = getSavedBeams("losa");
  const item = items.find((b) => b.id === id);
  if (!item) return null;
  return item.data as unknown as shared.SavedSlabData;
}

export function deleteSlab(id: string): void {
  deleteSave(id);
}

// ---- Compatibilizaciones (por obra) ----

export function saveCompat(
  name: string,
  slabA: { id: string; name: string },
  slabB: { id: string; name: string },
  edgeA: shared.EdgeIndex,
  edgeB: shared.EdgeIndex,
  result: shared.CompatResult,
  obraId?: string,
): void {
  const key = obraKeyFor(obraId ?? getCurrentObraId(), "saved-compats");
  const saved: shared.SavedCompatData[] = JSON.parse(
    localStorage.getItem(key) || "[]",
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
  localStorage.setItem(key, JSON.stringify(saved));
}

export function getSavedCompats(): shared.SavedCompatData[] {
  return JSON.parse(localStorage.getItem(obraKey("saved-compats")) || "[]");
}

export function deleteCompat(name: string): void {
  const saved: shared.SavedCompatData[] = JSON.parse(
    localStorage.getItem(obraKey("saved-compats")) || "[]",
  );
  localStorage.setItem(
    obraKey("saved-compats"),
    JSON.stringify(saved.filter((c) => c.name !== name)),
  );
  removeCompatReinf(name);
}

// ---- Apoyos individuales (por obra) ----

export function getSavedSupports(): shared.SavedSupportData[] {
  return JSON.parse(localStorage.getItem(obraKey("saved-supports")) || "[]");
}

/** Guarda (o actualiza si ya existe con el mismo nombre) un diseño de apoyo.
 *  Por defecto en la obra activa; con `obraId` en esa obra puntual. */
export function saveSupport(
  data: Omit<shared.SavedSupportData, "savedAt">,
  obraId?: string,
): void {
  const key = obraKeyFor(obraId ?? getCurrentObraId(), "saved-supports");
  const saved: shared.SavedSupportData[] = JSON.parse(
    localStorage.getItem(key) || "[]",
  );
  const entry: shared.SavedSupportData = {
    ...data,
    savedAt: new Date().toISOString(),
  };
  const existing = saved.find((s) => s.name === data.name);
  if (existing) {
    Object.assign(existing, entry);
  } else {
    saved.push(entry);
  }
  localStorage.setItem(key, JSON.stringify(saved));
}

export function deleteSupport(name: string): void {
  localStorage.setItem(
    obraKey("saved-supports"),
    JSON.stringify(getSavedSupports().filter((s) => s.name !== name)),
  );
}

// ---- Armadura elegida por compatibilización (por obra) ----

export function getCompatReinf(compatName: string): shared.CompatReinf | null {
  const saved: shared.CompatReinf[] = JSON.parse(
    localStorage.getItem(obraKey("compat-reinf")) || "[]",
  );
  return saved.find((r) => r.compatName === compatName) ?? null;
}

export function saveCompatReinf(
  compatName: string,
  diam: number,
  sep: number,
): void {
  const saved: shared.CompatReinf[] = JSON.parse(
    localStorage.getItem(obraKey("compat-reinf")) || "[]",
  );
  const existing = saved.find((r) => r.compatName === compatName);
  if (existing) {
    existing.diam = diam;
    existing.sep = sep;
  } else {
    saved.push({ compatName, diam, sep });
  }
  localStorage.setItem(
    obraKey("compat-reinf"),
    JSON.stringify(saved),
  );
}

export function removeCompatReinf(compatName: string): void {
  const saved: shared.CompatReinf[] = JSON.parse(
    localStorage.getItem(obraKey("compat-reinf")) || "[]",
  );
  localStorage.setItem(
    obraKey("compat-reinf"),
    JSON.stringify(saved.filter((r) => r.compatName !== compatName)),
  );
}
