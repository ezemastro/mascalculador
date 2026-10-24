import type { SavedBeam, SavedSupportData, SavedCompatData } from "./storage";
import { loadSlab, getCompatReinf } from "./storage";
import type {
  SupportType,
  SlabInput,
  SlabResult,
  DirectionResult,
  EdgeCondition,
  BaseTensorAdopcion,
} from "@mascalculador/shared";
import { calculateBeamEnvelope } from "./beam-envelope";
import { designSlab } from "./slab-calc";
import { computeDeflections } from "./deflection";
import { CONCRETE_DENSITY } from "./constants";
import type { BaseInput, BaseResult, BaseType } from "./bases-calc";
import { designBase, designVigaCabezal } from "./bases-calc";
import { designRCColumn } from "./rc-column-calc";
import type { MuroInput, MuroResult, MuroBarSelection } from "./muro-calc";
import type { PileCapInput, PileCapResult } from "./pilecap-calc";

export interface PlanillaColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
  /** Celda con varios renglones separados por "\n" (se imprimen tal cual). */
  multiline?: boolean;
}

export interface PlanillaSheet {
  title: string;
  subtitle?: string;
  columns: PlanillaColumn[];
  /** Celdas pre-formateadas, alineadas con `columns`. Una fila por tramo. */
  rows: PlanillaCell[][];
  countLabel: string;
  notes?: string[];
}

/** Celda rica que pide un dibujo de planta de losa en la planilla. */
export interface SlabPlanCell {
  kind: "slab-plan";
  lx: number;
  ly: number;
  edges: [EdgeCondition, EdgeCondition, EdgeCondition, EdgeCondition];
}

/** Celda rica que pide el esquema estático de un tramo de viga. */
export interface BeamSchemeCell {
  kind: "beam-scheme";
  left: SupportType;
  right: SupportType;
}

/** Celda rica que pide el dibujo en planta de una base (columna dentro del
 *  zapato) en la planilla. */
export interface BasePlanCell {
  kind: "base-plan";
  type: BaseType;
  Lx: number;
  Ly: number;
  cx: number;
  cy: number;
}

/** Celda de planilla: texto plano, planta de losa, esquema de viga o planta de base. */
export type PlanillaCell =
  | string
  | SlabPlanCell
  | BeamSchemeCell
  | BasePlanCell;

// ---- Vigas H° A° (tipo "hormigon") ----

const BAR_AREA: Record<number, number> = {
  6: 28,
  8: 50,
  10: 79,
  12: 113,
  16: 201,
  20: 314,
  25: 491,
};

function arr<T>(n: number, fill: T): T[] {
  return Array.from({ length: n }, () => fill);
}

/** Acepta escalares (guardados viejos) o arrays; completa/recorta a n. */
function nArr<T>(v: T[] | T | undefined, n: number, dflt: T): T[] {
  if (v == null) return arr(n, dflt);
  if (Array.isArray(v)) {
    return v.length >= n ? v.slice(0, n) : [...v, ...arr(n - v.length, dflt)];
  }
  return arr(n, v);
}

/** Migra armaduras de apoyo guardadas a índice absoluto de apoyo. Los
 *  guardados viejos guardaban solo apoyos interiores (j → apoyo j+1); los
 *  nuevos guardan por índice absoluto (longitud = nSupports). */
function migrateSup<T>(
  v: T[] | T | undefined,
  nSupports: number,
  dflt: T,
): T[] {
  if (v == null) return arr(nSupports, dflt);
  const src = Array.isArray(v) ? v : [v];
  if (src.length >= nSupports) return src.slice(0, nSupports);
  const out = arr(nSupports, dflt);
  for (let j = 0; j < src.length; j++) out[j + 1] = src[j];
  return out;
}

function barArea(diam: number | undefined): number {
  return diam != null && BAR_AREA[diam] ? BAR_AREA[diam] : 0;
}

function rebar(qty: number | undefined, diam: number | undefined): string {
  return qty != null && qty > 0 && diam ? `${qty}Ø${diam}` : "—";
}

function stirrupText(
  diam: number | undefined,
  spacing: number | undefined,
  legs: number | undefined,
): string {
  const s = (spacing || 200) / 10;
  return `${diam ? `Ø${diam}` : "—"} c/${s.toFixed(0)} ${legs || 2}r`;
}

const fmt1 = (x: number): string => x.toFixed(1);
const fmt2 = (x: number): string => x.toFixed(2);

function fmtLoad(
  l: {
    type: "point" | "distributed";
    D: number;
    L: number;
    position?: number;
    start?: number;
    end?: number;
  },
  beamLength: number,
): string {
  if (l.type === "point") {
    return `P ${fmt2(l.D ?? 0)}/${fmt2(l.L ?? 0)} kN x=${fmt1(l.position ?? 0)} m`;
  }
  return `q ${fmt2(l.D ?? 0)}/${fmt2(l.L ?? 0)} kN/m (${fmt1(l.start ?? 0)}→${fmt1(l.end ?? beamLength)} m)`;
}

interface VigaSaveData {
  spans?: number[];
  supportTypes?: SupportType[];
  concreteLoads?: Array<{
    type: "point" | "distributed";
    D: number;
    L: number;
    position?: number;
    start?: number;
    end?: number;
  }>;
  bw?: number;
  h?: number;
  cover?: number;
  fc?: number;
  fy?: number;
  includeSelfWeight?: boolean;
  directSupport?: boolean;
  barQty?: number[] | number;
  barDiam?: number[] | number;
  compBarQty?: number[] | number;
  compBarDiam?: number[] | number;
  stirrupLegs?: number[] | number;
  stirrupDiam?: number[] | number;
  stirrupSpacing?: number[] | number;
  supBarQty?: number[] | number;
  supBarDiam?: number[] | number;
  supportWidths?: number[];
  sustainedPct?: number;
  timeFactor?: number;
  ieMethod?: "branson" | "bischoff";
}

