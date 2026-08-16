# Proposal: Viga Continua — Modo Pórtico + Mejoras Compartidas

## Intent

`viga-continua/` (puerto 5175) hoy entrega **solo** análisis 1-D de vigas continuas. Los ingenieros de la app necesitan además resolver **pórticos planos** (vigas + columnas, cargas inclinadas, combinaciones D/L) en la misma herramienta y con la misma UX (auto-persist del último formulario + guardados con nombre + figuras Mafs claras). Al mismo tiempo, la pantalla de resultados actual **no distingue entre cargas de servicio y envolvente mayorada** — un defecto pedagógico serio que ya merece arreglo.

En la misma entrega se introduce un **selector de modo** en la entrada del flujo, dos comportamientos nuevos compartidos entre modos (botón "Nueva" en la form y toggle "Envolvente / Servicio" en resultados), y un **modo Pórtico nuevo** con su propio solver de rigidez matricial 2-D, su storage dedicado y sus pantallas form/results. El alcance se cierra a `viga-continua/` — el mirror paralelo en `apps/hormigon/` queda fuera.

## Scope

### In Scope

- **Selector de modo** (`viga-continua` | `portico`) en la cabecera de la pantalla de entrada, persistido en URL `?mode=...` para deep-linking. Default: `viga-continua`.
- **Modo Pórtico** end-to-end:
  - `portico.ts` — tipos (`PorticoNode`, `PorticoBar`, `PorticoBarLoad`, `PorticoSupport`, `PorticoState`, `PorticoSupportKind = "hinge" | "fixed"`).
  - `portico-analysis.ts` — solver 2-D por método de rigidez directa: matriz elemental 6×6 por barra (3 GDL/nudo), ensamblaje global, restricciones por apoyo, resolución de ULS (1.2·D + 1.6·L, sin patronado — ver Open Decisions) y Service (D y L por separado).
  - `PorticoForm.tsx` — editor de nodos / barras / cargas / apoyos. **Defaults precargados**: pórtico de 3 nudos, 2 barras (columna-pie → cumbrera → columna-pie), un apoyo articulado en la base izquierda y otro fijo en la base derecha, una carga inclinada de ejemplo. Botón "Nueva" limpia con confirmación.
  - `PorticoResults.tsx` — diagramas Mafs (deformada + diagrama de momento M+ por barra). Tabla de reacciones por apoyo.
  - Envolvente / Servicio: toggle en cabecera de resultados; recalcula y re-renderiza.
- **Mejoras compartidas (ambos modos)**:
  - Botón "Nueva" en la form (clear + reset a defaults), con confirmación.
  - Toggle "Envolvente / Servicio" en pantalla de resultados — valores y figuras cambian según el modo elegido.
- **Persistencia dual** (idéntica a la ya usada en viga-continua): auto-persist del último estado de form vía localStorage, más guardados con nombre listados en `SavedBeams`. Extiende `storage.ts` con `savePortico` / `loadLastPorticoFormState` y reflejados en `SavedBeams`.
- **Convención de signos documentada** en la pantalla de resultados del pórtico: M+ = fibra traccionada abajo en el tramo y vector momento apuntando a la derecha. La leyenda debe verse sin necesidad de abrir un manual.

### Out of Scope (explícito)

- **Mirror a `apps/hormigon/`**: la copia paralela del split incompleto queda intacta. Documentado en risks.
- **Soportes inclinados** ni combinaciones oblicuas: solo `hinge` / `fixed` en ejes globales X/Y.
- **Bisagras internas** en barras: las rótulas son solo en nudos extremos.
- **Dimensionado (sizing)**: análisis únicamente, igual que viga-continua. Sin As, f'c, fy.
- **Subir el cap UX** (5 barras / 5 nudos / 5 apoyos): el solver se programa escalable para crecer después, pero el form enforce el cap actual. No se sube el cap en este change.
- **Reescritura** del beam solver (`beam-envelope.ts`) — se reusa tal cual.
- **Refactor** de `apps/concrete` ni de paths stale dentro de los specs existentes (`viga-continua-routing`, `viga-continua-analysis`): esos deltas se hacen via `MODIFIED Requirements`.

