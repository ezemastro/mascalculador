export function calculateBeam(config: BeamConfig, loads: Load[]): BeamResults {
  const { spans, supportTypes } = config;
  const n = supportTypes.length;

  // Support positions
  const pos = [0];
  for (const s of spans) pos.push(pos[pos.length - 1] + s);
  const L = pos[n - 1]; // total length

  const isFixed = (i: number) => supportTypes[i] === "fixed";
  const isFree = (i: number) => supportTypes[i] === "free";

  // ---- helper: simple-beam reaction at left of a segment [a,b] ----
  function simpleRA(a: number, b: number): number {
    let ra = 0;
    for (const ld of loads) {
      if (ld.type === "point") {
        const p = ld.position ?? 0;
        if (p >= a && p <= b) ra += ((ld.magnitude ?? 0) * (b - p)) / (b - a);
      } else {
        const s = Math.max(ld.start ?? 0, a);
        const e = Math.min(ld.end ?? 0, b);
        if (s < e) {
          const mid = (s + e) / 2;
          ra += ((ld.magnitude ?? 0) * (e - s) * (b - mid)) / (b - a);
        }
      }
    }
    return ra;
  }

  // ---- helper: simple-beam moment at x in segment [a,b] ----
  function simpleM(a: number, b: number, x: number): number {
    const ra = simpleRA(a, b);
    let m = ra * (x - a);
    for (const ld of loads) {
      if (ld.type === "point") {
        const p = ld.position ?? 0;
        if (x >= p && p >= a) m -= (ld.magnitude ?? 0) * (x - p);
      } else {
        const s = Math.max(ld.start ?? 0, a);
        const e = Math.min(ld.end ?? 0, b);
        if (x > s) {
          const ee = Math.min(x, e);
          m -= (ld.magnitude ?? 0) * (ee - s) * (x - (s + ee) / 2);
        }
      }
    }
    return m;
  }

  // ---- 6 * ∫ M_simple(x) * (L-x) dx  for "left" / * x dx for "right" ----
  function loadTerm(spanIdx: number, side: "left" | "right"): number {
    const a = pos[spanIdx];
    const b = pos[spanIdx + 1];
    const Ls = b - a;
    const nPts = 200;
    const dx = Ls / nPts;
    let sum = 0;
    for (let k = 0; k <= nPts; k++) {
      const x = a + k * dx;
      const m = simpleM(a, b, x);
      const shape = side === "left" ? b - x : x - a;
      const w = k === 0 || k === nPts ? 0.5 : 1;
      sum += w * m * shape * dx;
    }
    return 6 * sum;
  }

  // ---- total load on segment [a,b] and its moment about a ----
  function segmentLoads(a: number, b: number) {
    let force = 0;
    let momentA = 0;
    for (const ld of loads) {
      if (ld.type === "point") {
        const p = ld.position ?? 0;
        if (p >= a && p <= b) {
          force += ld.magnitude ?? 0;
          momentA += (ld.magnitude ?? 0) * (p - a);
        }
      } else {
        const s = Math.max(ld.start ?? 0, a);
        const e = Math.min(ld.end ?? 0, b);
        if (s < e) {
          const mid = (s + e) / 2;
          const f = (ld.magnitude ?? 0) * (e - s);
          force += f;
          momentA += f * (mid - a);
        }
      }
    }
    return { force, momentA };
  }

  // ---- step 1: cantilever spans (one end free) → determinate ----
  const moments = new Array(n).fill(0);
  const reactions = new Array(n).fill(0);

  for (let i = 0; i < n - 1; i++) {
    if (!isFree(i) && !isFree(i + 1)) continue;
    const { force, momentA } = segmentLoads(pos[i], pos[i + 1]);
    if (isFree(i + 1)) {
      // cantilever from left support i
      reactions[i] += force;
      if (isFixed(i)) moments[i] -= momentA;
    } else {
      // cantilever from right support i+1
      reactions[i + 1] += force;
      if (isFixed(i + 1)) moments[i + 1] -= momentA;
    }
  }

  // ---- step 2: unknown support moments ----
  // Unknown: fixed supports + interior supports that are NOT on cantilever spans
  // Cantilever fixed-end moments already computed in step 1
  const spanIsCantilever = new Array(n - 1).fill(false);
  for (let i = 0; i < n - 1; i++) {
    if (isFree(i) || isFree(i + 1)) spanIsCantilever[i] = true;
  }

  const unknown: number[] = [];
  for (let i = 0; i < n; i++) {
    if (isFree(i)) continue;
    const hasLeft = i > 0 && !spanIsCantilever[i - 1];
    const hasRight = i < n - 1 && !spanIsCantilever[i];
    if (isFixed(i) && (hasLeft || hasRight)) {
      unknown.push(i);
    } else if (i > 0 && i < n - 1 && !isFree(i) && (hasLeft || hasRight)) {
      unknown.push(i);
    }
  }

  if (unknown.length > 0) {
    const idxMap = new Map<number, number>();
    unknown.forEach((si, eq) => idxMap.set(si, eq));

    const N = unknown.length;
    const A: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
    const B: number[] = new Array(N).fill(0);

    for (let eq = 0; eq < N; eq++) {
      const si = unknown[eq];
      if (si === 0) {
        // leftmost: rotation equation → 2*M_0 + M_1 = -loadTerm(0,"left") / L₀²
        const L0 = pos[1] - pos[0];
        A[eq][eq] = 2;
        const j = idxMap.get(1);
        if (j !== undefined) A[eq][j] = 1;
        B[eq] = -loadTerm(0, "left") / (L0 * L0);
      } else if (si === n - 1) {
        // rightmost: rotation equation → M_{n-2} + 2*M_{n-1} = -loadTerm(n-2,"right") / L_{last}²
        const Lp = pos[n - 1] - pos[n - 2];
        A[eq][eq] = 2;
        const j = idxMap.get(n - 2);
        if (j !== undefined) A[eq][j] = 1;
        B[eq] = -loadTerm(n - 2, "right") / (Lp * Lp);
      } else {
        // interior: three-moment equation
        const Li = pos[si] - pos[si - 1];
        const Lj = pos[si + 1] - pos[si];
        const pi = idxMap.get(si - 1);
        if (pi !== undefined) A[eq][pi] = Li;
        A[eq][eq] = 2 * (Li + Lj);
        const ni = idxMap.get(si + 1);
        if (ni !== undefined) A[eq][ni] = Lj;
        B[eq] = -loadTerm(si - 1, "right") / Li - loadTerm(si, "left") / Lj;
      }
    }

    // Gaussian elimination with partial pivot
    for (let col = 0; col < N; col++) {
      let maxRow = col;
      for (let row = col + 1; row < N; row++) {
        if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
      }
      if (maxRow !== col) {
        [A[col], A[maxRow]] = [A[maxRow], A[col]];
        [B[col], B[maxRow]] = [B[maxRow], B[col]];
      }
      if (Math.abs(A[col][col]) < 1e-12) continue;
      for (let row = col + 1; row < N; row++) {
        const f = A[row][col] / A[col][col];
        for (let k = col; k < N; k++) A[row][k] -= f * A[col][k];
        B[row] -= f * B[col];
      }
    }

    const X = new Array(N).fill(0);
    for (let i = N - 1; i >= 0; i--) {
      let s = B[i];
      for (let j = i + 1; j < N; j++) s -= A[i][j] * X[j];
      if (Math.abs(A[i][i]) > 1e-12) X[i] = s / A[i][i];
    }

    for (let i = 0; i < N; i++) moments[unknown[i]] = X[i];
  }

  // ---- step 3: reactions from moments ----
  for (let i = 0; i < n - 1; i++) {
    // skip cantilever spans (already handled)
    if (isFree(i) || isFree(i + 1)) continue;

    const a = pos[i];
    const b = pos[i + 1];
    const Ls = b - a;
    const Mi = moments[i];
    const Mj = moments[i + 1];

    // simple-beam reactions
    let ri = 0;
    let rj = 0;
    for (const ld of loads) {
      if (ld.type === "point") {
        const p = ld.position ?? 0;
        if (p >= a && p <= b) {
          ri += ((ld.magnitude ?? 0) * (b - p)) / Ls;
          rj += ((ld.magnitude ?? 0) * (p - a)) / Ls;
        }
      } else {
        const s = Math.max(ld.start ?? 0, a);
        const e = Math.min(ld.end ?? 0, b);
        if (s < e) {
          const mid = (s + e) / 2;
          const f = (ld.magnitude ?? 0) * (e - s);
          ri += (f * (b - mid)) / Ls;
          rj += (f * (mid - a)) / Ls;
        }
      }
    }

    const dM = Mj - Mi;
    reactions[i] += ri + dM / Ls;
    reactions[i + 1] += rj - dM / Ls;
  }

  // Zero out reactions at free supports
  for (let i = 0; i < n; i++) {
    if (isFree(i)) reactions[i] = 0;
  }

  // ---- shear and moment functions ----
  function shearForce(x: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) {
      if (x >= pos[i]) v += reactions[i];
    }
    for (const ld of loads) {
      if (ld.type === "point") {
        if (x >= (ld.position ?? 0)) v -= ld.magnitude ?? 0;
      } else {
        const a = ld.start ?? 0;
        const b = ld.end ?? 0;
        if (x > a) {
          v -= (ld.magnitude ?? 0) * (Math.min(x, b) - a);
        }
      }
    }
    return v;
  }

  function bendingMoment(x: number): number {
    let m = 0;
    for (let i = 0; i < n; i++) {
      if (x >= pos[i]) {
        m += reactions[i] * (x - pos[i]);
      }
    }
    // Leftmost fixed support (only if not on a cantilever span)
    if (isFixed(0) && !isFree(0) && !spanIsCantilever[0]) {
      m += moments[0];
    }
    // Cantilever fixed-end moments
    for (let i = 0; i < n - 1; i++) {
      if (!spanIsCantilever[i]) continue;
      if (isFree(i + 1) && isFixed(i) && x >= pos[i]) m += moments[i];
      if (isFree(i) && isFixed(i + 1) && x >= pos[i + 1]) m += moments[i + 1];
    }
    for (const ld of loads) {
      if (ld.type === "point") {
        if (x >= (ld.position ?? 0)) {
          m -= (ld.magnitude ?? 0) * (x - (ld.position ?? 0));
        }
      } else {
        const a = ld.start ?? 0;
        const b = ld.end ?? 0;
        if (x > a) {
          const ee = Math.min(x, b);
          m -= (ld.magnitude ?? 0) * (ee - a) * (x - (a + ee) / 2);
        }
      }
    }
    return m;
  }

  // ---- critical points ----
  const pts = new Set<number>([0, L]);
  for (const p of pos) pts.add(p);
  for (const ld of loads) {
    if (ld.type === "point") pts.add(ld.position ?? 0);
    else {
      pts.add(ld.start ?? 0);
      pts.add(ld.end ?? 0);
    }
  }
  // Add span midpoints to ensure moment peaks are captured for full-span UDL
  for (let i = 0; i < pos.length - 1; i++) {
    pts.add((pos[i] + pos[i + 1]) / 2);
  }
  const sorted = [...pts].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length - 1; i++) {
    const va = shearForce(sorted[i]);
    const vb = shearForce(sorted[i + 1]);
    if (va * vb < 0) {
      pts.add(sorted[i] - (va * (sorted[i + 1] - sorted[i])) / (vb - va));
    }
  }
  const criticalPoints = [...pts].sort((a, b) => a - b);

  let maxMoment = { value: 0, position: 0 };
  for (const x of criticalPoints) {
    const m = Math.abs(bendingMoment(x));
    if (m > Math.abs(maxMoment.value)) {
      maxMoment = { value: bendingMoment(x), position: x };
    }
  }

  // Max shear
  let maxShear = 0;
  for (const x of criticalPoints) {
    maxShear = Math.max(maxShear, Math.abs(shearForce(x)));
  }

  return {
    reactions: [...reactions],
    supportMoments: [...moments],
    shearForce,
    bendingMoment,
    maxMoment,
    criticalPoints,
    maxShear,
  };
}

