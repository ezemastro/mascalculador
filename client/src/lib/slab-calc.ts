// CIRSOC 201-05 — Losas de hormigón armado

export type EdgeCondition = "simple" | "empotrado" | "continuo";

export interface SlabInput {
  lx: number;         // m (shorter span)
  ly: number;         // m (longer span)
  edges: [EdgeCondition, EdgeCondition, EdgeCondition, EdgeCondition];
  D: number;          // kN/m² (dead load, excluding self-weight)
  L: number;          // kN/m² (live load)
  fc: number;         // MPa
  fy: number;         // MPa
  cover: number;      // mm
  h: number;          // mm (0 = compute)
  dBarX: number;      // mm (X bar diameter for spacing)
  dBarY: number;      // mm
}

export interface DirectionResult {
  Mu: number;         // kN·m/m
  Mn: number;         // kN·m/m
  mn: number;
  Ka: number;
  KaMin: number;
  KaMax: number;
  caseLabel: string;
  AsReq: number;      // mm²/m
  AsMin: number;
  AsTemp: number;
  sMax: number;       // mm
  phi: number;
}

export interface SlabResult {
  d: number;
  h: number;
  qu: number;
  x: DirectionResult;
  y: DirectionResult;
  distX: DirectionResult;
  distY: DirectionResult;
  Rx: number;          // kN/m (reaction at X edges)
  Ry: number;          // kN/m (reaction at Y edges)
  steps: string[];
}

// Kalmanok coefficients for rectangular slabs — 4 edges simply supported
// Lx/Ly = shorter / longer span ratio (≤ 1.0)
// CMx, CMy = moment coefficients for M = C · qu · lx²
// CRx, CRy = reaction coefficients for R = C · qu · lx
// Table extended to ratio > 1.0 by symmetry
const KALMANOK_SIMPLE: { ratio: number; CMx: number; CMy: number; CRx: number; CRy: number }[] = [
  { ratio: 0.50, CMx: 0.0965, CMy: 0.0174, CRx: 0.269, CRy: 0.731 },
  { ratio: 0.55, CMx: 0.0892, CMy: 0.0210, CRx: 0.268, CRy: 0.641 },
  { ratio: 0.60, CMx: 0.0820, CMy: 0.0243, CRx: 0.267, CRy: 0.566 },
  { ratio: 0.65, CMx: 0.0750, CMy: 0.0273, CRx: 0.266, CRy: 0.502 },
  { ratio: 0.70, CMx: 0.0683, CMy: 0.0298, CRx: 0.265, CRy: 0.450 },
  { ratio: 0.75, CMx: 0.0619, CMy: 0.0318, CRx: 0.263, CRy: 0.404 },
  { ratio: 0.80, CMx: 0.0560, CMy: 0.0334, CRx: 0.261, CRy: 0.364 },
  { ratio: 0.85, CMx: 0.0506, CMy: 0.0348, CRx: 0.259, CRy: 0.330 },
  { ratio: 0.90, CMx: 0.0456, CMy: 0.0359, CRx: 0.256, CRy: 0.300 },
  { ratio: 0.95, CMx: 0.0410, CMy: 0.0365, CRx: 0.253, CRy: 0.274 },
  { ratio: 1.00, CMx: 0.0368, CMy: 0.0368, CRx: 0.250, CRy: 0.250 },
  { ratio: 1.11, CMx: 0.0359, CMy: 0.0456, CRx: 0.300, CRy: 0.256 },
  { ratio: 1.18, CMx: 0.0348, CMy: 0.0506, CRx: 0.330, CRy: 0.259 },
  { ratio: 1.25, CMx: 0.0334, CMy: 0.0560, CRx: 0.364, CRy: 0.261 },
  { ratio: 1.33, CMx: 0.0318, CMy: 0.0619, CRx: 0.404, CRy: 0.263 },
  { ratio: 1.43, CMx: 0.0298, CMy: 0.0683, CRx: 0.450, CRy: 0.265 },
  { ratio: 1.54, CMx: 0.0273, CMy: 0.0750, CRx: 0.502, CRy: 0.266 },
  { ratio: 1.67, CMx: 0.0243, CMy: 0.0820, CRx: 0.566, CRy: 0.267 },
  { ratio: 1.82, CMx: 0.0210, CMy: 0.0892, CRx: 0.641, CRy: 0.268 },
  { ratio: 2.00, CMx: 0.0174, CMy: 0.0965, CRx: 0.731, CRy: 0.269 },
];

// Kalmanok: 1 borde empotrado (continuo) en X, 3 bordes articulados
const KALMANOK_1FIXED_X: { ratio: number; CMex: number; CMx: number; CMy: number; CRx: number; CRey: number; CRy: number }[] = [
  { ratio: 0.50, CMex: 0.1214, CMx: 0.0584, CMy: 0.0060, CRx: 0.169, CRey: 1.049, CRy: 0.613 },
  { ratio: 0.55, CMex: 0.1188, CMx: 0.0562, CMy: 0.0083, CRx: 0.168, CRey: 0.947, CRy: 0.545 },
  { ratio: 0.60, CMex: 0.1159, CMx: 0.0538, CMy: 0.0105, CRx: 0.167, CRey: 0.845, CRy: 0.487 },
  { ratio: 0.65, CMex: 0.1126, CMx: 0.0512, CMy: 0.0127, CRx: 0.167, CRey: 0.769, CRy: 0.437 },
  { ratio: 0.70, CMex: 0.1089, CMx: 0.0485, CMy: 0.0149, CRx: 0.166, CRey: 0.702, CRy: 0.394 },
  { ratio: 0.75, CMex: 0.1050, CMx: 0.0457, CMy: 0.0168, CRx: 0.166, CRey: 0.643, CRy: 0.360 },
  { ratio: 0.80, CMex: 0.1008, CMx: 0.0428, CMy: 0.0187, CRx: 0.165, CRey: 0.591, CRy: 0.329 },
  { ratio: 0.85, CMex: 0.0965, CMx: 0.0400, CMy: 0.0205, CRx: 0.165, CRey: 0.545, CRy: 0.302 },
  { ratio: 0.90, CMex: 0.0922, CMx: 0.0372, CMy: 0.0221, CRx: 0.165, CRey: 0.504, CRy: 0.278 },
  { ratio: 0.95, CMex: 0.0880, CMx: 0.0345, CMy: 0.0234, CRx: 0.165, CRey: 0.467, CRy: 0.255 },
  { ratio: 1.00, CMex: 0.0839, CMx: 0.0318, CMy: 0.0243, CRx: 0.166, CRey: 0.433, CRy: 0.235 },
  { ratio: 1.05, CMex: 0.0881, CMx: 0.0327, CMy: 0.0282, CRx: 0.186, CRey: 0.440, CRy: 0.240 },
  { ratio: 1.11, CMex: 0.0924, CMx: 0.0330, CMy: 0.0323, CRx: 0.209, CRey: 0.449, CRy: 0.245 },
  { ratio: 1.18, CMex: 0.0967, CMx: 0.0328, CMy: 0.0369, CRx: 0.234, CRey: 0.460, CRy: 0.249 },
  { ratio: 1.25, CMex: 0.1011, CMx: 0.0324, CMy: 0.0423, CRx: 0.263, CRey: 0.471, CRy: 0.253 },
  { ratio: 1.33, CMex: 0.1055, CMx: 0.0319, CMy: 0.0485, CRx: 0.298, CRey: 0.482, CRy: 0.257 },
  { ratio: 1.43, CMex: 0.1096, CMx: 0.0309, CMy: 0.0553, CRx: 0.339, CRey: 0.492, CRy: 0.260 },
  { ratio: 1.54, CMex: 0.1133, CMx: 0.0292, CMy: 0.0627, CRx: 0.388, CRey: 0.501, CRy: 0.262 },
  { ratio: 1.67, CMex: 0.1165, CMx: 0.0269, CMy: 0.0707, CRx: 0.447, CRey: 0.508, CRy: 0.264 },
  { ratio: 1.82, CMex: 0.1192, CMx: 0.0240, CMy: 0.0792, CRx: 0.519, CRey: 0.514, CRy: 0.266 },
  { ratio: 2.00, CMex: 0.1215, CMx: 0.0204, CMy: 0.0880, CRx: 0.606, CRey: 0.520, CRy: 0.268 },
];

