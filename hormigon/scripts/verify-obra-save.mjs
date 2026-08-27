#!/usr/bin/env node
// Harness de verificación — cambio "preguntar obra al guardar" (hormigon).
//
// Sin test runner en el proyecto: bundlea `src/lib/storage.ts` y
// `src/components/ObraPicker.tsx` con esbuild (vía npx, cacheado) y los
// ejerce sobre un stub de localStorage en memoria. ObraPicker se bundlea con
// stubs de react/react-dom (el host renderiza un árbol plano de objetos, lo
// que permite "hacer clic" en los botones del modal sin navegador).
//
// Casos: QT-1, QT-2, QT-3, QTE-1, QTE-2, QU-3, TW-1, TW-2, TW-3, UR-1, UR-2,
// COMPAT/SUPPORT y CR-1 (crear obra desde el picker) — 13 grupos.
//
// Regla central: "Sin obra" (id "default") NUNCA es destino de un guardado
// nuevo. El picker la excluye y ofrece "Nueva obra..." en su lugar.
//
// Uso:  node scripts/verify-obra-save.mjs
//       SDD_RED=1 node scripts/verify-obra-save.mjs   # bundlea storage desde
//                                                     # git HEAD (probar RED)
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = path.join(ROOT, "scripts", ".verify-obra-save");
const STORAGE_BUNDLE = path.join(TMP, "storage-entry.mjs");
const PICKER_BUNDLE = path.join(TMP, "picker-entry.mjs");

// ---- Stub de localStorage ----
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
  clear: () => void store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};
// createPortal(árbol, document.body) evalúa el target aunque el stub de
// react-dom lo ignore.
globalThis.document = { body: null };
// El flujo "Nueva obra..." usa window.prompt / alert. Se redefine por caso.
globalThis.alert = () => {};
globalThis.window = { prompt: () => null };

// ---- Build ----
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const esbuild = (args) =>
  execFileSync("npx", ["--yes", "esbuild@0.28.2", ...args], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });

const red = process.env.SDD_RED === "1";
if (red) {
  // Bundle del storage del HEAD de git: los casos deben fallar (RED).
  // Se reescribe el import relativo porque el archivo vive en TMP.
  const headStorage = execFileSync(
    "git",
    ["show", "HEAD:hormigon/src/lib/storage.ts"],
    { cwd: path.resolve(ROOT, ".."), encoding: "utf8" },
  ).replace(
    '"./cloud-storage.ts"',
    JSON.stringify(path.join(ROOT, "src", "lib", "cloud-storage.ts")),
  );
  writeFileSync(path.join(TMP, "storage-red.ts"), headStorage);
}

// Entradas de re-exportación: con --splitting en UNA sola invocación, el
// módulo de storage queda en un chunk compartido por ambas entradas → el
// harness y el picker ven EL MISMO estado de módulo.
const storageSource = red
  ? path.join(TMP, "storage-red.ts")
  : path.join(ROOT, "src", "lib", "storage.ts");
writeFileSync(
  path.join(TMP, "storage-entry.ts"),
  `export * from ${JSON.stringify(storageSource)};\n`,
);
writeFileSync(
  path.join(TMP, "picker-entry.ts"),
  `export * from ${JSON.stringify(path.join(ROOT, "src", "components", "ObraPicker.tsx"))};\n`,
);

writeFileSync(
  path.join(TMP, "stub-react.mjs"),
  [
    `export const Fragment = Symbol("Fragment");`,
    `const noop = () => {};`,
    `export function createElement(type, props, ...children) {`,
    `  return { type, props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children } };`,
    `}`,
    `export function jsx(type, props) { return { type, props: props ?? {} }; }`,
    `export function jsxs(type, props) { return { type, props: props ?? {} }; }`,
    `export function useSyncExternalStore(_subscribe, getSnapshot) {`,
    `  return getSnapshot();`,
    `}`,
    // Hooks mínimos que pide shared/src (nunca se ejecutan en el harness:
    // son solo para que el bundle resuelva los named exports).
    `export const useState = (v) => [v, noop];`,
    `export const useEffect = noop;`,
    `export const useRef = (v) => ({ current: v });`,
    `export default {};`,
    ``,
  ].join("\n"),
);
writeFileSync(
  path.join(TMP, "stub-jsx-runtime.mjs"),
  "export { Fragment, jsx, jsxs } from \"./stub-react.mjs\";\n",
);
writeFileSync(
  path.join(TMP, "stub-react-dom.mjs"),
  "export function createPortal(node) { return node; }\nexport default {};\n",
);

