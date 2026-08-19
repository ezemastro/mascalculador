# Proposal: Viga Continua — Persistencia con Nombre

## Intent

En `viga-continua/` (puerto 5175) hoy la form tiene **botón "Guardar"** y la pantalla de resultados tiene **otro botón "Guardar"** independiente — pero ninguno persiste el resultado. El usuario puede tocar Guardar pero la viga no se guarda en ningún lado, ni reaparece con un número al volver a tocar Guardar. Esta es una inconsistencia seria con el resto del repo: los otros seis forms (`Acero`, `Hormigon-VigaH`, `Hormigon-RCColumn`, `Acero-Column`, `Acero-Cartel`, `Hormigon-Bases`) ya implementan el patrón canónico de **guardar-con-nombre** vía `loadedSaveId` + `loadedSaveName`, listado en `<SavedBeams>` con su `<button>`, y **re-edición sobre el mismo id** cuando se vuelve a tocar Guardar.

Lo que pide el usuario, verbatim:

> "El boton guardar debe ir en las dos pantallas. Una vez que se guarda una viga, aparece el numero de viga y si tocas nuevamente guardar, se guarda sobre el mismo numero de viga."

Esto cierra la brecha con el patrón de los otros forms y suma, como plus de consistencia, el **auto-persist del último estado de form** (que `viga-continua/shared/src/storage.ts` ya tiene para pórtico pero no para beam). El alcance se cierra a `viga-continua/` — `hormigon/` no se toca en este change.

## Scope

### In Scope

- **Extender `SaveType`** en `viga-continua/shared/src/storage.ts:41–49` con un nuevo miembro `"viga-continua"` (decisión D3). No reusar `"hormigon"`, `"losa"` ni otro existente — beam continua es un tipo distinto de análisis (no-RC, no-slabs).
- **Helpers de almacenamiento** específicos de beam continua en `viga-continua/shared/src/storage.ts`:
  - `saveVigaContinuaInput(name, input)` — guarda `{ spans, supportTypes, loads }` (decisión D2: input-only en la form, sin snapshot de resultado).
  - `updateVigaContinuaInput(id, input)` — sobre-escribe el mismo id cuando Guardar se toca dos veces.
  - `getSavedVigasContinuas()` — filtra `type: "viga-continua"`.
  - `loadVigaContinua(id)` — devuelve `{ input }`.
  - `deleteVigaContinua(id)`.
  - `VigaContinuaLastFormState` + `saveLastVigaContinuaFormState` + `loadLastVigaContinuaFormState` — auto-persist (gap documentado en exploración, recomendado YES para cerrar la paridad con pórtico).
- **Wrapper per-app** `viga-continua/src/lib/storage.ts` (NUEVO, decisión D4) que hardcodea `app="concrete"` y re-exporta los helpers. Mismo patrón que `hormigon/src/lib/storage.ts` y `acero/src/lib/storage.ts`.
- **Extender `VigaContinuaState`** (`viga-continua/src/lib/viga-continua.ts:18–25`, decisión D5) con campos opcionales `loadedSaveId?: string` y `loadedSaveName?: string`. Viajan en `location.state` para que la pantalla de resultados pueda re-salvar el mismo id.
- **Pantalla de form (`VigaContinuaForm.tsx`)**:
  - Botón "Guardar" / "Guardar corrección" (decisión D1) en la barra inferior, junto a Calcular/Volver.
  - Handler `handleSave()`: `window.prompt()` (decisión D8) → `saveVigaContinuaInput` o `updateVigaContinuaInput` según `loadedSaveId`. Tras guardar, `setLoadedSaveName(name)` y render del número de viga guardado.
  - Estado `loadedSaveId` + `loadedSaveName` inicializado vacío; si vienen en `location.state` (caso "venís de results y querés re-salvar"), se rehidratan.
  - Hidratación al cargar un save desde `<SavedBeams>`: `setLoadedSaveId(save.id); setLoadedSaveName(save.name)` + copia de `data.input` a los campos (decisión D2 — payload es `{ input: {...} }`, los campos son `spans/supportTypes/loads` planos; typeof === "number" check).
  - Mount de `<SavedBeams type="viga-continua" onLoad={...}>` debajo de la form, mismo patrón que los otros seis forms.
  - `useEffect` para auto-persist con `saveLastVigaContinuaFormState` en cada cambio.
