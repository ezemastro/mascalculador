# Design: Dimensionado de Bases

## 1. Architecture Overview

The Bases tab follows the existing two-screen navigation pattern proven by `/rc-column` → `/rc-column-results`:

```
User fills form at /bases → navigate("/bases-results", { state: { input } })
                              → BasesResults calls designBase(input) in useMemo
                              → displays result cards, steps, save button
```

- **Router**: two new routes under the existing `Layout` outlet in `createBrowserRouter`
- **NavBar**: one new `<Link to="/bases">Bases</Link>` matching existing link pattern
- **Calc module**: pure function `designBase(input): BaseResult` in `client/src/lib/bases-calc.ts` — no React, no DOM, no side effects. Importable and callable from Node for verification.
- **State flow**: form state serialized via React Router `location.state`, auto-saved to localStorage on every field change

## 2. File Layout

| File | Action | Role |
|------|--------|------|
| `client/src/main.tsx` | **Modify** | Add 2 routes + NavBar link (see §8) |
| `client/src/lib/bases-calc.ts` | **New** | Pure calc: `BaseInput`, `BaseResult`, `designBase()`, private step helpers |
| `client/src/lib/storage.ts` | **Modify** | Add `"bases"` to union types, `LAST_BASES_FORM_KEY`, `BasesFormState`, save/load functions |
| `client/src/screens/BasesForm.tsx` | **New** | Form with sections: Suelo, Materiales, Columna, Tipo, Geometría, Armado |
| `client/src/screens/BasesResults.tsx` | **New** | Result cards, verifications, "Ver cuentas" collapsible, guardar/editar buttons |
| `client/src/components/SavedBeams.tsx` | **Modify** | Add `"bases"` to `Props.type` union |

## 3. Calc Module Design (`bases-calc.ts`)

### Types

```typescript
export type BaseType = "centrada" | "medianera";
export type MedianeraSubType = "viga-de-fundacion" | "tensor";

export interface BaseInput {
  // Suelo
  qa: number;                         // kN/cm² — tensión admisible del suelo
  Df: number;                         // cm — profundidad de fundación
  // Cargas
  PD: number;                         // kN — carga muerta
  PL: number;                         // kN — carga viva
  // Columna
  cx: number;                         // cm — lado X de la columna
  cy: number;                         // cm — lado Y de la columna
  // Materiales
  fc: number;                         // MPa — resistencia del hormigón
  fy: number;                         // MPa — tensión de fluencia del acero
  // Tipo
  type: BaseType;
  subType?: MedianeraSubType;        // solo si type === "medianera"
  // Overrides manuales de geometría
  B?: number;                         // cm — ancho de la base
  L?: number;                         // cm — largo de la base
  h?: number;                         // cm — altura total de la base
  // Medianera extras
  Lcol?: number;                      // cm — luz de viga de fundación
  H?: number;                         // cm — altura del tensor
  mu?: number;                        // adimensional — coeficiente de fricción
  // Armado
  cover?: number;                     // cm — recubrimiento (default 5)
  rebD?: number;                      // mm — diámetro de barra (default 12)
  // Etiqueta
  columnName?: string;                // nombre de columna cargada (solo display)
}

export interface BaseResult {
  // Geometría
  Areq: number; Ap: number; B: number; L: number; h: number; d: number;
  kx: number; ky: number;
  // Cargas
  Pu: number; qu: number;
  Pu1: number; e: number;            // medianera: Pu real + excentricidad
  // Flexión
  Mux: number; Muy: number; Mnx: number; Mny: number;
  Mu: number; Mnv: number;           // medianera: momento y nominal
  // Corte
  Vu_punch: number; phiVc_punch: number; punchOK: boolean;
  Vux: number; Vuy: number; phiVc_beam: number; beamShearOK: boolean;
  Vu_med: number;                    // medianera: corte en viga
  // Armadura
  mnx: number; mny: number; mn_med: number;
  kax: number; kay: number; ka_med: number; kamin: number;
  Asx: number; Asy: number; AsMin: number;
  As_sup: number; As_inf: number; As_tensor: number;
  // Barras
  db: number; nb_x: number; nb_y: number;
  sep_x: number; sep_y: number; sepCheckOK: boolean;
  // Medianera
  Tu: number; Ru: number; FrictionOK: boolean;
  // Talón
  heel: number; heelOK: boolean;
  // Traza
  steps: string[];                   // registro paso a paso legible
  warnings: string[];                // advertencias no bloqueantes
  errors: string[];                  // errores de validación
}
```

