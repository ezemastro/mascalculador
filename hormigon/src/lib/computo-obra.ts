// Cómputo agregado de la obra activa: reconstruye el cómputo de materiales
// (hormigón m³ + acero por Ø en metros lineales y kg) desde los ELEMENTOS
// GUARDADOS de la obra, por familia (losas, vigas, columnas, bases) más el
// acero de los apoyos de losas (sin hormigón: ya computa en las losas).
//
// Regla de apoyos de losas (largo y cantidad de hierros):
// - El barro corre perpendicular al borde que apoya, 1/3 de la luz de cada
//   losa que apoya ahí (borde compartido: 1/3 de lx de losa 1 + 1/3 de lx de
//   losa 2, si el eje compartido es perpendicular a X).
// - La cantidad sale de la MENOR luz perpendicular entre las losas del apoyo
//   (una barra más por borde, mismo criterio que la malla).
// - Compatibilización en esquina (bordes de ejes distintos): dos juegos
//   independientes, uno por borde.
import type { SupportType } from "@mascalculador/shared";
import {
  computoLosa,
  computoViga,
  computoColumna,
  computoBase,
  ComputoAcc,
  BAR_AREA_MM2,
  sumComputos,
  type Computo,
} from "./computo";
import { calculateBeamEnvelope } from "./beam-envelope";
import { designRCColumn } from "./rc-column-calc";
import { CONCRETE_DENSITY } from "./constants";
import type { BaseInput, BaseResult } from "./bases-calc";
import {
  getSavedBeams,
  getSavedSlabs,
  getSavedSupports,
  getSavedCompats,
  getCompatReinf,
  loadSlab,
  type SavedBeam,
  type EdgeIndex,
  type SlabInput,
  type SlabResult,
} from "./storage";

// ---- Helpers de arrays guardados (idénticos a print-planilla) ----

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

/** Migra armaduras de apoyo guardadas a índice absoluto de apoyo. */
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

// ---- Losas desde guardado ----

/** Separiación (cm) derivada de la As adoptada guardada y el Ø del input. */
function sepFromAdopted(
  diam: number | undefined,
  adopted: number | undefined,
): number {
  if (!diam || !adopted || adopted <= 0) return 0;
  return Math.round(((BAR_AREA_MM2[diam] ?? 0) * 100) / adopted);
}

export function computoLosaFromSave(save: SavedBeam): Computo | null {
  const data = save.data as {
    input?: Partial<SlabInput>;
    result?: Partial<SlabResult>;
  };
  const input = data.input;
  const result = data.result;
  if (!input || !result) return null;
  return computoLosa({
    lx: input.lx ?? 0,
    ly: input.ly ?? 0,
    hMm: result.h ?? 0,
    diamX: input.dBarX ?? 0,
    sepXCm: sepFromAdopted(input.dBarX, result.adoptedAsX),
    diamY: input.dBarY ?? 0,
    sepYCm: sepFromAdopted(input.dBarY, result.adoptedAsY),
  });
}

// ---- Vigas desde guardado ----

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
  includeSelfWeight?: boolean;
  barQty?: number[] | number;
  barDiam?: number[] | number;
  compBarQty?: number[] | number;
  compBarDiam?: number[] | number;
  stirrupLegs?: number[] | number;
  stirrupDiam?: number[] | number;
  stirrupSpacing?: number[] | number;
  supBarQty?: number[] | number;
  supBarDiam?: number[] | number;
}

export function computoVigaFromSave(save: SavedBeam): Computo | null {
  const d = save.data as VigaSaveData;
  if (!Array.isArray(d.spans) || d.spans.length === 0) return null;
  const n = d.spans.length;
  const supportTypes = d.supportTypes ?? arr(n + 1, "simple");
  const bw = d.bw ?? 0;
  const h = d.h ?? 0;
  const selfWeight = d.includeSelfWeight
    ? ((bw * h) / 1e6) * CONCRETE_DENSITY
    : 0;
  const envelope = calculateBeamEnvelope(
    d.spans,
    supportTypes,
    d.concreteLoads ?? [],
    selfWeight,
  );
  const designSupportIdx = supportTypes
    .map((_t, i) => i)
    .filter(
      (i) =>
        supportTypes[i] !== "free" && (envelope.supportMuNeg[i] ?? 0) > 1e-6,
    );
  return computoViga({
    spansM: d.spans,
    bwMm: bw,
    hMm: h,
    coverMm: d.cover ?? 0,
    barQty: nArr(d.barQty, n, 3),
    barDiam: nArr(d.barDiam, n, 16),
    compBarQty: nArr(d.compBarQty, n, 0),
    compBarDiam: nArr(d.compBarDiam, n, 12),
    supBarQty: migrateSup(d.supBarQty, n + 1, 3),
    supBarDiam: migrateSup(d.supBarDiam, n + 1, 16),
    designSupportIdx,
    supportTypes,
    stirrupLegs: nArr(d.stirrupLegs, n, 2),
    stirrupDiam: nArr(d.stirrupDiam, n, 8),
    stirrupSpacingMm: nArr(d.stirrupSpacing, n, 200),
  });
}

