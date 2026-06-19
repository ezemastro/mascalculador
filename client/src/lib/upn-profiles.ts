export interface UPNData {
  name: string;
  h: number;   // mm
  b: number;   // mm
  tw: number;  // mm
  tf: number;  // mm
  A: number;   // cm²
  Ix: number;  // cm⁴
  Iy: number;  // cm⁴
  rx: number;  // cm
  ry: number;  // cm
  xg: number;  // cm (centroid from web face)
  Zx: number;  // cm³ (plastic modulus)
  Zy: number;  // cm³
}

// UPN profiles per DIN 1026
export const UPN_PROFILES: UPNData[] = [
  // name,     h,   b,  tw,  tf,  A,    Ix,    Iy,   rx,  ry,  xg,  Zx,   Zy
  ["UPN 80",   80,  45, 6.0, 8.0, 11.0,  106,   19.4, 3.10,1.33,1.45, 30.0, 11.3],
  ["UPN 100", 100,  50, 6.0, 8.5, 13.5,  206,   29.3, 3.91,1.47,1.55, 46.8, 16.8],
  ["UPN 120", 120,  55, 7.0, 9.0, 17.0,  364,   43.2, 4.62,1.59,1.60, 67.6, 24.0],
  ["UPN 140", 140,  60, 7.0,10.0, 20.4,  605,   62.7, 5.45,1.75,1.75, 97.6, 34.6],
  ["UPN 160", 160,  65, 7.5,10.5, 24.0,  925,   85.3, 6.21,1.89,1.84,130.0, 45.2],
  ["UPN 180", 180,  70, 8.0,11.0, 28.0, 1350,  114.0, 6.95,2.02,1.92,172.0, 57.8],
  ["UPN 200", 200,  75, 8.5,11.5, 32.2, 1910,  148.0, 7.70,2.14,2.01,226.0, 73.4],
  ["UPN 220", 220,  80, 9.0,12.5, 37.4, 2690,  197.0, 8.48,2.30,2.14,298.0, 94.7],
  ["UPN 240", 240,  85, 9.5,13.0, 42.3, 3600,  248.0, 9.22,2.42,2.23,376.0,118.0],
  ["UPN 260", 260,  90,10.0,14.0, 48.3, 4820,  317.0, 9.99,2.56,2.36,486.0,150.0],
  ["UPN 280", 280,  95,10.0,15.0, 53.3, 6280,  399.0,10.90,2.74,2.53,579.0,178.0],
  ["UPN 300", 300, 100,10.0,16.0, 58.8, 8030,  495.0,11.70,2.90,2.70,672.0,208.0],
  ["UPN 320", 320, 100,14.0,17.5, 75.8,10870,  597.0,12.10,2.81,2.60,757.0,253.0],
  ["UPN 350", 350, 100,14.0,16.0, 77.3,12840,  570.0,12.90,2.72,2.40,832.0,249.0],
  ["UPN 380", 380, 102,13.5,16.0, 80.4,15760,  615.0,14.00,2.77,2.38,952.0,267.0],
  ["UPN 400", 400, 110,14.0,18.0, 91.5,20350,  846.0,14.90,3.04,2.65,1120.0,343.0],
].map(([name, h, b, tw, tf, A, Ix, Iy, rx, ry, xg, Zx, Zy]) => ({
  name: name as string,
  h: h as number, b: b as number, tw: tw as number, tf: tf as number,
  A: A as number, Ix: Ix as number, Iy: Iy as number,
  rx: rx as number, ry: ry as number, xg: xg as number,
  Zx: Zx as number, Zy: Zy as number,
}));

export interface DoubleUPNData {
  name: string;
  upnName: string;
  gap: number;    // mm between webs
  h: number;
  b_total: number;
  A: number;       // cm² (2x single)
  Ix: number;      // cm⁴ (2x single Ix)
  Iy: number;      // cm⁴ (computed from gap)
  rx: number;      // cm (sqrt(Ix/A))
  ry: number;      // cm (sqrt(Iy/A))
  Zx: number;      // cm³ (2x single Zx)
  Zy: number;      // cm³
}

// Build double UPN profiles for common gaps: 0, 10, 20, 30 mm
export function getDoubleUPN(upn: UPNData, gap: number): DoubleUPNData {
  const A = upn.A * 2;
  const Ix = upn.Ix * 2;
  const Zx = upn.Zx * 2;
  // Iy: parallel axis theorem. Two channels separated by gap.
  // Distance from each channel centroid to combined centroid = gap/2 + upn.xg
  const d = gap / 10 + upn.xg; // cm
  const Iy = 2 * (upn.Iy + upn.A * d * d);
  const Zy = (Iy / ((upn.b + gap / 10) / 2)); // approximate
  const rx = Math.sqrt(Ix / A);
  const ry = Math.sqrt(Iy / A);
  const b_total = upn.b * 2 + gap;

  return {
    name: `2 UPN ${upn.name.replace("UPN ", "")} (gap ${gap}mm)`,
    upnName: upn.name,
    gap,
    h: upn.h,
    b_total,
    A: Math.round(A * 10) / 10,
    Ix: Math.round(Ix),
    Iy: Math.round(Iy),
    rx: Math.round(rx * 100) / 100,
    ry: Math.round(ry * 100) / 100,
    Zx: Math.round(Zx),
    Zy: Math.round(Zy),
  };
}
