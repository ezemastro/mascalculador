import type { Computo } from "../lib/computo";

const fmt = (n: number, d = 2): string =>
  n.toLocaleString("es-AR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

/** Sección de cómputo de materiales (hormigón m³ + acero por Ø). */
export default function ComputoSection({
  computo,
  note,
  title = "Cómputo de materiales",
  showConcrete = true,
}: {
  computo: Computo | null;
  /** Criterios específicos del elemento, se agregan a la nota general. */
  note?: string;
  title?: string;
  /** Oculta la tarjeta de hormigón (familias de solo acero). */
  showConcrete?: boolean;
}) {
  if (!computo) return null;
  return (
    <section className="bg-surface rounded-xl border border-border p-5">
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
        {title}
      </h2>
      <div
        className={`grid gap-3 mb-4 ${showConcrete ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:max-w-48"}`}
      >
        <div
          className={`bg-surface-alt rounded-lg p-3 ${showConcrete ? "" : "hidden"}`}
        >
          <span className="text-xs text-text-muted">Hormigón</span>
          <p className="text-xl font-bold text-primary mt-0.5">
            {fmt(computo.hormigonM3)} m³
          </p>
        </div>
        <div className="bg-surface-alt rounded-lg p-3">
          <span className="text-xs text-text-muted">Acero total</span>
          <p className="text-xl font-bold text-primary mt-0.5">
            {fmt(computo.kgTotal)} kg
          </p>
        </div>
      </div>

      {computo.acero.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-xs text-text-muted uppercase tracking-wider">
                <th className="text-left py-2 pr-4 font-semibold">Ø (mm)</th>
                <th className="text-right py-2 px-4 font-semibold">
                  Metros lineales
                </th>
                <th className="text-right py-2 pl-4 font-semibold">Kg</th>
              </tr>
            </thead>
            <tbody>
              {computo.acero.map((row) => (
                <tr key={row.diam} className="border-b border-border/60">
                  <td className="py-1.5 pr-4 font-semibold text-text">
                    Ø{row.diam}
                  </td>
                  <td className="py-1.5 px-4 text-right tabular-nums">
                    {fmt(row.metros)} m
                  </td>
                  <td className="py-1.5 pl-4 text-right tabular-nums">
                    {fmt(row.kg)}
                  </td>
                </tr>
              ))}
              <tr className="font-bold text-primary">
                <td className="py-1.5 pr-4">Total</td>
                <td className="py-1.5 px-4 text-right tabular-nums">
                  {fmt(computo.acero.reduce((a, r) => a + r.metros, 0))} m
                </td>
                <td className="py-1.5 pl-4 text-right tabular-nums">
                  {fmt(computo.kgTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-text-muted">Sin acero adoptado todavía.</p>
      )}

      <p className="text-xs text-text-muted mt-3">
        Cómputo teórico: longitudes de colocación sin traslapos ni recortes de
        recubrimiento. Estribos con gancho 10·Ø.
        {note ? ` ${note}` : ""}
      </p>
    </section>
  );
}
