// Contexto que acompaña cada mensaje del asistente: pantalla activa, obra y
// estado del formulario registrado. Se regenera en cada pasada del bucle de
// tools, así el modelo siempre ve el estado vigente (por ejemplo, justo
// después de completar campos o de navegar a otra pantalla).

import { getCurrentObraId, getObras, listSaves } from "../storage";
import { getAssistantForm } from "./form-bus";

const SCREEN_TITLES: Record<string, string> = {
  "/viga-acero": "Viga de acero (formulario)",
  "/results": "Resultados de viga de acero",
  "/columns": "Columnas de acero (formulario)",
  "/column-results": "Resultados de columna de acero",
  "/bases": "Bases (formulario)",
  "/bases-results": "Resultados de bases",
  "/cartel": "Carteles (formulario)",
  "/cartel-results": "Resultados de cartel",
  "/print": "Planillas de vigas de acero (impresión)",
  "/column-print": "Planillas de columnas de acero (impresión)",
  "/cartel-print": "Planillas de carteles (impresión)",
  "/admin": "Administración (admin)",
};

const MAX_NAMES = 15;

// Glosario por pantalla: significado de las letras/celdas que la app muestra
// en cada módulo (para responder "¿qué significa X?" sin inventar).
const SCREEN_TERMS: Record<string, string> = {
  "/bases": `Términos de esta pantalla:
- qa: tensión admisible del terreno (kN/m²).
- Df: profundidad de fundación (m).
- PD / PL: carga muerta y carga viva que bajan por la columna (kN).
- cx / cy: dimensiones de la columna (cm).
- Lx / Ly: lados de la base (cm en resultados).
- h: altura de la base (cm). hTalon: altura del talón (cm).
- Lcol: longitud de la columna (m); se usa en el esquema cerrado de medianeras.
- type: tipo de base: centrada | medianera-x | medianera-y | esquina.
- subType: viga-de-fundacion | viga-de-equilibrio | tensor (solo medianeras).
- Pu: carga última = max(1.4·PD; 1.2·PD + 1.6·PL) (kN).
- Ru: reacción de la viga de fundación (kN): en el esquema cerrado es la reacción que la viga transfiere a la base para re-centrar la resultante, Ru = Pu·e/(Lcol − e).
- Rux / Ruy: esas reacciones descompuestas en cada dirección.
- e / eX / eY: excentricidad de la carga respecto del centro de la base (cm).
- qu: presión de contacto del suelo = (Pu + Ru)/(Lx·Ly) en esquema cerrado (kN/cm²).
- Mu (Mux / Muy): momento último en cada dirección (kN·cm).
- Vu: corte último (kN).
- kx / ky: vuelos de la base (distancia del borde de la columna al borde de la base, cm).
- b_viga / h_viga: sección de la viga de fundación (cm).`,
  "/viga-acero": `Términos de esta pantalla:
- Tramo: luz entre apoyos (m). Apoyos: simple, empotrado o libre (solo extremos).
- Cargas: puntuales (kN, con posición en m) o distribuidas (kN/m, con rango inicio-fin). D: muerta, L: viva; U = 1.2·D + 1.6·L.
- Perfil: designación del perfil de acero (IPN, UPN, etc.).
- Fy: tensión de fluencia del acero (MPa).
- Lb: longitud sin arriostrar (mm). Cb: factor de flexión.
- Flecha límite: relación L/xxx para la verificación de servicio.`,
  "/columns": `Términos de esta pantalla:
- Tipo de perfil: IPN, UPN, 2UPN, TUBO, ARMADA_I o ARMADA_CAJON.
- Pu: carga axial de compresión (kN).
- Mux / Muy: momentos en cada dirección (kN·m).
- L: longitud de la columna (m). Kx / Ky: factores de longitud efectiva.
- Fy: tensión de fluencia del acero (MPa).`,
  "/cartel": `Términos de esta pantalla:
- Cartel: ancho, alto y despegue del tablero (m).
- Separación de columnas y correas (m).
- Viento: velocidad básica, categoría y exposición según CIRSOC 102.
- Columnas: tipo (1-4), altura, perfiles de cordones/diagonales/montantes.
- Fy: tensión de fluencia del acero (MPa).`,
};

// Guía de uso en lenguaje de obra para explicarle al usuario cada pantalla.
// Es lo que el asistente debe usar cuando le preguntan cómo se usa el módulo
// (nunca la tabla de campos internos).
const SCREEN_GUIDES: Record<string, string> = {
  "/viga-acero":
    "Viga de acero: definís los tramos en metros, el tipo de cada apoyo (simple, empotrado, o libre en los extremos), las cargas puntuales y distribuidas (muerta y viva), el perfil de acero, el Fy, la longitud sin arriostrar y la flecha límite. Al apretar Calcular se analiza la viga y se verifica el perfil contra flexión, corte, deformación y pandeo lateral.",
  "/columns":
    "Columnas de acero: elegís el tipo de perfil (IPN, UPN, tubo o armada), cargás la carga axial, los momentos en las dos direcciones, la longitud, los factores K de pandeo y el Fy. Al apretar Calcular se verifica la columna a pandeo (flexo-compresión) según CIRSOC 301.",
  "/bases":
    "Bases: definís la tensión admisible del terreno, la profundidad de fundación, las cargas que bajan de la columna, las dimensiones de la columna, el tipo de base (centrada, medianera, esquina), las resistencias y el recubrimiento. Al apretar Calcular se dimensiona la base y se verifica que las tensiones del terreno no se superen.",
  "/cartel":
    "Carteles: definís las dimensiones del tablero, la altura de despegue, la separación de columnas y correas, y los datos de viento (velocidad básica, categoría, exposición). Al apretar Calcular se dimensionan las columnas y el reticulado según CIRSOC 102.",
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

  const terms = SCREEN_TERMS[pathname];
  if (terms) {
    lines.push(
      "",
      "## Términos de esta pantalla (para explicar qué significa cada letra)",
      terms,
    );
  }

  const vigas = safeNames(() => listSaves().filter((s) => s.type === "acero"));
  const columnas = safeNames(() =>
    listSaves().filter((s) => s.type === "columna"),
  );
  const bases = safeNames(() => listSaves().filter((s) => s.type === "bases"));
  const carteles = safeNames(() =>
    listSaves().filter((s) => s.type === "cartel"),
  );

  lines.push(
    "",
    "## Elementos guardados en la obra activa",
    `- Vigas de acero (${vigas.length}): ${vigas.join(", ") || "ninguna"}`,
    `- Columnas (${columnas.length}): ${columnas.join(", ") || "ninguna"}`,
    `- Bases (${bases.length}): ${bases.join(", ") || "ninguna"}`,
    `- Carteles (${carteles.length}): ${carteles.join(", ") || "ninguna"}`,
  );

  return lines.join("\n");
}