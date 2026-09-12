import { useState, useEffect, useRef, useMemo } from "react";
import ScreenHeader from "../components/ScreenHeader";
import { useLocation, useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { SavedBeams } from "@mascalculador/shared";
import {
  saveBeam,
  updateSave,
  getSavedBeams,
  deleteSave,
  loadLastRCColumnFormState,
  saveLastRCColumnFormState,
  shouldAskObraOnSave,
} from "../lib/storage";
import { pickObraIfNeeded } from "../components/ObraPicker";
import { registerAssistantForm } from "../lib/assistant/form-bus";
import { DecimalInput } from "@mascalculador/shared";
import { CONCRETE_DENSITY } from "../lib/constants";
import {
  getBeamReactions,
  listSavedColumns,
  listSavedBeams,
  type SavedColumnInfo,
  type SavedBeamInfo,
} from "../lib/beam-reaction";

export interface RCColumnState {
  fc: number;
  fy: number;
  PD: number;
  PL: number;
  lu: number;
  MxSup: number;
  MxInf: number;
  MySup: number;
  MyInf: number;
  Cx?: number;
  Cy?: number;
  betaD?: number;
  /** Raw direct PD before self-weight and contributions (for form restoration) */
  PD_direct?: number;
  /** Raw direct PL before contributions (for form restoration) */
  PL_direct?: number;
  /** Additional floor-level dead load, added on top of direct PD */
  PD_adicional?: number;
  /** Additional floor-level live load, added on top of direct PL */
  PL_adicional?: number;
  includeSelfWeight?: boolean;
  contributedColumns?: ContributedColumn[];
  contributedBeams?: ContributedBeam[];
  nEsquinas?: number;
  nCarasX?: number;
  nCarasY?: number;
  dbEsquinas?: number;
  dbCarasX?: number;
  dbCarasY?: number;
  /** Id del guardado cargado, si viene de uno existente */
  loadedSaveId?: string | null;
  loadedSaveName?: string | null;
}

interface ContributedColumn {
  id: string;
  name: string;
  PD: number;
  PL: number;
}

interface ContributedBeam {
  id: string;
  name: string;
  supportIdx: number;
  rD: number;
  rL: number;
  rU?: number;
}

/** SVG layout of the column cross section with manual bar positions */
export function ArmadoLayoutSVG({
  Cx,
  Cy,
  nCarasX,
  nCarasY,
  dbEsquinas,
  dbCarasX,
  dbCarasY,
}: {
  Cx: number;
  Cy: number;
  nCarasX: number;
  nCarasY: number;
  dbEsquinas: number;
  dbCarasX: number;
  dbCarasY: number;
}) {
  const size = 200;
  const margin = 30;
  const drawW = size - 2 * margin;
  const drawH = size - 2 * margin;

  // Scale to fit
  const scale = Math.min(drawW / Cx, drawH / Cy);
  const rectW = Cx * scale;
  const rectH = Cy * scale;
  const ox = (size - rectW) / 2;
  const oy = (size - rectH) / 2;

  // Bar radii proportional to diameter
  const barRadius = (d: number) => Math.max(3, (d * scale) / 20);
  const barREsq = barRadius(dbEsquinas);
  const barRX = barRadius(dbCarasX);
  const barRY = barRadius(dbCarasY);
  const cover = 12; // px offset from edge for bars

  // Corner positions (top-left, top-right, bottom-left, bottom-right)
  const corners = [
    { x: ox + cover, y: oy + cover },
    { x: ox + rectW - cover, y: oy + cover },
    { x: ox + cover, y: oy + rectH - cover },
    { x: ox + rectW - cover, y: oy + rectH - cover },
  ];

  // X faces: left and right edges (perpendicular to X)
  // nCarasX intermediates per face + 2 corners per face
  const xFaceLeft =
    nCarasX > 0
      ? Array.from({ length: nCarasX }, (_, i) => ({
          x: ox + cover,
          y: oy + cover + ((rectH - 2 * cover) * (i + 1)) / (nCarasX + 1),
        }))
      : [];
  const xFaceRight =
    nCarasX > 0
      ? Array.from({ length: nCarasX }, (_, i) => ({
          x: ox + rectW - cover,
          y: oy + cover + ((rectH - 2 * cover) * (i + 1)) / (nCarasX + 1),
        }))
      : [];

  // Y faces: top and bottom edges (perpendicular to Y)
  // nCarasY intermediates per face
  const yFaceTop =
    nCarasY > 0
      ? Array.from({ length: nCarasY }, (_, i) => ({
          x: ox + cover + ((rectW - 2 * cover) * (i + 1)) / (nCarasY + 1),
          y: oy + cover,
        }))
      : [];
  const yFaceBottom =
    nCarasY > 0
      ? Array.from({ length: nCarasY }, (_, i) => ({
          x: ox + cover + ((rectW - 2 * cover) * (i + 1)) / (nCarasY + 1),
          y: oy + rectH - cover,
        }))
      : [];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Section rectangle */}
      <rect
        x={ox}
        y={oy}
        width={rectW}
        height={rectH}
        fill="var(--color-surface-alt, #f3f4f6)"
        stroke="var(--color-border, #d1d5db)"
        strokeWidth={2}
      />

      {/* Stirrup (dashed rectangle around bars) */}
      <rect
        x={ox + cover - 4}
        y={oy + cover - 4}
        width={rectW - 2 * cover + 8}
        height={rectH - 2 * cover + 8}
        fill="none"
        stroke="var(--color-text-muted, #9ca3af)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />

      {/* Corner bars */}
      {corners.map((c, i) => (
        <circle
          key={`corner-${i}`}
          cx={c.x}
          cy={c.y}
          r={barREsq}
          fill="var(--color-primary, #2563eb)"
        />
      ))}

      {/* X face bars (blue) */}
      {[...xFaceLeft, ...xFaceRight].map((p, i) => (
        <circle key={`xface-${i}`} cx={p.x} cy={p.y} r={barRX} fill="#3b82f6" />
      ))}

      {/* Y face bars (green) */}
      {[...yFaceTop, ...yFaceBottom].map((p, i) => (
        <circle key={`yface-${i}`} cx={p.x} cy={p.y} r={barRY} fill="#22c55e" />
      ))}

      {/* Labels */}
      <text
        x={size / 2}
        y={oy - 6}
        textAnchor="middle"
        fontSize="10"
        fill="var(--color-text-muted, #9ca3af)"
      >
        Cx = {Cx} cm
      </text>
      <text
        x={ox - 6}
        y={oy + rectH / 2}
        textAnchor="end"
        fontSize="10"
        fill="var(--color-text-muted, #9ca3af)"
        dominantBaseline="middle"
      >
        Cy = {Cy} cm
      </text>
    </svg>
  );
}

