// Contexto que acompaña cada mensaje del asistente: pantalla activa y estado
// del formulario registrado. Se regenera en cada pasada del bucle de tools,
// así el modelo siempre ve el estado vigente (por ejemplo, justo después de
// completar campos o de navegar a otra pantalla).

import { getSavedPorticoInputs, getSavedVigasContinuas } from "../storage";
import { getAssistantForm } from "./form-bus";

const SCREEN_TITLES: Record<string, string> = {
  "/": "Viga Continua (formulario)",
  "/viga-continua": "Viga Continua (formulario)",
  "/?mode=portico": "Pórtico (formulario)",
  "/viga-continua?mode=portico": "Pórtico (formulario)",
  "/viga-continua-results": "Resultados de viga continua",
  "/viga-continua-print": "Página de impresión",
  "/admin": "Administración (admin)",
};

const MAX_NAMES = 15;

// Glosario por pantalla: significado de las letras/celdas que la app muestra
// en cada módulo (para responder "¿qué significa X?" sin inventar).
const SCREEN_TERMS: Record<string, string> = {
  "/": `Términos de esta pantalla:
- Tramo N (m): luz de cada tramo, en metros.
- Apoyos: tipo de cada apoyo. Articulado = simple (empotramiento nulo);
  Empotrado = fixed; Libre = voladizo (solo en extremos).
- Cargas D + L → U: D es carga muerta y L carga viva; U = 1.2·D + 1.6·L.
- Puntual: carga concentrada en kN, con Pos = posición desde el apoyo
  izquierdo (m). Distribuida: carga en kN/m con rango Inicio–Fin (m).
- U: carga última combinada.`,
  "/viga-continua": `Términos de esta pantalla:
- Tramo N (m): luz de cada tramo, en metros.
- Apoyos: tipo de cada apoyo. Articulado = simple (empotramiento nulo);
  Empotrado = fixed; Libre = voladizo (solo en extremos).
- Cargas D + L → U: D es carga muerta y L carga viva; U = 1.2·D + 1.6·L.
- Puntual: carga concentrada en kN, con Pos = posición desde el apoyo
  izquierdo (m). Distribuida: carga en kN/m con rango Inicio–Fin (m).
- U: carga última combinada.`,
  "/?mode=portico": `Términos de esta pantalla:
- Nodos: nudos del pórtico con coordenadas x (m) e y (m). El eje +y apunta
  hacia ABAJO.
- Barras: conectan dos nudos. E (MPa), A (cm²) y I (cm⁴) son placeholders
  de análisis; el solver reparte la rigidez linealmente.
- Apoyos: sobre un nudo. Articulado (hinge) fija desplazamientos (u, v);
  Empotrado (fixed) fija además la rotación θ.
- Cargas sobre barra: D (muerta) y L (viva). Puntual (kN) con posición a (m)
  desde el inicio; Distribuida (kN/m) entre a y b. angle ú nos 0 a 360:
  0° hacia +x, 90° hacia +y (abajo).`,
  "/viga-continua?mode=portico": `Términos de esta pantalla:
- Nodos: nudos del pórtico con coordenadas x (m) e y (m). El eje +y apunta
  hacia ABAJO.
- Barras: conectan dos nudos. E (MPa), A (cm²) y I (cm⁴) son placeholders
  de análisis; el solver reparte la rigidez linealmente.
- Apoyos: sobre un nudo. Articulado (hinge) fija desplazamientos (u, v);
  Empotrado (fixed) fija además la rotación θ.
- Cargas sobre barra: D (muerta) y L (viva). Puntual (kN) con posición a (m)
  desde el inicio; Distribuida (kN/m) entre a y b. angle ú nos 0 a 360:
  0° hacia +x, 90° hacia +y (abajo).`,
  "/viga-continua-results": `Términos de esta pantalla:
- Envolventes Mu / Vu: diagramas de momento y corte últimos sobre cada tramo.
- Mu+: momento positivo de tramo. Mu−: momento negativo en apoyos.
- Servicio D / Servicio L: envolventes sin factorar (estado de servicio).
- Reacciones: cargas que cada apoyo recibe de la viga.`,
};

// Guía de uso en lenguaje de obra para explicarle al usuario cada pantalla.
// Es lo que el asistente debe usar cuando le preguntan cómo se usa el módulo
// (nunca la tabla de campos internos).
const SCREEN_GUIDES: Record<string, string> = {
  "/": "Viga Continua: definís la cantidad de tramos y la luz de cada uno (en metros), el tipo de cada apoyo (articulado, empotrado, o libre en los extremos), y las cargas muerta y viva: puntuales (con su posición) o distribuidas (con inicio y fin). Al apretar Calcular la app analiza la viga según CIRSOC 201 y te muestra las envolventes de momento y corte y las reacciones en los apoyos.",
  "/viga-continua":
    "Viga Continua: definís la cantidad de tramos y la luz de cada uno (en metros), el tipo de cada apoyo (articulado, empotrado, o libre en los extremos), y las cargas muerta y viva: puntuales (con su posición) o distribuidas (con inicio y fin). Al apretar Calcular la app analiza la viga según CIRSOC 201 y te muestra las envolventes de momento y corte y las reacciones en los apoyos.",
  "/?mode=portico":
    "Pórtico: cargás los nudos con sus coordenadas (el eje +y apunta hacia abajo), las barras que los unen, los apoyos sobre los nudos y las cargas sobre las barras (puntuales con posición, o distribuidas con rango). Al apretar Calcular la app resuelve el pórtico por rigidez (matriz de rigidez 2D) y te da las envolventes de esfuerzos y las reacciones.",
  "/viga-continua?mode=portico":
    "Pórtico: cargás los nudos con sus coordenadas (el eje +y apunta hacia abajo), las barras que los unen, los apoyos sobre los nudos y las cargas sobre las barras (puntuales con posición, o distribuidas con rango). Al apretar Calcular la app resuelve el pórtico por rigidez (matriz de rigidez 2D) y te da las envolventes de esfuerzos y las reacciones.",
  "/viga-continua-results":
    "Resultados: acá ves los diagramas de momento y corte (envueltas Mu y Vu por tramo) y las reacciones de los apoyos de la viga que calculaste.",
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

export function buildAssistantContext(screen: string): string {
  const lines: string[] = [];
  const title = SCREEN_TITLES[screen];
  lines.push(
    `Pantalla actual: ${screen}${title ? ` (${title})` : " (pantalla sin título)"}`,
  );

  const form = getAssistantForm(screen);
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

  const guide = SCREEN_GUIDES[screen];
  if (guide) {
    lines.push(
      "",
      "## Cómo se usa esta pantalla (para explicarle al usuario)",
      guide,
    );
  }

  const terms = SCREEN_TERMS[screen];
  if (terms) {
    lines.push(
      "",
      "## Términos de esta pantalla (para explicar qué significa cada letra)",
      terms,
    );
  }

  const vigas = safeNames(() => getSavedVigasContinuas());
  const porticos = safeNames(() => getSavedPorticoInputs());

  lines.push(
    "",
    "## Elementos guardados",
    `- Vigas continuas (${vigas.length}): ${vigas.join(", ") || "ninguna"}`,
    `- Pórticos (${porticos.length}): ${porticos.join(", ") || "ninguno"}`,
  );

  return lines.join("\n");
}