- **Pantalla de resultados (`VigaContinuaResults.tsx`)**:
  - Botón "Guardar" / "Guardar corrección" en la cabecera de acciones (mismo label switch que D1).
  - Handler: lee `loadedSaveId` + `loadedSaveName` de `location.state` (decisión D5); payload `{ input, envelope }` donde `envelope: BeamEnvelopeResult` (decisión D6, ya exportado en `viga-continua/src/lib/beam-envelope.ts:18`). Llama `saveVigaContinuaInput` o `updateVigaContinuaInput` según `loadedSaveId`.
  - Al montar: si `location.state` trae `loadedSaveId`, lo siembra en el estado local del botón.
- **Migración de existentes**: los saves previos a este change no usan `type: "viga-continua"` (ese miembro es nuevo). No hay nada que migrar. `getSaves("concrete")` sigue devolviendo los beams/losas/bases/RC-columns/portico anteriores sin cambios.

### Out of Scope (explícito)

- **Mirror a `apps/hormigon/`** (paralelo del split incompleto): queda intacto, igual que en el change `viga-continua-modo-portico`.
- **Modo pórtico**: la persistencia de pórtico ya se entregó en el change `viga-continua-modo-portico` (PR1 ✅). Este change NO la toca.
- **Botón "Nueva"** (clear form a defaults): fuera de scope; se entrega en el change pórtico y se podría sumar después.
- **Toggle Envolvente / Servicio**: fuera de scope (también pórtico).
- **Modal de naming propio**: NO se construye. Se usa `window.prompt()` como los otros seis forms (decisión D8). Cualquier mejora de UX de naming queda para un change posterior.
- **Multi-device sync / backend**: sigue siendo solo `localStorage`. Sin servidor.
- **Tests automatizados**: el repo no tiene test runner (ver `openspec/config.yaml`). La verificación queda en `lint` + `tsc -b` + smoke test manual.

## Capabilities (contrato con `sdd-spec`)

| | Capability | Acción | Resumen |
|---|---|---|---|
| New | `viga-continua-persistence` | `ADDED Requirements` | Miembro `"viga-continua"` en `SaveType`; helpers `saveVigaContinuaInput` / `updateVigaContinuaInput` / `getSavedVigasContinuas` / `loadVigaContinua` / `deleteVigaContinua`; auto-persist `saveLastVigaContinuaFormState` / `loadLastVigaContinuaFormState`; wrapper `viga-continua/src/lib/storage.ts`; mount de `<SavedBeams type="viga-continua">`; handler `handleSave` con `window.prompt` y label "Guardar" ↔ "Guardar corrección" según `loadedSaveId`. |
| Modified | `viga-continua-state-payload` | `MODIFIED Requirements` | `VigaContinuaState` gana `loadedSaveId?: string` y `loadedSaveName?: string`. Estos viajan en `location.state` para que la pantalla de resultados pueda re-salvar el mismo id. |
| New | `viga-continua-results-save` | `ADDED Requirements` | Botón "Guardar" / "Guardar corrección" en `VigaContinuaResults`; handler que toma `{ input, envelope: BeamEnvelopeResult }` (input es `VigaContinuaState` con `loadedSaveId`/`loadedSaveName` ya hidratados); siembra del estado desde `location.state` al montar. |

> Nota: el spec de `viga-continua-analysis` no se toca (este change no agrega reglas de cálculo). El spec de `viga-continua-routing` tampoco se toca (las rutas no cambian, solo los handlers en las pantallas existentes).

## Approach

**Big-picture**: reusar exactamente el patrón de los otros seis forms. La diferencia con el caso pórtico (entregado por `viga-continua-modo-portico`) es que acá:

1. El `SaveType` member es `"viga-continua"` (NO `"portico"`).
2. La form guarda **input-only** (`{ spans, supportTypes, loads }`); la pantalla de resultados guarda `{ input, envelope }` (decisiones D2 y D6).
3. El wrapper `viga-continua/src/lib/storage.ts` es análogo a `hormigon/src/lib/storage.ts` pero con las funciones específicas de beam continua, no de slab/bases/RC-column.

Secuencia de merge (ver `### Sequencing`):

1. Esperar a que `viga-continua-modo-portico` merge a `main` (PR1 ya aplicado; PR2/PR3/PR4 pendientes).
2. Branch desde `main` ya con pórtico integrado. Rebase contra `main` si entra algo más durante el ciclo.
3. Un único PR (delivery = `single-pr`, ~205 LOC code — ver budget más abajo).

Comportamiento esperado al usuario:

