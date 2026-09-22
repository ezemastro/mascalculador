// Cliente del asistente: habla con /api/assistant/chat (SSE) y normaliza los
// chunks estilo OpenAI. El bucle agéntico (ejecutar tools y volver a pedir)
// lo maneja el widget; este módulo solo transmite una pasada y devuelve cómo
// terminó ("done" o "tool_calls").

export type ChatRole = "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  tool_calls?: { id: string; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface CompletedToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface AssistantStreamHandlers {
  /** Fragmento de texto visible del assistant. */
  onDelta(text: string): void;
}

export type AssistantTurnResult =
  | { outcome: "done" }
  | { outcome: "tool_calls"; toolCalls: CompletedToolCall[] };

interface ToolCallAcc {
  id: string;
  name: string;
  args: string;
}

/** Error con mensaje ya pensado para mostrar al usuario. */
export class AssistantError extends Error {}

export async function streamAssistantTurn(
  messages: ChatMessage[],
  context: string,
  handlers: AssistantStreamHandlers,
  signal: AbortSignal,
): Promise<AssistantTurnResult> {
  let res: Response;
  try {
    res = await fetch("/api/assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, context }),
      signal,
    });
  } catch {
    if (signal.aborted) throw new AssistantError("Cancelado");
    throw new AssistantError("No hay conexión con el server");
  }
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // respuesta sin JSON: queda el mensaje genérico
    }
    throw new AssistantError(message);
  }
  if (!res.body) {
    throw new AssistantError("Respuesta vacía del server");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const toolAcc = new Map<number, ToolCallAcc>();

  const flushLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (payload === "[DONE]") return;
    let data: {
      error?: { message?: string } | string;
      choices?: {
        delta?: {
          content?: string | null;
          tool_calls?: {
            index: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }[];
        };
      }[];
    };
    try {
      data = JSON.parse(payload);
    } catch {
      return; // chunk incompleto o keep-alive
    }
    if (data.error) {
      const msg =
        typeof data.error === "string"
          ? data.error
          : data.error.message || "Error del modelo";
      throw new AssistantError(msg);
    }
    const choice = data.choices?.[0];
    if (!choice) return;
    const delta = choice.delta;
    if (!delta) return;
    if (typeof delta.content === "string" && delta.content.length > 0) {
      handlers.onDelta(delta.content);
    }
    for (const tc of delta.tool_calls ?? []) {
      const acc = toolAcc.get(tc.index) ?? { id: "", name: "", args: "" };
      if (tc.id) acc.id = tc.id;
      if (tc.function?.name) acc.name += tc.function.name;
      if (tc.function?.arguments) acc.args += tc.function.arguments;
      toolAcc.set(tc.index, acc);
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        flushLine(line);
      }
    }
    buffer += decoder.decode();
    if (buffer) flushLine(buffer);
  } catch (err) {
    if (signal.aborted) throw new AssistantError("Cancelado");
    if (err instanceof AssistantError) throw err;
    throw new AssistantError("Stream interrumpido");
  }

  if (toolAcc.size > 0) {
    const toolCalls: CompletedToolCall[] = [...toolAcc.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, acc]) => ({
        id: acc.id,
        name: acc.name,
        arguments: acc.args || "{}",
      }));
    return { outcome: "tool_calls", toolCalls };
  }
  return { outcome: "done" };
}
