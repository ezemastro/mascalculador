# Tasks: Slab-to-Beam Reaction Transfer

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300–350 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Core engine: types + D/L reactions in `slab-calc.ts` + adapter | PR 1 | Base: main. ~150 lines |
| 2 | UI: SlabResults button + FormPage import section | PR 2 | Base: main. Depends on PR 1 for adapter. ~145 lines |

## Phase 1: Foundation — Data Model + Adapter

- [x] 1.1 Add 8 fields `RD_izq`, `RL_izq`, `RD_der`, `RL_der`, `RD_arr`, `RL_arr`, `RD_aba`, `RL_aba` to `SlabResult` interface in `client/src/lib/slab-calc.ts` (~10 lines)
- [x] 1.2 Declare `RD_izq`…`RL_aba` vars alongside existing `RxIzq`…`RyAba` in `designSlab()`, and add `q_D = DTotal`, `q_L = L` after `qu` computation (~5 lines)
- [x] 1.3 Refactor **unidirectional branches** (x/y symmetric + mixed + cantilever ×6) to closure pattern: `calc(q) → [izq, der, arr, aba]` called 3× con `qu`, `q_D`, `q_L` (~65 lines changed)
- [x] 1.4 Refactor **Kalmanok branches** (simple, 1FixedX/Y, 2FixedX/Y, 2Adj, 3Fixed, 4Fixed ×9) to closure pattern (~90 lines changed)
- [x] 1.5 Add new fields to `designSlab()` return object (~2 lines)
- [x] 1.6 Create `client/src/lib/slab-to-beam.ts` with `hasSlabDL(r)` and `slabReactionToBeamLoad(result, edge)` (~25 lines new file)

## Phase 2: UI Integration — SlabResults + FormPage

- [x] 2.1 Add "Enviar a viga" button per edge card in `client/src/screens/SlabResults.tsx` — calls `slabReactionToBeamLoad()` and `navigate("/", { state: { slabImport } })`, disabled if legacy (~50 lines)
- [x] 2.2 Add "Importar carga de losa" collapsible section in `client/src/screens/FormPage.tsx`: slab `<select>` via `getSavedSlabs()`, edge `<select>`, "Agregar carga" button, inline warning for legacy slabs (~80 lines)
- [x] 2.3 Handle `location.state.slabImport` in `FormPage.tsx` — auto-select slab + edge on mount, pre-fill load with start/end from geometry (~20 lines)
- [x] 2.4 Handle `slabImport` priority over `lastFormState` — if `slabImport` present, skip `loadLastFormState()` (~3 lines)

## Phase 3: Verification

- [x] 3.1 Verify new slab produces numeric `RD_*`/`RL_*` and legacy deserialization returns `undefined` for those fields
- [x] 3.2 Verify `slabReactionToBeamLoad()` returns correct D/L per edge and `null` for legacy
- [x] 3.3 Verify "Enviar a viga" navigates to FormPage with load pre-filled and start/end editable
- [x] 3.4 Verify legacy slab shows warning + disabled import in both SlabResults and FormPage
