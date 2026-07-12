# Design: Viga Acero — Reordenamiento de Resultados y Predimensionamiento con Zx

## Technical Approach

Extend `DesignResult` to surface every intermediate already computed in `checkBeam()` locals (λ's, Mp, Lp, Lr, Mn_* variants, Fe, Mcr, Mr). Add `Lb1`/`Lb2` to `SteelDesignParams` with sign-based Lb selection (`Mu ≥ 0 ? Lb1 : Lb2`) at call time. In `FormPage`, compute `Zx_req` via `useMemo` from `calculateBeamDual().maxMomentU`, show inline soft-warn banner when selected `Zx < Zx_req`, Calcular always enabled when a profile is picked. In `ResultsPage`, expose "Mostrar cálculos" (profile table → λ audit → classification → LTB formulas) before "Mostrar resultados" (Mu/Md ratio + Corte/Deformación unchanged). Complete IPN and UPN catalogs with 7 new fields each.

## Architecture Decisions

| Decision | Option | Tradeoff | Choice |
|----------|--------|----------|--------|
| Lb1/Lb2 storage | Add optional fields to `SteelDesignParams`, keep `Lb` for backward deserialization | Extra fields but zero migration; legacy records default both to `Lb` | **Chosen** |
| Classification enum | String union `'COMPACT' \| 'NON_COMPACT' \| 'SLENDER'` (no TypeScript enum) | `erasableSyntaxOnly: true` blocks enums; union types are lighter | **Chosen** |
| `d`/`bf` aliases | Accessor helpers `getD(p)`/`getBf(p)` in `profiles.ts` returning `p.h`/`p.b` | No struct bloat; call sites stay clean; engine uses `h`/`b` unchanged | **Chosen** |
| Zx_req recompute | `useMemo` on `[loads, Fy, spans, supportTypes]` calling `calculateBeamDual` | Sub-ms Simpson × 200pts; negligible perf; no extra state | **Chosen** |
| UPN Cw flag | `cwApprox: boolean` on `UPNData`; UI shows "aprox." tooltip on Cw cell only | Clutters no other audit row; flag is collocated with the data | **Chosen** |
| Md1 / Md2 split | `Md1 = φ·min(MnFlange, MnWeb)` and `Md2 = φ·MnLTB` as separate fields; engine already computes both as `MnCompact` and `MnLTB` | Zero new math; matches AISC audit expectation | **Chosen** |

## Data Model Changes (`client/src/types.d.ts`)

```typescript
interface SteelDesignParams {
  profileName: string;
  Fy: number;              // MPa
  Lb: number;              // mm (legacy, retained for backward compat)
  Lb1?: number;            // mm (new, defaults to totalLength × 1000)
  Lb2?: number;            // mm (new, defaults to totalLength × 1000)
  Cb: number;
  deflectionLimit: number;
}
```

## Engine Changes (`client/src/lib/steel-design.ts`)

**Signature**: `checkBeam(profile, params, serviceM, Mu)` — new 4th param `Mu` (N·mm, signed ultimate moment at |Mu| max section). Effective Lb: `const Lb = Mu >= 0 ? (params.Lb1 ?? params.Lb) : (params.Lb2 ?? params.Lb)`.

**Expanded `DesignResult`** — added fields (all finite `number` for valid profiles with Fy∈{235,275,355}):

| Field | Units | Source |
|-------|-------|--------|
| `Mp` | N·mm | `Fy × Zx × 1e3` (Zx cm³→mm³) |
| `classification` | string union | lambdaF/lambdaW vs lambdaP*/lambdaR* |
| `lambdaF`, `lambdaW` | — | `b/(2·tf)`, `(h-2·tf)/tw` |
| `lambdaPf`, `lambdaRf`, `lambdaPw`, `lambdaRw` | — | formulas with √(E/Fy) |
| `MnFlange`, `MnWeb` | N·mm | non-compact interpolation |
| `Md1` | N·mm | `PHI_B × min(MnFlange, MnWeb)` |
| `Lp`, `Lr` | mm | existing engine locals |
| `MnLTB` | N·mm | inelastic/elastic LTB |
| `Md2` | N·mm | `PHI_B × MnLTB(Lb)` |
| `Mr` | N·mm | `0.7 × Fy × Sx × 1e3` |
| `Fe` | MPa | elastic LTB stress (F4-11) |
| `Mcr` | N·mm | `Fe × Sx` (capped at Mp) |

**cm³→mm³ conversion**: established pattern `×1e3` from bugfix #131. Every field that multiplies or divides profile cm³ properties documents the conversion.

## Catalog Completion

**IPN** (`profiles.ts`): add `peso` (kg/m), `Sy` (cm³), `Zy` (cm³), `rx` (cm) per entry, plus `d`/`bf` accessor helpers. 19 entries × 4 fields = ~76 values from DIN 1025-1 tables.

**UPN** (`upn-profiles.ts`): add `peso`, `Sx`, `Sy` (cm³), `J` (cm⁴), `Cw` (cm⁶), `cwApprox` (boolean). 16 entries × 6 fields = ~96 values. `Cw` uses `Iw = tf × bf³ × (h − tf)² / 4` where tabulated values unavailable; `cwApprox = true` flagged.

## UI Flow

```
FormPage
  ├─ Lb1 / Lb2 inputs (mm, below Cb, default totalLength×1000)
  ├─ Zx_req preview (useMemo on loads→Mu→Zx_req cm³, hidden when loads invalid)
  ├─ Soft-warn banner: "Perfil bajo: Zx = X cm³, necesario ≥ Y cm³" (yellow, non-blocking)
  └─ Calcular: enabled if valid && profile selected (NO Zx gate)

ResultsPage
  ├─ "Mostrar cálculos" (new, top)
  │   ├─ Características del perfil (17-field table, d/bF aliases)
  │   ├─ λ flap + web audit (actual, λ_p, λ_r with formulas)
  │   ├─ Classification banner (Compacta / No compacta / Con elementos esbeltos)
  │   └─ LTB audit (Md1, Lp, Lr, Mr, Mcr, Md2 — each with formula)
  └─ "Mostrar resultados" (below)
      ├─ Subdimensioned banner (red, if Zx_selected < Zx_req)
      ├─ Mu / Md ratio (red if Md<Mu)
      └─ Corte / Deformación (unchanged)
```

Classification labels live as a `const CLASSIFICATION_LABELS: Record<string, string>` in `ResultsPage.tsx` — single file, no import cost, one-line mapping.

## Files Affected

| File | Action | Est. lines |
|------|--------|-----------|
| `client/src/types.d.ts` | Modify | +8 |
| `client/src/lib/steel-design.ts` | Modify | +35 |
| `client/src/lib/profiles.ts` | Modify | +80 (data rows) |
| `client/src/lib/upn-profiles.ts` | Modify | +75 (data rows) |
| `client/src/screens/FormPage.tsx` | Modify | +45 |
| `client/src/screens/ResultsPage.tsx` | Modify | +140 |

**Total ~383 logic lines + 155 data lines = ~538 lines.** Catalog data rows (~155 lines) are tabulated values mechanically verifiable against DIN tables; logic changes (~383 lines) are under the 400-line review budget. If review budget is strictly additive, the catalog rows could be a chained PR slice.

## Risks

- **cm³ vs mm³**: every exposed field that uses Zx, Sx, or Iy documents `×1e3` or `×1e4` conversion explicitly in a unit comment.
- **Lb1/Lb2 backward compat**: legacy `Lb` carries into both; `Lb` field retained.
- **Zx_req recompute**: `useMemo` keyed on loads/config, sub-ms; no perf risk.
- **UPN Cw approximation**: flagged in UI; exact values are a separate data task.

## Open Questions

- [ ] Should catalog completion be a separate chained PR from the logic changes? (Review budget: catalog is 155 lines of mechanical data.)
- [ ] None blocking — all architectural forks resolved by user decisions (#135 soft-warn, Lb sign selection, UPN Cw formula).
