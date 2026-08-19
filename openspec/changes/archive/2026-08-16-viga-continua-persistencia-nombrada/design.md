# Design: Viga Continua — Persistencia con Nombre

## 1. Technical Approach

`viga-continua/` (port 5175) gains the canonical "Guardar" pattern used by the other six forms: `loadedSaveId`+`loadedSaveName` pair, "Guardar"↔"Guardar corrección" toggle, `<SavedBeams type="viga-continua">` mount, per-app wrapper hardcoding `app="concrete"`. Results mirror the form: read `loadedSaveId`/`loadedSaveName` from `location.state`; persist `{ input, envelope }`. `SaveType` grows `"viga-continua"`; `VigaContinuaState` gains two optional fields. Reuses `saveBeam`/`updateSave` verbatim. Specs: R-vc-save-type/-storage-helpers/-wrapper/-state-payload/-form-save/-results-save/-savedbeams/-last-form/-affordance/-error.

## 2. Architecture Decisions

| # | Decision | Options | Choice | Why |
|---|---|---|---|---|
| D1 | `SaveType` member | `"viga-continua"` / reuse `"hormigon"` / reuse `"losa"` | **(a)** | Distinct analysis (no-RC, no-slab); reusing breaks `getSavedBeams` filter and per-type duplicate check (`storage.ts:84–89`). |
| D2 | Form payload | `{input}` only | **(a)** | Form has no envelope yet (`calculateBeamEnvelope` runs on submit). Mirrors form-vs-results split in `SlabForm`/`SlabResults`. |
| D3 | Save shape | `{input:{…}}` | **(b)** | Consistent with slabs/portico entries in `shared/src/storage.ts`. |
| D4 | Per-app wrapper | `viga-continua/src/lib/storage.ts` | **(a)** | Mirrors `hormigon/src/lib/storage.ts`, `acero/src/lib/storage.ts`. |
| D5 | Cross-route state | `location.state` | **(a)** | Form already uses it (`VigaContinuaForm.tsx:62–65`). Router state lossy on hard refresh — documented. |
| D6 | Results payload | `{input, envelope: BeamEnvelopeResult}` | **(a)** | Input = submit snapshot; envelope = already-rendered value. |
| D7 | Naming UI | `window.prompt` | **(a)** | All six other forms use it. |
| D8 | Re-save | Re-prompt + `updateSave` silent | **(a)** | Mirrors `FormPage.tsx:165–169`. `BasesForm` regression forbidden (§11). |
| D9 | Affordance | (a) subtitle (b) button prefix (c) chip | **(a)** | Subtitle slot exists (`FormPage.tsx:255`); chip crowds action row. |
| D10 | Errors | `alert(err.message)` | **(a)** | Matches `FormPage.tsx:177`, `RCColumnForm.tsx:416`, `SlabForm.tsx:229`. |

## 3. Data Flow

### 3.1 First save from form (loadedSaveId === null)

```
User→"Guardar"→prompt→name="v1"
 → saveVigaContinuaInput("v1",{spans,supportTypes,loads})
 → wrapper → saveBeam("concrete","v1","viga-continua",{input})
 → SavedBeam{id,name:"v1",type:"viga-continua",date}
 → setLoadedSaveId(id); setLoadedSaveName("v1")
 → Button "Guardar corrección"; subtitle "Editando: v1"
```

### 3.2 Re-save from form

```
User→"Guardar corrección"→prompt→name="v1"
 → updateVigaContinuaInput(loadedSaveId,{…})
 → wrapper → updateSave("concrete",id,{input})
 → id/name preserved; date bumped; no error.
```

### 3.3 First save from results

```
Results mounts; location.state.loadedSaveId===null
 [envelope already memoized from beamState]
 User→"Guardar"→prompt→name="v1"
 → saveVigaContinua("v1",{input,envelope})
 → setLoadedSaveId(returned.id); setLoadedSaveName("v1")
 → Button "Guardar corrección".
```

### 3.4 Re-save from results (cross-route)

```
Form onLoad→loadedSaveId="abc123"; Calcular
 → navigate("/viga-continua-results",
    {state:{spans,supportTypes,loads,loadedSaveId:"abc123",loadedSaveName:"v1"}})
 Results mount: useState<string|null>(state?.loadedSaveId ?? null)  // no flicker
 User→"Guardar corrección"→prompt→updateVigaContinua(loadedSaveId,{input,envelope})
```

### 3.5 Load from `<SavedBeams>`

```
<SavedBeams app="concrete" type="viga-continua" onLoad={…} />
 User→"Cargar" on {id:"abc123",name:"v1"}
 onLoad:
   setLoadedSaveId("abc123"); setLoadedSaveName("v1");   // TOGETHER
   hydrate spans/supportTypes/loads from data.input (typeof==="number" guards)
 Button→"Guardar corrección"; Calcular carries the id through.
```

