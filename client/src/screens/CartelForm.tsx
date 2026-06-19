import { useState } from "react";
import MainLayout from "../components/MainLayout";
import { ANGLE_PROFILES, type AngleData } from "../lib/angle-profiles";

// Simple angle verification per CIRSOC 301
function checkAngleCompForce(angle: AngleData, Fy: number, L_mm: number, K: number, force_kN: number) {
  const Ag = angle.A * 100;
  const r = angle.rz * 10;
  const KLr = (K * L_mm) / r;
  const lambdaC = (KLr / Math.PI) * Math.sqrt(Fy / 200000);
  const Fcr = lambdaC <= 1.5 ? Math.pow(0.658, lambdaC * lambdaC) * Fy : (0.877 / (lambdaC * lambdaC)) * Fy;
  const Pn = (Fcr * Ag) / 1000; // kN
  const phiPn = 0.90 * Pn;
  return { phiPn, ratio: force_kN / phiPn, ok: force_kN <= phiPn, KLr, Fcr };
}

function handleCommaKey(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === ",") {
    e.preventDefault();
    const t = e.currentTarget;
    const s = t.selectionStart ?? 0, end = t.selectionEnd ?? 0;
    t.value = t.value.substring(0, s) + "." + t.value.substring(end);
    t.setSelectionRange(s + 1, s + 1);
    t.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

export default function CartelForm() {
  // Lateral view
  const [hTerraza, setHTerraza] = useState(9.05);
  const [hc, setHc] = useState(7.20);
  const [d, setD] = useState(1.85);
  const [a, setA] = useState(5.52);
  const [b, setB] = useState(1.11);
  // Frontal view
  const [anchoCartel, setAnchoCartel] = useState(15.0);
  const [sepColumnas, setSepColumnas] = useState(2.0);
  const [sepCorreas, setSepCorreas] = useState(1.0);
  // Wind
  const [DLoad, setDLoad] = useState(15); // kg/m²
  const [V, setV] = useState(45);     // m/s basic wind speed
  const [categoria, setCategoria] = useState("II");
  const [exposicion, setExposicion] = useState("B");
  const [tipoColumna, setTipoColumna] = useState(2);
  // Column reticulate
  const [hCol, setHCol] = useState(0.40);  // m (column section width)
  const [aCol, setACol] = useState(0.50);  // m (panel height)
  const [perfilCordon, setPerfilCordon] = useState('L 2 1/2" x 1/4"');
  const [perfilDiagonal, setPerfilDiagonal] = useState('L 1 1/2" x 3/16"');
  const [perfilMontante, setPerfilMontante] = useState('L 1 1/4" x 1/8"');
  const [FyCol, setFyCol] = useState(235);

  const ht = hc + d;
  const consistente = ht === hc + d;
  const lPuntal = Math.sqrt(a * a + b * b);
  const alpha = Math.atan(a / b) * (180 / Math.PI);

  // Frontal calculations
  const nColumnas = Math.round(anchoCartel / sepColumnas) + 1;
  const nCorreas = Math.round(hc / sepCorreas) + 1;
  const areaColumna = sepColumnas * hc;
  const areaCorrea = sepCorreas * sepColumnas;

  // Wind per CIRSOC 102
  const Ivals: Record<string, number> = { "I": 0.87, "II": 1.00, "III": 1.15, "IV": 1.15 };
  const expVals: Record<string, { alpha: number; zg: number }> = {
    "A": { alpha: 5.0, zg: 457 }, "B": { alpha: 7.0, zg: 366 },
    "C": { alpha: 9.5, zg: 274 }, "D": { alpha: 11.5, zg: 213 },
  };
  const I = Ivals[categoria] || 1.0;
  const { alpha: expAlpha, zg: expZg } = expVals[exposicion] || expVals["B"];
  const zMean = hTerraza + d + hc / 2; // mean height of sign
  const zMin = 4.5; // minimum height for Kz
  const z = Math.max(zMean, zMin);
  const Kz = 2.01 * Math.pow(z / expZg, 2 / expAlpha);
  const Kd = 0.85; // directionality
  const Kzt = 1.0; // topographic
  const qz = 0.613 * Kz * Kzt * Kd * V * V * I; // N/m²
  const G = 0.85;  // gust factor
  const Cp = 1.2;  // pressure coefficient for signs
  const p = qz * G * Cp; // design wind pressure N/m²
  const Fviento = p * (anchoCartel * hc) / 1000; // kN

  // Column truss module
  const dDiag = Math.sqrt(hCol * hCol + aCol * aCol); // diagonal length
  const alturaColumna = ht; // total column height = hc + d
  const nPaneles = Math.ceil(alturaColumna / aCol);
  const longCordones = 2 * alturaColumna; // two chords
  const longMontantes = (nPaneles + 1) * hCol; // one horizontal per node
  const longDiagonales = nPaneles * dDiag;
  const longTotal = longCordones + longMontantes + longDiagonales;

  // Column forces & verification
  const Fcol = Fviento / nColumnas; // kN per column
  const Mbase = Fcol * zMean; // kN·m at base
  const Nchord = Mbase / hCol; // kN chord force
  const sinAlphaCol = hCol / dDiag;
  const Ndiag = Fcol / sinAlphaCol; // kN diagonal force
  const Nmont = Fcol; // kN (vertical from shear, simplified)

  const angCordon = ANGLE_PROFILES.find(a => a.name === perfilCordon)!;
  const angDiag = ANGLE_PROFILES.find(a => a.name === perfilDiagonal)!;
  const angMont = ANGLE_PROFILES.find(a => a.name === perfilMontante)!;

  const chkCordon = angCordon ? checkAngleCompForce(angCordon, FyCol, aCol * 1000, 1.0, Nchord) : null;
  const chkDiag = angDiag ? checkAngleCompForce(angDiag, FyCol, dDiag * 1000, 1.0, Ndiag) : null;
  const chkMont = angMont ? checkAngleCompForce(angMont, FyCol, hCol * 1000, 1.0, Nmont) : null;

  // Column as unit: interaction ratio = max of component ratios
  const ratioColumna = Math.max(
    chkCordon?.ratio ?? 0,
    chkDiag?.ratio ?? 0,
    chkMont?.ratio ?? 0,
  );

  // Column verification steps
  const colSteps = [
    `--- Solicitaciones en la columna ---`,
    ``,
    `F_viento total = ${Fviento.toFixed(1)} kN`,
    `Columnas = ${nColumnas}`,
    `F_col = F_viento / columnas = ${Fviento.toFixed(1)} / ${nColumnas} = ${Fcol.toFixed(2)} kN`,
    ``,
    `Altura media: z = h_terraza + d + hc/2 = ${hTerraza} + ${d} + ${hc}/2 = ${zMean.toFixed(2)} m`,
    `Momento en base: M_base = F_col · z = ${Fcol.toFixed(2)} · ${zMean.toFixed(2)} = ${Mbase.toFixed(1)} kN·m`,
    ``,
    `Fuerza en cordón: N = M_base / h_col = ${Mbase.toFixed(1)} / ${hCol} = ${Nchord.toFixed(1)} kN`,
    `  (compresión en un cordón, tracción en el otro)`,
    ``,
    `sin α = h_col / d_diag = ${hCol} / ${dDiag.toFixed(2)} = ${sinAlphaCol.toFixed(4)}`,
    `Fuerza en diagonal: N = F_col / sin α = ${Fcol.toFixed(2)} / ${sinAlphaCol.toFixed(4)} = ${Ndiag.toFixed(1)} kN`,
    ``,
    `Fuerza en montante: N ≈ F_col = ${Nmont.toFixed(1)} kN (simplificado)`,
    ``,
    `--- Verificación de barras (CIRSOC 301, φ_c = 0.90) ---`,
    ``,
    `Cordón ${perfilCordon}: A=${angCordon?.A}cm², r_z=${angCordon?.rz}cm, L_pandeo=a_col=${aCol}m`,
    `  KL/r = 1.0·${(aCol*1000).toFixed(0)} / ${(angCordon ? angCordon.rz*10 : 0).toFixed(0)} = ${chkCordon?.KLr.toFixed(0)}, λ_c = ${(chkCordon?.KLr??0 / Math.PI * Math.sqrt(235/200000)).toFixed(3)}`,
    `  F_cr = ${chkCordon?.Fcr.toFixed(0)} MPa, φ·P_n = ${chkCordon?.phiPn.toFixed(1)} kN`,
    `  Ratio = ${Nchord.toFixed(1)} / ${chkCordon?.phiPn.toFixed(1)} = ${chkCordon?.ratio.toFixed(2)} ${chkCordon?.ok ? "✓" : "✗"}`,
    ``,
    `Diagonal ${perfilDiagonal}: A=${angDiag?.A}cm², r_z=${angDiag?.rz}cm, L_pandeo=d_diag=${dDiag.toFixed(2)}m`,
    `  KL/r = 1.0·${(dDiag*1000).toFixed(0)} / ${(angDiag ? angDiag.rz*10 : 0).toFixed(0)} = ${chkDiag?.KLr.toFixed(0)}`,
    `  F_cr = ${chkDiag?.Fcr.toFixed(0)} MPa, φ·P_n = ${chkDiag?.phiPn.toFixed(1)} kN`,
    `  Ratio = ${Ndiag.toFixed(1)} / ${chkDiag?.phiPn.toFixed(1)} = ${chkDiag?.ratio.toFixed(2)} ${chkDiag?.ok ? "✓" : "✗"}`,
    ``,
    `Montante ${perfilMontante}: A=${angMont?.A}cm², r_z=${angMont?.rz}cm, L_pandeo=h_col=${hCol}m`,
    `  KL/r = 1.0·${(hCol*1000).toFixed(0)} / ${(angMont ? angMont.rz*10 : 0).toFixed(0)} = ${chkMont?.KLr.toFixed(0)}`,
    `  F_cr = ${chkMont?.Fcr.toFixed(0)} MPa, φ·P_n = ${chkMont?.phiPn.toFixed(1)} kN`,
    `  Ratio = ${Nmont.toFixed(1)} / ${chkMont?.phiPn.toFixed(1)} = ${chkMont?.ratio.toFixed(2)} ${chkMont?.ok ? "✓" : "✗"}`,
    ``,
    `--- Columna como unidad ---`,
    `Ratio máximo = ${ratioColumna.toFixed(2)} ${ratioColumna <= 1 ? "✓ Verifica" : "✗ No verifica"}`,
  ].join("\n");

  // Wind calculation steps
  const A_cartel = anchoCartel * hc;
  const windSteps = [
    `--- Cálculo de viento (CIRSOC 102) ---`,
    ``,
    `1. Factor de importancia I:`,
    `   Categoría ${categoria} → I = ${I.toFixed(2)}`,
    ``,
    `2. Coeficiente de exposición K_z:`,
    `   Exposición ${exposicion}: α = ${expAlpha}, z_g = ${expZg} m`,
    `   z = h_terraza + d + hc/2 = ${hTerraza} + ${d} + ${hc}/2 = ${zMean.toFixed(2)} m`,
    `   z ≥ 4.5 m → z = ${z.toFixed(2)} m`,
    `   K_z = 2.01 · (z/z_g)^(2/α) = 2.01 · (${z.toFixed(2)}/${expZg})^(2/${expAlpha}) = ${Kz.toFixed(4)}`,
    ``,
    `3. Presión dinámica q_z:`,
    `   q_z = 0.613 · K_z · K_{zt} · K_d · V² · I`,
    `   q_z = 0.613 · ${Kz.toFixed(3)} · ${Kzt} · ${Kd} · ${V}² · ${I.toFixed(2)} = ${qz.toFixed(0)} N/m²`,
    `   (K_{zt} = 1.0 topografía plana, K_d = 0.85 direccionalidad)`,
    ``,
    `4. Presión de diseño p:`,
    `   p = q_z · G · C_p = ${qz.toFixed(0)} · ${G} · ${Cp} = ${p.toFixed(0)} N/m²`,
    `   (G = 0.85 factor de ráfaga, C_p = 1.2 cartel abierto)`,
    ``,
    `5. Fuerza total de viento:`,
    `   A_cartel = ancho · h_c = ${anchoCartel.toFixed(2)} · ${hc.toFixed(2)} = ${A_cartel.toFixed(2)} m²`,
    `   F_viento = p · A_cartel = ${p.toFixed(0)} · ${A_cartel.toFixed(2)} = ${(p * A_cartel).toFixed(0)} N`,
    `   F_viento = ${Fviento.toFixed(1)} kN`,
  ].join("\n");

  // ===== SIDE VIEW DRAWING =====
  const svgW = 350, svgH = 480, pad = 30;
  const scale = (svgH - 2 * pad) / (hTerraza + ht);
  const groundY = svgH - pad;
  const terrazaY = groundY - hTerraza * scale;
  const towerTop = terrazaY - ht * scale;
  const startCargaY = terrazaY - d * scale;
  const anchorY = startCargaY - a * scale;
  const xCenter = svgW / 2;
  const puntalBaseX = xCenter + b * scale;

  // ===== FRONT VIEW DRAWING =====
  const fW = 500, fH = 250, fPad = 30;
  const fScale = (fW - 2 * fPad) / anchoCartel;
  const fHeight = hc * fScale * 0.7; // compress height for drawing
  const fy0 = fH - fPad;

  return (
    <MainLayout>
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
        </div>
        <div><h1 className="text-xl font-semibold text-text">Cálculo de Carteles</h1><p className="text-sm text-text-muted">Geometría y áreas de influencia</p></div>
      </header>

      {/* Inputs */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Vista lateral</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">h<sub>terraza</sub> (m)</span><input type="number" step="0.01" value={hTerraza||""} onKeyDown={handleCommaKey} onChange={e=>setHTerraza(Number(e.target.value))}/></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">h<sub>c</sub> (m)</span><input type="number" step="0.01" value={hc||""} onKeyDown={handleCommaKey} onChange={e=>setHc(Number(e.target.value))}/></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">d (m)</span><input type="number" step="0.01" value={d||""} onKeyDown={handleCommaKey} onChange={e=>setD(Number(e.target.value))}/></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">a (m)</span><input type="number" step="0.01" value={a||""} onKeyDown={handleCommaKey} onChange={e=>setA(Number(e.target.value))}/></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">b (m)</span><input type="number" step="0.01" value={b||""} onKeyDown={handleCommaKey} onChange={e=>setB(Number(e.target.value))}/></label>
        </div>
      </section>

      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Vista frontal</h2>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">Ancho cartel (m)</span><input type="number" step="0.1" value={anchoCartel||""} onKeyDown={handleCommaKey} onChange={e=>setAnchoCartel(Number(e.target.value))}/></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">Sep. columnas (m)</span><input type="number" step="0.1" value={sepColumnas||""} onKeyDown={handleCommaKey} onChange={e=>setSepColumnas(Number(e.target.value))}/></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">Sep. correas (m)</span><input type="number" step="0.1" value={sepCorreas||""} onKeyDown={handleCommaKey} onChange={e=>setSepCorreas(Number(e.target.value))}/></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">Tipo columna</span><select value={tipoColumna} onChange={e=>setTipoColumna(Number(e.target.value))}>
            <option value={1}>Tipo 1 — Simple</option>
            <option value={2}>Tipo 2 — Doble con celosía</option>
            <option value={3}>Tipo 3 — Cajón</option>
            <option value={4}>Tipo 4 — Celosía completa</option>
          </select></label>
        </div>
      </section>

      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Columna — Reticulado interno (Tipo {tipoColumna})</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">h<sub>col</sub> — Ancho sección (m)</span><input type="number" step="0.01" value={hCol||""} onKeyDown={handleCommaKey} onChange={e=>setHCol(Number(e.target.value))}/></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">a<sub>col</sub> — Alto panel (m)</span><input type="number" step="0.01" value={aCol||""} onKeyDown={handleCommaKey} onChange={e=>setACol(Number(e.target.value))}/></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">F<sub>y</sub> (MPa)</span><select value={FyCol} onChange={e=>setFyCol(Number(e.target.value))}>
            <option value={235}>235</option><option value={275}>275</option><option value={355}>355</option>
          </select></label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">Perfil cordones</span><select value={perfilCordon} onChange={e=>setPerfilCordon(e.target.value)}>{ANGLE_PROFILES.map(a=><option key={a.name} value={a.name}>{a.name}</option>)}</select></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">Perfil diagonales</span><select value={perfilDiagonal} onChange={e=>setPerfilDiagonal(e.target.value)}>{ANGLE_PROFILES.map(a=><option key={a.name} value={a.name}>{a.name}</option>)}</select></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">Perfil montantes</span><select value={perfilMontante} onChange={e=>setPerfilMontante(e.target.value)}>{ANGLE_PROFILES.map(a=><option key={a.name} value={a.name}>{a.name}</option>)}</select></label>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">d<sub>diag</sub> = √(h²+a²)</span><p className="text-lg font-bold text-primary">{dDiag.toFixed(2)} m</p></div>
          <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">Paneles</span><p className="text-lg font-bold text-primary">{nPaneles}</p><span className="text-xs text-text-muted">h={alturaColumna.toFixed(2)}m</span></div>
          <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">L cordones</span><p className="text-lg font-bold text-primary">{longCordones.toFixed(1)} m</p></div>
          <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">L montantes</span><p className="text-lg font-bold text-primary">{longMontantes.toFixed(1)} m</p></div>
          <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">L diagonales</span><p className="text-lg font-bold text-primary">{longDiagonales.toFixed(1)} m</p></div>
          <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">Longitud total de acero</span><p className="text-lg font-bold text-primary">{longTotal.toFixed(1)} m</p><span className="text-xs text-text-muted">Por columna × {nColumnas} = {(longTotal*nColumnas).toFixed(1)} m total</span></div>
        </div>
        {/* Forces and verification */}
        <div className="border-t border-border mt-4 pt-4">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Solicitaciones y verificación</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
            <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">F<sub>col</sub></span><p className="text-sm font-bold">{Fcol.toFixed(1)} kN</p></div>
            <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">M<sub>base</sub></span><p className="text-sm font-bold">{Mbase.toFixed(1)} kN·m</p></div>
            <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">N<sub>cordón</sub> = M/h</span><p className="text-sm font-bold">{Nchord.toFixed(1)} kN</p></div>
            <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">N<sub>diag</sub> = V/sin α</span><p className="text-sm font-bold">{Ndiag.toFixed(1)} kN</p></div>
            <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">N<sub>mont</sub></span><p className="text-sm font-bold">{Nmont.toFixed(1)} kN</p></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {chkCordon && (<div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">Cordón ({perfilCordon})</span><p className="text-sm">KL/r={chkCordon.KLr.toFixed(0)} F<sub>cr</sub>={chkCordon.Fcr.toFixed(0)} MPa</p><span className={`text-sm font-bold ${chkCordon.ok ? "text-success" : "text-danger"}`}>{chkCordon.ok ? "✓" : "✗"} Ratio {chkCordon.ratio.toFixed(2)}</span></div>)}
            {chkDiag && (<div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">Diagonal ({perfilDiagonal})</span><p className="text-sm">KL/r={chkDiag.KLr.toFixed(0)} F<sub>cr</sub>={chkDiag.Fcr.toFixed(0)} MPa</p><span className={`text-sm font-bold ${chkDiag.ok ? "text-success" : "text-danger"}`}>{chkDiag.ok ? "✓" : "✗"} Ratio {chkDiag.ratio.toFixed(2)}</span></div>)}
            {chkMont && (<div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">Montante ({perfilMontante})</span><p className="text-sm">KL/r={chkMont.KLr.toFixed(0)} F<sub>cr</sub>={chkMont.Fcr.toFixed(0)} MPa</p><span className={`text-sm font-bold ${chkMont.ok ? "text-success" : "text-danger"}`}>{chkMont.ok ? "✓" : "✗"} Ratio {chkMont.ratio.toFixed(2)}</span></div>)}
          </div>
          <div className={`mt-3 p-3 rounded-lg text-sm font-bold text-center ${ratioColumna <= 1 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            Columna como unidad: Ratio máx = {ratioColumna.toFixed(2)} {ratioColumna <= 1 ? "✓ Verifica" : "✗ No verifica"}
          </div>
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-text-muted font-semibold uppercase tracking-wider">Ver cuentas de columna</summary>
          <pre className="mt-2 p-3 bg-surface-alt rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto">{colSteps}</pre>
        </details>
      </section>

      {/* Reticulado drawing */}
      {tipoColumna === 2 && (
        <section className="bg-surface rounded-xl border border-border p-4 flex flex-col items-center">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-2">Reticulado interno — Columna Tipo 2</span>
          {(() => {
            const rW = 280, rH = 320, rPad = 30;
            const nShow = Math.min(nPaneles, 5);
            const panelH = (rH - 2 * rPad) / nShow;
            const colW = 80;
            const x0 = (rW - colW) / 2;
            const x1 = x0 + colW;
            const lines: React.ReactNode[] = [];
            // Chords
            lines.push(<line key="ch-l" x1={x0} y1={rPad} x2={x0} y2={rPad + nShow * panelH} stroke="#fbbf24" strokeWidth={3} />);
            lines.push(<line key="ch-r" x1={x1} y1={rPad} x2={x1} y2={rPad + nShow * panelH} stroke="#fbbf24" strokeWidth={3} />);
            for (let i = 0; i <= nShow; i++) {
              const y = rPad + i * panelH;
              // Horizontal
              lines.push(<line key={`h-${i}`} x1={x0} y1={y} x2={x1} y2={y} stroke="#4ade80" strokeWidth={2} />);
              // Diagonal (ascending left-low to right-high) — skip last row
              if (i < nShow) {
                lines.push(<line key={`d-${i}`} x1={x0} y1={y + panelH} x2={x1} y2={y} stroke="#f87171" strokeWidth={2} />);
              }
            }
            // Dimensions
            lines.push(<line key="dim-h" x1={x0} y1={rPad + nShow * panelH + 12} x2={x1} y2={rPad + nShow * panelH + 12} stroke="#9090b0" strokeWidth={1} strokeDasharray="3,2" />);
            lines.push(<line key="dim-h-t1" x1={x0} y1={rPad + nShow * panelH + 8} x2={x0} y2={rPad + nShow * panelH + 16} stroke="#9090b0" strokeWidth={1} />);
            lines.push(<line key="dim-h-t2" x1={x1} y1={rPad + nShow * panelH + 8} x2={x1} y2={rPad + nShow * panelH + 16} stroke="#9090b0" strokeWidth={1} />);
            lines.push(<text key="dim-h-txt" x={(x0 + x1) / 2} y={rPad + nShow * panelH + 24} fill="#9090b0" fontSize={9} textAnchor="middle">h_col = {hCol}m</text>);
            lines.push(<line key="dim-a" x1={x0 - 10} y1={rPad} x2={x0 - 10} y2={rPad + panelH} stroke="#9090b0" strokeWidth={1} strokeDasharray="3,2" />);
            lines.push(<text key="dim-a-txt" x={x0 - 14} y={rPad + panelH / 2 + 3} fill="#9090b0" fontSize={9} textAnchor="end">a={aCol}m</text>);
            // Diagonal label
            lines.push(<text key="diag-label" x={(x0 + x1) / 2 + 5} y={rPad + panelH / 2 + 4} fill="#f87171" fontSize={9}>d={dDiag.toFixed(2)}</text>);
            // Legend
            lines.push(<text key="lg-c" x={rW / 2} y={rH - 6} fill="#fbbf24" fontSize={9} textAnchor="middle">Cordones — Montantes — Diagonales</text>);
            return <svg width={rW} height={rH} viewBox={`0 0 ${rW} ${rH}`}>{lines}</svg>;
          })()}
        </section>
      )}

      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Viento (CIRSOC 102)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">D (kg/m²)</span><input type="number" step="1" value={DLoad||""} onKeyDown={handleCommaKey} onChange={e=>setDLoad(Number(e.target.value))}/></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">V (m/s)</span><input type="number" step="1" value={V||""} onKeyDown={handleCommaKey} onChange={e=>setV(Number(e.target.value))}/></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">Categoría</span><select value={categoria} onChange={e=>setCategoria(e.target.value)}>
            <option value="I">I</option><option value="II">II</option><option value="III">III</option><option value="IV">IV</option>
          </select></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">Exposición</span><select value={exposicion} onChange={e=>setExposicion(e.target.value)}>
            <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
          </select></label>
        </div>
      </section>

      {/* Wind results */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Resultados</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">h<sub>t</sub></span><p className="text-lg font-bold text-primary">{ht.toFixed(2)} m</p><span className={`text-xs ${consistente ? "text-success" : "text-danger"}`}>{consistente ? "✓" : "✗ hc+d"}</span></div>
          <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">L<sub>puntal</sub></span><p className="text-lg font-bold text-primary">{lPuntal.toFixed(2)} m</p></div>
          <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">α</span><p className="text-lg font-bold text-primary">{alpha.toFixed(2)}°</p></div>
          <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">Columnas</span><p className="text-lg font-bold text-primary">{nColumnas}</p><span className="text-xs text-text-muted">A<sub>inf</sub> = {areaColumna.toFixed(1)} m²</span></div>
          <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">Correas</span><p className="text-lg font-bold text-primary">{nCorreas} líneas</p><span className="text-xs text-text-muted">A<sub>inf</sub> = {areaCorrea.toFixed(1)} m²</span></div>
          <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">I (importancia)</span><p className="text-lg font-bold text-primary">{I.toFixed(2)}</p></div>
          <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">K<sub>z</sub></span><p className="text-lg font-bold text-primary">{Kz.toFixed(3)}</p><span className="text-xs text-text-muted">z = {z.toFixed(1)} m</span></div>
          <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">q<sub>z</sub> (N/m²)</span><p className="text-lg font-bold text-primary">{qz.toFixed(0)}</p></div>
          <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">p (N/m²)</span><p className="text-lg font-bold text-primary">{p.toFixed(0)}</p></div>
          <div className="bg-surface-alt rounded-lg p-3"><span className="text-xs text-text-muted">F<sub>viento</sub></span><p className="text-lg font-bold text-primary">{Fviento.toFixed(1)} kN</p><span className="text-xs text-text-muted">Fuerza total cartel</span></div>
        </div>
      </section>

      <details className="bg-surface rounded-xl border border-border p-5">
        <summary className="cursor-pointer text-sm font-semibold text-text-muted uppercase tracking-wider">Ver cuentas de viento</summary>
        <pre className="mt-3 p-3 bg-surface-alt rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto">{windSteps}</pre>
      </details>

      {/* Drawings */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Side view */}
        <section className="bg-surface rounded-xl border border-border p-4 flex flex-col items-center">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-2">Vista lateral</span>
          <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
            <line x1={pad} y1={groundY} x2={svgW-pad} y2={groundY} stroke="#6b7280" strokeWidth={2}/>
            <text x={pad} y={groundY+15} fill="#6b7280" fontSize={10}>Suelo</text>
            <rect x={pad} y={terrazaY} width={svgW-2*pad} height={hTerraza*scale} fill="#1a1a2e" stroke="#9090b0" strokeWidth={1}/>
            <line x1={pad} y1={terrazaY} x2={svgW-pad} y2={terrazaY} stroke="#7c8aff" strokeWidth={2} strokeDasharray="8,4"/>
            <text x={pad+5} y={terrazaY-5} fill="#7c8aff" fontSize={9}>Terraza</text>
            <line x1={xCenter} y1={terrazaY} x2={xCenter} y2={towerTop} stroke="#fbbf24" strokeWidth={4}/>
            <line x1={xCenter-15} y1={terrazaY} x2={xCenter-15} y2={startCargaY} stroke="#fbbf24" strokeWidth={1} strokeDasharray="3,2"/>
            <text x={xCenter-20} y={(terrazaY+startCargaY)/2+4} fill="#fbbf24" fontSize={9} textAnchor="end">d={d}m</text>
            <line x1={xCenter+15} y1={startCargaY} x2={xCenter+15} y2={towerTop} stroke="#fbbf24" strokeWidth={1} strokeDasharray="3,2"/>
            <text x={xCenter+18} y={(startCargaY+towerTop)/2+4} fill="#fbbf24" fontSize={9}>hc={hc}m</text>
            <line x1={xCenter} y1={anchorY} x2={puntalBaseX} y2={terrazaY} stroke="#4ade80" strokeWidth={3}/>
            <line x1={xCenter-25} y1={startCargaY} x2={xCenter-25} y2={anchorY} stroke="#4ade80" strokeWidth={1} strokeDasharray="3,2"/>
            <text x={xCenter-28} y={(startCargaY+anchorY)/2+4} fill="#4ade80" fontSize={9} textAnchor="end">a={a}m</text>
            <line x1={xCenter} y1={terrazaY+10} x2={puntalBaseX} y2={terrazaY+10} stroke="#4ade80" strokeWidth={1} strokeDasharray="3,2"/>
            <text x={(xCenter+puntalBaseX)/2} y={terrazaY+22} fill="#4ade80" fontSize={9} textAnchor="middle">b={b}m</text>
            <text x={xCenter+10} y={terrazaY-8} fill="#4ade80" fontSize={9}>α={alpha.toFixed(1)}°</text>
            <circle cx={xCenter} cy={anchorY} r={3} fill="#4ade80"/><circle cx={puntalBaseX} cy={terrazaY} r={3} fill="#4ade80"/><circle cx={xCenter} cy={terrazaY} r={3} fill="#fbbf24"/>
          </svg>
        </section>

        {/* Front view */}
        <section className="bg-surface rounded-xl border border-border p-4 flex flex-col items-center">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-2">Vista frontal</span>
          <svg width={fW} height={fH} viewBox={`0 0 ${fW} ${fH}`}>
            {/* Cartel area */}
            <rect x={fPad} y={fy0-fHeight} width={anchoCartel*fScale} height={fHeight} fill="#1a1a2e" stroke="#fbbf24" strokeWidth={1}/>
            {/* Columns */}
            {Array.from({length: nColumnas}, (_, i) => {
              const cx = fPad + i * sepColumnas * fScale;
              return <line key={i} x1={cx} y1={fy0-fHeight} x2={cx} y2={fy0} stroke="#7c8aff" strokeWidth={2}/>;
            })}
            {/* Correas */}
            {Array.from({length: nCorreas}, (_, i) => {
              const cy = fy0 - fHeight + (i * sepCorreas * fScale * 0.7) / hc * fHeight;
              return <line key={i} x1={fPad} y1={cy} x2={fPad+anchoCartel*fScale} y2={cy} stroke="#4ade80" strokeWidth={1.5}/>;
            })}
            {/* Sep columnas */}
            {nColumnas >= 2 && <>
              <line x1={fPad} y1={fy0+10} x2={fPad+sepColumnas*fScale} y2={fy0+10} stroke="#7c8aff" strokeWidth={1} strokeDasharray="3,2"/>
              <text x={fPad + sepColumnas*fScale/2} y={fy0+22} fill="#7c8aff" fontSize={9} textAnchor="middle">s<sub>c</sub>={sepColumnas}m</text>
            </>}
            {/* Sep correas */}
            {nCorreas >= 2 && <>
              <line x1={fPad-8} y1={fy0-fHeight} x2={fPad-8} y2={fy0-fHeight+sepCorreas*fHeight/hc*0.7} stroke="#4ade80" strokeWidth={1} strokeDasharray="3,2"/>
              <text x={fPad-12} y={fy0-fHeight+sepCorreas*fHeight/hc*0.35+4} fill="#4ade80" fontSize={9} textAnchor="end">s<sub>r</sub>={sepCorreas}m</text>
            </>}
            {/* Ancho */}
            <line x1={fPad} y1={fy0+30} x2={fPad+anchoCartel*fScale} y2={fy0+30} stroke="#fbbf24" strokeWidth={1} strokeDasharray="3,2"/>
            <text x={fPad+anchoCartel*fScale/2} y={fy0+42} fill="#fbbf24" fontSize={9} textAnchor="middle">{anchoCartel} m</text>
            {/* Height */}
            <line x1={fPad+anchoCartel*fScale+10} y1={fy0-fHeight} x2={fPad+anchoCartel*fScale+10} y2={fy0} stroke="#fbbf24" strokeWidth={1} strokeDasharray="3,2"/>
            <text x={fPad+anchoCartel*fScale+18} y={fy0-fHeight/2+4} fill="#fbbf24" fontSize={9}>h<sub>c</sub>={hc}m</text>
            {/* Legend */}
            <text x={fPad} y={fy0+58} fill="#7c8aff" fontSize={9}>Columnas ({nColumnas}) — Área inf. col: {areaColumna.toFixed(1)} m²</text>
            <text x={fPad} y={fy0+70} fill="#4ade80" fontSize={9}>Correas ({nCorreas} líneas) — Área inf. correa: {areaCorrea.toFixed(1)} m²</text>
          </svg>
        </section>
      </div>
    </MainLayout>
  );
}
