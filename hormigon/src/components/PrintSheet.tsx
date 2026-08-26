import type { PlanillaSheet } from "../lib/print-planilla";

function cellClass(align: string | undefined): string {
  if (align === "right") return "num";
  if (align === "center") return "ctr";
  return "";
}

/** Hoja A4 horizontal con la planilla municipal. Se renderiza solo en
 *  impresión (el portal vive en #print-root, oculto en pantalla). */
export default function PrintSheet({ sheet }: { sheet: PlanillaSheet }) {
  const today = new Date().toLocaleDateString();
  return (
    <div className="planilla-sheet">
      <div className="planilla-head">
        <div className="planilla-fields">
          <div className="planilla-field">
            <span>Obra:</span>
            <span className="planilla-underline" />
          </div>
          <div className="planilla-field">
            <span>Fecha:</span>
            <span className="planilla-underline narrow">{today}</span>
          </div>
        </div>
        <div className="planilla-titles">
          <h1>{sheet.title}</h1>
          {sheet.subtitle && <p>{sheet.subtitle}</p>}
        </div>
        <div className="planilla-fields">
          <div className="planilla-field">
            <span>Hoja N°:</span>
            <span className="planilla-underline narrow">1</span>
          </div>
        </div>
      </div>

      <p className="planilla-count">{sheet.countLabel}</p>

      <table>
        <thead>
          <tr>
            {sheet.columns.map((col) => (
              <th
                key={col.key}
                className={cellClass(col.align)}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={cellClass(sheet.columns[j]?.align)}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {sheet.notes?.map((note, i) => (
        <p key={i} className="planilla-notes">
          {note}
        </p>
      ))}
    </div>
  );
}
