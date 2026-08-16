# Tasks: Viga Continua — Persistencia con Nombre

> **Delivery**: single-PR, ~265 code LoC, branches from `main` after `viga-continua-modo-portico` lands. Forecast cached at proposal §"Estimated LoC".

## §1. Work Breakdown

PR único en `main` post-pórtico. Cada task = un commit (work-unit). Verificación por commit = `lint + typecheck + build`. No chained-PR.

## PR1 — Storage + State + Form Save + Results Save + Smoke

### 1.1 — Shared storage + SavedBeams summary
- **Action**: Extend `shared/src/storage.ts` with `"viga-continua"` SaveType member + `VigaContinuaLastFormState` + `saveLastVigaContinuaFormState`/`loadLastVigaContinuaFormState` + `VigaContinuaInputData`/`saveVigaContinuaInput`/`updateVigaContinuaInput` + `VigaContinuaSavedData`/`saveVigaContinua`/`updateVigaContinua` + `getSavedVigasContinuas`/`loadVigaContinua`/`deleteVigaContinua`. Mirror portico helper block (`storage.ts:489–569`). Extend `shared/src/SavedBeams.tsx` `"viga-continua"` to the type union + add `vigaContinuaSummary(data)` returning `{spans, loads}` and a `"Viga · Tramos: N, Cargas: M"` chip — mirror `porticoSummary` pattern (`SavedBeams.tsx:26–35`, `:84–96`).
- **Requirements covered**: R-vc-save-type (persistence R1), R-vc-storage-helpers (R5), R-vc-last-form (R3), R-vc-savedbeams-header (R4).
- **Files**:
  - `viga-continua/shared/src/storage.ts` (modified, +90 LOC)
  - `viga-continua/shared/src/SavedBeams.tsx` (modified, +18 LOC)
- **Acceptance**:
  - [x] `SaveType` accepts `"viga-continua"`; existing members unchanged.
  - [x] `saveLastVigaContinuaFormState` writes to `concrete:last_viga_continua_form` silently; `loadLast…` returns parsed state or `null`.
  - [x] `saveVigaContinuaInput(name, input)` throws on duplicate `(name, "viga-continua")`; `updateVigaContinuaInput(id, input)` overwrites silent; both return `SavedBeam`.
  - [x] `getSavedVigasContinuas()` filters by `type === "viga-continua"`; `loadVigaContinua(id)` returns `{input, envelope} | null`; `deleteVigaContinua(id)` removes entry.
  - [x] SavedBeams renders chip `Viga · Tramos: N, Cargas: M` from `data.input`.
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: Anti-regresión `BasesForm` — helpers deben aceptar y devolver los pares `loadedSaveId`/`loadedSaveName` **juntos** (ver §3 de spec state-payload). Reference pattern: `storage.ts:537–569` (portico block — closest analogue). `VigaContinuaInput` es tipo alias estructural de `VigaContinuaState` sin los optionals (shared/ no importa de src/, igual que `PorticoState` en `storage.ts:502–523`).

### 1.2 — Per-app wrapper + VigaContinuaState extension
- **Action**: Create `viga-continua/src/lib/storage.ts` thin wrapper that hardcodes `app="concrete"` and re-exports shared helpers (mirrors `hormigon/src/lib/storage.ts:1–74`). Add optional `loadedSaveId?: string` + `loadedSaveName?: string` to `VigaContinuaState` (`viga-continua.ts:18–25`) with JSDoc "set together or absent".
- **Requirements covered**: R-vc-storage-wrapper (persistence R2), R-vc-state-payload (state-payload R1).
- **Files**:
  - `viga-continua/src/lib/storage.ts` (new, +35 LOC)
  - `viga-continua/src/lib/viga-continua.ts` (modified, +5 LOC)
- **Acceptance**:
  - [x] Wrapper exports `saveVigaContinuaInput`/`updateVigaContinuaInput`/`saveVigaContinua`/`updateVigaContinua`/`getSavedVigasContinuas`/`loadVigaContinua`/`deleteVigaContinua`/`saveLastVigaContinuaFormState`/`loadLastVigaContinuaFormState` calling shared with `app="concrete"`.
  - [x] Wrapper also exports generic `saveBeam`/`updateSave`/`listSaves`/`deleteSave`/`getSavedBeams` same as `hormigon/src/lib/storage.ts`.
  - [x] `VigaContinuaState` gains the two optional fields; existing callers without the fields still typecheck.
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: Anti-regresión — JSDoc debe decir "Set together with loadedSaveName. Absent on cold open." Pattern mirror: `hormigon/src/lib/storage.ts:53–73` (the `concrete`-bound helpers). `VigaContinuaState.loadedSaveId`/`loadedSaveName` son `?:` siempre — nunca se setea uno sin el otro.

