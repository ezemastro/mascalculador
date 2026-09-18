// CIRSOC 201-05 — Flexión y corte detallado

export interface ConcreteInput {
  bw: number; // mm
  h: number; // mm
  d: number; // mm (0 = auto h-cover)
  dp: number; // mm (0 = auto cover+10)
  cover: number; // mm
  fc: number; // MPa
  fy: number; // MPa
  Mu: number; // kN·m
  Vu: number; // kN (max shear at support face)
  qu: number; // kN/m (uniform load, for shear reduction)
  c: number; // mm (support width)
  directSupport: boolean; // true = direct, false = indirect
  As: number; // mm² (provided)
  Av: number; // mm² (stirrup area per leg)
  nLegs: number; // number of stirrup legs
  s: number; // mm (stirrup spacing)
  /**
   * Viga placa (sección T/L): ancho efectivo `b` y espesor de losa `hf` en mm.
   * Solo aplica a momento positivo (compresión en la placa). El momento
   * negativo y el corte usan el alma `bw`.
   */
  flange?: { hf: number; b: number };
}

export interface ConcreteResult {
  d: number;
  dp: number;
  beta1: number;
  Mu: number;
  Vu: number;
  VuCalc: number; // shear at critical section
  mn: number;
  Ka: number;
  KaMin: number;
  KaMax: number;
  caseLabel: string;
  AsReq: number;
  AspReq: number;
  AsMin: number;
  AsOK: boolean;
  /** Viga placa: ancho efectivo usado (mm). */
  flangeB?: number;
  /** Viga placa: profundidad del bloque de compresión (mm). */
  flangeA?: number;
  /** Viga placa: dónde cae el eje neutro. */
  flangeEN?: "placa" | "nervio";
  // Shear results
  Vn: number;
  Vc: number;
  VsReq: number;
  VsProv: number;
  VnMax: number;
  shearOK: boolean;
  shearFailReason: string | null;
  AvSMin: number; // mm²/m
  sMax: number; // mm
  steps: string[];
}

/**
 * Ancho efectivo de colaboración para vigas placa, según CIRSOC 201-05
 * Art. 8.10.2 (T) y 8.10.3 (L):
 *  - T: el saliente de cada lado no excede 8·h_f ni la mitad de la separación
 *    libre al alma adyacente; el ancho total no excede L/4.
 *  - L: el saliente no excede 6·h_f ni la mitad de la separación libre al
 *    alma adyacente; el ancho total no excede b_w + L/12.
 * Distancias libres en mm (cara del nervio a cara del alma vecina); `span`
 * es la luz del tramo en m.
 */
export function flangeEffectiveWidth(input: {
  bw: number;
  hf: number;
  type: "T" | "L";
  clearLeft?: number;
  clearRight?: number;
  span: number;
}): { b: number; steps: string[] } {
  const { bw, hf, type, span } = input;
  const L = span * 1000;
  const steps: string[] = [];
  steps.push(
    `Ancho efectivo de colaboración (CIRSOC 201-05 Art. 8.10.${type === "T" ? 2 : 3}):`,
  );
  steps.push(`  L = ${span.toFixed(2)} m, b_w = ${bw} mm, h_f = ${hf} mm`);

  const proy = (limHf: number, clear: number): number =>
    Math.max(Math.min(limHf, clear / 2), 0);

  if (type === "T") {
    const pLeft = proy(8 * hf, input.clearLeft ?? 0);
    const pRight = proy(8 * hf, input.clearRight ?? 0);
    const bTotal = Math.min(bw + pLeft + pRight, L / 4);
    steps.push(
      `  Saliente izq = mín(8·h_f, libre_izq/2) = mín(${((8 * hf) / 1000).toFixed(2)}, ${((input.clearLeft ?? 0) / 2 / 1000).toFixed(2)}) m = ${(pLeft / 1000).toFixed(2)} m`,
    );
    steps.push(
      `  Saliente der = mín(8·h_f, libre_der/2) = ${(pRight / 1000).toFixed(2)} m`,
    );
    steps.push(
      `  b = mín(b_w + salientes, L/4) = mín(${((bw + pLeft + pRight) / 1000).toFixed(3)}, ${(L / 4 / 1000).toFixed(2)}) m = ${(bTotal / 1000).toFixed(3)} m`,
    );
    return { b: bTotal, steps };
  }

  const p = proy(6 * hf, input.clearLeft ?? 0);
  const bTotal = Math.min(bw + p, bw + L / 12);
  steps.push(
    `  Saliente = mín(6·h_f, libre/2) = mín(${((6 * hf) / 1000).toFixed(2)}, ${((input.clearLeft ?? 0) / 2 / 1000).toFixed(2)}) m = ${(p / 1000).toFixed(2)} m`,
  );
  steps.push(
    `  b = mín(b_w + saliente, b_w + L/12) = mín(${((bw + p) / 1000).toFixed(3)}, ${((bw + L / 12) / 1000).toFixed(3)}) m = ${(bTotal / 1000).toFixed(3)} m`,
  );
  return { b: bTotal, steps };
}