## 4. File Changes

| File | Action | Description |
|---|---|---|
| `viga-continua/shared/src/storage.ts` | Modify | Add `"viga-continua"` to `SaveType` (line 49). Add `LAST_VIGA_CONTINUA_FORM_KEY`. Add `VigaContinuaLastFormState`, `VigaContinuaSavedData`, `saveLast/loadLast`, `saveVigaContinuaInput/updateVigaContinuaInput`, `saveVigaContinua/updateVigaContinua`, `getSavedVigasContinuas`, `loadVigaContinua`, `deleteVigaContinua`. |
| `viga-continua/shared/src/SavedBeams.tsx` | Modify | Add `"viga-continua"` to `type` union. Add `vigaContinuaSummary(data)`→`{spans,loads}`. Render branch for that type. |
| `viga-continua/src/lib/storage.ts` | **Create** | Thin wrapper. Hardcode `app="concrete"` in generics; re-export viga-continua helpers. |
| `viga-continua/src/lib/viga-continua.ts` | Modify | Add `loadedSaveId?:string` + `loadedSaveName?:string` to `VigaContinuaState`. JSDoc: paired or absent. |
| `viga-continua/src/screens/VigaContinuaForm.tsx` | Modify | Add `loadedSaveId`/`loadedSaveName` state, `useLocation`, `useEffect`→`saveLastVigaContinuaFormState`, `handleSave`, `<SavedBeams app="concrete" type="viga-continua" onLoad={…}>`, "Guardar" button, subtitle update. |
| `viga-continua/src/screens/VigaContinuaResults.tsx` | Modify | Seed `loadedSaveId`/`loadedSaveName` from `location.state`. Add `handleSave` + "Guardar" button in header. Payload `{input, envelope}`; envelope snapshotted (no re-solve). |
| `viga-continua/src/lib/beam-envelope.ts` | No change | `BeamEnvelopeResult` already exported. |

## 5. API Contracts

### 5.1 `shared/src/storage.ts` additions

```ts
export type SaveType |= "viga-continua";

export interface VigaContinuaLastFormState {
  spans: number[]; supportTypes: SupportType[];
  loads: Array<{id:string; type:"point"|"distributed"; D:number; L:number;
                 position?:number; start?:number; end?:number}>;
  loadedSaveId?: string; loadedSaveName?: string;
}
export function saveLastVigaContinuaFormState(s: VigaContinuaLastFormState): void;
export function loadLastVigaContinuaFormState(): VigaContinuaLastFormState | null;

export interface VigaContinuaInputData { input: VigaContinuaInput; }
export function saveVigaContinuaInput(name: string, input: VigaContinuaInput): SavedBeam;
export function updateVigaContinuaInput(id: string, input: VigaContinuaInput): SavedBeam | null;

export interface VigaContinuaSavedData { input: VigaContinuaInput; envelope: BeamEnvelopeResult; }
export function saveVigaContinua(name: string, d: VigaContinuaSavedData): SavedBeam;
export function updateVigaContinua(id: string, d: VigaContinuaSavedData): SavedBeam | null;

export function getSavedVigasContinuas(): SavedBeam[];
export function loadVigaContinua(id: string): VigaContinuaSavedData | null;
export function deleteVigaContinua(id: string): void;
```

`VigaContinuaInput` is a structural alias of `VigaContinuaState` minus the optional id/name (shared/ does not import from src/, same pattern as `PorticoState` at `storage.ts:502–523`).

### 5.2 `src/lib/storage.ts` (NEW)

```ts
// Re-export viga-continua helpers as-is.
// Hardcode app="concrete" in generics:
export function listSaves(): shared.SavedBeam[] { return shared.listSaves("concrete"); }
export function saveBeam(name, type, data) { return shared.saveBeam("concrete", name, type, data); }
export function updateSave(id, data) { return shared.updateSave("concrete", id, data); }
export function deleteSave(id) { return shared.deleteSave("concrete", id); }
export function getSavedBeams(type) { return shared.getSavedBeams("concrete", type); }
```

### 5.3 `src/lib/viga-continua.ts` (delta)

```ts
export interface VigaContinuaState {
  spans: number[]; supportTypes: SupportType[]; loads: AnalysisLoad[];
  /** Set together with loadedSaveName. Absent on cold open. */
  loadedSaveId?: string;
  loadedSaveName?: string;
}
```

## 6. State Management

| Field | Lives in | Initial source | Updated by | Crosses route? |
|---|---|---|---|---|
| `loadedSaveId`/`loadedSaveName` | form + results | `location.state` → `loadLast…` → `null` | `<SavedBeams>.onLoad` (paired); `handleSave` (paired) | Yes — `location.state`. |
| Form fields | form | router state > last-form > defaults | inputs | Yes. |
| Auto-persist | `localStorage[concrete:last_viga_continua_form]` | n/a | `useEffect` | No; does NOT auto-promote to edit mode (§11.3). |

