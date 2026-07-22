# Delta for bases

## ADDED Requirements

### Requirement: designBase pure function contract

The system SHALL export a pure function `designBase(input: BaseInput): BaseResult` from `client/src/lib/bases-calc.ts` with no side effects, no React dependencies, and no DOM access.

`BaseInput` MUST include: `qa` (kN/cm²), `Df` (cm), `PD`, `PL` (kN), `cx`, `cy` (cm), `fc`, `fy` (MPa), `type` (`"centrada" | "medianera"`), optional `subType` (`"viga-de-fundacion" | "tensor"`), optional overrides (`B`, `L`, `h`), optional `Lcol`, `H`, `mu`, `cover` (default 5 cm), `rebD`.

`BaseResult` MUST include: `B`, `L`, `h` (cm), `Pu` (kN), `qu` (kN/cm²), `punchOK`, `beamShearOK`, `flexOK`, `As`, `AsMin` (cm²), `db` (mm), `sep` (cm), `nBars`, `steps` (string[]). For medianera: additionally `e`, `Mu`, `Tu` or `Ru`, `As_sup`, `h_viga` or `h_tensor`.

#### Scenario: Happy path — centrada design completes all 13 steps

- GIVEN `{ type: "centrada", qa: 0.02, Df: 100, PD: 300, PL: 150, cx: 30, cy: 30, fc: 25, fy: 420 }`
- WHEN `designBase(input)` is called
- THEN the result contains non-zero `B`, `L`, `h`, `Pu`, `qu`, `As`, `db`, `sep`
- AND `punchOK` is `true`, `beamShearOK` is `true`
- AND `steps.length` equals 13

#### Scenario: Invalid input — zero bearing capacity handled

- GIVEN `{ type: "centrada", qa: 0, ... }`
- WHEN `designBase(input)` is called
- THEN the function SHALL throw an error with a descriptive message in Spanish
- OR return a result with `B = 0`, `steps` explaining the failure

#### Scenario: Medianera viga-de-fundacion returns beam-specific fields

- GIVEN `{ type: "medianera", subType: "viga-de-fundacion", Lcol: 300, cx: 30, cy: 30, PD: 200, PL: 100, fc: 25, fy: 420 }`
- WHEN `designBase(input)` is called
- THEN result includes `e`, `Mu`, `Ru`, `As_sup`, `h_viga` > 0
- AND `steps` describe the viga-de-fundacion procedure

#### Scenario: Medianera tensor returns tension-specific fields

- GIVEN `{ type: "medianera", subType: "tensor", H: 80, cx: 30, cy: 30, PD: 200, PL: 100, mu: 0.4, fc: 25, fy: 420 }`
- WHEN `designBase(input)` is called
- THEN result includes `Tu`, `As` (tension steel), and `h_tensor` > 0
- AND `steps` include friction check with PD·μ vs Tu comparison

### Requirement: Centrada 13-step procedure

The `designBase()` function for `type: "centrada"` SHALL execute the following 13 steps in order, recording intermediate results in the `steps` array:

| Step | Computation | Unit |
|------|------------|------|
| 1 | `A_base = (PD + PL) * 1.10 / qa` | cm² |
| 2 | `Pu = max(1.4*PD, 1.2*PD + 1.6*PL)` | kN |
| 3 | `kamin = 2.8 / (0.85*fc)` | adimensional |
| 4 | `qu = Pu / (Lx*Ly)` | kN/cm² |
| 5 | `kx = (Lx-cx)/2`, `ky = (Ly-cy)/2`; `Mux = qu*Ly*kx²/2`, `Muy = qu*Lx*ky²/2` | kN·cm |
| 6 | `Mnx = Mux/0.90`, `Mny = Muy/0.90` | kN·cm |
| 7 | Predimension: `d = max((Lx-cx)/3, (Ly-cy)/3)` (rigidity), OR optional `dx = sqrt(6.5*Mnx/(by*fc))` | cm |
| 8 | Punching: `Pu - qu*A0 ≤ 0.75*F*b0*d*sqrt(fc)/12` | — |
| 9 | Shear: Vux ≤ 0.75·bwy·dx·√fc/6, Vuy ≤ 0.75·bwx·dy·√fc/6 | — |
| 10 | Flexural steel: `mn = Mn/(0.85*b*d²*fc)`, `As = ka*0.85*d*b*fc/fy`, `ka ≥ kamin` | cm² |
| 11 | `h = d + cover` (cover default 5 cm, `h ≥ 30 cm`) | cm |
| 12 | Heel check: `h - kmin ≥ 25 cm` (troncopiramidal) | — |
| 13 | Spacing: `sep = (L - 10) / (nBars - 1) ≤ min(25*db, 30 cm)` | cm |