### Dispatch Logic (Pseudocode)

```typescript
function designCentrada(input: BaseInput): BaseResult {
  // 13 pasos según spec, llamando helpers privados
  const dims    = step1_Dimensions(input);
  const Pu      = step2_Pu(input.PD, input.PL);
  const kamin   = step3_Kamin(input.fc);
  const B       = input.B ?? dims.B;
  const L       = input.L ?? dims.L;
  const qu      = step4_Qu(Pu, B, L);
  const { kx, ky, Mux, Muy } = step5_Bending(qu, B, L, input.cx, input.cy);
  const { Mnx, Mny } = step6_Nominal(Mux, Muy);
  const d       = step7_EffectiveDepth(input, B, L, input.cx, input.cy, Mnx, Mny);
  const punch   = step8_Punching(Pu, qu, input.cx, input.cy, d, input.fc, B, L);
  const shear   = step9_BeamShear(qu, B, L, input.cx, input.cy, d, input.fc);
  const steel   = step10_Steel(Mnx, Mny, B, L, d, input.fc, input.fy, kamin);
  const h       = step11_TotalHeight(input.h, d, input.cover);
  const heel    = step12_Heel(h, kx, ky);
  const barDisp = step13_Spacing(steel.Asx, steel.Asy, B, L, input.rebD);
  return /* ensamblar BaseResult con steps[] */;
}

function designVigaFundacion(input: BaseInput): BaseResult {
  // 7 pasos: Pu, e, qu, Mu, Mnv, As_viga, armadura
  const Pu      = step2_Pu(input.PD, input.PL);
  const B       = input.B ?? /* predim base cuadrada */;
  const { e, Pu1 } = medStep1_Excentricidad(Pu, B, input.cx);
  const qu      = step4_Qu(Pu1, B, L);
  const { Mu, Mnv } = medStep2_Flexion(qu, B, input.Lcol);
  const AsViga  = medStep3_ArmaduraViga(Mnv, B, d_eff, input.fc, input.fy);
  // ... shear, armadura base
  return /* result con e, Mu, Ru, As_sup, h_viga */;
}

function designTensor(input: BaseInput): BaseResult {
  // 6 pasos: Pu, Tu, Ru, friction check, armadura tensor
  const Pu      = step2_Pu(input.PD, input.PL);
  const e       = /* excentricidad según B, cx */;
  const Tu      = medStep4_Tension(Pu, e, input.H);
  const Ru      = input.mu * input.PD;
  const frictionOK = Ru >= Tu;
  const AsTensor = medStep5_ArmaduraTensor(Tu, input.fy);
  // ... armadura base
  return /* result con Tu, Ru, FrictionOK, As_tensor */;
}

export function designBase(input: BaseInput): BaseResult {
  // Validación de entrada
  if (input.qa <= 0) throw new Error("La tensión admisible del suelo (qa) debe ser mayor que cero.");
  if (input.PD + input.PL <= 0) throw new Error("La carga total (PD + PL) debe ser mayor que cero.");
  // ... más validaciones

  if (input.type === "centrada") return designCentrada(input);
  if (input.type === "medianera") {
    if (!input.subType) throw new Error("Para base medianera, seleccione viga de fundación o tensor.");
    if (input.subType === "viga-de-fundacion") return designVigaFundacion(input);
    if (input.subType === "tensor") return designTensor(input);
    throw new Error(`Subtipo de medianera no reconocido: ${input.subType}`);
  }
  throw new Error(`Tipo de base no reconocido: ${input.type}`);
}
```

