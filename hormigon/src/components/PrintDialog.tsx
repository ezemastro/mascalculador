import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PlanillaSheet } from "../lib/print-planilla";
import PrintSheet from "./PrintSheet";

const TIMEOUT_MS = 30_000;

function ensurePrintRoot(): HTMLDivElement {
  const existing = document.getElementById("print-root");
  if (existing) return existing as HTMLDivElement;
  const el = document.createElement("div");
  el.id = "print-root";
  document.body.appendChild(el);
  return el;
}

/** Modal de impresión: imprime SIEMPRE todo lo guardado del tipo elegido (o
 *  las planillas combinadas, p. ej. losas + apoyos) y orquesta la impresión —
 *  oculta #root, inyecta @page A4 horizontal y limpia todo al terminar. */
export default function PrintDialog({
  open,
  onClose,
  title,
  buildSheets,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  buildSheets: () => PlanillaSheet[] | null;
}) {
  const [sheets, setSheets] = useState<PlanillaSheet[] | null>(null);

  useEffect(() => {
    if (!sheets) return;
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
      setSheets(null);
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
  }, [sheets]);

  if (!open) return null;

  const printRoot = document.getElementById("print-root");

  const handlePrint = () => {
    const s = buildSheets();
    if (!s || s.length === 0) {
      onClose();
      return;
    }
    ensurePrintRoot();
    setSheets(s);
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
          <h2 className="mb-5 text-base font-semibold text-text">{title}</h2>

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
      {sheets && printRoot
        ? createPortal(
            sheets.map((sheet, i) => <PrintSheet key={i} sheet={sheet} />),
            printRoot,
          )
        : null}
    </>
  );
}