### Capabilities (contrato con `sdd-spec`)

| | Capability | Acción | Resumen |
|---|---|---|---|
| New | `portico-analysis` | `ADDED Requirements` | Tipos pórtico, solver 2-D, convención M+, defaults precargados, persistencia, límites UX 5/5/5, toggle envolvente/servicio, botón Nueva, leyenda de signo obligatorio. |
| Modified | `viga-continua-analysis` | `MODIFIED Requirements` | Añadir requisito "Botón Nueva" y "Toggle Envolvente/Servicio" aplicables a la beam mode. Mantener требования existentes (D/L 1.2·1.6, sin dimensionado, etc.). |
| Modified | `viga-continua-routing` | `MODIFIED Requirements` | Registrar `PorticoForm` en `/viga-continua?mode=portico` y `PorticoResults` en `/viga-continua-results` (con `mode` en `location.state`). Corregir paths stale `apps/concrete` → `viga-continua/`. |

## Approach

**Big-picture**: el form actual sigue siendo el punto de entrada. El `ModeSelector` (segmented control arriba del `<header>`) decide qué sub-form se monta. Submit navega a `/viga-continua-results?mode=...` llevando `mode` en `location.state`; el componente de resultados elige entre beam-envelope o portico-analysis según el flag.

El solver pórtico implementa método de rigidez directa 2-D:

1. Cada barra tiene 6 GDL (3 por nudo: ux, uy, θz); matriz de rigidez elemental 6×6 en ejes locales.
2. Transformación de coordenadas locales→globales por matriz de cosenos (basada en ángulo de la barra).
3. Ensamblaje de la matriz global K por índices de nudo.
4. Aplicación de restricciones (DOF en apoyos = 0).
5. Vector de cargas equivalente: las cargas distribuidas se integran al vector nodal (fuerzas consistentes) en ejes globales — si la carga es inclinada (intensity, angle), se descompone a (fx, fy) globales antes de integrar.
6. Resolución `K·u = F` con un solver numérico simple (Gauss-Jordan o `mathjs` si entra como dep — preferir cero deps nuevas; implementar densa es trivial para los tamaños previstos).
7. Reacciones: `R = K·u − F` en GDL restringidos.
8. Esfuerzos por barra: transformación inversa → M/V/N en cada extremo + en N puntos intermedios para graficar.

La convención M+ (traccionada abajo y vector derecha) se fija en el documento `portico-analysis/design.md` y se muestra en la leyenda Mafs del `PorticoResults`.

Para el toggle Envolvente/Servicio: el solver ejecuta una vez para ULS (factored) y otra para SLS (D y L por separado). El toggle solo cambia cuál de los tres resultados renderiza — no recalcula bajo demanda. Si después se quiere optimízar, es trivial (cachear las corridas).

## Chained PR Plan (4 PRs, stacked-to-main)

> Decisión ya adoptada: **delivery = stacked-to-main**, **review budget = 400 líneas**. Con los LOC aproximados estimados, los primeros PRs quedan dentro de presupuesto y el último lo roza — se recorta cuando `sdd-tasks` confirme el forecast.

### PR1 — Cimientos + routing + selector (~280 LOC)