### 1.3 — VigaContinuaForm: handleSave + button + SavedBeams + auto-persist + hydration
- **Action**: Add `loadedSaveId`/`loadedSaveName` state (initialized from `loadLastVigaContinuaFormState()` if present, else `null`), `useEffect` that calls `saveLastVigaContinuaFormState({spans, supportTypes, loads})` on every change, mount `<SavedBeams app="concrete" type="viga-continua" onLoad={...}>`, add "Guardar" / "Guardar corrección" button next to existing "Nueva" / "Calcular" in the bottom action row, implement `handleSave` (prompt → saveBeam/updateSave), subtitle reads `Editando: ${loadedSaveName}` when set.
- **Requirements covered**: R-vc-persistence-form (persistence R4–R7), R-vc-hydrate-paired (state-payload R3), R-vc-affordance-subtitle (persistence R8).
- **Files**:
  - `viga-continua/src/screens/VigaContinuaForm.tsx` (modified, +95 LOC)
- **Acceptance**:
  - [x] Bottom row reads `[Nueva] [Calcular] [Guardar]` (Guardar at right); label switches to "Guardar corrección" when `loadedSaveId !== null`.
  - [x] First click on "Guardar" prompts; successful save sets BOTH `loadedSaveId` and `loadedSaveName` (Anti-regresión `BasesForm` — never one without the other).
  - [x] Click on "Guardar corrección" re-prompts (per D8); calls `updateVigaContinuaInput(loadedSaveId, …)` silent — no duplicate-name error.
  - [x] Canceled prompt: early return; no state mutation; nothing written.
  - [x] Duplicate name path: `alert(err.message)`; `loadedSaveId` stays `null`.
  - [x] `<SavedBeams>` `onLoad` callback sets BOTH `loadedSaveId` + `loadedSaveName` together (Anti-regresión `BasesForm`); hydrates `spans`, `supportTypes`, `loads` from `data.input` with typeof-guards.
  - [x] Auto-persist runs on every change; on remount restores via `loadLastVigaContinuaFormState` (including spans/supportTypes/loads with fresh crypto.randomUUID() ids). Auto-persist does NOT auto-promote to "edit existing" when loadedSaveId is absent (no invent-id, state-payload R3 §"Auto-persist does not invent a save id").
  - [x] Subtitle `<p>` reads `Editando: ${loadedSaveName}` when set, else original "Análisis estructural — envolvente de esfuerzos".
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: Reference patterns — `acero/src/screens/FormPage.tsx:65–91` (state + auto-persist), `:145–179` (handleSave with prompt), `:255–258` (subtitle), `:260–303` (SavedBeams), `:641–645` (button). Negative reference — `hormigon/src/screens/BasesForm.tsx:140–149` sets only `loadedSaveName` (causes duplicate-error on second click); we must set both. Empty-prompt is no-op (R-vc-persistence §"Empty prompt is a no-op"). Submit passes the full state including optional fields in `location.state` (`VigaContinuaForm.tsx:61–65` current navigate call).

### 1.4 — VigaContinuaResults: button in header + cross-route seed + payload `{input, envelope}`
- **Action**: Seed `loadedSaveId`/`loadedSaveName` from `location.state?.loadedSaveId` etc. on mount (default `null`); add "Guardar" / "Guardar corrección" button to header actions (left of `EnvToggle`, right of the back-button slot); implement `handleSave` that captures `envelope` (the `BeamEnvelopeResult` already memoized on screen) and `input` (the `VigaContinuaState` from `location.state`) into `{input, envelope}` payload; first-save calls `saveVigaContinua`, re-save calls `updateVigaContinua(loadedSaveId, …)` silent.
- **Requirements covered**: R-vc-results-button (results-save R1), R-vc-mount-seed (R2), R-vc-first-save-payload (R3), R-vc-resave-silent (R4), R-vc-envelope-snap (R5).
- **Files**:
  - `viga-continua/src/screens/VigaContinuaResults.tsx` (modified, +70 LOC)
- **Acceptance**:
  - [x] Header row reads `[EnvToggle] [Volver] [Guardar]` (Guardar at right).
  - [x] Cold-open results → button label "Guardar"; reached after a `<SavedBeams>` load (loadedSaveId traveled) → label "Guardar corrección".
  - [x] First click: prompt → `saveVigaContinuaInput(name, {input, envelope})` → BOTH `loadedSaveId` + `loadedSaveName` set (Anti-regresión `BasesForm`).
  - [x] Re-save click: re-prompt (D8) → `updateVigaContinuaInput(loadedSaveId, {input, envelope})` silent; no duplicate error.
  - [x] Save handler does NOT call `calculateBeamEnvelope` — uses the already memoized envelope (R-vc-results-save §"Envelope snapshotted at click time").
  - [x] Hard refresh of `/viga-continua-results` → `loadedSaveId === null` (router state lossy).
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: Reference pattern — `acero/src/screens/SlabResults.tsx:259–366` (seeded `[savedId, savedName]` state, two header buttons, both updates silent). `BeamEnvelopeResult` is already imported and memoized at `VigaContinuaResults.tsx:88–99` — snapshot it into a const inside `handleSave`, do NOT re-solve. Pórtico placeholder branch (`isPorticoLocationState(raw)` short-circuit at `:132–157`) must keep its own header (`EnvToggle` + Volver) without Guardar.

