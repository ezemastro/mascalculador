# Diagonal Verification Specification

## Purpose

Verify diagonal braces in the truss panel against axial compression from shear forces, using CIRSOC 301 Grupo 4 β amplification with φ_c = 0.85.

## Requirements

### Requirement: β Coefficient

[NEEDS CLARIFICATION] The system MUST compute the β coefficient per CIRSOC 301. The formula `β = (p / 400) × (1 / (1 − Pu / P_cm))` is proposed, but parameter `p` requires clarification — it is unclear whether `p` refers to π, Pu, nPaneles, or another value. This MUST be resolved before implementation.

- GIVEN the resolved β formula
- WHEN computing diagonal shear
- THEN β SHALL be computed per the clarified CIRSOC 301 clause

### Requirement: Diagonal Shear Force

The system MUST compute the shear force in the truss panel amplified by β.

- GIVEN `β` and `Qx` (shear force at the section)
- WHEN computing diagonal force
- THEN `Veu = β × Qx` (kN)

### Requirement: Diagonal Axial Force

The system MUST convert panel shear to diagonal axial force using the truss geometry.

- GIVEN `Veu` (kN), `hCol` (m), `dDiag` (m)
- WHEN computing diagonal axial force
- THEN `Nu_dig = Veu / sinα` where `sinα = hCol / dDiag`, if `sinα > 0`
- AND if `sinα = 0`, `Nu_dig = Veu`

### Requirement: Diagonal Buckling Check

The system MUST verify the diagonal against buckling per CIRSOC 301 E3 with φ_c = 0.85.

- GIVEN diagonal length `dDiag` (m), angle `rz` (cm), `Fy`, `A_angle`, and `Nu_dig`
- WHEN computing diagonal verification
- THEN apply the same λ_c / F_cr / φP_n procedure as chord verification
- AND use `L = dDiag × 1000` (mm) as the buckling length
- AND `φ_c = 0.85`
- AND `ratio = Nu_dig / φP_n ≤ 1.00`