- Recomendar el cierre del **WIP sin commit** de `VigaContinuaForm` / `VigaContinuaResults` / `storage.ts` / `SavedBeams.tsx` / `viga-continua-main.tsx` / `vite.config.ts` como un commit aparte **previo** (es un fix limpio, no toca funcionalidad pórtico). Sugerencia: pedir confirmación al usuario antes del merge inicial; si prefiere, los absorbemos en este PR como commits separados.
- `viga-continua/src/lib/portico.ts`: tipos de pórtico completos (sin lógica).
- `viga-continua/shared/src/storage.ts`: extender `SaveType` con `"portico"` y añadir `savePortico` / `loadLastPorticoFormState` / `saveLastPorticoFormState` (mismo patrón que `saveVigaContinuaInput`).
- `viga-continua/shared/src/SavedBeams.tsx`: añadir `"portico"` al union `type`.
- `viga-continua/src/viga-continua-main.tsx`: cambiar `/` a ser un wrapper `MainEntry` que lee `?mode=...` y monta el form correspondiente; mantener compat con `/viga-continua` (redirect o alias).
- `viga-continua/src/components/ModeSelector.tsx` (NUEVO): segmented control reutilizable.
- `viga-continua/src/screens/VigaContinuaForm.tsx`: montar `<ModeSelector>` arriba del `<header>`, leer `mode` del query, y delegar a `<PorticoForm/>` cuando aplique. **Aún sin `PorticoForm`** — placeholder.
- `VigaContinuaForm.tsx` + `VigaContinuaResults.tsx`: agregar botón "Nueva" + toggle "Envolvente / Servicio" (ya operable aunque sea trivial en beam mode).

**LOC ≈ 280.** Riesgo de budget: **bajo**. Self-contained. No depende de pórtico visual aún.

### PR2 — Solver pórtico (~520 LOC)

- `viga-continua/src/lib/portico-analysis.ts` (NUEVO): stiffness method 2-D completo, unit-test mental con dos casos a mano (pórtico de 2 barras simétrico con carga vertical en cumbrera → reacción vertical = mitad del total; ménsula con carga en punta → momento en empotramiento = P·L).
- Función pura `solvePortico(state, mode: "uls" | "sls-d" | "sls-l")` con tipos de retorno `PorticoResults`.
- Documento interno (JSDoc) sobre la convención M+.

**LOC ≈ 520.** Excede el budget en ~120; se recorta eliminando comentarios inline innecesarios o diferir tests manuales. Sin UI en este PR — depende solo de PR1 (tipos).

### PR3 — PorticoForm (~430 LOC)

- `viga-continua/src/screens/PorticoForm.tsx` (NUEVO): tabla editable de nodos, barras, cargas y apoyos. Reutiliza `DecimalInput` y `format*`. Defaults precargados (3 nudos, 2 barras, ejemplo inclinado).
- Enforce del cap UX 5/5/5 con disable de los botones "+" cuando se llega al límite.
- Botón "Nueva" con confirmación.
- Submit → `location.state` con `{ mode: "portico", ... }` hacia `/viga-continua-results`.

**LOC ≈ 430.** Roza el budget. Depende de PR1 + PR2.

### PR4 — PorticoResults + toggle Envolvente/Servicio aplicado a beam mode (~470 LOC)

- `viga-continua/src/screens/PorticoResults.tsx` (NUEVO): diagrama Mafs (deformada + momento), tabla de reacciones, leyenda de signos obligatoria.
- Conectar toggle al solver pórtico (`uls` vs `sls-d` / `sls-l`).
- En `VigaContinuaResults.tsx`: conectar el toggle al beam solver — el formato es trivial porque `calculateBeamEnvelope` ya existe y se puede llamar con factor 1.0 cuando el toggle está en Servicio.

**LOC ≈ 470.** Excede el budget en ~70. Se recorta eliminando formateo fancy de la leyenda. Depende de PR1 + PR2 + PR3.

> Alternativa si el budget no cierra en PR4: partirlo en PR4a (PorticoResults sin leyenda fancy) y PR4b (legend + último retoque). Decisión al final de PR3.

## Affected Areas