esbuild([
  path.join(TMP, "storage-entry.ts"),
  path.join(TMP, "picker-entry.ts"),
  "--bundle",
  "--format=esm",
  "--platform=node",
  "--tsconfig=tsconfig.app.json",
  "--splitting",
  "--outbase=" + TMP,
  "--outdir=" + TMP,
  "--jsx=automatic",
  "--jsx-import-source=react",
  "--alias:react=" + path.join(TMP, "stub-react.mjs"),
  "--alias:react/jsx-runtime=" + path.join(TMP, "stub-jsx-runtime.mjs"),
  "--alias:react-dom=" + path.join(TMP, "stub-react-dom.mjs"),
  "--out-extension:.js=.mjs",
]);

const storage = await import(STORAGE_BUNDLE);
const picker = await import(PICKER_BUNDLE);

// ---- Helpers ----
let passed = 0;
const ok = (label) => {
  passed++;
  console.log(`  ok - ${label}`);
};
const OBRA = (id, name) => ({ id, name, createdAt: "" });
const TRES = () => [OBRA("default", "Sin obra"), OBRA("norte", "Edificio Norte"), OBRA("sur", "Casa Sur")];
const seedObras = (obras, activeId) => {
  // Limpia keys de elementos de casos anteriores (aislamiento entre casos).
  for (const key of [...store.keys()]) {
    if (key.startsWith("concrete:obra:")) store.delete(key);
  }
  store.set("concrete:obras", JSON.stringify(obras));
  store.set("concrete:current_obra", activeId);
  storage.setCurrentObraId(activeId);
};
const listed = (key) => JSON.parse(store.get(key) ?? "[]");
const keysSnapshot = () => [...store.keys()].sort().join("|");
function collectButtons(node, out = []) {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) {
    for (const n of node) collectButtons(n, out);
    return out;
  }
  if (typeof node !== "object") return out;
  if (node.type === "button") out.push(node);
  collectButtons(node.props?.children, out);
  return out;
}
const tick = () => new Promise((r) => setTimeout(r, 5));
const pickerButtons = () => collectButtons(picker.ObraPickerHost());
// Abre el modal (registra resolver pendiente) y devuelve la promesa + botones.
const openPicker = () => {
  const p = picker.pickObraIfNeeded();
  return { p, buttons: pickerButtons() };
};
const click = (buttons, label) => buttons.find((b) => b.props.children === label).props.onClick();

// =================== QT-1 ===================
console.log("QT-1 única obra (solo Sin obra) → AHORA pregunta; solo Nueva obra + Cancelar");
seedObras([OBRA("default", "Sin obra")], "default");
assert.strictEqual(storage.shouldAskObraOnSave(), true, "solo Sin obra activa → ask");
{
  const { p, buttons } = openPicker();
  assert.deepStrictEqual(
    buttons.map((b) => b.props.children),
    ["Nueva obra...", "Cancelar"],
    "Sin obra excluida: solo Nueva obra + Cancelar",
  );
  click(buttons, "Cancelar");
  assert.strictEqual(await p, null, "cancelar → null");
  assert.strictEqual(picker.ObraPickerHost(), null, "modal cerrado");
}
ok("QT-1 única obra Sin obra → pregunta y excluye default");

