const KEY = "mascalculador_beam_saves";

export interface SavedBeam {
  id: string;
  name: string;
  type: "acero" | "hormigon" | "bases";
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

export function saveBeam(name: string, type: "acero" | "hormigon", data: Record<string, unknown>): SavedBeam {
  const saves = listSaves();
  const beam: SavedBeam = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    type,
    date: new Date().toLocaleString(),
    data,
  };
  saves.push(beam);
  writeSaves(saves);
  return beam;
}

export function deleteSave(id: string) {
  writeSaves(listSaves().filter((s) => s.id !== id));
}

const LAST_BASES_FORM_KEY = "mascalculador_last_bases_form";

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
