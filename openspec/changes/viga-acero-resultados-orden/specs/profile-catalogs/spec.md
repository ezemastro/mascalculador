# Steel Profile Catalogs Specification

## Purpose

Complete the IPN and UPN profile tables so the steel design engine and the
ResultsPage "Características del perfil" table have every field they need:
peso, d, bf, Sy, Zy, rx, and Cw. Internal canonical names stay `h` and
`b`; `d` and `bf` are exposed as UI aliases. No field is allowed to be
empty or silently zeroed.

## Requirements

### Requirement: IPN catalog complete

Every entry in `IPN_PROFILES` MUST include `peso` (kg/m) in addition to the
existing fields. The current rows already include h, b, tw, tf, A, Ix, Sx,
Zx, Iy, ry, J, Cw; `Sy`, `Zy`, and `rx` MUST be added and populated with
tabulated values from the DIN 1025-1 source. Where the existing Cw is
known to be approximate (e.g. IPN 80 = 0.1 cm⁶), the value MUST be replaced
by the tabulated value or flagged as approximate per the no-empty rule.

#### Scenario: All IPN rows have peso, Sy, Zy, rx

- GIVEN the IPN array as exported
- WHEN every entry is enumerated
- THEN `peso`, `Sy`, `Zy`, and `rx` are finite positive numbers for every row

#### Scenario: Existing approximate Cw flagged

- GIVEN the existing IPN 80 entry with `Cw = 0.1`
- WHEN the catalog is updated
- THEN the entry either has the correct tabulated Cw or carries the approximation flag

### Requirement: UPN catalog complete

Every entry in `UPN_PROFILES` MUST include `peso` (kg/m) and `Sx` (cm³)
in addition to the existing fields. The current rows already include h, b,
tw, tf, A, Ix, Iy, rx, ry, xg, Zx, Zy; `Sy`, `J`, and `Cw` MUST be added.
`Sy` and `J` MUST come from tabulated values. `Cw` MAY use the approximation
`Iw = t_f · b_f³ · (d − t_f)² / 4` (CISC/CIRSOC for double-T); when used,
the entry MUST be marked with `cwApprox = true`.

#### Scenario: All UPN rows have peso, Sx, Sy, J, Cw

- GIVEN the UPN array as exported
- WHEN every entry is enumerated
- THEN `peso`, `Sx`, `Sy`, `J`, and `Cw` are finite positive numbers for every row

#### Scenario: UPN Cw approximation flag

- GIVEN a UPN entry whose Cw uses the double-T formula
- WHEN the catalog is exported
- THEN the entry has `cwApprox = true`

### Requirement: h and b remain canonical; d and bf are aliases

The internal field names on `ProfileData` and `UPNData` MUST stay `h` and
`b`. The UI MAY expose them as `d` and `b_f` (or `bf`) by mapping at the
display layer; the engine MUST NOT be changed to use `d`/`bf` internally.
A single mapping helper SHOULD live in `profiles.ts` so any call site that
reads `profile.d` resolves to `profile.h`.

#### Scenario: Alias mapping

- GIVEN a profile with `h = 200` and `b = 90`
- WHEN the UI calls `getD(profile)` and `getBf(profile)`
- THEN it receives 200 and 90 respectively

### Requirement: No empty catalog fields

If a property is genuinely unknown for a profile, the entry MUST carry an
explicit `null` with a `note` field explaining the gap. Silently storing
`0` is forbidden — `0` would falsely indicate a real measurement.

#### Scenario: Unknown field flagged, not zeroed

- GIVEN a profile whose `Cw` is genuinely missing
- WHEN the catalog is updated
- THEN the entry stores `Cw: null` and `CwNote: "valor tabulado no disponible"`

#### Scenario: Zero is rejected as placeholder

- GIVEN a profile whose `Sy = 0` in the legacy data
- WHEN the catalog is updated
- THEN the value is replaced by the tabulated value or removed
