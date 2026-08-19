# Delta for slab-to-beam-adapter

## ADDED Requirements

### Requirement: Load id generated internally

The `slabReactionToBeamLoad` function MUST return a `Load` with a non-empty `id` string. The implementation MUST generate the `id` internally using `crypto.randomUUID()`; the function MUST NOT require an `id` parameter.

#### Scenario: id present in returned Load

- GIVEN a `SlabResult` with all 8 `RD_<edge>` / `RL_<edge>` fields populated
- WHEN `slabReactionToBeamLoad(result, "izq", 0, 4)` is called
- THEN the returned `Load` has a non-empty `id` string (length > 0)

#### Scenario: id uniqueness across calls

- GIVEN two consecutive calls with identical inputs
- WHEN the results are compared
- THEN the two `Load.id` values MUST differ (each call produces a fresh `id` from `crypto.randomUUID()`)

#### Scenario: id format is a UUID

- GIVEN a call to `slabReactionToBeamLoad`
- WHEN the returned `Load.id` is inspected
- THEN the string MUST match the canonical 8-4-4-4-12 hex UUID format produced by `crypto.randomUUID()`

### Requirement: Non-negative output for D and L

Both `deadLoad` and `liveLoad` in the returned `Load` MUST be non-negative finite numbers. Negative values MUST be clamped to zero.

#### Scenario: Negative RD clamped to zero

- GIVEN `RD_izq = -2.0`
- WHEN `slabReactionToBeamLoad(result, "izq", 0, 4)` is called
- THEN the returned `Load` has `deadLoad = 0`

#### Scenario: Negative RL clamped to zero

- GIVEN `RD_izq = 2.5, RL_izq = -1.0` (negative live reaction)
- WHEN `slabReactionToBeamLoad(result, "izq", 0, 4)` is called
- THEN the returned `Load` has `deadLoad = 2.5` AND `liveLoad = 0`

#### Scenario: Both D and L negative clamp to zero

- GIVEN `RD_izq = -2.0, RL_izq = -3.0` (both negative)
- WHEN `slabReactionToBeamLoad(result, "izq", 0, 4)` is called
- THEN the returned `Load` has `deadLoad = 0` AND `liveLoad = 0`

#### Scenario: NaN/Infinity rejected upstream

- GIVEN a `SlabResult` with `RD_izq = NaN` or `Infinity`
- WHEN `slabReactionToBeamLoad(result, "izq", 0, 4)` is called
- THEN it MUST return `null` (defensive — legacy slabb `undefined` already returns `null`)

### Requirement: No UI integration in this change

The `slabReactionToBeamLoad` function MUST be exported and conform to the contract above. There MUST NOT be any UI component, route, or control in this change that invokes `slabReactionToBeamLoad`. A future change will introduce the viga-acero integration that consumes this function.

#### Scenario: No invocations in apps/concrete

- GIVEN a textual search across `apps/concrete/src`
- WHEN looking for `slabReactionToBeamLoad` references
- THEN the only references MUST be:
  - The function definition in `apps/concrete/src/lib/slab-to-beam.ts`
  - The `hasSlabDL` helper in the same file
  - Any test fixture (none in this change)

#### Scenario: No invocations in apps/steel (mirror)

- GIVEN a textual search across `apps/steel/src`
- WHEN looking for `slabReactionToBeamLoad` references
- THEN the only references MUST be the function definition in the mirrored `apps/steel/src/lib/slab-to-beam.ts` and the `hasSlabDL` helper

#### Scenario: No new screen imports the adapter

- GIVEN any new screen or component introduced in this change
- WHEN the imports are inspected
- THEN `slabReactionToBeamLoad` MUST NOT appear in any import statement outside `slab-to-beam.ts` itself (in either app)

### Requirement: Implementation matches spec signature

The exported function signature MUST be exactly:
`slabReactionToBeamLoad(result: SlabResult, edge: "izq" | "der" | "arr" | "aba", start: number, end: number): Load | null`

The returned `Load` MUST have:
- `type: "distributed"` (literal type)
- `deadLoad: number` (≥ 0, finite)
- `liveLoad: number` (≥ 0, finite)
- `start: number` (echoes the input)
- `end: number` (echoes the input)
- `id: string` (non-empty, generated internally via `crypto.randomUUID()`)

The legacy signature `slabReactionToBeamLoad(result: SlabResult, edge: 0 | 1 | 2 | 3)` returning `{ deadLoad, liveLoad } | null` MUST be removed.

#### Scenario: Edge parameter accepts string literals

- GIVEN a call with `edge: "izq"`
- WHEN TypeScript compiles
- THEN no type error is raised
- AND the call resolves `RD_izq` / `RL_izq` from the result

#### Scenario: Edge parameter accepts all four string literals

- GIVEN calls with `edge: "der"`, `edge: "arr"`, `edge: "aba"` respectively
- WHEN TypeScript compiles
- THEN no type error is raised for any of the four literals
- AND each call resolves its corresponding `RD_<edge>` / `RL_<edge>` pair

#### Scenario: Legacy numeric edge rejected

- GIVEN a call with `edge: 0` (numeric)
- WHEN TypeScript compiles
- THEN a type error IS raised (the function no longer accepts numeric edges)

#### Scenario: Return type is Load | null

- GIVEN any valid call
- WHEN TypeScript inspects the return type
- THEN the return type MUST be `Load | null` (not `{ deadLoad, liveLoad } | null`)
- AND `Load.type` MUST be the literal `"distributed"`

#### Scenario: Backward compat — legacy slab still returns null

- GIVEN a `SlabResult` loaded from `loadSlab()` where any `RD_<edge>` / `RL_<edge>` is `undefined`
- WHEN `slabReactionToBeamLoad(result, "izq", 0, 4)` is called
- THEN the function returns `null` (same behavior as the legacy signature, so the future viga-acero consumer can rely on the same null guard)