### Private Helper Signatures

| Helper | Role | Input | Output |
|--------|------|-------|--------|
| `step1_Dimensions(input)` | Predimensionado: `A_req = (PD+PL)·1.10/qa`, `B=L=√A`, `h=max(20, predim)` | `BaseInput` | `{ Areq, B, L, h }` |
| `step2_Pu(PD, PL)` | `max(1.4·PD, 1.2·PD+1.6·PL)` | `number, number` | `number` (kN) |
| `step3_Kamin(fc)` | `ka_min = 2.8/(0.85·fc)` | `number` (MPa) | `number` |
| `step4_Qu(Pu, B, L)` | `qu = Pu/(B·L)` | `number×3` | `number` (kN/cm²) |
| `step5_Bending(qu, B, L, cx, cy)` | kx, ky, Mux, Muy | `number×6` | `{ kx, ky, Mux, Muy }` |
| `step6_Nominal(Mux, Muy)` | `Mn = Mu/0.90` | `number×2` | `{ Mnx, Mny }` |
| `step7_EffectiveDepth(...)` | `d = max((B-cx)/3, (L-cy)/3)` o predim por rigidez | `BaseInput + dimensions` | `number` (cm) |
| `step8_Punching(...)` | Verificación punzonado: `Vu ≤ φ·Vc` | `number×9` | `{ Vu, φVc, OK }` |
| `step9_BeamShear(...)` | Corte unidireccional en ambas direcciones | `number×8` | `{ Vux, Vuy, φVc, OK }` |
| `step10_Steel(...)` | `mn`, `ka = max(kamin, ...)`, `As = ka·0.85·d·b·fc/fy` | `number×10` | `{ mnx, mny, kax, kay, Asx, Asy, AsMin }` |
| `step11_TotalHeight(h_override, d, cover)` | `h = max(d + cover, 30)` cm | `number? × 2` | `number` (cm) |
| `step12_Heel(h, kx, ky)` | `h - max(kx, ky) ≥ 25` | `number×3` | `{ heel, OK }` |
| `step13_Spacing(Asx, Asy, B, L, rebD)` | `nb = As/aBar` redondeado arriba; `sep = (L-10)/(n-1) ≤ min(25·db, 30)` | `number×5` | `{ db, nb_x, nb_y, sep_x, sep_y, OK }` |
| `medStep1_Excentricidad(Pu, B, cx)` | `e = (B-cx)/2`, `Pu1 = Pu·B/(B-2e)` | `number×3` | `{ e, Pu1 }` |
| `medStep2_Flexion(qu, B, Lcol)` | `Mu = qu·B·Lcol²/2` | `number×3` | `{ Mu, Mn }` |
| `medStep3_ArmaduraViga(Mnv, B, d, fc, fy)` | Acero viga de fundación | `number×5` | `{ As_sup, As_inf }` |
| `medStep4_Tension(Pu, e, H)` | `Tu = Pu·e/H` | `number×3` | `number` (kN) |
| `medStep5_ArmaduraTensor(Tu, fy)` | `As = Tu/(φ·fy)` | `number×2` | `number` (cm²) |
| `fmt(n, decimals)` | Formateo de números para `steps[]` | `number, number` | `string` |

## 4. Unit Strategy

| Magnitud | Input | Calc interno | Output |
|----------|-------|-------------|--------|
| Tensión admisible suelo (qa) | **kN/cm²** | kN/cm² | kN/cm² |
| Resistencia hormigón (fc) | **MPa** | MPa → kN/cm² (×0.1) | MPa |
| Fluencia acero (fy) | **MPa** | MPa → kN/cm² (×0.1) | MPa |
| Cargas (PD, PL, Pu) | **kN** | kN | kN |
| Geometría (cx, cy, B, L, h, d, Df, H, Lcol) | **cm** | cm | cm |
| Momentos (Mux, Muy, Mnx, Mny, Mu) | — | kN·cm | kN·cm |
| Armadura (As, aBar) | — | cm² | cm² |
| Diámetro barra (rebD, db) | **mm** | mm → cm² (π·d²/4/100) | mm |
| Separación (sep) | — | cm | cm |
| Esfuerzos internos (qu) | — | kN/cm² | kN/cm² |

