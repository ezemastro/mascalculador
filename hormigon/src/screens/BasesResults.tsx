import { useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { designBase } from "../lib/bases-calc";
import type { BaseInput } from "../lib/bases-calc";
import { saveBeam, updateSave } from "../lib/storage";
import { pickObraIfNeeded } from "../components/ObraPicker";
import { computoBase } from "../lib/computo";
import ComputoSection from "../components/ComputoSection";

// ---------------------------------------------------------------------------
// Location state contract (set by BasesForm on submit)
// ---------------------------------------------------------------------------

interface LocationState {
  input: BaseInput;
  /** Id del guardado cargado, si viene de uno existente */
  loadedSaveId?: string | null;
  loadedSaveName?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Badge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
        ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      }`}
    >
      {ok ? "✓ OK" : "✗ FALLA"}
    </span>
  );
}

function DataCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="bg-surface-alt rounded-lg p-3">
      <span
        className="text-xs text-text-muted"
        dangerouslySetInnerHTML={{ __html: label }}
      />
      <p className="text-lg font-bold text-primary mt-0.5">{value}</p>
      {sub && <span className="text-xs text-text-muted">{sub}</span>}
    </div>
  );
}

/** Format a number for display */
function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function aBar(diamMm: number): number {
  return (Math.PI * (diamMm / 10) ** 2) / 4; // cm²
}

/** Adopción de armadura: As nec + Ø + cantidad → As prov, separación vs máx. */
function SteelEditor({
  dir,
  asNec,
  spread,
  cover,
  diam,
  qty,
  onDiam,
  onQty,
}: {
  dir: "X" | "Y";
  asNec: number;
  spread: number;
  cover: number;
  diam: number;
  qty: number;
  onDiam: (d: number) => void;
  onQty: (q: number) => void;
}) {
  const asProv = qty * aBar(diam);
  const sep = qty > 1 ? (spread - 2 * cover) / (qty - 1) : Infinity;
  const sepMax = Math.min(25 * (diam / 10), 30);
  const okCantidad = asProv >= asNec;
  const okSep = sep <= sepMax;

  return (
    <div className="bg-surface-alt rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text">
          As<sub>{dir}</sub> nec
        </span>
        <span className="text-lg font-bold text-primary">
          {fmt(asNec, 2)}{" "}
          <span className="text-xs font-normal text-text-muted">cm²</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Ø (mm)</span>
          <select value={diam} onChange={(e) => onDiam(Number(e.target.value))}>
            {[8, 10, 12, 16, 20, 25].map((d) => (
              <option key={d} value={d}>
                Ø{d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Cantidad</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onQty(Math.max(1, qty - 1))}
              className="w-8 h-8 rounded-lg bg-surface border border-border hover:bg-surface-alt text-text font-bold"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => onQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-14 text-center"
            />
            <button
              type="button"
              onClick={() => onQty(qty + 1)}
              className="w-8 h-8 rounded-lg bg-surface border border-border hover:bg-surface-alt text-text font-bold"
            >
              +
            </button>
          </div>
        </label>
      </div>
      <div className="text-xs text-text-muted flex flex-col gap-1">
        <span>
          As prov = {qty} Ø{diam} = {fmt(asProv, 2)} cm²{" "}
          <Badge ok={okCantidad} />
        </span>
        <span>
          Separación s<sub>{dir.toLowerCase()}</sub> ={" "}
          {qty > 1 ? fmt(sep, 1) : "—"} cm ≤ máx {fmt(sepMax, 1)} cm{" "}
          <Badge ok={okSep} />
        </span>
      </div>
    </div>
  );
}

/** Armadura del tensor: lados de sección editables + Ø y cantidad → As prov, con cuantía 1–8%. */
function TensorEditor({
  label,
  asNec,
  sugSide,
}: {
  label: string;
  asNec: number;
  sugSide: number;
}) {
  const [b, setB] = useState<number>(sugSide);
  const [h, setH] = useState<number>(sugSide);
  const [qty, setQty] = useState(4);
  const [diam, setDiam] = useState(12);
  const asProv = qty * aBar(diam);
  const rho = (asProv / (b * h)) * 100; // %
  const okAs = asProv >= asNec;
  const okRho = rho >= 1 && rho <= 8;
  const ok = okAs && okRho;

  return (
    <div className="bg-surface-alt rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text">{label}</span>
        <span className="text-lg font-bold text-primary">
          As nec {fmt(asNec, 2)}{" "}
          <span className="text-xs font-normal text-text-muted">cm²</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">
            Lado b (cm){" "}
            <span className="text-text-muted/60">
              (sugerido {Math.round(sugSide)})
            </span>
          </span>
          <input
            type="number"
            step="1"
            min="1"
            value={b || ""}
            onChange={(e) =>
              setB(e.target.value ? Math.max(1, Number(e.target.value)) : 1)
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Lado h (cm)</span>
          <input
            type="number"
            step="1"
            min="1"
            value={h || ""}
            onChange={(e) =>
              setH(e.target.value ? Math.max(1, Number(e.target.value)) : 1)
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Ø (mm)</span>
          <select
            value={diam}
            onChange={(e) => setDiam(Number(e.target.value))}
          >
            {[8, 10, 12, 16, 20, 25].map((d) => (
              <option key={d} value={d}>
                Ø{d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Cantidad</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setQty(Math.max(2, qty - 1))}
              className="w-8 h-8 rounded-lg bg-surface border border-border hover:bg-surface-alt text-text font-bold"
            >
              −
            </button>
            <input
              type="number"
              min={2}
              value={qty}
              onChange={(e) => setQty(Math.max(2, Number(e.target.value) || 2))}
              className="w-14 text-center"
            />
            <button
              type="button"
              onClick={() => setQty(qty + 1)}
              className="w-8 h-8 rounded-lg bg-surface border border-border hover:bg-surface-alt text-text font-bold"
            >
              +
            </button>
          </div>
        </label>
      </div>
      <div
        className={`p-2 rounded-lg text-sm font-bold ${ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
      >
        As prov = {qty} Ø{diam} = {fmt(asProv, 2)} cm² {okAs ? "≥" : "<"} nec{" "}
        {fmt(asNec, 2)} · ρ = {fmt(rho, 2)}%
        {okRho ? " (1–8% ✓)" : " (fuera de 1–8% ✗)"}
      </div>
      <span
        className={`text-xs font-semibold ${ok ? "text-success" : "text-danger"}`}
      >
        {ok ? "✓ VERIFICA" : "✗ NO VERIFICA"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function BasesResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showTensorForm, setShowTensorForm] = useState(false);

  const locState = location.state as LocationState | null;
  const input = locState?.input;

  // Identidad del guardado (arranca del router state, se actualiza al guardar)
  const [savedId, setSavedId] = useState<string | null>(
    locState?.loadedSaveId ?? null,
  );
  const [savedName, setSavedName] = useState<string | null>(
    locState?.loadedSaveName ?? null,
  );

  // Armadura adoptada (losas, dirección X e Y)
  const [diamX, setDiamX] = useState(12);
  const [qtyX, setQtyX] = useState(8);
  const [diamY, setDiamY] = useState(12);
  const [qtyY, setQtyY] = useState(8);

  // Datos del tensor (se completan acá si se eligió tensor)
  const [tensorH, setTensorH] = useState<number | undefined>(
    input?.H ?? undefined,
  );
  const [tensorHx, setTensorHx] = useState<number | undefined>(
    input?.Hx ?? undefined,
  );
  const [tensorHy, setTensorHy] = useState<number | undefined>(
    input?.Hy ?? undefined,
  );
  const [tensorMu, setTensorMu] = useState<number | undefined>(
    input?.mu ?? undefined,
  );

  // ─── Compute result (must be before any early return — rules of hooks) ───
  const fullInput = useMemo<BaseInput | null>(() => {
    if (!input) return null;
    return {
      ...input,
      H: tensorH,
      Hx: tensorHx,
      Hy: tensorHy,
      mu: tensorMu,
    };
  }, [input, tensorH, tensorHx, tensorHy, tensorMu]);

  const { result, calcError } = useMemo(() => {
    if (!fullInput) return { result: null, calcError: null };
    try {
      return { result: designBase(fullInput), calcError: null };
    } catch (e: unknown) {
      return {
        result: null,
        calcError: e instanceof Error ? e.message : String(e),
      };
    }
  }, [fullInput]);

  // ─── No data guard ───
  if (!input) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-text-muted">
            No hay resultados para mostrar. Complete el formulario de
            dimensionado primero.
          </p>
          <Link
            to="/bases"
            className="bg-primary text-white hover:bg-primary-hover px-4 py-1.5 rounded-lg"
          >
            Ir al formulario
          </Link>
        </div>
      </MainLayout>
    );
  }

  // ─── Error guard ───
  if (calcError || !result) {
    return (
      <MainLayout>
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-6 text-center space-y-3">
          <h2 className="text-lg font-semibold text-danger">
            Error en el cálculo
          </h2>
          <p className="text-text-muted text-sm">{calcError}</p>
          <Link
            to="/bases"
            className="inline-block bg-primary text-white hover:bg-primary-hover px-4 py-1.5 rounded-lg"
          >
            Volver al formulario
          </Link>
        </div>
      </MainLayout>
    );
  }

  const isCentrada = input.type === "centrada" || input.type === "esquina";
  const isEsquina = input.type === "esquina";
  const isMedianera =
    input.type === "medianera" ||
    input.type === "medianera-x" ||
    input.type === "medianera-y";
  const isViga = isMedianera && input.subType === "viga-de-fundacion";
  const isTensor = input.subType === "tensor" && (isMedianera || isEsquina);
  const tensorPending = result.tensorPending;

  const typeLabel =
    input.type === "medianera-x"
      ? "Medianera X"
      : input.type === "medianera-y"
        ? "Medianera Y"
        : input.type === "esquina"
          ? "Esquina"
          : isCentrada
            ? "Centrada"
            : "Medianera";

  // As nec reales (máx entre flexión y mínima)
  const asxNec = Math.max(result.Asx, result.AsMin);
  const asyNec = Math.max(result.Asy, result.AsMin);
  const cover = input.cover ?? 7;

  // ─── Save handler ───
  async function handleSave() {
    const data = { input: fullInput, result } as Record<string, unknown>;
    // Si venimos de una base guardada, actualizamos la misma (mismo id/nombre)
    if (savedId) {
      updateSave(savedId, data);
      return;
    }
    const name = prompt("Nombre para guardar estos resultados:");
    if (!name) return;
    const target = await pickObraIfNeeded();
    if (target === null) return;
    try {
      const saved = saveBeam(name, "bases", data, target);
      setSavedId(saved.id);
      setSavedName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <MainLayout>
      {/* ─── Header ─── */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
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
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text flex items-center gap-3">
              Base {typeLabel} — L<sub>x</sub> {result.Lx} × L<sub>y</sub>{" "}
              {result.Ly} × {result.h} cm
              {savedName ? (
                <span className="text-sm font-normal text-text-muted bg-surface-alt border border-border px-2.5 py-0.5 rounded-full">
                  {savedName}
                </span>
              ) : (
                <span className="text-sm font-normal text-warning bg-warning/10 border border-warning/30 px-2.5 py-0.5 rounded-full">
                  Sin guardar
                </span>
              )}
            </h1>
            <p className="text-sm text-text-muted">
              {`f'c = ${input.fc} MPa · fy = ${input.fy} MPa · σadm = ${input.qa} kN/m²`}
              {isViga &&
                ` · Viga de fundación (Lcol${isMedianera && input.type === "medianera-x" ? ` = ${input.Lcol} cm` : ` = ${input.Lcol ?? "—"} cm`})`}
              {isTensor &&
                (tensorPending ? " · Tensor: completar datos ↓" : " · Tensor")}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleSave}
            className="text-sm bg-primary text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-hover transition-colors"
          >
            Guardar resultados
          </button>
          <button
            type="button"
            onClick={() =>
              navigate("/bases", {
                state: {
                  ...(fullInput as unknown as Record<string, unknown>),
                  loadedSaveId: savedId,
                  loadedSaveName: savedName,
                },
              })
            }
            className="text-sm bg-surface-alt border border-border hover:bg-surface text-text-muted px-4 py-1.5 rounded-lg"
          >
            ← Volver
          </button>
        </div>
      </header>

      {/* ─── Resumen (datos + resultados) ─── */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
          Resumen
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DataCard
            label="P<sub>u</sub>"
            value={`${fmt(result.Pu, 1)}`}
            sub="kN"
          />
          <DataCard
            label="q<sub>u</sub>"
            value={`${fmt(result.qu, 6)}`}
            sub="kN/cm²"
          />
          <DataCard
            label="Voladizo k<sub>x</sub>"
            value={`${fmt(result.kx, 1)}`}
            sub="cm"
          />
          <DataCard
            label="Voladizo k<sub>y</sub>"
            value={`${fmt(result.ky, 1)}`}
            sub="cm"
          />
        </div>
      </section>

      {/* ─── Esquina — sistema de equilibrio ─── */}
      {isEsquina && input.subType === "viga-de-equilibrio" && (
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Esquina — vigas de equilibrio
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <DataCard
              label="e<sub>x</sub>"
              value={`${fmt(result.eX ?? 0, 1)}`}
              sub="cm"
            />
            <DataCard
              label="e<sub>y</sub>"
              value={`${fmt(result.eY ?? 0, 1)}`}
              sub="cm"
            />
            <DataCard
              label="R<sub>ux</sub>"
              value={`${fmt(result.Rux ?? 0, 1)}`}
              sub="kN"
            />
            <DataCard
              label="R<sub>uy</sub>"
              value={`${fmt(result.Ruy ?? 0, 1)}`}
              sub="kN"
            />
            <DataCard
              label="Viga X"
              value={`${fmt(result.b_vigaX ?? 0, 1)}×${fmt(result.h_vigaX ?? 0, 1)} cm`}
              sub={`As sup ${fmt(result.As_supX ?? 0, 2)} · As inf ${fmt(result.As_infX ?? 0, 2)} cm²`}
            />
            <DataCard
              label="Viga Y"
              value={`${fmt(result.b_vigaY ?? 0, 1)}×${fmt(result.h_vigaY ?? 0, 1)} cm`}
              sub={`As sup ${fmt(result.As_supY ?? 0, 2)} · As inf ${fmt(result.As_infY ?? 0, 2)} cm²`}
            />
          </div>
        </section>
      )}

      {/* ─── Verificaciones ─── */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
          Verificaciones
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <DataCard
            label="Punzonado V<sub>u</sub>"
            value={`${fmt(result.Vu_punch, 1)} kN`}
            sub={
              <span>
                φV<sub>c</sub> = {fmt(result.phiVc_punch, 1)} kN{" "}
                <Badge ok={result.punchOK} />
              </span>
            }
          />
          <DataCard
            label="Corte X V<sub>ux</sub>"
            value={`${fmt(result.Vux, 1)} kN`}
            sub={
              <span>
                φV<sub>c</sub> = {fmt(result.phiVc_beam_x, 1)} kN{" "}
                <Badge ok={result.Vux <= result.phiVc_beam_x} />
              </span>
            }
          />
          <DataCard
            label="Corte Y V<sub>uy</sub>"
            value={`${fmt(result.Vuy, 1)} kN`}
            sub={
              <span>
                φV<sub>c</sub> = {fmt(result.phiVc_beam_y, 1)} kN{" "}
                <Badge ok={result.Vuy <= result.phiVc_beam_y} />
              </span>
            }
          />
          {isTensor && !tensorPending && (
            <DataCard
              label="Rozamiento"
              value={`T<sub>u</sub> = ${fmt(
                isEsquina
                  ? Math.max(result.Tux ?? 0, result.Tuy ?? 0)
                  : result.Tu,
                1,
              )} kN`}
              sub={
                <span>
                  PD·μ = {fmt(input.PD * (input.mu ?? 0.4), 2)} kN{" "}
                  <Badge ok={result.FrictionOK} />
                </span>
              }
            />
          )}
        </div>
      </section>

      {/* ─── Armadura (adopción) ─── */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
          Armadura
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SteelEditor
            dir="X"
            asNec={asxNec}
            spread={result.Ly}
            cover={cover}
            diam={diamX}
            qty={qtyX}
            onDiam={setDiamX}
            onQty={setQtyX}
          />
          <SteelEditor
            dir="Y"
            asNec={asyNec}
            spread={result.Lx}
            cover={cover}
            diam={diamY}
            qty={qtyY}
            onDiam={setDiamY}
            onQty={setQtyY}
          />
        </div>
        <p className="text-xs text-text-muted mt-3">
          As mín = {fmt(result.AsMin, 2)} cm² · Dirección X: As nec sobre L
          <sub>x</sub> = {fmt(asxNec, 2)} cm² · Dirección Y: As nec sobre L
          <sub>y</sub> = {fmt(asyNec, 2)} cm²
        </p>
      </section>

      {/* ─── Tensores (si se eligió) ─── */}
      {isTensor && (
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Dimensionado de tensores
          </h2>
          {tensorPending && (
            <button
              type="button"
              onClick={() => setShowTensorForm(!showTensorForm)}
              className="text-xs bg-surface-alt border border-border hover:bg-surface text-text-muted px-3 py-1.5 rounded-lg mb-3"
            >
              {showTensorForm
                ? "Ocultar datos del tensor ▲"
                : "Completar datos del tensor ▼"}
            </button>
          )}

          {(!tensorPending || showTensorForm) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              {isEsquina ? (
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-semibold text-text uppercase tracking-wider">
                    Tensor X
                  </span>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">
                      H<sub>x</sub> (cm) — altura centro tensor a fondo de base
                    </span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={tensorHx ?? ""}
                      onChange={(e) =>
                        setTensorHx(
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">
                      μ — coeficiente de fricción (default 0.5)
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="1"
                      value={tensorMu ?? 0.5}
                      onChange={(e) =>
                        setTensorMu(
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                    />
                  </label>
                  {!tensorPending ? (
                    <div className="text-sm bg-surface-alt rounded-lg p-3">
                      T<sub>ux</sub> = {fmt(result.Tux ?? 0, 1)} kN →{" "}
                      <span className="font-semibold text-primary">
                        Ast nec = {fmt(result.As_tensorX ?? 0, 2)} cm²
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">
                      Completá H<sub>x</sub> para calcular la armadura.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-semibold text-text uppercase tracking-wider">
                    Tensor
                  </span>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">
                      H (cm) — altura centro tensor a fondo de base
                    </span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={tensorH ?? ""}
                      onChange={(e) =>
                        setTensorH(
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">
                      μ — coeficiente de fricción (default 0.5)
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="1"
                      value={tensorMu ?? 0.5}
                      onChange={(e) =>
                        setTensorMu(
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                    />
                  </label>
                  {!tensorPending ? (
                    <div className="text-sm bg-surface-alt rounded-lg p-3">
                      T<sub>u</sub> = {fmt(result.Tu, 1)} kN →{" "}
                      <span className="font-semibold text-primary">
                        Ast nec = {fmt(result.As_tensor, 2)} cm²
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">
                      Completá H para calcular la armadura.
                    </p>
                  )}
                </div>
              )}

              {isEsquina && (
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-semibold text-text uppercase tracking-wider">
                    Tensor Y
                  </span>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">
                      H<sub>y</sub> (cm) — altura centro tensor a fondo de base
                    </span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={tensorHy ?? ""}
                      onChange={(e) =>
                        setTensorHy(
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                    />
                  </label>
                  {!tensorPending ? (
                    <div className="text-sm bg-surface-alt rounded-lg p-3 mt-8">
                      T<sub>uy</sub> = {fmt(result.Tuy ?? 0, 1)} kN →{" "}
                      <span className="font-semibold text-primary">
                        Ast nec = {fmt(result.As_tensorY ?? 0, 2)} cm²
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">
                      Completá H<sub>y</sub> para calcular la armadura.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          {!tensorPending && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {isEsquina ? (
                <>
                  <TensorEditor
                    label="Tensor X"
                    asNec={result.As_tensorX ?? 0}
                    sugSide={Math.round(result.h_tensorX ?? 20)}
                  />
                  <TensorEditor
                    label="Tensor Y"
                    asNec={result.As_tensorY ?? 0}
                    sugSide={Math.round(result.h_tensorY ?? 20)}
                  />
                </>
              ) : (
                <TensorEditor
                  label="Tensor"
                  asNec={result.As_tensor ?? 0}
                  sugSide={Math.round(result.h_tensor ?? 20)}
                />
              )}
            </div>
          )}
          {isEsquina && !tensorPending && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
              <DataCard
                label="N (tronco)"
                value={`${fmt(result.tronco_N ?? 0, 1)}`}
                sub="kN"
              />
              <DataCard
                label="M<sub>x</sub>"
                value={`${fmt(result.tronco_Mx ?? 0, 0)}`}
                sub="kN·cm"
              />
              <DataCard
                label="M<sub>y</sub>"
                value={`${fmt(result.tronco_My ?? 0, 0)}`}
                sub="kN·cm"
              />
              <DataCard
                label="V<sub>x</sub>"
                value={`${fmt(result.tronco_Vx ?? 0, 1)}`}
                sub="kN"
              />
              <DataCard
                label="V<sub>y</sub>"
                value={`${fmt(result.tronco_Vy ?? 0, 1)}`}
                sub="kN"
              />
            </div>
          )}
        </section>
      )}

      {/* ─── Medianera — viga de fundación ─── */}
      {isViga && (
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Viga de fundación
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <DataCard
              label="Excentricidad (e)"
              value={`${fmt(result.e, 1)}`}
              sub="cm"
            />
            <DataCard
              label="M<sub>u</sub>"
              value={`${fmt(result.Mu, 1)}`}
              sub="kN·cm"
            />
            <DataCard
              label="R<sub>u</sub>"
              value={`${fmt(result.Ru, 1)}`}
              sub="kN"
            />
            <DataCard
              label="Sección viga"
              value={`${fmt(result.b_viga, 1)} × ${fmt(result.h_viga, 1)}`}
              sub="cm (b × h)"
            />
            <DataCard
              label="Altura útil viga (d)"
              value={`${fmt(result.d_viga, 1)}`}
              sub="cm"
            />
            <DataCard
              label="As sup / inf"
              value={`${fmt(result.As_sup, 2)} / ${fmt(result.As_inf, 2)}`}
              sub="cm²"
            />
          </div>
        </section>
      )}

      {/* ─── Ver cuentas ─── */}
      <section className="no-print bg-surface rounded-xl border border-border p-5">
        <details className="mt-1">
          <summary className="cursor-pointer text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text">
            Ver cuentas
          </summary>
          <pre className="mt-3 p-3 bg-surface-alt rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto max-h-[32rem] overflow-y-auto">
            {result.steps.join("\n")}
          </pre>
        </details>
      </section>

      {/* ─── Warnings ─── */}
      {result.warnings.length > 0 && (
        <section className="bg-warning/5 border border-warning/30 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-warning uppercase tracking-wider mb-3">
            Advertencias
          </h2>
          <ul className="space-y-1">
            {result.warnings.map((w, i) => (
              <li
                key={i}
                className="text-sm text-text-muted flex items-start gap-2"
              >
                <span className="text-warning font-bold shrink-0">⚠</span>
                {w}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ─── Errors ─── */}
      {result.errors.length > 0 && (
        <section className="bg-danger/5 border border-danger/30 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-danger uppercase tracking-wider mb-3">
            Errores
          </h2>
          <ul className="space-y-1">
            {result.errors.map((e, i) => (
              <li
                key={i}
                className="text-sm text-text-muted flex items-start gap-2"
              >
                <span className="text-danger font-bold shrink-0">✗</span>
                {e}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ─── Cómputo de materiales ─── */}
      <ComputoSection
        computo={computoBase({
          lxCm: result.Lx,
          lyCm: result.Ly,
          hCm: result.h,
          diamX,
          qtyX,
          diamY,
          qtyY,
          vigas: isEsquina
            ? input.subType === "viga-de-equilibrio"
              ? [
                  {
                    bCm: result.b_vigaX ?? 0,
                    hCm: result.h_vigaX ?? 0,
                    lengthCm: input.LcolX ?? 0,
                  },
                  {
                    bCm: result.b_vigaY ?? 0,
                    hCm: result.h_vigaY ?? 0,
                    lengthCm: input.LcolY ?? 0,
                  },
                ]
              : []
            : isViga
              ? [
                  {
                    bCm: result.b_viga,
                    hCm: result.h_viga,
                    lengthCm: input.Lcol ?? 0,
                  },
                ]
              : [],
        })}
        note="El hormigón incluye la viga de fundación / vigas de equilibrio. El acero de vigas y tensores queda fuera (adopción de barras pendiente)."
      />
    </MainLayout>
  );
}
