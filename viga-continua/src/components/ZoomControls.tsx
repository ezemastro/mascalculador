/**
 * ZoomControls — botones +/- y "fit" para ajustar el viewBox del diagrama.
 *
 * El padre mantiene un `viewBoxOverride: [xLo, xHi, yLo, yHi]` opcional y
 * este componente lo muta vía callbacks.
 *
 * Estrategia de zoom: mantener el centro fijo y multiplicar los spans por
 * un factor. `in` = 0.8 (zoom +25%), `out` = 1.25 (zoom -20% aprox).
 *
 * `fit` resetea el viewBoxOverride a null, lo que hace que el diagrama
 * vuelva al fit-to-bbox automático.
 */

interface Props {
  hasOverride: boolean;
  onIn: () => void;
  onOut: () => void;
  onFit: () => void;
}

export default function ZoomControls({
  hasOverride,
  onIn,
  onOut,
  onFit,
}: Props) {
  return (
    <div
      role="group"
      aria-label="Controles de zoom"
      className="inline-flex items-center gap-1 bg-surface-alt rounded-lg p-1"
    >
      <button
        type="button"
        onClick={onIn}
        aria-label="Acercar"
        title="Acercar (zoom +)"
        className="w-8 h-8 text-sm font-bold text-text-muted hover:text-text rounded-md hover:bg-surface"
      >
        +
      </button>
      <button
        type="button"
        onClick={onOut}
        aria-label="Alejar"
        title="Alejar (zoom -)"
        className="w-8 h-8 text-sm font-bold text-text-muted hover:text-text rounded-md hover:bg-surface"
      >
        −
      </button>
      <button
        type="button"
        onClick={onFit}
        aria-label="Ajustar"
        title="Ajustar al contenido"
        disabled={!hasOverride}
        className="px-2 h-8 text-xs font-medium text-text-muted hover:text-text rounded-md hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Fit
      </button>
    </div>
  );
}
