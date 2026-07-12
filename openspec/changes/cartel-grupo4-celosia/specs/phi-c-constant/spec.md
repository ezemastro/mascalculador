# φ_c Constant Change Specification

## Purpose

Update the resistance factor φ_c from 0.90 to 0.85 in `checkAngleCompForce()` and all UI references, aligning with CIRSOC 301 Grupo 4 requirements.

## Requirements

### Requirement: φ_c in checkAngleCompForce

The system MUST change φ_c from 0.90 to 0.85 in the `checkAngleCompForce()` function.

- GIVEN any angle compression verification call (chord, diagonal, montante)
- WHEN computing `φP_n`
- THEN `φP_n = 0.85 × F_cr × A_angle × 100 / 1000` (kN)
- AND this SHALL affect all callers: T2, T4, and any other consumer of `checkAngleCompForce`

### Requirement: UI Text Update

The system SHOULD update UI text in Results and Print pages to reflect φ_c = 0.85.

- GIVEN the Results page (`CartelResults.tsx`) and Print page (`CartelPrintPage.tsx`)
- WHEN displaying verification text for T2/T4 columns
- THEN display `"φ_c = 0.85"` instead of `"φ_c = 0.90"`
- AND update the steps text header from `"φ_c = 0.90"` to `"φ_c = 0.85"`

### Requirement: T1 Unchanged

The T1 IPN flexocompression path MUST remain unaffected by this change.

- GIVEN `tipoColumna === 1`
- WHEN computing verification
- THEN `φ_c = 0.85` and `φ_b = 0.90` per existing flexocompression behavior (no change)