// Kalmanok: 1 borde empotrado (continuo) en Y, 3 bordes articulados
const KALMANOK_1FIXED_Y: { ratio: number; CMey: number; CMx: number; CMy: number; CRy: number; CRey: number; CRx: number }[] = [
  { ratio: 0.50, CMey: 0.1215, CMx: 0.0204, CMy: 0.0880, CRy: 0.606, CRey: 0.520, CRx: 0.268 },
  { ratio: 0.55, CMey: 0.1192, CMx: 0.0240, CMy: 0.0792, CRy: 0.519, CRey: 0.514, CRx: 0.266 },
  { ratio: 0.60, CMey: 0.1165, CMx: 0.0269, CMy: 0.0707, CRy: 0.447, CRey: 0.508, CRx: 0.264 },
  { ratio: 0.65, CMey: 0.1133, CMx: 0.0292, CMy: 0.0627, CRy: 0.388, CRey: 0.501, CRx: 0.262 },
  { ratio: 0.70, CMey: 0.1089, CMx: 0.0309, CMy: 0.0553, CRy: 0.339, CRey: 0.492, CRx: 0.260 },
  { ratio: 0.75, CMey: 0.1055, CMx: 0.0319, CMy: 0.0485, CRy: 0.298, CRey: 0.482, CRx: 0.257 },
  { ratio: 0.80, CMey: 0.1011, CMx: 0.0324, CMy: 0.0423, CRy: 0.263, CRey: 0.471, CRx: 0.253 },
  { ratio: 0.85, CMey: 0.0967, CMx: 0.0328, CMy: 0.0369, CRy: 0.234, CRey: 0.460, CRx: 0.249 },
  { ratio: 0.90, CMey: 0.0924, CMx: 0.0330, CMy: 0.0323, CRy: 0.209, CRey: 0.449, CRx: 0.245 },
  { ratio: 0.95, CMey: 0.0881, CMx: 0.0327, CMy: 0.0282, CRy: 0.186, CRey: 0.440, CRx: 0.240 },
  { ratio: 1.00, CMey: 0.0839, CMx: 0.0318, CMy: 0.0243, CRy: 0.166, CRey: 0.433, CRx: 0.235 },
  { ratio: 1.05, CMey: 0.0880, CMx: 0.0345, CMy: 0.0234, CRy: 0.165, CRey: 0.467, CRx: 0.255 },
  { ratio: 1.11, CMey: 0.0922, CMx: 0.0372, CMy: 0.0221, CRy: 0.165, CRey: 0.504, CRx: 0.278 },
  { ratio: 1.18, CMey: 0.0965, CMx: 0.0400, CMy: 0.0205, CRy: 0.165, CRey: 0.545, CRx: 0.302 },
  { ratio: 1.25, CMey: 0.1008, CMx: 0.0428, CMy: 0.0187, CRy: 0.165, CRey: 0.591, CRx: 0.329 },
  { ratio: 1.33, CMey: 0.1050, CMx: 0.0457, CMy: 0.0168, CRy: 0.166, CRey: 0.643, CRx: 0.360 },
  { ratio: 1.43, CMey: 0.1089, CMx: 0.0485, CMy: 0.0149, CRy: 0.166, CRey: 0.702, CRx: 0.394 },
  { ratio: 1.54, CMey: 0.1126, CMx: 0.0512, CMy: 0.0127, CRy: 0.167, CRey: 0.769, CRx: 0.437 },
  { ratio: 1.67, CMey: 0.1159, CMx: 0.0538, CMy: 0.0105, CRy: 0.167, CRey: 0.845, CRx: 0.487 },
  { ratio: 1.82, CMey: 0.1188, CMx: 0.0562, CMy: 0.0083, CRy: 0.168, CRey: 0.947, CRx: 0.545 },
  { ratio: 2.00, CMey: 0.1214, CMx: 0.0584, CMy: 0.0060, CRy: 0.169, CRey: 1.049, CRx: 0.613 },
];

// Kalmanok: 2 bordes opuestos empotrados en X, 2 bordes articulados en Y
const KALMANOK_2FIXED_X: { ratio: number; CMex: number; CMx: number; CMy: number; CRy: number; CRex: number }[] = [
  { ratio: 0.50, CMex: 0.0845, CMx: 0.0414, CMy: 0.0017, CRy: 0.098, CRex: 0.902 },
  { ratio: 0.55, CMex: 0.0843, CMx: 0.0408, CMy: 0.0029, CRy: 0.097, CRex: 0.812 },
  { ratio: 0.60, CMex: 0.0837, CMx: 0.0400, CMy: 0.0043, CRy: 0.096, CRex: 0.737 },
  { ratio: 0.65, CMex: 0.0828, CMx: 0.0391, CMy: 0.0058, CRy: 0.097, CRex: 0.673 },
  { ratio: 0.70, CMex: 0.0816, CMx: 0.0380, CMy: 0.0073, CRy: 0.097, CRex: 0.617 },
  { ratio: 0.75, CMex: 0.0801, CMx: 0.0366, CMy: 0.0088, CRy: 0.098, CRex: 0.569 },
  { ratio: 0.80, CMex: 0.0784, CMx: 0.0350, CMy: 0.0103, CRy: 0.098, CRex: 0.527 },
  { ratio: 0.85, CMex: 0.0765, CMx: 0.0335, CMy: 0.0119, CRy: 0.099, CRex: 0.490 },
  { ratio: 0.90, CMex: 0.0744, CMx: 0.0319, CMy: 0.0134, CRy: 0.099, CRex: 0.457 },
  { ratio: 0.95, CMex: 0.0722, CMx: 0.0302, CMy: 0.0147, CRy: 0.100, CRex: 0.427 },
  { ratio: 1.00, CMex: 0.0698, CMx: 0.0285, CMy: 0.0158, CRy: 0.102, CRex: 0.398 },
  { ratio: 1.05, CMex: 0.0745, CMx: 0.0297, CMy: 0.0189, CRy: 0.115, CRex: 0.412 },
  { ratio: 1.11, CMex: 0.0796, CMx: 0.0307, CMy: 0.0225, CRy: 0.130, CRex: 0.426 },
  { ratio: 1.18, CMex: 0.0849, CMx: 0.0314, CMy: 0.0267, CRy: 0.148, CRex: 0.441 },
  { ratio: 1.25, CMex: 0.0902, CMx: 0.0318, CMy: 0.0316, CRy: 0.170, CRex: 0.455 },
  { ratio: 1.33, CMex: 0.0957, CMx: 0.0320, CMy: 0.0374, CRy: 0.198, CRex: 0.469 },
  { ratio: 1.43, CMex: 0.1011, CMx: 0.0319, CMy: 0.0442, CRy: 0.232, CRex: 0.482 },
  { ratio: 1.54, CMex: 0.1063, CMx: 0.0310, CMy: 0.0519, CRy: 0.274, CRex: 0.495 },
  { ratio: 1.67, CMex: 0.1111, CMx: 0.0292, CMy: 0.0604, CRy: 0.326, CRex: 0.507 },
  { ratio: 1.82, CMex: 0.1154, CMx: 0.0266, CMy: 0.0697, CRy: 0.391, CRex: 0.518 },
  { ratio: 2.00, CMex: 0.1191, CMx: 0.0234, CMy: 0.0799, CRy: 0.472, CRex: 0.528 },
];

