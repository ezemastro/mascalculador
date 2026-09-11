// Módulo admin "Vigas de fundación para cabezales".
//
// Reutiliza el motor de base medianera + viga de fundación (designBase con
// type "medianera-y" y subType "viga-de-fundacion"): el cabezal se comporta
// como la base, la columna apoya en la medianera y Lcol ubica la columna que
// equilibra. Los guardados usan el tipo propio "cabezal" para no mezclarse
// con los de Bases.
import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { MainLayout, SavedBeams } from "@mascalculador/shared";
import {
  saveBeam,
  updateSave,
  listSaves,
  getSavedBeams,
  deleteSave,
  loadLastCabezalFormState,
  saveLastCabezalFormState,
  type CabezalFormState,
} from "../lib/storage";
import { pickObraIfNeeded } from "../components/ObraPicker";
import ScreenHeader from "../components/ScreenHeader";
import {
  suggestBaseDims,
  suggestBaseHeight,
  vuelos,
  type BaseInput,
} from "../lib/bases-calc";

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

const initialState: CabezalFormState = {
  qa: 200,
  Df: 1,
  PD: 500,
  PL: 300,
  cx: 30,
  cy: 30,
  fc: 25,
  fy: 420,
  cover: 7,
};

/** Tarjeta de sección del formulario, con título y ayuda opcional. */
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

/** Campo de formulario: etiqueta arriba, control, ayuda opcional abajo. */
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

/** Planta del cabezal: columna en la medianera (izq.) y columna que
 *  equilibra unida por la viga de fundación. */
function CabezalDiagram({
  lx,
  ly,
  lcol,
}: {
  lx: number;
  ly: number;
  lcol?: number;
}) {
  const dim = "var(--color-text-muted)";
  const ink = "var(--color-text)";
  const brand = "var(--color-brand)";
  return (
    <svg
      viewBox="0 0 280 168"
      className="w-full"
      role="img"
      aria-label="Planta del cabezal"
    >
      <line
        x1="18"
        y1="12"
        x2="18"
        y2="150"
        stroke={dim}
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <text x="6" y="9" fontSize="9" fill={dim}>
        Medianera
      </text>

      <rect
        x="18"
        y="34"
        width="70"
        height="92"
        fill="none"
        stroke={ink}
        strokeWidth="1.5"
      />
      <rect x="18" y="62" width="30" height="36" fill={brand} />
      <rect
        x="48"
        y="70"
        width="160"
        height="20"
        fill={ink}
        fillOpacity="0.12"
        stroke={ink}
        strokeWidth="1"
      />
      <rect x="208" y="66" width="30" height="28" fill={brand} />

      <line x1="18" y1="140" x2="88" y2="140" stroke={dim} strokeWidth="1" />
      <line x1="18" y1="136" x2="18" y2="144" stroke={dim} strokeWidth="1" />
      <line x1="88" y1="136" x2="88" y2="144" stroke={dim} strokeWidth="1" />
      <text x="53" y="136" fontSize="9" fill={dim} textAnchor="middle">
        Lx {lx}
      </text>

      <line x1="33" y1="158" x2="223" y2="158" stroke={dim} strokeWidth="1" />
      <line x1="33" y1="154" x2="33" y2="162" stroke={dim} strokeWidth="1" />
      <line x1="223" y1="154" x2="223" y2="162" stroke={dim} strokeWidth="1" />
      <text x="128" y="154" fontSize="9" fill={dim} textAnchor="middle">
        Lcol {lcol ?? "—"}
      </text>

      <line x1="104" y1="34" x2="104" y2="126" stroke={dim} strokeWidth="1" />
      <line x1="100" y1="34" x2="108" y2="34" stroke={dim} strokeWidth="1" />
      <line x1="100" y1="126" x2="108" y2="126" stroke={dim} strokeWidth="1" />
      <text
        x="114"
        y="80"
        fontSize="9"
        fill={dim}
        textAnchor="middle"
        transform="rotate(-90 114 80)"
        stroke="var(--color-surface)"
        strokeWidth="3"
        paintOrder="stroke"
      >
        Ly {ly}
      </text>
    </svg>
  );
}

