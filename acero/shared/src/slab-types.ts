// Shared slab types extracted from slab-calc.ts
// Both apps use identical definitions

export type EdgeCondition = "simple" | "continuo" | "free";

export interface SlabInput {
  lx: number; // m (shorter span)
  ly: number; // m (longer span)
  edges: [EdgeCondition, EdgeCondition, EdgeCondition, EdgeCondition];
  D: number; // kN/m² (dead load, excluding self-weight)
  L: number; // kN/m² (live load)
  fc: number; // MPa
  fy: number; // MPa
  cover: number; // mm
  h: number; // mm (0 = compute)
  dBarX: number; // mm (X bar diameter for spacing)
  dBarY: number; // mm
  /** Si true, el programa calcula y suma el peso propio a D. Si false, D ya incluye el peso propio cargado por el usuario. Default: true. */
  includeSelfWeight: boolean;
}

export interface DirectionResult {
  Mu: number; // kN·m/m
  Mn: number; // kN·m/m
  mn: number;
  Ka: number;
  KaMin: number;
  KaMax: number;
  caseLabel: string;
  AsReq: number; // mm²/m
  AsMin: number;
  AsTemp: number;
  sMax: number; // mm
  phi: number;
  Mneg?: number; // kN·m/m — negative moment at support edge (undefined for simple supports)
  /** Coeficiente LRFD usado (1.4 si CM dominante, 1.2 si mixto CM+CV) */
  coef?: number;
  /** d efectivo en mm usado para el cálculo (h - cover, o h - cover - 10 si es dirección secundaria en losa cruzada) */
  d?: number;
}

export interface SlabResult {
  d: number;
  h: number;
  qu: number;
  x: DirectionResult;
  y: DirectionResult;
  distX: DirectionResult;
  distY: DirectionResult;
  /** Aggregate X-direction reaction in kN/m (backward compat). */
  Rx: number;
  /** Aggregate Y-direction reaction in kN/m (backward compat). */
  Ry: number;
  /** Per-edge reaction at edge[0] (Izquierdo) in kN/m. */
  RxIzq: number;
  /** Per-edge reaction at edge[1] (Derecho) in kN/m. */
  RxDer: number;
  /** Per-edge reaction at edge[2] (Arriba) in kN/m. */
  RyArr: number;
  /** Per-edge reaction at edge[3] (Abajo) in kN/m. */
  RyAba: number;
  /** Per-edge unfactored dead reaction at edge[0] (Izquierdo) in kN/m. */
  RD_izq?: number;
  /** Per-edge unfactored live reaction at edge[0] (Izquierdo) in kN/m. */
  RL_izq?: number;
  /** Per-edge unfactored dead reaction at edge[1] (Derecho) in kN/m. */
  RD_der?: number;
  /** Per-edge unfactored live reaction at edge[1] (Derecho) in kN/m. */
  RL_der?: number;
  /** Per-edge unfactored dead reaction at edge[2] (Arriba) in kN/m. */
  RD_arr?: number;
  /** Per-edge unfactored live reaction at edge[2] (Arriba) in kN/m. */
  RL_arr?: number;
  /** Per-edge unfactored dead reaction at edge[3] (Abajo) in kN/m. */
  RD_aba?: number;
  /** Per-edge unfactored live reaction at edge[3] (Abajo) in kN/m. */
  RL_aba?: number;
  /** Support negative moment at edge[0] (Izquierdo) in kN·m/m — 0 if not continuous. */
  MnegIzq: number;
  /** Support negative moment at edge[1] (Derecho) in kN·m/m — 0 if not continuous. */
  MnegDer: number;
  /** Support negative moment at edge[2] (Arriba) in kN·m/m — 0 if not continuous. */
  MnegArr: number;
  /** Support negative moment at edge[3] (Abajo) in kN·m/m — 0 if not continuous. */
  MnegAba: number;
  /** Adopted span reinforcement in X direction (user-selected), mm²/m — 0 if not adopted. */
  adoptedAsX?: number;
  /** Adopted span reinforcement in Y direction (user-selected), mm²/m — 0 if not adopted. */
  adoptedAsY?: number;
  /** Support reinforcement design at edge 0 (Izquierdo), if continuous. */
  supportX0?: DirectionResult;
  /** Support reinforcement design at edge 1 (Derecho), if continuous. */
  supportXL?: DirectionResult;
  /** Support reinforcement design at edge 2 (Arriba), if continuous. */
  supportY0?: DirectionResult;
  /** Support reinforcement design at edge 3 (Abajo), if continuous. */
  supportYL?: DirectionResult;
  steps: string[];
}

export type EdgeIndex = 0 | 1 | 2 | 3; // 0=Izquierdo, 1=Derecho, 2=Arriba, 3=Abajo

export interface CompatResult {
  compatOK: boolean;
  ratio: number;
  MnegA: number;
  MnegB: number;
  Mcompat?: number;
  recalculatedSlab?: "A" | "B";
  recalculatedResult?: SlabResult;
  /** Reinforcement design for the compatibilized support moment. */
  supportDesign?: DirectionResult;
  message: string;
}
