# Proposal: Transferir Reacciones de Losa a Viga

## Intent

Evitar la **doble mayoración** al pasar reacciones de losa a viga. Hoy las reacciones (RxIzq, etc.) se calculan con `qu` combinado (LRFD: max(1.4·D_total, 1.2·D_total + 1.6·L)). Si esas reacciones se ingresan como carga en una viga que también aplica LRFD (`1.2·D + 1.6·L`), los factores se aplican dos veces — inseguro. Solución: separar D y L en las reacciones de losa y transferirlas como `deadLoad`/`liveLoad` puras al módulo de vigas.

## Scope

### In Scope
- Calcular reacciones D y L **sin mayorar** en `designSlab()`, exponiendo 8 campos nuevos: `RD_izq`, `RL_izq`, `RD_der`, `RL_der`, `RD_arr`, `RL_arr`, `RD_aba`, `RL_aba`
- Adapter `slab-to-beam.ts`: convierte `SlabResult` + borde → `Load { type: "distributed", deadLoad, liveLoad }`
- UI en `SlabResults.tsx`: botón "Enviar reacciones a viga" que navega a FormPage con carga pre-armada
- UI en `FormPage.tsx`: sección/selección de losa guardada + borde que genera carga automáticamente

### Out of Scope
- Actualización automática de carga cuando la losa se recalcula (el usuario re-importa manualmente)
- Importar desde losas no guardadas (solo localStorage)
- Sincronización bidireccional losa ↔ viga
- Compatibilización de apoyos entre losa y viga

## Capabilities

### New Capabilities
- `slab-dl-reactions`: reacciones D/L separadas por borde en `SlabResult`
- `slab-to-beam-adapter`: conversión `SlabResult` → `Load[]` para vigas

### Modified Capabilities
- `slab-analysis`: extender `designSlab()` para computar reacciones sin mayorar en paralelo a `qu`
- `slab-persistence`: nuevos campos se serializan automáticamente; legacy loads devuelven `undefined`

## Approach

1. **Refactor `designSlab()`**: en cada rama de cálculo de reacciones, computar además con `q_D = D_total` y `q_L = L` (sin mayorar). Las reacciones existentes con `qu` se preservan. Esto implica duplicar las fórmulas de reacción en ~7 ramas (Kalmanok + unidireccional).
2. **Extender `SlabResult`**: 8 campos nuevos: `RD_izq, RL_izq, …, RL_aba`. Total fields: de 22 a 30.
3. **Crear `lib/slab-to-beam.ts`**: función `slabReactionToBeamLoad(result, edge, start, end)` → `Load`.
4. **UI SlabResults**: botón que guarda `{ slabId, edge, loads }` en navigation state y navega a `/`.
5. **UI FormPage**: detecta navigation state con slab import; agrega `Load` automáticamente con los campos D/L pre-llenados. También permite seleccionar losa desde el listado de guardadas sin salir de FormPage.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/slab-calc.ts` | Modified | Reacciones D/L en cada rama de cálculo |
| `types.d.ts` | Modified | +8 campos en `SlabResult` |
| `lib/slab-to-beam.ts` | **New** | Adapter de conversión |
| `screens/SlabResults.tsx` | Modified | Botón "Enviar a viga" |
| `screens/FormPage.tsx` | Modified | Sección "Importar carga de losa" |
| `lib/storage.ts` | Unchanged | Serialización automática vía JSON |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| D_total incluye peso propio (gSelf), pero gSelf es carga permanente | Low | Correcto: gSelf es D, no L. Se asigna a `deadLoad` |
| Legacy slabs sin campos D/L: mostrar "—" y deshabilitar import | Low | Validación en adapter: si RD/RL undefined, no genera Load |
| Complejidad: duplicar 7 ramas de reacción en `designSlab()` | Med | Extraer helper `computeReactions(qu, D_total, L, ...)` que devuelva ambos sets |
| Usuario olvida ajustar start/end en la viga y la carga queda fuera de posición | Med | Auto-calcular start/end desde geometría de losa cuando sea posible |

## Rollback Plan

Revertir commit. Los campos nuevos en `SlabResult` son aditivos; las reacciones `qu` existentes no se modifican. La UI solo agrega botones, no altera flujos existentes.

## Dependencies

- `openspec/specs/steel-beam-load-split` (ya implementado — `Load.deadLoad`/`liveLoad`)
- `openspec/specs/slab-analysis` (per-edge reactions ya implementadas con `qu`)
- `openspec/specs/slab-persistence` (serialización automática de `SlabResult`)

## Success Criteria

- [ ] `SlabResult` expone `RD_izq`, `RL_izq` etc. con valores sin mayorar
- [ ] `slabReactionToBeamLoad()` convierte correctamente para los 4 bordes
- [ ] El botón en SlabResults navega a FormPage con la carga pre-llenada
- [ ] FormPage permite seleccionar losa guardada + borde y genera carga automáticamente
- [ ] La viga calcula con D y L transferidos (sin doble mayoración)
- [ ] Legacy slabs (sin D/L separados) no rompen — campos `undefined`, import deshabilitado

---

## Proposal question round

Antes de confirmar la propuesta, necesito resolver estas 3 decisiones de producto:

**1. Slabs legacy (guardados antes del D/L split):** ¿Los mostramos en el selector de importación con un warning tipo "D/L no disponible — recalcular primero", o directamente los ocultamos?

**2. Mapeo geométrico losa → viga:** Una losa de 4×5 m apoya en una viga. ¿Qué longitud de carga distribuida se asigna automáticamente? Opción A: el largo del borde elegido (ej. borde izquierdo → `lx` metros). Opción B: el usuario define start/end manualmente siempre.

**3. Flujo de UI desde SlabResults:** Al hacer clic en "Enviar reacciones a viga" desde los resultados de losa, ¿deberíamos navegar directamente a FormPage con la carga ya agregada (flujo automático), o copiar al portapapeles un resumen y dejar que el usuario vaya manualmente? La primera opción requiere saber si FormPage ya tiene datos en curso (¿pisamos o agregamos?).