// ---- Columnas desde guardado ----

interface ColumnaSaveData {
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
  nEsquinas?: number;
  nCarasX?: number;
  nCarasY?: number;
  dbEsquinas?: number;
  dbCarasX?: number;
  dbCarasY?: number;
}

export function computoColumnaFromSave(save: SavedBeam): Computo | null {
  const d = save.data as ColumnaSaveData;
  if (!d.lu) return null;
  const res = designRCColumn({
    fc: d.fc ?? 0,
    fy: d.fy ?? 0,
    PD: d.PD ?? 0,
    PL: d.PL ?? 0,
    lu: d.lu,
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
  return computoColumna({
    cxCm: res.Cx,
    cyCm: res.Cy,
    luM: d.lu,
    nEsquinas: d.nEsquinas ?? 4,
    nCarasX: d.nCarasX ?? 0,
    nCarasY: d.nCarasY ?? 0,
    dbEsquinas: d.dbEsquinas ?? 12,
    dbCarasX: d.dbCarasX ?? 12,
    dbCarasY: d.dbCarasY ?? 12,
    phiStirrup: res.phiStirrup,
    sStirrupCm: res.sStirrup,
  });
}

// ---- Bases desde guardado ----

const MEDIANERA_TYPES = new Set(["medianera", "medianera-x", "medianera-y"]);

export function computoBaseFromSave(save: SavedBeam): Computo | null {
  const data = save.data as {
    input?: Partial<BaseInput>;
    result?: Partial<BaseResult>;
  };
  const input = data.input;
  const result = data.result;
  if (!input || !result) return null;
  const vigas: Array<{ bCm: number; hCm: number; lengthCm: number }> = [];
  if (input.type === "esquina" && input.subType === "viga-de-equilibrio") {
    vigas.push(
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
    );
  } else if (
    MEDIANERA_TYPES.has(input.type ?? "") &&
    input.subType === "viga-de-fundacion"
  ) {
    vigas.push({
      bCm: result.b_viga ?? 0,
      hCm: result.h_viga ?? 0,
      lengthCm: input.Lcol ?? 0,
    });
  }
  return computoBase({
    lxCm: result.Lx ?? 0,
    lyCm: result.Ly ?? 0,
    hCm: result.h ?? 0,
    // Armadura según la propuesta del diseño (la adopción manual de la
    // pantalla de resultados no se guarda).
    diamX: result.db ?? 0,
    qtyX: result.nb_x ?? 0,
    diamY: result.db ?? 0,
    qtyY: result.nb_y ?? 0,
    vigas,
  });
}

// ---- Apoyos de losas (solo acero) ----

interface SlabDims {
  lx: number; // m
  ly: number; // m
}

/** Eje de la barra para un borde: Izq/Der (0/1) → barras en X; Arr/Aba → Y. */
function barAxis(edge: EdgeIndex): "X" | "Y" {
  return edge <= 1 ? "X" : "Y";
}

function luz(s: SlabDims, axis: "X" | "Y"): number {
  return axis === "X" ? s.lx : s.ly;
}

function luzPerp(s: SlabDims, axis: "X" | "Y"): number {
  return axis === "X" ? s.ly : s.lx;
}

/** Barras distribuidas sobre una luz (m) a separación sep (mm): +1 por borde. */
function qtySobre(luzM: number, sepMm: number): number {
  const sepCm = sepMm / 10;
  if (sepCm <= 0 || luzM <= 0) return 0;
  return Math.floor((luzM * 100) / sepCm) + 1;
}

export interface ApoyosComputo {
  computo: Computo;
  failed: string[];
}

export function computoApoyosObra(): ApoyosComputo {
  const acc = new ComputoAcc();
  const failed: string[] = [];

  const slabDims = (id: string): SlabDims | null => {
    const d = loadSlab(id);
    if (!d?.input) return null;
    return { lx: d.input.lx ?? 0, ly: d.input.ly ?? 0 };
  };

  // Apoyos individuales: una losa, hierro de 1/3 de su luz
  for (const sup of getSavedSupports()) {
    const dims = slabDims(sup.slabId);
    if (!dims) {
      failed.push(`${sup.name} (losa no encontrada)`);
      continue;
    }
    const axis = barAxis(sup.edge);
    acc.bar(
      sup.diam,
      qtySobre(luzPerp(dims, axis), sup.sep),
      luz(dims, axis) / 3,
    );
  }

  // Compatibilizaciones: dos losas comparten el apoyo
  for (const c of getSavedCompats()) {
    const dimsA = slabDims(c.slabA.id);
    const dimsB = slabDims(c.slabB.id);
    if (!dimsA || !dimsB) {
      failed.push(`${c.name} (losa no encontrada)`);
      continue;
    }
    const reinf = getCompatReinf(c.name);
    if (!reinf) {
      failed.push(`${c.name} (sin armadura definida)`);
      continue;
    }
    const axisA = barAxis(c.edgeA);
    const axisB = barAxis(c.edgeB);
    if (axisA === axisB) {
      // Borde compartido: un hierro pasa por el apoyo, 1/3 de luz en cada losa;
      // cantidad según la menor luz perpendicular.
      const length = (luz(dimsA, axisA) + luz(dimsB, axisA)) / 3;
      const qty = qtySobre(
        Math.min(luzPerp(dimsA, axisA), luzPerp(dimsB, axisA)),
        reinf.sep,
      );
      acc.bar(reinf.diam, qty, length);
    } else {
      // Esquina en L (bordes de ejes distintos): un juego por borde
      acc.bar(
        reinf.diam,
        qtySobre(luzPerp(dimsA, axisA), reinf.sep),
        luz(dimsA, axisA) / 3,
      );
      acc.bar(
        reinf.diam,
        qtySobre(luzPerp(dimsB, axisB), reinf.sep),
        luz(dimsB, axisB) / 3,
      );
    }
  }

  return { computo: acc.finish(), failed };
}

// ---- Agregado por obra ----

export interface FamiliaComputo {
  key: "losas" | "vigas" | "columnas" | "bases" | "apoyos";
  label: string;
  computo: Computo;
  /** Elementos guardados que no se pudieron computar. */
  failed: string[];
  soloAcero: boolean;
}

export interface ComputoObraResult {
  familias: FamiliaComputo[];
  total: Computo;
}

function familia(
  key: FamiliaComputo["key"],
  label: string,
  saves: SavedBeam[],
  compute: (save: SavedBeam) => Computo | null,
): FamiliaComputo {
  const failed: string[] = [];
  const list: Computo[] = [];
  for (const save of saves) {
    try {
      const c = compute(save);
      if (c) list.push(c);
      else failed.push(save.name);
    } catch {
      failed.push(save.name);
    }
  }
  return { key, label, computo: sumComputos(list), failed, soloAcero: false };
}

/** Cómputo completo de la obra activa: 4 familias + apoyos (solo acero). */
export function computoObraActiva(): ComputoObraResult {
  const familias: FamiliaComputo[] = [
    familia("losas", "Losas", getSavedSlabs(), computoLosaFromSave),
    familia("vigas", "Vigas", getSavedBeams("hormigon"), computoVigaFromSave),
    familia(
      "columnas",
      "Columnas",
      getSavedBeams("rc-columna"),
      computoColumnaFromSave,
    ),
    familia("bases", "Bases", getSavedBeams("bases"), computoBaseFromSave),
  ];
  const ap = computoApoyosObra();
  familias.push({
    key: "apoyos",
    label: "Apoyos losas",
    computo: ap.computo,
    failed: ap.failed,
    soloAcero: true,
  });
  return { familias, total: sumComputos(familias.map((f) => f.computo)) };
}
