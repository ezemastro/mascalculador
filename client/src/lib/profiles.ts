export interface ProfileData {
  name: string;
  h: number;    // height, mm
  b: number;    // flange width, mm
  tw: number;   // web thickness, mm
  tf: number;   // flange thickness, mm
  A: number;    // cm² (cross-sectional area)
  Ix: number;   // cm⁴
  Sx: number;   // cm³ (elastic modulus)
  Zx: number;   // cm³ (plastic modulus)
  Iy: number;   // cm⁴
  ry: number;   // cm
  J: number;    // cm⁴ (torsional constant)
  Cw: number;   // cm⁶ (warping constant)
}

// IPN profiles (DIN 1025-1). h in mm, properties in cm.
// J and Cw computed from formulas. A = (2*b*tf + (h-2*tf)*tw) / 100
export const IPN_PROFILES: ProfileData[] = [
  // name,    h,   b,  tw,  tf,  Ix,    Sx,   statZx,  Iy,   ry,  J,    Cw
  ["IPN 80",  80,  42, 3.9, 5.9,  77.8,  19.5, 23,     6.29, 1.05, 1.5,  0.1],
  ["IPN 100", 100, 50, 4.5, 6.8,  171,   34.2, 40,     12.2, 1.28, 2.7,  0.3],
  ["IPN 120", 120, 58, 5.1, 7.7,  328,   54.7, 64,     21.5, 1.49, 4.5,  0.6],
  ["IPN 140", 140, 66, 5.7, 8.6,  573,   81.9, 96,     35.2, 1.71, 7.1,  1.2],
  ["IPN 160", 160, 74, 6.3, 9.5,  935,   117,  137,    54.7, 1.93, 10.6, 2.2],
  ["IPN 180", 180, 82, 6.9, 10.4, 1450,  161,  189,    81.3, 2.16, 15.3, 3.6],
  ["IPN 200", 200, 90, 7.5, 11.3, 2140,  214,  251,   117,  2.37, 21.3, 5.9],
  ["IPN 220", 220, 98, 8.1, 12.2, 3060,  278,  326,   162,  2.61, 28.8, 9.0],
  ["IPN 240", 240,106, 8.7, 13.1, 4250,  354,  415,   221,  2.87, 37.8, 13.5],
  ["IPN 260", 260,113, 9.4, 14.1, 5740,  442,  518,   288,  3.12, 50.0, 19.3],
  ["IPN 280", 280,119,10.1, 15.2, 7590,  542,  636,   364,  3.43, 65.2, 27.2],
  ["IPN 300", 300,125,10.8, 16.2, 9800,  653,  767,   451,  3.72, 82.3, 37.1],
  ["IPN 320", 320,131,11.5, 17.3,12510,  782,  918,   555,  4.06,103.5, 50.2],
  ["IPN 340", 340,137,12.2, 18.3,15700,  923, 1085,   674,  4.41,127.9, 66.1],
  ["IPN 360", 360,143,13.0, 19.5,19610, 1090, 1281,   818,  4.79,163.0, 87.6],
  ["IPN 380", 380,149,13.7, 20.5,24010, 1260, 1485,   975,  5.16,198.7,113.2],
  ["IPN 400", 400,155,14.4, 21.6,29210, 1460, 1718,  1160,  5.58,244.2,146.0],
  ["IPN 450", 450,170,16.2, 24.3,45850, 2040, 2395,  1730,  6.79,401.3,278.1],
  ["IPN 500", 500,185,18.0, 27.0,68740, 2750, 3235,  2480,  8.07,629.0,497.8],
].map(([name, h, b, tw, tf, Ix, Sx, Zx, Iy, ry, J, Cw]) => {
  const _h = h as number, _b = b as number, _tw = tw as number, _tf = tf as number;
  const A = Math.round((2 * _b * _tf + (_h - 2 * _tf) * _tw) / 10) / 10; // mm²→cm²
  return {
    name: name as string,
    h: _h, b: _b, tw: _tw, tf: _tf, A,
    Ix: Ix as number, Sx: Sx as number, Zx: Zx as number,
    Iy: Iy as number, ry: ry as number,
    J: J as number, Cw: Cw as number
  };
});