const VIGA_COLUMNS: PlanillaColumn[] = [
  { key: "elem", label: "Elemento", width: "8%" },
  { key: "scheme", label: "Esquema", width: "11%", align: "center" },
  { key: "section", label: "Sección (cm)" },
  { key: "mat", label: "f'c/fy (MPa)" },
  { key: "loads", label: "Cargas D/L", width: "19%" },
  { key: "mp", label: "M⁺ (kN·m)", align: "right" },
  { key: "mneg", label: "M⁻ izq/der (kN·m)", align: "right" },
  { key: "mv", label: "V (kN)", align: "right" },
  { key: "reinft", label: "Aª inferior" },
  { key: "reinfL", label: "Aª sup izq" },
  { key: "reinfR", label: "Aª sup der" },
  { key: "stirrup", label: "Estribos", width: "7%" },
  { key: "flechaLL", label: "ΔLL / L·360 (mm)", align: "right" },
  { key: "flechaT", label: "Δtotal / L·240 (mm)", align: "right" },
];

/**
 * Recalcula la misma envolvente y diseño que ConcreteResults sobre el
 * guardado (el save ya trae input + armaduras provistas) y aplana CADA TRAMO
 * a una fila de planilla (V1 · T1, V1 · T2, ...). La armadura superior se
 * reporta por lado: apoyo izquierdo/derecho del tramo. Lanza si el guardado
 * está corrupto.
 */
function buildVigaRows(save: SavedBeam): PlanillaCell[][] {
  const d = save.data as unknown as VigaSaveData;
  const spans = d.spans;
  if (!Array.isArray(spans) || spans.length === 0) {
    throw new Error("Sin tramos");
  }
  const n = spans.length;
  const supportTypes = d.supportTypes ?? [];
  const bw = d.bw ?? 0;
  const h = d.h ?? 0;
  const cover = d.cover ?? 0;
  const fc = d.fc ?? 0;
  const fy = d.fy ?? 0;
  const loads = d.concreteLoads ?? [];
  const supportWidths = d.supportWidths ?? [];

  const selfWeight = d.includeSelfWeight
    ? ((bw * h) / 1e6) * CONCRETE_DENSITY
    : 0;

  const envelope = calculateBeamEnvelope(
    spans,
    supportTypes,
    loads,
    selfWeight,
  );

  const qtyArr = nArr(d.barQty, n, 3);
  const diamArr = nArr(d.barDiam, n, 16);
  const compQtyArr = nArr(d.compBarQty, n, 0);
  const compDiamArr = nArr(d.compBarDiam, n, 12);
  const stirrupDiamArr = nArr(d.stirrupDiam, n, 8);
  const stirrupSpacingArr = nArr(d.stirrupSpacing, n, 200);
  const stirrupLegsArr = nArr(d.stirrupLegs, n, 2);
  const supQtyArr = migrateSup(d.supBarQty, n + 1, 3);
  const supDiamArr = migrateSup(d.supBarDiam, n + 1, 16);

  const spanMu: number[] = [];
  const spanVu: number[] = [];
  const spanReinf: string[] = [];
  const spanStirrup: string[] = [];

  for (let i = 0; i < n; i++) {
    spanMu.push(envelope.spanMuPos[i]);
    spanVu.push(envelope.spanVu[i]);
    spanReinf.push(rebar(qtyArr[i], diamArr[i]));
    spanStirrup.push(
      stirrupText(stirrupDiamArr[i], stirrupSpacingArr[i], stirrupLegsArr[i]),
    );
  }

  // Apoyos con armadura superior: interiores + extremos empotrados (voladizos),
  // por índice absoluto de apoyo. Se reportan por lado en cada tramo adyacente.
  const sups = new Map<number, string>();
  for (let idx = 0; idx < n + 1; idx++) {
    if (supportTypes[idx] === "free") continue;
    const Mneg = envelope.supportMuNeg[idx] ?? 0;
    if (Mneg <= 1e-6) continue;
    sups.set(idx, rebar(supQtyArr[idx], supDiamArr[idx]));
  }

  const loadText =
    loads.length > 0
      ? loads
          .map((l) =>
            fmtLoad(
              l,
              spans.reduce((a, b) => a + b, 0),
            ),
          )
          .join(" · ")
      : "—";
  const section = `${bw / 10}×${h / 10}`;
  const mat = `${fc}/${fy}`;

  // Flechas de servicio (sección fisurada) con los parámetros guardados
  let defl: ReturnType<typeof computeDeflections> | null = null;
  try {
    defl = computeDeflections({
      spans,
      supportTypes,
      loads: loads.map((l) => ({
        type: l.type,
        D: l.D ?? 0,
        L: l.L ?? 0,
        position: l.position,
        start: l.start,
        end: l.end,
      })),
      selfWeight,
      bw,
      h,
      cover,
      fc,
      fy,
      asBottomSpan: qtyArr.map((q, i) => q * barArea(diamArr[i])),
      asTopSpan: compQtyArr.map((q, i) => q * barArea(compDiamArr[i])),
      asTopSup: supQtyArr.map((q, i) => q * barArea(supDiamArr[i])),
      supportWidthsMm: supportWidths,
      sustainedPct: d.sustainedPct ?? 100,
      timeFactor: d.timeFactor ?? 2,
      useBischoff: d.ieMethod === "bischoff",
    });
  } catch {
    defl = null;
  }

  return spans.map((_sp, i) => {
    // Apoyos de extremo empotrados (voladizos) también llevan armadura superior
    const supL = i > 0 || supportTypes[0] === "fixed" ? sups.get(i) : undefined;
    const supR =
      i < n - 1 || supportTypes[n] === "fixed" ? sups.get(i + 1) : undefined;
    // Momento negativo por lado; extremos empotrados (fixed) también lo tienen
    const mnegL =
      i > 0 || supportTypes[0] === "fixed"
        ? (envelope.supportMuNeg[i] ?? 0)
        : 0;
    const mnegR =
      i < n - 1 || supportTypes[n] === "fixed"
        ? (envelope.supportMuNeg[i + 1] ?? 0)
        : 0;
    const fSp = defl?.spans[i];
    const flechaLL = fSp ? `${fmt2(fSp.deltaLL)} / ${fmt2(fSp.limLL)}` : "—";
    const flechaT = fSp
      ? `${fmt2(fSp.deltaTotal)} / ${fmt2(fSp.limTotal)}`
      : "—";

    return [
      n === 1 ? save.name : `${save.name} · T${i + 1}`,
      {
        kind: "beam-scheme",
        left: supportTypes[i] ?? "simple",
        right: supportTypes[i + 1] ?? "simple",
      },
      section,
      mat,
      loadText,
      spanMu[i].toFixed(1),
      mnegL > 0 || mnegR > 0
        ? `${mnegL > 0 ? fmt1(mnegL) : "—"} / ${mnegR > 0 ? fmt1(mnegR) : "—"}`
        : "—",
      spanVu[i].toFixed(1),
      spanReinf[i],
      supL ?? "—",
      supR ?? "—",
      spanStirrup[i],
      flechaLL,
      flechaT,
    ];
  });
}