| Path | Impact | Description |
|---|---|---|
| `viga-continua/src/lib/portico.ts` | New | Tipos `PorticoState`, `PorticoNode`, `PorticoBar`, `PorticoBarLoad`, `PorticoSupport`, `PorticoSupportKind`. |
| `viga-continua/src/lib/portico-analysis.ts` | New | Solver rigidez 2-D. |
| `viga-continua/src/screens/PorticoForm.tsx` | New | Editor pórtico. |
| `viga-continua/src/screens/PorticoResults.tsx` | New | Diagramas y tabla. |
| `viga-continua/src/components/ModeSelector.tsx` | New | Segmented control reutilizable. |
| `viga-continua/src/screens/VigaContinuaForm.tsx` | Modified | Mode selector + botón "Nueva". |
| `viga-continua/src/screens/VigaContinuaResults.tsx` | Modified | Toggle Envolvente/Servicio. |
| `viga-continua/src/viga-continua-main.tsx` | Modified | Routing con `?mode=`. |
| `viga-continua/shared/src/storage.ts` | Modified | `SaveType` + helpers pórtico. |
| `viga-continua/shared/src/SavedBeams.tsx` | Modified | Union `type` con `"portico"`. |
| `openspec/specs/viga-continua-analysis/spec.md` | Modified | Requisitos Botón Nueva + Toggle. |
| `openspec/specs/viga-continua-routing/spec.md` | Modified | Path fixes + `portico` en routing. |
| `openspec/specs/portico-analysis/spec.md` | New | Spec completa del modo pórtico. |
| `apps/hormigon/**` | Sin tocar | Out of scope (mirror queda intacto). |

## Risks

| Riesgo | Likelihood | Impacto | Mitigación |
|---|---|---|---|
| Solver pórtico: nuevo núcleo numérico sin base previa en el repo, alta probabilidad de errores sutiles (signos, GDL restringidos, integración de cargas inclinadas). | High | High | Smoke test manual obligatorio sobre **3 fixtures a mano** antes de merge: (a) ménsula carga vertical en punta → M_emp = P·L, (b) pórtico simétrico 2 columnas + viga cumbrera con carga vertical → reacciones verticales iguales a P/2, (c) carga inclinada en cumbrera → reparto axial verificable por estática. Cada PR solver-publicante los revisa. Sin test runner — los reemplaza una checklist de smoke y comandos `tsc -b` + `npm run build`. |
| Patrónado de cargas en pórtico (2-D) es combinatoriamente caro. | Med | Med | **Decisión cerrada**: el toggle ULS aplica 1.2·D + 1.6·L sobre **toda** la carga simultáneamente, sin patronado. SLS entrega D y L por separado. Documentado como decisión. Cambiar a patronado después es un delta nuevo. |
| M+ sign convention puede engañar a ingenieros habituados a M+ tensionado arriba. | Med | High | Leyenda obligatoria y visible en el SVG de Mafs y en la tabla de reacciones, más nota en el spec. JSDoc fija el contrato (tensión abajo = +, vector momento derecha = +). |
| Sin test runner, los regresivos del beam-envelope al introducir el toggle son un riesgo. | Med | Med | Spec del beam exige **dos escenarios Given/When/Then** (toggle en Envolvente → valores con 1.2·1.6; toggle en Servicio → D y L por separado). `sdd-verify` valida manualmente comparando contra un caso beam resuelto a mano. |
| Dos apps (`hormigon/` y `viga-continua/`) embarcan el mismo flow — el mirror queda desincronizado. | Med | Low | Out of scope declarado. AGENTS.md y el `risks` del archivo menciona que una futura PR podría migrar `hormigon/` para apuntar a `viga-continua/` como dependencia compartida, pero no se hace acá. |
| WIP sin commit en `viga-continua/` choca con el trabajo pórtico si entra desordenado. | Med | Med | PR1 absorbe el commit previo (o lo empaqueta). Confirmar con el usuario al inicio de PR1 si prefiere commit separado. |
| Bundle size de `mafs` ya está — reusar la dependencia pero un nuevo `<PorticoResults>` puede inflar más la página. | Low | Low | Si pesa, extraer un `<MafsFrame>` compartido entre los dos screens (explore ya lo sugería). Decidir durante PR4. |
| Cap UX 5/5/5 vs solver escalable: si alguien edita el cap, debe recordar que el solver interno NO está limitado — sesiones con >5 barras renderizan sin cap. | Low | Low | Documentar en spec; el form enforce el cap, el solver no. |

