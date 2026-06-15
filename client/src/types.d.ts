type SupportType = "simple" | "fixed";

interface Support {
  position: number;
  type: SupportType;
}

interface BeamConfig {
  length: number;
  supports: [Support, Support];
}

interface Load {
  id: string;
  type: "point" | "distributed";
  magnitude: number;
  position?: number;
  start?: number;
  end?: number;
}

interface BeamResults {
  reactions: [number, number];
  shearForce: (x: number) => number;
  bendingMoment: (x: number) => number;
  maxMoment: { value: number; position: number };
  criticalPoints: number[];
}