export default function RCColumnForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as RCColumnState | null;

  const lastForm = !state ? loadLastRCColumnFormState() : null;

  const [fc, setFc] = useState<number>(state?.fc ?? lastForm?.fc ?? 25);
  const [fy, setFy] = useState<number>(state?.fy ?? lastForm?.fy ?? 420);
  // Cargas manuales a nivel de piso (P_D/P_L). Los guardados viejos traían
  // "directa" y "adicional" por separado: se pliegan en un solo par.
  const [PDAdic, setPDAdic] = useState<number>(() => {
    if (state) {
      return (state.PD_adicional ?? 0) + (state.PD_direct ?? 0);
    }
    return (lastForm?.PD_adicional ?? 0) + (lastForm?.PD ?? 0);
  });
  const [PLAdic, setPLAdic] = useState<number>(() => {
    if (state) {
      return (state.PL_adicional ?? 0) + (state.PL_direct ?? 0);
    }
    return (lastForm?.PL_adicional ?? 0) + (lastForm?.PL ?? 0);
  });
  const [lu, setLu] = useState<number>(state?.lu ?? lastForm?.lu ?? 3.0);
  const [MxSup, setMxSup] = useState<number>(
    state?.MxSup ?? lastForm?.MxSup ?? 10,
  );
  const [MxInf, setMxInf] = useState<number>(
    state?.MxInf ?? lastForm?.MxInf ?? 30,
  );
  const [MySup, setMySup] = useState<number>(
    state?.MySup ?? lastForm?.MySup ?? 0,
  );
  const [MyInf, setMyInf] = useState<number>(
    state?.MyInf ?? lastForm?.MyInf ?? 0,
  );
  const [Cx, setCx] = useState<number | undefined>(
    state?.Cx ?? lastForm?.Cx ?? 20,
  );
  const [Cy, setCy] = useState<number | undefined>(
    state?.Cy ?? lastForm?.Cy ?? 20,
  );
  const [betaD, setBetaD] = useState<number>(
    state?.betaD ?? lastForm?.betaD ?? 0.6,
  );
  const [autoDim, setAutoDim] = useState<boolean>(false);
  const [includeSelfWeight, setIncludeSelfWeight] = useState<boolean>(
    state?.includeSelfWeight ?? lastForm?.includeSelfWeight ?? false,
  );

  const [loadedSaveId, setLoadedSaveId] = useState<string | null>(
    state?.loadedSaveId ?? null,
  );
  const [loadedSaveName, setLoadedSaveName] = useState<string | null>(
    state?.loadedSaveName ?? null,
  );

  // Contributed loads from upper columns
  const [contributedColumns, setContributedColumns] = useState<
    ContributedColumn[]
  >(state?.contributedColumns ?? lastForm?.contributedColumns ?? []);

  // Contributed loads from beam support reactions
  const [contributedBeams, setContributedBeams] = useState<ContributedBeam[]>(
    state?.contributedBeams ?? lastForm?.contributedBeams ?? [],
  );

  // UI state for adding contributed loads
  const [showColumnSelect, setShowColumnSelect] = useState(false);
  const [availableColumns, setAvailableColumns] = useState<SavedColumnInfo[]>(
    [],
  );
  const [beamAddStep, setBeamAddStep] = useState<
    "hidden" | "choose-beam" | "choose-support"
  >("hidden");
  const [beamAddInfo, setBeamAddInfo] = useState<SavedBeamInfo | null>(null);
  const [availableBeams, setAvailableBeams] = useState<SavedBeamInfo[]>([]);

  // Auto predimensioning preview (uses raw loads without self-weight to avoid circular deps)
  const autoDims = useMemo(() => {
    const fcSafe = fc > 0 ? fc : 25;
    const loadsBase = Math.max(0, PDAdic + PLAdic);
    const Ag_req = Math.max((loadsBase * 10) / (0.4 * fcSafe), 400);
    const Ag = Math.max(Ag_req, 400);
    let Cx_auto = 20;
    let Cy_auto = Math.ceil(Ag / Cx_auto);
    if (Cy_auto < 20) Cy_auto = 20;
    let sanity = 0;
    while (Cx_auto * Cy_auto < Ag && sanity++ < 100) Cy_auto++;
    const aspect = Cy_auto / Cx_auto;
    if (aspect > 2.5) {
      const targetB = Math.ceil(Math.sqrt(Ag));
      Cx_auto = Math.max(20, Math.ceil(targetB * 0.7));
      Cy_auto = Math.ceil(Ag / Cx_auto);
      while (Cx_auto * Cy_auto < Ag && sanity++ < 100) Cy_auto++;
    }
    return { Cx: Cx_auto, Cy: Cy_auto, Ag: Cx_auto * Cy_auto };
  }, [PDAdic, PLAdic, fc]);

  // Self-weight
  const selfWeight = useMemo(() => {
    const bEff = Cx ?? (autoDim ? autoDims.Cx : undefined);
    const hEff = Cy ?? (autoDim ? autoDims.Cy : undefined);
    return bEff && hEff ? ((bEff * hEff) / 10000) * lu * CONCRETE_DENSITY : 0;
  }, [Cx, Cy, autoDim, autoDims.Cx, autoDims.Cy, lu]);

  // Totals: manual loads + self-weight + contributed
  const totalPD =
    PDAdic +
    (includeSelfWeight ? selfWeight : 0) +
    contributedColumns.reduce((s, c) => s + c.PD, 0) +
    contributedBeams.reduce((s, b) => s + b.rD, 0);
  const totalPL =
    PLAdic +
    contributedColumns.reduce((s, c) => s + c.PL, 0) +
    contributedBeams.reduce((s, b) => s + b.rL, 0);

  // Pu preview using total loads
  const PuPreview = useMemo(() => {
    const u1 = 1.4 * totalPD;
    const u2 = 1.2 * totalPD + 1.6 * totalPL;
    return { u1, u2, Pu: Math.max(u1, u2) };
  }, [totalPD, totalPL]);

  // Guard: skip first auto-save
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    saveLastRCColumnFormState({
      fc,
      fy,
      PD: 0,
      PL: 0,
      PD_adicional: PDAdic,
      PL_adicional: PLAdic,
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
      nEsquinas: 4,
      nCarasX: 0,
      nCarasY: 0,
      dbEsquinas: 12,
      dbCarasX: 12,
      dbCarasY: 12,
    });
  }, [
    fc,
    fy,
    PDAdic,
    PLAdic,
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
  ]);

  // ---- Asistente virtual: estado y edición asistida de la columna ----
  const assistantStateRef = useRef<Record<string, unknown>>({});
  useEffect(() => {
    assistantStateRef.current = {
      fc,
      fy,
      PD: PDAdic,
      PL: PLAdic,
      lu,
      MxSup,
      MxInf,
      MySup,
      MyInf,
      Cx,
      Cy,
      betaD,
      includeSelfWeight,
      totalPD,
      totalPL,
      nColumnasContrib: contributedColumns.length,
      nVigasContrib: contributedBeams.length,
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

    return registerAssistantForm({
      screen: "/rc-column",
      title: "Columna de hormigón",
      fieldDocs: `Campos (nombres exactos, unidades de UI):
- PD, PL: cargas manuales a nivel de piso (muerta y viva) en kN. Las contribuciones de columnas/vigas guardadas se suman automáticamente (ver totalPD/totalPL en el estado).
- lu: altura libre de la columna en metros.
- MxSup, MxInf, MySup, MyInf: momentos flectores en kN·m. X=flexión en X, Y=flexión en Y; Sup=cabeza, Inf=base.
- Cx, Cy: dimensiones de la columna en cm.
- betaD: factor beta (0 a 1).
- fc: hormigón en MPa; solo 20, 25, 30 o 35. fy: acero en MPa; 420 o 500.
- includeSelfWeight: boolean (suma el peso propio al P total).`,
      getState: () => assistantStateRef.current,
      apply: (values) => {
        const applied: string[] = [];
        const errors: string[] = [];
        for (const [key, raw] of Object.entries(values)) {
          switch (key) {
            case "PD": {
              const v = num(raw);
              if (v === null || v < 0) {
                errors.push("PD: se esperaba un número >= 0 (kN)");
                break;
              }
              setPDAdic(v);
              applied.push("PD");
              break;
            }
            case "PL": {
              const v = num(raw);
              if (v === null || v < 0) {
                errors.push("PL: se esperaba un número >= 0 (kN)");
                break;
              }
              setPLAdic(v);
              applied.push("PL");
              break;
            }
            case "lu": {
              const v = num(raw);
              if (v === null || v <= 0) {
                errors.push("lu: se esperaba un número > 0 (m)");
                break;
              }
              setLu(v);
              applied.push("lu");
              break;
            }
            case "MxSup":
            case "MxInf":
            case "MySup":
            case "MyInf": {
              const v = num(raw);
              if (v === null || v < 0) {
                errors.push(`${key}: se esperaba un número >= 0 (kN·m)`);
                break;
              }
              if (key === "MxSup") setMxSup(v);
              else if (key === "MxInf") setMxInf(v);
              else if (key === "MySup") setMySup(v);
              else setMyInf(v);
              applied.push(key);
              break;
            }
            case "Cx":
            case "Cy": {
              const v = num(raw);
              if (v === null || v <= 0) {
                errors.push(`${key}: se esperaba un número > 0 (cm)`);
                break;
              }
              if (key === "Cx") setCx(v);
              else setCy(v);
              applied.push(key);
              break;
            }
            case "betaD": {
              const v = num(raw);
              if (v === null || v < 0 || v > 1) {
                errors.push("betaD: número entre 0 y 1");
                break;
              }
              setBetaD(v);
              applied.push("betaD");
              break;
            }
            case "fc": {
              const v = num(raw);
              if (v === null || ![20, 25, 30, 35].includes(v)) {
                errors.push("fc: solo 20, 25, 30 o 35 (MPa)");
                break;
              }
              setFc(v);
              applied.push("fc");
              break;
            }
            case "fy": {
              const v = num(raw);
              if (v === null || ![420, 500].includes(v)) {
                errors.push("fy: solo 420 o 500 (MPa)");
                break;
              }
              setFy(v);
              applied.push("fy");
              break;
            }
            case "includeSelfWeight": {
              const truthy =
                raw === true ||
                raw === 1 ||
                raw === "1" ||
                raw === "true" ||
                raw === "si" ||
                raw === "sí";
              const falsy =
                raw === false ||
                raw === 0 ||
                raw === "0" ||
                raw === "false" ||
                raw === "no";
              if (!truthy && !falsy) {
                errors.push("includeSelfWeight: true o false");
                break;
              }
              setIncludeSelfWeight(truthy);
              applied.push("includeSelfWeight");
              break;
            }
            default:
              errors.push(`campo desconocido: ${key}`);
          }
        }
        return { applied, errors };
      },
      save: async ({ name }) => {
        const trimmed = name.trim();
        if (!trimmed) return { applied: [], errors: ["se requiere un nombre"] };
        if (shouldAskObraOnSave()) {
          return {
            applied: [],
            errors: [
              'la obra activa es "Sin obra": avisale al usuario que elija una obra y volvé a intentar',
            ],
          };
        }
        const data: Record<string, unknown> = {
          fc,
          fy,
          PD: totalPD,
          PL: totalPL,
          PD_direct: 0,
          PL_direct: 0,
          PD_adicional: PDAdic,
          PL_adicional: PLAdic,
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
        };
        try {
          if (loadedSaveId) {
            updateSave(loadedSaveId, data);
            return {
              applied: [`guardado actualizado: ${loadedSaveName ?? ""}`],
              errors: [],
            };
          }
          const saved = saveBeam(trimmed, "rc-columna", data);
          setLoadedSaveId(saved.id);
          setLoadedSaveName(trimmed);
          return {
            applied: [`guardado en la obra activa como "${trimmed}"`],
            errors: [],
          };
        } catch (err) {
          return {
            applied: [],
            errors: [err instanceof Error ? err.message : "error al guardar"],
          };
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registro único por montaje
  }, []);

  async function handleSave() {
    const data: Record<string, unknown> = {
      fc,
      fy,
      PD: totalPD,
      PL: totalPL,
      PD_direct: 0,
      PL_direct: 0,
      PD_adicional: PDAdic,
      PL_adicional: PLAdic,
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
    };

    if (loadedSaveId) {
      updateSave(loadedSaveId, data);
      return;
    }

    const name = prompt("Nombre para guardar esta columna:");
    if (!name) return;
    const target = await pickObraIfNeeded();
    if (target === null) return;
    try {
      const saved = saveBeam(name, "rc-columna", data, target);
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
    if (typeof d.fc === "number") setFc(d.fc);
    if (typeof d.fy === "number") setFy(d.fy);
    if (typeof d.lu === "number") setLu(d.lu);
    if (typeof d.MxSup === "number") setMxSup(d.MxSup);
    if (typeof d.MxInf === "number") setMxInf(d.MxInf);
    if (typeof d.MySup === "number") setMySup(d.MySup);
    if (typeof d.MyInf === "number") setMyInf(d.MyInf);
    if (typeof d.Cx === "number") setCx(d.Cx);
    if (typeof d.Cy === "number") setCy(d.Cy);
    if (typeof d.betaD === "number") setBetaD(d.betaD);
    if (typeof d.includeSelfWeight === "boolean")
      setIncludeSelfWeight(d.includeSelfWeight);
    // Backward compat: load old b/h if present
    if (typeof d.Cx !== "number" && typeof d.b === "number") setCx(d.b);
    if (typeof d.Cy !== "number" && typeof d.h === "number") setCy(d.h);
    // Backward compat: load old M1u/M2u if present
    if (typeof d.MxSup !== "number" && typeof d.M1u === "number")
      setMxSup(d.M1u as number);
    if (typeof d.MxInf !== "number" && typeof d.M2u === "number")
      setMxInf(d.M2u as number);
    const pdAdicSave = d.PD_adicional as number | undefined;
    const plAdicSave = d.PL_adicional as number | undefined;
    const pdDirectSave = d.PD_direct as number | undefined;
    const plDirectSave = d.PL_direct as number | undefined;
    const pdSave = d.PD as number | undefined;
    const plSave = d.PL as number | undefined;
    if (
      pdDirectSave === undefined &&
      plDirectSave === undefined &&
      typeof d.nEsquinas !== "number" &&
      typeof pdSave === "number"
    ) {
      // Guardado viejo del FORM: PD/PL eran las cargas manuales directas →
      // se pliegan tal cual al nuevo modelo (adicionales = manuales).
      setPDAdic(pdAdicSave ?? pdSave);
      setPLAdic(plAdicSave ?? plSave ?? 0);
    } else {
      // Guardado nuevo (directa=0): manual = adicional + directa plegada
      if (pdAdicSave !== undefined || pdDirectSave !== undefined)
        setPDAdic((pdAdicSave ?? 0) + (pdDirectSave ?? 0));
      if (plAdicSave !== undefined || plDirectSave !== undefined)
        setPLAdic((plAdicSave ?? 0) + (plDirectSave ?? 0));
    }
    // Legacy repair — SOLO guardados hechos desde RESULTADOS (se detectan por
    // los campos de armado que solo ellos persisten): ahí PD/PL se guardaron
    // como TOTALES con reacciones/columnas contribuidas también por separado
    // → al recargar se contaban doble y al borrar una viga el total no bajaba
    // (el valor quedaba cocinado en PD/PL). Recuperar lo manual restando lo
    // contribuido y plegarlo a las cargas manuales.
    if (
      typeof d.PD_direct !== "number" &&
      typeof d.PL_direct !== "number" &&
      typeof d.nEsquinas === "number"
    ) {
      let sumD = 0;
      let sumL = 0;
      if (Array.isArray(d.contributedBeams)) {
        for (const b of d.contributedBeams as ContributedBeam[]) {
          sumD += b.rD ?? 0;
          sumL += b.rL ?? 0;
        }
      }
      if (Array.isArray(d.contributedColumns)) {
        for (const c of d.contributedColumns as ContributedColumn[]) {
          sumD += c.PD ?? 0;
          sumL += c.PL ?? 0;
        }
      }
      // El peso propio también quedó cocinado en PD de esos guardados:
      // si la columna lo incluía, restarlo para no sumarlo dos veces.
      if (d.includeSelfWeight) {
        const cx = (d.Cx as number | undefined) ?? 0;
        const cy = (d.Cy as number | undefined) ?? 0;
        const luD = (d.lu as number | undefined) ?? 0;
        if (cx > 0 && cy > 0) {
          sumD += ((cx * cy) / 10000) * luD * CONCRETE_DENSITY;
        }
      }
      if (sumD > 0 && typeof pdSave === "number")
        setPDAdic((v) => v + (pdSave - sumD));
      if (sumL > 0 && typeof plSave === "number")
        setPLAdic((v) => v + (plSave - sumL));
    }
    if (
      d.Cx !== undefined ||
      d.Cy !== undefined ||
      d.b !== undefined ||
      d.h !== undefined
    )
      setAutoDim(false);
    if (Array.isArray(d.contributedColumns)) {
      setContributedColumns(
        d.contributedColumns as unknown as ContributedColumn[],
      );
    }
    if (Array.isArray(d.contributedBeams)) {
      // Recalcular las reacciones desde las vigas guardadas (por id): así los
      // valores viejos (inflados por el bug de unidades) se actualizan solos
      // al cargar la columna.
      setContributedBeams(
        (d.contributedBeams as unknown as ContributedBeam[]).map((b) => {
          const r = b.id ? getBeamReactions(b.id) : null;
          if (r && b.supportIdx >= 0 && b.supportIdx < r.supportCount) {
            return {
              ...b,
              rD: r.dReactions[b.supportIdx],
              rL: r.lReactions[b.supportIdx],
              rU: r.uReactions[b.supportIdx],
            };
          }
          return b;
        }),
      );
    }
  }

  function removeContributedColumn(index: number) {
    setContributedColumns((prev) => prev.filter((_, i) => i !== index));
  }

  function removeContributedBeam(index: number) {
    setContributedBeams((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddColumn() {
    setAvailableColumns(listSavedColumns());
    setShowColumnSelect(true);
  }

  function handleSelectColumn(saveId: string) {
    const col = availableColumns.find((c) => c.id === saveId);
    if (!col) return;
    setContributedColumns((prev) => [
      ...prev,
      { id: col.id, name: col.name, PD: col.PD, PL: col.PL },
    ]);
    setShowColumnSelect(false);
  }

  function handleAddBeam() {
    setAvailableBeams(listSavedBeams());
    setBeamAddStep("choose-beam");
  }

  function handleSelectBeam(beamId: string) {
    const beam = availableBeams.find((b) => b.id === beamId);
    if (!beam) return;
    setBeamAddInfo(beam);
    setBeamAddStep("choose-support");
  }

  function handleSelectSupport(supportIdx: number) {
    if (!beamAddInfo) return;
    const reactions = getBeamReactions(beamAddInfo.id);
    if (!reactions || supportIdx < 0 || supportIdx >= reactions.supportCount) {
      setBeamAddStep("hidden");
      setBeamAddInfo(null);
      return;
    }
    setContributedBeams((prev) => [
      ...prev,
      {
        id: beamAddInfo.id,
        name: reactions.beamName,
        supportIdx,
        rD: reactions.dReactions[supportIdx],
        rL: reactions.lReactions[supportIdx],
        rU: reactions.uReactions[supportIdx],
      },
    ]);
    setBeamAddStep("hidden");
    setBeamAddInfo(null);
  }

  function handleNew() {
    setFc(25);
    setFy(420);
    setPDAdic(0);
    setPLAdic(0);
    setLu(3.0);
    setMxSup(10);
    setMxInf(30);
    setMySup(0);
    setMyInf(0);
    setCx(20);
    setCy(20);
    setBetaD(0.6);
    setAutoDim(false);
    setIncludeSelfWeight(false);
    setContributedColumns([]);
    setContributedBeams([]);
    setLoadedSaveId(null);
    setLoadedSaveName(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rcState: RCColumnState = {
      fc,
      fy,
      PD: totalPD,
      PL: totalPL,
      lu,
      MxSup,
      MxInf,
      MySup,
      MyInf,
      Cx: autoDim ? undefined : Cx,
      Cy: autoDim ? undefined : Cy,
      betaD,
      PD_direct: 0,
      PL_direct: 0,
      PD_adicional: PDAdic,
      PL_adicional: PLAdic,
      includeSelfWeight,
      contributedColumns,
      contributedBeams,
      loadedSaveId,
      loadedSaveName,
    };
    navigate("/rc-column-results", { state: rcState });
  }

  return (
    <MainLayout>
      <ScreenHeader
        title="Dimensionado de Columnas"
        subtitle="CIRSOC 201"
        badge={
          loadedSaveName
            ? {
                label: /^\d+$/.test(loadedSaveName)
                  ? `Columna Nº ${loadedSaveName}`
                  : loadedSaveName,
                tone: "saved",
              }
            : { label: "Sin guardar", tone: "unsaved" }
        }
        actions={
          <button
            type="button"
            onClick={handleNew}
            className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-text-muted transition-colors hover:bg-surface-alt hover:text-text active:translate-y-px"
          >
            + Nueva
          </button>
        }
      />

      <SavedBeams
        app="concrete"
        type="rc-columna"
        listSaves={() => getSavedBeams("rc-columna")}
        deleteSave={(id) => deleteSave(id)}
        onLoad={handleLoad}
        label="Columnas guardadas"
      />

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        className="flex flex-col gap-6"
      >
        {/* Materiales */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="section-title mb-4">Materiales</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                f'<sub>c</sub> (MPa)
              </span>
              <select
                value={fc}
                onChange={(e) => setFc(Number(e.target.value))}
              >
                <option value={20}>20 (H-20)</option>
                <option value={25}>25 (H-25)</option>
                <option value={30}>30 (H-30)</option>
                <option value={35}>35 (H-35)</option>
                <option value={40}>40 (H-40)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                f<sub>y</sub> (MPa)
              </span>
              <select
                value={fy}
                onChange={(e) => setFy(Number(e.target.value))}
              >
                <option value={420}>420 (ADN 420)</option>
                <option value={500}>500 (ADN 500)</option>
              </select>
            </label>
          </div>
        </section>

        {/* Cargas (a nivel de piso) */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="section-title mb-4">Cargas (a nivel de piso)</h2>

          {/* Axial loads row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                P<sub>D</sub> (kN)
              </span>
              <DecimalInput value={PDAdic} onChange={setPDAdic} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                P<sub>L</sub> (kN)
              </span>
              <DecimalInput value={PLAdic} onChange={setPLAdic} />
            </label>
          </div>

          {/* Biaxial moments — grid 2×2 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                M<sub>x</sub> sup (kN·m)
              </span>
              <DecimalInput value={MxSup} onChange={setMxSup} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                M<sub>x</sub> inf (kN·m)
              </span>
              <DecimalInput value={MxInf} onChange={setMxInf} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                M<sub>y</sub> sup (kN·m)
              </span>
              <DecimalInput value={MySup} onChange={setMySup} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                M<sub>y</sub> inf (kN·m)
              </span>
              <DecimalInput value={MyInf} onChange={setMyInf} />
            </label>
          </div>

          {/* Self-weight checkbox and bar — always visible, uses auto dims when in auto mode */}
          <div className="flex items-center gap-2 mt-1">
            <input
              type="checkbox"
              id="includeSelfWeight"
              checked={includeSelfWeight}
              onChange={(e) => setIncludeSelfWeight(e.target.checked)}
            />
            <label
              htmlFor="includeSelfWeight"
              className="text-xs text-text-muted cursor-pointer"
            >
              Incluir peso propio
              {selfWeight > 0 && (
                <span className="ml-1 text-primary">
                  (D = {selfWeight.toFixed(2)} kN{autoDim ? ", estimado" : ""})
                </span>
              )}
            </label>
          </div>
          {includeSelfWeight && selfWeight > 0 && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                Peso propio {autoDim && "(estimado)"}
              </span>
              <span className="text-xs text-text-muted">
                D = {selfWeight.toFixed(2)} kN
              </span>
              <span className="text-xs text-text-muted">|</span>
              <span className="text-xs text-text-muted">
                {autoDim
                  ? `${autoDims.Cx}×${autoDims.Cy} cm`
                  : `${Cx}×${Cy} cm`}{" "}
                × {lu} m × 25 kN/m³
              </span>
              <button
                type="button"
                onClick={() => setIncludeSelfWeight(false)}
                className="ml-auto text-danger hover:text-danger/80 text-sm px-2 py-1"
              >
                ✕
              </button>
            </div>
          )}
        </section>

        {/* Cargas de columnas superiores */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Columnas superiores</h2>
            <button
              type="button"
              onClick={handleAddColumn}
              className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
            >
              + Agregar
            </button>
          </div>

          {showColumnSelect && (
            <div className="mb-3">
              <select
                className="w-full"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) handleSelectColumn(e.target.value);
                }}
              >
                <option value="" disabled>
                  Seleccionar columna guardada...
                </option>
                {availableColumns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (
                    {c.type === "acero-columna" ? "Acero" : "Hormigón"}) — P
                    <sub>D</sub>={c.PD.toFixed(1)}, P<sub>L</sub>=
                    {c.PL.toFixed(1)} kN
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowColumnSelect(false)}
                className="text-xs text-text-muted mt-1 hover:text-text"
              >
                Cancelar
              </button>
            </div>
          )}

          {contributedColumns.length === 0 && !showColumnSelect && (
            <p className="text-xs text-text-muted">Sin columnas superiores.</p>
          )}

          <div className="flex flex-col gap-2">
            {contributedColumns.map((col, i) => (
              <div
                key={`${col.id}-${i}`}
                className="flex items-center gap-2 p-2 bg-surface-alt rounded-lg"
              >
                <span className="text-sm flex-1">{col.name}</span>
                <span className="text-xs text-text-muted">
                  P<sub>D</sub>={col.PD.toFixed(1)} kN &nbsp;|&nbsp; P
                  <sub>L</sub>={col.PL.toFixed(1)} kN
                </span>
                <button
                  type="button"
                  onClick={() => removeContributedColumn(i)}
                  className="text-xs text-danger hover:text-danger/80 px-2 py-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {contributedColumns.length > 0 && (
            <div className="mt-2 text-xs text-text-muted">
              Total columnas: P<sub>D</sub>=
              {contributedColumns.reduce((s, c) => s + c.PD, 0).toFixed(1)} kN,
              P<sub>L</sub>=
              {contributedColumns.reduce((s, c) => s + c.PL, 0).toFixed(1)} kN
            </div>
          )}
        </section>

        {/* Reacciones de vigas */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Reacciones de vigas</h2>
            <button
              type="button"
              onClick={handleAddBeam}
              className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
            >
              + Agregar
            </button>
          </div>

          {beamAddStep === "choose-beam" && (
            <div className="mb-3">
              <select
                className="w-full"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) handleSelectBeam(e.target.value);
                }}
              >
                <option value="" disabled>
                  Seleccionar viga guardada...
                </option>
                {availableBeams.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.type === "acero-viga" ? "Acero" : "Hormigón"},{" "}
                    {b.supportCount} apoyos)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setBeamAddStep("hidden")}
                className="text-xs text-text-muted mt-1 hover:text-text"
              >
                Cancelar
              </button>
            </div>
          )}

          {beamAddStep === "choose-support" && beamAddInfo && (
            <div className="mb-3">
              <select
                className="w-full"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value !== "")
                    handleSelectSupport(parseInt(e.target.value));
                }}
              >
                <option value="" disabled>
                  Seleccionar apoyo ({beamAddInfo.name})...
                </option>
                {Array.from({ length: beamAddInfo.supportCount }, (_, i) => (
                  <option key={i} value={i}>
                    Apoyo {i + 1}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setBeamAddStep("hidden");
                  setBeamAddInfo(null);
                }}
                className="text-xs text-text-muted mt-1 hover:text-text"
              >
                Cancelar
              </button>
            </div>
          )}

          {contributedBeams.length === 0 && beamAddStep === "hidden" && (
            <p className="text-xs text-text-muted">Sin reacciones de vigas.</p>
          )}

          <div className="flex flex-col gap-2">
            {contributedBeams.map((beam, i) => (
              <div
                key={`${beam.id}-${beam.supportIdx}-${i}`}
                className="flex items-center gap-2 p-2 bg-surface-alt rounded-lg"
              >
                <span className="text-sm flex-1">
                  {beam.name}
                  <span className="text-xs text-text-muted ml-1">
                    (Apoyo {beam.supportIdx + 1})
                  </span>
                </span>
                <span className="text-xs text-text-muted">
                  R<sub>D</sub>={beam.rD.toFixed(1)} kN &nbsp;|&nbsp; R
                  <sub>L</sub>={beam.rL.toFixed(1)} kN
                </span>
                <button
                  type="button"
                  onClick={() => removeContributedBeam(i)}
                  className="text-xs text-danger hover:text-danger/80 px-2 py-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {contributedBeams.length > 0 && (
            <div className="mt-2 text-xs text-text-muted">
              Total reacciones: R<sub>D</sub>=
              {contributedBeams.reduce((s, b) => s + b.rD, 0).toFixed(1)} kN, R
              <sub>L</sub>=
              {contributedBeams.reduce((s, b) => s + b.rL, 0).toFixed(1)} kN
            </div>
          )}
        </section>

        {/* Total combinado */}
        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-xs text-text-muted">
            Carga total = cargas + peso propio + columnas superiores +
            reacciones de vigas
          </span>
          <p className="text-lg font-bold text-primary mt-1">
            P<sub>D</sub>={totalPD.toFixed(1)} + P<sub>L</sub>=
            {totalPL.toFixed(1)} → P<sub>u</sub> = {PuPreview.Pu.toFixed(1)} kN
          </p>
          <p className="text-xs text-text-muted mt-1 space-y-0.5">
            P<sub>D</sub> = cargas {PDAdic.toFixed(1)} + peso propio{" "}
            {(includeSelfWeight ? selfWeight : 0).toFixed(1)} + columnas{" "}
            {contributedColumns.reduce((s, c) => s + c.PD, 0).toFixed(1)} +
            vigas {contributedBeams.reduce((s, b) => s + b.rD, 0).toFixed(1)}
            <br />P<sub>L</sub> = cargas {PLAdic.toFixed(1)} + columnas{" "}
            {contributedColumns.reduce((s, c) => s + c.PL, 0).toFixed(1)} +
            vigas {contributedBeams.reduce((s, b) => s + b.rL, 0).toFixed(1)}
          </p>
        </div>

        {/* Geometría */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="section-title mb-4">Geometría</h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="autoDim"
                checked={autoDim}
                onChange={(e) => {
                  setAutoDim(e.target.checked);
                  if (e.target.checked) {
                    setCx(undefined);
                    setCy(undefined);
                    setIncludeSelfWeight(false);
                  } else {
                    setCx(autoDims.Cx);
                    setCy(autoDims.Cy);
                  }
                }}
              />
              <label
                htmlFor="autoDim"
                className="text-xs text-text-muted cursor-pointer"
              >
                Predimensionar automáticamente
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">
                  l<sub>u</sub> (m)
                </span>
                <DecimalInput value={lu} onChange={setLu} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">
                  Cx (cm) {autoDim && "(auto)"}
                </span>
                {autoDim ? (
                  <span className="text-sm font-semibold bg-primary/10 text-primary rounded px-2 py-1.5">
                    {autoDims.Cx}
                  </span>
                ) : (
                  <DecimalInput value={Cx ?? 20} onChange={(v) => setCx(v)} />
                )}
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">
                  Cy (cm) {autoDim && "(auto)"}
                </span>
                {autoDim ? (
                  <span className="text-sm font-semibold bg-primary/10 text-primary rounded px-2 py-1.5">
                    {autoDims.Cy}
                  </span>
                ) : (
                  <DecimalInput value={Cy ?? 20} onChange={(v) => setCy(v)} />
                )}
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                β<sub>d</sub> (creep, opcional)
              </span>
              <DecimalInput value={betaD} onChange={setBetaD} />
            </label>
            {!autoDim && (
              <p className="text-xs text-text-muted">
                Si no se especifican Cx y Cy, se predimensionan automáticamente
                según las cargas.
              </p>
            )}
          </div>
        </section>

        <div className="self-center flex gap-3">
          <button
            type="submit"
            className="bg-primary text-white font-semibold px-8 py-3 rounded-lg hover:bg-primary-hover transition-colors"
          >
            Calcular
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="bg-surface-alt border border-border text-text-muted font-semibold px-6 py-3 rounded-lg hover:bg-surface transition-colors"
          >
            Guardar
          </button>
        </div>
      </form>
    </MainLayout>
  );
}
