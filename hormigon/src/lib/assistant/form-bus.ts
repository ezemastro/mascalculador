// Registro de formularios editables por el asistente virtual.
//
// Cada formulario que soporta edición asistida se registra al montarse y deja
// su controlador acá; el widget lo consulta según la ruta activa. Los
// controladores se registran una sola vez por montaje y leen el estado vía
// ref, así el registro no depende de que cambie el estado del formulario.

export interface AssistantFormApplyResult {
  applied: string[];
  errors: string[];
}

export interface AssistantFormController {
  /** Ruta que atiende este controlador (ej. "/slab"). */
  screen: string;
  /** Título legible para el contexto del asistente. */
  title: string;
  /** Documentación de campos: nombre exacto, unidad, opciones válidas. */
  fieldDocs: string;
  /** Estado actual del formulario, en unidades de UI. */
  getState(): Record<string, unknown>;
  /**
   * Aplica un parcial de valores (en unidades de UI). Devuelve los campos
   * aplicados y los rechazados con motivo, para que el modelo se corrija.
   */
  apply(values: Record<string, unknown>): AssistantFormApplyResult;
  /**
   * Guarda los datos del formulario (equivale al botón Guardar). Opcional:
   * las pantallas sin guardado asistido devuelven error desde la tool.
   */
  save?(args: { name: string }): Promise<AssistantFormApplyResult>;
}

const controllers = new Map<string, AssistantFormController>();

/** Registra el controlador de una pantalla. Devuelve la función de cleanup. */
export function registerAssistantForm(
  controller: AssistantFormController,
): () => void {
  controllers.set(controller.screen, controller);
  return () => {
    if (controllers.get(controller.screen) === controller) {
      controllers.delete(controller.screen);
    }
  };
}

/** Controlador registrado para la ruta activa, si lo hay. */
export function getAssistantForm(
  pathname: string,
): AssistantFormController | null {
  return controllers.get(pathname) ?? null;
}
