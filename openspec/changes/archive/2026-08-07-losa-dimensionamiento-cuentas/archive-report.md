# Archive Report: losa-dimensionamiento-cuentas

## Status
verified / archived

## Date
2026-08-07

## Branch
feat/losa-ux-cuentas

## Commit
abbee9689ec8745611791996c6e58aabf893c375

## Summary
Helper `pushKaSteps` en `designSlab` que agrega 3 líneas con la derivación M_n → m_n → K_a al array `st` mostrado en "Ver cuentas completas". Aplicado a 6 call sites: dirX, dirY, supportX0/XL/Y0/YL.

## Specs affected
- slab-dimensionamiento-cuentas (sincronizado a base)

## Lines changed
+44 / -0 (2 files: apps/concrete + apps/steel mirror)

## Verification
- typecheck: pass
- build: pass
- md5_mirror: pass (b95fbc027fcf50257c8d4205abe1aced en ambos)
- 6/6 call sites verified
- Formula: K_a = 1 - √(1 - 2·m_n) con m_n = M_n·10⁶ / (0.85·f'c·b·d²) — CIRSOC 201-05

## Open follow-ups
- Si los DirectionResult de apoyos continuos no setean `d` propio en el futuro, el helper cae a un `d` global. Confirmar antes de refactor.
