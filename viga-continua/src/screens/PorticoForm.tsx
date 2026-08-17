/**
 * PorticoForm — editor del modo Pórtico (2-D stiffness).
 *
 * Replicamos la UX del beam form VigaContinuaForm: auto-persist del último
 * estado, soporte para guardados con nombre en `SavedBeams`, validación
 * antes de submit, y botón `Nueva` con confirmación.
 *
 * Hidratación: en montaje, si existe `last_portico_form` en localStorage
 * se restaura; si no, se usa `createDefaultPorticoState()` (3 nudos A/B/C,
 * 2 barras, 2 apoyos, 1 carga inclinada de ejemplo).
 *
 * Cap UX: 5/5/5/5 (nodos / barras / apoyos / cargas). El solver interno
 * no tiene cap (R-portico-limits), por lo que cargar estados con más
 * elementos vía SavedBeams sigue funcionando.
 *
 * Convención Y-down (explicado en `lib/portico.ts`) y M+ (tensión abajo;
 * vector → +x). El input Y crece hacia abajo en pantalla, igual que en
 * Mafs. La leyenda está en `PorticoResults` (PR4).
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { DecimalInput, MainLayout, SavedBeams } from "@mascalculador/shared";
import {
  loadLastPorticoFormState,
  saveLastPorticoFormState,
  savePorticoInput,
  updatePorticoInput,
} from "../lib/storage";
import {
  validatePorticoState,
  PorticoValidationError,
} from "../lib/portico-analysis";
import { createDefaultPorticoState } from "../lib/portico-defaults";
import type {
  PorticoState,
  PorticoBarLoad,
  PorticoSupportKind,
} from "../lib/portico";

const CAP = 5;

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PorticoForm() {
  const navigate = useNavigate();

  // Hidratación: del último estado si existe; si no, defaults.
  // El helper `loadLastPorticoFormState` devuelve el tipo readonly de
  // shared/ — clonamos superficial para soltar la inmutabilidad y poder
  // mutar en setState (las forms usan Set/Patch en vez de inmutabilidad
  // estricta por ergonomía).
  const [state, setState] = useState<PorticoState>(() => {
    const last = loadLastPorticoFormState();
    if (last && Array.isArray(last.nodes) && last.nodes.length > 0) {
      return {
        nodes: last.nodes.map((n) => ({ ...n })),
        bars: last.bars.map((b) => ({ ...b })),
        loads: last.loads.map((l) => ({ ...l })),
        supports: last.supports.map((s) => ({ ...s })),
      };
    }
    return createDefaultPorticoState();
  });

  const [loadedSaveId, setLoadedSaveId] = useState<string | null>(null);
  const [loadedSaveName, setLoadedSaveName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-persist (silencioso si no hay localStorage).
  useEffect(() => {
    saveLastPorticoFormState(state);
  }, [state]);

  // ---- Manipuladores de filas (cap 5/5/5/5) ----

  function addNode() {
    if (state.nodes.length >= CAP) return;
    const newIndex = state.nodes.length + 1;
    setState((s) => ({
      ...s,
      nodes: [...s.nodes, { id: `N${newIndex}`, x: 0, y: 0 }],
    }));
  }
  function removeNode(id: string) {
    setState((s) => ({
      ...s,
      nodes: s.nodes.filter((n) => n.id !== id),
      // Limpiar referencias huérfanas en barras / apoyos / cargas.
      bars: s.bars.filter((b) => b.fromNodeId !== id && b.toNodeId !== id),
      supports: s.supports.filter((sup) => sup.nodeId !== id),
      loads: s.loads.filter((l) => {
        const b = s.bars.find((bb) => bb.id === l.barId);
        return b !== undefined;
      }),
    }));
  }
  function patchNode(id: string, patch: Partial<{ x: number; y: number }>) {
    setState((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
  }
  function setNodeId(oldId: string, newId: string) {
    if (newId === oldId) return;
    if (state.nodes.some((n) => n.id === newId)) {
      setError(`ID de nodo "${newId}" ya existe`);
      return;
    }
    setError(null);
    setState((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.id === oldId ? { ...n, id: newId } : n)),
      bars: s.bars.map((b) => ({
        ...b,
        fromNodeId: b.fromNodeId === oldId ? newId : b.fromNodeId,
        toNodeId: b.toNodeId === oldId ? newId : b.toNodeId,
      })),
      supports: s.supports.map((sup) =>
        sup.nodeId === oldId ? { ...sup, nodeId: newId } : sup,
      ),
    }));
  }

  function addBar() {
    if (state.bars.length >= CAP) return;
    const fromId = state.nodes[0]?.id ?? "A";
    const toId = state.nodes[1]?.id ?? fromId;
    setState((s) => ({
      ...s,
      bars: [
        ...s.bars,
        {
          id: newId("b"),
          fromNodeId: fromId,
          toNodeId: toId,
          E: 1,
          A: 1e-2,
          I: 1e-4,
        },
      ],
    }));
  }
  function removeBar(id: string) {
    setState((s) => ({
      ...s,
      bars: s.bars.filter((b) => b.id !== id),
      loads: s.loads.filter((l) => l.barId !== id),
    }));
  }
  function patchBar(
    id: string,
    patch: Partial<{
      fromNodeId: string;
      toNodeId: string;
      E: number;
      A: number;
      I: number;
    }>,
  ) {
    setState((s) => ({
      ...s,
      bars: s.bars.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }

  function addSupport() {
    if (state.supports.length >= CAP) return;
    const usedIds = new Set(state.supports.map((sup) => sup.nodeId));
    const freeNode = state.nodes.find((n) => !usedIds.has(n.id));
    if (!freeNode) {
      setError("No hay nudos libres para asignar apoyo (todos ya tienen).");
      return;
    }
    setError(null);
    setState((s) => ({
      ...s,
      supports: [
        ...s.supports,
        { id: newId("Sup"), nodeId: freeNode.id, kind: "hinge" },
      ],
    }));
  }
  function removeSupport(id: string) {
    setState((s) => ({
      ...s,
      supports: s.supports.filter((sup) => sup.id !== id),
    }));
  }
  function patchSupport(
    id: string,
    patch: Partial<{ nodeId: string; kind: PorticoSupportKind }>,
  ) {
    setState((s) => ({
      ...s,
      supports: s.supports.map((sup) =>
        sup.id === id ? { ...sup, ...patch } : sup,
      ),
    }));
  }

  function addLoad() {
    if (state.loads.length >= CAP) return;
    const barId = state.bars[0]?.id ?? "b1";
    setState((s) => ({
      ...s,
      loads: [
        ...s.loads,
        {
          id: newId("L"),
          barId,
          kind: "point",
          D: 0,
          L: 0,
          angle: 0,
          a: 0,
        },
      ],
    }));
  }
  function removeLoad(id: string) {
    setState((s) => ({
      ...s,
      loads: s.loads.filter((l) => l.id !== id),
    }));
  }
  function patchLoad(
    id: string,
    patch: Partial<{
      barId: string;
      kind: PorticoBarLoad["kind"];
      D: number;
      L: number;
      angle: number;
      a: number;
      b?: number;
    }>,
  ) {
    setState((s) => ({
      ...s,
      loads: s.loads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }

  // ---- Acciones de alto nivel ----

  function handleNueva() {
    // R-portico-nueva-shared: confirm antes de limpiar.
    if (
      window.confirm(
        "¿Limpiar el pórtico y volver al ejemplo precargado (3 nudos, 2 barras, 1 carga)?",
      )
    ) {
      setState(createDefaultPorticoState());
      setLoadedSaveId(null);
      setLoadedSaveName(null);
      setError(null);
    }
  }

  function handleSubmit() {
    try {
      validatePorticoState(state);
    } catch (err: unknown) {
      if (err instanceof PorticoValidationError) {
        setError(err.issues.join("; "));
        return;
      }
      throw err;
    }
    setError(null);
    navigate("/viga-continua-results", {
      state: {
        mode: "portico",
        state,
      },
    });
  }

  function handleSave() {
    // [R-portico-persistence + BasesForm-bug-free] Branch on loadedSaveId:
    // first-save prompts and sets BOTH setters; re-save updates silently.
    if (loadedSaveId) {
      // Already editing a saved pórtico — overwrite the same record. Do NOT
      // re-prompt; the user has already named this pórtico. Renames go
      // through SavedBeams → Eliminar + a fresh save.
      try {
        const name = loadedSaveName ?? "Sin nombre";
        updatePorticoInput(loadedSaveId, { name, input: state });
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Error al guardar");
      }
      return;
    }

    const name = prompt("Nombre para guardar este pórtico:");
    if (!name) return;
    try {
      const saved = savePorticoInput({ name, input: state });
      setLoadedSaveId(saved.id);
      setLoadedSaveName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  // ---- Helpers de render ----

  const nodeOptions = (): Array<{ value: string; label: string }> =>
    state.nodes.map((n) => ({
      value: n.id,
      label: n.id,
    }));

  const barOptions = (): Array<{ value: string; label: string }> =>
    state.bars.map((b) => ({
      value: b.id,
      label: b.id,
    }));

  const valid =
    state.nodes.length >= 2 &&
    state.bars.length >= 1 &&
    state.supports.length >= 1;

  return (
    <MainLayout>
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 21V8l9-6 9 6v13M9 21V12h6v9"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-text">Pórtico</h1>
          <p className="text-sm text-text-muted">
            {loadedSaveId && loadedSaveName
              ? `Pórtico — ${loadedSaveName}`
              : "Pórtico sin guardar"}
            {" · Y positivo hacia abajo"}
          </p>
        </div>
      </header>

      <p className="text-xs text-text-muted">
        Solver 2-D por método de rigidez directa. Los inputs E, A, I son
        placeholders no-diseño (E=1, A=1e-2, I=1e-4); el cap UX es 5 por
        colección.
      </p>

      {/* Nodos */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Nodos ({state.nodes.length}/{CAP})
          </h2>
          <button
            type="button"
            onClick={addNode}
            disabled={state.nodes.length >= CAP}
            className="text-sm bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1 rounded"
          >
            + Nodo
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {state.nodes.map((n) => (
            <div
              key={n.id}
              className="flex flex-wrap items-end gap-2 p-2 bg-surface-alt rounded-lg"
            >
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">ID</span>
                <input
                  type="text"
                  value={n.id}
                  onChange={(e) => setNodeId(n.id, e.target.value)}
                  className="w-20 px-2 py-1 text-sm bg-surface border border-border rounded"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">x (m)</span>
                <DecimalInput
                  value={n.x}
                  onChange={(v) => patchNode(n.id, { x: v })}
                  className="w-20"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">y (m, ↓)</span>
                <DecimalInput
                  value={n.y}
                  onChange={(v) => patchNode(n.id, { y: v })}
                  className="w-20"
                />
              </label>
              <button
                type="button"
                onClick={() => removeNode(n.id)}
                disabled={state.nodes.length <= 2}
                className="ml-auto text-danger hover:bg-danger/10 border-danger/20 text-sm px-2 py-1 rounded disabled:opacity-40"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Barras */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Barras ({state.bars.length}/{CAP})
          </h2>
          <button
            type="button"
            onClick={addBar}
            disabled={state.bars.length >= CAP || state.nodes.length < 2}
            className="text-sm bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1 rounded"
          >
            + Barra
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {state.bars.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-end gap-2 p-2 bg-surface-alt rounded-lg"
            >
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">ID</span>
                <input
                  type="text"
                  value={b.id}
                  readOnly
                  className="w-20 px-2 py-1 text-sm bg-surface border border-border rounded text-text-muted"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">desde</span>
                <select
                  value={b.fromNodeId}
                  onChange={(e) =>
                    patchBar(b.id, { fromNodeId: e.target.value })
                  }
                  className="w-20 px-1 py-1 text-sm bg-surface border border-border rounded"
                >
                  {nodeOptions().map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">hasta</span>
                <select
                  value={b.toNodeId}
                  onChange={(e) => patchBar(b.id, { toNodeId: e.target.value })}
                  className="w-20 px-1 py-1 text-sm bg-surface border border-border rounded"
                >
                  {nodeOptions().map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">E</span>
                <DecimalInput
                  value={b.E}
                  onChange={(v) => patchBar(b.id, { E: v })}
                  className="w-16"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">A (m²)</span>
                <DecimalInput
                  value={b.A}
                  onChange={(v) => patchBar(b.id, { A: v })}
                  className="w-20"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">I (m⁴)</span>
                <DecimalInput
                  value={b.I}
                  onChange={(v) => patchBar(b.id, { I: v })}
                  className="w-20"
                />
              </label>
              <button
                type="button"
                onClick={() => removeBar(b.id)}
                disabled={state.bars.length <= 1}
                className="ml-auto text-danger hover:bg-danger/10 border-danger/20 text-sm px-2 py-1 rounded disabled:opacity-40"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Apoyos */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Apoyos ({state.supports.length}/{CAP})
          </h2>
          <button
            type="button"
            onClick={addSupport}
            disabled={state.supports.length >= CAP || state.nodes.length < 1}
            className="text-sm bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1 rounded"
          >
            + Apoyo
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {state.supports.map((sup) => (
            <div
              key={sup.id}
              className="flex flex-wrap items-end gap-2 p-2 bg-surface-alt rounded-lg"
            >
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">Nudo</span>
                <select
                  value={sup.nodeId}
                  onChange={(e) =>
                    patchSupport(sup.id, { nodeId: e.target.value })
                  }
                  className="w-20 px-1 py-1 text-sm bg-surface border border-border rounded"
                >
                  {nodeOptions().map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">Tipo</span>
                <select
                  value={sup.kind}
                  onChange={(e) =>
                    patchSupport(sup.id, {
                      kind: e.target.value as PorticoSupportKind,
                    })
                  }
                  className="w-28 px-1 py-1 text-sm bg-surface border border-border rounded"
                >
                  <option value="hinge">Articulado</option>
                  <option value="fixed">Empotrado</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => removeSupport(sup.id)}
                disabled={state.supports.length <= 1}
                className="ml-auto text-danger hover:bg-danger/10 border-danger/20 text-sm px-2 py-1 rounded disabled:opacity-40"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Cargas */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Cargas ({state.loads.length}/{CAP})
          </h2>
          <button
            type="button"
            onClick={addLoad}
            disabled={state.loads.length >= CAP || state.bars.length < 1}
            className="text-sm bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1 rounded"
          >
            + Carga
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {state.loads.map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-end gap-2 p-2 bg-surface-alt rounded-lg"
            >
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">Barra</span>
                <select
                  value={l.barId}
                  onChange={(e) => patchLoad(l.id, { barId: e.target.value })}
                  className="w-20 px-1 py-1 text-sm bg-surface border border-border rounded"
                >
                  {barOptions().map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">Tipo</span>
                <select
                  value={l.kind}
                  onChange={(e) =>
                    patchLoad(l.id, {
                      kind: e.target.value as PorticoBarLoad["kind"],
                    })
                  }
                  className="w-24 px-1 py-1 text-sm bg-surface border border-border rounded"
                >
                  <option value="point">Puntual</option>
                  <option value="distributed">Distribuida</option>
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">
                  D {l.kind === "distributed" ? "(kN/m)" : "(kN)"}
                </span>
                <DecimalInput
                  value={l.D}
                  onChange={(v) => patchLoad(l.id, { D: v })}
                  className="w-16"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">
                  L {l.kind === "distributed" ? "(kN/m)" : "(kN)"}
                </span>
                <DecimalInput
                  value={l.L}
                  onChange={(v) => patchLoad(l.id, { L: v })}
                  className="w-16"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">angle°</span>
                <DecimalInput
                  value={l.angle}
                  onChange={(v) => patchLoad(l.id, { angle: v })}
                  className="w-16"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">a (m)</span>
                <DecimalInput
                  value={l.a}
                  onChange={(v) => patchLoad(l.id, { a: v })}
                  className="w-16"
                />
              </label>
              {l.kind === "distributed" && (
                <label className="flex flex-col gap-0.5">
                  <span className="text-xs text-text-muted">b (m)</span>
                  <DecimalInput
                    value={l.b ?? l.a}
                    onChange={(v) => patchLoad(l.id, { b: v })}
                    className="w-16"
                  />
                </label>
              )}
              <button
                type="button"
                onClick={() => removeLoad(l.id)}
                className="ml-auto text-danger hover:bg-danger/10 border-danger/20 text-sm px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* SavedBeams (pórticos guardados) */}
      <SavedBeams
        app="concrete"
        type="portico"
        label="Pórticos guardados"
        onLoad={(data, save) => {
          const input = (data as { input?: unknown }).input as
            | PorticoState
            | undefined;
          if (!input || !Array.isArray(input.nodes)) return;
          setLoadedSaveId(save.id);
          setLoadedSaveName(save.name);
          setState({
            nodes: input.nodes.map((n) => ({ ...n })),
            bars: input.bars.map((b) => ({ ...b })),
            loads: input.loads.map((l) => ({ ...l })),
            supports: input.supports.map((s) => ({ ...s })),
          });
        }}
      />

      {error && (
        <section className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-xl p-4">
          {error}
        </section>
      )}

      {/* Botones de acción */}
      <div className="self-center flex gap-3">
        <button
          type="button"
          onClick={handleNueva}
          className="bg-surface-alt text-text border border-border hover:bg-surface px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Nueva
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!valid}
          className="bg-primary text-white font-semibold px-8 py-3 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
        >
          Calcular
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="bg-surface-alt border border-border text-text-muted font-semibold px-6 py-3 rounded-lg hover:bg-surface transition-colors"
        >
          {loadedSaveId ? "Guardar corrección" : "Guardar"}
        </button>
      </div>

      {loadedSaveId && (
        <p className="text-xs text-text-muted text-center">
          Editando "{loadedSaveName}" — Guardar actualiza este registro.
        </p>
      )}
    </MainLayout>
  );
}