// Kalmanok: 2 bordes adyacentes empotrados (X=0 e Y=0), 2 articulados
const KALMANOK_2ADJ: { ratio: number; CMex: number; CMey: number; CMx: number; CMy: number; CRx: number; CRy0: number; CRx2: number; CRy: number }[] = [
  { ratio: 0.50, CMex: 0.1177, CMey: 0.0782, CMx: 0.0560, CMy: 0.0079, CRx: 0.350, CRy0: 0.157, CRx2: 0.967, CRy: 0.526 },
  { ratio: 0.55, CMex: 0.1136, CMey: 0.0779, CMx: 0.0529, CMy: 0.0105, CRx: 0.350, CRy0: 0.158, CRx2: 0.849, CRy: 0.458 },
  { ratio: 0.60, CMex: 0.1093, CMey: 0.0776, CMx: 0.0496, CMy: 0.0130, CRx: 0.350, CRy0: 0.158, CRx2: 0.756, CRy: 0.403 },
  { ratio: 0.65, CMex: 0.1047, CMey: 0.0773, CMx: 0.0462, CMy: 0.0153, CRx: 0.350, CRy0: 0.159, CRx2: 0.670, CRy: 0.356 },
  { ratio: 0.70, CMex: 0.0996, CMey: 0.0768, CMx: 0.0426, CMy: 0.0171, CRx: 0.350, CRy0: 0.159, CRx2: 0.604, CRy: 0.315 },
  { ratio: 0.75, CMex: 0.0940, CMey: 0.0759, CMx: 0.0390, CMy: 0.0188, CRx: 0.349, CRy0: 0.160, CRx2: 0.545, CRy: 0.279 },
  { ratio: 0.80, CMex: 0.0882, CMey: 0.0746, CMx: 0.0355, CMy: 0.0203, CRx: 0.348, CRy0: 0.161, CRx2: 0.493, CRy: 0.248 },
  { ratio: 0.85, CMex: 0.0825, CMey: 0.0731, CMx: 0.0322, CMy: 0.0216, CRx: 0.346, CRy0: 0.162, CRx2: 0.447, CRy: 0.222 },
  { ratio: 0.90, CMex: 0.0773, CMey: 0.0714, CMx: 0.0291, CMy: 0.0226, CRx: 0.344, CRy0: 0.163, CRx2: 0.406, CRy: 0.200 },
  { ratio: 0.95, CMex: 0.0724, CMey: 0.0696, CMx: 0.0262, CMy: 0.0232, CRx: 0.341, CRy0: 0.163, CRx2: 0.370, CRy: 0.180 },
  { ratio: 1.00, CMex: 0.0677, CMey: 0.0677, CMx: 0.0234, CMy: 0.0234, CRx: 0.338, CRy0: 0.162, CRx2: 0.338, CRy: 0.162 },
  { ratio: 1.05, CMex: 0.0696, CMey: 0.0724, CMx: 0.0232, CMy: 0.0262, CRx: 0.370, CRy0: 0.180, CRx2: 0.341, CRy: 0.163 },
  { ratio: 1.11, CMex: 0.0714, CMey: 0.0773, CMx: 0.0226, CMy: 0.0291, CRx: 0.406, CRy0: 0.200, CRx2: 0.344, CRy: 0.163 },
  { ratio: 1.18, CMex: 0.0731, CMey: 0.0825, CMx: 0.0216, CMy: 0.0322, CRx: 0.447, CRy0: 0.222, CRx2: 0.346, CRy: 0.162 },
  { ratio: 1.25, CMex: 0.0746, CMey: 0.0882, CMx: 0.0203, CMy: 0.0355, CRx: 0.493, CRy0: 0.248, CRx2: 0.348, CRy: 0.161 },
  { ratio: 1.33, CMex: 0.0759, CMey: 0.0940, CMx: 0.0188, CMy: 0.0390, CRx: 0.545, CRy0: 0.279, CRx2: 0.349, CRy: 0.160 },
  { ratio: 1.43, CMex: 0.0768, CMey: 0.0996, CMx: 0.0171, CMy: 0.0426, CRx: 0.604, CRy0: 0.315, CRx2: 0.350, CRy: 0.159 },
  { ratio: 1.54, CMex: 0.0773, CMey: 0.1047, CMx: 0.0153, CMy: 0.0462, CRx: 0.670, CRy0: 0.356, CRx2: 0.350, CRy: 0.159 },
  { ratio: 1.67, CMex: 0.0776, CMey: 0.1093, CMx: 0.0130, CMy: 0.0496, CRx: 0.756, CRy0: 0.403, CRx2: 0.350, CRy: 0.158 },
  { ratio: 1.82, CMex: 0.0779, CMey: 0.1136, CMx: 0.0105, CMy: 0.0529, CRx: 0.849, CRy0: 0.458, CRx2: 0.350, CRy: 0.158 },
  { ratio: 2.00, CMex: 0.0782, CMey: 0.1177, CMx: 0.0079, CMy: 0.0560, CRx: 0.967, CRy0: 0.526, CRx2: 0.350, CRy: 0.157 },
];

// Kalmanok: 2 bordes opuestos empotrados en Y, 2 articulados en X
const KALMANOK_2FIXED_Y: { ratio: number; CMey: number; CMx: number; CMy: number; CRx: number; CRey: number }[] = [
  { ratio: 0.50, CMey: 0.1191, CMx: 0.0799, CMy: 0.0234, CRx: 0.472, CRey: 0.528 },
  { ratio: 0.55, CMey: 0.1154, CMx: 0.0697, CMy: 0.0266, CRx: 0.391, CRey: 0.518 },
  { ratio: 0.60, CMey: 0.1111, CMx: 0.0604, CMy: 0.0292, CRx: 0.326, CRey: 0.507 },
  { ratio: 0.65, CMey: 0.1063, CMx: 0.0519, CMy: 0.0310, CRx: 0.274, CRey: 0.495 },
  { ratio: 0.70, CMey: 0.1011, CMx: 0.0442, CMy: 0.0319, CRx: 0.232, CRey: 0.482 },
  { ratio: 0.75, CMey: 0.0957, CMx: 0.0374, CMy: 0.0320, CRx: 0.198, CRey: 0.469 },
  { ratio: 0.80, CMey: 0.0902, CMx: 0.0316, CMy: 0.0318, CRx: 0.170, CRey: 0.455 },
  { ratio: 0.85, CMey: 0.0849, CMx: 0.0267, CMy: 0.0314, CRx: 0.148, CRey: 0.441 },
  { ratio: 0.90, CMey: 0.0796, CMx: 0.0225, CMy: 0.0307, CRx: 0.130, CRey: 0.426 },
  { ratio: 0.95, CMey: 0.0745, CMx: 0.0189, CMy: 0.0297, CRx: 0.115, CRey: 0.412 },
  { ratio: 1.00, CMey: 0.0698, CMx: 0.0158, CMy: 0.0285, CRx: 0.102, CRey: 0.398 },
  { ratio: 1.05, CMey: 0.0722, CMx: 0.0147, CMy: 0.0302, CRx: 0.100, CRey: 0.427 },
  { ratio: 1.11, CMey: 0.0744, CMx: 0.0134, CMy: 0.0319, CRx: 0.099, CRey: 0.457 },
  { ratio: 1.18, CMey: 0.0765, CMx: 0.0119, CMy: 0.0335, CRx: 0.099, CRey: 0.490 },
  { ratio: 1.25, CMey: 0.0784, CMx: 0.0103, CMy: 0.0350, CRx: 0.098, CRey: 0.527 },
  { ratio: 1.33, CMey: 0.0801, CMx: 0.0088, CMy: 0.0366, CRx: 0.098, CRey: 0.569 },
  { ratio: 1.43, CMey: 0.0816, CMx: 0.0073, CMy: 0.0380, CRx: 0.097, CRey: 0.617 },
  { ratio: 1.54, CMey: 0.0828, CMx: 0.0058, CMy: 0.0391, CRx: 0.097, CRey: 0.673 },
  { ratio: 1.67, CMey: 0.0837, CMx: 0.0043, CMy: 0.0400, CRx: 0.096, CRey: 0.737 },
  { ratio: 1.82, CMey: 0.0843, CMx: 0.0029, CMy: 0.0408, CRx: 0.097, CRey: 0.812 },
  { ratio: 2.00, CMey: 0.0845, CMx: 0.0017, CMy: 0.0414, CRx: 0.098, CRey: 0.902 },
];

