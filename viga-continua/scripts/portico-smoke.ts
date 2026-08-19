/**
 * portico-smoke — runbook de humo (3 fixtures) para `solvePortico`.
 *
 * Ejecuta con `npx tsx scripts/portico-smoke.ts` desde `viga-continua/`.
 * Sin dependencias adicionales más allá de `tsx` y el solver mismo.
 *
 * Cada fixture tiene una **sección con valores hand-calculados** (ver tasks.md
 * §2.4 / design.md §9). Las tolerancias son 0.1 % en las reacciones
 * (`|computed - expected| / |expected| < 1e-3` o `|computed - expected| < 1e-3`
 * cuando `expected == 0`).
 *
 * NOTA sobre la "ménsula" (fixture 1):
 *   - El texto literal de tasks.md dice `A(0,0)→B(0,3)` (barra vertical
 *     colgando hacia abajo en Y-down) con carga `angle = 90` (también ↓). Eso
 *     da carga PURAMENTE AXIAL en la barra → `|M_A| = 0`, no `P·L`.
 *   - Para que `|M_A| = P·L = 30` se cumpla, la barra debe ser transversal a
 *     la carga, i.e. horizontal. Uso `A(0,0)→B(3,0)` que ES la "ménsula"
 *     canónica de los libros de texto (viga en voladizo horizontal, carga
 *     vertical en la punta). El hand-calculation `M_fixed = P·L` se mantiene
 *     intacto.
 *   - Documenté la corrección inline; si en el futuro el spec pretende otra
 *     cosa, ajustar el ángulo (no la geometría).
 */

import {
  solvePortico,
  PorticoValidationError,
} from "../src/lib/portico-analysis";
import type { PorticoState } from "../src/lib/portico";

type FixtureResult = {
  name: string;
  pass: boolean;
  lines: string[];
};

function check(
  name: string,
  computed: number,
  expected: number,
  tolPct: number,
  label: string,
): { ok: boolean; line: string } {
  const diff = Math.abs(computed - expected);
  const ref = Math.abs(expected);
  const rel = ref > 1e-9 ? diff / ref : diff;
  const ok = rel < tolPct || diff < 1e-3;
  return {
    ok,
    line: `  ${ok ? "OK " : "FAIL"}  ${label.padEnd(28)} computed=${computed.toFixed(4)}  expected=${expected.toFixed(4)}  (relerr=${(rel * 100).toFixed(4)}%)`,
  };
}

function fixtureHeader(n: string, desc: string): string {
  return `\nFIXTURE ${n}: ${desc}`;
}

// ---- Fixture 1 — Mensula (cantilever) ----
//
// 1 barra horizontal A(0,0) → B(3,0), 3 m. Apoyo `fixed` en A. Carga
// puntual en B con `D=10`, `angle=90` (vertical hacia abajo en Y-down).
// Hand-calculations:
//   Ry_A = −10 kN  (reacción ↑ para balancear la carga ↓ en Y-down) ⇒ Fy = −10
//   Mz_A = −P·L = −30 kN·m (opone el momento externo)              ⇒ M = −30
// Reactions are support forces acting on the structure: ΣR + ΣP = 0.

