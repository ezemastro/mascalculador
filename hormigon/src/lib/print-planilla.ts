import type { SavedBeam, SavedSupportData, SavedCompatData } from "./storage";
import { loadSlab, getCompatReinf } from "./storage";
import type {
  SupportType,
  SlabInput,
  SlabResult,
  DirectionResult,
} from "@mascalculador/shared";
import { calculateBeamEnvelope } from "./beam-envelope";
import { designConcreteDetailed } from "./concrete-design";
import { CONCRETE_DENSITY } from "./constants";
import type { BaseInput, BaseResult } from "./bases-calc";
import { designRCColumn } from "./rc-column-calc";

export interface PlanillaColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
}

export interface PlanillaSheet {
  title: string;
  subtitle?: string;
  columns: PlanillaColumn[];
  /** Celdas pre-formateadas, alineadas con `columns`. Una fila por tramo. */
  rows: string[][];
  countLabel: string;
  notes?: string[];
}

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

function fmtLoad(l: {
  type: "point" | "distributed";
  D: number;
  L: number;
  position?: number;
  start?: number;
  end?: number;
}): string {
  if (l.type === "point") {
    return `P ${fmt2(l.D ?? 0)}/${fmt2(l.L ?? 0)} kN @${fmt1(l.position ?? 0)} m`;
  }
  return `q ${fmt2(l.D ?? 0)}/${fmt2(l.L ?? 0)} kN/m (${fmt1(l.start ?? 0)}→${fmt1(l.end ?? 0)} m)`;
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
}

const VIGA_COLUMNS: PlanillaColumn[] = [
  { key: "elem", label: "Elemento", width: "10%" },
  { key: "section", label: "Sección (cm)" },
  { key: "mat", label: "f'c/fy (MPa)" },
  { key: "loads", label: "Cargas D/L", width: "19%" },
  { key: "mp", label: "M⁺ (kN·m)", align: "right" },
  { key: "mneg", label: "M⁻ izq/der (kN·m)", align: "right" },
  { key: "mv", label: "V (kN)", align: "right" },
  { key: "reinft", label: "Aª inferior" },
  { key: "reinfL", label: "Aª sup izq" },
  { key: "reinfR", label: "Aª sup der" },
  { key: "stirrup", label: "Estribos", width: "10%" },
  { key: "ok", label: "Verifica", align: "center" },
];

/**
 * Recalcula la misma envolvente y diseño que ConcreteResults sobre el
 * guardado (el save ya trae input + armaduras provistas) y aplana CADA TRAMO
 * a una fila de planilla (V1 · T1, V1 · T2, ...). La armadura superior se
 * reporta por lado: apoyo izquierdo/derecho del tramo. Lanza si el guardado
 * está corrupto.
 */