// Kalmanok: 3 bordes empotrados, 1 borde articulado en X
const KALMANOK_3FIXED: { ratio: number; CMex: number; CMey: number; CMx: number; CMy: number; CRex: number; CRx: number; CRey: number }[] = [
  { ratio: 0.50, CMex: 0.0836, CMey: 0.0563, CMx: 0.0409, CMy: 0.0028, CRex: 0.254, CRx: 0.100, CRey: 0.823 },
  { ratio: 0.55, CMex: 0.0826, CMey: 0.0564, CMx: 0.0398, CMy: 0.0041, CRex: 0.254, CRx: 0.100, CRey: 0.736 },
  { ratio: 0.60, CMex: 0.0813, CMey: 0.0566, CMx: 0.0385, CMy: 0.0059, CRex: 0.255, CRx: 0.099, CRey: 0.657 },
  { ratio: 0.65, CMex: 0.0796, CMey: 0.0569, CMx: 0.0370, CMy: 0.0075, CRex: 0.257, CRx: 0.099, CRey: 0.591 },
  { ratio: 0.70, CMex: 0.0774, CMey: 0.0572, CMx: 0.0352, CMy: 0.0091, CRex: 0.259, CRx: 0.100, CRey: 0.535 },
  { ratio: 0.75, CMex: 0.0748, CMey: 0.0571, CMx: 0.0333, CMy: 0.0107, CRex: 0.260, CRx: 0.100, CRey: 0.487 },
  { ratio: 0.80, CMex: 0.0720, CMey: 0.0568, CMx: 0.0313, CMy: 0.0123, CRex: 0.261, CRx: 0.101, CRey: 0.445 },
  { ratio: 0.85, CMex: 0.0691, CMey: 0.0564, CMx: 0.0292, CMy: 0.0138, CRex: 0.262, CRx: 0.101, CRey: 0.408 },
  { ratio: 0.90, CMex: 0.0660, CMey: 0.0560, CMx: 0.0270, CMy: 0.0151, CRex: 0.263, CRx: 0.102, CRey: 0.374 },
  { ratio: 0.95, CMex: 0.0628, CMey: 0.0556, CMx: 0.0249, CMy: 0.0161, CRex: 0.264, CRx: 0.103, CRey: 0.343 },
  { ratio: 1.00, CMex: 0.0596, CMey: 0.0551, CMx: 0.0228, CMy: 0.0167, CRex: 0.265, CRx: 0.105, CRey: 0.315 },
  { ratio: 1.05, CMex: 0.0626, CMey: 0.0599, CMx: 0.0230, CMy: 0.0193, CRex: 0.293, CRx: 0.120, CRey: 0.320 },
  { ratio: 1.11, CMex: 0.0655, CMey: 0.0652, CMx: 0.0231, CMy: 0.0222, CRex: 0.325, CRx: 0.136, CRey: 0.325 },
  { ratio: 1.18, CMex: 0.0682, CMey: 0.0710, CMx: 0.0229, CMy: 0.0254, CRex: 0.362, CRx: 0.154, CRey: 0.330 },
  { ratio: 1.25, CMex: 0.0706, CMey: 0.0773, CMx: 0.0224, CMy: 0.0289, CRex: 0.405, CRx: 0.175, CRey: 0.334 },
  { ratio: 1.33, CMex: 0.0727, CMey: 0.0839, CMx: 0.0214, CMy: 0.0327, CRex: 0.456, CRx: 0.202, CRey: 0.337 },
  { ratio: 1.43, CMex: 0.0743, CMey: 0.0907, CMx: 0.0198, CMy: 0.0368, CRex: 0.515, CRx: 0.235, CRey: 0.340 },
  { ratio: 1.54, CMex: 0.0755, CMey: 0.0978, CMx: 0.0177, CMy: 0.0411, CRex: 0.584, CRx: 0.274, CRey: 0.342 },
  { ratio: 1.67, CMex: 0.0765, CMey: 0.1046, CMx: 0.0153, CMy: 0.0452, CRex: 0.662, CRx: 0.320, CRey: 0.343 },
  { ratio: 1.82, CMex: 0.0774, CMey: 0.1101, CMx: 0.0127, CMy: 0.0492, CRex: 0.752, CRx: 0.375, CRey: 0.344 },
  { ratio: 2.00, CMex: 0.0782, CMey: 0.1140, CMx: 0.0098, CMy: 0.0535, CRex: 0.868, CRx: 0.442, CRey: 0.345 },
];

// Kalmanok: 3 bordes empotrados, 1 borde articulado en Y
const KALMANOK_3FIXED_Y: { ratio: number; CMex: number; CMey: number; CMx: number; CMy: number; CRex: number; CRey: number; CRy: number }[] = [
  { ratio: 0.50, CMex: 0.1140, CMey: 0.0782, CMx: 0.0535, CMy: 0.0098, CRex: 0.345, CRey: 0.868, CRy: 0.442 },
  { ratio: 0.55, CMex: 0.1101, CMey: 0.0774, CMx: 0.0492, CMy: 0.0127, CRex: 0.344, CRey: 0.752, CRy: 0.375 },
  { ratio: 0.60, CMex: 0.1046, CMey: 0.0765, CMx: 0.0452, CMy: 0.0153, CRex: 0.343, CRey: 0.662, CRy: 0.320 },
  { ratio: 0.65, CMex: 0.0978, CMey: 0.0755, CMx: 0.0411, CMy: 0.0177, CRex: 0.342, CRey: 0.584, CRy: 0.274 },
  { ratio: 0.70, CMex: 0.0907, CMey: 0.0743, CMx: 0.0368, CMy: 0.0198, CRex: 0.340, CRey: 0.515, CRy: 0.235 },
  { ratio: 0.75, CMex: 0.0839, CMey: 0.0727, CMx: 0.0327, CMy: 0.0214, CRex: 0.337, CRey: 0.456, CRy: 0.202 },
  { ratio: 0.80, CMex: 0.0773, CMey: 0.0706, CMx: 0.0289, CMy: 0.0224, CRex: 0.334, CRey: 0.405, CRy: 0.175 },
  { ratio: 0.85, CMex: 0.0710, CMey: 0.0682, CMx: 0.0254, CMy: 0.0229, CRex: 0.330, CRey: 0.362, CRy: 0.154 },
  { ratio: 0.90, CMex: 0.0652, CMey: 0.0655, CMx: 0.0222, CMy: 0.0231, CRex: 0.325, CRey: 0.325, CRy: 0.136 },
  { ratio: 0.95, CMex: 0.0599, CMey: 0.0626, CMx: 0.0193, CMy: 0.0230, CRex: 0.320, CRey: 0.293, CRy: 0.120 },
  { ratio: 1.00, CMex: 0.0551, CMey: 0.0596, CMx: 0.0167, CMy: 0.0228, CRex: 0.315, CRey: 0.265, CRy: 0.105 },
  { ratio: 1.05, CMex: 0.0556, CMey: 0.0628, CMx: 0.0161, CMy: 0.0249, CRex: 0.343, CRey: 0.264, CRy: 0.103 },
  { ratio: 1.11, CMex: 0.0560, CMey: 0.0660, CMx: 0.0151, CMy: 0.0270, CRex: 0.374, CRey: 0.263, CRy: 0.102 },
  { ratio: 1.18, CMex: 0.0564, CMey: 0.0691, CMx: 0.0138, CMy: 0.0292, CRex: 0.408, CRey: 0.262, CRy: 0.101 },
  { ratio: 1.25, CMex: 0.0568, CMey: 0.0720, CMx: 0.0123, CMy: 0.0313, CRex: 0.445, CRey: 0.261, CRy: 0.101 },
  { ratio: 1.33, CMex: 0.0571, CMey: 0.0748, CMx: 0.0107, CMy: 0.0333, CRex: 0.487, CRey: 0.260, CRy: 0.100 },
  { ratio: 1.43, CMex: 0.0572, CMey: 0.0774, CMx: 0.0091, CMy: 0.0352, CRex: 0.535, CRey: 0.259, CRy: 0.100 },
  { ratio: 1.54, CMex: 0.0569, CMey: 0.0796, CMx: 0.0075, CMy: 0.0370, CRex: 0.591, CRey: 0.257, CRy: 0.099 },
  { ratio: 1.67, CMex: 0.0566, CMey: 0.0813, CMx: 0.0059, CMy: 0.0385, CRex: 0.657, CRey: 0.255, CRy: 0.099 },
  { ratio: 1.82, CMex: 0.0564, CMey: 0.0826, CMx: 0.0041, CMy: 0.0398, CRex: 0.736, CRey: 0.254, CRy: 0.100 },
  { ratio: 2.00, CMex: 0.0563, CMey: 0.0836, CMx: 0.0028, CMy: 0.0409, CRex: 0.823, CRey: 0.254, CRy: 0.100 },
];

