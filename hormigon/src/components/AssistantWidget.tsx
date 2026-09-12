// Widget flotante del asistente virtual. Montado una sola vez en Layout,
// aparece en todas las pantallas autenticadas. Maneja el bucle agéntico:
// envía la conversación al server (que proxea al LLM con streaming), ejecuta
// las tool calls contra la app (formularios, navegación) y repite hasta que
// el modelo responde sin tools o se agota el límite de rondas.

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  AssistantError,
  streamAssistantTurn,
  type ChatMessage,
} from "../lib/assistant/chat";
import { buildAssistantContext } from "../lib/assistant/context";
import {
  executeAssistantTool,
  toolLabel,
  isAssistantToolName,
} from "../lib/assistant/tools";

type TranscriptItem =
  | { kind: "text"; role: "user" | "assistant"; content: string }
  | { kind: "activity"; label: string };

const MAX_TOOL_ROUNDS = 6;

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const messagesRef = useRef<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // El bucle de tools puede navegar a otra pantalla: el contexto de la ronda
  // siguiente se arma con la ruta vigente en cada momento, no con la del
  // closure inicial.
  const pathnameRef = useRef(location.pathname);
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [transcript]);

  async function handleSend() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    messagesRef.current.push({ role: "user", content: text });
    setTranscript((t) => [
      ...t,
      { kind: "text", role: "user", content: text },
      { kind: "text", role: "assistant", content: "" },
    ]);

    const dropEmptyPlaceholder = () => {
      setTranscript((t) => {
        const last = t[t.length - 1];
        if (
          last &&
          last.kind === "text" &&
          last.role === "assistant" &&
          last.content === ""
        ) {
          return t.slice(0, -1);
        }
        return t;
      });
    };

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        let acc = "";
        const paint = () =>
          setTranscript((t) => {
            const copy = [...t];
            copy[copy.length - 1] = {
              kind: "text",
              role: "assistant",
              content: acc,
            };
            return copy;
          });
        const result = await streamAssistantTurn(
          messagesRef.current,
          buildAssistantContext(pathnameRef.current),
          {
            onDelta: (chunk) => {
              acc += chunk;
              paint();
            },
          },
          controller.signal,
        );

        if (result.outcome === "done") {
          messagesRef.current.push({
            role: "assistant",
            content: acc,
          });
          break;
        }

        messagesRef.current.push({
          role: "assistant",
          content: acc || null,
          tool_calls: result.toolCalls.map((c) => ({
            id: c.id,
            function: { name: c.name, arguments: c.arguments },
          })),
        });
        dropEmptyPlaceholder();
        setTranscript((t) => [
          ...t,
          ...result.toolCalls.map((c) => ({
            kind: "activity" as const,
            label: isAssistantToolName(c.name)
              ? toolLabel(c.name, c.arguments)
              : `Herramienta ${c.name}`,
          })),
        ]);
        for (const call of result.toolCalls) {
          const toolResult = await executeAssistantTool(
            call.name,
            call.arguments,
            (path) => navigate(path),
          );
          messagesRef.current.push({
            role: "tool",
            tool_call_id: call.id,
            content: toolResult,
          });
        }
        // Le da un frame al router para que la ronda siguiente arme el
        // contexto con la pantalla ya actualizada (caso navigate).
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    } catch (err) {
      dropEmptyPlaceholder();
      setError(
        err instanceof AssistantError
          ? err.message
          : "Error inesperado del asistente",
      );
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function handleClear() {
    abortRef.current?.abort();
    messagesRef.current = [];
    setTranscript([]);
    setError(null);
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Asistente"
          className="no-print fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {open && (
        <div className="no-print fixed bottom-20 right-5 z-50 flex h-[70vh] max-h-[560px] w-[92vw] max-w-[380px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-sm font-semibold text-text">Asistente</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                title="Limpiar conversación"
                className="text-xs text-text-muted hover:text-text"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Cerrar"
                className="text-sm text-text-muted hover:text-danger"
              >
                ✕
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 space-y-2 overflow-y-auto px-4 py-3"
          >
            {transcript.length === 0 && (
              <p className="text-xs text-text-muted">
                Probá: «Cargá una losa de 4×5 m con D 1.5, L 2 y fc 25» o
                preguntame qué hay guardado en la obra.
              </p>
            )}
            {transcript.map((item, i) =>
              item.kind === "text" ? (
                <div
                  key={i}
                  className={
                    item.role === "user"
                      ? "ml-8 rounded-lg bg-primary/10 px-3 py-2 text-sm text-text whitespace-pre-wrap"
                      : "mr-4 rounded-lg bg-surface-alt px-3 py-2 text-sm text-text whitespace-pre-wrap"
                  }
                >
                  {item.content}
                </div>
              ) : (
                <div key={i} className="text-xs text-text-muted/70 px-1">
                  ⚙ {item.label}
                </div>
              ),
            )}
            {busy && (
              <div className="text-xs text-text-muted/70 px-1 animate-pulse">
                escribiendo…
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-end gap-2 border-t border-border p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              rows={2}
              placeholder={busy ? "Esperando respuesta…" : "Escribí acá…"}
              disabled={busy}
              className="flex-1 resize-none rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={busy || input.trim().length === 0}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