- **Cold open de form** → campos vacíos / defaults, sin "número de viga".
- **Editar campos** → auto-persist del último estado en cada cambio.
- **Hard refresh** → la form vuelve al último estado (auto-persist).
- **Click "Guardar"** → `prompt("Nombre de la viga:")` → save → label del botón pasa a "Guardar corrección" + aparece `<span>Viga #abc123</span>`.
- **Click "Guardar corrección"** → segundo prompt (decisión D8: el patrón de los otros forms SIEMPRE repide prompt para confirmar el nombre, no sobre-escribe a ciegas) → update del mismo id. NO se re-pide nombre si `loadedSaveId` ya viene de un load previo en la misma sesión (ver nota en Open Decisions).
- **Click en un item de `<SavedBeams>`** → hidrata los campos + `setLoadedSaveId(id); setLoadedSaveName(name)` → el botón pasa a "Guardar corrección".
- **Submit → results** → label "Guardar corrección" persiste porque `loadedSaveId` viaja en `location.state`.
- **Click "Guardar corrección" en results** → segundo prompt → `updateVigaContinuaInput` con payload `{ input, envelope }` (input es la snapshot completa de los campos en el momento del submit; envelope es el resultado recomputado en la pantalla de resultados).

## Affected Areas

| Path | Impact | Description |
|---|---|---|
| `viga-continua/shared/src/storage.ts` | Modified | Añadir `"viga-continua"` al union `SaveType`; añadir `VigaContinuaLastFormState`, `saveLastVigaContinuaFormState`, `loadLastVigaContinuaFormState`, `saveVigaContinuaInput`, `updateVigaContinuaInput`, `getSavedVigasContinuas`, `loadVigaContinua`, `deleteVigaContinua`. |
| `viga-continua/src/lib/storage.ts` | New | Wrapper per-app que hardcodea `app="concrete"` y re-exporta los helpers anteriores. |
| `viga-continua/src/lib/viga-continua.ts` | Modified | Añadir `loadedSaveId?: string` y `loadedSaveName?: string` a `VigaContinuaState`. |
| `viga-continua/src/screens/VigaContinuaForm.tsx` | Modified | Botón Guardar / Guardar corrección, `handleSave`, estado `loadedSaveId`/`loadedSaveName`, mount `<SavedBeams type="viga-continua">`, `useEffect` de auto-persist, hidratación desde `data.input`. |
| `viga-continua/src/screens/VigaContinuaResults.tsx` | Modified | Botón Guardar / Guardar corrección, handler con payload `{ input, envelope }`, siembra de `loadedSaveId` desde `location.state`. |
| `openspec/specs/viga-continua-persistence/spec.md` | New | Spec de `viga-continua-persistence` con Given/When/Then para cada helper y para el flujo Guardar → re-Guardar → cross-route. |
| `openspec/specs/viga-continua-state-payload/spec.md` | New | Spec de `viga-continua-state-payload` con los nuevos campos opcionales. |
| `openspec/specs/viga-continua-results-save/spec.md` | New | Spec de `viga-continua-results-save` con Given/When/Then para la pantalla de resultados. |
| `apps/hormigon/**` | Sin tocar | Out of scope. |
| `viga-continua/src/lib/portico.ts`, `portico-analysis.ts`, `PorticoForm.tsx`, `PorticoResults.tsx` | Sin tocar | Cambio pórtico cerrado en `viga-continua-modo-portico`. |

## Risks

