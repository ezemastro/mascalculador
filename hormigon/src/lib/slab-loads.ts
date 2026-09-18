import type {
  ManualDeadLoadItem,
  ManualLiveLoadItem,
} from "@mascalculador/shared";

// Catálogo de cargas según CIRSOC 101-05:
//  - Tabla 3.1 (pesos unitarios de materiales y conjuntos funcionales)
//  - Tabla 4.1 (sobrecargas mínimas uniformemente distribuidas)

export type DeadLoadTypeKey =
  | "contrapiso"
  | "carpeta"
  | "piso"
  | "cielorraso"
  | "tierra"
  | "otros";

export interface DeadLoadOption {
  label: string;
  /** kN/m³ si `unit` es "vol"; kN/m² si es "area" */
  value: number;
  unit: "vol" | "area";
}

export interface DeadLoadType {
  key: DeadLoadTypeKey;
  label: string;
  options: DeadLoadOption[];
  /** Espesor por defecto en cm para opciones volumétricas */
  defaultThicknessCm?: number;
}

export interface DeadLoadItem extends ManualDeadLoadItem {
  id: string;
  type: DeadLoadTypeKey;
}

export interface LiveLoadItem extends ManualLiveLoadItem {
  id: string;
}

export const DEAD_LOAD_TYPES: Record<DeadLoadTypeKey, DeadLoadType> = {
  contrapiso: {
    key: "contrapiso",
    label: "Contrapiso",
    defaultThicknessCm: 8,
    options: [
      { label: "Hormigón de cal, arena y cascote", value: 16, unit: "vol" },
      { label: "Mortero de cemento, cal y arena", value: 19, unit: "vol" },
      { label: "Mortero de cemento y arena", value: 21, unit: "vol" },
    ],
  },
  carpeta: {
    key: "carpeta",
    label: "Carpeta",
    defaultThicknessCm: 3,
    options: [
      { label: "Mortero de cemento y arena", value: 21, unit: "vol" },
      { label: "Mortero de cemento, cal y arena", value: 19, unit: "vol" },
    ],
  },
  piso: {
    key: "piso",
    label: "Piso",
    options: [
      { label: "Porcelanato", value: 0.2, unit: "area" },
      { label: "Piso de madera dura (hasta 22 mm)", value: 0.25, unit: "area" },
      {
        label: "Piso de madera semidura (hasta 22 mm)",
        value: 0.2,
        unit: "area",
      },
      { label: "Piso elevado o flotante", value: 0.4, unit: "area" },
    ],
  },
  cielorraso: {
    key: "cielorraso",
    label: "Cielorraso",
    options: [
      { label: "Yeso con metal desplegado", value: 0.18, unit: "area" },
      {
        label: "Plaquetas de yeso sobre armadura de aluminio",
        value: 0.2,
        unit: "area",
      },
      {
        label: "Cielorraso modular de asbesto-cemento",
        value: 0.15,
        unit: "area",
      },
      {
        label: "Mezcla de cemento, cal y arena con material desplegado",
        value: 0.5,
        unit: "area",
      },
    ],
  },
  tierra: {
    key: "tierra",
    label: "Tierra",
    defaultThicknessCm: 30,
    options: [
      { label: "Tierra seca", value: 16, unit: "vol" },
      { label: "Tierra húmeda", value: 18, unit: "vol" },
      { label: "Tierra saturada", value: 21, unit: "vol" },
    ],
  },
  otros: {
    key: "otros",
    label: "Otros",
    options: [],
  },
};

export const DEAD_LOAD_TYPE_KEYS = Object.keys(
  DEAD_LOAD_TYPES,
) as DeadLoadTypeKey[];

export const LIVE_LOAD_USES: { label: string; value: number }[] = [
  { label: "Vivienda — habitaciones", value: 2 },
  { label: "Baño / lavadero (vivienda)", value: 2 },
  { label: "Baño / lavadero (otros destinos)", value: 3 },
  { label: "Balcón (casas de 1 y 2 familias, hasta 10 m²)", value: 3 },
  { label: "Balcón (viviendas en general)", value: 5 },
  { label: "Oficina", value: 2.5 },
  { label: "Corredor en pisos superiores (oficinas)", value: 4 },
  { label: "Corredor / salón de entrada en planta baja", value: 5 },
  { label: "Local comercial minorista", value: 4 },
  { label: "Estacionamiento de automóviles", value: 2.5 },
  { label: "Escalera / vía de escape", value: 5 },
  { label: "Escalera (vivienda unifamiliar)", value: 2 },
  { label: "Azotea inaccesible", value: 1 },
  { label: "Azotea accesible privadamente", value: 3 },
  { label: "Azotea / terraza donde se congregan personas", value: 5 },
  { label: "Biblioteca / archivo", value: 7 },
  { label: "Patio y lugar de paseo", value: 5 },
  { label: "Templo", value: 5 },
  { label: "Habitación de hospital", value: 2 },
  { label: "Quirófano / laboratorio (hospital)", value: 3 },
  { label: "Marquesina y estructura de entrada", value: 3.5 },
];

export function deadLoadValue(item: DeadLoadItem): number {
  if (item.type === "otros") return item.value ?? 0;
  const type = DEAD_LOAD_TYPES[item.type];
  const opt = type.options.find((o) => o.value === item.optionValue);
  if (!opt) return 0;
  return opt.unit === "vol"
    ? (opt.value * (item.thicknessCm ?? 0)) / 100
    : opt.value;
}

export function totalDeadLoad(items: DeadLoadItem[]): number {
  return items.reduce((acc, it) => acc + deadLoadValue(it), 0);
}

export function totalLiveLoad(items: LiveLoadItem[]): number {
  return items.reduce((acc, it) => acc + (it.value ?? 0), 0);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function makeDeadItem(
  type: DeadLoadTypeKey = "contrapiso",
): DeadLoadItem {
  const t = DEAD_LOAD_TYPES[type];
  const first = t.options[0];
  return {
    id: uid(),
    type,
    optionValue: first?.value,
    optionLabel: first?.label,
    thicknessCm: t.defaultThicknessCm ?? 0,
    label: "",
    value: 0,
  };
}

export function makeLiveItem(
  label: string = LIVE_LOAD_USES[0].label,
): LiveLoadItem {
  const use =
    LIVE_LOAD_USES.find((u) => u.label === label) ?? LIVE_LOAD_USES[0];
  return { id: uid(), label: use.label, value: use.value };
}
