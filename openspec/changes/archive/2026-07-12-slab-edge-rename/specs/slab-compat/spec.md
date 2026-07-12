# Delta for slab-compat

## MODIFIED Requirements

### Requirement: EdgeIndex Type

The system MUST define `type EdgeIndex = 0 | 1 | 2 | 3` mapping to edges (0=Izquierdo, 1=Derecho, 2=Arriba, 3=Abajo).
(Previously: Coordinate-based mapping with X=0, X=L, Y=0, Y=L labels)

- GIVEN a shared edge is identified THEN it MUST be represented as an `EdgeIndex`
- GIVEN `EdgeIndex <= 1` THEN the edge is in the X direction
- GIVEN `EdgeIndex >= 2` THEN the edge is in the Y direction

### Requirement: detectSharedEdge

The system MUST provide a `detectSharedEdge(slabA, slabB)` function that checks facing-edge continuity conditions between two saved slab inputs and returns the detected shared edge pair or null.
(Previously: Dimension-based detection comparing lx/ly values between two SlabInput objects)

- GIVEN slabA has `edges[1]==="continuo"` AND slabB has `edges[0]==="continuo"` AND no other facing pair matches THEN the shared edge is `{ direction: "X", edgeA: 1, edgeB: 0 }`
- GIVEN slabA has `edges[0]==="continuo"` AND slabB has `edges[1]==="continuo"` AND no other facing pair matches THEN the shared edge is `{ direction: "X", edgeA: 0, edgeB: 1 }`
- GIVEN slabA has `edges[3]==="continuo"` AND slabB has `edges[2]==="continuo"` AND no other facing pair matches THEN the shared edge is `{ direction: "Y", edgeA: 3, edgeB: 2 }`
- GIVEN slabA has `edges[2]==="continuo"` AND slabB has `edges[3]==="continuo"` AND no other facing pair matches THEN the shared edge is `{ direction: "Y", edgeA: 2, edgeB: 3 }`
- GIVEN two or more facing-edge continuity pairs are valid THEN detection is ambiguous and returns all candidate pairs
- GIVEN no facing-edge continuity pair is valid THEN detection returns `null`

### Requirement: SlabCompat Screen

The system MUST provide a `/slab-compat` screen with two slab selectors, edge selectors, and a results panel showing ratio, verdict, and computed values.
(Previously: Edge selectors were hidden when detection was unambiguous)

- GIVEN the user navigates to `/slab-compat` THEN saved slabs are loaded in two dropdowns
- GIVEN two slabs are selected THEN `detectSharedEdge` is called
- GIVEN detection returns a single pair THEN edge selectors pre-fill with detected indices AND remain editable
- GIVEN detection is ambiguous THEN edge selectors show all candidates for manual selection
- GIVEN detection returns null THEN edge selectors display default positions
- GIVEN the user clicks "Compatibilizar" THEN the results panel shows the ratio, Mneg values, verdict, and Mcompat or recalculated result
