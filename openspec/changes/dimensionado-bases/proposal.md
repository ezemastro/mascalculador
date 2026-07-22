# Proposal: Dimensionado de Bases

## Intent

El programa dimensiona columnas y vigas pero no fundaciones. El usuario necesita diseñar la base donde apoya cada columna con las cargas que ya tiene calculadas, siguiendo CIRSOC 201 sin recalcular a mano ni duplicar datos.

## Scope

### In Scope
- Nueva solapa "Bases" con pantallas de datos (/bases) y resultados (/bases-results)
- Selector de columna guardada → carga automática de PD, PL, Cx, Cy
- Dimensionado de base centrada aislada (13 pasos CIRSOC 201)
- Dimensionado de base medianera con dos opciones: viga de fundación o tensor
- Predimensionado automático de Lx, Ly, h con overrides manuales
- Verificaciones: punzonado, corte unidireccional, flexión, armadura mínima
- Persistencia: guardar/cargar diseños como tipo `"bases"` + auto-save del formulario

### Out of Scope
- Página de impresión
- Bases combinadas, plateas, pilotes
- Verificación a deslizamiento y vuelco (CIRSOC 201 avanzado)
- Detallado sísmico CIRSOC 103
- Vigas de equilibrio entre dos columnas excéntricas
- Carga de reacción de viga (solo columna — V1)

## Capabilities

### New Capabilities
- `bases-calc`: Función pura `designBase(input): BaseResult` con procedimiento completo CIRSOC 201. Cubre base centrada (13 pasos: Pu, A_req, predim, qu, punzonado, corte unidireccional, flexión, As, armadura mínima, diámetro, separación) y medianera (viga de fundación: verificación M, T, armadura viga; tensor: verificación esfuerzo, armadura tensor).
- `bases-persistence`: Guardar/cargar/actualizar diseños de bases en localStorage como tipo `"bases"`, auto-save del último estado del formulario.

### Modified Capabilities
- None

## Approach

**Calc module**: `client/src/lib/bases-calc.ts` — función pura sin side effects. Recibe `BaseInput`, devuelve `BaseResult` con todos los pasos detallados.

**Formulario**: `BasesForm.tsx` — selector de tipo (Centrada/Medianera), subselector (Viga/Tensor), material (f'c, fy), suelo (σs, Df), dropdown "Cargar columna guardada" que lee saves `rc-columna` via `listSaves()` y extrae PD, PL, Cx, Cy. Predimensionado automático con campos override.

**Resultados**: `BasesResults.tsx` — dimensiones finales, verificaciones paso a paso, propuesta de armado con diámetro y separación, botón "Guardar resultados".

**Rutas y NavBar**: dos rutas nuevas en `main.tsx`, link "Bases" en NavBar.

**Storage**: agregar `"bases"` a la unión de `SavedBeam.type`, `saveBeam()`, `getSavedBeams()`, y `SavedBeams.tsx Props.type`. Nuevo `LAST_BASES_FORM_KEY`.

**Cálculo de Pu**: `max(1.4·PD, 1.2·PD + 1.6·PL)`.

**Predimensionado**: `A_base = (PD + PL) · 1.10 / σs`. B = L = sqrt(A). h = max(20, predim por punzonado).

## Calc Module Interface

```typescript
export type BaseType = "centrada" | "medianera";
export type MedianeraSubType = "viga-de-fundacion" | "tensor";

export interface BaseInput {
  qa: number; Df: number;        // suelo: kN/cm², cm
  PD: number; PL: number;        // cargas servicio (kN)
  cx: number; cy: number;        // dimensión columna (cm)
  fc: number; fy: number;        // materiales (MPa)
  type: BaseType;
  subType?: MedianeraSubType;    // solo medianera
  B?: number; L?: number; h?: number; // overrides manuales
  Lcol?: number; H?: number; mu?: number; // medianera extras
  cover?: number; rebD?: number;
}

export interface BaseResult {
  B: number; L: number; h: number; // dimensiones finales (cm)
  Pu: number; qu: number;         // cargas mayoradas (kN, kN/cm²)
  punchOK: boolean; beamShearOK: boolean; flexOK: boolean;
  As: number; AsMin: number;      // armadura (cm²/m)
  db: number; sep: number; nBars: number; // disposición
  steps: string[];                // memoria de cálculo
}
export function designBase(input: BaseInput): BaseResult;
```

## Affected Areas

| File | Impact | Description |
|------|--------|-------------|
| `client/src/lib/bases-calc.ts` | New | designBase() + procedimientos CIRSOC 201 |
| `client/src/screens/BasesForm.tsx` | New | Formulario con selector de columna y tipo |
| `client/src/screens/BasesResults.tsx` | New | Resultados paso a paso + guardado |
| `client/src/main.tsx` | Modified | 2 rutas + link NavBar |
| `client/src/lib/storage.ts` | Modified | Tipo "bases", LAST_BASES_FORM_KEY, form state |
| `client/src/components/SavedBeams.tsx` | Modified | Unión de Props.type |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Errores de signo/unidad en fórmulas CIRSOC 201 | Medium | Verificación cruzada con la especificación del usuario; comentarios explícitos de unidades |
| Confusión de unidades (σs en kN/cm² vs MPa) | Medium | Conversión documentada en la interfaz; inputs en las unidades que usa el ingeniero |
| Cambio futuro del schema de `rc-columna` rompe el dropdown | Low | Lectura defensiva con casteo `Record<string, unknown>` y fallbacks |
| Diferencia entre procedimiento centrada/medianera no ejercitada | Low | Shipping detrás de selector explícito; cada rama es autocontenida |

## Rollback Plan

Revertir cambios en `main.tsx` (rutas + NavBar) y `storage.ts` (tipo `"bases"`). Eliminar `BasesForm.tsx`, `BasesResults.tsx`, `bases-calc.ts`. Datos guardados en localStorage con tipo `"bases"` quedan inaccesibles pero no corrompen otros tipos — no se necesita migración.

## Dependencies

Ninguna externa. `listSavedColumns()` y `listSaves()` de `beam-reaction.ts`/`storage.ts` ya existen. Mafs no se usa en esta solapa.

## Success Criteria

- [ ] Base centrada: `designBase()` completa 13 pasos sin errores de TypeScript
- [ ] Base medianera: selector de viga o tensor produce resultados distintos y verificables
- [ ] Dropdown "Cargar columna" puebla PD, PL, Cx, Cy desde saves `rc-columna` existentes
- [ ] Predimensionado automático con overrides manuales funcionales
- [ ] Guardar/recuperar diseño persiste y recarga correctamente
- [ ] Auto-save del formulario preserva estado al recargar la página
- [ ] `cd client && npm run build` sin errores nuevos