## Rollback Plan

Cada PR es revertible con `git revert <merge-sha>`. Adicionalmente:

- **PR1**: si se revierte, el toggle "Envolvente/Servicio" vuelve a ser siempre "Envolvente" y el botón "Nueva" desaparece. El flow beam sigue funcionando como antes — `VigaContinuaForm` y `VigaContinuaResults` sólo agregaron UI condicional.
- **PR2**: el solver se importa solo desde `PorticoResults` (PR4). Si PR2 se revierte, **PR4 también** debe revertirse. El bundle deja de incluir `portico-analysis.ts`.
- **PR3** y **PR4**: reversibles independientes. Si `PorticoForm` se revierte, el selector queda en beam-only (default), la app sigue funcionando.

**Persistencia**: localStorage del usuario puede contener entradas `"portico"` previas a un rollback. El `getSaves` por tipo filtra por `"portico"` — entradas huérfanas quedan ignoradas, no rompen el flow.

**Acción de emergencia**: si el solver pórtico muestra resultados claramente erróneos en producción, el selector debe quitarse temporalmente. **Mitigación operacional**: tras el merge de PR4, smoke test obligatorio con los 3 fixtures de mano antes de cerrar el change en `sdd-archive`.

## Open Decisions / Assumptions

Todas las preguntas abiertas del explore están **resueltas** (ver sesión preflight + decisión de alcance #707):

- Persistencia pórtico: **dual** (auto + nombres).
- Default geometry: **precargado**.
- Y axis: **positivo hacia abajo** (coincide con pixels). Documentado en esta propuesta y en `portico-analysis/design.md` para evitar invertir diagramas.
- Cap MVP: **5/5/5** (UX). Solver internamente escalable.
- Convención M+: tensión abajo + vector derecha. Fija en el spec.
- Soportes: solo en nudos, sin bisagras internas.
- Cargas inclinadas: input `(intensidad, ángulo)`, descomposición a globales interna.
- Sin test runner. Verificación = `lint` + `tsc -b` + `vite build`.
- Sin mirror a `apps/hormigon/`.
- Beam solver sin patronado para ULS (decisión vigente).

**Asunción nueva a confirmar en `sdd-design`**: el solver pórtico usa eliminación gaussiana densa a mano (sin dep). Si durante `sdd-design` se justifica meter `mathjs` o `numeric.js` como dep, debe aprobarse el peso del bundle. **Decisión default**: cero deps nuevas.

No quedan **product questions abiertas** para el usuario.

## What "Done" Looks Like

- `npm run lint:all && npm run typecheck:all && npm run build:all` corre verde en cada PR.
- Smoke test manual con los **3 fixtures a mano** (ménsula, pórtico simétrico, pórtico con carga inclinada): reacciones y momentos deben coincidir con cálculo analítico en 1 decimal.
- El usuario hace un pase de aceptación visual sobre el diagrama Mafs de un pórtico de 3 nudos / 2 barras (el de los defaults precargados) y confirma que el signo M+ se lee sin confusión.
- La beam mode sigue funcionando como antes (los 3 escenarios del spec `viga-continua-analysis` siguen pasando: support reactions unfactored, envelope U=1.2·1.6, sin dimensionado).
- El cambio está archivado en `openspec/changes/archive/YYYY-MM-DD-viga-continua-modo-portico/` con los tres deltas merged.

## Success Criteria

- [ ] `sdd-archive` se ejecuta sin warnings destructivos: 1 spec nueva (`portico-analysis`), 2 specs modificadas (`viga-continua-analysis`, `viga-continua-routing`).
- [ ] Los 3 fixtures pórtico pasan el smoke test del runbook.
- [ ] Beam mode no regresa: los escenarios Given/When/Then de `viga-continua-analysis` siguen vigentes.
- [ ] El usuario valida el diagrama pórtico de los defaults en una sesión de aceptación.
- [ ] localStorage del usuario sobrevive un hard refresh: el último estado de form se restaura en ambos modos.