/**
 * Two-pass elastic analysis: runs calculateBeam() separately for dead and live
 * loads, then combines via LRFD U = 1.2·D + 1.6·L.
 *
 * Returns per-load BeamResults (d, l) plus ultimate shear/moment functions
 * derived from the combination.
 */
export function calculateBeamDual(
  config: BeamConfig,
  loads: Load[],
): BeamResultsDual {
  // D-only copy: deadLoad → magnitude, liveLoad zeroed
  const dLoads: Load[] = loads.map((l) => ({
    ...l,
    magnitude: l.deadLoad ?? 0,
    deadLoad: l.deadLoad ?? 0,
    liveLoad: 0,
  }));

  // L-only copy: liveLoad → magnitude, deadLoad zeroed
  const lLoads: Load[] = loads.map((l) => ({
    ...l,
    magnitude: l.liveLoad ?? 0,
    deadLoad: 0,
    liveLoad: l.liveLoad ?? 0,
  }));

  const d = calculateBeam(config, dLoads);
  const l = calculateBeam(config, lLoads);

  // LRFD ultimate combination functions
  function shearForceU(x: number): number {
    return 1.2 * d.shearForce(x) + 1.6 * l.shearForce(x);
  }

  function bendingMomentU(x: number): number {
    return 1.2 * d.bendingMoment(x) + 1.6 * l.bendingMoment(x);
  }

  // Union of critical points from both passes
  const criticalPointsU = [
    ...new Set([...d.criticalPoints, ...l.criticalPoints]),
  ].sort((a, b) => a - b);

  // Max ultimate moment across combined critical points
  let maxMomentU = { value: 0, position: 0 };
  for (const x of criticalPointsU) {
    const mu = Math.abs(bendingMomentU(x));
    if (mu > Math.abs(maxMomentU.value)) {
      maxMomentU = { value: bendingMomentU(x), position: x };
    }
  }

  // Max ultimate shear
  let maxShearU = 0;
  for (const x of criticalPointsU) {
    maxShearU = Math.max(maxShearU, Math.abs(shearForceU(x)));
  }

  return {
    d,
    l,
    shearForceU,
    bendingMomentU,
    maxMomentU,
    maxShearU,
    criticalPointsU,
  };
}