| Riesgo | Likelihood | Impacto | Mitigación |
|---|---|---|---|
| **Conflicto de merge con `viga-continua-modo-portico`** sobre `viga-continua/shared/src/storage.ts` (ambos cambian `SaveType` y agregan helpers nuevos) y sobre `<SavedBeams>` (ambos pueden extender el union `type`). | **High** | Med | **Secuencia dura**: este change NO arranca hasta que los 4 PRs del pórtico estén mergeados a `main`. Branch desde `main` ya con pórtico integrado. Conflict minimiza porque el miembro `"viga-continua"` es aditivo al final del union. Documentado en `### Sequencing`. |
| **Conflicto sobre `VigaContinuaForm.tsx`** si el pórtico PR1/PR4 tocó esa pantalla (botón "Nueva", toggle Envolvente/Servicio). | Med | Med | Resolver durante rebase. El botón "Nueva" y el toggle van arriba; los botones Guardar/Calcular/Volver van abajo — solapamiento mínimo. |
| **`window.prompt()` UX limitada**: en algunos navegadores puede ser bloqueada si no viene de un user gesture inmediato (raro pero posible si se llama dentro de `useEffect`). | Low | Low | El handler `handleSave` se llama desde un `<button onClick>`, así que siempre es user-gesture. Sin riesgo real. Documentado en spec. |
| **Cross-route state loss en hard refresh**: si el usuario hace hard refresh en `/viga-continua-results`, se pierde `location.state` y `loadedSaveId`. El botón "Guardar" vuelve a comportarse como save nuevo, no update. | Med | Low | Mitigación: documentar en spec que **hard refresh en results = save nuevo**. Alternativa futura (out of scope): persistir el `loadedSaveId` también en la key de auto-persist. No se hace acá para no expandir el scope. |
| **Quota de `localStorage`**: serializar `{ input, envelope }` por beam guardada puede acumularse. | Low | Low | `try/catch` ya presente en los helpers. `saveBeam` lanza error si duplicate name; `updateSave` sobre-escribe silenciosamente. Sin acción extra. |
| **Inconsistencia con `BasesForm`** que setea `loadedSaveName` pero nunca `loadedSaveId` (causa "Guardar" dos veces lanza duplicate error). | Low | Med | Este change es **explícitamente la versión correcta** del patrón. Replicar el patrón bueno de los 5 forms restantes (`FormPage`, `ConcreteForm`, `RCColumnForm`, `ColumnForm`, `CartelForm`), no el bug de `BasesForm`. La spec del new capability `viga-continua-persistence` deja explícito que `setLoadedSaveId` y `setLoadedSaveName` van juntos. |
| **Persistencia de input-only vs resultados-only**: si el usuario guarda en la form y luego nunca va a results, no tiene snapshot del envelope. Si guarda en results, sí. Es la decisión D2 — pero podría confundir. | Low | Low | Documentado en el comportamiento esperado y en la spec. Los otros forms siguen exactamente este mismo split (form = input, results = input + result). Sin acción extra. |
| **Naming duplicado entre tipos**: si dos vigas continuas y dos losas comparten el mismo nombre, el `saveBeam` no detecta colisión porque filtra por `type`. | Low | Low | El `saveBeam` ya filtra por `(name, type)`. Sin colisión. Confirmado en storage.ts:84–89. |

## Sequencing

> **Decisión cerrada**: este change arranca **después** de que `viga-continua-modo-portico` mergee los 4 PRs a `main`.

Estado de `viga-continua-modo-portico` al momento de escribir esta propuesta:

- **PR1 — Cimientos + routing + selector**: ✅ aplicado.
- **PR2 — Solver pórtico**: ⏳ pendiente.
- **PR3 — PorticoForm**: ⏳ pendiente.
- **PR4 — PorticoResults + toggle Envolvente/Servicio aplicado a beam mode**: ⏳ pendiente.

Razones para esperar:

1. `viga-continua/shared/src/storage.ts` recibe cambios de **ambos** changes (SaveType + helpers). Si entran en simultáneo, conflicto seguro en el union y en los helpers nuevos.
2. `viga-continua/shared/src/SavedBeams.tsx` también recibe cambios de **ambos** (extensión del union `type`).
3. `VigaContinuaForm.tsx` y `VigaContinuaResults.tsx` reciben cambios del pórtico (botón "Nueva", toggle Envolvente/Servicio en PR1/PR4). Merge conflict probable si entra este change antes.

Estrategia del orchestrator: si se quiere acelerar, considerar **chained-PR sobre la rama del pórtico**: el último PR pórtico (PR4) deja `main` con todo lo pórtico integrado; desde ahí se branchea este change. Pero esto solo aplica si la estrategia de delivery global es `auto-chain` o `exception-ok` — **default es single-PR desde `main` ya limpio**.

Si durante el ciclo entran otros cambios no relacionados, mantener rebase contra `main` antes de merge.

## Rollback Plan

Este change es **puramente aditivo**:

- El nuevo miembro `"viga-continua"` del `SaveType` no afecta a ningún dato previo (no había entries con ese tipo antes).
- Los helpers nuevos (`saveVigaContinuaInput`, etc.) no rompen llamadas existentes — son funciones nuevas, no reemplazos.
- El wrapper `viga-continua/src/lib/storage.ts` es nuevo.
- `VigaContinuaState` gana dos campos **opcionales** — ningún consumidor previo rompe.
- Los botones Guardar en form y results son UI nueva — sin ellos la app sigue funcionando como antes (calcular → ver resultados → fin).

**Acción de rollback**: `git revert <merge-sha>` del PR único. Vigas guardadas bajo `type: "viga-continua"` quedan huérfanas en `localStorage` (son simplemente ignoradas por `getSavedBeams("concrete", "<otro tipo>")`), no rompen nada. El usuario puede limpiar su `localStorage` a mano si quiere.

**Acción de emergencia** (botón Guardar lanza error o corrompe estado): revert + smoke test sobre los 6 forms que ya usan este patrón para confirmar que la regresión está contenida en viga-continua.

## Open Decisions / Assumptions

