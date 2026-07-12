# Modified Slenderness Specification

## Purpose

Compute the modified slenderness ratio λ_m per CIRSOC 301 Grupo 4 for built-up columns, combining global and local chord buckling.

## Requirements

### Requirement: Global Slenderness λ₀

The system MUST compute the global slenderness ratio of the built-up column.

- GIVEN column height `L` (m), radius of gyration `rx` (cm), and effective length factor `K`
- WHEN computing global slenderness
- THEN `λ₀ = K × L × 1000 / (rx × 10)`
- AND `K` SHALL be configurable by the user (default based on CIRSOC 301, range 0.65–1.0 depending on boundary conditions)

### Requirement: Local Chord Slenderness λ₁

The system MUST compute the local slenderness ratio of each chord between panel nodes.

- GIVEN panel height `aCol` (m) and minimum radius of gyration `rz` (cm) of the chord angle
- WHEN computing local slenderness
- THEN `λ₁ = aCol × 1000 / (rz × 10)`

### Requirement: Modified Slenderness λₘ

The system MUST combine global and local slenderness into the modified value.

- GIVEN `λ₀` and `λ₁`
- WHEN computing modified slenderness
- THEN `λₘ = √(λ₀² + λ₁²)`

### Requirement: Validation

The system MUST validate inputs before slenderness computation.

- GIVEN `rx = 0`
- WHEN computing λ₀
- THEN throw error or return `KLr = 999`

- GIVEN `rz = 0`
- WHEN computing λ₁
- THEN throw error or return `KLr = 999`
