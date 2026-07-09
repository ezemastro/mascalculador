import { useState } from "react";
import { useNavigate } from "react-router";
import MainLayout from "../components/MainLayout";
import { IPN_PROFILES } from "../lib/profiles";
import { UPN_PROFILES } from "../lib/upn-profiles";
import { TUBE_PROFILES } from "../lib/tube-profiles";

export interface ColumnState {
  profileType: "IPN" | "UPN" | "2UPN" | "TUBO" | "ARMADA_I" | "ARMADA_CAJON";
  profileName: string;
  upnName: string;
  upnGap: number;
  tubeName?: string;
  // Built-up I
  armadaBf?: number;
  armadaTf?: number;
  armadaHw?: number;
  armadaTw?: number;
  // Built-up box
  cajonH?: number;
  cajonB?: number;
  cajonT?: number;
  Pu: number;
  Mux: number;
  Muy: number;
  L: number;
  Kx: number;
  Ky: number;
  Fy: number;
}

function sanitizeDecimal(val: string): string {
  // Replace comma (both regular and numpad) with dot
  return val.replace(/,/g, ".");
}

export default function ColumnForm() {
  const navigate = useNavigate();

  const [profileType, setProfileType] = useState<
    "IPN" | "UPN" | "2UPN" | "TUBO" | "ARMADA_I" | "ARMADA_CAJON"
  >("IPN");
  const [profileName, setProfileName] = useState("IPN 200");
  const [upnName, setUpnName] = useState("UPN 200");
  const [upnGap, setUpnGap] = useState(10); // mm
  const [tubeName, setTubeName] = useState("□ 100×100×4");
  // Built-up I defaults
  const [armadaBf, setArmadaBf] = useState(200); // mm
  const [armadaTf, setArmadaTf] = useState(12); // mm
  const [armadaHw, setArmadaHw] = useState(200); // mm
  const [armadaTw, setArmadaTw] = useState(8); // mm
  // Built-up box defaults
  const [cajonH, setCajonH] = useState(200); // mm
  const [cajonB, setCajonB] = useState(200); // mm
  const [cajonT, setCajonT] = useState(6); // mm
  const [Pu, setPu] = useState(100);
  const [Mux, setMux] = useState(20);
  const [Muy, setMuy] = useState(5);
  const [L, setL] = useState(3000); // mm
  const [Kx, setKx] = useState(1.0);
  const [Ky, setKy] = useState(1.0);
  const [Fy, setFy] = useState(235);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const state: ColumnState = {
      profileType,
      profileName,
      upnName,
      upnGap,
      tubeName,
      armadaBf,
      armadaTf,
      armadaHw,
      armadaTw,
      cajonH,
      cajonB,
      cajonT,
      Pu,
      Mux,
      Muy,
      L,
      Kx,
      Ky,
      Fy,
    };
    navigate("/column-results", { state });
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
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text">
            Calculadora de Columnas
          </h1>
          <p className="text-sm text-text-muted">
            CIRSOC 301-05 &mdash; Capítulos E, F y H
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Perfil */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Perfil
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Tipo</span>
              <select
                value={profileType}
                onChange={(e) =>
                  setProfileType(
                    e.target.value as typeof profileType,
                  )
                }
              >
                <option value="IPN">IPN</option>
                <option value="UPN">UPN</option>
                <option value="2UPN">Doble UPN (cajón)</option>
                <option value="TUBO">Tubo (SHS/RHS)</option>
                <option value="ARMADA_I">Doble T armada</option>
                <option value="ARMADA_CAJON">Cajón armado</option>
              </select>
            </label>
            {profileType === "IPN" && (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Perfil</span>
                <select
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                >
                  {IPN_PROFILES.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {profileType === "UPN" && (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Perfil</span>
                <select
                  value={upnName}
                  onChange={(e) => setUpnName(e.target.value)}
                >
                  {UPN_PROFILES.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {profileType === "2UPN" && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">UPN</span>
                  <select
                    value={upnName}
                    onChange={(e) => setUpnName(e.target.value)}
                  >
                    {UPN_PROFILES.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    Separación (mm)
                  </span>
                  <input
                    type="text"
                    defaultValue={upnGap ?? ""}
                    key={`col-gap-${upnGap}`}
                    onChange={(e) => {
                      const raw = sanitizeDecimal(e.target.value);
                      const num = parseFloat(raw);
                      setUpnGap(isNaN(num) ? 0 : num);
                    }}
                  />
                </label>
              </>
            )}
            {profileType === "TUBO" && (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Perfil</span>
                <select
                  value={tubeName}
                  onChange={(e) => setTubeName(e.target.value)}
                >
                  <optgroup label="Cuadrados (SHS)">
                    {TUBE_PROFILES.filter((t) => t.shape === "SHS").map(
                      (t) => (
                        <option key={t.name} value={t.name}>
                          {t.name}
                        </option>
                      ),
                    )}
                  </optgroup>
                  <optgroup label="Rectangulares (RHS)">
                    {TUBE_PROFILES.filter((t) => t.shape === "RHS").map(
                      (t) => (
                        <option key={t.name} value={t.name}>
                          {t.name}
                        </option>
                      ),
                    )}
                  </optgroup>
                </select>
              </label>
            )}
            {profileType === "ARMADA_I" && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    b<sub>f</sub> ala (mm)
                  </span>
                  <input
                    type="text"
                    defaultValue={armadaBf ?? ""}
                    key={`col-armadaBf-${armadaBf}`}
                    onChange={(e) => {
                      const raw = sanitizeDecimal(e.target.value);
                      const num = parseFloat(raw);
                      setArmadaBf(isNaN(num) ? 0 : num);
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    t<sub>f</sub> ala (mm)
                  </span>
                  <input
                    type="text"
                    defaultValue={armadaTf ?? ""}
                    key={`col-armadaTf-${armadaTf}`}
                    onChange={(e) => {
                      const raw = sanitizeDecimal(e.target.value);
                      const num = parseFloat(raw);
                      setArmadaTf(isNaN(num) ? 0 : num);
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    h<sub>w</sub> alma (mm)
                  </span>
                  <input
                    type="text"
                    defaultValue={armadaHw ?? ""}
                    key={`col-armadaHw-${armadaHw}`}
                    onChange={(e) => {
                      const raw = sanitizeDecimal(e.target.value);
                      const num = parseFloat(raw);
                      setArmadaHw(isNaN(num) ? 0 : num);
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    t<sub>w</sub> alma (mm)
                  </span>
                  <input
                    type="text"
                    defaultValue={armadaTw ?? ""}
                    key={`col-armadaTw-${armadaTw}`}
                    onChange={(e) => {
                      const raw = sanitizeDecimal(e.target.value);
                      const num = parseFloat(raw);
                      setArmadaTw(isNaN(num) ? 0 : num);
                    }}
                  />
                </label>
              </>
            )}
            {profileType === "ARMADA_CAJON" && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">h altura (mm)</span>
                  <input
                    type="text"
                    defaultValue={cajonH ?? ""}
                    key={`col-cajonH-${cajonH}`}
                    onChange={(e) => {
                      const raw = sanitizeDecimal(e.target.value);
                      const num = parseFloat(raw);
                      setCajonH(isNaN(num) ? 0 : num);
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">b ancho (mm)</span>
                  <input
                    type="text"
                    defaultValue={cajonB ?? ""}
                    key={`col-cajonB-${cajonB}`}
                    onChange={(e) => {
                      const raw = sanitizeDecimal(e.target.value);
                      const num = parseFloat(raw);
                      setCajonB(isNaN(num) ? 0 : num);
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">t espesor (mm)</span>
                  <input
                    type="text"
                    defaultValue={cajonT ?? ""}
                    key={`col-cajonT-${cajonT}`}
                    onChange={(e) => {
                      const raw = sanitizeDecimal(e.target.value);
                      const num = parseFloat(raw);
                      setCajonT(isNaN(num) ? 0 : num);
                    }}
                  />
                </label>
              </>
            )}
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
        </section>

        {/* Cargas */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Solicitaciones
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                P<sub>u</sub> (kN)
              </span>
              <input
                type="text"
                defaultValue={Pu ?? ""}
                key={`col-pu-${Pu}`}
                onChange={(e) => {
                  const raw = sanitizeDecimal(e.target.value);
                  const num = parseFloat(raw);
                  setPu(isNaN(num) ? 0 : num);
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                M<sub>u,x</sub> (kN·m)
              </span>
              <input
                type="text"
                defaultValue={Mux ?? ""}
                key={`col-mux-${Mux}`}
                onChange={(e) => {
                  const raw = sanitizeDecimal(e.target.value);
                  const num = parseFloat(raw);
                  setMux(isNaN(num) ? 0 : num);
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                M<sub>u,y</sub> (kN·m)
              </span>
              <input
                type="text"
                defaultValue={Muy ?? ""}
                key={`col-muy-${Muy}`}
                onChange={(e) => {
                  const raw = sanitizeDecimal(e.target.value);
                  const num = parseFloat(raw);
                  setMuy(isNaN(num) ? 0 : num);
                }}
              />
            </label>
          </div>
        </section>

        {/* Condiciones de borde */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Condiciones de borde
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">L (mm)</span>
              <input
                type="text"
                defaultValue={L ?? ""}
                key={`col-l-${L}`}
                onChange={(e) => {
                  const raw = sanitizeDecimal(e.target.value);
                  const num = parseFloat(raw);
                  setL(isNaN(num) ? 0 : num);
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                K<sub>x</sub>
              </span>
              <select
                value={Kx}
                onChange={(e) => setKx(Number(e.target.value))}
              >
                <option value={0.5}>0.5 (emp-emp)</option>
                <option value={0.7}>0.7 (emp-art)</option>
                <option value={1.0}>1.0 (art-art)</option>
                <option value={2.0}>2.0 (voladizo)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                K<sub>y</sub>
              </span>
              <select
                value={Ky}
                onChange={(e) => setKy(Number(e.target.value))}
              >
                <option value={0.5}>0.5 (emp-emp)</option>
                <option value={0.7}>0.7 (emp-art)</option>
                <option value={1.0}>1.0 (art-art)</option>
                <option value={2.0}>2.0 (voladizo)</option>
              </select>
            </label>
          </div>
        </section>

        <button
          type="submit"
          className="self-center bg-primary text-white font-semibold px-8 py-3 rounded-lg hover:bg-primary-hover transition-colors"
        >
          Calcular
        </button>
      </form>
    </MainLayout>
  );
}
