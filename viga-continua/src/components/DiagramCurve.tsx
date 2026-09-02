import type { ReactElement } from "react";
import { Line } from "mafs";

interface DiagramCurveProps {
  /** Función a graficar; puede tener discontinuidades (saltos de corte). */
  fn: (x: number) => number;
  /** Puntos críticos (cargas puntuales, apoyos, cambios de carga) — las
   *  discontinuidades solo pueden ocurrir en estas ubicaciones. */
  criticalPoints: number[];
  /** Dominio de dibujo (extremos del diagrama). */
  x0: number;
  x1: number;
  color: string;
  /** Muestras por intervalo entre puntos críticos. */
  steps?: number;
  /** Fracción del máximo |y| que define un salto → línea vertical. */
  jumpRatio?: number;
}

/**
 * Dibuja la curva de un esfuerzo como segmentos, insertando líneas verticales
 * en las discontinuidades (saltos de corte en cargas puntuales y apoyos, y
 * cierre en arranque/fin del diagrama). Plot.OfX no puede representar
 * saltos: une con una diagonal y el diagrama "no se cierra".
 *
 * Los límites laterales se evalúan con ±ε: justo afuera de la viga el
 * esfuerzo es 0, por eso en los apoyos extremos la curva "cierra" contra el
 * eje (p. ej. el corte arranca con la subida 0 → R₀ en el apoyo inicial).
 */
export default function DiagramCurve({
  fn,
  criticalPoints,
  x0,
  x1,
  color,
  steps = 8,
  jumpRatio = 0.02,
}: DiagramCurveProps) {
  const pts = criticalPoints.filter((x) => x >= x0 - 1e-9 && x <= x1 + 1e-9);
  if (pts.length < 2) return null;

  const eps = (x1 - x0) * 1e-6;
  const yL = (x: number) => fn(x - eps);
  const yR = (x: number) => fn(x + eps);

  let maxY = 1e-9;
  for (const x of pts) {
    maxY = Math.max(maxY, Math.abs(fn(x)), Math.abs(yL(x)), Math.abs(yR(x)));
  }
  const tol = maxY * jumpRatio;

  const segs: ReactElement[] = [];
  let key = 0;
  const add = (a: [number, number], b: [number, number]) => {
    segs.push(<Line.Segment key={key++} point1={a} point2={b} color={color} />);
  };

  // Cierre en el arranque: valor fuera de la viga (0) → valor justo a la
  // derecha del apoyo inicial.
  const startIn = yR(pts[0]);
  if (Math.abs(fn(x0 - eps) - startIn) > tol) {
    add([x0, fn(x0 - eps)], [x0, startIn]);
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    let prev: [number, number] = [a, yR(a)];
    for (let k = 1; k < steps; k++) {
      const x = a + (k / steps) * (b - a);
      const next: [number, number] = [x, fn(x)];
      add(prev, next);
      prev = next;
    }
    const endY = yL(b);
    add(prev, [b, endY]);
    if (b < x1 && Math.abs(yR(b) - endY) > tol) {
      add([b, endY], [b, yR(b)]);
    }
  }

  // Cierre en el final: valor justo a la izquierda del último apoyo/punta →
  // valor fuera de la viga (0).
  const endIn = yL(pts[pts.length - 1]);
  if (Math.abs(endIn - fn(x1 + eps)) > tol) {
    add([x1, endIn], [x1, fn(x1 + eps)]);
  }

  return <>{segs}</>;
}
