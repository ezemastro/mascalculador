// Módulo "Muro de Contención": formulario de datos de entrada (geometría,
// geotecnia, materiales, cargas de losa y zapata). El cálculo vive en
// muro-calc.ts (designMuro); esta pantalla solo recolecta y persiste el
// borrador. Los guardados usan el tipo propio "muro". CIRSOC 201-2005 / ACI 318.
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { MainLayout, SavedBeams } from "@mascalculador/shared";
import {
  saveBeam,
  updateSave,
  getSavedBeams,
  deleteSave,
  loadLastMuroFormState,
  saveLastMuroFormState,
  type MuroFormState,
  type MuroAdopcion,
} from "../lib/storage";
import { pickObraIfNeeded } from "../components/ObraPicker";
import ScreenHeader from "../components/ScreenHeader";

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

const initialState: MuroFormState = {
  H: 4,
  e_muro: 0.3,
  rec_muro: 25,
  H_puntal: 2,
  gamma: 18,
  gamma_sat: 20,
  phi: 30,
  c: 0,
  FS_c: 2.5,
  h_napa: 0,
  q_lindero: 0,
  sigma_adm_suelo: 0.2,
  sigma_adm_unit: "MPa",
  fc: 25,
  fy: 420,
  e_losa: 0.2,
  ancho_inf: 3,
  CM_losa: 1.5,
  L_losa: 2,
  B_zap: 2,
  H_zap: 0.5,
  rec_zap: 50,
  tipo_zapata: "centrada",
};

const NUM_FIELDS = [
  "H",
  "e_muro",
  "rec_muro",
  "H_puntal",
  "gamma",
  "gamma_sat",
  "phi",
  "c",
  "FS_c",
  "h_napa",
  "q_lindero",
  "sigma_adm_suelo",
  "fc",
  "fy",
  "e_losa",
  "ancho_inf",
  "CM_losa",
  "L_losa",
  "B_zap",
  "H_zap",
  "rec_zap",
] as const;

