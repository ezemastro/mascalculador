# Viga Continua Analysis Specification

## Purpose

Analysis-only continuous-beam tool: given spans (1–5), support types, and D/L loads (point and distributed), compute support reactions (D/L, unfactored), the factored shear envelope (Vu), the factored moment envelope (Mu+ per span, Mu− per interior support), and render Mafs diagrams. No reinforced-concrete design.

## Requirements

### Requirement: Span Count Input (1–5)

The form MUST accept a span count from 1 to 5. The value 5 MUST be selectable.

#### Scenario: Five spans selectable

- GIVEN the form's span-count selector
- WHEN the user chooses 5
- THEN 5 span-length fields and 6 support entries are shown

### Requirement: Span Lengths and Support Types

Each span MUST have a length greater than zero. The system MUST provide exactly `spanCount + 1` supports. Each support MUST have one of the types articulado, empotrado, or libre. The "libre" type MUST be available only at the two end supports.

#### Scenario: Interior support cannot be libre

- GIVEN a support that is not an end support
- WHEN its type selector is rendered
- THEN "libre" is not an option

#### Scenario: End supports may be libre

- GIVEN the first or last support
- WHEN its type selector is rendered
- THEN "libre" is available

### Requirement: Load Input with D and L

The system MUST support point and distributed loads, each carrying a dead (D) and live (L) value. The envelope MUST use the factored combination U = 1.2·D + 1.6·L.

#### Scenario: Point load D/L

- GIVEN a point load with D and L values
- WHEN the envelope is computed
- THEN its contribution uses 1.2·D + 1.6·L

#### Scenario: Distributed load D/L

- GIVEN a distributed load with D and L values over one or more spans
- WHEN the envelope is computed
- THEN its contribution uses 1.2·D + 1.6·L

### Requirement: Support Reactions (Unfactored D and L)

The results MUST show, per support, the dead-load reaction and the live-load reaction separately and unfactored.

#### Scenario: Unfactored reactions returned

- GIVEN an analysis run
- WHEN results render
- THEN each support shows a D reaction and an L reaction
- AND neither is multiplied by a load factor

### Requirement: Shear and Moment Envelopes

The results MUST provide the factored shear envelope Vu and the factored moment envelope Mu, including positive moment per span and negative moment at each interior support.

#### Scenario: Vu and Mu computed

- GIVEN an analysis run with live-load patterning enabled
- WHEN results render
- THEN `spanVu` shows max Vu per span
- AND `spanMuPos` shows Mu+ per span
- AND `supportMuNeg` shows Mu− per interior support

### Requirement: Diagram Rendering

The results MUST render shear and moment diagrams using Mafs.

#### Scenario: Mafs diagrams render

- GIVEN a computed envelope
- WHEN `VigaContinuaResults` renders
- THEN Mafs shear and moment diagrams are drawn across the beam length

### Requirement: Analysis-Only (No RC Design)

The page MUST NOT collect RC section inputs (f'c, fy, section dimensions, As) and MUST NOT emit RC design outputs (As, f'c, fy, shear steel, top steel).

#### Scenario: No section inputs

- GIVEN `VigaContinuaForm`
- WHEN inspected
- THEN no f'c, fy, section, or steel inputs are present

#### Scenario: No design outputs

- GIVEN `VigaContinuaResults`
- WHEN inspected
- THEN no As, f'c, fy, shear-steel, or top-steel values are shown

### Requirement: Factored vs Unfactored Labeling

Factored envelope results MUST be labeled as factored (U = 1.2·D + 1.6·L) and reactions MUST be labeled as unfactored, so values are not misread.

#### Scenario: Envelope labeled factored

- GIVEN the results screen
- WHEN rendering envelope values and diagrams
- THEN they are labeled with the U combination (1.2·D + 1.6·L)

#### Scenario: Reactions labeled unfactored

- GIVEN the results screen
- WHEN rendering reactions
- THEN they are labeled unfactored (sin factorar)

### Requirement: Reuse Shared Solver

The system MUST reuse `packages/shared/src/beam-analysis.ts` and `apps/concrete/src/lib/beam-envelope.ts` (`calculateBeamEnvelope`). It MUST NOT duplicate the three-moment solver.

#### Scenario: Envelope computed via shared lib

- GIVEN a submitted form
- WHEN results are computed
- THEN `calculateBeamEnvelope(spans, supportTypes, loads, 0)` is called with self-weight 0

### Requirement: No Persistence and No Self-Weight Toggle

Version 1 MUST NOT persist results, MUST NOT integrate downstream (beam reactions), and MUST NOT expose a self-weight toggle. Dead self-weight MUST be entered as an explicit D load.

#### Scenario: No save

- GIVEN the analysis page
- WHEN inspected
- THEN no save/persistence control is present

#### Scenario: No self-weight toggle

- GIVEN the form
- WHEN inspected
- THEN there is no self-weight toggle
- AND dead load is entered as a D load