interface RectSolution {
  AsReq: number;
  AspReq: number;
  Ka: number;
  caseLabel: string;
}

/** Sección rectangular de ancho b bajo momento MnVal (kN·m). Comparte el
 *  procedimiento K_a / armadura simple-doble del módulo. */
function rectDesign(
  bEff: number,
  MnVal: number,
  fc: number,
  fy: number,
  d: number,
  dp: number,
  KaMin: number,
  KaMax: number,
  st: string[],
): RectSolution {
  const mn_val = (MnVal * 1e6) / (0.85 * fc * bEff * d * d);
  st.push(
    `m_n = M_n/(0.85·f'_c·b·d²) = ${MnVal.toFixed(1)}·10⁶/(0.85·${fc}·${bEff}·${d}²) = ${mn_val.toFixed(4)}`,
  );
  const Ka = 1 - Math.sqrt(1 - 2 * mn_val);
  st.push(`K_a = 1 − √(1−2·m_n) = ${Ka.toFixed(4)}`);

  let AsReq = 0;
  let AspReq = 0;
  let caseLabel = "";
  st.push(`K_a = ${Ka.toFixed(4)}`);

  if (Ka <= KaMin) {
    st.push(`K_a ≤ K_a min (${Ka.toFixed(4)} ≤ ${KaMin.toFixed(4)})`);
    const ka1 = 1.33 * Ka;
    st.push(`k_{a1} = 1.33·K_a = ${ka1.toFixed(4)}`);
    let ku: number;
    if (ka1 >= KaMin) {
      st.push(`k_{a1} ≥ K_a min → usa K_a min`);
      ku = KaMin;
      caseLabel = `K_a ≤ K_a min, k_{a1} ≥ K_a min → K_a min`;
    } else {
      st.push(`k_{a1} < K_a min → usa k_{a1}`);
      ku = ka1;
      caseLabel = `K_a ≤ K_a min, k_{a1} < K_a min → k_{a1}`;
    }
    AsReq = (0.85 * fc * bEff * ku * d) / fy;
    st.push(
      `A_s = 0.85·f'_c·b·K·d/f_y = 0.85·${fc}·${bEff}·${ku.toFixed(4)}·${d}/${fy} = ${AsReq.toFixed(0)} mm²`,
    );
  } else if (Ka <= KaMax) {
    st.push(`K_a min < K_a ≤ K_a max → armadura simple`);
    AsReq = (0.85 * fc * bEff * Ka * d) / fy;
    st.push(
      `A_s = 0.85·f'_c·b·K_a·d/f_y = 0.85·${fc}·${bEff}·${Ka.toFixed(4)}·${d}/${fy} = ${AsReq.toFixed(0)} mm²`,
    );
    caseLabel = "armadura simple";
  } else {
    st.push(`K_a > K_a max → armadura doble`);
    const Mc = (0.85 * fc * bEff * d * d * KaMax * (1 - KaMax / 2)) / 1e6;
    const MnValB = MnVal;
    const deltaMn = MnValB - Mc;
    AspReq = (deltaMn * 1e6) / (fy * (d - dp));
    AsReq = (0.85 * fc * bEff * KaMax * d) / fy + AspReq;
    caseLabel = "armadura doble";
    st.push(
      `M_c = 0.85·f'_c·b·d²·K_a max·(1-K_a max/2) = ${Mc.toFixed(1)} kN·m`,
    );
    st.push(
      `ΔM_n = ${MnValB.toFixed(1)} − ${Mc.toFixed(1)} = ${deltaMn.toFixed(1)} kN·m`,
    );
    st.push(`A_s' = ΔM_n/[f_y·(d−d')] = ${AspReq.toFixed(0)} mm²`);
    st.push(`A_s = 0.85·f'_c·b·K_a max·d/f_y + A_s' = ${AsReq.toFixed(0)} mm²`);
  }

  return { AsReq, AspReq, Ka, caseLabel };
}

