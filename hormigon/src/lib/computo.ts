// Cómputo de materiales: hormigón (m³) y acero (metros lineales + kg,
// discriminado por diámetro) a partir del diseño adoptado en cada pantalla
// de resultados.
//
// Criterios de cómputo (longitudes teóricas de colocación):
// - Losa: malla por dirección a cara vista (largo de barra = dimensión de la
//   losa), una barra más por borde (redondeo hacia abajo + 1).
// - Viga: barras de tramo (inferior/compresión) = largo del tramo; barras de
//   apoyo superior extienden la mitad de cada tramo adyacente; estribos con
//   gancho 10·Ø y travesaños para ramas extra.
// - Columna: barras longitudinales = lu (sin traslapos); estribos con
//   recubrimiento supuesto 2.5 cm y gancho 10·Ø.
// - Base: barras X/Y a cara vista (Lx/Ly); el hormigón incluye la viga de
//   fundación / vigas de equilibrio; el acero de vigas y tensores queda fuera
//   (la adopción de barras se hace en pantalla, no está en el diseño).

export interface ComputoAceroRow {
  /** Diámetro nominal en mm. */
  diam: number;
  /** Metros lineales de barra. */
  metros: number;
  /** Peso en kg. */
  kg: number;
}

export interface Computo {
  /** Volumen de hormigón en m³. */
  hormigonM3: number;
  /** Acero discriminado por diámetro, ordenado ascendente. */
  acero: ComputoAceroRow[];
  /** Peso total de acero en kg. */
  kgTotal: number;
}

/** kg por mm²·m: 7850 kg/m³ → 0.00785 kg por mm² de sección y metro. */
const STEEL_KG_PER_MM2_M = 0.00785;

/** Recubrimiento supuesto para estribos de columna (cm). */
export const COLUMN_COVER_CM = 2.5;

/** Gancho de estribo: 10·Ø por extremo. */
const HOOK_D = 10;

function kgPerM(diam: number): number {
  return ((Math.PI * diam * diam) / 4) * STEEL_KG_PER_MM2_M;
}

class ComputoAcc {
  hormigonM3 = 0;
  private bars = new Map<number, number>();

  concrete(m3: number): void {
    if (m3 > 0) this.hormigonM3 += m3;
  }

  /** Agrega `qty` barras de `diam` mm con largo `lengthM` cada una. */
  bar(diam: number, qty: number, lengthM: number): void {
    if (!diam || qty <= 0 || lengthM <= 0) return;
    this.bars.set(diam, (this.bars.get(diam) ?? 0) + qty * lengthM);
  }