export default function MuroForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as
    | (MuroFormState & {
        loadedSaveId?: string | null;
        loadedSaveName?: string | null;
      })
    | null;

  const [state, setState] = useState<MuroFormState>(() => {
    if (locationState) {
      return {
        ...locationState,
        loadedSaveId: undefined,
        loadedSaveName: undefined,
      } as MuroFormState;
    }
    return loadLastMuroFormState() ?? initialState;
  });

  const [loadedSaveId, setLoadedSaveId] = useState<string | null>(
    locationState?.loadedSaveId ?? null,
  );
  const [loadedSaveName, setLoadedSaveName] = useState<string | null>(
    locationState?.loadedSaveName ?? null,
  );

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    saveLastMuroFormState(state);
  }, [state]);

  async function handleSave() {
    const data: Record<string, unknown> = { ...state };
    if (loadedSaveId) {
      updateSave(loadedSaveId, data);
      return;
    }
    const name = prompt("Nombre del muro:");
    if (!name) return;
    const target = await pickObraIfNeeded();
    if (target === null) return;
    try {
      const saved = saveBeam(name, "muro", data, target);
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
      for (const k of NUM_FIELDS) {
        if (typeof f[k] === "number") next[k] = f[k] as never;
      }
      if (f.sigma_adm_unit === "MPa" || f.sigma_adm_unit === "kg/cm2") {
        next.sigma_adm_unit = f.sigma_adm_unit;
      }
      if (f.tipo_zapata === "centrada" || f.tipo_zapata === "excentrica") {
        next.tipo_zapata = f.tipo_zapata;
      }
      // Adopción manual de armaduras: debe copiarse o el override se pierde al
      // recargar un save desde el formulario.
      if (f.adopcion && typeof f.adopcion === "object") {
        next.adopcion = f.adopcion as MuroAdopcion;
      } else {
        next.adopcion = undefined;
      }
      return next;
    });
  }

  function handleNew() {
    setState(initialState);
    setLoadedSaveId(null);
    setLoadedSaveName(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(state.H > 0 && state.e_muro > 0)) {
      alert("Completá la altura H y el espesor del tabique e_muro.");
      return;
    }
    if (!(state.B_zap > state.e_muro && state.H_zap > 0)) {
      alert("La zapata B_zap debe ser mayor que el tabique y H_zap > 0.");
      return;
    }
    if (!(state.phi > 0 && state.phi < 90)) {
      alert("El ángulo de fricción φ debe estar entre 0° y 90°.");
      return;
    }
    navigate("/muro-results", {
      state: {
        input: { ...state },
        loadedSaveId: loadedSaveId ?? undefined,
        loadedSaveName: loadedSaveName ?? undefined,
      },
    });
  }

  return (
    <MainLayout>
      <div className="flex flex-col gap-6">
        <ScreenHeader
          title="Muro de Contención"
          subtitle="CIRSOC 201-2005 / ACI 318 — empujes de Rankine y zapata corrida"
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
          type="muro"
          listSaves={() => getSavedBeams("muro")}
          deleteSave={(id) => deleteSave(id)}
          onLoad={handleLoad}
          label="Muros guardados"
        />

        <form
          id="muro-form"
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
          {/* ── Geometría ─────────────────────────────────────── */}
          <Section
            title="Geometría del tabique"
            hint="metros, salvo recubrimientos en mm"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={<>H — altura libre (m)</>}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={state.H || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      H: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field
                label={
                  <>
                    e<sub>muro</sub> — espesor (m)
                  </>
                }
                hint="típico 0.25–0.40 m"
              >
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={state.e_muro || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      e_muro: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field label={<>Recubrimiento tabique (mm)</>}>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={state.rec_muro || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      rec_muro: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field
                label={
                  <>
                    H<sub>puntal</sub> — apuntalamiento (m)
                  </>
                }
                hint="desde la base; estado provisorio"
              >
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={state.H_puntal || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      H_puntal: Number(e.target.value),
                    }))
                  }
                />
              </Field>
            </div>
          </Section>

          {/* ── Geotecnia ────────────────────────────────────── */}
          <Section title="Suelo y empujes" hint="kN/m³ y kN/m²">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={<>γ — peso específico (kN/m³)</>}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={state.gamma || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      gamma: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field
                label={
                  <>
                    γ<sub>sat</sub> (kN/m³)
                  </>
                }
                hint="sumergido en napa"
              >
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={state.gamma_sat || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      gamma_sat: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field label={<>φ (°)</>}>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={state.phi || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      phi: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field label={<>c — cohesión (kN/m²)</>}>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={state.c || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      c: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field
                label={
                  <>
                    FS<sub>c</sub> — seguridad cohesión
                  </>
                }
                hint="default 2.5"
              >
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={state.FS_c || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      FS_c: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field
                label={
                  <>
                    h<sub>napa</sub> — napa (m)
                  </>
                }
                hint="desde la base; 0 = sin napa"
              >
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={state.h_napa || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      h_napa: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field
                label={
                  <>
                    q<sub>lindero</sub> (kN/m²)
                  </>
                }
              >
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={state.q_lindero || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      q_lindero: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field
                label={
                  <>
                    σ<sub>adm</sub> suelo
                  </>
                }
                hint="MPa (1 MPa = 1000 kPa)"
              >
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={state.sigma_adm_suelo || ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        sigma_adm_suelo: Number(e.target.value),
                      }))
                    }
                  />
                  <select
                    className="w-28 shrink-0"
                    value={state.sigma_adm_unit}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        sigma_adm_unit: e.target
                          .value as MuroFormState["sigma_adm_unit"],
                      }))
                    }
                  >
                    <option value="MPa">MPa</option>
                    <option value="kg/cm2">kg/cm²</option>
                  </select>
                </div>
              </Field>
            </div>
          </Section>

          {/* ── Materiales ──────────────────────────────────── */}
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

          {/* ── Cargas de la losa vinculada ─────────────────── */}
          <Section
            title="Cargas de la losa vinculada"
            hint="la losa empuja la cabeza del muro (estado definitivo)"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                label={
                  <>
                    e<sub>losa</sub> — espesor (m)
                  </>
                }
                hint="default 0.20"
              >
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={state.e_losa || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      e_losa: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field label={<>Ancho de influencia (m)</>}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={state.ancho_inf || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      ancho_inf: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field label={<>CM — mampostería (kN/m²)</>}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={state.CM_losa || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      CM_losa: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field label={<>L — sobrecarga (kN/m²)</>}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={state.L_losa || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      L_losa: Number(e.target.value),
                    }))
                  }
                />
              </Field>
            </div>
          </Section>

          {/* ── Zapata ──────────────────────────────────────── */}
          <Section
            title="Zapata corrida"
            hint="metros, salvo recubrimiento en mm"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                label={
                  <>
                    B<sub>zap</sub> — ancho (m)
                  </>
                }
              >
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={state.B_zap || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      B_zap: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field
                label={
                  <>
                    H<sub>zap</sub> — altura (m)
                  </>
                }
              >
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  value={state.H_zap || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      H_zap: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field label={<>Recubrimiento zapata (mm)</>}>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={state.rec_zap || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      rec_zap: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field label="Tipo de zapata">
                <select
                  value={state.tipo_zapata}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      tipo_zapata: e.target
                        .value as MuroFormState["tipo_zapata"],
                    }))
                  }
                >
                  <option value="centrada">Centrada</option>
                  <option value="excentrica">Excéntrica</option>
                </select>
              </Field>
            </div>
          </Section>

          <div className="self-center">
            <button
              type="submit"
              form="muro-form"
              className="rounded-xl bg-primary px-8 py-3 font-display text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover active:translate-y-px dark:text-[#241a10]"
            >
              Calcular muro
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
