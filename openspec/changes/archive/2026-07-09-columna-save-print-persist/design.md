# Design: Guardar, Imprimir y Persistencia para Columnas

## Technical Approach

Replicar exactamente los tres patrones de `FormPage.tsx` + `ResultsPage.tsx` + `PrintPage.tsx` para el flujo de columnas:
1. **Save**: `prompt()` → `saveBeam(name, "columna", data)`
2. **Persistence**: `useEffect` → `saveLastColumnFormState()`, init: `state > lastForm > defaults`
3. **Print**: `ColumnPrintPage` recalcula con `designColumn()`, renderiza planilla A4, `window.print()` en mount

## Architecture Decisions

| Option | Tradeoffs | Decision |
|--------|-----------|----------|
| Usar mismo `localStorage` key `mascalculador_beam_saves` | Comparte el array de saves con vigas, filtrado por tipo. Coherencia con el modelo existente. | **Elegido** — extender `SavedBeam.type` a `"acero" \| "hormigon" \| "columna"` |
| Key separada `mascalculador_column_saves` | Aísla datos pero requiere duplicar toda la lógica de `storage.ts`. | **Descartado** — no hay beneficio de aislamiento, sí costo de mantenimiento |
| `SavedBeams` con `onDelete` opcional | Permite que el padre controle el delete sin romper uso existente (FormPage no pasa onDelete). | **Elegido** — agregar `onDelete?: (id: string) => void` con fallback interno |
| Pasar resultados pre-calculados al print | Evita re-calcular pero requiere serializar objetos complejos en router state. | **Descartado** — `ColumnCheck` contiene arrays; recalcular es determinista y más limpio |
| `useLocation()` para init state | Necesita manejar el tipo `ColumnState` importado de `ColumnForm`. Es el patrón existente. | **Elegido** — `const locationState = (useLocation() as { state?: ColumnState }).state` |

## Data Flow

```
ColumnForm ──save──► localStorage (mascalculador_beam_saves)
     │                      │
     │ useEffect            │ listSaves() filter type==="columna"
     ▼                      ▼
  localStorage        SavedBeams component
  (last_column_form)       │ onLoad
                           ▼
                      ColumnForm (restaura 17 campos via handleLoad)

ColumnForm ──submit──► navigate("/column-results", { state })
                              │
                              ▼
                       ColumnResults (recalcula con designColumn)
                              │
                     ┌────────┴────────┐
                     │ Print           │ Back
                     ▼                 ▼
              /column-print      /columns
              { state }          { state }
                     │
                     ▼
              ColumnPrintPage
              (designColumn → window.print)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/src/lib/storage.ts` | Modify | `SavedBeam.type` → `"acero" \| "hormigon" \| "columna"`. Agregar `saveLastColumnFormState`/`loadLastColumnFormState` con key `mascalculador_last_column_form` |
| `client/src/screens/ColumnForm.tsx` | Modify | Importar `useLocation, useEffect, useRef`. Agregar init state (`locationState > lastForm > defaults`). Agregar `useEffect` de persistencia con `useRef` guard. Agregar `handleSave`, `handleLoad`, `SavedBeams` component, botón Guardar |
| `client/src/screens/ColumnResults.tsx` | Modify | Back nav: `navigate("/columns", { state })`. Agregar botón Imprimir → `navigate("/column-print", { state })` |
| `client/src/screens/ColumnPrintPage.tsx` | Create | Recalcular con `designColumn`/`computeBuiltUpI`/`computeBuiltUpBox`. Renderizar planilla A4 (header, datos, parámetros, cuentas, resultados). `window.print()` en mount vía `useEffect`. White/black styling |
| `client/src/components/SavedBeams.tsx` | Modify | `type` prop: `"acero" \| "hormigon" \| "columna"`. Agregar `onDelete?: (id: string) => void` (llamado antes del delete interno). Agregar `label?: string` para texto contextual |
| `client/src/main.tsx` | Modify | Import `ColumnPrintPage`. Ruta `{ path: "/column-print", element: <ColumnPrintPage /> }` |

## Interfaces / Contracts

### storage.ts — New exports

```typescript
export interface SavedBeam {
  // ... type: "acero" | "hormigon" | "columna" (CHANGED)
}

export interface ColumnFormState {
  profileType: string; profileName: string; upnName: string; upnGap: number;
  tubeName?: string; armadaBf?: number; armadaTf?: number;
  armadaHw?: number; armadaTw?: number; cajonH?: number; cajonB?: number; cajonT?: number;
  Pu: number; Mux: number; Muy: number; L: number; Kx: number; Ky: number; Fy: number;
}

export function saveLastColumnFormState(state: ColumnFormState): void
export function loadLastColumnFormState(): ColumnFormState | null
```

### SavedBeams — Extended Props

```typescript
interface Props {
  type: "acero" | "hormigon" | "columna";
  onLoad: (data: Record<string, unknown>) => void;
  onDelete?: (id: string) => void;
  label?: string; // default: "Vigas guardadas"
}
```

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Build check | `tsc -b` en `client/` — verifica que todos los nuevos imports compilan | `cd client && npx tsc -b` |
| Lint | ESLint sin errores en archivos modificados | `cd client && npx eslint src/screens/ColumnForm.tsx src/screens/ColumnResults.tsx src/screens/ColumnPrintPage.tsx src/lib/storage.ts src/components/SavedBeams.tsx src/main.tsx` |
| Manual smoke | Guardar → recargar → cargar → imprimir | Seguir success criteria del proposal |

No hay test runner configurado. La verificación será build + lint + smoke manual.

## Migration / Rollout

No migration required. Los cambios son aditivos:
- `SavedBeam.type` extiende el union type — datos existentes no se modifican
- Nueva key `mascalculador_last_column_form` — no colisiona con `mascalculador_last_form`
- `SavedBeams.onDelete` es opcional — el uso existente en `FormPage` no se rompe

Rollback: revertir commits en orden inverso. Cada archivo tiene cambios aislados.

## Open Questions

- None — el patrón de replicación está validado por la implementación funcional de vigas.