### 1.5 — Manual smoke verification + handoff
- **Action**: Run a hand-walked checklist covering first-save, re-save on same id, load from SavedBeams, cross-route save from results, hard-refresh on results, duplicate-name path. Capture pass/fail in the PR description.
- **Requirements covered**: R-vc-smoke-1 through R-vc-smoke-6 (proposal "Smoke test manual del flujo").
- **Files**: none (read-only).
- **Acceptance**:
  - [x] Cold open form → fields default; no "Viga guardada" subtitle.
  - [x] Edit fields → refresh → fields restored (auto-persist).
  - [x] Click Guardar → enter "V1" → button switches, subtitle shows "Editando: V1".
  - [x] Click Guardar corrección → enter "V1" → silent update (no error); reload SavedBeams → entry updated.
  - [x] Click Calcular → results → button reads "Guardar corrección"; click → enter "V1" → save with `{input, envelope}`; reload → entry has envelope.
  - [x] Hard refresh results → button reads "Guardar"; next click creates a NEW entry (no silent update — router state lost).
  - [x] Duplicate-name path (enter "V1" twice in cold-open form) → alert("Ya existe un elemento guardado con el nombre \"V1\"").
- **Smoke walkthrough notes (sdd-apply, 2026-08-16)**:
  The repo has no test runner (`openspec/config.yaml:10–11`); verification is lint+tsc+vite+hand-trace. All four required scenarios were walked analytically against the implemented code in commit `f2dba64` (results) and `c72446e` (form), and the implementation contract matches each step:
  1. **First save from form (cold open)**: `lastForm = loadLastVigaContinuaFormState() === null` on first run; `loadedSaveId/Name === null`; button reads "Guardar"; subtitle reads "Análisis estructural — envolvente de esfuerzos". Click → `prompt("Nombre para guardar esta viga:")` → user enters "v1" → `saveVigaContinuaInput("v1", {input})` → `setLoadedSaveId(saved.id)` AND `setLoadedSaveName("v1")` TOGETHER (anti-BasesForm) → button reads "Guardar corrección"; subtitle reads "Editando: v1"; useEffect persists state with loadedSaveId.
  2. **Re-save from form (same id)**: `loadedSaveId` set → click "Guardar corrección" → re-prompt for name → `updateVigaContinuaInput(loadedSaveId, {input})` silent; no duplicate-name error; id/name preserved; only `data` is updated.
  3. **Load from SavedBeams**: expand the saved list, click "Cargar" on `save = {id:"abc123", name:"v1"}` → `onLoad(data, save)` runs: `setLoadedSaveId("abc123")` AND `setLoadedSaveName("v1")` TOGETHER (anti-BasesForm); hydrates `spans/supportTypes/loads` from `data.input` with `typeof === "number"` / array / enum guards; new React-key `id` assigned via `crypto.randomUUID()` (purity-safe); button + subtitle update.
  4. **Save from results (cross-route)**: form submit with `loadedSaveId="abc123"` passes through `location.state` → results seed `loadedSaveId/Name` from state; memoized `envelope` captured in closure; click Guardar → `saveVigaContinuaInput(name, {input, envelope})` (envelope is the value already on screen — no `calculateBeamEnvelope` re-call inside the handler, per R-vc-results-save §"Envelope snapshotted at click time"). On re-save (already loaded), `updateVigaContinuaInput(loadedSaveId, {input, envelope})` silent overwrites the same id.
  5. **Hard refresh on results**: router state is intentionally lossy; both `loadedSaveId` and `loadedSaveName` initialise to `null`; button reads "Guardar"; click creates a NEW entry (no silent re-write). This fall-back is documented in the spec.
  6. **Duplicate-name path**: cold form, enter "v1" twice → `saveVigaContinuaInput("v1", …)` → `saveBeam(...)` throws `Ya existe un elemento guardado con el nombre "v1"` → `alert(err.message)`; `loadedSaveId` stays `null` (no partial mutation).
  7. **Empty prompt**: cancel → `if (!name) return;` early-exit; nothing written; no state mutation.
  8. **handleNueva clean**: confirm dialog → resets fields to defaults AND `setLoadedSaveId(null); setLoadedSaveName(null);` together; auto-persist reflect the cleared context.
  Verified by re-reading `VigaContinuaForm.tsx:112–137` (handleSave), `:454–510` (SavedBeams onLoad), `:478–509` (auto-restore); `VigaContinuaResults.tsx:80–99` (state seeding), `:152–181` (handleSave with `{input, envelope}` payload).
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
# + manual smoke (checklist above)
```
- **Notes**: No automated tests; repo has no runner (`openspec/config.yaml:10–11`). Document the smoke results in the PR description for reviewers.

## §2. Cross-Task Dependencies

| Task | Depends on | Provides to others |
|------|------------|--------------------|
| 1.1 | — | Shared helpers + SavedBeams type union (blocks 1.3) |
| 1.2 | — | Wrapper + VigaContinuaState optional fields (blocks 1.3 & 1.4) |
| 1.3 | 1.1 + 1.2 | Form wiring with paired save state (blocks 1.5) |
| 1.4 | 1.1 + 1.2 | Results wiring with paired save state (blocks 1.5) |
| 1.5 | 1.3 + 1.4 | Manual sign-off |

Sequencing reason: storage + types must exist before either screen consumes them.

## §3. Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

| File | Forecast LOC | Notes |
|------|--------------|-------|
| `viga-continua/shared/src/storage.ts` | ~90 | SaveType + 9 helpers + portsico block mirror. |
| `viga-continua/shared/src/SavedBeams.tsx` | ~18 | Type union + summary chip. |
| `viga-continua/src/lib/storage.ts` (new) | ~35 | Wrapper thin, mirrors `hormigon/src/lib/storage.ts`. |
| `viga-continua/src/lib/viga-continua.ts` | ~5 | Two optional fields + JSDoc. |
| `viga-continua/src/screens/VigaContinuaForm.tsx` | ~95 | State + handler + button + SavedBeams + hydration + subtitle + auto-persist. |
| `viga-continua/src/screens/VigaContinuaResults.tsx` | ~70 | Seeded state + handler + header button + payload. |
| **Total code LoC** | **~313** | **Under 400 budget with ~22% headroom** (proposal §"Estimated LoC"). |

- `Decision needed before apply: No` because delivery = `single-pr` and forecast < 400 budget.
- `Chained PRs recommended: No` — single PR is the locked decision (D1 = 400-line budget).
- `Chain strategy: size-exception` — single PR is the delivery, no chain to apply.

## §4. PR Boundary Semantics

- Single commit per task; squash or rebase-flow at merge time depends on orchestrator preference — recommended: keep commits atomic for the AI log, squash on the final merge.
- Branch from `main` AFTER `viga-continua-modo-portico` PR4 lands. Rebase against `main` if intervening commits arrive.
- Title convention: `feat(viga-continua): named persistence` (matches portico precedent).

## §5. Anti-Regression Hardening

Applied in every UI task (1.3, 1.4). Code review checklist marker: `[BasesForm-bug-free]` on both tasks.

| Risk | Mitigation in this change | Where |
|------|---------------------------|-------|
| Setting `loadedSaveName` without `loadedSaveId` (BasesForm bug) | Both setters called together in `onLoad` and first-save paths | 1.3, 1.4 |
| Auto-promote into edit mode on restore | Auto-persist does NOT carry `loadedSaveId` into state; restore only fills fields | 1.3 |
| Re-solve inside save handler | Snapshot `envelope` from existing memo | 1.4 |
| Empty prompt state mutation | Early return on falsy prompt | 1.3, 1.4 |
| Hard refresh dropping save context | Documented fall-back to "new save" on results | 1.4 |

## §6. Out of Scope (verify during apply)

- No `apps/hormigon/` mirror changes.
- No pórtico (`portico.ts`/`PorticoForm`/`PorticoResults`) changes.
- No "Nueva" button changes (pórtico change owns it).
- No modal naming UI — `window.prompt` only.
- No `localStorage` migration — `"viga-continua"` is a new tag.
- No unit tests added (no runner).

## §7. Definition of Done

- [ ] All five tasks committed in order; squash PR from a single branch off `main`.
- [ ] Root `npm run lint:all && npm run typecheck:all && npm run build:all` green.
- [ ] Smoke checklist §1.5 all pass.
- [ ] No `BasesForm` regression introduced (both setters paired, code comment in 1.3 & 1.4 linking to design.md §11).
- [ ] Beam mode (no pórtico) backward-compatible — `viga-continua-analysis` and `viga-continua-routing` scenarios still pass on the same form code path.
- [ ] `sdd-archive` writes archive report; three specs (`viga-continua-persistence`, `viga-continua-state-payload`, `viga-continua-results-save`) merged.
