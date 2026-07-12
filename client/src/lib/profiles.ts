export interface ProfileData {
  name: string;
  h: number; // height, mm (canonical — use getD() for display alias)
  b: number; // flange width, mm (canonical — use getBf() for display alias)
  tw: number; // web thickness, mm
  tf: number; // flange thickness, mm
  A: number; // cm² (cross-sectional area)
  Ix: number; // cm⁴
  Sx: number; // cm³ (elastic modulus)
  Zx: number; // cm³ (plastic modulus)
  Iy: number; // cm⁴
  ry: number; // cm
  J: number; // cm⁴ (torsional constant)
  Cw: number; // cm⁶ (warping constant)
  peso?: number; // kg/m (optional — PR #2 catalog data)
  Sy?: number; // cm³ (optional)
  Zy?: number; // cm³ (optional)
  rx?: number; // cm (optional)
  sectionType?: "I" | "C"; // I = doubly-symmetric, C = channel (singly-symmetric)
}

/** d = profile height (alias for h — canonical field). */
export function getD(p: ProfileData): number {
  return p.h;
}

/** bf = flange width (alias for b — canonical field). */
export function getBf(p: ProfileData): number {
  return p.b;
}

// IPN profiles (DIN 1025-1). h in mm, properties in cm.
// J and Cw from tabulated values / formulas.
// A = cross-sectional area from DIN standard (includes fillets).
// ry = √(Iy/A), rx = √(Ix/A), Sy = 2·Iy/(b/10), Zy ≈ 1.5·Sy
// peso = A × 0.785 kg/m
export const IPN_PROFILES: ProfileData[] = [
  // name,    h,   b,  tw,  tf,  Ix,    Sx,   Zx,   Iy,    ry,   J,     Cw,    rx,    Sy,   Zy,  peso
  ["IPN 80",  80,  42, 3.9, 5.9, 77.8,  19.5, 23,   6.29,  0.91, 0.7,   0.1,   3.21,  3.0,  5,   5.9],
  ["IPN 100", 100, 50, 4.5, 6.8, 171,   34.2, 40,   12.2,  1.07, 1.3,   0.3,   4.02,  4.9,  7,   8.3],
  ["IPN 120", 120, 58, 5.1, 7.7, 328,   54.7, 64,   21.5,  1.23, 2.2,   0.6,   4.81,  7.4,  11,  11.1],
  ["IPN 140", 140, 66, 5.7, 8.6, 573,   81.9, 96,   35.2,  1.40, 3.5,   1.2,   5.61,  10.7, 16,  14.3],
  ["IPN 160", 160, 74, 6.3, 9.5, 935,   117,  137,  54.7,  1.55, 5.5,   2.2,   6.40,  14.8, 22,  17.9],
  ["IPN 180", 180, 82, 6.9, 10.4,1450,  161,  189,  81.3,  1.71, 8.0,   3.6,   7.21,  19.8, 30,  21.9],
  ["IPN 200", 200, 90, 7.5, 11.3,2140,  214,  251,  117,   1.87, 11.3,  5.9,   8.00,  26.0, 39,  26.2],
  ["IPN 220", 220, 98, 8.1, 12.2,3060,  278,  326,  162,   2.02, 15.6,  9.0,   8.80,  33.1, 50,  31.0],
  ["IPN 240", 240, 106,8.7, 13.1,4250,  354,  415,  221,   2.20, 21.0,  13.5,  9.60,  41.7, 63,  36.2],
  ["IPN 260", 260, 113,9.4, 14.1,5740,  442,  518,  288,   2.32, 27.8,  19.3,  10.4,  51.0, 77,  41.9],
  ["IPN 280", 280, 119,10.1,15.2,7590,  542,  636,  364,   2.44, 36.4,  27.2,  11.2,  61.2, 92,  47.9],
  ["IPN 300", 300, 125,10.8,16.2,9800,  653,  767,  451,   2.56, 46.6,  37.1,  11.9,  72.2, 108, 54.2],
  ["IPN 320", 320, 131,11.5,17.3,12510, 782,  918,  555,   2.67, 59.5,  50.2,  12.7,  84.7, 127, 61.0],
  ["IPN 340", 340, 137,12.2,18.3,15700, 923,  1085, 674,   2.79, 74.1,  66.1,  13.5,  98.4, 148, 68.1],
  ["IPN 360", 360, 143,13.0,19.5,19610, 1090, 1281, 818,   2.90, 94.2,  87.6,  14.2,  114,  172, 76.1],
  ["IPN 380", 380, 149,13.7,20.5,24010, 1260, 1485, 975,   3.02, 114.7, 113.2, 15.0,  131,  197, 84.0],
  ["IPN 400", 400, 155,14.4,21.6,29210, 1460, 1718, 1160,  3.13, 139.7, 146.0, 15.7,  149,  224, 92.4],
  ["IPN 450", 450, 170,16.2,24.3,45850, 2040, 2395, 1730,  3.43, 219.3, 278.1, 17.7,  203,  305, 115],
  ["IPN 500", 500, 185,18.0,27.0,68740, 2750, 3235, 2480,  3.72, 329.5, 497.8, 19.6,  268,  402, 141],
].map(([name, h, b, tw, tf, Ix, Sx, Zx, Iy, ry, J, Cw, rx, Sy, Zy, peso]) => {
  const _h = h as number,
    _b = b as number,
    _tw = tw as number,
    _tf = tf as number;
  const A = Math.round((2 * _b * _tf + (_h - 2 * _tf) * _tw) / 10) / 10; // mm²→cm²
  return {
    name: name as string,
    h: _h,
    b: _b,
    tw: _tw,
    tf: _tf,
    A,
    Ix: Ix as number,
    Sx: Sx as number,
    Zx: Zx as number,
    Iy: Iy as number,
    ry: ry as number,
    J: J as number,
    Cw: Cw as number,
    rx: rx as number,
    Sy: Sy as number,
    Zy: Zy as number,
    peso: peso as number,
  };
});
