# Chord Verification Specification

## Purpose

Verify each chord of the built-up column against axial compression per CIRSOC 301 Section E3 with φ_c = 0.85, replacing the simplified N_chord = M / h method.

## Requirements

### Requirement: Chord Slenderness Parameter λ_c

The system MUST compute the slenderness parameter for each chord angle.

- GIVEN panel height `aCol` (m), minimum radius of gyration `rz` (cm), yield stress `Fy` (MPa), and modulus `E = 200000 MPa`
- WHEN computing λ_c
- THEN `λ_c = (aCol × 1000 / (rz × 10 × π)) × √(Fy / E)`

### Requirement: Critical Stress F_cr

The system MUST compute the critical buckling stress per CIRSOC 301 E3.

- GIVEN `λ_c`
- WHEN computing F_cr
- THEN if `λ_c ≤ 1.5`: `F_cr = 0.658^(λ_c²) × Fy`
- AND if `λ_c > 1.5`: `F_cr = 0.877 / λ_c² × Fy`

### Requirement: Design Strength φP_n

The system MUST compute the design compressive strength with φ_c = 0.85.

- GIVEN `F_cr` (MPa), angle area `A_angle` (cm²)
- WHEN computing φP_n
- THEN `φP_n = 0.85 × F_cr × A_angle × 100 / 1000` (kN)

### Requirement: Unity Check

The system MUST verify the chord passes the unity check.

- GIVEN chord force `Pu1` (kN) and `φP_n` (kN)
- WHEN checking adequacy
- THEN compute `ratio = Pu1 / φP_n`
- AND SHALL pass when `ratio ≤ 1.00`