Las 8 decisiones del orchestrator preflight (D1–D8) están **resueltas**. Solo queda una pregunta menor de UX que se confirma en `sdd-spec`:

- **D-UX-1**: ¿se vuelve a pedir el nombre en el segundo `prompt()` cuando se hace "Guardar corrección", o se sobre-escribe a ciegas con el `loadedSaveName`? **Recomendación**: re-preguntar (consistente con los otros forms). `sdd-spec` lo confirma o lo cambia a "sobre-escribe a ciegas" si el usuario lo prefiere. NO es bloqueante para arrancar este change.

Asunción que el spec debe validar:

- El payload de la form es exactamente `{ spans, supportTypes, loads }` (sin el `id` interno de `AnalysisLoad` ni wrappers extras). `sdd-spec` puede endurecerlo si quiere agregar versionado.

No quedan **product questions abiertas** para el usuario.

## What "Done" Looks Like

- `npm run lint:all && npm run typecheck:all && npm run build:all` corre verde.
- Smoke test manual del flujo:
  1. Editar form con 2 tramos y una carga → click Guardar → prompt → nombre "V1" → label cambia a "Guardar corrección" + aparece `<span>V1 (id=abc123)</span>`.
  2. Modificar un valor → click Guardar corrección → prompt → nombre "V1" otra vez → update del mismo id (NO error de duplicate).
  3. Hard refresh de la form → los valores vuelven (auto-persist).
  4. Click Calcular → navega a results → label del botón Guardar = "Guardar corrección".
  5. Click Guardar corrección en results → prompt → "V1" → save con payload `{ input, envelope }`.
  6. Re-abrir el form → click en "V1" en `<SavedBeams>` → campos se hidratan con el input del último save.
- El usuario valida visualmente que el patrón es consistente con los otros forms.
- El change se archiva en `openspec/changes/archive/YYYY-MM-DD-viga-continua-persistencia-nombrada/` con los 3 deltas merged.

## Estimated LoC (review-budget guard)

> **Delivery = single-pr**, **review budget = 400 líneas** (cached D1). Estimaciones honestas para que el orchestrator decida si cabe o si necesita chaining.

| File | LoC | Notas |
|---|---|---|
| `viga-continua/src/lib/storage.ts` (NEW) | ~30 | Wrapper thin, mismo patrón que `hormigon/src/lib/storage.ts`. |
| `viga-continua/src/lib/viga-continua.ts` | ~10 | Dos campos opcionales + JSDoc. |
| `viga-continua/shared/src/storage.ts` | ~85 | SaveType member + `VigaContinuaLastFormState` + 5 helpers + sección de comentarios. |
| `viga-continua/src/screens/VigaContinuaForm.tsx` | ~80 | Estado + handler + botón + hidratación + mount SavedBeams + useEffect. |
| `viga-continua/src/screens/VigaContinuaResults.tsx` | ~60 | Estado de `loadedSaveId` desde location.state + botón + handler con payload `{ input, envelope }`. |
| **Total code LoC** | **~265** | **Dentro del budget de 400** con margen. |

Specs / design / tasks (separados, no cuentan al budget de code):

- `openspec/changes/viga-continua-persistencia-nombrada/specs/viga-continua-persistence/spec.md` (NEW) — ~80 líneas.
- `openspec/changes/viga-continua-persistencia-nombrada/specs/viga-continua-state-payload/spec.md` (NEW) — ~25 líneas.
- `openspec/changes/viga-continua-persistencia-nombrada/specs/viga-continua-results-save/spec.md` (NEW) — ~50 líneas.
- `openspec/changes/viga-continua-persistencia-nombrada/design.md` (NEW) — ~120 líneas (secuencia form ↔ results).
- `openspec/changes/viga-continua-persistencia-nombrada/tasks.md` (NEW) — ~80 líneas.

## Success Criteria

- [ ] `sdd-archive` se ejecuta sin warnings destructivos: 3 specs nuevas (`viga-continua-persistence`, `viga-continua-state-payload`, `viga-continua-results-save`), 0 specs modificadas.
- [ ] El flujo Guardar → re-Guardar sobre el mismo id funciona en form y en results sin error de duplicate name.
- [ ] `<SavedBeams type="viga-continua">` lista los guardados bajo `app="concrete"` + `type="viga-continua"` y solo esos.
- [ ] Hard refresh de la form restaura el último estado vía `loadLastVigaContinuaFormState`.
- [ ] Beam mode no regresa: `viga-continua-analysis` y `viga-continua-routing` siguen pasando sus escenarios.
- [ ] El usuario valida que el botón Guardar aparece en **las dos pantallas** (form y results) y que el patrón es consistente con los otros seis forms.