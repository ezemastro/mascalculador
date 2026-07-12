# Slab Compatibilization Specification

## Purpose

Provide post-hoc compatibilización of support moments between two independently-designed adjacent RC slabs per CIRSOC 201-05. The tool detects the shared edge between two saved slabs and applies compatibility rules (ratio threshold averaging or simple-support recalculation).

## Requirements

### Requirement: EdgeIndex Type

The system MUST define `type EdgeIndex = 0 | 1 | 2 | 3` mapping to edges (0=Izquierdo, 1=Derecho, 2=Arriba, 3=Abajo).

- GIVEN a shared edge is identified THEN it MUST be represented as an `EdgeIndex`
- GIVEN `EdgeIndex <= 1` THEN the edge is in the X direction
- GIVEN `EdgeIndex >= 2` THEN the edge is in the Y direction

### Requirement: detectSharedEdge

The system MUST provide a `detectSharedEdge(slabA, slabB)` function that checks facing-edge continuity conditions between two saved slab inputs and returns the detected shared edge pair or null.

- GIVEN slabA has `edges[1]==="continuo"` AND slabB has `edges[0]==="continuo"` AND no other facing pair matches THEN the shared edge is `{ direction: "X", edgeA: 1, edgeB: 0 }`
- GIVEN slabA has `edges[0]==="continuo"` AND slabB has `edges[1]==="continuo"` AND no other facing pair matches THEN the shared edge is `{ direction: "X", edgeA: 0, edgeB: 1 }`
- GIVEN slabA has `edges[3]==="continuo"` AND slabB has `edges[2]==="continuo"` AND no other facing pair matches THEN the shared edge is `{ direction: "Y", edgeA: 3, edgeB: 2 }`
- GIVEN slabA has `edges[2]==="continuo"` AND slabB has `edges[3]==="continuo"` AND no other facing pair matches THEN the shared edge is `{ direction: "Y", edgeA: 2, edgeB: 3 }`
- GIVEN two or more facing-edge continuity pairs are valid THEN detection is ambiguous and returns all candidate pairs
- GIVEN no facing-edge continuity pair is valid THEN detection returns `null`

### Requirement: compatibilizeSlabs

The system MUST provide a `compatibilizeSlabs(slabA, slabB, edgeA, edgeB)` function that implements the CIRSOC 201-05 compatibility rules. It must return a `CompatResult` with the ratio, verdict, and either an averaged moment or a recalculated result.

- GIVEN `ratio = min(MnegA, MnegB) / max(MnegA, MnegB) >= 0.6` THEN `Mcompat = (MnegA + MnegB) / 2`
- GIVEN `ratio < 0.6` THEN the weaker slab's edge is changed to `"simple"` and `designSlab()` is re-run
- GIVEN a slab is recalculated THEN the function returns the new `SlabResult` as `recalculatedResult`

### Requirement: SlabCompat Screen

The system MUST provide a `/slab-compat` screen with two slab selectors, edge selectors, and a results panel showing ratio, verdict, and computed values.

- GIVEN the user navigates to `/slab-compat` THEN saved slabs are loaded in two dropdowns
- GIVEN two slabs are selected THEN `detectSharedEdge` is called
- GIVEN detection returns a single pair THEN edge selectors pre-fill with detected indices AND remain editable
- GIVEN detection is ambiguous THEN edge selectors show all candidates for manual selection
- GIVEN detection returns null THEN edge selectors display default positions
- GIVEN the user clicks "Compatibilizar" THEN the results panel shows the ratio, Mneg values, verdict, and Mcompat or recalculated result

### Requirement: Route and Navigation

The system MUST register `/slab-compat` as a route in the router and add a NavBar link with label "Compat. Losas".

- GIVEN the user enters `/slab-compat` in the browser THEN the SlabCompat screen renders
- GIVEN the NavBar is displayed THEN a "Compat. Losas" link navigates to `/slab-compat`