function buildVigaRows(save: SavedBeam): string[][] {
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
  const directSupport = d.directSupport ?? true;
  const loads = d.concreteLoads ?? [];
  const supportWidths = d.supportWidths ?? [];

  const selfWeight = d.includeSelfWeight
    ? ((bw * h) / 1e6) * CONCRETE_DENSITY
    : 0;
  const qu =
    loads
      .filter((l) => l.type === "distributed")
      .reduce((sum, l) => sum + 1.2 * (l.D ?? 0) + 1.6 * (l.L ?? 0), 0) +
    (selfWeight > 0 ? 1.2 * selfWeight : 0);

  const envelope = calculateBeamEnvelope(
    spans,
    supportTypes,
    loads,
    selfWeight,
  );

  const supportWidthAt = (i: number): number => supportWidths[i] ?? 300;

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
  const spanOK: boolean[] = [];
  const spanReinf: string[] = [];
  const spanStirrup: string[] = [];

  for (let i = 0; i < n; i++) {
    const Mu = envelope.spanMuPos[i];
    const Vu = envelope.spanVu[i];
    spanMu.push(Mu);
    spanVu.push(Vu);
    const c = supportWidthAt(i);
    const req = designConcreteDetailed({
      bw,
      h,
      d: 0,
      dp: 0,
      cover,
      fc,
      fy,
      Mu,
      Vu,
      qu,
      c,
      directSupport,
      As: 0,
      Av: 0,
      nLegs: 0,
      s: 0,
    });
    const asT = (qtyArr[i] || 0) * barArea(diamArr[i]);
    const asC = (compQtyArr[i] || 0) * barArea(compDiamArr[i]);
    const chk = designConcreteDetailed({
      bw,
      h,
      d: 0,
      dp: 0,
      cover,
      fc,
      fy,
      Mu,
      Vu,
      qu,
      c,
      directSupport,
      As: asT + asC,
      Av: barArea(stirrupDiamArr[i]),
      nLegs: stirrupLegsArr[i] || 2,
      s: stirrupSpacingArr[i] || 200,
    });
    const flexOK =
      asT >= Math.max(req.AsReq, req.AsMin) &&
      (req.AspReq > 0 ? asC >= req.AspReq : true);
    spanOK.push(flexOK && chk.shearOK);
    spanReinf.push(rebar(qtyArr[i], diamArr[i]));
    spanStirrup.push(
      stirrupText(stirrupDiamArr[i], stirrupSpacingArr[i], stirrupLegsArr[i]),
    );
  }

  // Apoyos con armadura superior: interiores + extremos empotrados (voladizos),
  // por índice absoluto de apoyo. Se reportan por lado en cada tramo adyacente.
  const sups = new Map<number, { ok: boolean; text: string }>();
  for (let idx = 0; idx < n + 1; idx++) {
    if (supportTypes[idx] === "free") continue;
    const Mneg = envelope.supportMuNeg[idx] ?? 0;
    if (Mneg <= 1e-6) continue;
    const req = designConcreteDetailed({
      bw,
      h,
      d: 0,
      dp: 0,
      cover,
      fc,
      fy,
      Mu: Mneg,
      Vu: 0,
      qu,
      c: supportWidthAt(idx),
      directSupport,
      As: 0,
      Av: 0,
      nLegs: 0,
      s: 0,
    });
    const asProv = supQtyArr[idx] * barArea(supDiamArr[idx]);
    const ok = asProv >= Math.max(req.AsReq, req.AsMin) && req.AspReq <= 0;
    sups.set(idx, { ok, text: rebar(supQtyArr[idx], supDiamArr[idx]) });
  }

  const loadText = loads.length > 0 ? loads.map(fmtLoad).join(" · ") : "—";
  const section = `${bw / 10}×${h / 10}`;
  const mat = `${fc}/${fy}`;

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
    const ok = spanOK[i] && (supL?.ok ?? true) && (supR?.ok ?? true);

    return [
      n === 1 ? save.name : `${save.name} · T${i + 1}`,
      section,
      mat,
      loadText,
      spanMu[i].toFixed(1),
      mnegL > 0 || mnegR > 0
        ? `${mnegL > 0 ? fmt1(mnegL) : "—"} / ${mnegR > 0 ? fmt1(mnegR) : "—"}`
        : "—",
      spanVu[i].toFixed(1),
      spanReinf[i],
      supL ? supL.text : "—",
      supR ? supR.text : "—",
      spanStirrup[i],
      ok ? "✓" : "✗",
    ];
  });
}

/** Construye la planilla de vigas a partir de los guardados provistos. */
export function buildVigaSheet(sources: SavedBeam[]): PlanillaSheet {
  const rows: string[][] = [];
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
  diam: number | undefined,
  adoptedAs: number | undefined,
): string {
  if (!diam || !adoptedAs || adoptedAs <= 0) return "—";
  const sep = Math.round(((BAR_AREA[diam] ?? 0) * 100) / adoptedAs);
  const area = ((BAR_AREA[diam] ?? 0) / 100).toFixed(2);
  return `Ø${diam} c/${sep} (${area} cm²/m)`;
}

const LOSA_COLUMNS: PlanillaColumn[] = [
  { key: "elem", label: "Elemento", width: "11%" },
  { key: "dims", label: "Lx×Ly (m)" },
  { key: "edges", label: "Bordes (I/D/A/Ab)" },
  { key: "loads", label: "D/L (kN/m²)" },
  { key: "h", label: "h (cm)", align: "right" },
  { key: "mat", label: "f'c/fy (MPa)" },
  { key: "mp", label: "M⁺ (kN·m/m)", align: "right" },
  { key: "mn", label: "M⁻ apoyo (kN·m/m)", align: "right" },
  { key: "armX", label: "Armadura X", width: "15%" },
  { key: "armY", label: "Armadura Y", width: "15%" },
  { key: "ok", label: "Verifica", align: "center" },
];

