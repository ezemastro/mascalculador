// Ejecución de tools del asistente, del lado del cliente: el estado de la
// app (formularios, navegación) vive acá, no en el server. Los nombres y
// argumentos se validan contra listas blancas; cualquier desvío devuelve un
// error en texto para que el modelo se corrija en la próxima pasada.

import { getAssistantForm } from "./form-bus";

export const ASSISTANT_PATHS = [
  "/slab",
  "/slab-compats",
  "/concrete",
  "/rc-column",
  "/bases",
  "/computos",
] as const;

export type AssistantToolName = "set_form_values" | "navigate" | "save_form";

export function isAssistantToolName(name: string): name is AssistantToolName {
  return (
    name === "set_form_values" || name === "navigate" || name === "save_form"
  );
}

/** Etiqueta corta para mostrar la actividad de tools en el chat. */
export function toolLabel(name: AssistantToolName, args: string): string {
  if (name === "set_form_values") return "Completando formulario…";
  if (name === "save_form") return "Guardando en la obra…";
  try {
    const path = JSON.parse(args || "{}").path as string;
    if (typeof path === "string") return `Navegando a ${path}…`;
  } catch {
    // etiqueta genérica
  }
  return "Navegando…";
}

export async function executeAssistantTool(
  name: string,
  argsJson: string,
  navigate: (path: string) => void,
): Promise<string> {
  if (!isAssistantToolName(name)) {
    return JSON.stringify({
      ok: false,
      error: `herramienta desconocida: ${name}`,
    });
  }
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson || "{}") as Record<string, unknown>;
  } catch {
    return JSON.stringify({ ok: false, error: "argumentos JSON inválidos" });
  }

  if (name === "set_form_values") {
    const form = getAssistantForm(window.location.pathname);
    if (!form) {
      return JSON.stringify({
        ok: false,
        error:
          "La pantalla activa no tiene formulario editable. Usá navigate para ir a un formulario.",
      });
    }
    const values = args.values;
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      return JSON.stringify({
        ok: false,
        error: "falta 'values' (objeto campo→valor)",
      });
    }
    const result = form.apply(values as Record<string, unknown>);
    return JSON.stringify({
      ok: result.errors.length === 0,
      applied: result.applied,
      errors: result.errors,
    });
  }

  if (name === "save_form") {
    const form = getAssistantForm(window.location.pathname);
    if (!form) {
      return JSON.stringify({
        ok: false,
        error:
          "La pantalla activa no tiene formulario. Usá navigate para ir al formulario con los datos a guardar.",
      });
    }
    if (!form.save) {
      return JSON.stringify({
        ok: false,
        error: `La pantalla ${window.location.pathname} todavía no soporta guardado asistido.`,
      });
    }
    const saveName = typeof args.name === "string" ? args.name.trim() : "";
    if (!saveName) {
      return JSON.stringify({
        ok: false,
        error:
          "Falta 'name' (nombre para el elemento). Preguntáselo al usuario si no lo dio.",
      });
    }
    const result = await form.save({ name: saveName });
    return JSON.stringify({
      ok: result.errors.length === 0,
      applied: result.applied,
      errors: result.errors,
    });
  }

  // navigate
  const path = args.path;
  if (
    typeof path !== "string" ||
    !(ASSISTANT_PATHS as readonly string[]).includes(path)
  ) {
    return JSON.stringify({
      ok: false,
      error: `path inválido. Válidos: ${ASSISTANT_PATHS.join(", ")}`,
    });
  }
  navigate(path);
  return JSON.stringify({ ok: true, path });
}