All forces in kN, lengths in cm, stresses in MPa. Unit conversions SHALL be explicit in `steps` comments.

#### Scenario: Centrada happy path produces dimensioned results

- GIVEN `{ type: "centrada", qa: 0.02, Df: 100, PD: 400, PL: 200, cx: 40, cy: 40, fc: 25, fy: 420 }`
- WHEN `designBase(input)` is called
- THEN `B > cx`, `L > cy`, `h ≥ 30`, `As > AsMin`
- AND `punchOK` and `beamShearOK` are both `true`

#### Scenario: Manual overrides bypass predimensioning

- GIVEN `{ type: "centrada", B: 120, L: 120, h: 40, ... }` with explicit dimension overrides
- WHEN `designBase(input)` is called
- THEN step 7 (predimension) is skipped
- AND steps 8-13 use the provided `B`, `L`, `h` directly

### Requirement: Bases form — structure and navigation

The system SHALL render `BasesForm` at `/bases` with input fields grouped by section: Suelo (qa, Df), Materiales (fc, fy), Geometría columna (cx, cy), Tipo de base (Centrada | Medianera), Cargas (PD, PL), Armado (cover, rebD). For Medianera, a sub-selector SHALL appear: Viga de fundación (shows Lcol in cm) | Tensor (shows H in cm, μ).

Submit SHALL call `designBase()` and navigate to `/bases-results` with `{ input, name?, saveId? }` in React Router state.

#### Scenario: Centrada form fills and submits

- GIVEN the user is at `/bases`
- WHEN they enter qa=0.02, Df=100, fc=25, fy=420, cx=30, cy=30, PD=300, PL=150, select "Centrada", and click "Calcular"
- THEN `designBase()` is called with those inputs
- AND the browser navigates to `/bases-results` with `state.input` matching the form values

#### Scenario: Medianera form shows sub-selector

- GIVEN the user selects "Medianera" in the type selector
- WHEN the form re-renders
- THEN a sub-selector "Viga de fundación" | "Tensor" appears
- AND "Centrada"-only fields (qa-based predimension hint) are hidden or re-labeled

#### Scenario: Missing required fields blocks submit

- GIVEN the user has not entered `PD` or `qa`
- WHEN they click "Calcular"
- THEN the form SHALL show inline validation errors in Spanish
- AND no navigation occurs

### Requirement: Column data loading from saved RC columns

The form SHALL include a dropdown "Cargar columna guardada" that reads all saves with `type === "rc-columna"` via `getSavedBeams("rc-columna")` and displays `{id, name}`. On selection, the system SHALL extract `PD`, `PL`, `cx`, `cy` from `save.data` (with defensive `typeof` checks for each field) and populate the corresponding form inputs, plus display the column name as a label.

#### Scenario: Loading a saved RC column populates form fields

- GIVEN a saved RC column `{ id: "abc", name: "C1", data: { PD: 350, PL: 180, Cx: 40, Cy: 40 } }` exists in localStorage
- WHEN the user opens the "Cargar columna guardada" dropdown and selects "C1"
- THEN form fields PD, PL, cx, cy are set to 350, 180, 40, 40
- AND the column name "C1" is displayed near the dropdown

#### Scenario: Malformed save data handled defensively

- GIVEN a saved RC column with `data: { PD: "350" }` (string instead of number) and missing PL, Cx, Cy
- WHEN the user selects that save
- THEN only PD is populated (after `typeof` check), remaining fields keep current values
- AND no error is thrown

### Requirement: Auto-save form state on change

The system SHALL automatically persist `BasesFormState` to localStorage key `"mascalculador_last_bases_form"` on every form field change, using a `useEffect` with a `mountedRef` guard to skip the initial render.

The form SHALL initialize using priority: React Router `location.state` > last saved form state > hardcoded defaults.

#### Scenario: Auto-save fires on field change

- GIVEN the user edits `qa` from default to 0.025
- WHEN the form state updates
- THEN `"mascalculador_last_bases_form"` in localStorage is updated with the new `qa` value

#### Scenario: Refresh restores last form

- GIVEN the user previously filled form fields and refreshed the page
- WHEN `BasesForm` mounts with no router state
- THEN all fields are restored from `"mascalculador_last_bases_form"`

### Requirement: Saved bases persistence — guardar/cargar

The data screen SHALL include a "Cargar base guardada" dropdown (via `<SavedBeams type="bases">`) and a "Guardar datos" button. The results screen SHALL include a "Guardar resultados" button.

`saveBeam()` and `getSavedBeams()` SHALL accept `"bases"` as a valid type. Per-save data SHALL store full `{ input: BaseInput, result: BaseResult }` plus `name`.

#### Scenario: Guardar datos persists input-only save