function buildLosaRow(save: SavedBeam): string[] {
  const data = save.data as unknown as {
    input?: Partial<SlabInput>;
    result?: Partial<SlabResult>;
  };
  const input = data.input;
  const result = data.result;
  if (!input || !result) throw new Error("Sin datos");
  const edges = input.edges ?? [];
  const dirX: DirectionResult | undefined = result.x;
  const dirY: DirectionResult | undefined =
    (result.y?.Mu ?? 0) > 0 ? result.y : result.distY;

  // Verificación: provista >= requerida y separación <= s_máx, por dirección
  // (mismo criterio que la pantalla de resultados).
  const verifDir = (
    dir: DirectionResult | undefined,
    adopted: number | undefined,
    diam: number | undefined,
  ): boolean => {
    if (!dir) return false;
    if (adopted == null || adopted <= 0) return false;
    const sep = diam ? Math.round(((BAR_AREA[diam] ?? 0) * 100) / adopted) : 0;
    return adopted >= dir.AsReq && sep > 0 && sep <= dir.sMax / 10;
  };

  const armX = slabArmadura(input.dBarX, result.adoptedAsX);
  const armY = slabArmadura(input.dBarY, result.adoptedAsY);
  const ok =
    verifDir(dirX, result.adoptedAsX, input.dBarX) &&
    verifDir(dirY, result.adoptedAsY, input.dBarY);

  const mPos = Math.max(dirX?.Mu ?? 0, dirY?.Mu ?? 0);
  const mNeg = Math.max(
    result.MnegIzq ?? 0,
    result.MnegDer ?? 0,
    result.MnegArr ?? 0,
    result.MnegAba ?? 0,
  );

  return [
    save.name,
    `${input.lx ?? 0} × ${input.ly ?? 0}`,
    edges.map((c: string) => `${EDGE_COND[c] ?? c}`).join(" / "),
    `${fmt1(input.D ?? 0)}/${fmt1(input.L ?? 0)}`,
    ((result.h ?? 0) / 10).toFixed(1),
    `${input.fc ?? 0}/${input.fy ?? 0}`,
    mPos.toFixed(1),
    mNeg > 0 ? mNeg.toFixed(1) : "—",
    armX,
    armY,
    ok ? "✓" : "✗",
  ];
}

/** Planilla de losas (una fila por losa). */
export function buildLosaSheet(sources: SavedBeam[]): PlanillaSheet {
  const rows: string[][] = [];
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
    notes:
      failed.length > 0
        ? [`No se pudieron procesar: ${failed.join(", ")}`]
        : undefined,
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
  { key: "ok", label: "Verifica", align: "center" },
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
    astProv >= astReq && full.lambdaOK ? "✓" : "✗",
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
  { key: "elem", label: "Elemento", width: "12%" },
  { key: "tipo", label: "Tipo" },
  { key: "dims", label: "Lx×Ly×h (cm)" },
  { key: "qa", label: "σadm (kN/m²)", align: "right" },
  { key: "loads", label: "D/L (kN)" },
  { key: "mat", label: "f'c/fy (MPa)" },
  { key: "pu", label: "Pu (kN)", align: "right" },
  { key: "qu", label: "qu (kN/m²)", align: "right" },
  { key: "mu", label: "Mu máx (kN·m)", align: "right" },
  { key: "arm", label: "Armadura" },
  { key: "ok", label: "Verifica", align: "center" },
];

function buildBaseRow(save: SavedBeam): string[] {
  const data = save.data as unknown as {
    input?: Partial<BaseInput>;
    result?: Partial<BaseResult>;
  };
  const input = data.input;
  const result = data.result;
  if (!input || !result) throw new Error("Sin datos");
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
  const armX =
    result.db && result.nb_x
      ? `${result.nb_x}Ø${result.db} c/${result.sep_x}`
      : "—";
  const armY =
    result.db && result.nb_y
      ? `${result.nb_y}Ø${result.db} c/${result.sep_y}`
      : "—";
  const ok =
    result.punchOK !== false &&
    result.beamShearOK !== false &&
    result.sepCheckOK !== false &&
    result.heelOK !== false &&
    !result.tensorPending;
  return [
    save.name,
    tipo,
    `${result.Lx ?? 0}×${result.Ly ?? 0}×${result.h ?? 0}`,
    fmt1(input.qa ?? 0),
    `${fmt2(input.PD ?? 0)}/${fmt2(input.PL ?? 0)}`,
    `${input.fc ?? 0}/${input.fy ?? 0}`,
    fmt1(result.Pu ?? 0),
    fmt1(result.qu ?? 0),
    muMax.toFixed(1),
    `X: ${armX} · Y: ${armY}`,
    ok ? "✓" : "✗",
  ];
}

/** Planilla de bases (una fila por base). */
export function buildBasesSheet(sources: SavedBeam[]): PlanillaSheet {
  const rows: string[][] = [];
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
        ? [`No se pudieron procesar: ${failed.join(", ")}`]
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
  const diam = edge <= 1 ? input.dBarX : input.dBarY;
  const adopted = (edge <= 1 ? result.adoptedAsX : result.adoptedAsY) ?? 0;
  if (!diam) return "—";
  if (adopted <= 0) return `Ø${diam} (sin As adoptada)`;
  const sep = Math.round(((BAR_AREA[diam] ?? 0) * 100) / adopted);
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