// =================== QT-2 ===================
console.log("QT-2 multi + default → pregunta; obras reales + Nueva obra + Cancelar");
seedObras(TRES(), "default");
assert.strictEqual(storage.shouldAskObraOnSave(), true, "multi + default → ask");
{
  let settled = false;
  const q = picker.pickObraIfNeeded().then((v) => {
    settled = true;
    return v;
  });
  await tick();
  assert.strictEqual(settled, false, "registra resolver pendiente (promesa colgada)");
  const host = picker.ObraPickerHost();
  assert.ok(host, "host renderiza el modal");
  const buttons = collectButtons(host);
  assert.deepStrictEqual(
    buttons.map((b) => b.props.children),
    ["Edificio Norte", "Casa Sur", "Nueva obra...", "Cancelar"],
    "obras reales + Nueva obra + Cancelar (Sin obra NO ofrecida)",
  );
  click(buttons, "Edificio Norte");
  assert.strictEqual(await q, "norte", "elegir obra resuelve con su id");
  assert.strictEqual(picker.ObraPickerHost(), null, "modal cerrado tras elegir");
}
ok("QT-2 multi + default → pregunta y resuelve obra real");

// =================== QT-3 ===================
console.log("QT-3 obra activa nombrada → guarda directo en ella");
seedObras(TRES(), "norte");
assert.strictEqual(storage.shouldAskObraOnSave(), false, "nombrada activa → no ask");
const q3 = await picker.pickObraIfNeeded();
assert.strictEqual(q3, "norte", "resuelve con la obra activa");
assert.strictEqual(picker.ObraPickerHost(), null, "sin modal");
ok("QT-3 nombrada activa → directo");

// =================== QTE-1 ===================
console.log("QTE-1 default eliminada → pregunta dormida, directo");
seedObras([OBRA("norte", "Edificio Norte"), OBRA("sur", "Casa Sur")], "norte");
assert.strictEqual(storage.shouldAskObraOnSave(), false, "sin default → no ask");
const q4 = await picker.pickObraIfNeeded();
assert.strictEqual(q4, "norte", "resuelve con la activa");
ok("QTE-1 default eliminada → directo");

// =================== QTE-2 ===================
console.log("QTE-2 renombrar Sin obra → sigue preguntando (id) y la excluye de opciones");
seedObras([OBRA("default", "Obra general"), OBRA("norte", "Edificio Norte")], "default");
assert.strictEqual(storage.shouldAskObraOnSave(), true, "renombrada sigue disparando (id)");
{
  const { p, buttons } = openPicker();
  assert.deepStrictEqual(
    buttons.map((b) => b.props.children),
    ["Edificio Norte", "Nueva obra...", "Cancelar"],
    "Sin obra renombrada NO se ofrece (id default filtrado)",
  );
  click(buttons, "Edificio Norte");
  assert.strictEqual(await p, "norte", "elegir obra real resuelve su id");
}
ok("QTE-2 renombrada → pregunta y excluye default");

// =================== QU-3 ===================
console.log("QU-3 cancelar → null y cero escrituras");
seedObras(TRES(), "default");
{
  const before = keysSnapshot();
  const { p, buttons } = openPicker();
  click(buttons, "Cancelar");
  const target = await p;
  assert.strictEqual(target, null, "Cancelar → null");
  assert.strictEqual(keysSnapshot(), before, "cero escrituras en storage");
  // Emulación del gate de pantalla (`if (target === null) return;`):
  if (target !== null) storage.saveBeam("NUNCA", "hormigon", {}, target);
  assert.strictEqual(store.get("concrete:obra:default:beam_saves"), undefined, "el elemento no se guarda");
}
ok("QU-3 cancelar → null + cero escrituras");

// =================== TW-1 ===================
console.log("TW-1 el guardado cae solo en la obra elegida; Sin obra no es opción");
seedObras(TRES(), "default");
storage.saveBeam("V1", "hormigon", { a: 1 }, "norte");
assert.deepStrictEqual(
  listed("concrete:obra:norte:beam_saves").map((b) => b.name),
  ["V1"],
  "escribe en la key de la obra elegida",
);
assert.strictEqual(store.get("concrete:obra:default:beam_saves"), undefined, "default intacta");
assert.strictEqual(store.get("concrete:obra:sur:beam_saves"), undefined, "otras obras intactas");
{
  // El picker nunca ofrece "Sin obra"/"default" como destino.
  const { p, buttons } = openPicker();
  assert.ok(
    !buttons.some((b) => b.props.children === "Sin obra"),
    "Sin obra NO aparece como opción",
  );
  assert.ok(
    !buttons.some((b) => b.props.children === "default"),
    "el id default NO aparece como opción",
  );
  click(buttons, "Cancelar");
  await p;
}
ok("TW-1 write solo en la obra elegida; Sin obra no es opción");

