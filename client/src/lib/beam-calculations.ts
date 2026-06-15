export function calculateBeam(config: BeamConfig, loads: Load[]): BeamResults {
  const { length, supports } = config;
  const [s1, s2] = supports;

  if (s1.type !== "simple" || s2.type !== "simple") {
    throw new Error("Solo vigas simplemente apoyadas por ahora");
  }

  const s1Pos = s1.position;
  const s2Pos = s2.position;

  // Total downward force
  const totalForce = loads.reduce((sum, load) => {
    if (load.type === "point") return sum + load.magnitude;
    const span = (load.end ?? 0) - (load.start ?? 0);
    return sum + load.magnitude * span;
  }, 0);

  // Moment about s1
  const momentAboutS1 = loads.reduce((sum, load) => {
    if (load.type === "point") {
      return sum + load.magnitude * ((load.position ?? 0) - s1Pos);
    }
    const start = load.start ?? 0;
    const end = load.end ?? 0;
    const mid = (start + end) / 2;
    return sum + load.magnitude * (end - start) * (mid - s1Pos);
  }, 0);

  const span = s2Pos - s1Pos;
  const R2 = span === 0 ? 0 : momentAboutS1 / span;
  const R1 = totalForce - R2;

  // Reactions: [R1, R2]
  const reactions: [number, number] = [R1, R2];

  // Shear force at x: reactions minus loads to the left
  function shearForce(x: number): number {
    let v = 0;
    if (x >= s1Pos) v += R1;
    if (x >= s2Pos) v += R2;

    for (const load of loads) {
      if (load.type === "point") {
        if (x >= (load.position ?? 0)) v -= load.magnitude;
      } else {
        const a = load.start ?? 0;
        const b = load.end ?? 0;
        if (x > a) {
          const effectiveLength = Math.min(x, b) - a;
          v -= load.magnitude * effectiveLength;
        }
      }
    }
    return v;
  }

  // Bending moment at x
  function bendingMoment(x: number): number {
    let m = 0;
    if (x >= s1Pos) m += R1 * (x - s1Pos);
    if (x >= s2Pos) m += R2 * (x - s2Pos);

    for (const load of loads) {
      if (load.type === "point") {
        if (x >= (load.position ?? 0)) {
          m -= load.magnitude * (x - (load.position ?? 0));
        }
      } else {
        const a = load.start ?? 0;
        const b = load.end ?? 0;
        if (x > a) {
          const effectiveEnd = Math.min(x, b);
          const arm = x - (a + effectiveEnd) / 2;
          m -= load.magnitude * (effectiveEnd - a) * arm;
        }
      }
    }
    return m;
  }

  // Critical points: supports, load positions, and where V(x) crosses zero
  const candidatePoints = new Set<number>([0, length, s1Pos, s2Pos]);
  for (const load of loads) {
    if (load.type === "point") {
      candidatePoints.add(load.position ?? 0);
    } else {
      candidatePoints.add(load.start ?? 0);
      candidatePoints.add(load.end ?? 0);
    }
  }

  // Add shear zero-crossings
  const sortedPoints = [...candidatePoints].sort((a, b) => a - b);
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const a = sortedPoints[i];
    const b = sortedPoints[i + 1];
    const va = shearForce(a);
    const vb = shearForce(b);
    if (va * vb < 0) {
      // Linear interpolation of zero crossing
      const zeroCross = a - (va * (b - a)) / (vb - va);
      candidatePoints.add(zeroCross);
    }
  }

  const criticalPoints = [...candidatePoints].sort((a, b) => a - b);

  // Max moment
  let maxMoment = { value: 0, position: 0 };
  for (const x of criticalPoints) {
    const m = Math.abs(bendingMoment(x));
    if (m > Math.abs(maxMoment.value)) {
      maxMoment = { value: bendingMoment(x), position: x };
    }
  }

  return {
    reactions,
    shearForce,
    bendingMoment,
    maxMoment,
    criticalPoints,
  };
}

export function formatForce(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${(value / 1000).toFixed(2)} MN`;
  if (abs >= 1) return `${value.toFixed(2)} kN`;
  return `${(value * 1000).toFixed(2)} N`;
}

export function formatLength(value: number): string {
  if (value >= 1) return `${value.toFixed(2)} m`;
  return `${(value * 1000).toFixed(0)} mm`;
}
