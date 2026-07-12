# Result Extension Specification

## Purpose

Extend `CartelResult` with a `globalCheck` field for Grupo 4 verification results, ensuring backward compatibility with T1.

## Requirements

### Requirement: GlobalColumnCheck Interface

The system MUST define a `GlobalColumnCheck` interface with Grupo 4 verification results.

- GIVEN T2/T4 column verification
- WHEN producing results
- THEN the system SHALL populate a `GlobalColumnCheck` object containing:
  - `ratio`: global unity check ratio (number)
  - `phiPn`: global design strength in kN (number)
  - `Pu`: total axial load in kN (number)
  - `K`: effective length factor used (number)
  - `lambdaGlobal`: global slenderness ratio (number)
  - `lambdaModified`: modified slenderness λₘ (number)
  - `passes`: whether global check passes (boolean)

### Requirement: CartelResult Extension

The system MUST add `globalCheck?: GlobalColumnCheck` to `CartelResult`.

- GIVEN any `CartelResult`
- WHEN `tipoColumna === 2` or `tipoColumna === 4`
- THEN `globalCheck` SHALL be populated with Grupo 4 results
- AND for `tipoColumna === 1`, `globalCheck` SHALL be `undefined` (backward compatible)

### Requirement: Steps Text Update

The system MUST update the steps text for T2/T4 to document the full Grupo 4 procedure.

- GIVEN T2/T4 verification
- WHEN generating steps text
- THEN include sections for: built-up section properties, modified slenderness, P-Δ amplification, chord verification, diagonal verification, and global column check
- AND the φ_c label SHALL read `0.85`