/** Construye la planilla de vigas a partir de los guardados provistos. */
export function buildVigaSheet(sources: SavedBeam[]): PlanillaSheet {
  const rows: PlanillaCell[][] = [];
  const failed: string[] = [];
  for (const save of sources) {
    try {
      rows.push(...buildVigaRows(save));
    } catch {
      failed.push(save.name);
    }
  }
  const single = sources.length === 1;
  const totalTramos = rows.length;
  return {
    title: single ? "PLANILLA DE VIGA — H° A°" : "PLANILLA DE VIGAS — H° A°",
    subtitle: "Memoria de cálculo",
    columns: VIGA_COLUMNS,
    rows,
    countLabel: single
      ? `Elemento: ${sources[0]?.name ?? ""}${
          totalTramos > 1 ? ` · Tramos: ${totalTramos}` : ""
        }`
      : `Vigas: ${sources.length} · Tramos: ${totalTramos}`,
    notes:
      failed.length > 0
        ? [`No se pudieron procesar: ${failed.join(", ")}`]
        : undefined,
  };
}

// ---- Losas (tipo "losa": data = { input: SlabInput, result: SlabResult }) ----

const EDGE_LABELS = ["Izq", "Der", "Arr", "Aba"] as const;
const EDGE_COND: Record<string, string> = {
  simple: "Art.",
  continuo: "Cont.",
  free: "Libre",
};

function slabArmadura(
  inputDiam: number | undefined,
  adoptedDiam: number | undefined,
  adoptedSepCm: number | undefined,
  adoptedAs: number | undefined,
): string {
  const d = adoptedDiam && adoptedDiam > 0 ? adoptedDiam : inputDiam;
  if (!d) return "—";
  const sep =
    adoptedSepCm && adoptedSepCm > 0
      ? Math.round(adoptedSepCm)
      : adoptedAs && adoptedAs > 0
        ? Math.round(((BAR_AREA[d] ?? 0) * 100) / adoptedAs)
        : 0;
  if (!sep) return "—";
  const area = ((BAR_AREA[d] ?? 0) / 100).toFixed(2);
  return `Ø${d} c/${sep} (${area} cm²/m)`;
}

const LOSA_COLUMNS: PlanillaColumn[] = [
  { key: "elem", label: "Elemento", width: "11%" },
  { key: "plan", label: "Planta", width: "13%", align: "center" },
  { key: "dims", label: "Lx×Ly (m)" },
  { key: "edges", label: "Bordes (I/D/A/Ab)" },
  { key: "loads", label: "D/L (kN/m²)" },
  { key: "h", label: "h (cm)", align: "right" },
  { key: "mat", label: "f'c/fy (MPa)" },
  { key: "mp", label: "M⁺ (kN·m/m)", align: "right" },
  { key: "mn", label: "M⁻ apoyo (kN·m/m)", align: "right" },
  { key: "armX", label: "Armadura X", width: "15%" },
  { key: "armY", label: "Armadura Y", width: "15%" },
];

function buildLosaRow(save: SavedBeam): PlanillaCell[] {
  const data = save.data as unknown as {
    input?: Partial<SlabInput>;
    result?: Partial<SlabResult>;
  };
  const input = data.input;
  if (!input) throw new Error("Sin datos");
  // Los guardados desde el formulario solo tienen `input`; la planilla es una
  // memoria de cálculo, así que resolvemos el diseño con el mismo motor.
  const result = data.result ?? designSlab(input as SlabInput);
  const edges = input.edges ?? [];
  const edgesTuple: [
    EdgeCondition,
    EdgeCondition,
    EdgeCondition,
    EdgeCondition,
  ] =
    edges.length === 4
      ? (edges as [EdgeCondition, EdgeCondition, EdgeCondition, EdgeCondition])
      : ["simple", "simple", "simple", "simple"];
  const planCell: SlabPlanCell = {
    kind: "slab-plan",
    lx: input.lx ?? 0,
    ly: input.ly ?? 0,
    edges: edgesTuple,
  };

  const dirX: DirectionResult | undefined = result.x;
  const dirY: DirectionResult | undefined =
    (result.y?.Mu ?? 0) > 0 ? result.y : result.distY;

  const armX = slabArmadura(
    input.dBarX,
    result.adoptedDiamX,
    result.adoptedSepXCm,
    result.adoptedAsX,
  );
  const armY = slabArmadura(
    input.dBarY,
    result.adoptedDiamY,
    result.adoptedSepYCm,
    result.adoptedAsY,
  );

  const mPos = Math.max(dirX?.Mu ?? 0, dirY?.Mu ?? 0);
  const mNeg = Math.max(
    result.MnegIzq ?? 0,
    result.MnegDer ?? 0,
    result.MnegArr ?? 0,
    result.MnegAba ?? 0,
  );

  return [
    save.name,
    planCell,
    `${input.lx ?? 0} × ${input.ly ?? 0}`,
    edges.map((c: string) => `${EDGE_COND[c] ?? c}`).join(" / "),
    `${fmt1(input.D ?? 0)}/${fmt1(input.L ?? 0)}`,
    ((result.h ?? 0) / 10).toFixed(1),
    `${input.fc ?? 0}/${input.fy ?? 0}`,
    mPos.toFixed(1),
    mNeg > 0 ? mNeg.toFixed(1) : "—",
    armX,
    armY,
  ];
}

