import { useMemo } from "react";
import { MainLayout } from "@mascalculador/shared";
import { getActiveObraName } from "../lib/storage";
import { computoObraActiva, type FamiliaComputo } from "../lib/computo-obra";
import ComputoSection from "../components/ComputoSection";

const NOTAS: Record<FamiliaComputo["key"], string> = {
  losas:
    "Malla a cara vista (una barra más por borde); separación derivada de la As adoptada en el guardado.",
  vigas:
    "Barras de tramo = luz del tramo; barras de apoyo superior 1/3 de cada tramo adyacente (voladizos: 1.5 × luz del voladizo).",
  columnas: "Estribos con recubrimiento supuesto 2.5 cm.",
  bases:
    "Hormigón incluye viga de fundación / vigas de equilibrio. Armadura según la propuesta del diseño (la adopción manual de la pantalla no se guarda).",
  apoyos:
    "Solo acero: el hormigón ya computa en las losas. Largo = 1/3 de la luz de cada losa que apoya (borde compartido: 1/3 de luz por losa); cantidad según la menor luz perpendicular entre las losas del apoyo, una barra más por borde.",
};

function familiaVacia(f: FamiliaComputo): boolean {
  return (
    f.failed.length === 0 &&
    f.computo.hormigonM3 <= 0 &&
    f.computo.acero.length === 0
  );
}

/** Resumen de cómputos de la obra activa: hormigón y acero discriminado por
 *  diámetro, agregado por familia (losas, vigas, columnas, bases, apoyos). */
export default function ComputosObraScreen() {
  const obra = useMemo(() => computoObraActiva(), []);
  const obraName = getActiveObraName();
  const visibles = obra.familias.filter((f) => !familiaVacia(f));
  const vacia = obra.total.hormigonM3 <= 0 && obra.total.acero.length === 0;

  return (
    <MainLayout>
      <header>
        <h1 className="text-xl font-semibold text-text">
          Cómputos — {obraName}
        </h1>
        <p className="text-sm text-text-muted">
          Resumen de hormigón (m³) y acero (metros lineales y kg) discriminado
          por diámetro, para todos los elementos guardados de la obra.
        </p>
      </header>

      {vacia && (
        <section className="bg-surface rounded-xl border border-border p-8 text-center">
          <p className="text-text-muted">
            No hay elementos guardados en esta obra todavía.
          </p>
          <p className="text-sm text-text-muted mt-1">
            Los cómputos se arman con los losas, vigas, columnas y bases
            guardados (y los apoyos de losas con armadura definida).
          </p>
        </section>
      )}

      {visibles.map((f) => (
        <ComputoSection
          key={f.key}
          title={`Cómputo — ${f.label}`}
          computo={f.computo}
          showConcrete={!f.soloAcero}
          note={[
            NOTAS[f.key],
            f.failed.length > 0
              ? `No computables: ${f.failed.join(", ")}.`
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ))}

      {!vacia && (
        <ComputoSection
          title="Cómputo — Total de la obra"
          computo={obra.total}
        />
      )}
    </MainLayout>
  );
}
