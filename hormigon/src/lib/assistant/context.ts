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
  "/cabezales": "Vigas de fundación para cabezales (formulario, admin)",
  "/cabezales-results":
    "Resultados de viga de fundación para cabezales (admin)",
  "/cabezal-pilotes": "Cabezales (formulario, admin)",
  "/cabezal-pilotes-results": "Resultados de cabezales (admin)",
  "/admin": "Administración (admin)",
};

const MAX_NAMES = 15;

// Guía de uso en lenguaje de obra para explicarle al usuario cada pantalla.
// Es lo que el asistente debe usar cuando le preguntan cómo se usa el módulo
// (nunca la tabla de campos internos).
const SCREEN_GUIDES: Record<string, string> = {
  "/slab":
    "Losas: definís la luz en cada dirección (Lx y Ly, en metros), la condición de cada borde (articulado = apoyo simple, continuo = empotrado, libre = voladizo), el recubrimiento, el espesor (si dejás 0, la app predimensiona sola), las cargas muerta y viva, las resistencias del hormigón y del acero, el diámetro de barras y si incluye el peso propio. Al apretar Calcular la app dimensiona la losa y te da el armado y las verificaciones.",
  "/slab-compats":
    "Apoyos de losas: acá ves la lista de apoyos guardados y podés compatibilizar losas entre sí para transferir sus cargas a los módulos siguientes.",
  "/concrete":
    "Vigas: definís las luces de cada tramo en metros, el tipo de cada apoyo (articulado, empotrado, o libre en los extremos), las cargas puntuales y distribuidas (muerta y viva), el ancho y el alto de la viga, el recubrimiento, las resistencias y si incluye el peso propio. Al apretar Calcular se analiza la viga continua y obtenés envolventes de momentos y cortes y el armado por tramo.",
  "/rc-column":
    "Columnas: cargás las fuerzas axiales muerta y viva, la altura libre, los momentos en las dos direcciones (en cabeza y base), las dimensiones de la columna, el factor beta, las resistencias y si incluye el peso propio. También podés sumar las cargas que bajan de columnas y vigas guardadas. Al apretar Calcular se dimensiona la columna y se propone el armado.",
  "/bases":
    "Bases: definís la tensión admisible del terreno, la profundidad de fundación, las cargas que bajan de la columna, las dimensiones de la columna, el tipo de base (centrada, medianera, esquina), las resistencias y el recubrimiento. Al apretar Calcular se dimensiona la base y se verifica que las tensiones del terreno no se superen.",
  "/computos":
    "Cómputos: armás el cómputo métrico de la obra sumando los elementos guardados (losas, vigas, columnas, bases) y generás la planilla con cantidades.",
};

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

  const obras = getObras();
  if (obras.length > 0) {
    lines.push(
      "",
      "## Obras disponibles",
      ...obras
        .slice(0, 20)
        .map(
          (o) =>
            `- "${o.name}" ${o.id === getCurrentObraId() ? "(activa)" : ""}`,
        ),
    );
  } else {
    lines.push(
      "",
      "## Obras disponibles",
      "- (ninguna; puedo crear una nueva)",
    );
  }

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

  const guide = SCREEN_GUIDES[pathname];
  if (guide) {
    lines.push(
      "",
      "## Cómo se usa esta pantalla (para explicarle al usuario)",
      guide,
    );
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
