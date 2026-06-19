const KEY = "mascalculador_beam_saves";

export interface SavedBeam {
  id: string;
  name: string;
  type: "acero" | "hormigon";
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
