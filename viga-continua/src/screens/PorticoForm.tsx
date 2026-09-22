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

import { useEffect, useRef, useState } from "react";
import ScreenHeader from "../components/ScreenHeader";
import { useLocation, useNavigate } from "react-router";
import { DecimalInput, MainLayout, SavedBeams } from "@mascalculador/shared";
import PorticoDiagram from "../components/PorticoDiagram";
import {
  getSavedPorticoInputs,
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
import { registerAssistantForm } from "../lib/assistant/form-bus";
import type {
  PorticoState,
  PorticoNode,
  PorticoBar,
  PorticoBarLoad,
  PorticoSupportKind,
} from "../lib/portico";

const CAP = 5;

interface PorticoNavState {
  mode: "portico";
  state: PorticoState;
  loadedSaveId?: string;
  loadedSaveName?: string;
}

function isPorticoNavState(value: unknown): value is PorticoNavState {
  return (
    value !== null &&
    typeof value === "object" &&
    "mode" in value &&
    (value as { mode: unknown }).mode === "portico" &&
    "state" in value
  );
}

function clonePorticoState(value: {
  readonly nodes: ReadonlyArray<PorticoState["nodes"][number]>;
  readonly bars: ReadonlyArray<PorticoState["bars"][number]>;
  readonly loads: ReadonlyArray<PorticoState["loads"][number]>;
  readonly supports: ReadonlyArray<PorticoState["supports"][number]>;
}): PorticoState {
  return {
    nodes: value.nodes.map((node) => ({ ...node })),
    bars: value.bars.map((bar) => ({ ...bar })),
    loads: value.loads.map((load) => ({ ...load })),
    supports: value.supports.map((support) => ({ ...support })),
  };
}

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PorticoForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = isPorticoNavState(location.state)
    ? location.state
    : null;

  // Hidratación: del último estado si existe; si no, defaults.
  // El helper `loadLastPorticoFormState` devuelve el tipo readonly de
  // shared/ — clonamos superficial para soltar la inmutabilidad y poder
  // mutar en setState (las forms usan Set/Patch en vez de inmutabilidad
  // estricta por ergonomía).
  const [lastForm] = useState(() => loadLastPorticoFormState());
  const [state, setState] = useState<PorticoState>(() => {
    if (navigationState) return clonePorticoState(navigationState.state);
    const last = lastForm;
    if (last && Array.isArray(last.nodes) && last.nodes.length > 0) {
      return clonePorticoState(last);
    }
    return createDefaultPorticoState();
  });

  const [loadedSaveId, setLoadedSaveId] = useState<string | null>(
    navigationState?.loadedSaveId ?? lastForm?.loadedSaveId ?? null,
  );
  const [loadedSaveName, setLoadedSaveName] = useState<string | null>(
    navigationState?.loadedSaveName ?? lastForm?.loadedSaveName ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  // Auto-persist (silencioso si no hay localStorage).
  useEffect(() => {
    saveLastPorticoFormState(state, { loadedSaveId, loadedSaveName });
  }, [state, loadedSaveId, loadedSaveName]);

  // ---- Asistente virtual: estado y edición asistida del pórtico ----
  const assistantStateRef = useRef<Record<string, unknown>>({});
  useEffect(() => {
    assistantStateRef.current = {
      nodes: state.nodes,
      bars: state.bars,
      loads: state.loads,
      supports: state.supports,
      loadedSaveId,
      loadedSaveName: loadedSaveName ?? null,
    };
  });

  useEffect(() => {
    const num = (v: unknown): number | null => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") {
        const parsed = Number(v.trim().replace(",", "."));
        if (Number.isFinite(parsed)) return parsed;
      }
      return null;
    };
    const makeId = (prefix: string): string =>
      `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
    const mapSupport = (v: unknown): PorticoSupportKind | null => {
      const key = String(v).trim().toLowerCase();
      if (key === "hinge" || key === "articulado" || key === "apoyado") {
        return "hinge";
      }
      if (key === "fixed" || key === "empotrado" || key === "encastrado") {
        return "fixed";
      }
      return null;
    };
    const mapLoadKind = (v: unknown): PorticoBarLoad["kind"] | null => {
      const key = String(v).trim().toLowerCase();
      if (key === "point" || key === "puntual") return "point";
      if (key === "distributed" || key === "distribuida") return "distributed";
      return null;
    };
    const controller = {
      title: "Pórtico",
      fieldDocs: `Campos (nombres exactos, unidades de UI):
- nodes: array de nudos {id, x, y} (x e y en metros; el eje +y apunta hacia ABAJO). Mínimo 2, máximo 5.
- bars: array de barras {id, fromNodeId, toNodeId, E, A_cm2, I_cm4}. E en MPa; A se da en cm² (se guarda como m²) e I en cm⁴ (se guarda como m⁴). También se aceptan A e I directamente en m² y m⁴.
- supports: array de apoyos {nodeId, kind}; kind "hinge"/"articulado" (fija traslaciones) o "fixed"/"empotrado" (fija además la rotación).
- loads: array de cargas sobre barra {barId, kind, D, L, angle, a, b?}. kind "point"/"puntual" (kN, posición a en m) o "distributed"/"distribuida" (kN/m entre a y b). angle en grados (0° = +x, 90° = +y = abajo). D=muerta, L=viva.`,
      getState: () => {
        const s = assistantStateRef.current;
        return {
          nodes: s.nodes,
          bars: (s.bars as PorticoBar[]).map((b) => ({
            id: b.id,
            fromNodeId: b.fromNodeId,
            toNodeId: b.toNodeId,
            E: b.E,
            A_cm2: b.A * 1e4,
            I_cm4: b.I * 1e8,
          })),
          loads: s.loads,
          supports: s.supports,
          loadedSaveId: s.loadedSaveId,
          loadedSaveName: s.loadedSaveName,
        };
      },
      apply: (values: Record<string, unknown>) => {
        const applied: string[] = [];
        const errors: string[] = [];

        for (const [key, raw] of Object.entries(values)) {
          switch (key) {
            case "nodes": {
              if (!Array.isArray(raw) || raw.length < 2 || raw.length > CAP) {
                errors.push(`nodes: array de 2 a ${CAP} nudos {id, x, y}`);
                break;
              }
              const nodes: PorticoNode[] = [];
              let ok = true;
              for (const item of raw as unknown[]) {
                if (!item || typeof item !== "object") {
                  ok = false;
                  break;
                }
                const o = item as Record<string, unknown>;
                const id =
                  typeof o.id === "string" && o.id.trim() ? o.id.trim() : "";
                const x = num(o.x);
                const y = num(o.y);
                if (!id || x === null || y === null) {
                  ok = false;
                  break;
                }
                nodes.push({ id, x, y });
              }
              if (!ok) {
                errors.push("nodes: cada nudo debe ser {id, x, y} (m)");
                break;
              }
              setState((s) => ({ ...s, nodes }));
              applied.push("nodes");
              break;
            }
            case "bars": {
              if (!Array.isArray(raw) || raw.length < 1 || raw.length > CAP) {
                errors.push(`bars: array de 1 a ${CAP} barras`);
                break;
              }
              const bars: PorticoBar[] = [];
              let ok = true;
              for (const item of raw as unknown[]) {
                if (!item || typeof item !== "object") {
                  ok = false;
                  break;
                }
                const o = item as Record<string, unknown>;
                const id =
                  typeof o.id === "string" && o.id.trim() ? o.id.trim() : "";
                const fromNodeId =
                  typeof o.fromNodeId === "string" ? o.fromNodeId : "";
                const toNodeId =
                  typeof o.toNodeId === "string" ? o.toNodeId : "";
                const E = num(o.E) ?? 1;
                const hasAcm2 = o.A_cm2 != null;
                const aRaw = num(hasAcm2 ? o.A_cm2 : o.A);
                const A = aRaw === null ? null : aRaw / (hasAcm2 ? 1e4 : 1);
                const hasIcm4 = o.I_cm4 != null;
                const iRaw = num(hasIcm4 ? o.I_cm4 : o.I);
                const I = iRaw === null ? null : iRaw / (hasIcm4 ? 1e8 : 1);
                if (
                  !id ||
                  !fromNodeId ||
                  !toNodeId ||
                  A === null ||
                  I === null
                ) {
                  ok = false;
                  break;
                }
                bars.push({ id, fromNodeId, toNodeId, E, A, I });
              }
              if (!ok) {
                errors.push(
                  "bars: cada barra debe ser {id, fromNodeId, toNodeId, E, A_cm2, I_cm4}",
                );
                break;
              }
              setState((s) => ({ ...s, bars }));
              applied.push("bars");
              break;
            }
            case "supports": {
              if (!Array.isArray(raw) || raw.length > CAP) {
                errors.push(`supports: array de hasta ${CAP} apoyos`);
                break;
              }
              const supports: Array<{
                id: string;
                nodeId: string;
                kind: PorticoSupportKind;
              }> = [];
              let ok = true;
              for (const item of raw as unknown[]) {
                if (!item || typeof item !== "object") {
                  ok = false;
                  break;
                }
                const o = item as Record<string, unknown>;
                const nodeId = typeof o.nodeId === "string" ? o.nodeId : "";
                const kind = mapSupport(o.kind);
                if (!nodeId || !kind) {
                  ok = false;
                  break;
                }
                supports.push({
                  id:
                    typeof o.id === "string" && o.id.trim()
                      ? o.id.trim()
                      : makeId("Sup"),
                  nodeId,
                  kind,
                });
              }
              if (!ok) {
                errors.push(
                  'supports: cada apoyo debe ser {nodeId, kind} con kind "hinge" o "fixed"',
                );
                break;
              }
              if (supports.length > 0 || raw.length === 0) {
                setState((s) => ({ ...s, supports }));
                applied.push("supports");
              }
              break;
            }
            case "loads": {
              if (!Array.isArray(raw) || raw.length > CAP) {
                errors.push(`loads: array de hasta ${CAP} cargas`);
                break;
              }
              const loads: PorticoBarLoad[] = [];
              let ok = true;
              for (const item of raw as unknown[]) {
                if (!item || typeof item !== "object") {
                  ok = false;
                  break;
                }
                const o = item as Record<string, unknown>;
                const barId = typeof o.barId === "string" ? o.barId : "";
                const kind = mapLoadKind(o.kind);
                const D = num(o.D) ?? 0;
                const L = num(o.L) ?? 0;
                const angle = num(o.angle) ?? 0;
                const a = num(o.a) ?? 0;
                if (!barId || !kind) {
                  ok = false;
                  break;
                }
                const load: PorticoBarLoad = {
                  id:
                    typeof o.id === "string" && o.id.trim()
                      ? o.id.trim()
                      : makeId("L"),
                  barId,
                  kind,
                  D,
                  L,
                  angle,
                  a,
                };
                if (kind === "distributed") {
                  load.b = num(o.b) ?? a;
                }
                loads.push(load);
              }
              if (!ok) {
                errors.push(
                  "loads: cada carga debe ser {barId, kind, D, L, angle, a, b?}",
                );
                break;
              }
              setState((s) => ({ ...s, loads }));
              applied.push("loads");
              break;
            }
            default:
              errors.push(`campo desconocido: ${key}`);
          }
        }
        return { applied, errors };
      },
      save: async ({ name }: { name: string }) => {
        const trimmed = name.trim();
        if (!trimmed) return { applied: [], errors: ["se requiere un nombre"] };
        const s = assistantStateRef.current;
        const input: PorticoState = {
          nodes: s.nodes as PorticoState["nodes"],
          bars: s.bars as PorticoState["bars"],
          loads: s.loads as PorticoState["loads"],
          supports: s.supports as PorticoState["supports"],
        };
        try {
          if (s.loadedSaveId) {
            updatePorticoInput(s.loadedSaveId as string, {
              name:
                typeof s.loadedSaveName === "string"
                  ? s.loadedSaveName
                  : trimmed,
              input,
            });
            return {
              applied: [`guardado actualizado: ${s.loadedSaveName ?? ""}`],
              errors: [],
            };
          }
          const saved = savePorticoInput({ name: trimmed, input });
          setLoadedSaveId(saved.id);
          setLoadedSaveName(trimmed);
          return {
            applied: [`guardado como "${trimmed}"`],
            errors: [],
          };
        } catch (err) {
          return {
            applied: [],
            errors: [err instanceof Error ? err.message : "error al guardar"],
          };
        }
      },
    };
    const cleanupModeQuery = registerAssistantForm({
      screen: "/?mode=portico",
      ...controller,
    });
    const cleanupNamedQuery = registerAssistantForm({
      screen: "/viga-continua?mode=portico",
      ...controller,
    });
    return () => {
      cleanupModeQuery();
      cleanupNamedQuery();
    };
  }, []);

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
  function setBarId(oldId: string, newId: string): boolean {
    const trimmedId = newId.trim();
    if (!trimmedId) {
      setError("El ID de la barra no puede estar vacío");
      return false;
    }
    if (state.bars.some((b) => b.id === trimmedId && b.id !== oldId)) {
      setError(`ID de barra "${trimmedId}" ya existe`);
      return false;
    }
    setError(null);
    if (trimmedId === oldId) return true;
    setState((s) => ({
      ...s,
      bars: s.bars.map((b) => (b.id === oldId ? { ...b, id: trimmedId } : b)),
      loads: s.loads.map((l) =>
        l.barId === oldId ? { ...l, barId: trimmedId } : l,
      ),
    }));
    return true;
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
        loadedSaveId: loadedSaveId ?? undefined,
        loadedSaveName: loadedSaveName ?? undefined,
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

  // [R-portico-save-number] Stable ordinal for the saved pórtico: 1-based
  // index in the saved list (chronological order). Recomputed each render so
  // that deleting or adding other pórticos reorders this one correctly.
  const porticoNumber = loadedSaveId
    ? getSavedPorticoInputs().findIndex((s) => s.id === loadedSaveId) + 1
    : null;

  return (
    <MainLayout>
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          // Enter exits the field being edited instead of submitting.
          const target = e.target as HTMLElement;
          if (
            e.key === "Enter" &&
            target &&
            (target.tagName === "INPUT" ||
              target.tagName === "SELECT" ||
              target.tagName === "TEXTAREA")
          ) {
            e.preventDefault();
            target.blur();
          }
        }}
      >
        <ScreenHeader
          title="Pórtico"
          subtitle="CIRSOC 201 · Análisis de pórticos"
          badge={
            porticoNumber != null && loadedSaveName
              ? {
                  label: `Pórtico #${porticoNumber} — ${loadedSaveName}`,
                  tone: "saved",
                }
              : { label: "Pórtico sin guardar", tone: "unsaved" }
          }
        />

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

        {/* Nodos */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title">
                Nodos ({state.nodes.length}/{CAP})
              </h2>
              <p className="mt-1 text-xs text-text-muted">
                Sistema global: +x hacia la derecha, +y hacia abajo.
              </p>
            </div>
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
            <h2 className="section-title">
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
                    defaultValue={b.id}
                    onBlur={(e) => {
                      if (!setBarId(b.id, e.currentTarget.value)) {
                        e.currentTarget.value = b.id;
                      }
                    }}
                    onKeyDown={(e) => {
                      // Commit the new ID before the form submits on Enter.
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
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
                    onChange={(e) =>
                      patchBar(b.id, { toNodeId: e.target.value })
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
                  <span className="text-xs text-text-muted">E</span>
                  <DecimalInput
                    value={b.E}
                    onChange={(v) => patchBar(b.id, { E: v })}
                    className="w-16"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-xs text-text-muted">A (cm²)</span>
                  <DecimalInput
                    value={b.A * 1e4}
                    onChange={(v) => patchBar(b.id, { A: v / 1e4 })}
                    className="w-20"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-xs text-text-muted">I (cm⁴)</span>
                  <DecimalInput
                    value={b.I * 1e8}
                    onChange={(v) => patchBar(b.id, { I: v / 1e8 })}
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
            <h2 className="section-title">
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
            <h2 className="section-title">
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
          <figure className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-surface-alt px-3 py-2 text-xs text-text-muted">
            <svg
              aria-hidden="true"
              className="h-20 w-56 shrink-0"
              viewBox="0 0 280 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M34 62H224" stroke="currentColor" strokeWidth="2" />
              <path d="M224 62L216 58V66L224 62Z" fill="currentColor" />
              <path d="M34 62V92" stroke="currentColor" strokeWidth="2" />
              <path d="M34 92L30 84H38L34 92Z" fill="currentColor" />
              <path
                d="M58 62A24 24 0 0 1 34 86"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M34 62H128"
                stroke="currentColor"
                strokeDasharray="3 3"
                opacity="0.55"
              />
              <path d="M34 76H128" stroke="currentColor" strokeWidth="1" />
              <path
                d="M34 72L34 80M128 72L128 80"
                stroke="currentColor"
                strokeWidth="1"
              />
              <text x="138" y="66" fill="currentColor" fontSize="11">
                +x global
              </text>
              <text x="40" y="94" fill="currentColor" fontSize="11">
                +y global
              </text>
              <text x="42" y="78" fill="currentColor" fontSize="11">
                θ
              </text>
              <text x="72" y="91" fill="currentColor" fontSize="11">
                a desde inicio
              </text>
              <text x="28" y="76" fill="currentColor" fontSize="10">
                inicio
              </text>
            </svg>
            <figcaption>
              Ángulo medido desde el sistema global: 0° hacia +x, 90° hacia +y
              (abajo). La distancia <em>a</em> se mide localmente desde el
              inicio de la barra.
            </figcaption>
          </figure>
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
            disabled={!valid}
            onClick={handleSubmit}
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

        {/* Preview de geometría en tiempo real (mientras se edita). */}
        <section className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Vista previa — geometría
            </h3>
          </div>
          <div className="p-1">
            <PorticoDiagram
              porticoState={state}
              mode="geometria"
              height={360}
            />
          </div>
        </section>
      </form>
    </MainLayout>
  );
}
