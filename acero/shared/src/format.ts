export function formatForce(value: number): string {
  return `${value.toFixed(2)} kN`;
}

export function formatMoment(value: number): string {
  return `${value.toFixed(2)} kN·m`;
}

export function formatLength(value: number): string {
  if (value >= 1) return `${value.toFixed(2)} m`;
  return `${(value * 1000).toFixed(0)} mm`;
}
