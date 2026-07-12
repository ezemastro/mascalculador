# Proposal: Guardar, Imprimir y Persistencia para Columnas

## Intent

La calculadora de columnas carece de guardado, impresión y persistencia — features que la calculadora de vigas ya tiene. Los usuarios pierden sus configuraciones al refrescar o al volver atrás desde resultados, y no pueden guardar configuraciones frecuentes ni imprimir reportes.

## Scope

### In Scope
- Botón Guardar en ColumnForm → guarda a localStorage vía `saveBeam()`
- `SavedBeams` en ColumnForm → cargar/eliminar columnas guardadas
- Persistencia automática del formulario al cambiar cualquier campo (`useEffect` → `saveLastFormState`)
- Restauración: `state > lastForm > defaults` al montar
- Botón Imprimir en ColumnResults → `/column-print` con recálculo
- `ColumnPrintPage`: planilla A4 imprimible con datos de columna y verificación CIRSOC
- "← Volver" en ColumnResults pasa el estado de vuelta para no perder datos
- `storage.ts`: agregar tipo `"columna"` al union type de `saveBeam` y `SavedBeam`
- `SavedBeams.tsx`: extender `type` prop a `"acero" | "hormigon" | "columna"`
- Nueva key de localStorage: `mascalculador_last_column_form`

### Out of Scope
- Cambios en `column-calc.ts` ni en fórmulas de cálculo
- Cambios en la calculadora de vigas
- Exportar a PDF (ya cubierto por `window.print()`)

## Capabilities

> Research: `openspec/specs/` está vacío — no hay specs existentes para modificar.

### New Capabilities
- `column-save`: Guardar, listar, cargar y eliminar configuraciones de columna en localStorage
- `column-print`: Página de impresión con recálculo y planilla A4 para columnas
- `column-persistence`: Estado del formulario sobrevive back-navigation y page refresh

### Modified Capabilities
None — no existing specs at the requirements level.

## Approach

Replicar los tres patrones de `FormPage.tsx` y `ResultsPage.tsx`:

1. **Save**: `handleSave()` con `prompt()` → `saveBeam(name, "columna", data)`. El data payload incluye todos los campos de `ColumnState`.
2. **Persistence**: `useEffect` que llama `saveLastColumnFormState()` en cada cambio. Key separada: `mascalculador_last_column_form`. Init: `state > lastForm > defaults`.
3. **Print**: `ColumnPrintPage` recibe `ColumnState` por router state, recalcula con `designColumn()`, renderiza planilla A4, `window.print()`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/src/screens/ColumnForm.tsx` | Modified | Agregar save, persistence, SavedBeams |
| `client/src/screens/ColumnResults.tsx` | Modified | Botón imprimir + fix back nav |
| `client/src/screens/ColumnPrintPage.tsx` | New | Planilla A4 de columna |
| `client/src/lib/storage.ts` | Modified | Tipo `"columna"` en union types + lastColumnForm helpers |
| `client/src/components/SavedBeams.tsx` | Modified | Extender `type` prop union |
| `client/src/main.tsx` | Modified | Ruta `/column-print` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `ColumnState` tiene campos que no encajan en JSON genérico de `SavedBeam.data` | Low | Todos los campos de `ColumnState` son serializables (number, string, enum) |
| Etiquetas "Vigas guardadas" en `SavedBeams` son confusas con columnas | Low | Agregar prop `label` o condicionar según `type` |
| `lastColumnFormState` collision con `lastFormState` de vigas | None | Keys de localStorage diferentes |

## Rollback Plan

- Revertir commits en orden inverso. Cada archivo modificado tiene cambios aislados — no hay acoplamiento entre ellos.
- Si `storage.ts` se rompe, las funciones de vigas existentes no se tocan (solo se agregan nuevos exports).

## Dependencies

- Ninguna — todos los cambios son autocontenidos en el frontend.

## Success Criteria

- [ ] Guardar columna con nombre vía prompt → aparece en SavedBeams accordion
- [ ] Cargar columna guardada → restaura todos los campos del formulario
- [ ] Modificar cualquier campo → sobrevive refresh (F5) con último valor
- [ ] Ir a resultados → volver atrás → campos intactos
- [ ] Imprimir desde ColumnResults → planilla A4 con datos y cuentas completas
- [ ] Las funciones de viga (`saveBeam("acero")`, `loadLastFormState()`) siguen funcionando sin cambios