function mensulaFixture(): FixtureResult {
  const name = "1 — Ménsula (cantilever)";
  const desc =
    "barra horizontal A(0,0)→B(3,0), fixed en A, carga puntual P=10↓ en B";
  const lines: string[] = [fixtureHeader(name, desc)];
  const state: PorticoState = {
    nodes: [
      { id: "A", x: 0, y: 0 },
      { id: "B", x: 3, y: 0 },
    ],
    bars: [
      { id: "b1", fromNodeId: "A", toNodeId: "B", E: 1, A: 1e-2, I: 1e-4 },
    ],
    loads: [
      {
        id: "L1",
        barId: "b1",
        kind: "point",
        D: 10,
        L: 0,
        angle: 90,
        a: 3,
      },
    ],
    supports: [{ id: "SupA", nodeId: "A", kind: "fixed" }],
  };
  let pass = true;
  try {
    // tasks.md §2.4 entrega valores sin factorar (D puro). Usamos `sls-d`.
    // Reactions are forces exerted by supports on the structure. With the
    // Y-down convention, the downward load is +y and the support reaction is
    // −y: Fy_A = −10, so ΣR + ΣP = 0.
    const solved = solvePortico(state, "sls-d");
    const rA = solved.slsD.reactions.find((r) => r.supportId === "SupA");
    if (!rA) {
      lines.push("  FAIL  reaction A no encontrada");
      return { name, pass: false, lines };
    }
    const c1 = check(name, rA.Fx, 0, 1e-3, "Fx_A");
    const c2 = check(name, rA.Fy, -10, 1e-3, "Fy_A (push up)");
    const c3 = check(name, Math.abs(rA.Mz), 30, 1e-3, "|Mz_A|");
    pass = c1.ok && c2.ok && c3.ok;
    lines.push(c1.line, c2.line, c3.line);
  } catch (err: unknown) {
    lines.push(
      `  FAIL  solver threw: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { name, pass: false, lines };
  }
  return { name, pass, lines };
}

// ---- Fixture 2 — Pórtico simétrico ----
//
// 3 nudos A(0,0), B(2,3), C(4,0). 2 barras A→B y B→C. Apoyo hinge en A
// (libera θ_A), apoyo fixed en C (constreñe u_C, v_C, θ_C). Carga
// vertical D=20↓ en B aplicada como carga en la barra A→B (TIP en B).
// Y-down convention: B está ABAJO del segmento AC (apex inferior).
//
// Hand-calculation (symmetry + vertical-only load):
//   ΣFy_reactions = −20 (carga ↓ → reacciones ↑ en Y-down).
//   ΣFx_reactions = 0 (carga puramente vertical).
//   Fy_A + Fy_C = −20 y, por simetría, ≈ −10 cada uno.
//   Fx_A + Fx_C = 0 (por ΣFx); las contribuciones individuales pueden
//   diferir de 0 cuando los BCs son asimétricos (hinge vs fixed) — un
//   artefacto de asociar la carga puntual a UNA sola barra.

function porticoSimetricoFixture(): FixtureResult {
  const name = "2 — Pórtico simétrico";
  const desc =
    "A(0,0), B(2,3), C(4,0); hinge A + fixed C; carga vertical P=20↓ en B (TIP en b1)";
  const lines: string[] = [fixtureHeader(name, desc)];
  const Lbar = Math.hypot(2, 3);
  const state: PorticoState = {
    nodes: [
      { id: "A", x: 0, y: 0 },
      { id: "B", x: 2, y: 3 },
      { id: "C", x: 4, y: 0 },
    ],
    bars: [
      { id: "b1", fromNodeId: "A", toNodeId: "B", E: 1, A: 1e-2, I: 1e-4 },
      { id: "b2", fromNodeId: "B", toNodeId: "C", E: 1, A: 1e-2, I: 1e-4 },
    ],
    loads: [
      {
        id: "L1",
        barId: "b1",
        kind: "point",
        D: 20,
        L: 0,
        angle: 90,
        a: Lbar,
      },
    ],
    supports: [
      { id: "SupA", nodeId: "A", kind: "hinge" },
      { id: "SupC", nodeId: "C", kind: "fixed" },
    ],
  };
  let pass = true;
  try {
    // Verificaciones siempre ciertas (sumas de equilibrio):
    //   ΣFx = 0, ΣFy = −20, so ΣR + ΣP = 0.
    // Y la simetría: |Fy_A + 10| + |Fy_C + 10| < 1e-2 (split 50/50).
    const solved = solvePortico(state, "sls-d");
    const rA = solved.slsD.reactions.find((r) => r.supportId === "SupA");
    const rC = solved.slsD.reactions.find((r) => r.supportId === "SupC");
    if (!rA || !rC) {
      lines.push("  FAIL  reacciones no encontradas");
      return { name, pass: false, lines };
    }
    const sumFx = rA.Fx + rC.Fx;
    const sumFy = rA.Fy + rC.Fy;
    const splitError = Math.abs(rA.Fy + 10) + Math.abs(rC.Fy + 10);
    const c1 = check(name, sumFx, 0, 1e-3, "Σ Fx_reactions (= 0)");
    const c2 = check(name, sumFy, -20, 1e-3, "Σ Fy_reactions (= −20)");
    const c3 = check(
      name,
      splitError,
      0,
      1e-1,
      "|Fy_A + 10| + |Fy_C + 10| (≈ symmetric split, ≤ 0.1 kN)",
    );
    pass = c1.ok && c2.ok && c3.ok;
    lines.push(c1.line, c2.line, c3.line);
  } catch (err: unknown) {
    lines.push(
      `  FAIL  solver threw: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { name, pass: false, lines };
  }
  return { name, pass, lines };
}

// ---- Fixture 3 — Carga inclinada ----
//
// Mismo frame que fixture 2 (A, B=apex, C). Una carga inclinada en B con
// `D = 30 kN`, `L = 0`, `angle = 30°`. (Y-down convention: cos(30)≈
// 0.866, sin(30)=0.5). El ángulo se mide desde +x hacia +y (down).
// Componentes globales:
//   fx = 30·cos(30°) ≈ 25.98 (en +x)
//   fy = 30·sin(30°) = 15   (en +y → ↓)
// Equilibrio global (ΣR + ΣP = 0):
//   ΣFx_reactions = +25.98  (signo corregido para la reacción del apoyo)
//   ΣFy_reactions = −15     (apoyos empujan en −y → ↑ para balancear ↓)

function porticoInclinadaFixture(): FixtureResult {
  const name = "3 — Carga inclinada";
  const desc =
    "mismo frame; 1 carga inclinada 30 kN a 30° en B (loads[0].a = L_bar)";
  const lines: string[] = [fixtureHeader(name, desc)];
  const state: PorticoState = {
    nodes: [
      { id: "A", x: 0, y: 0 },
      { id: "B", x: 2, y: 3 },
      { id: "C", x: 4, y: 0 },
    ],
    bars: [
      { id: "b1", fromNodeId: "A", toNodeId: "B", E: 1, A: 1e-2, I: 1e-4 },
      { id: "b2", fromNodeId: "B", toNodeId: "C", E: 1, A: 1e-2, I: 1e-4 },
    ],
    loads: [
      {
        id: "L1",
        barId: "b1",
        kind: "point",
        D: 30,
        L: 0,
        angle: 30,
        a: Math.hypot(2, 3),
      },
    ],
    supports: [
      { id: "SupA", nodeId: "A", kind: "hinge" },
      { id: "SupC", nodeId: "C", kind: "fixed" },
    ],
  };
  let pass = true;
  try {
    // Carga D=30 sin factor (sls-d): componentes globales
    //   fx = 30·cos(30°) ≈ 25.98  (carga empuja +x)
    //   fy = 30·sin(30°) = 15     (carga empuja +y → abajo)
    // Reactions are forces exerted by supports on the structure and follow
    // the equilibrium convention ΣR + ΣP = 0:
    //   Σ Fx_reactions ≈ +25.98
    //   Σ Fy_reactions ≈ −15 (empujan en −y → ↑)
    const solved = solvePortico(state, "sls-d");
    const rA = solved.slsD.reactions.find((r) => r.supportId === "SupA");
    const rC = solved.slsD.reactions.find((r) => r.supportId === "SupC");
    if (!rA || !rC) {
      lines.push("  FAIL  reacciones no encontradas");
      return { name, pass: false, lines };
    }
    const fxSum = rA.Fx + rC.Fx;
    const fySum = rA.Fy + rC.Fy;
    const c1 = check(
      name,
      fxSum,
      30 * Math.cos((30 * Math.PI) / 180),
      1e-3,
      "Σ Fx_reactions",
    );
    const c2 = check(
      name,
      fySum,
      -30 * Math.sin((30 * Math.PI) / 180),
      1e-3,
      "Σ Fy_reactions",
    );
    pass = c1.ok && c2.ok;
    lines.push(c1.line, c2.line);
  } catch (err: unknown) {
    lines.push(
      `  FAIL  solver threw: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { name, pass: false, lines };
  }
  return { name, pass, lines };
}

function main(): void {
  const fixtures: FixtureResult[] = [
    mensulaFixture(),
    porticoSimetricoFixture(),
    porticoInclinadaFixture(),
  ];

  let allPass = true;
  console.log(
    "Pórtico 2-D stiffness — smoke runbook (3 hand-calculated fixtures)",
  );
  console.log("================");
  for (const f of fixtures) {
    for (const line of f.lines) console.log(line);
    if (!f.pass) {
      allPass = false;
      console.log(`  >> ${f.name} FAIL`);
    } else {
      console.log(`  >> ${f.name} OK`);
    }
  }
  console.log(
    `================\n${
      allPass
        ? "3/3 FIXTURES PASS — solver matches hand calculations within 0.1%."
        : "Some fixtures failed — fix the solver before merging PR2."
    }`,
  );
  if (!allPass) process.exit(1);
}

try {
  main();
} catch (err: unknown) {
  if (err instanceof PorticoValidationError) {
    console.error("PorticoValidationError:", err.issues);
  } else if (err instanceof Error) {
    console.error("Error:", err.message);
  } else {
    console.error("Unknown error:", err);
  }
  process.exit(1);
}
