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
  "/bases-results": `Términos de esta pantalla:
- Pu: carga última (kN).
- qu: presión de contacto del suelo (kN/cm²).
- kx / ky: vuelos de la base (cm).
- eX / eY: excentricidad en cada dirección (cm).
- Rux / Ruy: reacción de la viga de fundación en cada dirección (kN).
- b_vigaX / h_vigaX, b_vigaY / h_vigaY: sección de la viga de fundación (cm).
- Mu / Mux / Muy: momento último (kN·cm). Vu: corte último (kN).
- Ru: reacción de la viga de fundación (kN), ver glosario de /bases.`,
  "/slab": `Términos de esta pantalla:
- Luz en X / Luz en Y: luces de la losa (m).
- Borde articulado: apoyo simple (sin momento negativo). Borde continuo: empotrado (con momento negativo en el apoyo). Borde libre: voladizo sin apoyo.
- h predim / h adop: espesor predimensionado / adoptado (cm). 0 = usar predimensionado.
- D / L: carga muerta y carga viva (kN/m²).
- fc: resistencia del hormigón (MPa). fy: resistencia del acero (MPa).
- dBarX / dBarY: diámetro de las barras en cada dirección (mm).
- Recubrimiento: capa de protección sobre el armado (cm).
- Peso propio: si se incluye, la app lo suma a D automáticamente.`,
  "/slab-results": `Términos de esta pantalla:
- h efectivo: espesor que usó el cálculo (mm).
- Mx / My: momentos últimos por metro de losa en cada dirección.
- CMex / CMey: momento negativo en el borde continuo (apoyo).
- As: armadura requerida/provista por metro.
- Reacciones: cargas que la losa transfiere a sus apoyos, se usan para importar a vigas.
- Flechas: verificación de estado de servicio (Branson/Bischoff).`,
  "/concrete": `Términos de esta pantalla:
- Tramos: luces de la viga continua (m). Apoyos: articulado, empotrado o libre (solo extremos).
- Cargas: puntuales (kN, con posición en m) o distribuidas (kN/m, con rango inicio-fin). D: muerta, L: viva; U = 1.2·D + 1.6·L.
- bw / h: ancho y alto de la viga (mm). Recubrimiento (mm).
- fc: hormigón (MPa). fy: acero (MPa).
- Apoyos (supportWidths): ancho de cada apoyo (mm).`,
  "/concrete-results": `Términos de esta pantalla:
- Envolventes Mu / Vu: diagramas de momento y corte últimos.
- As por tramo: armadura longitudinal requerida y provista.
- Estribos: armadura transversal (ramas, diámetro, separación).
- Flechas: estado de servicio.`,
  "/rc-column": `Términos de esta pantalla:
- PD / PL: cargas manuales a nivel de piso (kN). lu: altura libre de la columna (m).
- Mx / My (Sup / Inf): momentos en cada dirección, en cabeza y base (kN·m).
- Cx / Cy: dimensiones de la columna (cm). betaD: factor beta (0-1).
- fc / fy: resistencias (MPa).
- Peso propio: suma el peso de la columna al P total.`,
  "/rc-column-results": `Términos de esta pantalla:
- Pu: carga axial última (kN). Mu: momento último (kN·m).
- Armado: barras de esquina (nEsquinas, dbEsquinas) y de caras (nCarasX/Y, dbCarasX/Y).
- Verificaciones: esbeltez, aplastamiento, armado mínimo.`,
};

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
    "Columnas: cargás las fuerzas axiales muerta y viva, la altura libre (distancia vertical desde la cara superior del apoyo inferior — losa o suelo — hasta la cara inferior del apoyo superior — viga o losa del piso siguiente), los momentos en las dos direcciones (en cabeza y base), las dimensiones de la columna, el factor beta, las resistencias y si incluye el peso propio. También podés sumar las cargas que bajan de columnas y vigas guardadas. Al apretar Calcular se dimensiona la columna y se propone el armado.",
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

  const terms = SCREEN_TERMS[pathname];
  if (terms) {
    lines.push(
      "",
      "## Términos de esta pantalla (para explicar qué significa cada letra)",
      terms,
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