  finish(): Computo {
    const acero: ComputoAceroRow[] = [];
    let kgTotal = 0;
    for (const [diam, metros] of [...this.bars.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      const kg = metros * kgPerM(diam);
      kgTotal += kg;
      acero.push({ diam, metros, kg });
    }
    return { hormigonM3: this.hormigonM3, acero, kgTotal };
  }
}

/** Cómputo de una losa: malla X/Y con diámetro y separación adoptados. */
export function computoLosa(p: {
  lx: number; // m
  ly: number; // m
  hMm: number; // mm
  diamX: number; // mm
  sepXCm: number; // cm — separación de barras dirección X
  diamY: number; // mm
  sepYCm: number; // cm — separación de barras dirección Y
}): Computo {
  const acc = new ComputoAcc();
  acc.concrete((p.lx * p.ly * p.hMm) / 1000);
  if (p.sepXCm > 0 && p.diamX)
    acc.bar(p.diamX, Math.floor((p.ly * 100) / p.sepXCm) + 1, p.lx);
  if (p.sepYCm > 0 && p.diamY)
    acc.bar(p.diamY, Math.floor((p.lx * 100) / p.sepYCm) + 1, p.ly);
  return acc.finish();
}

/** Cómputo de una viga continua (por tramo: inferior, compresión, estribos;
 *  por apoyo: barras superiores). */
export function computoViga(p: {
  spansM: number[];
  bwMm: number;
  hMm: number;
  coverMm: number;
  barQty: number[];
  barDiam: number[];
  compBarQty: number[];
  compBarDiam: number[];
  /** Armadura superior de apoyo, indexada por índice absoluto de apoyo. */
  supBarQty: number[];
  supBarDiam: number[];
  designSupportIdx: number[];
  stirrupLegs: number[];
  stirrupDiam: number[];
  stirrupSpacingMm: number[];
}): Computo {
  const acc = new ComputoAcc();
  const c = p.coverMm;
  for (let i = 0; i < p.spansM.length; i++) {
    const L = p.spansM[i] ?? 0;
    acc.concrete((p.bwMm / 1000) * (p.hMm / 1000) * L);

    // Longitudinales de tramo (tracción + compresión)
    acc.bar(p.barDiam[i] ?? 0, p.barQty[i] ?? 0, L);
    acc.bar(p.compBarDiam[i] ?? 0, p.compBarQty[i] ?? 0, L);

    // Estribos: perímetro cerrado + ganchos; travesaños para ramas extra
    const d = p.stirrupDiam[i] ?? 0;
    const s = p.stirrupSpacingMm[i] ?? 0;
    const legs = p.stirrupLegs[i] ?? 2;
    if (d && s > 0) {
      const w = p.bwMm - 2 * c;
      const hh = p.hMm - 2 * c;
      let perStirrup = 2 * (w + hh) + 2 * HOOK_D * d; // mm
      const ties = Math.max(0, (legs - 2) / 2);
      perStirrup += ties * (hh + 2 * HOOK_D * d);
      const count = Math.floor((L * 1000) / s) + 1;
      acc.bar(d, count, perStirrup / 1000);
    }
  }

  // Barras superiores de apoyo: mitad de cada tramo adyacente
  for (const idx of p.designSupportIdx) {
    const len =
      ((idx > 0 ? (p.spansM[idx - 1] ?? 0) : 0) +
        (idx < p.spansM.length ? (p.spansM[idx] ?? 0) : 0)) /
      2;
    acc.bar(p.supBarDiam[idx] ?? 0, p.supBarQty[idx] ?? 0, len);
  }
  return acc.finish();
}

/** Cómputo de una columna: longitudinales (esquinas + caras X/Y) + estribos. */
export function computoColumna(p: {
  cxCm: number;
  cyCm: number;
  luM: number;
  nEsquinas: number;
  nCarasX: number;
  nCarasY: number;
  dbEsquinas: number;
  dbCarasX: number;
  dbCarasY: number;
  phiStirrup: number; // mm
  sStirrupCm: number; // cm
}): Computo {
  const acc = new ComputoAcc();
  acc.concrete((p.cxCm / 100) * (p.cyCm / 100) * p.luM);
  acc.bar(p.dbEsquinas, p.nEsquinas, p.luM);
  acc.bar(p.dbCarasX, 2 * p.nCarasX, p.luM);
  acc.bar(p.dbCarasY, 2 * p.nCarasY, p.luM);
  const d = p.phiStirrup;
  const s = p.sStirrupCm;
  if (d && s > 0) {
    const w = p.cxCm - 2 * COLUMN_COVER_CM;
    const hh = p.cyCm - 2 * COLUMN_COVER_CM;
    const perStirrupM = (2 * (w + hh) + 2 * HOOK_D * d) / 100;
    acc.bar(d, Math.ceil((p.luM * 100) / s), perStirrupM);
  }
  return acc.finish();
}

/** Cómputo de una base: losa + viga(s) de fundación/equilibrio (hormigón);
 *  acero de la losa por dirección. */
export function computoBase(p: {
  lxCm: number;
  lyCm: number;
  hCm: number;
  diamX: number; // mm
  qtyX: number;
  diamY: number; // mm
  qtyY: number;
  vigas: Array<{ bCm: number; hCm: number; lengthCm: number }>;
}): Computo {
  const acc = new ComputoAcc();
  acc.concrete((p.lxCm / 100) * (p.lyCm / 100) * (p.hCm / 100));
  for (const v of p.vigas) {
    acc.concrete((v.bCm / 100) * (v.hCm / 100) * (v.lengthCm / 100));
  }
  acc.bar(p.diamX, p.qtyX, p.lxCm / 100);
  acc.bar(p.diamY, p.qtyY, p.lyCm / 100);
  return acc.finish();
}