export default function CabezalForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as
    | (CabezalFormState & {
        loadedSaveId?: string | null;
        loadedSaveName?: string | null;
      })
    | null;

  const [state, setState] = useState<CabezalFormState>(() => {
    if (locationState) {
      const s = {
        ...locationState,
        loadedSaveId: undefined,
        loadedSaveName: undefined,
      } as CabezalFormState;
      return s;
    }
    return loadLastCabezalFormState() ?? initialState;
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
    saveLastCabezalFormState({
      ...state,
      columnId: columnId ?? undefined,
      columnName: columnName ?? undefined,
    });
  }, [state, columnId, columnName]);

  // Vista previa: mismas sugerencias que el motor de bases.
  const geo = useMemo(() => {
    const input = {
      qa: state.qa > 0 ? state.qa : 200,
      Df: state.Df,
      PD: Math.max(0, state.PD),
      PL: Math.max(0, state.PL),
      cx: state.cx,
      cy: state.cy,
      fc: state.fc,
      fy: state.fy,
      type: "medianera-y" as const,
      subType: "viga-de-fundacion" as const,
      Lx: state.Lx,
      Ly: state.Ly,
      Lcol: state.Lcol,
      cover: state.cover ?? 7,
      includeSelfWeight: true,
    } as BaseInput;
    const dims = suggestBaseDims(input);
    const hgt = suggestBaseHeight(input, dims.Lx, dims.Ly);
    const { kx, ky } = vuelos(input, dims.Lx, dims.Ly);
    const kmin = Math.min(kx, ky);
    return {
      Lx: dims.Lx,
      Ly: dims.Ly,
      h: hgt.h,
      hTalon: Math.max(25, (state.h ?? hgt.h) - kmin),
    };
  }, [
    state.qa,
    state.Df,
    state.PD,
    state.PL,
    state.cx,
    state.cy,
    state.fc,
    state.fy,
    state.Lx,
    state.Ly,
    state.Lcol,
    state.cover,
    state.h,
  ]);

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
      const saved = saveBeam(name, "cabezal", data, target);
      setLoadedSaveId(saved.id);
      setLoadedSaveName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  function handleLoadCabezal(
    data: Record<string, unknown>,
    save: { id: string; name: string },
  ) {
    setLoadedSaveId(save.id);
    setLoadedSaveName(save.name);
    const d = data as Record<string, unknown>;
    // Los guardados desde resultados usan { input, result }; los hechos desde
    // el formulario guardan los campos en el nivel raíz.
    const f = (d.input && typeof d.input === "object" ? d.input : d) as Record<
      string,
      unknown
    >;
    setState((prev) => {
      const next = { ...prev };
      if (typeof f.qa === "number") next.qa = f.qa;
      if (typeof f.Df === "number") next.Df = f.Df;
      if (typeof f.PD === "number") next.PD = f.PD;
      if (typeof f.PL === "number") next.PL = f.PL;
      if (typeof f.cx === "number") next.cx = f.cx;
      if (typeof f.cy === "number") next.cy = f.cy;
      if (typeof f.fc === "number") next.fc = f.fc;
      if (typeof f.fy === "number") next.fy = f.fy;
      if (typeof f.Lx === "number") next.Lx = f.Lx;
      if (typeof f.Ly === "number") next.Ly = f.Ly;
      if (typeof f.h === "number") next.h = f.h;
      if (typeof f.hTalon === "number") next.hTalon = f.hTalon;
      if (typeof f.Lcol === "number") next.Lcol = f.Lcol;
      if (typeof f.bViga === "number") next.bViga = f.bViga;
      if (typeof f.hViga === "number") next.hViga = f.hViga;
      if (typeof f.cover === "number") next.cover = f.cover;
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
    navigate("/cabezales-results", {
      state: {
        input: {
          ...buildData(),
          type: "medianera-y",
          subType: "viga-de-fundacion",
          includeSelfWeight: true,
        },
        loadedSaveId: loadedSaveId ?? undefined,
        loadedSaveName: loadedSaveName ?? undefined,
      },
    });
  }

  return (
    <MainLayout>
      <div className="flex flex-col gap-6">
        <ScreenHeader
          title="Vigas de fundación para cabezales"
          subtitle={
            <>
              <span>CIRSOC 201 · Hormigón armado</span>
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
          type="cabezal"
          listSaves={() => getSavedBeams("cabezal")}
          deleteSave={(id) => deleteSave(id)}
          onLoad={handleLoadCabezal}
          label="Cabezales guardados"
        />

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <form
            id="cabezal-form"
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
            {/* ── Suelo ─────────────────────────────────────────── */}
            <Section title="Suelo">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label={
                    <>
                      σ<sub>adm</sub> (kN/m²)
                    </>
                  }
                >
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={state.qa || ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        qa: Number(e.target.value),
                      }))
                    }
                  />
                </Field>
                <Field
                  label={
                    <>
                      D<sub>f</sub> (m) — profundidad de la fundación
                    </>
                  }
                >
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={state.Df || ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        Df: Number(e.target.value),
                      }))
                    }
                  />
                </Field>
              </div>
            </Section>

            {/* ── Materiales ────────────────────────────────────── */}
            <Section title="Materiales">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              </div>
            </Section>

            {/* ── Columna en medianera ──────────────────────────── */}
            <Section title="Columna que apoya en medianera">
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

            {/* ── Cabezal ───────────────────────────────────────── */}
            <Section title="Cabezal">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  label={
                    <>
                      L<sub>x</sub> (cm)
                    </>
                  }
                  hint={`Sugerido ${geo.Lx}`}
                >
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder={String(geo.Lx)}
                    value={state.Lx ?? ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        Lx: e.target.value ? Number(e.target.value) : undefined,
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
                  hint={`Sugerido ${geo.Ly}`}
                >
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder={String(geo.Ly)}
                    value={state.Ly ?? ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        Ly: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                  />
                </Field>
                <Field label="h (cm)" hint={`Sugerido ${Math.round(geo.h)}`}>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder={String(Math.round(geo.h))}
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
                <Field
                  label={
                    <>
                      Talón h<sub>t</sub> (cm)
                    </>
                  }
                  hint={`Sugerido ${Math.round(geo.hTalon)}`}
                >
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder={String(Math.round(geo.hTalon))}
                    value={state.hTalon ?? ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        hTalon: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      }))
                    }
                  />
                </Field>
              </div>
              <p className="mt-4 text-[11px] leading-snug text-text-muted">
                Vacío = dimensión automática del motor. Sugerido: {geo.Lx}×
                {geo.Ly}×{Math.round(geo.h)} cm.
              </p>
            </Section>

            {/* ── Viga de fundación ─────────────────────────────── */}
            <Section title="Viga de fundación">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field
                  label={<>b viga (cm)</>}
                  hint={
                    <>
                      Vacío = máx(c<sub>y</sub>, 20)
                    </>
                  }
                >
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={state.bViga ?? ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        bViga: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      }))
                    }
                  />
                </Field>
                <Field
                  label={<>h viga (cm)</>}
                  hint="Vacío = sugerida por flexión"
                >
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={state.hViga ?? ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        hViga: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      }))
                    }
                  />
                </Field>
                <Field label="Recubrimiento (cm)">
                  <input
                    type="number"
                    step="1"
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

            {/* ── Columna que equilibra ─────────────────────────── */}
            <Section title="Columna que equilibra">
              <div className="max-w-xs">
                <Field
                  label={
                    <>
                      L<sub>col</sub> (cm)
                    </>
                  }
                  hint="Distancia entre ejes de columnas."
                >
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={state.Lcol ?? ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        Lcol: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      }))
                    }
                  />
                </Field>
              </div>
              <p className="mt-4 text-[11px] leading-snug text-text-muted">
                La viga re-centra la resultante: R<sub>u</sub> = P<sub>u</sub>
                ·e / (L<sub>col</sub> − e).
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
              <CabezalDiagram
                lx={Math.round(state.Lx ?? geo.Lx)}
                ly={Math.round(state.Ly ?? geo.Ly)}
                lcol={state.Lcol ? Math.round(state.Lcol) : undefined}
              />
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-muted">Lx</dt>
                  <dd className="font-semibold tabular-nums text-text">
                    {Math.round(state.Lx ?? geo.Lx)} cm
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-muted">Ly</dt>
                  <dd className="font-semibold tabular-nums text-text">
                    {Math.round(state.Ly ?? geo.Ly)} cm
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-muted">h</dt>
                  <dd className="font-semibold tabular-nums text-text">
                    {Math.round(state.h ?? geo.h)} cm
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-muted">Talón</dt>
                  <dd className="font-semibold tabular-nums text-text">
                    {Math.round(state.hTalon ?? geo.hTalon)} cm
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] leading-snug text-text-muted">
                Los campos vacíos adoptan la dimensión automática del motor.
              </p>
            </div>
            <button
              type="submit"
              form="cabezal-form"
              className="w-full rounded-xl bg-primary px-5 py-3 font-display text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover active:translate-y-px dark:text-[#241a10]"
            >
              Dimensionar cabezal y viga
            </button>
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}