/** Planilla de losas (una fila por losa). */
export function buildLosaSheet(sources: SavedBeam[]): PlanillaSheet {
  const rows: PlanillaCell[][] = [];
  const failed: string[] = [];
  for (const save of sources) {
    try {
      rows.push(buildLosaRow(save));
    } catch {
      failed.push(save.name);
    }
  }
  return {
    title: "PLANILLA DE LOSAS — H° A°",
    subtitle: "Memoria de cálculo",
    columns: LOSA_COLUMNS,
    rows,
    countLabel: `Cantidad de losas: ${rows.length}`,
    notes: [
      ...(failed.length > 0
        ? [`No se pudieron procesar: ${failed.join(", ")}`]
        : []),
      "Referencia: triángulo = apoyo articulado; borde tramado = continuidad; línea de trazos = borde libre.",
    ],
  };
}

// ---- Columnas (tipo "rc-columna": parámetros del form + armado manual) ----

interface RCColumnaSaveData {
  fc?: number;
  fy?: number;
  PD?: number;
  PL?: number;
  lu?: number;
  MxSup?: number;
  MxInf?: number;
  MySup?: number;
  MyInf?: number;
  Cx?: number;
  Cy?: number;
  betaD?: number;
  includeSelfWeight?: boolean;
  nEsquinas?: number;
  nCarasX?: number;
  nCarasY?: number;
  dbEsquinas?: number;
  dbCarasX?: number;
  dbCarasY?: number;
}

const COLUMNA_COLUMNS: PlanillaColumn[] = [
  { key: "elem", label: "Elemento", width: "12%" },
  { key: "section", label: "Sección (cm)" },
  { key: "mat", label: "f'c/fy (MPa)" },
  { key: "loads", label: "D/L (kN)" },
  { key: "pu", label: "Pu (kN)", align: "right" },
  { key: "lu", label: "lu (m)", align: "right" },
  { key: "mu", label: "Mu máx (kN·m)", align: "right" },
  { key: "tipo", label: "Tipo" },
  { key: "astreq", label: "Ast req (cm²)", align: "right" },
  { key: "astprov", label: "Ast prov (cm²)", align: "right" },
  { key: "arm", label: "Armadura", width: "17%" },
  { key: "stirrup", label: "Estribos" },
];

function buildColumnaRow(save: SavedBeam): string[] {
  const d = save.data as unknown as RCColumnaSaveData;
  const inputRes = designRCColumn({
    fc: d.fc ?? 0,
    fy: d.fy ?? 0,
    PD: d.PD ?? 0,
    PL: d.PL ?? 0,
    lu: d.lu ?? 0,
    MxSup: d.MxSup ?? 0,
    MxInf: d.MxInf ?? 0,
    MySup: d.MySup ?? 0,
    MyInf: d.MyInf ?? 0,
    Cx: d.Cx,
    Cy: d.Cy,
    betaD: d.betaD,
  });
  const full = designRCColumn({
    fc: d.fc ?? 0,
    fy: d.fy ?? 0,
    PD: d.PD ?? 0,
    PL: d.PL ?? 0,
    lu: d.lu ?? 0,
    MxSup: d.MxSup ?? 0,
    MxInf: d.MxInf ?? 0,
    MySup: d.MySup ?? 0,
    MyInf: d.MyInf ?? 0,
    Cx: d.Cx,
    Cy: d.Cy,
    betaD: d.betaD,
    nEsquinas: d.nEsquinas,
    nCarasX: d.nCarasX,
    nCarasY: d.nCarasY,
    dbEsquinas: d.dbEsquinas,
    dbCarasX: d.dbCarasX,
    dbCarasY: d.dbCarasY,
  });
  const astReq = inputRes.Ast;
  const astProv = full.barLayout.astTotalProvided;
  const nEsq = d.nEsquinas ?? 4;
  const armText = `${nEsq}Ø${d.dbEsquinas ?? 12} + X:${d.nCarasX ?? 0}Ø${d.dbCarasX ?? 12} + Y:${d.nCarasY ?? 0}Ø${d.dbCarasY ?? 12}`;
  return [
    save.name,
    `${full.Cx}×${full.Cy}`,
    `${d.fc ?? 0}/${d.fy ?? 0}`,
    `${fmt1(d.PD ?? 0)}/${fmt1(d.PL ?? 0)}`,
    fmt1(full.Pu),
    fmt1(d.lu ?? 0),
    fmt1(Math.max(full.dirX.Mu, full.dirY.Mu)),
    full.columnType === "SLENDER" ? "Esbelta" : "Corta",
    astReq.toFixed(2),
    astProv.toFixed(2),
    armText,
    `Ø${full.phiStirrup} c/${full.sStirrup}`,
  ];
}

/** Planilla de columnas (una fila por columna). */
export function buildColumnaSheet(sources: SavedBeam[]): PlanillaSheet {
  const rows: string[][] = [];
  const failed: string[] = [];
  for (const save of sources) {
    try {
      rows.push(buildColumnaRow(save));
    } catch {
      failed.push(save.name);
    }
  }
  return {
    title: "PLANILLA DE COLUMNAS — H° A°",
    subtitle: "Memoria de cálculo",
    columns: COLUMNA_COLUMNS,
    rows,
    countLabel: `Cantidad de columnas: ${rows.length}`,
    notes:
      failed.length > 0
        ? [`No se pudieron procesar: ${failed.join(", ")}`]
        : undefined,
  };
}

// ---- Bases (tipo "bases": data = { input: BaseInput, result: BaseResult }) ----

const BASE_TYPE_LABELS: Record<string, string> = {
  centrada: "Centrada",
  medianera: "Medianera",
  "medianera-x": "Medianera X",
  "medianera-y": "Medianera Y",
  esquina: "Esquina",
};

