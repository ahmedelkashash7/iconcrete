# Contrast report — IConcrete design tokens (hardening v1)

Produced by `node scripts/contrast-check.mjs` (WCAG 2.1 relative-luminance
formula, `oklch()` tokens converted to sRGB, tints alpha-composited over their
parent surface before measuring). Run it after any token change; it exits `1`
on any failure.

**Result: 62/62 required pairs meet their WCAG AA target.**

## Palette applied to `src/index.css`

| Token | Light | Dark | Print |
|---|---|---|---|
| `--background` | `#e9eef2` | `#121821` | `#ffffff` |
| `--foreground` | `#1b2430` | `#e8edf2` | `#1b2430` |
| `--card` / `--popover` | `#f7f9fb` | `#1a222c` | `#ffffff` |
| `--muted-foreground` | `#55606e` | `#a3b0bd` | `#3c4653` |
| `--primary` | `#24303f` | `oklch(0.925 0.005 250)` | — |
| `--border` (decorative hairline) | `#d5dde5` | `#3a4553` | `#7f8a96` |
| `--input` (control boundary) | `#737f8c` | `#6b7684` | — |
| `--ring` (focus indicator) | `#6b7684` | `#8b98a8` | — |
| `--brand` (amber) | `#975200` | `oklch(0.76 0.145 66)` | `#975200` |
| `--success` | `#007845` | `oklch(0.68 0.13 158)` | — |
| `--warning` | `oklch(0.48 0.115 72)` | `oklch(0.82 0.135 78)` | — |
| `--destructive` | `oklch(0.54 0.19 25)` | `oklch(0.68 0.17 25)` | — |
| `--sidebar` | `#f2f5f8` | `#161d26` | `#ffffff` |

## Measured ratios (abridged — full run lists all 62)

### Light mode

| Pair | Ratio | Need |
|---|---|---|
| body text on canvas | 13.40:1 | 4.5 |
| body text on card | 14.83:1 | 4.5 |
| muted text on canvas | 5.47:1 | 4.5 |
| muted text on card | 6.06:1 | 4.5 |
| primary button label | 12.68:1 | 4.5 |
| destructive button label | 5.58:1 | 4.5 |
| destructive text on card | 5.29:1 | 4.5 |
| destructive text on `destructive/10` | 4.53:1 | 4.5 |
| brand text on canvas | 5.10:1 | 4.5 |
| brand text on card | 5.65:1 | 4.5 |
| brand text on `brand/15` chip | 4.57:1 | 4.5 |
| success text on card | 5.27:1 | 4.5 |
| warning text on `warning/15` chip | 5.11:1 | 4.5 |
| sidebar text | 14.30:1 | 4.5 |
| input boundary on canvas / card | 3.50 / 3.87 | 3 |
| focus ring on canvas / card | 3.95 / 4.37 | 3 |
| chart-1…5 on card | 4.58 / 3.11 / 3.86 / 4.14 / 4.35 | 3 |

### Dark mode

| Pair | Ratio | Need |
|---|---|---|
| body text on canvas | 15.13:1 | 4.5 |
| body text on card | 13.62:1 | 4.5 |
| muted text on canvas / card | 8.06 / 7.26 | 4.5 |
| destructive button label (`bg-destructive/60`) | 6.03:1 | 4.5 |
| destructive text on card | 5.15:1 | 4.5 |
| brand text on canvas | 8.03:1 | 4.5 |
| sidebar primary label | 6.33:1 | 4.5 |
| input boundary on canvas / card | 3.86 / 3.48 | 3 |
| focus ring on canvas / card | 6.07 / 5.47 | 3 |
| chart-1…5 on card | 5.15 / 6.33 / 7.81 / 5.21 / 5.32 | 3 |

### Print / PDF

| Pair | Ratio | Need |
|---|---|---|
| body text on paper | 15.65:1 | 4.5 |
| muted text on paper | 9.58:1 | 4.5 |
| brand text on paper | 5.96:1 | 4.5 |
| rule / table border on paper | 3.51:1 | 3 |

## Deliberate exemptions (WCAG 1.4.11)

| Token | Ratio | Why exempt |
|---|---|---|
| `--border` on canvas (light) | 1.17:1 | Decorative hairline divider. It is not required to identify a component or a state; the boundaries that *are* required (input outline, focus ring) are reported above and meet 3:1. |
| `--sidebar-border` on sidebar | 1.17:1 | Same: a divider between sidebar sections. |
| `--border` on canvas (dark) | 1.83:1 | Same. |
| `bg-brand/20` hero glow | — | Purely ambient decoration with no text or control on it. |

If the owner later uses `--border` to delimit a *control* (for example a
checkbox outline), move that pair into the required list and darken the token
until it reaches 3:1.

## Not verified here

Contrast ratios are necessary but not sufficient for WCAG AA. **Not measured in
this pass:** keyboard-only traversal order, screen-reader labelling of dynamic
states, motion-reduction preferences, 200% zoom reflow, and touch-target size.
Those remain in `docs/KNOWN_LIMITATIONS.md`.
