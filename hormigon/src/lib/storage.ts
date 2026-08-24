// Wrapper sobre @mascalculador/shared que hardcodea app="concrete"
// para mantener compatibilidad con la API vieja (sin param app).
import * as shared from "@mascalculador/shared";

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
export const saveSlab = shared.saveSlab;
export const updateSlab = shared.updateSlab;
export const saveSlabInput = shared.saveSlabInput;
export const updateSlabInput = shared.updateSlabInput;
export const getSavedSlabs = shared.getSavedSlabs;
export const loadSlab = shared.loadSlab;
export const deleteSlab = shared.deleteSlab;
export const saveCompat = shared.saveCompat;
export const getSavedCompats = shared.getSavedCompats;
export const deleteCompat = shared.deleteCompat;
export const getSavedSupports = shared.getSavedSupports;
export const saveSupport = shared.saveSupport;
export const deleteSupport = shared.deleteSupport;
export const getCompatReinf = shared.getCompatReinf;
export const saveCompatReinf = shared.saveCompatReinf;

export function listSaves(): shared.SavedBeam[] {
  return shared.listSaves("concrete");
}

export function saveBeam(
  name: string,
  type: shared.SaveType,
  data: Record<string, unknown>,
): shared.SavedBeam {
  return shared.saveBeam("concrete", name, type, data);
}

export function updateSave(
  id: string,
  data: Record<string, unknown>,
): shared.SavedBeam | null {
  return shared.updateSave("concrete", id, data);
}

export function deleteSave(id: string): void {
  return shared.deleteSave("concrete", id);
}

export function getSavedBeams(type: shared.SaveType): shared.SavedBeam[] {
  return shared.getSavedBeams("concrete", type);
}