// =================== TW-2 ===================
console.log("TW-2 unicidad contra la obra elegida (case-insensitive, español)");
seedObras(TRES(), "default");
storage.saveBeam("V1", "hormigon", { v: 0 }, "default");
const savedV1 = storage.saveBeam("V1", "hormigon", { v: 1 }, "norte");
assert.strictEqual(savedV1.name, "V1", "mismo nombre en default no bloquea la obra elegida");
assert.throws(
  () => storage.saveBeam("v1", "hormigon", {}, "norte"),
  /Ya existe un elemento guardado con el nombre "v1"/,
  "dup case-insensitive en la elegida → mensaje español existente",
);
assert.strictEqual(listed("concrete:obra:norte:beam_saves").length, 1, "colisión → nada guardado (OP-2)");
ok("TW-2 unicidad sobre la obra elegida");

// =================== TW-3 ===================
console.log("TW-3 el elemento lista solo en la obra elegida");
seedObras(TRES(), "default");
storage.saveBeam("L1", "losa", {}, "sur");
assert.deepStrictEqual(
  listed("concrete:obra:sur:beam_saves").map((b) => b.name),
  ["L1"],
  "key de Casa Sur contiene el elemento",
);
storage.setCurrentObraId("sur");
assert.deepStrictEqual(
  storage.getSavedSlabs().map((s) => s.name),
  ["L1"],
  "listado en Casa Sur",
);
storage.setCurrentObraId("default");
assert.deepStrictEqual(storage.getSavedSlabs(), [], "ausente en Sin obra");
storage.setCurrentObraId("norte");
assert.deepStrictEqual(storage.getSavedSlabs(), [], "ausente en Edificio Norte");
ok("TW-3 lista solo en la obra elegida");

// =================== UR-1 ===================
console.log("UR-1 update encuentra el id en otra obra y actualiza ahí");
seedObras(TRES(), "default");
const surElem = storage.saveBeam("C1", "hormigon", { v: 1 }, "sur");
storage.setCurrentObraId("norte"); // usuario parado en Edificio Norte
const updated = storage.updateSave(surElem.id, { v: 2 });
assert.strictEqual(updated?.data.v, 2, "devuelve el elemento actualizado");
assert.strictEqual(
  listed("concrete:obra:sur:beam_saves")[0].data.v,
  2,
  "escribe dentro de la obra dueña (Casa Sur)",
);
assert.strictEqual(store.get("concrete:obra:norte:beam_saves"), undefined, "no escribe en la activa");
assert.strictEqual(storage.getCurrentObraId(), "norte", "el selector de obra no cambia");
ok("UR-1 actualiza en la obra dueña sin cambiar la activa");

// =================== UR-2 ===================
console.log("UR-2 id en ninguna obra → null, cero escrituras");
seedObras(TRES(), "norte");
storage.saveBeam("X1", "hormigon", {}, "norte");
const before8 = keysSnapshot();
assert.strictEqual(storage.updateSave("missing-id", { v: 9 }), null, "devuelve null");
assert.strictEqual(keysSnapshot(), before8, "sin escrituras ni creación silenciosa");
ok("UR-2 id inexistente → null sin tocar storage");

