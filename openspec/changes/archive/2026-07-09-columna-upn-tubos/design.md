# Design: Columna UPN Simple y Caños Estructurales

## Technical Approach

Add two profile-type dispatch branches to ColumnForm/ColumnResults. Zero changes to `designColumn()` — it receives geometric properties agnostically. New `tube-profiles.ts` precomputes properties from hollow rectangle formulas. UPN single reuses existing `UPN_PROFILES` tabulated data directly.

## Architecture Decisions

### Decision: New tube-profiles.ts vs extending profiles.ts

| Option | Decision |
|--------|----------|
| Merge into profiles.ts | Rejected — TubeData has different interface (h, b, t vs h, b, tw, tf, J, Cw) |
| New tube-profiles.ts | **Chosen** — separate file for separate profile family, matches existing pattern (ipn in profiles.ts, upn in upn-profiles.ts) |

### Decision: UPN single reuses upnName field

| Option | Decision |
|--------|----------|
| Add new `singleUpnName` field | Rejected — overcomplicates ColumnState for a single extra type |
| Reuse `upnName`, ignore `upnGap` | **Chosen** — UPN single and 2UPN are mutually exclusive via profileType, no conflict |

### Decision: Tube properties precomputed at module level

| Option | Decision |
|--------|----------|
| Compute at runtime in ColumnResults | Rejected — violates existing pattern (IPN/UPN tables are static data) |
| Precompute in tube-profiles.ts | **Chosen** — TUBE_PROFILES array of TubeData, compute function is internal |

## Data Flow (unchanged)

```
ColumnForm → navigate(/column-results, { state: ColumnState })
ColumnResults → extract Ag, Ix, Iy, Zx, Zy from profile table
             → designColumn(input, Ag, Ix, Iy, Zx, Zy, profileName)
             → render results
```

## Profile Resolution by Type

```
IPN  → IPN_PROFILES.find(p => p.name === profileName)
UPN  → UPN_PROFILES.find(p => p.name === upnName)
2UPN → getDoubleUPN(UPN_PROFILES.find(...), upnGap)
TUBO → TUBE_PROFILES.find(p => p.name === tubeName)
```

Ag, Ix, Iy, Zx, Zy read directly from the matched object. UPN single needs no wrapper — UPNData already has all five properties.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/src/lib/tube-profiles.ts` | **Create** | TubeData interface + computeTubeProperties() + TUBE_PROFILES (SHS □ 50×50 to 300×300, RHS 100×50 to 300×200, ~65 profiles) |
| `client/src/screens/ColumnForm.tsx` | Modify | Extend profileType union, add UPN/TUBO options and conditional dropdowns |
| `client/src/screens/ColumnResults.tsx` | Modify | Add UPN and TUBO dispatch branches |
| `client/src/lib/column-calc.ts` | **None** | Profile-agnostic engine, zero changes |

## ColumnForm Changes Detail

1. `ColumnState.profileType`: `"IPN" | "UPN" | "2UPN" | "TUBO"`
2. Add `tubeName?: string` to ColumnState
3. Profile selector: `<option>` for UPN single, `<option>` for TUBO
4. UPN branch: UPN_PROFILES dropdown (no gap input)
5. TUBO branch: TUBE_PROFILES dropdown with `<optgroup label="SHS">` and `<optgroup label="RHS">`
6. handleSubmit includes `tubeName` in state

## ColumnResults Changes Detail

1. Destructure `tubeName` from state
2. Add `else if (profileType === "UPN")` — read upn.A, upn.Ix, upn.Iy, upn.Zx, upn.Zy directly
3. Add `else if (profileType === "TUBO")` — read tube.A, tube.Ix, tube.Iy, tube.Zx, tube.Zy
4. Existing IPN and 2UPN branches unchanged

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Type check | New types, imports, exhaustive switch | `tsc -b` — strict mode catches missing branches |
| Manual | UPN 200, L=3000, Pu=100 → verify φPn | Smoke test against hand-calc |
| Manual | TUBO □ 100×100×4, same conditions → props within 1% | Verify precomputation formulas |
| Regression | IPN and 2UPN produce same results as before | Visual comparison |

No test runner available. TypeScript strict mode + manual verification only.

## Migration / Rollout

No migration required. Feature is additive — new options in existing dropdown. Rollback: git revert.

## Open Questions

- None. All profile data is standardized (DIN 1026 for UPN, EN 10219 geometry formulas for tubes).
