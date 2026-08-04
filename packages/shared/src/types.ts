/**
 * Tipos compartidos entre apps/steel y apps/concrete.
 *
 * Migrado del antiguo `client/src/types.d.ts` (declaraciones globales)
 * a exports de TypeScript. Cada app copia `types.d.ts` localmente para
 * mantener compatibilidad con pantallas que usaban los tipos como globales.
 */

export type App = "steel" | "concrete";

export type SupportType = "simple" | "fixed" | "free";

export interface Support {
  position: number;
  type: SupportType;
}

export interface BeamConfig {
  spans: number[];
  supportTypes: SupportType[];
}

export interface Load {
  id: string;
  type: "point" | "distributed";
  deadLoad?: number;
  liveLoad?: number;
  magnitude?: number;
  position?: number;
  start?: number;
  end?: number;
}

export interface BeamResults {
  reactions: number[];
  supportMoments: number[];
  shearForce: (x: number) => number;
  bendingMoment: (x: number) => number;
  maxMoment: { value: number; position: number };
  criticalPoints: number[];
  maxShear: number;
}

export interface BeamResultsDual {
  d: BeamResults;
  l: BeamResults;
  shearForceU: (x: number) => number;
  bendingMomentU: (x: number) => number;
  maxMomentU: { value: number; position: number };
  maxShearU: number;
  criticalPointsU: number[];
}

export interface SteelDesignParams {
  profileName: string;
  profileType?: "IPN" | "UPN";
  Fy: number;
  Lb: number;
  Lb1?: number;
  Lb2?: number;
  Cb: number;
  deflectionLimit: number;
  loadPosition: "top" | "shear" | "bottom";
}

export type Classification = "COMPACT" | "NON_COMPACT" | "SLENDER";

export interface TrussDesignParams {
  height: number;
  panelSpacing: number;
  topChordProfile: string;
  botChordProfile: string;
  diagProfile: string;
  vertProfile: string;
  Fy: number;
  Fu: number;
}
