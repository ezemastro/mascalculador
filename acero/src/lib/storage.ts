// Wrapper sobre @mascalculador/shared.
// Funciones genericas (listSaves, saveBeam, etc.) hardcodean app="steel".
// Funciones especificas (saveLastFormState, saveSlab, etc.) re-exportan tal cual
// porque ya tienen el app hardcodeado en shared.
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

export function listSaves(): shared.SavedBeam[] {
  return shared.listSaves("steel");
}

export function saveBeam(
  name: string,
  type: shared.SaveType,
  data: Record<string, unknown>,
): shared.SavedBeam {
  return shared.saveBeam("steel", name, type, data);
}

export function updateSave(
  id: string,
  data: Record<string, unknown>,
): shared.SavedBeam | null {
  return shared.updateSave("steel", id, data);
}

export function deleteSave(id: string): void {
  return shared.deleteSave("steel", id);
}

export function getSavedBeams(type: shared.SaveType): shared.SavedBeam[] {
  return shared.getSavedBeams("steel", type);
}
