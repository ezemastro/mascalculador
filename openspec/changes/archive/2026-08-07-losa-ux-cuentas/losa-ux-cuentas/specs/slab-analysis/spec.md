# Delta for slab-analysis

## MODIFIED Requirements

### Requirement: Support Compatibilización

Continuous edges MUST undergo momento compatibilización. When adjacent edges are "continuo", compare moments from each slab at the shared support. When M_support_2 / M_support_1 ≥ 0.6, average both moments. When < 0.6, re-calc treating the support as simple (not fixed). The per-edge continuity validation result (`continuidad validada` or `⚠️ no cumple continuidad — revisar`) MUST be documented in `steps` for every continuous edge. The `steps` array MUST NOT contain any placeholder message claiming the support is treated as a perfect fixed support when no adjacent slab data is available.

#### Scenario: M2/M1 ≥ 0.6 averages support moments

- GIVEN two adjacent continuous edges with `M₂/M₁ ≥ 0.6`
- WHEN compatibilización is performed
- THEN the support moments from both slabs are averaged

#### Scenario: M2/M1 < 0.6 re-calcs as simple support

- GIVEN two adjacent continuous edges with `M₂/M₁ < 0.6`
- WHEN compatibilización is performed
- THEN the affected direction is re-calculated with simple support assumption (not fixed)

#### Scenario: Continuity decision logged in steps

- GIVEN compatibilización is performed
- WHEN `steps` is built
- THEN the ratio and the resulting decision (average vs re-calc) are appended to the array

#### Scenario: Steps must not contain the legacy placeholder

- GIVEN `designSlab()` is called with at least one "continuo" edge AND no adjacent slab data is provided
- WHEN the resulting `SlabResult.steps` is inspected
- THEN the array MUST NOT contain the string `"se asume empotramiento perfecto"` or any equivalent placeholder claiming a perfect fixed-support assumption
- AND the only honesty about continuity is the per-edge `continuidad validada` / `⚠️ no cumple continuidad — revisar` line already mandated above

(Reason: the legacy log line is a misleading trace. Per-edge continuity validation is the only honest output of this stage when no adjacent slab is provided. `SlabCompat` has its own UI warning for the multi-slab case.)

## REMOVED Requirements

### Requirement: Compatibilización siempre ejecuta empotramiento perfecto

The system MUST log "se asume empotramiento perfecto" in `steps` whenever a continuous edge has no adjacent slab data.

(Reason: the message is misleading — `designSlab()` does not actually invoke any compatibilization with adjacent slabs; it merely proceeds with the user-configured edge condition. The per-edge continuity validation already provides the honest diagnostic. The message was removed and its absence is now enforced by the modified "Support Compatibilización" requirement.)
