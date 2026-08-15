import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { SavedBeams } from "@mascalculador/shared";
import { ANGLE_PROFILES } from "../lib/angle-profiles";
import { IPN_PROFILES } from "../lib/profiles";
import {
  saveBeam,
  updateSave,
  saveLastCartelFormState,
  loadLastCartelFormState,
} from "../lib/storage";
import { DecimalInput } from "@mascalculador/shared";

export interface CartelState {
  // Geometry
  anchoCartel: number;
  altoCartel: number;
  despegue: number;
  sepColumnas: number;
  sepCorreas: number;
  // Column type
  tipoColumna: number;
  // Puntal
  tienePuntal: boolean;
  hPuntal: number;
  dPuntal: number;
  tipoPuntal: number;
  // Wind
  velocidadViento: number;
  categoria: string;
  exposicion: string;
  // Column section
  hCol: number;
  aCol: number;
  perfilCordon: string;
  perfilDiagonal: string;
  perfilMontante: string;
  Fy: number;
  perfilIPN?: string;
  separacionCol?: number;
  KGlobal?: number;
  // Front view
  cantColumnas?: number;
  vueloLateral?: number;
}

export default function CartelForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as CartelState | null;

  const lastForm = !state ? loadLastCartelFormState() : null;

  const [anchoCartel, setAnchoCartel] = useState(
    state?.anchoCartel ?? lastForm?.anchoCartel ?? 12,
  );
  const [altoCartel, setAltoCartel] = useState(
    state?.altoCartel ?? lastForm?.altoCartel ?? 4.8,
  );
  const [despegue, setDespegue] = useState(
    state?.despegue ?? lastForm?.despegue ?? 3,
  );
  const [sepCorreas, setSepCorreas] = useState(
    state?.sepCorreas ?? lastForm?.sepCorreas ?? 1,
  );
  const [tipoColumna, setTipoColumna] = useState(
    state?.tipoColumna ?? lastForm?.tipoColumna ?? 2,
  );
  const [tienePuntal, setTienePuntal] = useState(
    state?.tienePuntal ?? lastForm?.tienePuntal ?? true,
  );
  const [hPuntal, setHPuntal] = useState(
    state?.hPuntal ?? lastForm?.hPuntal ?? 3.84,
  );
  const [dPuntal, setDPuntal] = useState(
    state?.dPuntal ?? lastForm?.dPuntal ?? 3.44,
  );
  const [tipoPuntal, setTipoPuntal] = useState(
    state?.tipoPuntal ?? lastForm?.tipoPuntal ?? 1,
  );
  const [velocidadViento, setVelocidadViento] = useState(
    state?.velocidadViento ?? lastForm?.velocidadViento ?? 45,
  );
  const [categoria, setCategoria] = useState(
    state?.categoria ?? lastForm?.categoria ?? "II",
  );
  const [exposicion, setExposicion] = useState(
    state?.exposicion ?? lastForm?.exposicion ?? "B",
  );
  const [hCol, setHCol] = useState(
    state?.hCol ?? lastForm?.hCol ?? 0.5,
  );
  const [aCol, setACol] = useState(
    state?.aCol ?? lastForm?.aCol ?? 0.6,
  );
  const [perfilCordon, setPerfilCordon] = useState(
    state?.perfilCordon ?? lastForm?.perfilCordon ?? 'L 2 1/2" x 1/4"',
  );
  const [perfilDiagonal, setPerfilDiagonal] = useState(
    state?.perfilDiagonal ?? lastForm?.perfilDiagonal ?? 'L 1 1/2" x 3/16"',
  );
  const [perfilMontante, setPerfilMontante] = useState(
    state?.perfilMontante ?? lastForm?.perfilMontante ?? 'L 1 1/4" x 1/8"',
  );
  const [Fy, setFy] = useState(state?.Fy ?? lastForm?.Fy ?? 235);
  const [perfilIPN, setPerfilIPN] = useState(
    state?.perfilIPN ?? lastForm?.perfilIPN ?? "IPN 200",
  );
  const [separacionCol, setSeparacionCol] = useState(
    state?.separacionCol ?? lastForm?.separacionCol ?? 0.5,
  );
  const [cantColumnas, setCantColumnas] = useState(
    state?.cantColumnas ?? lastForm?.cantColumnas ?? 3,
  );
  const [vueloLateral, setVueloLateral] = useState(
    state?.vueloLateral ?? lastForm?.vueloLateral ?? 0,
  );
  const [KGlobal, setKGlobal] = useState(
    state?.KGlobal ?? lastForm?.KGlobal ?? 1.0,
  );

  const [loadedSaveId, setLoadedSaveId] = useState<string | null>(null);
  const [loadedSaveName, setLoadedSaveName] = useState<string | null>(null);

  // Derive sepColumnas from cantColumnas + vueloLateral
  const computedSepColumnas =
    cantColumnas > 1
      ? (anchoCartel - 2 * vueloLateral) / (cantColumnas - 1)
      : anchoCartel;

  // Guard: skip first auto-save to avoid overwriting router state with defaults
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    saveLastCartelFormState({
      anchoCartel,
      altoCartel,
      despegue,
      sepColumnas: computedSepColumnas,
      sepCorreas,
      tipoColumna,
      tienePuntal,
      hPuntal,
      dPuntal,
      velocidadViento,
      categoria,
      exposicion,
      hCol,
      aCol,
      perfilCordon,
      perfilDiagonal,
      perfilMontante,
      Fy,
      perfilIPN,
      separacionCol,
      cantColumnas,
      vueloLateral,
      KGlobal,
      tipoPuntal,
    });
  }, [
    anchoCartel,
    altoCartel,
    despegue,
    computedSepColumnas,
    sepCorreas,
    tipoColumna,
    tienePuntal,
    hPuntal,
    dPuntal,
    tipoPuntal,
    velocidadViento,
    categoria,
    exposicion,
    hCol,
    aCol,
    perfilCordon,
    perfilDiagonal,
    perfilMontante,
    Fy,
    perfilIPN,
    separacionCol,
    cantColumnas,
    vueloLateral,
    KGlobal,
  ]);

  function handleSave() {
    const data: Record<string, unknown> = {
      anchoCartel,
      altoCartel,
      despegue,
      sepColumnas: computedSepColumnas,
      sepCorreas,
      tipoColumna,
      tienePuntal,
      hPuntal,
      dPuntal,
      velocidadViento,
      categoria,
      exposicion,
      hCol,
      aCol,
      perfilCordon,
      perfilDiagonal,
      perfilMontante,
      Fy,
      perfilIPN,
      separacionCol,
      cantColumnas,
      vueloLateral,
      KGlobal,
      tipoPuntal,
    };

    if (loadedSaveId) {
      updateSave(loadedSaveId, data);
      return;
    }

    const name = prompt("Nombre para guardar este cartel:");
    if (!name) return;
    try {
      saveBeam(name, "cartel", data);
      setLoadedSaveName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  function handleLoad(data: Record<string, unknown>, save: { id: string; name: string }) {
    setLoadedSaveId(save.id);
    setLoadedSaveName(save.name);
    const d = data as Record<string, unknown>;
    if (typeof d.anchoCartel === "number") setAnchoCartel(d.anchoCartel);
    if (typeof d.altoCartel === "number") setAltoCartel(d.altoCartel);
    if (typeof d.despegue === "number") setDespegue(d.despegue);
    if (typeof d.sepCorreas === "number") setSepCorreas(d.sepCorreas);
    if (typeof d.tipoColumna === "number") {
      const t = d.tipoColumna;
      setTipoColumna(t === 3 ? 2 : t); // remap T3 → T2
    }
    if (typeof d.tienePuntal === "boolean") setTienePuntal(d.tienePuntal);
    if (typeof d.hPuntal === "number") setHPuntal(d.hPuntal);
    if (typeof d.dPuntal === "number") setDPuntal(d.dPuntal);
    if (typeof d.velocidadViento === "number") setVelocidadViento(d.velocidadViento);
    if (typeof d.categoria === "string") setCategoria(d.categoria);
    if (typeof d.exposicion === "string") setExposicion(d.exposicion);
    if (typeof d.hCol === "number") setHCol(d.hCol);
    if (typeof d.aCol === "number") setACol(d.aCol);
    if (typeof d.perfilCordon === "string") setPerfilCordon(d.perfilCordon);
    if (typeof d.perfilDiagonal === "string") setPerfilDiagonal(d.perfilDiagonal);
    if (typeof d.perfilMontante === "string") setPerfilMontante(d.perfilMontante);
    if (typeof d.Fy === "number") setFy(d.Fy);
    if (typeof d.perfilIPN === "string") setPerfilIPN(d.perfilIPN);
    if (typeof d.separacionCol === "number") setSeparacionCol(d.separacionCol);
    if (typeof d.cantColumnas === "number") setCantColumnas(d.cantColumnas);
    if (typeof d.vueloLateral === "number") setVueloLateral(d.vueloLateral);
    if (typeof d.KGlobal === "number") setKGlobal(d.KGlobal); else setKGlobal(1.0);
    if (typeof d.tipoPuntal === "number") setTipoPuntal(d.tipoPuntal); else setTipoPuntal(1);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cartelState: CartelState = {
      anchoCartel,
      altoCartel,
      despegue,
      sepColumnas: computedSepColumnas,
      sepCorreas,
      tipoColumna,
      tienePuntal,
      hPuntal,
      dPuntal,
      velocidadViento,
      categoria,
      exposicion,
      hCol,
      aCol,
      perfilCordon,
      perfilDiagonal,
      perfilMontante,
      Fy,
      perfilIPN,
      separacionCol,
      cantColumnas,
      vueloLateral,
      KGlobal,
      tipoPuntal,
    };
    navigate("/cartel-results", { state: cartelState });
  }

  return (
    <MainLayout>
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text">
            Cálculo de Carteles
          </h1>
          <p className="text-sm text-text-muted">
            {loadedSaveName ? `Editando: ${loadedSaveName}` : "CIRSOC 102 — Viento y reticulado de columnas"}
          </p>
        </div>
      </header>

      <SavedBeams
        app="steel"
        type="cartel"
        onLoad={handleLoad}
        label="Carteles guardados"
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Vista lateral */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Vista lateral
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                Ancho cartel (m)
              </span>
              <DecimalInput value={anchoCartel} onChange={setAnchoCartel} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                Alto cartel — h<sub>c</sub> (m)
              </span>
              <DecimalInput value={altoCartel} onChange={setAltoCartel} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                Despegue (m)
              </span>
              <DecimalInput value={despegue} onChange={setDespegue} />
            </label>
          </div>

          <div className="border-t border-border mt-4 pt-4">
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={tienePuntal}
                onChange={(e) => setTienePuntal(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-semibold text-text">Incluir puntal</span>
            </label>

            {tienePuntal && (
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 ml-6">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    h<sub>puntal</sub> — Altura anclaje (m)
                  </span>
                      <DecimalInput value={hPuntal} onChange={setHPuntal} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    d<sub>puntal</sub> — Distancia horiz. (m)
                  </span>
                      <DecimalInput value={dPuntal} onChange={setDPuntal} />
                </label>
              </div>
            )}

            {tienePuntal && (
              <div className="mt-4 pt-3 border-t border-border">
                <span className="text-xs text-text-muted uppercase tracking-wider font-semibold block mb-3">
                  Tipo de puntal
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {/* Tipo 1 — Cruz */}
                  <button
                    type="button"
                    onClick={() => setTipoPuntal(1)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all text-left ${
                      tipoPuntal === 1
                        ? "bg-primary/15 ring-2 ring-primary shadow-md shadow-primary/20 scale-[1.02]"
                        : "bg-surface-alt ring-1 ring-transparent hover:bg-surface hover:ring-border"
                    }`}
                  >
                    <svg width="60" height="40" viewBox="0 0 60 40" className="pointer-events-none">
                      <line x1="10" y1="10" x2="50" y2="30" stroke="#fbbf24" strokeWidth="2.5" />
                      <line x1="50" y1="10" x2="10" y2="30" stroke="#fbbf24" strokeWidth="2.5" />
                    </svg>
                    <div className="text-center">
                      <p className={`text-[11px] font-semibold ${tipoPuntal === 1 ? "text-primary" : "text-text"}`}>
                        Tipo 1 — Cruz
                      </p>
                      <p className="text-[9px] text-text-muted">2× L 2″×3/16″</p>
                    </div>
                  </button>

                  {/* Tipo 2 — Plano */}
                  <button
                    type="button"
                    onClick={() => setTipoPuntal(2)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all text-left ${
                      tipoPuntal === 2
                        ? "bg-primary/15 ring-2 ring-primary shadow-md shadow-primary/20 scale-[1.02]"
                        : "bg-surface-alt ring-1 ring-transparent hover:bg-surface hover:ring-border"
                    }`}
                  >
                    <svg width="60" height="40" viewBox="0 0 60 40" className="pointer-events-none">
                      <line x1="15" y1="5" x2="15" y2="35" stroke="#fbbf24" strokeWidth="2" />
                      <line x1="45" y1="5" x2="45" y2="35" stroke="#fbbf24" strokeWidth="2" />
                      <line x1="15" y1="5" x2="45" y2="20" stroke="#f87171" strokeWidth="1" />
                      <line x1="45" y1="20" x2="15" y2="35" stroke="#f87171" strokeWidth="1" />
                      <line x1="15" y1="20" x2="45" y2="20" stroke="#4ade80" strokeWidth="1" />
                    </svg>
                    <div className="text-center">
                      <p className={`text-[11px] font-semibold ${tipoPuntal === 2 ? "text-primary" : "text-text"}`}>
                        Tipo 2 — Plano
                      </p>
                      <p className="text-[9px] text-text-muted">25 cm — reticulado</p>
                    </div>
                  </button>

                  {/* Tipo 3 — Cuadrado */}
                  <button
                    type="button"
                    onClick={() => setTipoPuntal(3)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all text-left ${
                      tipoPuntal === 3
                        ? "bg-primary/15 ring-2 ring-primary shadow-md shadow-primary/20 scale-[1.02]"
                        : "bg-surface-alt ring-1 ring-transparent hover:bg-surface hover:ring-border"
                    }`}
                  >
                    <svg width="60" height="40" viewBox="0 0 60 40" className="pointer-events-none">
                      <rect x="10" y="8" width="40" height="24" rx="1" fill="none" stroke="#9090b0" strokeWidth="1" />
                      <circle cx="14" cy="20" r="1.5" fill="#fbbf24" />
                      <circle cx="30" cy="20" r="1.5" fill="#fbbf24" />
                      <circle cx="46" cy="20" r="1.5" fill="#fbbf24" />
                      <line x1="14" y1="12" x2="30" y2="20" stroke="#f87171" strokeWidth="0.8" />
                      <line x1="46" y1="12" x2="30" y2="20" stroke="#f87171" strokeWidth="0.8" />
                      <line x1="14" y1="28" x2="30" y2="20" stroke="#f87171" strokeWidth="0.8" />
                      <line x1="46" y1="28" x2="30" y2="20" stroke="#f87171" strokeWidth="0.8" />
                    </svg>
                    <div className="text-center">
                      <p className={`text-[11px] font-semibold ${tipoPuntal === 3 ? "text-primary" : "text-text"}`}>
                        Tipo 3 — Cuadrado
                      </p>
                      <p className="text-[9px] text-text-muted">20×20 cm — cajón</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Tipo de columna */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Tipo de columna
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Tipo 1 — Simple (IPN) */}
            <button
              type="button"
              onClick={() => setTipoColumna(1)}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all text-left ${
                tipoColumna === 1
                  ? "bg-primary/15 ring-2 ring-primary shadow-md shadow-primary/20 scale-[1.02]"
                  : "bg-surface-alt ring-1 ring-transparent hover:bg-surface hover:ring-border"
              }`}
            >
              <svg width="80" height="80" viewBox="0 0 80 80" className="pointer-events-none">
                <rect x="25" y="6" width="30" height="8" rx="1" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
                <rect x="34" y="14" width="12" height="52" rx="1" fill="none" stroke="#fbbf24" strokeWidth="2" />
                <rect x="25" y="66" width="30" height="8" rx="1" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
                <text x="40" y="40" fill="#9090b0" fontSize="8" textAnchor="middle">IPN</text>
              </svg>
              <div className="text-center">
                <p className={`text-xs font-semibold ${tipoColumna === 1 ? "text-primary" : "text-text"}`}>
                  Tipo 1 — Simple
                </p>
                <p className="text-[10px] text-text-muted">Perfil IPN / doble T</p>
              </div>
            </button>

            {/* Tipo 2 — Doble con celosía */}
            <button
              type="button"
              onClick={() => setTipoColumna(2)}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all text-left ${
                tipoColumna === 2
                  ? "bg-primary/15 ring-2 ring-primary shadow-md shadow-primary/20 scale-[1.02]"
                  : "bg-surface-alt ring-1 ring-transparent hover:bg-surface hover:ring-border"
              }`}
            >
              <svg width="80" height="80" viewBox="0 0 80 80" className="pointer-events-none">
                <line x1="20" y1="8" x2="20" y2="72" stroke="#fbbf24" strokeWidth="3" />
                <line x1="60" y1="8" x2="60" y2="72" stroke="#fbbf24" strokeWidth="3" />
                <line x1="20" y1="8" x2="60" y2="28" stroke="#f87171" strokeWidth="1.5" />
                <line x1="60" y1="28" x2="20" y2="48" stroke="#f87171" strokeWidth="1.5" />
                <line x1="20" y1="48" x2="60" y2="68" stroke="#f87171" strokeWidth="1.5" />
                <line x1="20" y1="72" x2="60" y2="72" stroke="#f87171" strokeWidth="1.5" />
                <line x1="20" y1="28" x2="60" y2="28" stroke="#4ade80" strokeWidth="1" />
                <line x1="20" y1="48" x2="60" y2="48" stroke="#4ade80" strokeWidth="1" />
              </svg>
              <div className="text-center">
                <p className={`text-xs font-semibold ${tipoColumna === 2 ? "text-primary" : "text-text"}`}>
                  Tipo 2 — Celosía
                </p>
                <p className="text-[10px] text-text-muted">Dos cordones c/diagonales</p>
              </div>
            </button>

            {/* Tipo 3 removed — old saves with tipoColumna=3 silently remap to 2 */}

            {/* Tipo 4 — Celosía completa */}
            <button
              type="button"
              onClick={() => setTipoColumna(4)}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all text-left ${
                tipoColumna === 4
                  ? "bg-primary/15 ring-2 ring-primary shadow-md shadow-primary/20 scale-[1.02]"
                  : "bg-surface-alt ring-1 ring-transparent hover:bg-surface hover:ring-border"
              }`}
            >
              <svg width="80" height="80" viewBox="0 0 80 80" className="pointer-events-none">
                {/* Plan view: 4 chords in a square */}
                <rect x="20" y="4" width="40" height="14" rx="1" fill="none" stroke="#9090b0" strokeWidth="1" />
                <circle cx="26" cy="11" r="2" fill="#fbbf24" />
                <circle cx="40" cy="11" r="2" fill="#fbbf24" />
                <circle cx="54" cy="11" r="2" fill="#fbbf24" />
                {/* Front elevation: 3 visible chords */}
                <line x1="26" y1="20" x2="26" y2="72" stroke="#fbbf24" strokeWidth="2" />
                <line x1="40" y1="20" x2="40" y2="72" stroke="#fbbf24" strokeWidth="2" />
                <line x1="54" y1="20" x2="54" y2="72" stroke="#fbbf24" strokeWidth="2" />
                {/* Diagonals */}
                <line x1="26" y1="20" x2="40" y2="38" stroke="#f87171" strokeWidth="1" />
                <line x1="40" y1="38" x2="26" y2="56" stroke="#f87171" strokeWidth="1" />
                <line x1="26" y1="56" x2="40" y2="72" stroke="#f87171" strokeWidth="1" />
                <line x1="40" y1="20" x2="54" y2="38" stroke="#f87171" strokeWidth="1" />
                <line x1="54" y1="38" x2="40" y2="56" stroke="#f87171" strokeWidth="1" />
                <line x1="40" y1="56" x2="54" y2="72" stroke="#f87171" strokeWidth="1" />
                {/* Montantes */}
                <line x1="26" y1="38" x2="54" y2="38" stroke="#4ade80" strokeWidth="1" />
                <line x1="26" y1="56" x2="54" y2="56" stroke="#4ade80" strokeWidth="1" />
              </svg>
              <div className="text-center">
                <p className={`text-xs font-semibold ${tipoColumna === 4 ? "text-primary" : "text-text"}`}>
                  Tipo 4 — Cel. completa
                </p>
                <p className="text-[10px] text-text-muted">4 cordones, reticulado 3D</p>
              </div>
            </button>
          </div>
        </section>

        {/* Vista frontal */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Vista frontal
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Cantidad de columnas</span>
              <DecimalInput value={cantColumnas} onChange={(v) => setCantColumnas(Math.round(v))} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Vuelo lateral (m)</span>
              <DecimalInput value={vueloLateral} onChange={setVueloLateral} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Sep. correas (m)</span>
              <DecimalInput value={sepCorreas} onChange={setSepCorreas} />
            </label>
          </div>
          {cantColumnas > 1 && (
            <p className="text-xs text-text-muted mt-3">
              Sep. columnas = {computedSepColumnas.toFixed(2)} m
              {vueloLateral > 0 && ` (vuelo ${vueloLateral.toFixed(2)} m en cada extremo)`}
            </p>
          )}
        </section>

        {/* Columna — dinámico según tipo */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Columna —{" "}
            {tipoColumna === 1
              ? "Simple IPN"
              : tipoColumna === 2
                ? "Celosía"
                : tipoColumna === 4
                  ? "Celosía completa"
                  : "Reticulado"}
          </h2>

          {tipoColumna === 1 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Perfil IPN</span>
                  <select
                    value={perfilIPN}
                    onChange={(e) => setPerfilIPN(e.target.value)}
                  >
                    {IPN_PROFILES.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    F<sub>y</sub> (MPa)
                  </span>
                  <select
                    value={Fy}
                    onChange={(e) => setFy(Number(e.target.value))}
                  >
                    <option value={235}>235 (F-24)</option>
                    <option value={275}>275 (F-28)</option>
                    <option value={355}>355 (F-36)</option>
                  </select>
                </label>
              </div>
              <p className="text-xs text-text-muted">
                El perfil IPN se verifica a flexocompresión con el momento de
                vuelco M<sub>base</sub>. La longitud de pandeo fuerte se toma
                {tienePuntal ? " desde el puntal (h_puntal)" : " como 2× altura (voladizo)"}
                ; la débil según separación de correas.
              </p>
            </>
          )}

          {tipoColumna !== 1 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    h<sub>col</sub> — Ancho sección (m)
                  </span>
                  <DecimalInput value={hCol} onChange={setHCol} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    a<sub>col</sub> — Alto panel (m)
                  </span>
                  <DecimalInput value={aCol} onChange={setACol} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    F<sub>y</sub> (MPa)
                  </span>
                  <select
                    value={Fy}
                    onChange={(e) => setFy(Number(e.target.value))}
                  >
                    <option value={235}>235 (F-24)</option>
                    <option value={275}>275 (F-28)</option>
                    <option value={355}>355 (F-36)</option>
                  </select>
                </label>
                {(tipoColumna === 2 || tipoColumna === 4) && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">K pandeo global</span>
                    <DecimalInput value={KGlobal} onChange={setKGlobal} />
                  </label>
                )}
                {tipoColumna === 4 && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">
                      sep<sub>col</sub> — Profundidad (m)
                    </span>
                    <DecimalInput value={separacionCol} onChange={setSeparacionCol} />
                  </label>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Perfil cordones</span>
                  <select
                    value={perfilCordon}
                    onChange={(e) => setPerfilCordon(e.target.value)}
                  >
                    {ANGLE_PROFILES.map((a) => (
                      <option key={a.name} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Perfil diagonales</span>
                  <select
                    value={perfilDiagonal}
                    onChange={(e) => setPerfilDiagonal(e.target.value)}
                  >
                    {ANGLE_PROFILES.map((a) => (
                      <option key={a.name} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Perfil montantes</span>
                  <select
                    value={perfilMontante}
                    onChange={(e) => setPerfilMontante(e.target.value)}
                  >
                    {ANGLE_PROFILES.map((a) => (
                      <option key={a.name} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}
        </section>

        {/* Viento */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Viento (CIRSOC 102)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">V (m/s)</span>
              <DecimalInput value={velocidadViento} onChange={setVelocidadViento} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Categoría</span>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              >
                <option value="I">I</option>
                <option value="II">II</option>
                <option value="III">III</option>
                <option value="IV">IV</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Exposición</span>
              <select
                value={exposicion}
                onChange={(e) => setExposicion(e.target.value)}
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </label>
          </div>
        </section>

        <div className="self-center flex gap-3">
          <button
            type="submit"
            className="bg-primary text-white font-semibold px-8 py-3 rounded-lg hover:bg-primary-hover transition-colors"
          >
            Calcular
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="bg-surface-alt border border-border text-text-muted font-semibold px-6 py-3 rounded-lg hover:bg-surface transition-colors"
          >
            {loadedSaveId ? "Guardar corrección" : "Guardar"}
          </button>
        </div>
      </form>
    </MainLayout>
  );
}