// Kalmanok: 4 bordes empotrados
const KALMANOK_4FIXED: { ratio: number; CMex: number; CMey: number; CMx: number; CMy: number; CRex: number; CRey: number }[] = [
  { ratio: 0.50, CMex: 0.0826, CMey: 0.0560, CMx: 0.0401, CMy: 0.0038, CRex: 0.241, CRey: 0.759 },
  { ratio: 0.55, CMex: 0.0806, CMey: 0.0561, CMx: 0.0385, CMy: 0.0055, CRex: 0.242, CRey: 0.667 },
  { ratio: 0.60, CMex: 0.0784, CMey: 0.0562, CMx: 0.0367, CMy: 0.0076, CRex: 0.244, CRey: 0.589 },
  { ratio: 0.65, CMex: 0.0759, CMey: 0.0565, CMx: 0.0346, CMy: 0.0096, CRex: 0.247, CRey: 0.522 },
  { ratio: 0.70, CMex: 0.0731, CMey: 0.0568, CMx: 0.0322, CMy: 0.0114, CRex: 0.249, CRey: 0.466 },
  { ratio: 0.75, CMex: 0.0698, CMey: 0.0564, CMx: 0.0297, CMy: 0.0129, CRex: 0.250, CRey: 0.417 },
  { ratio: 0.80, CMex: 0.0661, CMey: 0.0558, CMx: 0.0271, CMy: 0.0143, CRex: 0.251, CRey: 0.374 },
  { ratio: 0.85, CMex: 0.0620, CMey: 0.0550, CMx: 0.0246, CMy: 0.0156, CRex: 0.251, CRey: 0.337 },
  { ratio: 0.90, CMex: 0.0580, CMey: 0.0540, CMx: 0.0222, CMy: 0.0167, CRex: 0.251, CRey: 0.305 },
  { ratio: 0.95, CMex: 0.0543, CMey: 0.0527, CMx: 0.0198, CMy: 0.0173, CRex: 0.251, CRey: 0.276 },
  { ratio: 1.00, CMex: 0.0511, CMey: 0.0511, CMx: 0.0176, CMy: 0.0176, CRex: 0.250, CRey: 0.250 },
  { ratio: 1.05, CMex: 0.0527, CMey: 0.0543, CMx: 0.0173, CMy: 0.0198, CRex: 0.276, CRey: 0.251 },
  { ratio: 1.11, CMex: 0.0540, CMey: 0.0580, CMx: 0.0167, CMy: 0.0222, CRex: 0.305, CRey: 0.251 },
  { ratio: 1.18, CMex: 0.0550, CMey: 0.0620, CMx: 0.0156, CMy: 0.0246, CRex: 0.337, CRey: 0.251 },
  { ratio: 1.25, CMex: 0.0558, CMey: 0.0661, CMx: 0.0143, CMy: 0.0271, CRex: 0.374, CRey: 0.251 },
  { ratio: 1.33, CMex: 0.0564, CMey: 0.0698, CMx: 0.0129, CMy: 0.0297, CRex: 0.417, CRey: 0.250 },
  { ratio: 1.43, CMex: 0.0568, CMey: 0.0731, CMx: 0.0114, CMy: 0.0322, CRex: 0.466, CRey: 0.249 },
  { ratio: 1.54, CMex: 0.0565, CMey: 0.0759, CMx: 0.0096, CMy: 0.0346, CRex: 0.522, CRey: 0.247 },
  { ratio: 1.67, CMex: 0.0562, CMey: 0.0784, CMx: 0.0076, CMy: 0.0367, CRex: 0.589, CRey: 0.244 },
  { ratio: 1.82, CMex: 0.0561, CMey: 0.0806, CMx: 0.0055, CMy: 0.0385, CRex: 0.667, CRey: 0.242 },
  { ratio: 2.00, CMex: 0.0560, CMey: 0.0826, CMx: 0.0038, CMy: 0.0401, CRex: 0.759, CRey: 0.241 },
];

function interpolateKalmanokSimple(r: number) {
  const t = [...KALMANOK_SIMPLE].sort((a, b) => a.ratio - b.ratio);
  if (r <= t[0].ratio) return t[0];
  if (r >= t[t.length - 1].ratio) return t[t.length - 1];
  for (let i = 0; i < t.length - 1; i++) {
    if (r >= t[i].ratio && r <= t[i + 1].ratio) {
      const lo = t[i], hi = t[i + 1];
      const f = (r - lo.ratio) / (hi.ratio - lo.ratio);
      return { ratio: r, CMx: lo.CMx + f * (hi.CMx - lo.CMx), CMy: lo.CMy + f * (hi.CMy - lo.CMy), CRx: lo.CRx + f * (hi.CRx - lo.CRx), CRy: lo.CRy + f * (hi.CRy - lo.CRy) };
    }
  }
  return t[t.length - 1];
}

function interpolateKalmanok1Fixed(r: number) {
  const t = [...KALMANOK_1FIXED_X].sort((a, b) => a.ratio - b.ratio);
  if (r <= t[0].ratio) return t[0];
  if (r >= t[t.length - 1].ratio) return t[t.length - 1];
  for (let i = 0; i < t.length - 1; i++) {
    if (r >= t[i].ratio && r <= t[i + 1].ratio) {
      const lo = t[i], hi = t[i + 1];
      const f = (r - lo.ratio) / (hi.ratio - lo.ratio);
      return {
        ratio: r,
        CMex: lo.CMex + f * (hi.CMex - lo.CMex),
        CMx: lo.CMx + f * (hi.CMx - lo.CMx),
        CMy: lo.CMy + f * (hi.CMy - lo.CMy),
        CRx: lo.CRx + f * (hi.CRx - lo.CRx),
        CRey: lo.CRey + f * (hi.CRey - lo.CRey),
        CRy: lo.CRy + f * (hi.CRy - lo.CRy),
      };
    }
  }
  return t[t.length - 1];
}

function interpolateKalmanok1FixedY(r: number) {
  const t = [...KALMANOK_1FIXED_Y].sort((a, b) => a.ratio - b.ratio);
  if (r <= t[0].ratio) return t[0];
  if (r >= t[t.length - 1].ratio) return t[t.length - 1];
  for (let i = 0; i < t.length - 1; i++) {
    if (r >= t[i].ratio && r <= t[i + 1].ratio) {
      const lo = t[i], hi = t[i + 1];
      const f = (r - lo.ratio) / (hi.ratio - lo.ratio);
      return {
        ratio: r,
        CMey: lo.CMey + f * (hi.CMey - lo.CMey),
        CMx: lo.CMx + f * (hi.CMx - lo.CMx),
        CMy: lo.CMy + f * (hi.CMy - lo.CMy),
        CRy: lo.CRy + f * (hi.CRy - lo.CRy),
        CRey: lo.CRey + f * (hi.CRey - lo.CRey),
        CRx: lo.CRx + f * (hi.CRx - lo.CRx),
      };
    }
  }
  return t[t.length - 1];
}

function interpolateKalmanok2FixedX(r: number) {
  const t = [...KALMANOK_2FIXED_X].sort((a, b) => a.ratio - b.ratio);
  if (r <= t[0].ratio) return t[0];
  if (r >= t[t.length - 1].ratio) return t[t.length - 1];
  for (let i = 0; i < t.length - 1; i++) {
    if (r >= t[i].ratio && r <= t[i + 1].ratio) {
      const lo = t[i], hi = t[i + 1];
      const f = (r - lo.ratio) / (hi.ratio - lo.ratio);
      return {
        ratio: r,
        CMex: lo.CMex + f * (hi.CMex - lo.CMex),
        CMx: lo.CMx + f * (hi.CMx - lo.CMx),
        CMy: lo.CMy + f * (hi.CMy - lo.CMy),
        CRy: lo.CRy + f * (hi.CRy - lo.CRy),
        CRex: lo.CRex + f * (hi.CRex - lo.CRex),
      };
    }
  }
  return t[t.length - 1];
}

