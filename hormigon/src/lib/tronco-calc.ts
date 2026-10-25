// Tronco de columna (pedestal) — CIRSOC 201-05
// Dimensiona el tramo entre la cabeza de la zapata y la columna como una
// columna de HA, reutilizando el motor de diseño de columnas (designRCColumn).
import {
  designRCColumn,
  type RCColumnInput,
  type RCColumnResult,
} from "./rc-column-calc";
import { supportWidths, type BaseInput, type BaseResult } from "./bases-calc";

export interface TroncoAdopcion {
  nEsquinas?: number;
  nCarasX?: number;
  nCarasY?: number;
  dbEsquinas?: number;
  dbCarasX?: number;
  dbCarasY?: number;
}

export interface TroncoShear {
  vx: number; // kN
  vy: number; // kN
  phiVcX: number; // kN
  phiVcY: number; // kN
  avsReqX: number; // cm²/m
  avsReqY: number; // cm²/m
  avsProv: number; // cm²/m
  sFinalCm: number; // cm
  ok: boolean;
  steps: string[];
}

export interface TroncoBars {
  nEsquinas: number;
  nCarasX: number;
  nCarasY: number;
  dbEsquinas: number;
  dbCarasX: number;
  dbCarasY: number;
}

export interface TroncoColumnComputo {
  cxCm: number;
  cyCm: number;
  luM: number;
  nEsquinas: number;
  nCarasX: number;
  nCarasY: number;
  dbEsquinas: number;
  dbCarasX: number;
  dbCarasY: number;
  phiStirrup: number;
  sStirrupCm: number;
}

export interface TroncoDesign {
  bxCm: number;
  byCm: number;
  luM: number;
  columnN: number; // kN — Pu de la columna
  columnMx: number; // kN·m — momento inferior X
  columnMy: number; // kN·m — momento inferior Y
  design: RCColumnResult;
  bars: TroncoBars;
  shear?: TroncoShear;
  columnComputo: TroncoColumnComputo;
}

const COLUMN_COVER_CM = 2.5;

function normalizeType(type: string | undefined): string {
  return type === "medianera" ? "medianera-y" : (type ?? "centrada");
}

