import type { ReactNode } from "react";

export type ScreenHeaderTone = "saved" | "unsaved" | "neutral";

/** Chip de estado del encabezado (guardado / sin guardar / neutro). */
function Chip({ label, tone }: { label: string; tone: ScreenHeaderTone }) {
  const classes =
    tone === "saved"
      ? "border-success/30 bg-success/10 text-success"
      : tone === "unsaved"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-border bg-surface-alt text-text-muted";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}

/**
 * Encabezado institucional de pantalla: logo de Mastropietro, filete de marca,
 * título, metadatos y acciones. Mismo lenguaje visual en todos los módulos.
 */
export default function ScreenHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: { label: string; tone?: ScreenHeaderTone };
  actions?: ReactNode;
}) {
  return (
    <header className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="h-1.5 bg-gradient-to-r from-brand to-[#2f7d3b]" />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4 p-5">
        <img
          src="/brand-logo.png"
          alt="Marcelo Mastropietro Atelier — Ingeniería & Arquitectura"
          className="h-14 w-auto rounded-lg bg-white px-3 py-2 ring-1 ring-black/5"
        />
        <div className="hidden h-12 w-px bg-border sm:block" />
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight text-text sm:text-2xl">
            {title}
          </h1>
          {(subtitle || badge) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
              {subtitle}
              {badge && (
                <Chip label={badge.label} tone={badge.tone ?? "neutral"} />
              )}
            </div>
          )}
        </div>
        {actions && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