const BASE_SUBTYPE_LABELS: Record<string, string> = {
  "viga-de-fundacion": "V. fundación",
  "viga-de-equilibrio": "V. equilibrio",
  tensor: "Tensor",
};

const BASES_COLUMNS: PlanillaColumn[] = [
  { key: "elem", label: "Elemento", width: "7%" },
  { key: "tipo", label: "Tipo", width: "8%" },
  { key: "plan", label: "Planta", width: "10%", align: "center" },
  { key: "dims", label: "Lx×Ly×h (cm)", width: "8%" },
  { key: "qa", label: "σadm / Df (kN/m² / m)", align: "right" },
  { key: "loads", label: "D/L (kN)" },
  { key: "mat", label: "f'c/fy (MPa)" },
  { key: "pu", label: "Pu (kN)", align: "right" },
  { key: "qu", label: "qu (kN/m²)", align: "right" },
  { key: "mu", label: "Mu máx (kN·m)", align: "right" },
  { key: "armX", label: "Aª X", width: "7%" },
  { key: "armY", label: "Aª Y", width: "7%" },
  {
    key: "vigaTensor",
    label: "Viga fund. / tensor",
    width: "22%",
    multiline: true,
  },
];

/** Adopción manual de armaduras de la base, persistida en el guardado
 *  (data root). Todos los campos son opcionales: si faltan, la celda cae a las
 *  áreas / Av/s requeridos del resultado. */
interface BasesAdopcion {
  vigaSupQty?: number;
  vigaSupDiam?: number;
  vigaInfQty?: number;
  vigaInfDiam?: number;
  estVolLegs?: number;
  estVolDiam?: number;
  estVolSep?: number;
  estTramoLegs?: number;
  estTramoDiam?: number;
  estTramoSep?: number;
  tensorAdopt?: BaseTensorAdopcion;
  tensorAdoptX?: BaseTensorAdopcion;
  tensorAdoptY?: BaseTensorAdopcion;
}

/** Armadura adoptada (cantidad + Ø) o área requerida en cm². */
function adoptedRebar(
  qty: number | undefined,
  diam: number | undefined,
  asReq: number,
): string {
  return qty != null && qty > 0 && diam
    ? `${qty}Ø${diam}`
    : `${fmt2(asReq)} cm²`;
}

/** Estribo adoptado (Ø c/separación + patas) o Av/s requerido. */
function adoptedStirrup(
  diam: number | undefined,
  sep: number | undefined,
  legs: number | undefined,
  avsReq: number,
): string {
  if (diam != null && sep != null && sep > 0) {
    const legsTxt = legs != null ? ` ${legs}r` : "";
    return `Ø${diam} c/${Math.round(sep)}${legsTxt}`;
  }
  return `Av/s ${fmt2(avsReq)} cm²/m`;
}

/** Una línea de tensor (simple o una dirección de esquina). */
function tensorLine(
  tu: number,
  asReq: number,
  hTensor: number,
  adopt: BaseTensorAdopcion | undefined,
  label: string,
): string {
  const b = adopt?.b && adopt.b > 0 ? adopt.b : Math.round(hTensor);
  const h = adopt?.h && adopt.h > 0 ? adopt.h : Math.round(hTensor);
  const bar =
    adopt && adopt.qty && adopt.qty > 0 && adopt.diam
      ? `${adopt.qty}Ø${adopt.diam}`
      : `${fmt2(asReq)} cm²`;
  return `${label} ${b}×${h} · Tu ${fmt1(tu)} kN · ${bar}`;
}

/** Resultados del sistema de equilibrio (viga de fundación, vigas de
 *  equilibrio o tensor) apilados en una celda multilínea. */
function buildVigaTensorCell(
  input: Partial<BaseInput>,
  result: Partial<BaseResult>,
  adopt: BasesAdopcion = {},
): string {
  if (input.subType === "viga-de-fundacion") {
    const b = fmt1(result.b_viga ?? 0);
    const h = fmt1(result.h_viga ?? 0);
    const maxVu = Math.max(result.vigVuVol ?? 0, result.vigVuTramo ?? 0);
    const sup = adoptedRebar(
      adopt.vigaSupQty,
      adopt.vigaSupDiam,
      result.As_sup ?? 0,
    );
    const inf = adoptedRebar(
      adopt.vigaInfQty,
      adopt.vigaInfDiam,
      result.As_inf ?? 0,
    );
    const stirVol = adoptedStirrup(
      adopt.estVolDiam,
      adopt.estVolSep,
      adopt.estVolLegs,
      result.vigAvsReqVol ?? 0,
    );
    const stirTramo = adoptedStirrup(
      adopt.estTramoDiam,
      adopt.estTramoSep,
      adopt.estTramoLegs,
      result.vigAvsReqTramo ?? 0,
    );
    // `Mnv` es el momento nominal de la viga (M_u / 0.9); `result.Mu` es el
    // volcador Pu·e, no el momento máximo del tramo.
    const muViga = result.Mnv != null ? fmt1((result.Mnv * 0.9) / 100) : "—";
    return [
      `V ${b}×${h} · Mu ${muViga} kN·m · Vu ${fmt1(maxVu)} kN`,
      `As sup ${sup} · As inf ${inf}`,
      `Est vol ${stirVol} · tramo ${stirTramo}`,
    ].join("\n");
  }

  if (input.subType === "viga-de-equilibrio") {
    return [
      `Vigas X ${fmt1(result.b_vigaX ?? 0)}×${fmt1(result.h_vigaX ?? 0)} · Y ${fmt1(result.b_vigaY ?? 0)}×${fmt1(result.h_vigaY ?? 0)} cm`,
      `Rux ${fmt1(result.Rux ?? 0)} · Ruy ${fmt1(result.Ruy ?? 0)} kN`,
      `As sup X ${fmt2(result.As_supX ?? 0)} · Y ${fmt2(result.As_supY ?? 0)} cm²`,
      `As inf X ${fmt2(result.As_infX ?? 0)} · Y ${fmt2(result.As_infY ?? 0)} cm²`,
    ].join("\n");
  }

  if (input.subType === "tensor") {
    if (result.tensorPending) return "Pendiente de datos del tensor";
    if (input.type === "esquina") {
      return [
        tensorLine(
          result.Tux ?? 0,
          result.As_tensorX ?? 0,
          result.h_tensorX ?? 0,
          adopt.tensorAdoptX,
          "Tx",
        ),
        tensorLine(
          result.Tuy ?? 0,
          result.As_tensorY ?? 0,
          result.h_tensorY ?? 0,
          adopt.tensorAdoptY,
          "Ty",
        ),
      ].join("\n");
    }
    return tensorLine(
      result.Tu ?? 0,
      result.As_tensor ?? 0,
      result.h_tensor ?? 0,
      adopt.tensorAdopt,
      "T",
    );
  }

  return "—";
}