**Conversion rule**: all unit conversions happen at calc module boundary. UI inputs/outputs use the units specified above. The `steps[]` array documents conversions explicitly.

**Key conversion**: `1 MPa = 0.1 kN/cm²`. Applied when comparing concrete/shear stresses against geometry in cm².

## 5. UI Architecture

### BasesForm.tsx (`/bases`)

State initialization priority: `location.state` (from "Modificar datos") → `loadLastBasesFormState()` → hardcoded defaults.

**State fields**: `qa`, `Df`, `PD`, `PL`, `cx`, `cy`, `fc`, `fy`, `type`, `subType`, `B`, `L`, `h`, `Lcol`, `H`, `mu`, `cover`, `rebD`, `columnName`, `columnId`, `loadedSaveId`, `loadedSaveName`.

**Form sections** (using `<section className="bg-surface rounded-xl border border-border p-5">` pattern from RCColumnForm):

1. **Suelo**: `<DecimalInput>` for `qa` (kN/cm²), `Df` (cm)
2. **Materiales**: `<select>` for `fc` (20/25/30/35/40), `fy` (420/500) — same options as RCColumnForm
3. **Columna**: "Cargar columna guardada" dropdown (reads `listSaves().filter(s => s.type === "rc-columna")` with defensive `typeof` checks on PD/PL/Cx/Cy), manual overrides via `<DecimalInput>`
4. **Tipo de base**: radio buttons or `<select>` for Centrada / Medianera. If Medianera, show sub-selector: Viga de fundación | Tensor
5. **Geometría**: Auto-predim preview (read-only display of computed B, L, h from a `useMemo` calling step helpers), with override inputs. Override fields default empty — when empty, auto-predim is used.
6. **Medianera extras** (conditional): `Lcol` (cm) for viga; `H` (cm) and `μ` for tensor
7. **Armado**: `cover` (cm, default 5), `rebD` (mm, default 12)

**Auto-save**: `useEffect` on form state deps, guarded by `mountedRef` (skip first render), calls `saveLastBasesFormState()`.

**Buttons**:
- "Cargar base guardada": `<SavedBeams type="bases">` collapsible (data screen behavior → "Guardar datos")
- "Guardar datos": calls `saveBeam(name, "bases", { input })` with `prompt()`
- "Calcular": validates required fields, then `navigate("/bases-results", { state: { input, name: loadedSaveName, saveId: loadedSaveId } })`

### BasesResults.tsx (`/bases-results`)

Reads `location.state` as `{ input: BaseInput, name?: string, saveId?: string }`. If missing → render instructional message with link to `/bases` (matching RCColumnResults pattern).

**Result computed in component**: `const result = useMemo(() => designBase(input), [input])` — no pre-computation on form side; calc is pure and fast.

If `designBase` throws → catch and display error card with message and "Volver al formulario" button.

**Sections**:
- **Resumen**: cards showing `B×L×h` cm, `Pu` kN, `qu` kN/cm², `d` cm, `kx/ky` cm
- **Verificación**: punchOK, beamShearOK, sepCheckOK, heelOK — each as pass/fail badge
- **Armadura**: `AsX`, `AsY`, `AsMin`, `db`, `nb_x`, `nb_y`, `sep_x`, `sep_y`
- **Medianera** (conditional): `e`, `Mu`, `Tu`/`Ru`, `As_sup`, `As_tensor`, `h_viga`/`h_tensor`, `FrictionOK`
- **Ver cuentas**: collapsible `<pre>` with `result.steps.join("\n")` (matching RCColumnResults)
- **Advertencias**: `result.warnings` displayed as amber alert cards
- **Errores**: `result.errors` displayed as red alert cards