- GIVEN the user has filled the bases form
- WHEN they click "Guardar datos" and enter a name
- THEN a `SavedBeam` with `type: "bases"` is written to localStorage
- AND `data` contains at minimum `{ input: BaseInput }`

#### Scenario: Guardar resultados persists full input+result

- GIVEN the user is viewing results at `/bases-results` with valid state
- WHEN they click "Guardar resultados" and enter a name
- THEN a `SavedBeam` with `type: "bases"` and `data: { input, result }` is persisted

#### Scenario: Duplicate name rejects save

- GIVEN a saved base named "Base C1" already exists for type `"bases"`
- WHEN the user tries to save another with name "Base C1"
- THEN `saveBeam()` throws an error
- AND the UI SHALL display the error message

### Requirement: Bases results display

The system SHALL render `BasesResults` at `/bases-results`. If `location.state` is missing, the component SHALL render an instructional message (not crash). Results SHALL display: dimensions (B, L, h), Pu, qu, kx/ky, Mux/Muy, Mnx/Mny, d, h, AsX, AsY, kamin, ka, db, sep, nBars, and verification status (punchOK, beamShearOK). For medianera: additionally e, Mu, Tu/Ru, As_sup, h_viga/h_tensor.

A "Ver cuentas" collapsible section SHALL display the `steps` array. A "Modificar datos" button SHALL navigate back to `/bases` with the original input in router state.

#### Scenario: Centrada results display all fields

- GIVEN the user navigated to `/bases-results` with valid `state: { input: { type: "centrada", ... }, result: { B: 120, L: 120, h: 35, ... } }`
- WHEN `BasesResults` renders
- THEN dimensions 120×120×35 cm are displayed
- AND Pu, qu, As values appear
- AND "Ver cuentas" expands to show 13 steps

#### Scenario: Missing state shows instructional message

- GIVEN the user navigates directly to `/bases-results` with no `location.state`
- WHEN `BasesResults` renders
- THEN an instructional message is shown: "No hay resultados para mostrar. Complete el formulario de dimensionado primero."
- AND the component does not crash

#### Scenario: Medianera results show extra fields

- GIVEN state with `type: "medianera"` and `subType: "viga-de-fundacion"`
- WHEN `BasesResults` renders
- THEN `e`, `Mu`, `Ru`, `As_sup`, and `h_viga` are displayed
- AND centrada-only fields (like qu-based Mux) are not shown

### Requirement: bases type union registration

The system SHALL add `"bases"` to the `SavedBeam.type` union type in `storage.ts` (3 locations: the `type` field interface, `saveBeam()` parameter, and `getSavedBeams()` parameter). The `Props.type` union in `SavedBeams.tsx` SHALL also include `"bases"`.

#### Scenario: saveBeam accepts "bases"

- GIVEN the type union includes `"bases"`
- WHEN `saveBeam("Base C2", "bases", data)` is called
- THEN TypeScript compiles without type errors
- AND the save is persisted to localStorage

#### Scenario: getSavedBeams filters by "bases"

- GIVEN multiple saves of different types exist
- WHEN `getSavedBeams("bases")` is called
- THEN only saves with `type: "bases"` are returned

### Requirement: BasesPersistFormState interface and last-form persistence

The system SHALL define `BasesFormState` interface in `storage.ts` with all form fields (qa, Df, PD, PL, cx, cy, fc, fy, type, subType, B, L, h, Lcol, H, mu, cover, rebD, columnId, columnName). Functions `saveLastBasesFormState()` and `loadLastBasesFormState()` SHALL read/write key `"mascalculador_last_bases_form"`.

#### Scenario: save/load roundtrip preserves state

- GIVEN `BasesFormState` with `{ qa: 0.02, type: "centrada", cx: 40, ... }`
- WHEN `saveLastBasesFormState(state)` is called, then `loadLastBasesFormState()` is called
- THEN the returned object matches the original state

### Requirement: Bases routes in the SPA router

The system SHALL register two routes in `createBrowserRouter`: `/bases` → `BasesForm`, `/bases-results` → `BasesResults`.

#### Scenario: Navigate to form route

- GIVEN the user navigates to `/bases`
- WHEN the router resolves the path
- THEN `BasesForm` component renders

#### Scenario: Navigate to results route

- GIVEN the user navigates to `/bases-results` with valid state
- WHEN the router resolves the path
- THEN `BasesResults` component renders

### Requirement: NavBar "Bases" link

The system SHALL render a `<Link to="/bases">Bases</Link>` element inside the `NavBar` function in `main.tsx`, matching the existing link style pattern.

#### Scenario: NavBar link navigates to form

- GIVEN the user is on any page
- WHEN they click the "Bases" link in the NavBar
- THEN the browser navigates to `/bases`
- AND `BasesForm` renders
