# Tasks: Guardar, Imprimir y Persistencia para Columnas

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350–450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr-default |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Save, persistence, print for columns | PR 1 | Single PR — all changes in one review. Budget 800 lines (D2), estimated 350-450. |

## Phase 1: Foundation — Storage & Component Types

- [x] 1.1 **storage.ts**: Extend `SavedBeam.type` union → `"acero" \| "hormigon" \| "columna"`. Add `ColumnFormState` interface with all 19 fields.
- [x] 1.2 **storage.ts**: Add `saveLastColumnFormState(ColumnFormState)` and `loadLastColumnFormState(): ColumnFormState | null` with key `mascalculador_last_column_form`.
- [x] 1.3 **SavedBeams.tsx**: Extend `Props.type` → `"acero" \| "hormigon" \| "columna"`. Add optional `onDelete?: (id: string) => void` and `label?: string` prop. Condition heading text: `label ?? "Vigas guardadas"`.

## Phase 2: Core — ColumnForm Save & Persistence

- [x] 2.1 **ColumnForm.tsx**: Import `useLocation, useEffect, useRef`, `SavedBeams`, `saveBeam, saveLastColumnFormState, loadLastColumnFormState`.
- [x] 2.2 **ColumnForm.tsx**: Add init state hierarchy: `locationState > loadLastColumnFormState() > hardcoded defaults`. Use `useLocation()` to detect back-nav from results.
- [x] 2.3 **ColumnForm.tsx**: Add `useEffect` auto-save calling `saveLastColumnFormState(ColumnState)` on every field change, guarded by `useRef` on first mount.
- [x] 2.4 **ColumnForm.tsx**: Add `handleSave()` — `prompt()` → `saveBeam(name, "columna", { ...ColumnState })`. Add `handleLoad(data)` — restore all 19 `useState` setters from saved data.
- [x] 2.5 **ColumnForm.tsx**: Add `<SavedBeams type="columna" onLoad={handleLoad} label="Columnas guardadas" />` component and "Guardar" button next to "Calcular" submit.

## Phase 3: Results & Print

- [x] 3.1 **ColumnResults.tsx**: Fix "← Volver" to `navigate("/columns", { state: fullColumnState })` instead of `navigate("/columns")`. Add "Imprimir" button → `navigate("/column-print", { state })`.
- [x] 3.2 **NEW ColumnPrintPage.tsx**: Create component that receives `ColumnState` from `useLocation().state`. Fallback: show `SavedBeams` list when no nav state present.
- [x] 3.3 **ColumnPrintPage.tsx**: Recalculate with `designColumn()` (or `computeBuiltUpI`/`computeBuiltUpBox`). Render A4 planilla: header, profile info, input summary, φPn/φMnx/φMny, P_u/P_c ratio, interaction ratio, pasó/no pasó, `result.steps`.
- [x] 3.4 **ColumnPrintPage.tsx**: Add `@media print` CSS (A4, 12mm margins, black/white). Call `window.print()` in `useEffect` on mount. Include "← Volver" and "Imprimir" buttons (`.no-print`).

## Phase 4: Routing & Verification

- [x] 4.1 **main.tsx**: Import `ColumnPrintPage`, add route `{ path: "/column-print", element: <ColumnPrintPage /> }`.
- [x] 4.2 **Build verification**: `cd client && npx tsc -b` — no type errors. `cd client && npx eslint client/src/...` — no lint errors.