**Buttons**:
- "Guardar resultados": `saveBeam(name, "bases", { input, result })` with `prompt()`
- "Modificar datos" → `navigate("/bases", { state: input })` (back to form with state restoration)

## 6. State Flow Diagram

```
User opens /bases
  │
  ├─→ BasesForm mounts
  │     ├─ location.state? → restore from "Modificar datos" navigation
  │     ├─ loadLastBasesFormState()? → restore from localStorage
  │     └─ else → defaults
  │
  ├─→ User selects column from dropdown
  │     ├─ listSaves().filter(s => s.type === "rc-columna")
  │     ├─ defensive typeof checks on data.PD, data.PL, data.Cx, data.Cy
  │     └─ setState → triggers useEffect auto-save
  │
  ├─→ User fills fields → useEffect auto-saves to "mascalculador_last_bases_form"
  │
  ├─→ User clicks "Calcular"
  │     ├─ validate required (qa, PD+PL, cx, cy, type, subType if medianera)
  │     └─ navigate("/bases-results", { state: { input, name, saveId } })
  │
  ▼
BasesResults mounts at /bases-results
  │
  ├─ location.state missing?
  │     └─ show "No hay resultados para mostrar. Complete el formulario de dimensionado primero."
  │
  ├─ location.state present
  │     ├─ result = designBase(input) in useMemo
  │     ├─ render cards, verifications, steps
  │     └─ user clicks "Guardar resultados" → saveBeam(name, "bases", { input, result })
  │
  └─ user clicks "Modificar datos" → navigate("/bases", { state: input })
```

## 7. Storage Additions (`storage.ts`)

```typescript
// NEW key (alongside existing keys, line ~7)
const LAST_BASES_FORM_KEY = "mascalculador_last_bases_form";

// MODIFY union — add "bases" at 3 locations:
// 1. SavedBeam.type (line 86):
type: "acero" | "hormigon" | "columna" | "rc-columna" | "cartel" | "losa" | "bases";

// 2. saveBeam() parameter (line 108):
type: "acero" | "hormigon" | "columna" | "rc-columna" | "cartel" | "losa" | "bases",

// 3. getSavedBeams() parameter (line 311):
type: "acero" | "hormigon" | "columna" | "rc-columna" | "cartel" | "losa" | "bases",

// NEW interface + functions (append at end of file):
export interface BasesFormState {
  qa: number; Df: number;
  PD: number; PL: number;
  cx: number; cy: number;
  fc: number; fy: number;
  type: string;
  subType?: string;
  B?: number; L?: number; h?: number;
  Lcol?: number; H?: number; mu?: number;
  cover: number; rebD: number;
  columnId?: string; columnName?: string;
}

export function saveLastBasesFormState(state: BasesFormState) {
  try { localStorage.setItem(LAST_BASES_FORM_KEY, JSON.stringify(state)); }
  catch { /* quota exceeded, ignore */ }
}

export function loadLastBasesFormState(): BasesFormState | null {
  try {
    const raw = localStorage.getItem(LAST_BASES_FORM_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BasesFormState;
  } catch { return null; }
}
```

**SavedBeams.tsx Props.type** — add `"bases"`:

```typescript
// Line 5:
type: "acero" | "hormigon" | "columna" | "rc-columna" | "cartel" | "losa" | "bases";
```

## 8. Routing Additions (`main.tsx`)

```typescript
// New imports (alongside existing screen imports):
import BasesForm from "./screens/BasesForm.tsx";
import BasesResults from "./screens/BasesResults.tsx";

// New routes (inside children array):
{ path: "/bases", Component: BasesForm },
{ path: "/bases-results", Component: BasesResults },

// New NavBar link (inside NavBar function, before closing </div>):
<Link to="/bases" className="text-sm text-text-muted hover:text-text">
  Bases
</Link>
```

## 9. Edge Cases & Error Handling

