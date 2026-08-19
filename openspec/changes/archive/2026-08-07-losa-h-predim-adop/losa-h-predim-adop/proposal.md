# Proposal: losa-h-predim-adop

## Intent

Today the only way to learn the auto-predimensioned `h` is to submit and read it from the result. Surface `h predim` live in the form (read-only, recomputed on every input change) and rename the existing user input to `h adop` — the value the user wants to force. The engine keeps receiving a single effective `h` in mm; the form does the substitution.

## Scope

### In Scope

- Read-only `h predim (cm)` display next to the four edge selects, `useMemo` over `lx`, `ly`, `edges`.
- Rename `h (cm) — 0 = predimensionar` → `h adop (cm) — 0 = usar predim` (cm), backed by `hAdop` state.
- At submit / save compute `hEfectivoMm = (hAdop > 0 ? hAdop : hPredim) * 10` and pass it as the engine's `h`.
- `SlabLastFormState.h` → `hAdop` (cm). Migration: legacy `h` (mm) becomes `hAdop = h / 10` on load.
- `+ Nueva` resets `hAdop = 0` and removes the localStorage entry.
- Mirror to `apps/steel/src/screens/SlabForm.tsx`.

### Out of Scope

Engine changes (`slab-calc.ts` keeps its `h: number` mm signature and the `hInput > 0` fallback), `SlabInput` type, `SlabResults` UI, grid rework.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `slab-ux-form` — extend the archived `h field location` requirement; add 5 new requirements.

## Approach

1. `SlabForm`: replace `h` useState with `hAdop` (cm). Add `useMemo` recomputing `hPredim` (cm) from `predimCoef(lx, ly, edges)`.
2. `handleSubmit` / `handleSaveData` compute `hEfectivoMm` and inject it as `h` into navigation state and `SlabInput`.
3. `packages/shared/src/storage.ts`: rename `SlabLastFormState.h` → `hAdop` (cm). `loadLastSlabFormState` migrates legacy `h` (mm) into `hAdop = h / 10`.
4. Render `h predim (cm): {hPredim.toFixed(1)}` next to the input in muted style.
5. `predimCoef` is imported from `slab-calc.ts`; if private, apply adds `export`.

## Affected Areas

- `apps/concrete/src/screens/SlabForm.tsx` — Modified: `hAdop` state, `hPredim` useMemo, derived `hEfectivo`, read-only display, `+ Nueva` reset.
- `apps/steel/src/screens/SlabForm.tsx` — Modified (mirror): byte-identical copy of concrete changes.
- `packages/shared/src/storage.ts` — Modified: `SlabLastFormState.h` → `hAdop` (cm) + legacy migration.
- `apps/concrete/src/lib/slab-calc.ts` — None (signature unchanged; may need `export` on `predimCoef`).

## Risks

| Risk | Mitigation |
|------|------------|
| `predimCoef` not exported | Apply adds `export` (single-file change) |
| Legacy `h` mm vs new `hAdop` cm confusion | Form state typed in cm; convert at submit/save boundary with comment |
| Mirror drift concrete/steel | sdd-apply edits both in the same commit |
| Migration overwrites a newer save | Migration only fires when `hAdop === undefined` |

## Rollback Plan

Revert the single commit. Legacy `h` saves still load via the migration, so removing the new code restores the prior behavior with no data loss. The engine never sees the new field.

## Dependencies

`predimCoef` in `slab-calc.ts` must be importable.

## Success Criteria

- [ ] Changing `lx`, `ly`, or any edge updates `h predim (cm)` in the same render.
- [ ] `h adop = 0` ⇒ engine receives the predimensioned value (matches prior `h = 0`).
- [ ] `h adop = 15` ⇒ engine receives `150 mm` regardless of `h predim`.
- [ ] Legacy save with `h` (mm) loads into `h adop` (cm) without losing the value.
- [ ] `+ Nueva` resets `hAdop` to `0` and clears localStorage.
- [ ] `apps/steel` and `apps/concrete` `SlabForm.tsx` remain byte-identical.
- [ ] `npm run lint:all && npm run typecheck:all && npm run build:all` pass.