function interpolateKalmanok2Adj(r: number) {
  const t = [...KALMANOK_2ADJ].sort((a, b) => a.ratio - b.ratio);
  if (r <= t[0].ratio) return t[0];
  if (r >= t[t.length - 1].ratio) return t[t.length - 1];
  for (let i = 0; i < t.length - 1; i++) {
    if (r >= t[i].ratio && r <= t[i + 1].ratio) {
      const lo = t[i], hi = t[i + 1];
      const f = (r - lo.ratio) / (hi.ratio - lo.ratio);
      return {
        ratio: r,
        CMex: lo.CMex + f * (hi.CMex - lo.CMex),
        CMey: lo.CMey + f * (hi.CMey - lo.CMey),
        CMx: lo.CMx + f * (hi.CMx - lo.CMx),
        CMy: lo.CMy + f * (hi.CMy - lo.CMy),
        CRx: lo.CRx + f * (hi.CRx - lo.CRx),
        CRy0: lo.CRy0 + f * (hi.CRy0 - lo.CRy0),
        CRx2: lo.CRx2 + f * (hi.CRx2 - lo.CRx2),
        CRy: lo.CRy + f * (hi.CRy - lo.CRy),
      };
    }
  }
  return t[t.length - 1];
}

function interpolateKalmanok2FixedY(r: number) {
  const t = [...KALMANOK_2FIXED_Y].sort((a, b) => a.ratio - b.ratio);
  if (r <= t[0].ratio) return t[0];
  if (r >= t[t.length - 1].ratio) return t[t.length - 1];
  for (let i = 0; i < t.length - 1; i++) {
    if (r >= t[i].ratio && r <= t[i + 1].ratio) {
      const lo = t[i], hi = t[i + 1];
      const f = (r - lo.ratio) / (hi.ratio - lo.ratio);
      return { ratio: r, CMey: lo.CMey + f * (hi.CMey - lo.CMey), CMx: lo.CMx + f * (hi.CMx - lo.CMx), CMy: lo.CMy + f * (hi.CMy - lo.CMy), CRx: lo.CRx + f * (hi.CRx - lo.CRx), CRey: lo.CRey + f * (hi.CRey - lo.CRey) };
    }
  }
  return t[t.length - 1];
}

function interpolateKalmanok3Fixed(r: number) {
  const t = [...KALMANOK_3FIXED].sort((a, b) => a.ratio - b.ratio);
  if (r <= t[0].ratio) return t[0];
  if (r >= t[t.length - 1].ratio) return t[t.length - 1];
  for (let i = 0; i < t.length - 1; i++) {
    if (r >= t[i].ratio && r <= t[i + 1].ratio) {
      const lo = t[i], hi = t[i + 1];
      const f = (r - lo.ratio) / (hi.ratio - lo.ratio);
      return { ratio: r, CMex: lo.CMex + f * (hi.CMex - lo.CMex), CMey: lo.CMey + f * (hi.CMey - lo.CMey), CMx: lo.CMx + f * (hi.CMx - lo.CMx), CMy: lo.CMy + f * (hi.CMy - lo.CMy), CRex: lo.CRex + f * (hi.CRex - lo.CRex), CRx: lo.CRx + f * (hi.CRx - lo.CRx), CRey: lo.CRey + f * (hi.CRey - lo.CRey) };
    }
  }
  return t[t.length - 1];
}

function interpolateKalmanok4Fixed(r: number) {
  const t = [...KALMANOK_4FIXED].sort((a, b) => a.ratio - b.ratio);
  if (r <= t[0].ratio) return t[0];
  if (r >= t[t.length - 1].ratio) return t[t.length - 1];
  for (let i = 0; i < t.length - 1; i++) {
    if (r >= t[i].ratio && r <= t[i + 1].ratio) {
      const lo = t[i], hi = t[i + 1];
      const f = (r - lo.ratio) / (hi.ratio - lo.ratio);
      return { ratio: r, CMex: lo.CMex + f * (hi.CMex - lo.CMex), CMey: lo.CMey + f * (hi.CMey - lo.CMey), CMx: lo.CMx + f * (hi.CMx - lo.CMx), CMy: lo.CMy + f * (hi.CMy - lo.CMy), CRex: lo.CRex + f * (hi.CRex - lo.CRex), CRey: lo.CRey + f * (hi.CRey - lo.CRey) };
    }
  }
  return t[t.length - 1];
}

function interpolateKalmanok3FixedY(r: number) {
  const t = [...KALMANOK_3FIXED_Y].sort((a, b) => a.ratio - b.ratio);
  if (r <= t[0].ratio) return t[0];
  if (r >= t[t.length - 1].ratio) return t[t.length - 1];
  for (let i = 0; i < t.length - 1; i++) {
    if (r >= t[i].ratio && r <= t[i + 1].ratio) {
      const lo = t[i], hi = t[i + 1];
      const f = (r - lo.ratio) / (hi.ratio - lo.ratio);
      return { ratio: r, CMex: lo.CMex + f * (hi.CMex - lo.CMex), CMey: lo.CMey + f * (hi.CMey - lo.CMey), CMx: lo.CMx + f * (hi.CMx - lo.CMx), CMy: lo.CMy + f * (hi.CMy - lo.CMy), CRex: lo.CRex + f * (hi.CRex - lo.CRex), CRey: lo.CRey + f * (hi.CRey - lo.CRey), CRy: lo.CRy + f * (hi.CRy - lo.CRy) };
    }
  }
  return t[t.length - 1];
}

// Preliminary d_min: d = l / M where M from table
function predimCoef(fixedEdges: number, isCrossed: boolean): number {
  if (isCrossed) {
    if (fixedEdges === 4) return 60;
    if (fixedEdges >= 1) return 55;
    return 50;
  }
  // Unidirectional
  if (fixedEdges >= 2) return 40;
  if (fixedEdges >= 1) return 35;
  return 30;
}