| Condition | Behavior |
|-----------|----------|
| `qa ≤ 0` | `designBase` throws `"La tensión admisible del suelo (qa) debe ser mayor que cero."`; BaseResults catches and shows error |
| `PD + PL ≤ 0` | `designBase` throws; form prevents submit with inline validation |
| Missing `cx` or `cy` | Form requires both before submit; inline "Campo obligatorio" |
| Medianera without `subType` | Form validation: "Seleccione viga de fundación o tensor" |
| Medianera viga without `Lcol` | Form requires `Lcol > 0` |
| Medianera tensor without `H` | Form requires `H > 0` |
| `mu` missing for tensor | Default 0.4; user can override |
| Stored column missing Cx/Cy | Defensive `typeof` check → skip field, keep current value |
| Form state schema mismatch | `try/catch` in `loadLastBasesFormState` → returns `null`, form starts fresh |
| `location.state` missing on results | Render instructional message, no crash |
| `designBase` throws on results | `try/catch` → render error card with message |
| Duplicate save name | `saveBeam` throws `"Ya existe un elemento..."`; UI shows `alert()` |
| `cover` omitted | Default 5 cm in calc module boundary |
| `rebD` omitted | Default 12 mm in calc module boundary |
| Geometry overrides provided | Skip predimension step; use provided B, L, h directly |

## 10. Build & Verify

```bash
cd client && npm run build   # must pass with 0 errors
cd client && npm run lint    # must pass (expected: pre-existing warnings only)
```

Manual verification checklist (per spec scenarios):
1. Centrada happy path: fill form → submit → verify 13 steps, `punchOK=true`, `beamShearOK=true`
2. Medianera viga: select type + subType → verify `e`, `Mu`, `Ru`, `As_sup`, `h_viga` appear
3. Medianera tensor: select type + subType → verify `Tu`, `As_tensor`, `FrictionOK` appear
4. Save + reload: "Guardar datos" → reload page → form restored from localStorage
5. "Cargar columna guardada": dropdown populates from `rc-columna` saves
6. "Modificar datos" from results → form pre-filled with input
7. "Guardar resultados" from results → full `{ input, result }` persisted
8. Invalid inputs: zero qa → error display; missing PD → inline validation
9. Build: `npm run build` exits 0

## 11. Architecture Decisions

| Decision | Option A | Option B | Choice | Rationale |
|----------|----------|----------|--------|-----------|
| **Column dropdown data source** | Extend `listSavedColumns()` to include Cx/Cy | Read raw `listSaves()` in component with defensive typeof | **Option B** | Avoids modifying shared `beam-reaction.ts` interface; keeps extraction logic local to BasesForm; `listSavedColumns()` is used by RCColumnForm for contributed loads where Cx/Cy are irrelevant |
| **One save per footing** | Single save with `{ input, result }` | Multiple saves per footing (input-only, result-only) | **Single save** | Matches project pattern (slab, RC column); input-only saves via "Guardar datos", full saves via "Guardar resultados" |
| **Calc module purity** | `designBase` as pure function | Class with mutable state | **Pure function** | Testable in isolation; matches `designRCColumn`, `designSlab` patterns; no side effects |
| **Unit for σs (qa)** | kN/cm² | MPa | **kN/cm²** | Matches load units (kN) and geometry units (cm); avoids conversion errors at input boundary; conversion to/from MPa documented in calc module |
| **Print page** | Include now | Add later | **Add later** | RC column has no print page; bases can follow same timeline; out of scope per proposal |
| **Auto-predim** | Compute in calc module only | Preview in form via `useMemo` calling step helpers | **Preview in form** | Matches RCColumnForm pattern (autoDims via useMemo); user sees predim before submitting; overrides bypass predim in calc |
| **Error strategy** | Return errors in result object | Throw on invalid input | **Hybrid**: throw on structural invalids, return errors/warnings in result | `qa ≤ 0` is a programming error → throw. Beam doesn't pass shear → return `beamShearOK: false` with `warnings[]`. Matches the proposal's mixed approach. |
