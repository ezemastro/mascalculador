# Proposal: Viga Continua — Continuous Beam Structural Analysis

## Intent

Engineers need a quick continuous-beam **analysis-only** tool — reactions (D/L), shear envelope (V), moment envelope (M) — without the RC design noise of "Viga H°". The solver already computes this; a dedicated lightweight page is needed to surface it and raise the span cap from 4 to 5.

## Scope

### In Scope
- New screens `VigaContinuaForm.tsx` + `VigaContinuaResults.tsx` (analysis-only), reusing the shared solver + `calculateBeamEnvelope`.
- Routes `/viga-continua` + `/viga-continua-results`; navbar link "Viga Continua".
- Span count **1–5** (raise UI cap from 4).
- Results: reactions D/L (unfactored), Vu envelope, Mu+ per span, Mu− per interior support, Mafs diagrams. Spanish UI copy.

### Out of Scope
- RC section design (no As, no f'c/fy, no `designConcreteDetailed`), persistence/save, downstream integration, settlement/hinges/redistribution, self-weight toggle.

## Capabilities

### New Capabilities
- `viga-continua-routing`: routes + navbar link.
- `viga-continua-analysis`: analysis-only form/results; envelope reuse; 5 spans.

### Modified Capabilities
None.

## Approach

Clone the Viga H° two-screen flow minus RC inputs. Form collects spans (1–5), `supportTypes`, D/L loads (point/distributed); no section, no self-weight toggle (pass `selfWeight = 0`; dead weight entered as a D load). Submit → `navigate("/viga-continua-results", { state })`. Results call `calculateBeamEnvelope(spans, supportTypes, loads, 0)` and render `reactionsD/L`, `spanVu`, `spanMuPos`, `supportMuNeg`, plus Mafs diagrams.

**Why a separate page, not a mode flag**: Viga H° is a CIRSOC *design* tool with section/rebar state threaded through form→results→save→"Volver". A mode flag would spread conditionals across both screens and the save schema. A dedicated page keeps analysis clean and stateless.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/concrete/src/screens/VigaContinuaForm.tsx` | New | Analysis-only form |
| `apps/concrete/src/screens/VigaContinuaResults.tsx` | New | Envelope results + Mafs |
| `apps/concrete/src/main.tsx` | Modified | Navbar link + 2 routes |
| `apps/concrete/src/lib/beam-envelope.ts` | Reused | No change (0 self-weight) |
| `packages/shared/src/beam-analysis.ts` | Reused | No change (n-span generic) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Mafs envelope unreadable at 5 spans | Med | Reuse existing diagram component; cap sampling; verify visually |
| Duplicating load-shape editor logic | Med | Extract shared load-editor or copy ConcreteForm blocks verbatim |
| Factored envelopes misread as service values | Low | Label diagrams "U=1.2D+1.6L"; reactions shown unfactored |

## Rollback Plan

Revert the `main.tsx` diff and delete the two new screens. Fully additive — no shared/data changes.

## Success Criteria

- [ ] `/viga-continua` renders; navbar shows "Viga Continua".
- [ ] 5-span input accepted; envelope computed (2⁵=32 patterns) without error.
- [ ] Results show reactions D/L, Vu, Mu+/Mu−, Mafs diagrams; no RC output.
- [ ] `npm run lint` + `tsc -b` + build pass.