/** Armadura de una dirección de la base: cantidad, Ø y separación redondeada
 *  (si hay una sola barra no hay separación). */
function baseRebar(
  qty: number | undefined,
  db: number | undefined,
  sep: number | undefined,
): string {
  if (!qty || !db) return "—";
  if (sep == null || !Number.isFinite(sep)) return `${qty}Ø${db}`;
  return `${qty}Ø${db} c/${Math.round(sep)}`;
}

/** Campos mínimos para recalcular una base guardada desde el formulario. */
function isCompleteBaseInput(x: Partial<BaseInput>): x is BaseInput {
  return (
    typeof x.qa === "number" &&
    typeof x.Df === "number" &&
    typeof x.PD === "number" &&
    typeof x.PL === "number" &&
    typeof x.cx === "number" &&
    typeof x.cy === "number" &&
    typeof x.fc === "number" &&
    typeof x.fy === "number" &&
    typeof x.type === "string"
  );
}

function buildBaseRow(save: SavedBeam): PlanillaCell[] {
  const data = save.data as unknown as {
    input?: Partial<BaseInput>;
    result?: Partial<BaseResult>;
  } & Partial<BaseInput> &
    BasesAdopcion;
  if (!data || typeof data !== "object") throw new Error("Sin datos");
  if (data.result && !data.input) throw new Error("Datos incompletos");
  // Los guardados desde resultados traen { input, result }; los hechos desde
  // el formulario guardan los campos en el nivel raíz (sin resultado): se
  // recalcula la base para que también entren en la planilla.
  const input = data.input ?? data;
  let result: Partial<BaseResult>;
  if (data.result) {
    result = data.result;
  } else {
    if (!isCompleteBaseInput(input)) throw new Error("Datos incompletos");
    result = designBase(input);
  }
  const tipo = `${BASE_TYPE_LABELS[input.type ?? ""] ?? input.type ?? "—"}${
    input.subType
      ? ` · ${BASE_SUBTYPE_LABELS[input.subType] ?? input.subType}`
      : ""
  }`;
  const muMax = Math.max(
    (result.Mux ?? 0) / 100,
    (result.Muy ?? 0) / 100,
    (result.Mu ?? 0) / 100,
  );
  const armX = baseRebar(result.nb_x, result.db, result.sep_x);
  const armY = baseRebar(result.nb_y, result.db, result.sep_y);
  const planCell: BasePlanCell = {
    kind: "base-plan",
    type: (input.type ?? "centrada") as BaseType,
    Lx: result.Lx ?? 0,
    Ly: result.Ly ?? 0,
    cx: input.cx ?? 0,
    cy: input.cy ?? 0,
  };
  return [
    save.name,
    tipo,
    planCell,
    `${result.Lx ?? 0}×${result.Ly ?? 0}×${fmt1(result.h ?? 0)}`,
    `${fmt1(input.qa ?? 0)} / ${fmt1(input.Df ?? 0)}`,
    `${fmt2(input.PD ?? 0)}/${fmt2(input.PL ?? 0)}`,
    `${input.fc ?? 0}/${input.fy ?? 0}`,
    fmt1(result.Pu ?? 0),
    fmt1(result.qu ?? 0),
    muMax.toFixed(1),
    armX,
    armY,
    buildVigaTensorCell(input, result, data),
  ];
}

/** Planilla de bases (una fila por base). */
export function buildBasesSheet(sources: SavedBeam[]): PlanillaSheet {
  const rows: PlanillaCell[][] = [];
  const failed: string[] = [];
  for (const save of sources) {
    try {
      rows.push(buildBaseRow(save));
    } catch {
      failed.push(save.name);
    }
  }
  return {
    title: "PLANILLA DE BASES — H° A°",
    subtitle: "Memoria de cálculo",
    columns: BASES_COLUMNS,
    rows,
    countLabel: `Cantidad de bases: ${rows.length}`,
    notes:
      failed.length > 0
        ? [`No se pudieron procesar (datos incompletos): ${failed.join(", ")}`]
        : undefined,
  };
}

// ---- Apoyos de losas (individuales + compatibilizaciones) ----

const APOYOS_COLUMNS: PlanillaColumn[] = [
  { key: "elem", label: "Elemento", width: "13%" },
  { key: "edge", label: "Borde" },
  { key: "mneg", label: "M⁻ apoyo (kN·m/m)", align: "right" },
  { key: "losaA", label: "Losa A — armadura aportada", width: "28%" },
  { key: "losaB", label: "Losa B — armadura aportada", width: "28%" },
  { key: "adic", label: "Adicional — Ø c/sep", width: "15%" },
];

/** Momento negativo del borde indicado en el resultado de la losa. */
function edgeMneg(
  result: Partial<SlabResult> | undefined,
  edge: number | undefined,
): number {
  if (!result || edge == null) return 0;
  const v =
    edge <= 1
      ? edge === 0
        ? result.MnegIzq
        : result.MnegDer
      : edge === 2
        ? result.MnegArr
        : result.MnegAba;
  return v ?? 0;
}

/** Armadura del tramo que aporta sección al borde: Ø del input de la losa y
 *  separación derivada de la As adoptada en ese borde. */
