import { useState, useMemo } from "react";
import ScreenHeader from "../components/ScreenHeader";
import { useLocation, useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import {
  designRCColumn,
  computeManualAst,
  proposeArmado,
  MAX_COLUMN_RHO,
} from "../lib/rc-column-calc";
import type { RCColumnState } from "./RCColumnForm";
import { ArmadoLayoutSVG } from "./RCColumnForm";
import { saveBeam, updateSave } from "../lib/storage";
import { pickObraIfNeeded } from "../components/ObraPicker";
import { computoColumna } from "../lib/computo";
import ComputoSection from "../components/ComputoSection";

/** Stepper control: +/- buttons with a label. */
function StepperInput({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  unit = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-text-muted">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-7 h-7 rounded bg-surface-alt border border-border text-text-muted hover:bg-surface hover:text-text text-sm font-bold flex items-center justify-center"
        >
          −
        </button>
        <span className="text-sm font-semibold text-text w-10 text-center tabular-nums">
          {value}
          {unit && (
            <span className="text-xs text-text-muted ml-0.5">{unit}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-7 h-7 rounded bg-surface-alt border border-border text-text-muted hover:bg-surface hover:text-text text-sm font-bold flex items-center justify-center"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function RCColumnResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as RCColumnState | null;

  if (!state) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-text-muted">No hay datos.</p>
          <button
            onClick={() => navigate("/rc-column")}
            className="bg-primary text-white hover:bg-primary-hover px-4 py-1.5 rounded-lg"
          >
            Volver
          </button>
        </div>
      </MainLayout>
    );
  }

  return <RCColumnResultsInner state={state} />;
}

function RCColumnResultsInner({ state }: { state: RCColumnState }) {
  const navigate = useNavigate();
  const {
    fc,
    fy,
    PD,
    PL,
    lu,
    MxSup,
    MxInf,
    MySup,
    MyInf,
    Cx,
    Cy,
    betaD,
    includeSelfWeight,
    contributedColumns,
    contributedBeams,
    loadedSaveId,
    loadedSaveName,
  } = state;

  // ─── Base result (auto-design, no manual armado) for initial proposal ───
  const resultBase = useMemo(
    () =>
      designRCColumn({
        fc,
        fy,
        PD,
        PL,
        lu,
        MxSup,
        MxInf,
        MySup,
        MyInf,
        Cx,
        Cy,
        betaD,
      }),
    [fc, fy, PD, PL, lu, MxSup, MxInf, MySup, MyInf, Cx, Cy, betaD],
  );

  // ─── Initial armado proposal ───
  const astNeeded = resultBase.Ast;

  const proposedArmado = useMemo(() => proposeArmado(astNeeded), [astNeeded]);

  // ─── Interactive armado state ───
  const [nEsquinas, setNEsquinas] = useState<number>(
    state.nEsquinas ?? proposedArmado.nEsquinas,
  );
  const [nCarasX, setNCarasX] = useState<number>(
    state.nCarasX ?? proposedArmado.nCarasX,
  );
  const [nCarasY, setNCarasY] = useState<number>(
    state.nCarasY ?? proposedArmado.nCarasY,
  );
  const [dbEsquinas, setDbEsquinas] = useState<number>(
    state.dbEsquinas ?? proposedArmado.dbEsquinas,
  );
  const [dbCarasX, setDbCarasX] = useState<number>(
    state.dbCarasX ?? proposedArmado.dbCarasX,
  );
  const [dbCarasY, setDbCarasY] = useState<number>(
    state.dbCarasY ?? proposedArmado.dbCarasY,
  );

  // ─── Estribos adoptados (editables; propuesta auto del motor por defecto) ───
  const [phiStirrup, setPhiStirrup] = useState<number>(
    state.phiStirrup ?? resultBase.phiStirrup,
  );
  const [sStirrup, setSStirrup] = useState<number>(
    state.sStirrup ?? resultBase.sStirrup,
  );

  function resetStirrups() {
    setPhiStirrup(result.phiStirrup);
    setSStirrup(result.sStirrup);
  }

  // Identidad del guardado (arranca del router state, se actualiza al guardar)
  const [savedId, setSavedId] = useState<string | null>(loadedSaveId ?? null);
  const [savedName, setSavedName] = useState<string | null>(
    loadedSaveName ?? null,
  );

  // ─── Recompute on user changes ───
  const armaduraManual = useMemo(
    () =>
      computeManualAst(
        nEsquinas,
        nCarasX,
        nCarasY,
        dbEsquinas,
        dbCarasX,
        dbCarasY,
      ),
    [nEsquinas, nCarasX, nCarasY, dbEsquinas, dbCarasX, dbCarasY],
  );

  const resultRecalculado = useMemo(
    () =>
      designRCColumn({
        fc,
        fy,
        PD,
        PL,
        lu,
        MxSup,
        MxInf,
        MySup,
        MyInf,
        Cx,
        Cy,
        betaD,
        nEsquinas,
        nCarasX,
        nCarasY,
        dbEsquinas,
        dbCarasX,
        dbCarasY,
      }),
    [
      fc,
      fy,
      PD,
      PL,
      lu,
      MxSup,
      MxInf,
      MySup,
      MyInf,
      Cx,
      Cy,
      betaD,
      nEsquinas,
      nCarasX,
      nCarasY,
      dbEsquinas,
      dbCarasX,
      dbCarasY,
    ],
  );

  const result = resultRecalculado;
  const astProviso = armaduraManual.astTotal;
  const astReqX = resultBase.dirX.AstReq;
  const astReqY = resultBase.dirY.AstReq;
  // Verificación por dirección y por cara, igual que el motor: la As adoptada
  // por cara es la mitad de las esquinas + la mitad de las barras de esa
  // dirección. Las barras de la otra dirección no participan.
  const astProvFaceX = armaduraManual.astXface;
  const astProvFaceY = armaduraManual.astYface;
  const astReqFaceX = astReqX / 2;
  const astReqFaceY = astReqY / 2;
  const astVerifX = astProvFaceX >= astReqFaceX;
  const astVerifY = astProvFaceY >= astReqFaceY;
  const astVerifica = astVerifX && astVerifY;
  const faltanX = Math.max(0, astReqFaceX - astProvFaceX);
  const faltanY = Math.max(0, astReqFaceY - astProvFaceY);
  // Cobertura global: resistencia (flexo-compresión) + esbeltez límite.
  const dirXOK = result.dirX.passes && result.dirX.lambda <= 100;
  const dirYOK = result.dirY.passes && result.dirY.lambda <= 100;
  const rhoMaxExceeded = result.rhoMaxExceeded || result.rho > MAX_COLUMN_RHO;
  const globalOK = dirXOK && dirYOK && !rhoMaxExceeded;

  // Payload de guardado/impresión: los mismos campos que persiste el botón
  // "Guardar" (referencia única para no divergir).
  const saveData = useMemo<Record<string, unknown>>(
    () => ({
      fc,
      fy,
      PD,
      PL,
      PD_direct: state?.PD_direct ?? PD,
      PL_direct: state?.PL_direct ?? PL,
      PD_adicional: state?.PD_adicional ?? 0,
      PL_adicional: state?.PL_adicional ?? 0,
      lu,
      MxSup,
      MxInf,
      MySup,
      MyInf,
      Cx: result.Cx,
      Cy: result.Cy,
      betaD,
      includeSelfWeight,
      contributedColumns,
      contributedBeams,
      nEsquinas,
      nCarasX,
      nCarasY,
      dbEsquinas,
      dbCarasX,
      dbCarasY,
      phiStirrup,
      sStirrup,
    }),
    [
      fc,
      fy,
      PD,
      PL,
      state?.PD_direct,
      state?.PL_direct,
      state?.PD_adicional,
      state?.PL_adicional,
      lu,
      MxSup,
      MxInf,
      MySup,
      MyInf,
      result.Cx,
      result.Cy,
      betaD,
      includeSelfWeight,
      contributedColumns,
      contributedBeams,
      nEsquinas,
      nCarasX,
      nCarasY,
      dbEsquinas,
      dbCarasX,
      dbCarasY,
      phiStirrup,
      sStirrup,
    ],
  );

  // Diameter options for select
  const DB_OPTIONS = [8, 10, 12, 16, 20, 25, 32];

  // ─── Guardar desde results ───
  async function handleSaveFromResults() {
    const data = saveData;
    // Si venimos de una columna guardada, actualizamos la misma (mismo id/nombre)
    if (savedId) {
      updateSave(savedId, data);
      return;
    }
    const name = prompt("Nombre para guardar esta columna:");
    if (!name) return;
    const target = await pickObraIfNeeded();
    if (target === null) return;
    try {
      const saved = saveBeam(name, "rc-columna", data, target);
      setSavedId(saved.id);
      setSavedName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <MainLayout>
      <ScreenHeader
        title="Columna"
        subtitle={
          <>
            f'<sub>c</sub> = {fc} MPa &middot; f<sub>y</sub> = {fy} MPa &middot;
            l<sub>u</sub> = {lu} m
          </>
        }
        badge={
          savedName
            ? { label: savedName, tone: "saved" }
            : { label: "Sin guardar", tone: "unsaved" }
        }
        actions={
          <>
            <button
              type="button"
              onClick={handleSaveFromResults}
              className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover active:translate-y-px dark:text-[#241a10]"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() =>
                navigate("/rc-column", {
                  state: {
                    ...state,
                    loadedSaveId: savedId,
                    loadedSaveName: savedName,
                    nEsquinas,
                    nCarasX,
                    nCarasY,
                    dbEsquinas,
                    dbCarasX,
                    dbCarasY,
                    phiStirrup,
                    sStirrup,
                  },
                })
              }
              className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-text-muted transition-colors hover:bg-surface-alt hover:text-text active:translate-y-px"
            >
              ← Volver
            </button>
          </>
        }
      />

      {/* Datos de entrada */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="section-title mb-3">Datos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
          <div>
            <span className="text-xs text-text-muted">
              Cargas P<sub>D</sub> / P<sub>L</sub> (kN)
            </span>
            <p className="font-semibold">
              {PD.toFixed(2)} / {PL.toFixed(2)}
            </p>
          </div>
          <div>
            <span className="text-xs text-text-muted">
              l<sub>u</sub> (m)
            </span>
            <p className="font-semibold">{lu}</p>
          </div>
          <div>
            <span className="text-xs text-text-muted">
              Momentos X sup/inf (kN·m)
            </span>
            <p className="font-semibold">
              {MxSup} / {MxInf}
            </p>
          </div>
          <div>
            <span className="text-xs text-text-muted">
              Momentos Y sup/inf (kN·m)
            </span>
            <p className="font-semibold">
              {MySup} / {MyInf}
            </p>
          </div>
          <div>
            <span className="text-xs text-text-muted">Sección Cx×Cy (cm)</span>
            <p className="font-semibold">
              {result.Cx}×{result.Cy}
            </p>
          </div>
          <div>
            <span className="text-xs text-text-muted">
              β<sub>d</sub>
            </span>
            <p className="font-semibold">{betaD}</p>
          </div>
        </div>
      </section>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            P<sub>u</sub>
          </span>
          <p className="text-2xl font-bold text-primary mt-1">
            {result.Pu.toFixed(1)} kN
          </p>
          <span className="text-xs text-text-muted">
            P<sub>D</sub>={PD.toFixed(2)} + P<sub>L</sub>={PL.toFixed(2)}
          </span>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            λ<sub>X</sub> / λ<sub>Y</sub>
          </span>
          <p
            className={`text-lg font-bold mt-1 ${result.lambdaOK ? "text-success" : "text-danger"}`}
          >
            {result.dirX.lambda.toFixed(1)} / {result.dirY.lambda.toFixed(1)}
          </p>
          <span className="text-xs text-text-muted">
            lim {result.dirX.lambdaLim.toFixed(1)} /{" "}
            {result.dirY.lambdaLim.toFixed(1)}
          </span>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            Tipo
          </span>
          <p
            className={`text-lg font-bold mt-1 ${result.columnType === "SHORT" ? "text-success" : "text-warning"}`}
          >
            {result.columnType === "SHORT" ? "Corta" : "Esbelta"}
          </p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            ρ
          </span>
          <p
            className={`text-2xl font-bold mt-1 ${rhoMaxExceeded ? "text-danger" : "text-primary"}`}
          >
            {(result.rho * 100).toFixed(2)}%
          </p>
          <span className="text-xs text-text-muted">
            A<sub>st</sub> = {result.Ast.toFixed(1)} cm²
          </span>
          {rhoMaxExceeded && (
            <span className="block text-xs font-semibold text-danger">
              No verifica cuantía máxima (4%)
            </span>
          )}
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            Armado
          </span>
          <p className="text-lg font-bold text-primary mt-1">
            {result.barLayout.totalBars} Ø{result.dbLong}
          </p>
          <span className="text-xs text-text-muted">
            e Ø{phiStirrup} c/{Math.round(sStirrup)} cm
          </span>
        </div>
      </div>

      {/* Pass/Fail indicator */}
      <div
        className={`p-4 rounded-xl border-2 text-center ${globalOK ? "bg-success/10 border-success" : "bg-danger/10 border-danger"}`}
      >
        <span className="text-xs uppercase tracking-wider font-semibold">
          Verificación global
        </span>
        <p
          className={`text-3xl font-bold ${globalOK ? "text-success" : "text-danger"}`}
        >
          {globalOK ? "✓ VERIFICA" : "✗ NO VERIFICA"}
        </p>
        <span className="text-xs text-text-muted">
          Flexo-compresión biaxial + esbeltez + armado longitudinal. Los
          estribos se adoptan aparte.
        </span>
        <div className="flex items-center justify-center gap-3 mt-3">
          <span
            className={`text-xs px-3 py-1 rounded-full ${dirXOK ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
          >
            Dir X: {dirXOK ? "✓" : "✗"}
          </span>
          <span
            className={`text-xs px-3 py-1 rounded-full ${dirYOK ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
          >
            Dir Y: {dirYOK ? "✓" : "✗"}
          </span>
        </div>
        {rhoMaxExceeded && (
          <p className="text-sm font-bold text-danger mt-2">
            ✗ No verifica cuantía máxima:{" "}
            {result.rho > MAX_COLUMN_RHO
              ? `ρ = ${(result.rho * 100).toFixed(2)}% > 4%`
              : "la sección no alcanza con ρ = 4%"}
            . Aumentar la sección o reducir el armado.
          </p>
        )}
        {!globalOK && !rhoMaxExceeded && (
          <p className="text-xs text-text-muted mt-2">
            Revisar: {!dirXOK && !dirYOK ? "X e Y" : !dirXOK ? "X" : "Y"}.
            Aumentar sección o modificar geometría.
          </p>
        )}
      </div>

      {/* ─── Armado longitudinal INTERACTIVO ─── */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="section-title mb-4">Armado longitudinal</h2>

        {/* Inputs */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
          <div className="flex items-end gap-2">
            <StepperInput
              label="Esquinas"
              value={nEsquinas}
              onChange={(v) => setNEsquinas(v)}
              min={4}
              max={8}
              step={2}
            />
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-text-muted">
                Ø<sub>esq</sub>
              </span>
              <select
                value={dbEsquinas}
                onChange={(e) => setDbEsquinas(Number(e.target.value))}
                className="text-sm font-semibold"
              >
                {DB_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} mm
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <StepperInput
              label="Caras X"
              value={nCarasX}
              onChange={(v) => setNCarasX(v)}
              min={0}
              max={6}
            />
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-text-muted">
                Ø<sub>caras X</sub>
              </span>
              <select
                value={dbCarasX}
                onChange={(e) => setDbCarasX(Number(e.target.value))}
                className="text-sm font-semibold"
              >
                {DB_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} mm
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <StepperInput
              label="Caras Y"
              value={nCarasY}
              onChange={(v) => setNCarasY(v)}
              min={0}
              max={6}
            />
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-text-muted">
                Ø<sub>caras Y</sub>
              </span>
              <select
                value={dbCarasY}
                onChange={(e) => setDbCarasY(Number(e.target.value))}
                className="text-sm font-semibold"
              >
                {DB_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} mm
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Ast display + verify */}
        <div
          className={`p-4 rounded-lg mb-4 text-center ${astVerifica ? "bg-success/5 border border-success/20" : "bg-danger/5 border border-danger/20"}`}
        >
          <div className="text-xs text-text-muted space-y-0.5 mb-2">
            <p className="font-semibold text-text">
              Dir X — por cara: nec {astReqFaceX.toFixed(2)} cm² · adoptada{" "}
              {astProvFaceX.toFixed(2)} cm²
            </p>
            <p className="font-semibold text-text">
              Dir Y — por cara: nec {astReqFaceY.toFixed(2)} cm² · adoptada{" "}
              {astProvFaceY.toFixed(2)} cm²
            </p>
            <p>
              As adoptada por cara = mitad de esquinas + mitad de barras de esa
              dirección. Esquinas: {nEsquinas} Ø{dbEsquinas} ={" "}
              {armaduraManual.astEsquinas.toFixed(2)} cm²; caras X: {nCarasX} Ø
              {dbCarasX} = {armaduraManual.astCarasX.toFixed(2)} cm²; caras Y:{" "}
              {nCarasY} Ø{dbCarasY} = {armaduraManual.astCarasY.toFixed(2)} cm²
            </p>
            <p>
              As total provista: <strong>{astProviso.toFixed(2)} cm²</strong> (
              {armaduraManual.totalBars} barras)
            </p>
          </div>
          <p
            className={`text-sm font-semibold ${astVerifica ? "text-success" : "text-danger"}`}
          >
            {astVerifX
              ? `✓ Dir X: ${astProvFaceX.toFixed(2)} ≥ ${astReqFaceX.toFixed(2)} cm²/cara`
              : `✗ Dir X: ${astProvFaceX.toFixed(2)} < ${astReqFaceX.toFixed(2)} cm²/cara (faltan ${faltanX.toFixed(2)})`}
            {" · "}
            {astVerifY
              ? `✓ Dir Y: ${astProvFaceY.toFixed(2)} ≥ ${astReqFaceY.toFixed(2)} cm²/cara`
              : `✗ Dir Y: ${astProvFaceY.toFixed(2)} < ${astReqFaceY.toFixed(2)} cm²/cara (faltan ${faltanY.toFixed(2)})`}
          </p>
          <span className={`text-sm font-semibold text-text`}>
            Cobertura de As adoptada: X {astVerifX ? "✓" : "✗"} · Y{" "}
            {astVerifY ? "✓" : "✗"}
          </span>
        </div>

        {/* SVG layout */}
        <div className="flex flex-col items-center mb-4">
          <ArmadoLayoutSVG
            Cx={result.Cx}
            Cy={result.Cy}
            nCarasX={nCarasX}
            nCarasY={nCarasY}
            dbEsquinas={dbEsquinas}
            dbCarasX={dbCarasX}
            dbCarasY={dbCarasY}
          />
          <span className="text-xs text-text-muted mt-2">
            ■ esquinas &nbsp;
            <span style={{ color: "#3b82f6" }}>●</span> caras X &nbsp;
            <span style={{ color: "#22c55e" }}>●</span> caras Y &nbsp;
            <span
              style={{
                borderBottom: "1px dashed var(--color-text-muted, #9ca3af)",
              }}
            >
              - -
            </span>{" "}
            estribo
          </span>
        </div>

        {/* Estribos (adoptados, editables) */}
        <div className="p-4 rounded-lg mb-4 bg-surface-alt/40 border border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title">Estribos</h3>
            <button
              type="button"
              onClick={resetStirrups}
              className="text-xs bg-surface-alt border border-border hover:bg-surface text-text-muted px-3 py-1.5 rounded-lg"
            >
              Automático
            </button>
          </div>
          <div className="flex flex-wrap items-end justify-center gap-6">
            <label className="flex flex-col items-center gap-1">
              <span className="text-xs text-text-muted">Ø estribo (mm)</span>
              <select
                value={phiStirrup}
                onChange={(e) => setPhiStirrup(Number(e.target.value))}
                className="text-sm font-semibold"
              >
                {[6, 8, 10, 12].map((d) => (
                  <option key={d} value={d}>
                    {d} mm
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-text-muted">Separación (cm)</span>
              <StepperInput
                label=""
                value={sStirrup}
                onChange={setSStirrup}
                min={5}
                max={40}
                step={5}
                unit=" cm"
              />
            </div>
          </div>
          <p className="text-xs text-text-muted text-center mt-3">
            Propuesta automática: Ø{result.phiStirrup} c/
            {result.sStirrup.toFixed(0)} cm. La verificación de flexo-compresión
            no depende del estribo; el valor adoptado se usa en planilla y
            cómputo.
          </p>
        </div>
      </section>

      {/* Direction X card */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="section-title">Dirección X</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${result.dirX.columnType === "SHORT" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
          >
            {result.dirX.columnType === "SHORT" ? "Corta" : "Esbelta"}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${dirXOK ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
          >
            {dirXOK ? "✓ Verifica" : "✗ No verifica"}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">
              M<sub>1u</sub>
            </span>
            <p className="text-lg font-bold text-primary">
              {result.dirX.M1u.toFixed(1)} kN·m
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">
              M<sub>2u</sub>
            </span>
            <p className="text-lg font-bold text-primary">
              {result.dirX.M2u.toFixed(1)} kN·m
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">λ</span>
            <p
              className={`text-lg font-bold ${result.dirX.lambda <= result.dirX.lambdaLim ? "text-success" : "text-warning"}`}
            >
              {result.dirX.lambda.toFixed(1)}
            </p>
            <span className="text-xs text-text-muted">
              lim {result.dirX.lambdaLim.toFixed(1)}
            </span>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">ρ</span>
            <p className="text-lg font-bold text-primary">
              {(result.dirX.rho * 100).toFixed(2)}%
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">
              M<sub>u</sub>
            </span>
            <p className="text-lg font-bold text-primary">
              {result.dirX.Mu.toFixed(1)} kN·m
            </p>
          </div>
        </div>
      </section>

      {/* Direction Y card */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="section-title">Dirección Y</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${result.dirY.columnType === "SHORT" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
          >
            {result.dirY.columnType === "SHORT" ? "Corta" : "Esbelta"}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${dirYOK ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
          >
            {dirYOK ? "✓ Verifica" : "✗ No verifica"}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">
              M<sub>1u</sub>
            </span>
            <p className="text-lg font-bold text-primary">
              {result.dirY.M1u.toFixed(1)} kN·m
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">
              M<sub>2u</sub>
            </span>
            <p className="text-lg font-bold text-primary">
              {result.dirY.M2u.toFixed(1)} kN·m
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">λ</span>
            <p
              className={`text-lg font-bold ${result.dirY.lambda <= result.dirY.lambdaLim ? "text-success" : "text-warning"}`}
            >
              {result.dirY.lambda.toFixed(1)}
            </p>
            <span className="text-xs text-text-muted">
              lim {result.dirY.lambdaLim.toFixed(1)}
            </span>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">ρ</span>
            <p className="text-lg font-bold text-primary">
              {(result.dirY.rho * 100).toFixed(2)}%
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">
              M<sub>u</sub>
            </span>
            <p className="text-lg font-bold text-primary">
              {result.dirY.Mu.toFixed(1)} kN·m
            </p>
          </div>
        </div>
      </section>

      {/* Second-order details (show if either is slender) */}
      {(result.dirX.columnType === "SLENDER" ||
        result.dirY.columnType === "SLENDER") && (
        <>
          {result.dirX.columnType === "SLENDER" && (
            <section className="bg-surface rounded-xl border border-border p-5">
              <h2 className="section-title mb-3">Efectos 2° orden — Dir X</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface-alt rounded-lg p-3">
                  <span className="text-xs text-text-muted">
                    M<sub>min</sub>
                  </span>
                  <p className="text-lg font-bold text-primary">
                    {result.dirX.Mmin?.toFixed(1)} kN·m
                  </p>
                </div>
                <div className="bg-surface-alt rounded-lg p-3">
                  <span className="text-xs text-text-muted">
                    P<sub>c</sub>
                  </span>
                  <p className="text-lg font-bold text-primary">
                    {result.dirX.Pc?.toFixed(1)} kN
                  </p>
                </div>
                <div className="bg-surface-alt rounded-lg p-3">
                  <span className="text-xs text-text-muted">
                    δ<sub>s</sub>
                  </span>
                  <p className="text-lg font-bold text-primary">
                    {result.dirX.deltaS?.toFixed(3)}
                  </p>
                </div>
                <div className="bg-surface-alt rounded-lg p-3">
                  <span className="text-xs text-text-muted">
                    M<sub>c</sub>
                  </span>
                  <p className="text-lg font-bold text-primary">
                    {result.dirX.Mc?.toFixed(1)} kN·m
                  </p>
                </div>
              </div>
            </section>
          )}
          {result.dirY.columnType === "SLENDER" && (
            <section className="bg-surface rounded-xl border border-border p-5">
              <h2 className="section-title mb-3">Efectos 2° orden — Dir Y</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface-alt rounded-lg p-3">
                  <span className="text-xs text-text-muted">
                    M<sub>min</sub>
                  </span>
                  <p className="text-lg font-bold text-primary">
                    {result.dirY.Mmin?.toFixed(1)} kN·m
                  </p>
                </div>
                <div className="bg-surface-alt rounded-lg p-3">
                  <span className="text-xs text-text-muted">
                    P<sub>c</sub>
                  </span>
                  <p className="text-lg font-bold text-primary">
                    {result.dirY.Pc?.toFixed(1)} kN
                  </p>
                </div>
                <div className="bg-surface-alt rounded-lg p-3">
                  <span className="text-xs text-text-muted">
                    δ<sub>s</sub>
                  </span>
                  <p className="text-lg font-bold text-primary">
                    {result.dirY.deltaS?.toFixed(3)}
                  </p>
                </div>
                <div className="bg-surface-alt rounded-lg p-3">
                  <span className="text-xs text-text-muted">
                    M<sub>c</sub>
                  </span>
                  <p className="text-lg font-bold text-primary">
                    {result.dirY.Mc?.toFixed(1)} kN·m
                  </p>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Detailed steps */}
      <section className="no-print bg-surface rounded-xl border border-border p-5">
        <h2 className="section-title mb-3">Cuentas completas</h2>
        <pre className="p-3 bg-surface-alt rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto max-h-[32rem] overflow-y-auto">
          {result.steps.join("\n")}
        </pre>
      </section>

      <ComputoSection
        computo={computoColumna({
          cxCm: result.Cx,
          cyCm: result.Cy,
          luM: lu,
          nEsquinas,
          nCarasX,
          nCarasY,
          dbEsquinas,
          dbCarasX,
          dbCarasY,
          phiStirrup: phiStirrup,
          sStirrupCm: sStirrup,
        })}
        note="Estribos con recubrimiento supuesto 2.5 cm."
      />
    </MainLayout>
  );
}
