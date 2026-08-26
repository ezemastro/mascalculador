import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PlanillaSheet } from "../lib/print-planilla";
import PrintSheet from "./PrintSheet";

export type PrintScope = "single" | "all";

const TIMEOUT_MS = 30_000;

function ensurePrintRoot(): HTMLDivElement {
  const existing = document.getElementById("print-root");
  if (existing) return existing as HTMLDivElement;
  const el = document.createElement("div");
  el.id = "print-root";
  document.body.appendChild(el);
  return el;
}

/** Modal de impresión: elige qué imprimir (solo el elemento actual o todo lo
 *  guardado) y orquesta la impresión — oculta #root, inyecta @page A4
 *  horizontal y limpia todo al terminar. */
export default function PrintDialog({
  open,
  onClose,
  title,
  currentLabel,
  savedCount,
  savedCountLabel,
  buildSheet,
  allowSingle = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  currentLabel: string;
  savedCount: number;
  /** Texto de la opción "Todo lo guardado", p. ej. "3 losas guardadas". */
  savedCountLabel: (count: number) => string;
  buildSheet: (scope: PrintScope) => PlanillaSheet | null;
  allowSingle?: boolean;
}) {
  const [scope, setScope] = useState<PrintScope>(
    allowSingle ? "single" : "all",
  );
  const [sheet, setSheet] = useState<PlanillaSheet | null>(null);

  useEffect(() => {
    if (!sheet) return;
    const body = document.body;
    body.classList.add("printing-planilla");
    const pageStyle = document.createElement("style");
    pageStyle.id = "planilla-page-style";
    pageStyle.textContent = "@page { size: A4 landscape; margin: 10mm; }";
    document.head.appendChild(pageStyle);

    let finished = false;
    const timer = window.setTimeout(cleanup, TIMEOUT_MS);
    function cleanup() {
      if (finished) return;
      finished = true;
      body.classList.remove("printing-planilla");
      pageStyle.remove();
      window.removeEventListener("afterprint", cleanup);
      window.clearTimeout(timer);
      setSheet(null);
    }
    window.addEventListener("afterprint", cleanup);
    if (typeof window.print === "function") {
      requestAnimationFrame(() => window.print());
    } else {
      cleanup();
    }
    return () => {
      window.removeEventListener("afterprint", cleanup);
      window.clearTimeout(timer);
    };
  }, [sheet]);

  if (!open) return null;

  const printRoot = document.getElementById("print-root");

  const handlePrint = () => {
    const s = buildSheet(scope);
    if (!s) {
      onClose();
      return;
    }
    ensurePrintRoot();
    setSheet(s);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-xl border border-border bg-surface p-5"
        >
          <h2 className="mb-4 text-base font-semibold text-text">{title}</h2>

          <div className="mb-5 space-y-2">
            {allowSingle && (
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 hover:bg-surface-alt">
                <input
                  type="radio"
                  name="print-scope"
                  className="mt-1"
                  checked={scope === "single"}
                  onChange={() => setScope("single")}
                />
                <span>
                  <span className="block text-sm font-semibold text-text">
                    Solo este elemento
                  </span>
                  <span className="block text-xs text-text-muted">
                    {currentLabel}
                  </span>
                </span>
              </label>
            )}
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 hover:bg-surface-alt">
              <input
                type="radio"
                name="print-scope"
                className="mt-1"
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />
              <span>
                <span className="block text-sm font-semibold text-text">
                  Todo lo guardado
                </span>
                <span className="block text-xs text-text-muted">
                    {savedCountLabel(savedCount)}
                  </span>
              </span>
            </label>
          </div>

          <p className="mb-4 text-xs text-text-muted">
            Salida: planilla municipal A4 horizontal, una fila por tramo de
            viga, con datos y resultados de verificación.
          </p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-surface-alt border-border text-text-muted text-sm hover:bg-surface"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="bg-primary text-white text-sm hover:bg-primary-hover"
            >
              Imprimir
            </button>
          </div>
        </div>
      </div>
      {sheet && printRoot
        ? createPortal(<PrintSheet sheet={sheet} />, printRoot)
        : null}
    </>
  );
}
