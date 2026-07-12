# Global Column Check Specification

## Purpose

Verify the built-up column as a macroscopic unit against global buckling per CIRSOC 301, using the full built-up section properties and configurable K.

## Requirements

### Requirement: Global Slenderness

The system MUST compute the global slenderness of the full built-up column.

- GIVEN column height `L` (m), minimum global radius of gyration `r_min` (cm), and effective length factor `K`
- WHEN computing global slenderness
- THEN `λ_global = K × L × 1000 / (r_min × 10)`
- AND `r_min = min(rx, ry)` for T4, or `r_min = rx` for T2

### Requirement: Global Critical Stress

The system MUST compute the global critical buckling stress.

- GIVEN `λ_global` and `Fy`
- WHEN computing global F_cr
- THEN `λc_global = (λ_global / π) × √(Fy / E)`
- AND apply CIRSOC 301 E3: if `λc_global ≤ 1.5` → `0.658^(λc_global²) × Fy`, else `0.877 / λc_global² × Fy`

### Requirement: Global Design Strength

The system MUST compute the global design compressive strength.

- GIVEN `F_cr_global` (MPa), `Atot` (cm²)
- WHEN computing φP_n_global
- THEN `φP_n_global = 0.85 × F_cr_global × Atot × 100 / 1000` (kN)

### Requirement: Global Unity Check

The system MUST verify the full column against global buckling.

- GIVEN total axial load `Pu` (kN) and `φP_n_global` (kN)
- WHEN checking adequacy
- THEN `ratio = Pu / φP_n_global`
- AND SHALL pass when `ratio ≤ 1.00`

### Requirement: T4 Biaxial Global Check

For T4 columns, the system MUST verify global buckling about both principal axes.

- GIVEN T4 column with `rx` and `ry`
- WHEN computing global check
- THEN verify about both x-x and y-y axes
- AND use the worst ratio as the global result