export function designConcreteDetailed(input: ConcreteInput): ConcreteResult {
  const {
    bw,
    h,
    cover,
    fc,
    fy,
    Mu,
    Vu,
    qu,
    c,
    directSupport,
    As: AsProv,
    Av,
    nLegs,
    s,
  } = input;
  const d = input.d > 0 ? input.d : h - cover;
  const dp = input.dp > 0 ? input.dp : cover + 10;
  const phiV = 0.75;

  const st: string[] = [];
  st.push(`Sección: b_w = ${bw} mm, h = ${h} mm, d = ${d} mm, d' = ${dp} mm`);
  st.push(`f'_c = ${fc} MPa, f_y = ${fy} MPa`);
  st.push(`M_u = ${Mu.toFixed(1)} kN·m, V_u = ${Vu.toFixed(1)} kN (en apoyo)`);
  st.push(
    `Ancho apoyo c = ${c} mm, ${directSupport ? "apoyo directo" : "apoyo indirecto"}`,
  );
  st.push("");

  // ========== FLEXIÓN ==========
  let beta1 = 0.85;
  if (fc > 30) beta1 = Math.max(0.85 - 0.05 * ((fc - 30) / 7), 0.65);
  st.push(`--- FLEXIÓN ---`);
  st.push(`β₁ = ${beta1.toFixed(3)}`);

  const Mn_nmm = (Mu / 0.9) * 1e6;
  const MnVal = Mu / 0.9;
  st.push(`M_n = M_u/0.9 = ${MnVal.toFixed(1)} kN·m`);

  let KaMin: number;
  if (fc <= 30) {
    KaMin = 1.4 / (0.85 * fc);
    st.push(`K_a min = 1.4/(0.85·f'_c) = ${KaMin.toFixed(4)}`);
  } else {
    KaMin = 1 / (3.4 * fc);
    st.push(`K_a min = 1/(3.4·f'_c) = ${KaMin.toFixed(4)}`);
  }

  const KaMax = 0.375 * beta1;
  st.push(`K_a max = 0.375·β₁ = ${KaMax.toFixed(4)}`);
  st.push("");

  let AsReq = 0;
  let AspReq = 0;
  let caseLabel = "";
  let mn_val = 0;
  let Ka = 0;
  let flangeB: number | undefined;
  let flangeA: number | undefined;
  let flangeEN: "placa" | "nervio" | undefined;

  const flange = input.flange;
  if (flange && Mu > 0) {
    flangeB = flange.b;
    st.push(
      `Sección viga placa: b = ${flange.b} mm, h_f = ${flange.hf} mm, b_w = ${bw} mm`,
    );
    // ¿El eje neutro corta la placa? Probar como rectangular de ancho b.
    const mn_b = Mn_nmm / (0.85 * fc * flange.b * d * d);
    const enNervioSeguro = mn_b > 0.5;
    const Ka_b = enNervioSeguro ? 1 : 1 - Math.sqrt(1 - 2 * mn_b);
    const a_b = Ka_b * d;
    st.push(
      enNervioSeguro
        ? `Probar eje neutro en la placa: m_n = ${mn_b.toFixed(4)} > 0.5 → el eje neutro corta el nervio`
        : `Probar eje neutro en la placa: m_n = ${mn_b.toFixed(4)}, K_a = ${Ka_b.toFixed(4)}, a = K_a·d = ${a_b.toFixed(1)} mm`,
    );
    if (!enNervioSeguro && a_b <= flange.hf) {
      flangeEN = "placa";
      st.push(
        `a (${a_b.toFixed(1)} mm) ≤ h_f (${flange.hf} mm) → el eje neutro corta la placa: dimensionar como rectangular de ancho b = ${flange.b} mm`,
      );
      const sol = rectDesign(flange.b, MnVal, fc, fy, d, dp, KaMin, KaMax, st);
      AsReq = sol.AsReq;
      AspReq = sol.AspReq;
      Ka = sol.Ka;
      mn_val = mn_b;
      flangeA = sol.Ka * d;
      caseLabel = `${sol.caseLabel} (T, EN en placa)`;
    } else {
      flangeEN = "nervio";
      st.push(
        `a (${a_b.toFixed(1)} mm) > h_f (${flange.hf} mm) → el eje neutro corta el nervio: descomponer alas + nervio`,
      );
      const Cf = 0.85 * fc * (flange.b - bw) * flange.hf;
      const Asf = Cf / fy;
      const Mnf = (Cf * (d - flange.hf / 2)) / 1e6;
      const Mnw = MnVal - Mnf;
      st.push(
        `C_f = 0.85·f'_c·(b−b_w)·h_f = 0.85·${fc}·${flange.b - bw}·${flange.hf} = ${Cf.toFixed(0)} N`,
      );
      st.push(
        `A_sf = C_f/f_y = ${Cf.toFixed(0)}/${fy} = ${Asf.toFixed(0)} mm²`,
      );
      st.push(
        `M_nf = C_f·(d−h_f/2) = ${Cf.toFixed(0)}·(${d}−${(flange.hf / 2).toFixed(0)}) = ${Mnf.toFixed(1)} kN·m`,
      );
      st.push(
        `M_nw = M_n − M_nf = ${MnVal.toFixed(1)} − ${Mnf.toFixed(1)} = ${Mnw.toFixed(1)} kN·m`,
      );
      st.push(`Nervio como sección rectangular de ancho b_w = ${bw} mm:`);
      const sol = rectDesign(bw, Mnw, fc, fy, d, dp, KaMin, KaMax, st);
      AsReq = Asf + sol.AsReq;
      AspReq = sol.AspReq;
      Ka = sol.Ka;
      mn_val = (Mnw * 1e6) / (0.85 * fc * bw * d * d);
      // Profundidad del bloque de compresión en el nervio (neto de armadura
      // de compresión en caso de armadura doble).
      flangeA = ((AsReq - AspReq - Asf) * fy) / (0.85 * fc * bw);
      st.push(
        `A_s total = A_sf + A_sw = ${Asf.toFixed(0)} + ${sol.AsReq.toFixed(0)} = ${AsReq.toFixed(0)} mm²`,
      );
      caseLabel = `${sol.caseLabel} del nervio + alas (T, EN en nervio)`;
    }
  } else {
    mn_val = Mn_nmm / (0.85 * fc * bw * d * d);
    st.push(`m_n = M_n/(0.85·f'_c·b_w·d²) = ${mn_val.toFixed(4)}`);
    const sol = rectDesign(bw, MnVal, fc, fy, d, dp, KaMin, KaMax, st);
    AsReq = sol.AsReq;
    AspReq = sol.AspReq;
    Ka = sol.Ka;
    caseLabel = sol.caseLabel;
  }

  const AsMin1 = (Math.sqrt(fc) / (4 * fy)) * bw * d;
  const AsMin2 = (1.4 / fy) * bw * d;
  const AsMin = Math.max(AsMin1, AsMin2);
  st.push(
    `A_s mín = max(${AsMin1.toFixed(1)}, ${AsMin2.toFixed(1)}) = ${AsMin.toFixed(1)} mm²`,
  );
  const AsOK = AsProv >= Math.max(AsReq, AsMin);
  if (AsProv > 0) st.push(`A_s colocada = ${AsProv} mm² → ${AsOK ? "✓" : "✗"}`);

  // ========== CORTE ==========
  st.push("");
  st.push("--- CORTE ---");

  // 1. Vu at critical section
  const dist = directSupport ? c / 2 + d : c / 2;
  const VuCalc = Vu - qu * (dist / 1000); // kN
  st.push(`1. V_u en sección crítica:`);
  st.push(
    `   ${directSupport ? "Apoyo directo" : "Apoyo indirecto"}: dist = ${directSupport ? `c/2+d = ${(c / 2).toFixed(0)}+${d} = ${dist.toFixed(0)}` : `c/2 = ${(c / 2).toFixed(0)}`} mm`,
  );
  st.push(
    `   V_u(x=d) = V_u − q_u·dist = ${Vu.toFixed(1)} − ${qu.toFixed(2)}·${(dist / 1000).toFixed(3)} = ${VuCalc.toFixed(1)} kN`,
  );

  // 2. Vn
  const Vn = VuCalc / phiV;
  st.push(
    `2. V_n = V_u/φ = ${VuCalc.toFixed(1)}/${phiV} = ${Vn.toFixed(1)} kN`,
  );

  // 3. Max capacity
  const VnMax = ((5 / 6) * Math.sqrt(fc) * bw * d) / 1000;
  st.push(
    `3. V_n máx = 5/6·√f'_c·b_w·d = 5/6·√${fc}·${bw}·${d} = ${VnMax.toFixed(1)} kN`,
  );
  st.push(
    `   V_n (${Vn.toFixed(1)}) ≤ V_n máx (${VnMax.toFixed(1)}) → ${Vn <= VnMax ? "✓ OK" : "✗ Redimensionar sección"}`,
  );

  // 4. Vc
  const Vc = ((1 / 6) * Math.sqrt(fc) * bw * d) / 1000;
  st.push(
    `4. V_c = 1/6·√f'_c·b_w·d = 1/6·√${fc}·${bw}·${d} = ${Vc.toFixed(1)} kN`,
  );

  // 5. Vs
  const VsReq = Vn - Vc;
  st.push(
    `5. V_s = V_n − V_c = ${Vn.toFixed(1)} − ${Vc.toFixed(1)} = ${VsReq.toFixed(1)} kN`,
  );
  if (VsReq <= 0) {
    st.push(`   V_s ≤ 0 → no requiere armadura de corte por cálculo`);
  }

  // 6. Av/s required
  const AvSReq = VsReq > 0 ? ((VsReq * 1000) / (fy * d)) * 1000 : 0; // mm²/m
  if (VsReq > 0) {
    st.push(
      `6. A_v/s = V_s/(f_y·d) = ${(VsReq * 1000).toFixed(0)}/(${fy}·${d}) = ${(AvSReq / 1000).toFixed(4)} mm²/mm = ${AvSReq.toFixed(1)} mm²/m`,
    );
  }

  // 7. Minimum stirrups
  const AvSMin1 = (((1 / 16) * Math.sqrt(fc) * bw) / fy) * 1000; // mm²/m
  const AvSMin2 = ((0.33 * bw) / fy) * 1000;
  const AvSMin = Math.max(AvSMin1, AvSMin2);
  st.push(`7. Estribado mínimo:`);
  st.push(
    `   A_v/s ≥ 1/16·√f'_c·b_w/f_y = 1/16·√${fc}·${bw}/${fy} = ${AvSMin1.toFixed(1)} mm²/m`,
  );
  st.push(
    `   A_v/s ≥ 0.33·b_w/f_y = 0.33·${bw}/${fy} = ${AvSMin2.toFixed(1)} mm²/m`,
  );
  st.push(`   A_v/s mín = ${AvSMin.toFixed(1)} mm²/m`);

  // 8. Max spacing
  const VsLimit = ((1 / 3) * Math.sqrt(fc) * bw * d) / 1000;
  let sMax: number;
  st.push(`8. Separación máxima:`);
  st.push(
    `   V_s límite = 1/3·√f'_c·b_w·d = 1/3·√${fc}·${bw}·${d} = ${VsLimit.toFixed(1)} kN`,
  );
  if (VsReq <= VsLimit) {
    sMax = Math.min(d / 2, 400);
    st.push(
      `   V_s (${VsReq.toFixed(1)}) ≤ V_s límite → s ≤ d/2 = ${(d / 2).toFixed(0)} mm y s ≤ 400 mm`,
    );
  } else {
    sMax = Math.min(d / 4, 200);
    st.push(
      `   V_s (${VsReq.toFixed(1)}) > V_s límite → s ≤ d/4 = ${(d / 4).toFixed(0)} mm y s ≤ 200 mm`,
    );
  }
  st.push(`   s_máx = ${sMax} mm`);

  // 9. Check provided
  let VsProv = 0,
    shearOK = false,
    shearFailReason: string | null = null;
  if (Av > 0 && nLegs > 0 && s > 0) {
    VsProv = (nLegs * Av * fy * d) / s / 1000;
    const AvSProv = (nLegs * Av * 1000) / s;
    st.push(
      `9. A_v/s colocado = n·A₁v/s = ${nLegs}·${Av}/${s}·1000 = ${AvSProv.toFixed(1)} mm²/m`,
    );
    st.push(
      `   V_s colocado = A_v·f_y·d/s = ${nLegs}·${Av}·${fy}·${d}/${s} = ${VsProv.toFixed(1)} kN`,
    );
    const req = Math.max(VsReq > 0 ? AvSReq : AvSMin, AvSMin);
    shearOK = VsProv >= VsReq && s <= sMax && AvSProv >= req;
    if (!shearOK) {
      const fail: string[] = [];
      if (s > sMax)
        fail.push(
          `separación ${(s / 10).toFixed(1)} cm > s_máx ${(sMax / 10).toFixed(1)} cm`,
        );
      if (AvSProv < req)
        fail.push(
          `A_v/s ${(AvSProv / 100).toFixed(2)} cm²/m < requerido ${(req / 100).toFixed(2)} cm²/m`,
        );
      shearFailReason = fail.join(" · ");
    }
    st.push(
      `   ${shearOK ? "✓ Verifica corte" : `✗ No verifica — ${shearFailReason}`}`,
    );
  } else if (VsReq > 0) {
    shearOK = false;
    shearFailReason = "no se colocaron estribos";
    st.push(`9. No se colocaron estribos → no verifica`);
  } else {
    shearOK = true;
    st.push(`9. No requiere estribos por cálculo`);
  }

  return {
    d,
    dp,
    beta1,
    Mu,
    Vu,
    VuCalc,
    mn: mn_val,
    Ka,
    KaMin,
    KaMax,
    caseLabel,
    AsReq: Math.round(AsReq),
    AspReq: Math.round(AspReq),
    AsMin: Math.round(AsMin),
    AsOK,
    flangeB,
    flangeA,
    flangeEN,
    Vn,
    Vc,
    VsReq: VsReq > 0 ? VsReq : 0,
    VsProv,
    VnMax,
    shearOK,
    shearFailReason,
    AvSMin,
    sMax,
    steps: st,
  };
}