function edgeArmadura(
  result: Partial<SlabResult> | undefined,
  input: Partial<SlabInput> | undefined,
  edge: number | undefined,
): string {
  if (!result || edge == null || !input) return "—";
  const isX = edge <= 1;
  const inputDiam = isX ? input.dBarX : input.dBarY;
  const adoptedDiam = isX ? result.adoptedDiamX : result.adoptedDiamY;
  const adoptedSep = isX ? result.adoptedSepXCm : result.adoptedSepYCm;
  const adoptedAs = isX ? result.adoptedAsX : result.adoptedAsY;

  const diam = adoptedDiam && adoptedDiam > 0 ? adoptedDiam : inputDiam;
  if (!diam) return "—";
  let sep = 0;
  if (adoptedSep && adoptedSep > 0) {
    sep = Math.round(adoptedSep);
  } else if (adoptedAs && adoptedAs > 0) {
    sep = Math.round(((BAR_AREA[diam] ?? 0) * 100) / adoptedAs);
  }
  if (sep <= 0) return `Ø${diam} (sin As adoptada)`;
  return `Ø${diam} c/${sep} cm`;
}

function buildApoyoRow(item: SavedSupportData | SavedCompatData): string[] {
  if ("slabA" in item) {
    // Compatibilización: dos losas + refuerzo adicional elegido
    const slabAData = loadSlab(item.slabA.id);
    const slabBData = loadSlab(item.slabB.id);
    const r = item.result;
    const mneg = r.Mcompat ?? Math.max(r.MnegA, r.MnegB);
    const reinf = getCompatReinf(item.name);
    return [
      item.name,
      `${EDGE_LABELS[item.edgeA] ?? "—"}${
        item.edgeB !== item.edgeA ? ` · ${EDGE_LABELS[item.edgeB] ?? "—"}` : ""
      }`,
      mneg > 0 ? fmt1(mneg) : "—",
      `${item.slabA.name} — ${edgeArmadura(slabAData?.result, slabAData?.input, item.edgeA)}`,
      `${item.slabB.name} — ${edgeArmadura(slabBData?.result, slabBData?.input, item.edgeB)}`,
      reinf ? `Ø${reinf.diam} c/${(reinf.sep / 10).toFixed(0)} cm` : "—",
    ];
  }
  // Apoyo individual (una losa + refuerzo propio)
  const slabData = loadSlab(item.slabId);
  const mneg = edgeMneg(slabData?.result, item.edge);
  return [
    item.name,
    EDGE_LABELS[item.edge] ?? "—",
    mneg > 0 ? fmt1(mneg) : "—",
    `${item.slabName} — ${edgeArmadura(slabData?.result, slabData?.input, item.edge)}`,
    "—",
    `Ø${item.diam} c/${(item.sep / 10).toFixed(0)} cm`,
  ];
}

/** Planilla de apoyos de losas (una fila por apoyo, individual o
 *  compatibilizado; sin verificación: son provisiones). */
export function buildApoyosSheet(
  items: Array<SavedSupportData | SavedCompatData>,
): PlanillaSheet {
  const rows: string[][] = [];
  const failed: string[] = [];
  for (const item of items) {
    try {
      rows.push(buildApoyoRow(item));
    } catch {
      failed.push(item.name);
    }
  }
  return {
    title: "PLANILLA DE APOYOS — LOSAS H° A°",
    subtitle: "Memoria de cálculo",
    columns: APOYOS_COLUMNS,
    rows,
    countLabel: `Cantidad de apoyos: ${rows.length}`,
    notes:
      failed.length > 0
        ? [`No se pudieron procesar: ${failed.join(", ")}`]
        : undefined,
  };
}

// ---- Muros de contención (tipo "muro": data = { input, result }) ----

const MURO_COLUMNS: PlanillaColumn[] = [
  { key: "elem", label: "Elemento", width: "13%" },
  { key: "tab", label: "H×e (m)" },
  { key: "zap", label: "B×Hzap (m)" },
  { key: "mu", label: "M_u (kN·m/m)", align: "right" },
  { key: "vu", label: "Vu/φVc (kN/m)", align: "right" },
  { key: "arm", label: "Armadura vertical int.", width: "17%" },
  { key: "sigma", label: "σmax/σadm (kPa)", align: "right" },
];

/** Armadura de un grupo del muro: Ø, separación y As provista. */
function muroRebar(sel?: MuroBarSelection): string {
  if (!sel || !sel.diam) return "—";
  return `Ø${sel.diam} c/${Math.round(sel.sep)} · ${fmt2(sel.asProv)} cm²/m`;
}

function buildMuroRow(save: SavedBeam): string[] {
  const data = save.data as unknown as {
    input?: Partial<MuroInput>;
    result?: Partial<MuroResult>;
  };
  if (!data?.input || !data?.result) throw new Error("Datos incompletos");
  const input = data.input;
  const r = data.result;
  return [
    save.name,
    `${fmt2(input.H ?? 0)}×${fmt2(input.e_muro ?? 0)}`,
    `${fmt2(input.B_zap ?? 0)}×${fmt2(input.H_zap ?? 0)}`,
    fmt1(r.M_u_gov ?? 0),
    `${fmt1(r.Vu ?? 0)}/${fmt1(r.phiVc ?? 0)}`,
    muroRebar(r.vertInt),
    `${Math.round(r.sigma_max ?? 0)}/${Math.round(r.sigma_adm_kPa ?? 0)}`,
  ];
}

/** Planilla de muros de contención (una fila por muro). */
export function buildMuroSheet(sources: SavedBeam[]): PlanillaSheet {
  const rows: string[][] = [];
  const failed: string[] = [];
  for (const save of sources) {
    try {
      rows.push(buildMuroRow(save));
    } catch {
      failed.push(save.name);
    }
  }
  return {
    title: "PLANILLA DE MUROS DE CONTENCIÓN — H° A°",
    subtitle: "Memoria de cálculo",
    columns: MURO_COLUMNS,
    rows,
    countLabel: `Cantidad de muros: ${rows.length}`,
    notes:
      failed.length > 0
        ? [`No se pudieron procesar (datos incompletos): ${failed.join(", ")}`]
        : undefined,
  };
}