Hydration priority mirrors `FormPage.tsx:21–35`.

## 7. UI Decisions

**Affordance (subtitle):**
```tsx
<p className="text-sm text-text-muted">
  {loadedSaveName ? `Editando: ${loadedSaveName}`
                   : "Análisis estructural — envolvente de esfuerzos"}
</p>
```
Slot exists; copy matches `FormPage.tsx:255`. Reinforced by button label switch.

**Button:**
```tsx
<button onClick={handleSave}
        className="bg-surface-alt border border-border text-text-muted font-semibold px-6 py-3 rounded-lg hover:bg-surface transition-colors">
  {loadedSaveId ? "Guardar corrección" : "Guardar"}
</button>
```
Mirrors `FormPage.tsx:639–645`, `RCColumnForm.tsx:1038–1044`. Reuses Tailwind tokens — no new tokens.

## 8. Error Handling

- **Duplicate name** → `alert(err.message)` from `try/catch`; no partial mutation; `loadedSaveId` stays `null`. (`FormPage.tsx:174–178`.)
- **Quota in auto-persist** → silently swallowed (`storage.ts:399–407`).
- **Prompt cancelled (empty)** → early return; nothing written.
- **Hard refresh on results** → `location.state` empty → `loadedSaveId===null` → next click creates new save (R-vc-state-payload).
- **JSON.parse failure** in `loadLast…` → returns `null`; form falls back to defaults.

## 9. Sequencing & Merge Strategy

`viga-continua-modo-portico` PR4 must merge to `main` first (adds `SaveType += "portico"` + portico helpers). Our `"viga-continua"` appends at union end → conflict-free.

| File | Pórtico delta | Our delta | Conflict? |
|---|---|---|---|
| `shared/src/storage.ts` | `"portico"` + portico helpers | `"viga-continua"` + viga-continua helpers | No (separate members/sections). |
| `shared/src/SavedBeams.tsx` | `"portico"` type + `porticoSummary` | `"viga-continua"` type + `vigaContinuaSummary` | No (different branches). |
| `VigaContinuaForm.tsx` | `ModeSelector`, "Nueva" | "Guardar", SavedBeams, auto-persist | Possible on action row. Resolve: keep Calcular/Nueva in place; add Guardar as rightmost. |
| `VigaContinuaResults.tsx` | `EnvToggle` | "Guardar", `loadedSaveId` seeding | Possible in header actions. Resolve: append button right of `EnvToggle`/`Volver`. |

Delivery: single-PR, ~265 LoC (within 400-line budget). Chained-PR onto pórtico branch acceptable if PR4 is still open.

## 10. Out of Scope

- No autosave of `loadedSaveId` across hard refresh on results.
- No custom naming modal — `window.prompt` only.
- No new storage backend — `localStorage` only.
- No migration — `"viga-continua"` tag is new; prior saves untouched.
- No mirror to `apps/hormigon/`.
- No re-solve inside save handler on results (envelope snapshotted).
- No unit tests (no runner; verification = `lint:all`+`typecheck:all`+`build:all`+smoke).

## 11. Anti-Regression: the `BasesForm` Bug

`hormigon/src/screens/BasesForm.tsx:140–149` sets `loadedSaveName` but **never** sets `loadedSaveId`. Button label always "Guardar"; handler always calls `saveBeam` → second click with same name throws `Ya existe un elemento guardado con el nombre "X"` (`storage.ts:88`).

**This change MUST NOT replicate that bug:**

1. `<SavedBeams>.onLoad` MUST call `setLoadedSaveId(save.id)` AND `setLoadedSaveName(save.name)` together — never one without the other (R-vc-persistence).
2. `handleSave` after the first `saveBeam` MUST call both setters — `setLoadedSaveId(returned.id)` + `setLoadedSaveName(name)`. `FormPage.tsx:174–178` is inconsistent here; our handler MUST be explicit (R-vc-persistence §"First save").
3. Auto-persist `useEffect` MUST NOT auto-promote into "edit existing" mode. Only explicit user action (Guardar click, Cargar in SavedBeams) sets `loadedSaveId` — otherwise a hard refresh after editing-but-not-saving could silently switch the button to "Guardar corrección" and a subsequent click would `updateSave` against a non-existent id (R-vc-state-payload §"Auto-persist does not invent a save id").

## 12. Open Questions for sdd-apply

**None.** All decisions D1–D10 locked in proposal §Approach and R-vc-* specs. Minor choices the implementer may make without re-asking: (a) `vigaContinuaSummary` chip string (recommend `"Viga · Tramos: {N}, Cargas: {M}"`, mirroring portico chip); (b) `VigaContinuaInput` as type alias vs separate interface in shared/ (recommend separate structural interface — same pattern as `PorticoState` `storage.ts:502–523`).
