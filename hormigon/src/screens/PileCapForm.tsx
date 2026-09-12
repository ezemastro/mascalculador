// Módulo admin "Cabezal sobre pilotes": diseño por bielas y tirantes del
// cabezal apoyado en 2 o 3 pilotes (rectangular, 3 en línea o triangular).
// Complementa al módulo "Vigas de fundación para cabezales", que dimensiona
// sólo la viga. Los guardados usan el tipo propio "pilecap".
import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { MainLayout, SavedBeams } from "@mascalculador/shared";
import {
  saveBeam,
  updateSave,
  getSavedBeams,
  deleteSave,
  listSaves,
  loadLastPileCapFormState,
  saveLastPileCapFormState,
  type PileCapFormState,
} from "../lib/storage";
import { pickObraIfNeeded } from "../components/ObraPicker";
import ScreenHeader from "../components/ScreenHeader";
import PileCapDiagram from "../components/PileCapDiagram";

function handleCommaKey(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === ",") {
    e.preventDefault();
    const input = e.currentTarget;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    input.value =
      input.value.substring(0, start) + "." + input.value.substring(end);
    input.setSelectionRange(start + 1, start + 1);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

/** Extract PD, PL, cx, cy from rc-columna saves with defensive typeof checks. */
function getSavedColumns(): Array<{
  id: string;
  name: string;
  PD: number;
  PL: number;
  cx: number;
  cy: number;
}> {
  return listSaves()
    .filter((s) => (s.type as string) === "rc-columna")
    .map((s) => {
      const d = s.data as Record<string, unknown>;
      return {
        id: s.id,
        name: s.name,
        PD: typeof d.PD === "number" ? d.PD : 0,
        PL: typeof d.PL === "number" ? d.PL : 0,
        cx: typeof d.cx === "number" ? d.cx : 0,
        cy: typeof d.cy === "number" ? d.cy : 0,
      };
    });
}

const initialState: PileCapFormState = {
  PD: 500,
  PL: 300,
  Qp: 500,
  nPilotes: 2,
  tipo: "rect2",
  cx: 30,
  cy: 30,
  Dp: 35,
  s: 120,
  Lx: 190,
  Ly: 80,
  lado: 290,
  h: 80,
  fc: 25,
  fy: 420,
  cover: 7,
};

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3">
        <span className="h-4 w-1 rounded-full bg-brand" />
        <h2 className="font-display text-sm font-semibold text-text">
          {title}
        </h2>
        {hint ? (
          <span className="ml-auto text-[11px] text-text-muted">{hint}</span>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-xs font-medium text-text-muted">{label}</span>
      {children}
      {hint ? (
        <span className="text-[11px] leading-snug text-text-muted/80">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export default function PileCapForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as
    | (PileCapFormState & {
        loadedSaveId?: string | null;
        loadedSaveName?: string | null;
      })
    | null;

  const [state, setState] = useState<PileCapFormState>(() => {
    if (locationState) {
      return {
        ...locationState,
        loadedSaveId: undefined,
        loadedSaveName: undefined,
      } as PileCapFormState;
    }
    return loadLastPileCapFormState() ?? initialState;
  });

  const [loadedSaveId, setLoadedSaveId] = useState<string | null>(
    locationState?.loadedSaveId ?? null,
  );
  const [loadedSaveName, setLoadedSaveName] = useState<string | null>(
    locationState?.loadedSaveName ?? null,
  );
  const [columnId, setColumnId] = useState<string | null>(
    locationState?.columnId ?? null,
  );
  const [columnName, setColumnName] = useState<string | null>(
    locationState?.columnName ?? null,
  );

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    saveLastPileCapFormState({
      ...state,
      columnId: columnId ?? undefined,
      columnName: columnName ?? undefined,
    });
  }, [state, columnId, columnName]);

  const savedColumns = useMemo(() => getSavedColumns(), []);

  function handleLoadColumn(id: string) {
    const col = savedColumns.find((c) => c.id === id);
    if (!col) return;
    setState((prev) => ({
      ...prev,
      PD: col.PD || prev.PD,
      PL: col.PL || prev.PL,
      cx: col.cx || prev.cx,
      cy: col.cy || prev.cy,
    }));
    setColumnId(col.id);
    setColumnName(col.name);
  }

  function buildData(): Record<string, unknown> {
    return {
      ...state,
      columnId: columnId ?? undefined,
      columnName: columnName ?? undefined,
    };
  }

  async function handleSave() {
    const data = buildData();
    if (loadedSaveId) {
      updateSave(loadedSaveId, data);
      return;
    }
    const name = prompt("Nombre del cabezal:");
    if (!name) return;
    const target = await pickObraIfNeeded();
    if (target === null) return;
    try {
      const saved = saveBeam(name, "pilecap", data, target);
      setLoadedSaveId(saved.id);
      setLoadedSaveName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  function handleLoad(
    data: Record<string, unknown>,
    save: { id: string; name: string },
  ) {
    setLoadedSaveId(save.id);
    setLoadedSaveName(save.name);
    const d = data as Record<string, unknown>;
    const f = (d.input && typeof d.input === "object" ? d.input : d) as Record<
      string,
      unknown
    >;
    setState((prev) => {
      const next = { ...prev };
      const nums = [
        "PD",
        "PL",
        "Qp",
        "cx",
        "cy",
        "Dp",
        "s",
        "Lx",
        "Ly",
        "lado",
        "h",
        "fc",
        "fy",
        "cover",
      ] as const;
      for (const k of nums) {
        if (typeof f[k] === "number") next[k] = f[k] as never;
      }
      if (f.nPilotes === 2 || f.nPilotes === 3) next.nPilotes = f.nPilotes;
      if (f.tipo === "rect2" || f.tipo === "linea3" || f.tipo === "triangulo") {
        next.tipo = f.tipo;
      }
      if (typeof f.columnId === "string") setColumnId(f.columnId);
      if (typeof f.columnName === "string") setColumnName(f.columnName);
      return next;
    });
  }

  function handleNew() {
    setState(initialState);
    setLoadedSaveId(null);
    setLoadedSaveName(null);
    setColumnId(null);
    setColumnName(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(state.PD > 0 || state.PL > 0) || !state.Qp) {
      alert(
        "Completá las cargas de columna (PD, PL) y la capacidad del pilote (Qp).",
      );
      return;
    }
    if (!state.Dp || !state.s || !state.cx || !state.cy) {
      alert(
        "Completá el diámetro y separación de pilotes y las dimensiones de la columna.",
      );
      return;
    }
    if (state.tipo === "triangulo" && !state.lado) {
      alert("Completá el lado del cabezal triangular.");
      return;
    }
    if (state.tipo !== "triangulo" && (!state.Lx || !state.Ly)) {
      alert("Completá las dimensiones en planta del cabezal (Lx y Ly).");
      return;
    }
    if (!state.h) {
      alert("Completá la altura del cabezal.");
      return;
    }
    navigate("/cabezal-pilotes-results", {
      state: {
        input: buildData(),
        loadedSaveId: loadedSaveId ?? undefined,
        loadedSaveName: loadedSaveName ?? undefined,
      },
    });
  }

  const previewL1 =
    state.tipo === "triangulo" ? (state.lado ?? 0) : (state.Lx ?? 0);
  const previewL2 =
    state.tipo === "triangulo" ? (state.lado ?? 0) : (state.Ly ?? 0);
  const previewD = (state.h ?? 0) - (state.cover ?? 7) - 2.5;

  return (
    <MainLayout>
      <div className="flex flex-col gap-6">
        <ScreenHeader
          title="Cabezal sobre pilotes"
          subtitle={
            <>
              <span>CIRSOC 201 · Bielas y tirantes</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium">
                Módulo interno
              </span>
            </>
          }
          badge={
            loadedSaveName
              ? { label: loadedSaveName, tone: "saved" }
              : { label: "Sin guardar", tone: "unsaved" }
          }
          actions={
            <>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover active:translate-y-px dark:text-[#241a10]"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={handleNew}
                className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-text-muted transition-colors hover:bg-surface-alt hover:text-text active:translate-y-px"
              >
                + Nueva
              </button>
            </>
          }
        />

        <SavedBeams
          app="concrete"
          type="pilecap"
          listSaves={() => getSavedBeams("pilecap")}
          deleteSave={(id) => deleteSave(id)}
          onLoad={handleLoad}
          label="Cabezales guardados"
        />

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <form
            id="pilecap-form"
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const target = e.target as HTMLElement;
                if (
                  target.tagName === "INPUT" &&
                  typeof target.blur === "function"
                ) {
                  target.blur();
                }
              }
            }}
            className="flex flex-col gap-5"
          >
            {/* ── Materiales ────────────────────────────────────── */}
            <Section title="Materiales">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field
                  label={
                    <>
                      f'<sub>c</sub> (MPa)
                    </>
                  }
                >
                  <select
                    value={state.fc}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        fc: Number(e.target.value),
                      }))
                    }
                  >
                    <option value={20}>20 (H-20)</option>
                    <option value={25}>25 (H-25)</option>
                    <option value={30}>30 (H-30)</option>
                    <option value={35}>35 (H-35)</option>
                    <option value={40}>40 (H-40)</option>
                  </select>
                </Field>
                <Field
                  label={
                    <>
                      f<sub>y</sub> (MPa)
                    </>
                  }
                >
                  <select
                    value={state.fy}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        fy: Number(e.target.value),
                      }))
                    }
                  >
                    <option value={420}>420 (ADN 420)</option>
                    <option value={500}>500 (ADN 500)</option>
                  </select>
                </Field>
                <Field label="Recubrimiento (cm)">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={state.cover ?? 7}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        cover: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      }))
                    }
                  />
                </Field>
              </div>
            </Section>

            {/* ── Cargas y columna ──────────────────────────────── */}
            <Section title="Cargas y columna">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Columna guardada"
                  className="sm:col-span-2 lg:col-span-4"
                  hint={
                    columnName ? (
                      <span className="font-medium text-brand">
                        Cargada: {columnName}
                      </span>
                    ) : (
                      "Opcional: trae PD, PL, cx y cy de una columna calculada."
                    )
                  }
                >
                  <select
                    className="w-full"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) handleLoadColumn(e.target.value);
                    }}
                  >
                    <option value="" disabled>
                      {savedColumns.length === 0
                        ? "No hay columnas guardadas"
                        : "Seleccionar columna guardada..."}
                    </option>
                    {savedColumns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — P<sub>D</sub>={c.PD.toFixed(2)}, P
                        <sub>L</sub>={c.PL.toFixed(2)} kN, {c.cx}×{c.cy} cm
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={
                    <>
                      P<sub>D</sub> (kN)
                    </>
                  }
                >
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={state.PD || ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        PD: Number(e.target.value),
                      }))
                    }
                  />
                </Field>
                <Field
                  label={
                    <>
                      P<sub>L</sub> (kN)
                    </>
                  }
                >
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={state.PL || ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        PL: Number(e.target.value),
                      }))
                    }
                  />
                </Field>
                <Field
                  label={
                    <>
                      c<sub>x</sub> (cm)
                    </>
                  }
                  hint="Dirección de los pilotes."
                >
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={state.cx || ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        cx: Number(e.target.value),
                      }))
                    }
                  />
                </Field>
                <Field
                  label={
                    <>
                      c<sub>y</sub> (cm)
                    </>
                  }
                >
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={state.cy || ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        cy: Number(e.target.value),
                      }))
                    }
                  />
                </Field>
              </div>
            </Section>

            {/* ── Pilotes ───────────────────────────────────────── */}
            <Section title="Pilotes">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Cantidad de pilotes">
                  <select
                    value={state.nPilotes}
                    onChange={(e) => {
                      const n = Number(e.target.value) as 2 | 3;
                      setState((prev) => ({
                        ...prev,
                        nPilotes: n,
                        tipo:
                          n === 2
                            ? "rect2"
                            : prev.tipo === "rect2"
                              ? "linea3"
                              : prev.tipo,
                      }));
                    }}
                  >
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </Field>
                {state.nPilotes === 3 ? (
                  <Field label="Tipo de cabezal">
                    <select
                      value={state.tipo}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          tipo: e.target.value as "linea3" | "triangulo",
                        }))
                      }
                    >
                      <option value="linea3">3 en línea (rectangular)</option>
                      <option value="triangulo">
                        3 en triángulo (triangular)
                      </option>
                    </select>
                  </Field>
                ) : (
                  <Field label="Tipo de cabezal" hint="Fijo para 2 pilotes.">
                    <input value="Rectangular" readOnly />
                  </Field>
                )}
                <Field
                  label={
                    <>
                      Q<sub>pilote</sub> (kN)
                    </>
                  }
                  hint="Capacidad de cada pilote (carga de servicio del estudio geotécnico)."
                >
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={state.Qp || ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        Qp: Number(e.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label={<>Ø pilote (cm)</>}>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={state.Dp || ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        Dp: Number(e.target.value),
                      }))
                    }
                  />
                </Field>
                <Field
                  label={<>s — separación entre ejes (cm)</>}
                  hint={
                    state.tipo === "triangulo"
                      ? "Lado del triángulo que forman los pilotes."
                      : "Distancia entre ejes de pilotes contiguos."
                  }
                >
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={state.s || ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        s: Number(e.target.value),
                      }))
                    }
                  />
                </Field>
              </div>
            </Section>

            {/* ── Cabezal ───────────────────────────────────────── */}
            <Section title="Cabezal">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {state.tipo === "triangulo" ? (
                  <Field
                    label={<>Lado del cabezal (cm)</>}
                    hint="Triángulo equilátero concéntrico al de pilotes."
                  >
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={state.lado ?? ""}
                      onKeyDown={handleCommaKey}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          lado: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        }))
                      }
                    />
                  </Field>
                ) : (
                  <>
                    <Field
                      label={
                        <>
                          L<sub>x</sub> (cm)
                        </>
                      }
                      hint="Largo, en la dirección de los pilotes."
                    >
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={state.Lx ?? ""}
                        onKeyDown={handleCommaKey}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            Lx: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          }))
                        }
                      />
                    </Field>
                    <Field
                      label={
                        <>
                          L<sub>y</sub> (cm)
                        </>
                      }
                      hint="Ancho, transversal al eje de pilotes."
                    >
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={state.Ly ?? ""}
                        onKeyDown={handleCommaKey}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            Ly: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          }))
                        }
                      />
                    </Field>
                  </>
                )}
                <Field
                  label={<>h — altura (cm)</>}
                  hint="Altura total del prisma del cabezal."
                >
                  <input
                    type="number"
                    step="5"
                    min="0"
                    value={state.h ?? ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        h: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                  />
                </Field>
              </div>
              <p className="mt-4 text-[11px] leading-snug text-text-muted">
                La columna se supone centrada respecto del grupo de pilotes →
                reacciones iguales. La altura útil se estima como d = h −
                recubrimiento − 2.5 cm.
              </p>
            </Section>
          </form>

          <aside className="flex flex-col gap-4 xl:sticky xl:top-6">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2.5">
                <span className="h-4 w-1 rounded-full bg-brand" />
                <h2 className="font-display text-sm font-semibold text-text">
                  Vista previa
                </h2>
                <span className="ml-auto text-[11px] text-text-muted">
                  automática
                </span>
              </div>
              <PileCapDiagram
                tipo={state.tipo}
                cx={state.cx}
                cy={state.cy}
                Dp={state.Dp}
                s={state.s}
                L1={previewL1}
                L2={previewL2}
                h={state.h ?? 0}
                d={previewD}
              />
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-muted">Pilotes</dt>
                  <dd className="font-semibold tabular-nums text-text">
                    {state.nPilotes} × Ø{state.Dp}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-muted">Separación</dt>
                  <dd className="font-semibold tabular-nums text-text">
                    {state.s ? `${state.s} cm` : "—"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-muted">
                    {state.tipo === "triangulo" ? "Lado" : "Lx × Ly"}
                  </dt>
                  <dd className="font-semibold tabular-nums text-text">
                    {state.tipo === "triangulo"
                      ? state.lado
                        ? `${state.lado} cm`
                        : "—"
                      : state.Lx && state.Ly
                        ? `${state.Lx} × ${state.Ly} cm`
                        : "—"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-muted">h</dt>
                  <dd className="font-semibold tabular-nums text-text">
                    {state.h ? `${state.h} cm` : "—"}
                  </dd>
                </div>
              </dl>
            </div>
            <button
              type="submit"
              form="pilecap-form"
              className="w-full rounded-xl bg-primary px-5 py-3 font-display text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover active:translate-y-px dark:text-[#241a10]"
            >
              Dimensionar cabezal
            </button>
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}