export function designTronco(
  input: BaseInput,
  result: BaseResult,
  adopt?: TroncoAdopcion,
): TroncoDesign | null {
  const dfM = input.Df >= 5 ? input.Df / 100 : input.Df; // legacy cm → m
  const hCm = result.h ?? input.h ?? 0;
  const luM = dfM - hCm / 100;
  if (luM <= 0) return null;

  const sw = supportWidths({
    ...input,
    type: normalizeType(input.type) as BaseInput["type"],
  });
  const bx = input.troncoBx ?? sw.bx;
  const by = input.troncoBy ?? sw.by;
  const type = normalizeType(input.type);

  // Momentos de diseño del tronco (kN·m) — momento superior = 0.
  let mx = 0;
  let my = 0;
  if (type === "medianera-x") {
    mx = (result.Mu ?? 0) / 100;
  } else if (type === "medianera-y") {
    my = (result.Mu ?? 0) / 100;
  } else if (type === "esquina") {
    mx = (result.MuY_volc ?? 0) / 100;
    my = (result.MuX_volc ?? 0) / 100;
  }

  const colInput: RCColumnInput = {
    fc: input.fc,
    fy: input.fy,
    PD: input.PD,
    PL: input.PL,
    lu: luM,
    MxSup: 0,
    MxInf: mx,
    MySup: 0,
    MyInf: my,
    Cx: bx,
    Cy: by,
  };
  if (adopt) {
    colInput.nEsquinas = adopt.nEsquinas ?? 4;
    colInput.nCarasX = adopt.nCarasX ?? 0;
    colInput.nCarasY = adopt.nCarasY ?? 0;
    colInput.dbEsquinas = adopt.dbEsquinas ?? 12;
    colInput.dbCarasX = adopt.dbCarasX ?? 12;
    colInput.dbCarasY = adopt.dbCarasY ?? 12;
  }

  const design = designRCColumn(colInput);
  const columnN = design.Pu;

  // Barras para mostrar (auto desde el layout, o manual desde adopt).
  const bars: TroncoBars = adopt
    ? {
        nEsquinas: adopt.nEsquinas ?? 4,
        nCarasX: adopt.nCarasX ?? 0,
        nCarasY: adopt.nCarasY ?? 0,
        dbEsquinas: adopt.dbEsquinas ?? 12,
        dbCarasX: adopt.dbCarasX ?? 12,
        dbCarasY: adopt.dbCarasY ?? 12,
      }
    : {
        nEsquinas: 4,
        nCarasX: Math.max(0, design.barLayout.nXperFace - 2),
        nCarasY: design.barLayout.nYadditionalPerFace,
        dbEsquinas: design.barLayout.dbEsquinas,
        dbCarasX: design.barLayout.dbCarasX,
        dbCarasY: design.barLayout.dbCarasY,
      };

  // Corte (solo tensor y sin tensor pendiente).
  let shear: TroncoShear | undefined;
  if (input.subType === "tensor" && !result.tensorPending) {
    const fy_kNcm2 = input.fy * 0.1;
    const dX = Math.max(bx - COLUMN_COVER_CM, 0);
    const dY = Math.max(by - COLUMN_COVER_CM, 0);
    let vx = 0;
    let vy = 0;
    if (type === "esquina") {
      vx = result.tronco_Vx ?? 0;
      vy = result.tronco_Vy ?? 0;
    } else if (type === "medianera-x") {
      vy = result.Tu ?? 0;
    } else if (type === "medianera-y") {
      vx = result.Tu ?? 0;
    }
    const phiVcX = (0.75 * by * dX * Math.sqrt(input.fc)) / 60;
    const phiVcY = (0.75 * bx * dY * Math.sqrt(input.fc)) / 60;
    // Av/s en cm²/m: (V_s / (f_y · d)) · 100
    const avsReqX =
      dX > 0 ? (Math.max(0, (vx - phiVcX) / 0.75) / (fy_kNcm2 * dX)) * 100 : 0;
    const avsReqY =
      dY > 0 ? (Math.max(0, (vy - phiVcY) / 0.75) / (fy_kNcm2 * dY)) * 100 : 0;
    const areaStirrup = (Math.PI * Math.pow(design.phiStirrup / 10, 2)) / 4; // cm² (1 rama)
    const avsProv = (2 * areaStirrup * 100) / design.sStirrup; // cm²/m
    let sFinalCm = design.sStirrup;
    if (avsReqX > avsProv || avsReqY > avsProv) {
      const reqMax = Math.max(avsReqX, avsReqY);
      sFinalCm = Math.max(
        5,
        Math.min(design.sStirrup, (2 * areaStirrup * 100) / reqMax),
      );
    }
    const ok = avsReqX <= avsProv && avsReqY <= avsProv;
    shear = {
      vx,
      vy,
      phiVcX,
      phiVcY,
      avsReqX,
      avsReqY,
      avsProv,
      sFinalCm,
      ok,
      steps: [
        "====== CORTE DEL TRONCO (TENSOR) — CIRSOC 201 ======",
        `V_x = ${vx.toFixed(1)} kN, V_y = ${vy.toFixed(1)} kN`,
        `φVc_x = 0.75·b_y·d_x·√f'c/60 = 0.75·${by}·${dX.toFixed(1)}·√${input.fc}/60 = ${phiVcX.toFixed(1)} kN`,
        `φVc_y = 0.75·b_x·d_y·√f'c/60 = 0.75·${bx}·${dY.toFixed(1)}·√${input.fc}/60 = ${phiVcY.toFixed(1)} kN`,
        `Av/s req = max(V - φVc, 0)/(0.75·f_y·d) → X: ${avsReqX.toFixed(2)} cm²/m, Y: ${avsReqY.toFixed(2)} cm²/m`,
        `Av/s prov = 2·A_estribo·100/s = 2·${areaStirrup.toFixed(2)}·100/${design.sStirrup.toFixed(1)} = ${avsProv.toFixed(2)} cm²/m`,
        ok
          ? "✓ VERIFICA corte (Av/s prov ≥ req)"
          : `✗ NO VERIFICA: estrechar estribos a s = ${sFinalCm.toFixed(1)} cm`,
      ],
    };
  }

  const columnComputo: TroncoColumnComputo = {
    cxCm: bx,
    cyCm: by,
    luM,
    nEsquinas: bars.nEsquinas,
    nCarasX: bars.nCarasX,
    nCarasY: bars.nCarasY,
    dbEsquinas: bars.dbEsquinas,
    dbCarasX: bars.dbCarasX,
    dbCarasY: bars.dbCarasY,
    phiStirrup: design.phiStirrup,
    sStirrupCm: shear?.sFinalCm ?? design.sStirrup,
  };

  return {
    bxCm: bx,
    byCm: by,
    luM,
    columnN,
    columnMx: mx,
    columnMy: my,
    design,
    bars,
    shear,
    columnComputo,
  };
}