/**
 * Detects legacy loads that only have `magnitude` (no `deadLoad`/`liveLoad`).
 * Patches them to: deadLoad = magnitude, liveLoad = 0 (conservative default).
 * Returns the migrated loads and a flag indicating whether any were patched.
 */
export function migrateLoads(rawLoads: Record<string, unknown>[]): {
  loads: Load[];
  migrated: boolean;
} {
  let migrated = false;
  const loads: Load[] = rawLoads.map((l) => {
    if (
      typeof (l as unknown as Load).deadLoad === "number" &&
      typeof (l as unknown as Load).liveLoad === "number"
    ) {
      return l as unknown as Load;
    }
    migrated = true;
    const mag = typeof l.magnitude === "number" ? l.magnitude : 0;
    return {
      id: (l.id as string) || Math.random().toString(36).slice(2),
      type: (l.type as Load["type"]) || "distributed",
      deadLoad: mag,
      liveLoad: 0,
      magnitude: mag,
      position: typeof l.position === "number" ? l.position : undefined,
      start: typeof l.start === "number" ? l.start : undefined,
      end: typeof l.end === "number" ? l.end : undefined,
    };
  });
  return { loads, migrated };
}

export function formatForce(value: number): string {
  return `${value.toFixed(2)} kN`;
}

export function formatMoment(value: number): string {
  return `${value.toFixed(2)} kN·m`;
}

export function formatLength(value: number): string {
  if (value >= 1) return `${value.toFixed(2)} m`;
  return `${(value * 1000).toFixed(0)} mm`;
}