// ---- Cabezales sobre pilotes (tipo "pilecap": data = { input, result }) ----

const PILECAP_COLUMNS: PlanillaColumn[] = [
  { key: "elem", label: "Elemento", width: "12%" },
  { key: "tipo", label: "Tipo", width: "11%" },
  { key: "pilotes", label: "Pilotes" },
  { key: "dims", label: "Planta×h (cm)" },
  { key: "loads", label: "PD/PL (kN)", align: "right" },
  { key: "pu", label: "Pu (kN)", align: "right" },
  { key: "rp", label: "Rp (kN/pilote)", align: "right" },
  { key: "arm", label: "Tirante", width: "15%" },
];

const PILECAP_TIPO_LABELS: Record<string, string> = {
  rect2: "2 pilotes",
  linea3: "3 en línea",
  triangulo: "Triangular 3",
};

function buildPileCapRow(save: SavedBeam): string[] {
  const data = save.data as unknown as {
    input?: Partial<PileCapInput>;
    result?: Partial<PileCapResult>;
  };
  if (!data?.input || !data?.result) throw new Error("Datos incompletos");
  const input = data.input;
  const r = data.result;
  return [
    save.name,
    PILECAP_TIPO_LABELS[input.tipo ?? ""] ?? input.tipo ?? "—",
    `${r.n ?? "—"} Ø${input.Dp ?? "—"} s ${input.s ?? "—"}`,
    `${Math.round(r.L1 ?? 0)}×${Math.round(r.L2 ?? 0)}×${Math.round(
      input.h ?? 0,
    )}`,
    `${fmt1(input.PD ?? 0)}/${fmt1(input.PL ?? 0)}`,
    fmt1(r.Pu ?? 0),
    fmt1(r.Rp ?? 0),
    `${r.barN ?? "—"}Ø${r.barD ?? "—"} · ${fmt2(r.AsProv ?? 0)} cm²`,
  ];
}

/** Planilla de cabezales sobre pilotes (una fila por cabezal). */
export function buildPileCapSheet(sources: SavedBeam[]): PlanillaSheet {
  const rows: string[][] = [];
  const failed: string[] = [];
  for (const save of sources) {
    try {
      rows.push(buildPileCapRow(save));
    } catch {
      failed.push(save.name);
    }
  }
  return {
    title: "PLANILLA DE CABEZALES — H° A°",
    subtitle: "Memoria de cálculo",
    columns: PILECAP_COLUMNS,
    rows,
    countLabel: `Cantidad de cabezales: ${rows.length}`,
    notes:
      failed.length > 0
        ? [`No se pudieron procesar (datos incompletos): ${failed.join(", ")}`]
        : undefined,
  };
}

// ---- Vigas de fundación para cabezales (tipo "cabezal") ----

const CABEZAL_VIGA_COLUMNS: PlanillaColumn[] = [
  { key: "elem", label: "Elemento", width: "13%" },
  { key: "cab", label: "Cabezal Lx×Ly (cm)" },
  { key: "viga", label: "Viga b×h (cm)" },
  { key: "e", label: "e (cm)", align: "right" },
  { key: "mu", label: "Mu viga (kN·m)", align: "right" },
  { key: "ru", label: "Ru (kN)", align: "right" },
  { key: "arm", label: "As sup/inf (cm²)", align: "right" },
  { key: "corte", label: "Vu/φVc (kN)", align: "right" },
];

function buildCabezalVigaRow(save: SavedBeam): string[] {
  const data = save.data as unknown as {
    input?: Partial<BaseInput>;
    result?: Partial<BaseResult>;
  } & Partial<BaseInput>;
  if (!data || typeof data !== "object") throw new Error("Sin datos");
  // Los guardados desde resultados traen { input, result }; los hechos desde
  // el formulario guardan los campos en el nivel raíz (sin resultado): se
  // recalcula la viga para que también entren en la planilla.
  const input = data.input ?? data;
  const result =
    data.result ??
    designVigaCabezal({
      PD: input.PD ?? 0,
      PL: input.PL ?? 0,
      cx: input.cx ?? 0,
      cy: input.cy ?? 0,
      fc: input.fc ?? 0,
      fy: input.fy ?? 0,
      Lx: input.Lx ?? 0,
      Ly: input.Ly ?? 0,
      dMed: input.dMed ?? 0,
      Lcol: input.Lcol ?? 0,
      bViga: input.bViga,
      hViga: input.hViga,
      cover: input.cover,
    });
  return [
    save.name,
    `${Math.round(input.Lx ?? 0)}×${Math.round(input.Ly ?? 0)}`,
    `${fmt1(result.b_viga ?? 0)}×${fmt1(result.h_viga ?? 0)}`,
    fmt1(result.e ?? 0),
    fmt1((result.Mu ?? 0) / 100),
    fmt1(result.Ru ?? 0),
    `${fmt2(result.As_sup ?? 0)}/${fmt2(result.As_inf ?? 0)}`,
    `${fmt1(result.vigVuVol ?? 0)}/${fmt1(result.vigPhiVc ?? 0)}`,
  ];
}

/** Planilla de vigas de fundación para cabezales (una fila por elemento). */
export function buildCabezalVigaSheet(sources: SavedBeam[]): PlanillaSheet {
  const rows: string[][] = [];
  const failed: string[] = [];
  for (const save of sources) {
    try {
      rows.push(buildCabezalVigaRow(save));
    } catch {
      failed.push(save.name);
    }
  }
  return {
    title: "PLANILLA DE VIGAS DE FUNDACIÓN PARA CABEZALES — H° A°",
    subtitle: "Memoria de cálculo",
    columns: CABEZAL_VIGA_COLUMNS,
    rows,
    countLabel: `Cantidad de vigas de fundación: ${rows.length}`,
    notes:
      failed.length > 0
        ? [`No se pudieron procesar (datos incompletos): ${failed.join(", ")}`]
        : undefined,
  };
}