// =================== COMPAT / SUPPORT (target-obra + upsert/unicidad) ===================
console.log("COMPAT/SUPPORT: guardado y unicidad sobre la obra elegida");
seedObras(TRES(), "default");
storage.saveCompat(
  "Apoyo A-B",
  { id: "a", name: "A" },
  { id: "b", name: "B" },
  0,
  1,
  { compatMoment: 10 },
  "norte",
);
assert.deepStrictEqual(
  listed("concrete:obra:norte:saved-compats").map((c) => c.name),
  ["Apoyo A-B"],
  "compat en la obra elegida",
);
assert.strictEqual(store.get("concrete:obra:default:saved-compats"), undefined, "default intacta");
assert.throws(
  () =>
    storage.saveCompat(
      "Apoyo A-B",
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      0,
      1,
      { compatMoment: 11 },
      "norte",
    ),
  /Ya existe una compatibilización con nombre "Apoyo A-B"/,
  "dup en la elegida → error español",
);
storage.saveSupport(
  { name: "S1", slabId: "a", slabName: "A", edge: 0, diam: 8, sep: 15 },
  "sur",
);
storage.saveSupport(
  { name: "S1", slabId: "a", slabName: "A", edge: 0, diam: 10, sep: 20 },
  "sur",
);
assert.strictEqual(listed("concrete:obra:sur:saved-supports").length, 1, "upsert por nombre en la elegida");
assert.strictEqual(listed("concrete:obra:sur:saved-supports")[0].diam, 10, "valores actualizados");
assert.strictEqual(store.get("concrete:obra:default:saved-supports"), undefined, "support no toca otras obras");
ok("COMPAT/SUPPORT target-obra + upsert/unicidad");

// =================== CR-1 (crear obra desde el picker) ===================
console.log("CR-1 'Nueva obra...' desde el picker: crea, notifica, resuelve id nuevo");
// CR-1a: flujo feliz
seedObras([OBRA("default", "Sin obra")], "default");
assert.strictEqual(storage.shouldAskObraOnSave(), true, "pregunta con solo Sin obra");
{
  globalThis.window.prompt = () => "Obra Nueva";
  const { p, buttons } = openPicker();
  assert.ok(
    buttons.some((b) => b.props.children === "Nueva obra..."),
    "ofrece 'Nueva obra...'",
  );
  click(buttons, "Nueva obra...");
  const target = await p;
  assert.ok(target !== null && target !== "default", "resuelve con un id nuevo (≠ default)");
  assert.strictEqual(storage.getCurrentObraId(), target, "createObra dejó la nueva obra activa");
  assert.ok(
    storage.getObras().some((o) => o.id === target && o.name === "Obra Nueva"),
    "la obra nueva quedó en el directorio",
  );
  // El elemento se guarda en la obra nueva, no en default.
  storage.saveBeam("E1", "hormigon", { x: 1 }, target);
  assert.deepStrictEqual(
    listed(`concrete:obra:${target}:beam_saves`).map((b) => b.name),
    ["E1"],
    "elemento guardado bajo la obra nueva",
  );
  assert.strictEqual(store.get("concrete:obra:default:beam_saves"), undefined, "nada en Sin obra");
}
ok("CR-1a crear obra desde el picker guarda en la nueva");

// CR-1b: nombre duplicado → alert + el picker se queda abierto
{
  seedObras(TRES(), "default");
  let alertMsg = null;
  globalThis.alert = (m) => {
    alertMsg = m;
  };
  globalThis.window.prompt = () => "Edificio Norte"; // ya existe
  const { p, buttons } = openPicker();
  click(buttons, "Nueva obra...");
  await tick();
  assert.ok(alertMsg && /Ya existe una obra con el nombre/.test(alertMsg), "alerta con mensaje español de duplicado");
  assert.ok(picker.ObraPickerHost() !== null, "el picker SIGUE abierto tras error");
  assert.ok(picker.ObraPickerHost() !== null, "pendiente sigue vivo (no resolvió)");
  // Limpieza: cancelar.
  click(pickerButtons(), "Cancelar");
  await p;
  globalThis.alert = () => {};
}
ok("CR-1b duplicado → alert y picker abierto");

// CR-1c: nombre vacío/nulo → no cierra el picker
{
  seedObras([OBRA("default", "Sin obra")], "default");
  globalThis.window.prompt = () => ""; // vacío tras trim
  const { p, buttons } = openPicker();
  click(buttons, "Nueva obra...");
  await tick();
  assert.ok(picker.ObraPickerHost() !== null, "picker abierto tras nombre vacío");
  click(pickerButtons(), "Cancelar");
  await p;
}
ok("CR-1c nombre vacío → picker abierto");

console.log(`\n${passed} grupos de aserción en verde.`);
rmSync(TMP, { recursive: true, force: true });
