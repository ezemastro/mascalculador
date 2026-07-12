# Delta for Slab Analysis

## ADDED Requirements

### Requirement: Negative Moment Exposure

The `DirectionResult` interface MUST include an optional `Mneg` field. The system MUST populate `Mneg` when the direction has a continuous or fixed edge condition and MUST leave it undefined for simple-supported edges.

- GIVEN a direction has a "continuo" or "empotrado" edge WHEN `designDir()` runs THEN `Mneg` is populated with the negative moment value
- GIVEN a direction has an "apoyo simple" edge WHEN `designDir()` runs THEN `Mneg` is undefined
- GIVEN a slab result with Mneg populated is saved via `saveSlab()` THEN the persisted record includes Mneg