// ---- Main calculation ----
export function designSlab(input: SlabInput): SlabResult {
  const { lx, ly, edges, D, L, fc, fy, cover, h: hInput, dBarX, dBarY } = input;
  const st: string[] = [];
  const bw = 1000; // per meter width

  st.push(`Losa: lx = ${lx} m, ly = ${ly} m`);
  st.push(`Relación ly/lx = ${(ly/lx).toFixed(2)}`);

  // Step 1: Slab type
  const ratio = ly / lx;
  const isCrossed = ratio >= 0.5 && ratio <= 2.0;
  st.push(`Tipo: ${isCrossed ? "Cruzada" : "Unidireccional"}`);
  st.push("");

  // Step 2: Predimensionado
  const fixedEdges = edges.filter((e) => e === "empotrado" || e === "continuo").length;
  const coefPredim = predimCoef(fixedEdges, isCrossed);
  const dMin = ((isCrossed ? Math.min(lx, ly) : lx) * 1000) / coefPredim;
  const hMinReg = 90;
  let h = hInput > 0 ? hInput : Math.max(dMin + cover + 10, hMinReg);
  h = Math.ceil(h / 10) * 10;
  const d = h - cover;
  st.push(`2. Predimensionado:`);
  st.push(`   Coeficiente = ${coefPredim} (${isCrossed ? "cruzada" : "unidireccional"}, ${fixedEdges} borde(s) empotrado(s))`);
  st.push(`   d_min = luz / ${coefPredim} = ${((isCrossed ? Math.min(lx, ly) : lx)*1000).toFixed(0)} / ${coefPredim} = ${dMin.toFixed(0)} mm`);
  st.push(`   h_min reglamentario = ${hMinReg} mm`);
  st.push(`   h adoptado = ${h} mm, d = ${d} mm`);
  st.push("");

  // Step 3: Ultimate load
  const gSelf = (h / 1000) * 25; // kN/m² (self-weight of slab)
  const DTotal = D + gSelf;
  const U1 = 1.4 * DTotal;
  const U2 = 1.2 * DTotal + 1.6 * L;
  const qu = Math.max(U1, U2);
  st.push(`3. Carga última:`);
  st.push(`   Peso propio = h · 25 = ${gSelf.toFixed(2)} kN/m²`);
  st.push(`   D total = ${D.toFixed(2)} + ${gSelf.toFixed(2)} = ${DTotal.toFixed(2)} kN/m²`);
  st.push(`   U1 = 1.4·D = ${U1.toFixed(2)} kN/m²`);
  st.push(`   U2 = 1.2·D + 1.6·L = ${U2.toFixed(2)} kN/m²`);
  st.push(`   qu = max(U1, U2) = ${qu.toFixed(2)} kN/m²`);
  st.push("");

  // Step 4: Moments using Kalmanok coefficients
  const r = Math.min(lx, ly) / Math.max(lx, ly);
  const lShort = Math.min(lx, ly);

  // Determine which table to use
  const isX0Fixed = edges[0] === "empotrado" || edges[0] === "continuo";
  const isXLFixed = edges[1] === "empotrado" || edges[1] === "continuo";
  const isY0Fixed = edges[2] === "empotrado" || edges[2] === "continuo";
  const isYLFixed = edges[3] === "empotrado" || edges[3] === "continuo";
  const hasOneFixedX = fixedEdges === 1 && (isX0Fixed || isXLFixed);
  const hasOneFixedY = fixedEdges === 1 && (isY0Fixed || isYLFixed);
  const hasTwoFixedX = fixedEdges === 2 && isX0Fixed && isXLFixed;
  const hasTwoAdj = fixedEdges === 2 && ((isX0Fixed && isY0Fixed) || (isX0Fixed && isYLFixed) || (isXLFixed && isY0Fixed) || (isXLFixed && isYLFixed));
  const hasTwoFixedY = fixedEdges === 2 && isY0Fixed && isYLFixed;
  const hasThreeFixed = fixedEdges === 3;
  const hasFourFixed = fixedEdges === 4;

  let Mx = 0, My = 0, MnegX = 0, MnegY = 0, tableLabel = "";

  if (hasOneFixedX) {
    const coef = interpolateKalmanok1Fixed(r);
    const Mshorter = coef.CMx * qu * lShort * lShort;
    const Mlonger = coef.CMy * qu * lShort * lShort;
    Mx = lx <= ly ? Mshorter : Mlonger;
    My = lx <= ly ? Mlonger : Mshorter;
    MnegX = coef.CMex * qu * lShort * lShort;
    tableLabel = "1 borde empotrado en X, 3 articulados";
    st.push(`4. Momentos (Kalmanok, ${tableLabel}):`);
    st.push(`   lx/ly = ${r.toFixed(3)} → CMex = ${coef.CMex.toFixed(4)}, CMx = ${coef.CMx.toFixed(4)}, CMy = ${coef.CMy.toFixed(4)}`);
  } else if (hasOneFixedY) {
    const coef = interpolateKalmanok1FixedY(r);
    const Mshorter = coef.CMx * qu * lShort * lShort;
    const Mlonger = coef.CMy * qu * lShort * lShort;
    Mx = lx <= ly ? Mshorter : Mlonger;
    My = lx <= ly ? Mlonger : Mshorter;
    MnegY = coef.CMey * qu * lShort * lShort;
    tableLabel = "1 borde empotrado en Y, 3 articulados";
    st.push(`4. Momentos (Kalmanok, ${tableLabel}):`);
    st.push(`   lx/ly = ${r.toFixed(3)} → CMey = ${coef.CMey.toFixed(4)}, CMx = ${coef.CMx.toFixed(4)}, CMy = ${coef.CMy.toFixed(4)}`);
  } else if (hasTwoFixedX) {
    const coef = interpolateKalmanok2FixedX(r);
    const Mshorter = coef.CMx * qu * lShort * lShort;
    const Mlonger = coef.CMy * qu * lShort * lShort;
    Mx = lx <= ly ? Mshorter : Mlonger;
    My = lx <= ly ? Mlonger : Mshorter;
    MnegX = coef.CMex * qu * lShort * lShort;
    tableLabel = "2 bordes empotrados en X, 2 articulados en Y";
    st.push(`4. Momentos (Kalmanok, ${tableLabel}):`);
    st.push(`   lx/ly = ${r.toFixed(3)} → CMex = ${coef.CMex.toFixed(4)}, CMx = ${coef.CMx.toFixed(4)}, CMy = ${coef.CMy.toFixed(4)}`);
  } else if (hasTwoAdj) {
    const coef = interpolateKalmanok2Adj(r);
    const Mshorter = coef.CMx * qu * lShort * lShort;
    const Mlonger = coef.CMy * qu * lShort * lShort;
    Mx = lx <= ly ? Mshorter : Mlonger;
    My = lx <= ly ? Mlonger : Mshorter;
    MnegX = coef.CMex * qu * lShort * lShort;
    MnegY = coef.CMey * qu * lShort * lShort;
    tableLabel = "2 bordes adyacentes empotrados";
    st.push(`4. Momentos (Kalmanok, ${tableLabel}):`);
    st.push(`   lx/ly = ${r.toFixed(3)} → CMex = ${coef.CMex.toFixed(4)}, CMey = ${coef.CMey.toFixed(4)}, CMx = ${coef.CMx.toFixed(4)}, CMy = ${coef.CMy.toFixed(4)}`);
  } else if (hasTwoFixedY) {
    const coef = interpolateKalmanok2FixedY(r);
    const Mshorter = coef.CMx * qu * lShort * lShort;
    const Mlonger = coef.CMy * qu * lShort * lShort;
    Mx = lx <= ly ? Mshorter : Mlonger;
    My = lx <= ly ? Mlonger : Mshorter;
    MnegY = coef.CMey * qu * lShort * lShort;
    tableLabel = "2 bordes empotrados en Y, 2 articulados en X";
    st.push(`4. Momentos (Kalmanok, ${tableLabel}):`);
    st.push(`   lx/ly = ${r.toFixed(3)} → CMey = ${coef.CMey.toFixed(4)}, CMx = ${coef.CMx.toFixed(4)}, CMy = ${coef.CMy.toFixed(4)}`);
  } else if (hasThreeFixed) {
    const isYsimple = !isY0Fixed || !isYLFixed;
    const coef = isYsimple ? interpolateKalmanok3FixedY(r) : interpolateKalmanok3Fixed(r);
    const Mshorter = coef.CMx * qu * lShort * lShort;
    const Mlonger = coef.CMy * qu * lShort * lShort;
    Mx = lx <= ly ? Mshorter : Mlonger;
    My = lx <= ly ? Mlonger : Mshorter;
    MnegX = coef.CMex * qu * lShort * lShort;
    MnegY = coef.CMey * qu * lShort * lShort;
    tableLabel = "3 bordes empotrados";
    st.push(`4. Momentos (Kalmanok, ${tableLabel}):`);
    st.push(`   lx/ly = ${r.toFixed(3)} → CMex = ${coef.CMex.toFixed(4)}, CMey = ${coef.CMey.toFixed(4)}, CMx = ${coef.CMx.toFixed(4)}, CMy = ${coef.CMy.toFixed(4)}`);
  } else if (hasFourFixed) {
    const coef = interpolateKalmanok4Fixed(r);
    const Mshorter = coef.CMx * qu * lShort * lShort;
    const Mlonger = coef.CMy * qu * lShort * lShort;
    Mx = lx <= ly ? Mshorter : Mlonger;
    My = lx <= ly ? Mlonger : Mshorter;
    MnegX = coef.CMex * qu * lShort * lShort;
    MnegY = coef.CMey * qu * lShort * lShort;
    tableLabel = "4 bordes empotrados";
    st.push(`4. Momentos (Kalmanok, ${tableLabel}):`);
    st.push(`   lx/ly = ${r.toFixed(3)} → CMex = ${coef.CMex.toFixed(4)}, CMey = ${coef.CMey.toFixed(4)}, CMx = ${coef.CMx.toFixed(4)}, CMy = ${coef.CMy.toFixed(4)}`);
  } else {
    const coef = interpolateKalmanokSimple(r);
    const Mshorter = coef.CMx * qu * lShort * lShort;
    const Mlonger = coef.CMy * qu * lShort * lShort;
    Mx = lx <= ly ? Mshorter : Mlonger;
    My = lx <= ly ? Mlonger : Mshorter;
    tableLabel = "4 bordes articulados";
    st.push(`4. Momentos (Kalmanok, ${tableLabel}):`);
    st.push(`   lx/ly = ${r.toFixed(3)} → CMx = ${coef.CMx.toFixed(4)}, CMy = ${coef.CMy.toFixed(4)}`);
  }

  st.push(`   M_x = ${Mx.toFixed(2)} kN·m/m, M_y = ${My.toFixed(2)} kN·m/m`);
  if (MnegX !== 0) st.push(`   M_x,neg = ${MnegX.toFixed(2)} kN·m/m (en apoyo continuo X)`);
  if (MnegY !== 0) st.push(`   M_y,neg = ${MnegY.toFixed(2)} kN·m/m (en apoyo continuo Y)`);
  st.push("");

  // Reactions: Rex = CRex * qu * l_short² / lx, Rey = CRey * qu * l_short² / ly
  // For simple supports: Rx = CRx * qu * l_short, Ry = CRy * qu * l_short
  const qArea = qu * lShort * lShort;
  let Rx = 0, Ry = 0;
  if (hasOneFixedX) {
    const cf = interpolateKalmanok1Fixed(r);
    Rx = cf.CRx * qu * lShort;
    Ry = cf.CRy > 0 ? cf.CRy * qu * lShort : qArea * 0.4 / ly;
  } else if (hasOneFixedY) {
    const cf = interpolateKalmanok1FixedY(r);
    Ry = cf.CRy > 0 ? cf.CRy * qu * lShort : qArea * 0.4 / ly;
    Rx = cf.CRx > 0 ? cf.CRx * qu * lShort : qArea * 0.4 / lx;
  } else if (hasTwoFixedX) {
    const cf = interpolateKalmanok2FixedX(r);
    Rx = cf.CRex > 0 ? cf.CRex * qArea / lx : qArea * 0.5 / lx;
    Ry = cf.CRy > 0 ? cf.CRy * qu * lShort : qArea * 0.5 / ly;
  } else if (hasTwoFixedY) {
    const cf = interpolateKalmanok2FixedY(r);
    Ry = cf.CRey > 0 ? cf.CRey * qArea / ly : qArea * 0.5 / ly;
    Rx = cf.CRx > 0 ? cf.CRx * qu * lShort : qArea * 0.5 / lx;
  } else if (hasTwoAdj) {
    const cf = interpolateKalmanok2Adj(r);
    Rx = cf.CRx > 0 ? cf.CRx * qu * lShort : qArea * 0.4 / lx;
    Ry = cf.CRy > 0 ? cf.CRy * qu * lShort : qArea * 0.4 / ly;
  } else if (hasThreeFixed) {
    const isYsimple = !isY0Fixed || !isYLFixed;
    const cf = isYsimple ? interpolateKalmanok3FixedY(r) : interpolateKalmanok3Fixed(r);
    Rx = (cf as { CRex?: number }).CRex ? (cf as { CRex: number }).CRex * qArea / lx : qArea * 0.4 / lx;
    Ry = (cf as { CRey?: number }).CRey ? (cf as { CRey: number }).CRey * qArea / ly : qArea * 0.4 / ly;
  } else if (hasFourFixed) {
    const cf = interpolateKalmanok4Fixed(r);
    Rx = cf.CRex * qArea / lx;
    Ry = cf.CRey * qArea / ly;
  } else {
    const cf = interpolateKalmanokSimple(r);
    Rx = cf.CRx * qu * lShort;
    Ry = cf.CRy * qu * lShort;
  }
  st.push(`Reacciones: R_x = ${Rx.toFixed(2)} kN/m, R_y = ${Ry.toFixed(2)} kN/m`);
  st.push("");

  // Step 5-8: Design each direction
  function designDir(Mu: number, _dir: string, dB: number): DirectionResult {
    const Mn = Mu / 0.90;
    const mn_val = (Mn * 1e6) / (0.85 * fc * bw * d * d);
    const Ka = 1 - Math.sqrt(1 - 2 * mn_val);
    const beta1 = fc <= 30 ? 0.85 : Math.max(0.85 - 0.05*((fc-30)/7), 0.65);
    const KaMax = 0.375 * beta1;
    const KaMin = fc <= 30 ? 1.4/(0.85*fc) : 1/(3.4*fc);

    let AsReq = 0, caseLabel = "";
    if (Ka <= KaMin) {
      const ka1 = 1.33 * Ka;
      AsReq = (ka1 >= KaMin)
        ? (0.85 * fc * bw * KaMin * d) / fy
        : (0.85 * fc * bw * ka1 * d) / fy;
      caseLabel = `K_a ≤ K_a min → k₁ = ${ka1.toFixed(4)}`;
    } else if (Ka <= KaMax) {
      AsReq = (0.85 * fc * bw * Ka * d) / fy;
      caseLabel = "K_a min < K_a ≤ K_a max";
    } else {
      AsReq = (0.85 * fc * bw * KaMax * d) / fy;
      caseLabel = "K_a > K_a max → armadura doble (simplificado)";
    }

    const AsMin1 = (Math.sqrt(fc) / (4 * fy)) * bw * d;
    const AsMin2 = (1.4 / fy) * bw * d;
    const AsMin = Math.max(AsMin1, AsMin2);
    const AsTemp = 0.0018 * bw * h;
    const sMax = Math.min(2.5 * h, 25 * dB, 300);

    return { Mu, Mn, mn: mn_val, Ka, KaMin, KaMax, caseLabel, AsReq: Math.round(AsReq), AsMin: Math.round(AsMin), AsTemp: Math.round(AsTemp), sMax: Math.round(sMax), phi: 0.90 };
  }

  const dirX = designDir(Mx, "X", dBarX);
  const dirY = designDir(My, "Y", dBarY);

  st.push(`5-8. Dimensionamiento X:`);
  st.push(`   K_a = ${dirX.Ka.toFixed(4)}, K_a min = ${dirX.KaMin.toFixed(4)}, K_a max = ${dirX.KaMax.toFixed(4)}`);
  st.push(`   ${dirX.caseLabel}`);
  st.push(`   A_s,x = ${dirX.AsReq} mm²/m (mín: ${dirX.AsMin}, temp: ${dirX.AsTemp})`);
  st.push(`   s_máx = ${dirX.sMax} mm`);
  st.push("");
  st.push(`5-8. Dimensionamiento Y:`);
  st.push(`   K_a = ${dirY.Ka.toFixed(4)}, K_a min = ${dirY.KaMin.toFixed(4)}, K_a max = ${dirY.KaMax.toFixed(4)}`);
  st.push(`   ${dirY.caseLabel}`);
  st.push(`   A_s,y = ${dirY.AsReq} mm²/m (mín: ${dirY.AsMin}, temp: ${dirY.AsTemp})`);
  st.push(`   s_máx = ${dirY.sMax} mm`);

  // Distribution reinforcement (only for unidirectional slabs)
  const distX: DirectionResult = { ...dirX, AsReq: 0, sMax: 0, caseLabel: "" };
  const distY: DirectionResult = { ...dirY, AsReq: 0, sMax: 0, caseLabel: "" };
  if (!isCrossed) {
    distX.AsReq = Math.max(dirX.AsTemp, Math.round(0.20 * dirX.AsReq));
    distX.sMax = Math.min(3 * h, 300);
    distX.caseLabel = "Repartición X (unidireccional)";
    distY.AsReq = Math.max(dirY.AsTemp, Math.round(0.20 * dirY.AsReq));
    distY.sMax = Math.min(3 * h, 300);
    distY.caseLabel = "Repartición Y (unidireccional)";
    st.push("");
    st.push("9. Armadura de repartición:");
    st.push(`   X: ${distX.AsReq} mm²/m (s ≤ ${distX.sMax} mm)`);
    st.push(`   Y: ${distY.AsReq} mm²/m (s ≤ ${distY.sMax} mm)`);
  }

  return { d, h, qu, x: dirX, y: dirY, distX, distY, Rx, Ry, steps: st };
}
