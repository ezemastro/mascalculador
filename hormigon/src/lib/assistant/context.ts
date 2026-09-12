// Contexto que acompaña cada mensaje del asistente: pantalla activa, obra y
// estado del formulario registrado. Se regenera en cada pasada del bucle de
// tools, así el modelo siempre ve el estado vigente (por ejemplo, justo
// después de completar campos o de navegar a otra pantalla).

import {
  getCurrentObraId,
  getObras,
  getSavedCompats,
  getSavedSlabs,
  getSavedSupports,
  listSaves,
} from "../storage";
import { getAssistantForm } from "./form-bus";

const SCREEN_TITLES: Record<string, string> = {
  "/slab": "Dimensionado de Losas",
  "/slab-results": "Resultados de losa",
  "/slab-compat": "Compatibilización de losas",
  "/slab-compats": "Apoyos de losas (lista)",
  "/concrete": "Vigas (formulario)",
  "/concrete-results": "Resultados de viga",
  "/results": "Resultados de viga",
  "/rc-column": "Columnas (formulario)",
  "/rc-column-results": "Resultados de columna",
  "/bases": "Bases (formulario)",
  "/bases-results": "Resultados de bases",
  "/computos": "Cómputos de obra",
  "/cabezales": "Cabezales (formulario, admin)",
  "/cabezales-results": "Resultados de cabezales (admin)",
  "/cabezal-pilotes": "Cabezal de pilotes (formulario, admin)",
  "/cabezal-pilotes-results": "Resultados de cabezal de pilotes (admin)",
  "/admin": "Administración (admin)",
};

const MAX_NAMES = 15;

function safeNames(read: () => { name: string }[]): string[] {
  try {
    return read()
      .map((item) => item.name)
      .slice(0, MAX_NAMES);
  } catch {
    return [];
  }
}

export function buildAssistantContext(pathname: string): string {
  const lines: string[] = [];
  const title = SCREEN_TITLES[pathname];
  lines.push(
    `Pantalla actual: ${pathname}${title ? ` (${title})` : " (pantalla sin título)"}`,
  );

  const obra = getObras().find((o) => o.id === getCurrentObraId());
  lines.push(`Obra activa: ${obra ? `"${obra.name}"` : "(desconocida)"}`);

  const form = getAssistantForm(pathname);
  if (form) {
    lines.push(
      "",
      `## Formulario activo: ${form.title}`,
      form.fieldDocs,
      "Estado actual (unidades de UI):",
      JSON.stringify(form.getState()),
    );
  } else {
    lines.push("", "No hay formulario editable registrado en esta pantalla.");
  }

  const slabs = safeNames(() => getSavedSlabs());
  const beams = safeNames(() =>
    listSaves().filter((s) => s.type === "hormigon"),
  );
  const columns = safeNames(() =>
    listSaves().filter((s) => s.type === "rc-columna"),
  );
  const bases = safeNames(() => listSaves().filter((s) => s.type === "bases"));
  const compats = safeNames(() => getSavedCompats());
  const supports = safeNames(() => getSavedSupports());

  lines.push(
    "",
    "## Elementos guardados en la obra activa",
    `- Losas (${slabs.length}): ${slabs.join(", ") || "ninguna"}`,
    `- Vigas (${beams.length}): ${beams.join(", ") || "ninguna"}`,
    `- Columnas (${columns.length}): ${columns.join(", ") || "ninguna"}`,
    `- Bases (${bases.length}): ${bases.join(", ") || "ninguna"}`,
    `- Compatibilizaciones (${compats.length}): ${compats.join(", ") || "ninguna"}`,
    `- Apoyos (${supports.length}): ${supports.join(", ") || "ninguno"}`,
  );

  return lines.join("\n");
}
