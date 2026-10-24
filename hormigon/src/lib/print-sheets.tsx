import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import PrintSheet from "../components/PrintSheet";
import type { PlanillaSheet } from "./print-planilla";

const TIMEOUT_MS = 30_000;

function ensurePrintRoot(): HTMLDivElement {
  const existing = document.getElementById("print-root");
  if (existing) return existing as HTMLDivElement;
  const el = document.createElement("div");
  el.id = "print-root";
  document.body.appendChild(el);
  return el;
}

/** Guard so a second invocation while a print is already in flight is ignored. */
let activeCleanup: (() => void) | null = null;

/** Imperative print helper: builds the sheets, mounts them into #print-root
 *  and triggers window.print(). No dialog, no React state in the caller. */
export function printSheets(build: () => PlanillaSheet[] | null): void {
  if (activeCleanup) return;

  const sheets = build();
  if (!sheets || sheets.length === 0) return;

  const printRoot = ensurePrintRoot();
  const mount = document.createElement("div");
  printRoot.appendChild(mount);
  const root = createRoot(mount);

  // Render síncrono: la hoja tiene que estar en el DOM antes de window.print().
  flushSync(() => {
    root.render(sheets.map((sheet, i) => <PrintSheet key={i} sheet={sheet} />));
  });

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
    activeCleanup = null;
    body.classList.remove("printing-planilla");
    pageStyle.remove();
    window.removeEventListener("afterprint", cleanup);
    window.clearTimeout(timer);
    root.unmount();
    mount.remove();
  }

  activeCleanup = cleanup;

  window.addEventListener("afterprint", cleanup);

  if (typeof window.print === "function") {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.print();
      }),
    );
  } else {
    cleanup();
  }
}
