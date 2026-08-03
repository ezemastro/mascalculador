# Design: Slab-to-Beam Reaction Transfer

## Technical Approach

Evitar la doble mayoración LRFD separando D y L en las reacciones de losa. `designSlab()` computa reacciones para `qu`, `q_D` (= D + gSelf) y `q_L` (= L) usando closures locales por rama. El adapter `slab-to-beam.ts` mapea borde → `{ deadLoad, liveLoad }`. La UI permite importar desde FormPage (selector de losas guardadas) y desde SlabResults (botón "Enviar a viga").

## Architecture Decisions

### Decision: Reacción D/L mediante closures por rama

**Choice**: Cada rama de cálculo (Kalmanok, unidireccional, voladizo) define un closure `calc(q: number) => [R0,R1,R2,R3]` y lo llama 3 veces: `calc(qu)` para las reacciones factorizadas existentes, `calc(q_D)` para `RD_*`, `calc(q_L)` para `RL_*`.
**Alternatives**: (A) Función global `computeReactions(branch, q, params)` — rechazado porque cada rama tiene distinto shape de coeficientes, obligando a un tagged union complejo. (B) Duplicar cada rama ×3 — rechazado por mantenibilidad.
**Rationale**: El closure captura los coeficientes interpolados una sola vez. Se pasa de ~4 a ~12 líneas por rama. Sin duplicar lógica de branching.

### Decision: Adapter retorna solo D/L, no Load completo

**Choice**: `slabReactionToBeamLoad(result, edge) → { deadLoad, liveLoad } | null`. Retorna `null` para losas legacy.
**Alternatives**: (A) Retornar `Load` completo — rechazado porque `start`/`end` dependen de geometría de la viga. (B) Incluir `lx`/`ly` como default — rechazado, el usuario confirmó start/end manual.
**Rationale**: El adapter traduce losa → carga, la UI construye el `Load`.

### Decision: Importación desde FormPage (flujo principal)

**Choice**: Selector de losa + borde dentro de FormPage como sección "Importar carga de losa". SlabResults tiene botón secundario que navega con estado pre-cargado.
**Alternatives**: Solo desde SlabResults — rechazado porque start/end deben configurarse en contexto de viga.
**Rationale**: Decisión del usuario #3 confirmada.

## Data Model

Nuevos campos en `SlabResult` (definidos en `slab-calc.ts`, reflejados en `types.d.ts`):

```ts
RD_izq: number; RL_izq: number;  // kN/m, sin mayorar
RD_der: number; RL_der: number;
RD_arr: number; RL_arr: number;
RD_aba: number; RL_aba: number;
```

Firma del adapter:

```ts
// client/src/lib/slab-to-beam.ts
import type { SlabResult, EdgeIndex } from "./slab-calc";

export function hasSlabDL(r: SlabResult): boolean {
  return r.RD_izq !== undefined;
}

export function slabReactionToBeamLoad(
  result: SlabResult,
  edge: EdgeIndex,
): { deadLoad: number; liveLoad: number } | null {
  const map: Record<EdgeIndex, [number | undefined, number | undefined]> = {
    0: [result.RD_izq, result.RL_izq],
    1: [result.RD_der, result.RL_der],
    2: [result.RD_arr, result.RL_arr],
    3: [result.RD_aba, result.RL_aba],
  };
  const [rd, rl] = map[edge];
  if (rd === undefined || rl === undefined) return null;
  return { deadLoad: rd, liveLoad: rl };
}
```

## Data Flow

```
designSlab(input)
  q_D = D + gSelf         ← sin mayorar
  q_L = L                 ← sin mayorar
  qu = max(1.4·q_D, 1.2·q_D + 1.6·q_L)

  Para cada rama (Kalmanok o unidireccional):
    calc = (q) => [R_izq, R_der, R_arr, R_aba]  // closure local
    [RxIzq, RxDer, RyArr, RyAba] = calc(qu)     // existente
    [RD_izq, RD_der, RD_arr, RD_aba] = calc(q_D)  // nuevo
    [RL_izq, RL_der, RL_arr, RL_aba] = calc(q_L)  // nuevo

SlabResults ──[Enviar a viga]──→ navigate("/", { slabImport })
FormPage ──[Importar carga]──→ loadSlab(id) → adapter → Load{}
```

## UI Components

- **SlabResults**: Cada una de las 4 tarjetas de reacción gana un botón "Enviar a viga" (habilitado si `hasSlabDL(result)`). Navega a `/` con `location.state = { slabImport: { slabId, savedName, edge, deadLoad, liveLoad } }`.
- **FormPage**: Nueva sección colapsable "Importar carga de losa" entre cargas y dimensionamiento:
  - `<select>` de losas desde `getSavedSlabs()`
  - `<select>` de borde (4 opciones). Deshabilitado si losa legacy → warning "Recalcular primero — D/L no disponible"
  - Botón "Agregar carga" (habilitado solo con losa+borde válidos). Crea `Load { id, type:"distributed", deadLoad, liveLoad, start:0, end:totalLength }` y appendea a `loads[]`.
  - Si `location.state.slabImport` existe al montar, auto-selecciona la losa y pre-llena, permitiendo al usuario ajustar start/end.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/src/lib/slab-calc.ts` | Modify | +8 campos en `SlabResult`; calcular `q_D`/`q_L`; closures `calc(q)` ×12 ramas |
| `client/src/types.d.ts` | Modify | Declarar los 8 campos D/L en interfaz `SlabResult` |
| `client/src/lib/slab-to-beam.ts` | **Create** | `hasSlabDL()`, `slabReactionToBeamLoad()` |
| `client/src/screens/SlabResults.tsx` | Modify | Botón "Enviar a viga" por borde |
| `client/src/screens/FormPage.tsx` | Modify | Sección "Importar carga de losa" + handler `location.state.slabImport` |

## Migration

- **Losas legacy**: `RD_*`/`RL_*` retornan `undefined` vía `JSON.parse` (sin campos). `hasSlabDL()` → `false`, adapter → `null`, UI deshabilita importación con warning.
- **Sin migración de datos**: nuevos campos son aditivos. `saveSlab()` serializa automáticamente.
- **Rollback**: revertir commit. Campos factorizados intactos. Botones nuevos no rompen flujo existente.

## Risks

| Risk | Mitigation |
|------|------------|
| `q_D` incluye `gSelf` (correcto: peso propio es carga permanente) | Documentado; gSelf → deadLoad, nunca liveLoad |
| Errores de mapeo en closures (coeficiente → borde incorrecto) | Closures inline mantienen lógica visible; tests de borde por rama |
| Colisión `slabImport` vs `lastFormState` en FormPage | `slabImport` tiene prioridad sobre `lastFormState` |
| Diff grande en `slab-calc.ts` (~100 líneas nuevas) | Closures locales minimizan diff; sin refactor estructural |
