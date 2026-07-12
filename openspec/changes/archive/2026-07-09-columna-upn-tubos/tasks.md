# Tasks: Columna UPN Simple y Caños Estructurales

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~180–220 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: New Data — tube-profiles.ts

- [x] 1.1 Create `client/src/lib/tube-profiles.ts` — `TubeData` interface with h, b, t, A, Ix, Iy, rx, ry, Zx, Zy, Sx, Sy, peso
- [x] 1.2 Implement `computeTubeProperties(h, b, t)` — A = 2·t·(h+b-2t), Ix = (b·h³-(b-2t)·(h-2t)³)/12, Zx ≈ 1.12·Sx, rx = √(Ix/A), peso = A × 0.785e-4
- [x] 1.3 Build `TUBE_PROFILES` array — 4–5 wall thicknesses per size, SHS 50×50 to 300×300 (~40 entries)
- [x] 1.4 Build RHS entries — 100×50 to 300×200 (~25 entries) with names "□ 100×100×4" format

## Phase 2: Form — ColumnForm.tsx

- [x] 2.1 Extend `ColumnState.profileType` union: `"IPN" | "UPN" | "2UPN" | "TUBO"`; add `tubeName?: string`
- [x] 2.2 Add `"UPN"` and `"TUBO"` options to profile type `<select>`; import `TUBE_PROFILES`
- [x] 2.3 Conditional block: `UPN` branch shows UPN_PROFILES dropdown, hides gap input; `TUBO` branch shows TUBE_PROFILES dropdown grouped as SHS / RHS `<optgroup>`
- [x] 2.4 `handleSubmit` passes `tubeName` in state; default `tubeName = "□ 100×100×4"`

## Phase 3: Results — ColumnResults.tsx

- [x] 3.1 Destructure `tubeName` from state; import `TUBE_PROFILES`
- [x] 3.2 Add `else if (profileType === "UPN")` branch — read `A, Ix, Iy, Zx, Zy` from UPN_PROFILES entry directly; `displayName = upnName`
- [x] 3.3 Add `else if (profileType === "TUBO")` branch — read `A, Ix, Iy, Zx, Zy` from TUBE_PROFILES entry; `displayName = tubeName`
- [x] 3.4 Verify IPN and 2UPN branches still compile unchanged

## Phase 4: Build Verification

- [x] 4.1 Run `npm run build` — `tsc -b` must pass with zero errors; confirm no `column-calc.ts` changes
- [x] 4.2 Manual smoke: UPN 200, Fy=235, L=3000, Pu=100 → verify φPn renders
- [x] 4.3 Manual smoke: □ 100×100×4, same params → verify tube name displays and ratio shows
