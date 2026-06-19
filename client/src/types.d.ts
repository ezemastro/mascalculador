type SupportType = "simple" | "fixed" | "free";

interface Support {
  position: number;
  type: SupportType;
}

interface BeamConfig {
  spans: number[];
  supportTypes: SupportType[];
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
  reactions: number[];
  supportMoments: number[];
  shearForce: (x: number) => number;
  bendingMoment: (x: number) => number;
  maxMoment: { value: number; position: number };
  criticalPoints: number[];
  maxShear: number;
}

interface SteelDesignParams {
  profileName: string;
  Fy: number;       // MPa
  Lb: number;       // mm
  Cb: number;
  deflectionLimit: number;
}

interface TrussDesignParams {
  height: number;         // m
  panelSpacing: number;   // m
  topChordProfile: string;
  botChordProfile: string;
  diagProfile: string;
  vertProfile: string;
  Fy: number;     // MPa
  Fu: number;     // MPa
}
