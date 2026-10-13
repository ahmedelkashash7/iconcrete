#!/usr/bin/env node
/**
 * IConcrete System — WCAG contrast check for the design tokens.
 *
 * The palette below mirrors `src/index.css` exactly and lists every
 * foreground/background pair the interface actually renders, including
 * foreground-on-tint pairs such as `text-brand` inside `bg-brand/15`
 * (the tint is alpha-composited over its parent surface before measuring).
 *
 *   node scripts/contrast-check.mjs
 *
 * Exits 1 if any required pair fails, so it can run in CI.
 * Targets (WCAG 2.1 AA): 4.5:1 body/small text (1.4.3), 3:1 large text and
 * UI graphics / control boundaries / focus indicators (1.4.11).
 *
 * Only pairs that are *decorative* (hairline dividers, ambient glows) are
 * reported without a target and marked "n/a" — they are exempt under 1.4.11
 * because they carry no information. Nothing required is exempted.
 */

/* ---------------------------------------------------------------- colour */

function oklchToRgb(l, c, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const lc = l_ ** 3;
  const mc = m_ ** 3;
  const sc = s_ ** 3;
  const lr = 4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc;
  const lg = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc;
  const lb = -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc;
  const gamma = (u) => {
    const v = u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(Math.max(u, 0), 1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(v * 255)));
  };
  return [gamma(lr), gamma(lg), gamma(lb)];
}

export function parseColor(value) {
  const text = String(value).trim().toLowerCase();
  const oklch = text.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (oklch) return oklchToRgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]));
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!hex) throw new Error(`unsupported colour: ${value}`);
  const digits = hex[1];
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((d) => d + d)
          .join("")
      : digits;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Alpha-composite `overlay` at `alpha` on top of the opaque `base`. */
export function blend(overlay, base, alpha) {
  const o = parseColor(overlay);
  const b = parseColor(base);
  return o.map((channel, i) => Math.round(alpha * channel + (1 - alpha) * b[i]));
}

function toCss(rgb) {
  return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** WCAG 2.1 relative luminance; accepts a css string or an [r,g,b] triple. */
export function luminance(color) {
  const rgb = Array.isArray(color) ? color : parseColor(color);
  const [r, g, b] = rgb.map((channel) => {
    const v = channel / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio (1.4.3). */
export function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/* -------------------------------------------------------- token definition */

/** Mirrors :root in src/index.css. */
const LIGHT = {
  background: "#e9eef2",
  foreground: "#1b2430",
  card: "#f7f9fb",
  popover: "#f7f9fb",
  primary: "#24303f",
  primaryForeground: "#f7f9fb",
  secondary: "#eef2f6",
  muted: "#eef2f6",
  mutedForeground: "#55606e",
  accent: "#edf1f5",
  accentForeground: "#1b2430",
  destructive: "oklch(0.54 0.19 25)",
  border: "#d5dde5",
  input: "#737f8c",
  ring: "#6b7684",
  chart: [
    "oklch(0.552 0.121 256)",
    "oklch(0.632 0.115 176)",
    "oklch(0.6 0.13 66)",
    "oklch(0.596 0.168 22)",
    "oklch(0.573 0.112 300)",
  ],
  sidebar: "#f2f5f8",
  sidebarForeground: "#1b2430",
  sidebarAccent: "#edf1f5",
  sidebarBorder: "#dde4ea",
  sidebarRing: "#6b7684",
  brand: "#975200",
  brandForeground: "oklch(0.24 0.045 62)",
  success: "#007845",
  successForeground: "#ffffff",
  warning: "oklch(0.48 0.115 72)",
  warningForeground: "oklch(0.3 0.06 78)",
};

/** Mirrors .dark in src/index.css. */
const DARK = {
  background: "#121821",
  foreground: "#e8edf2",
  card: "#1a222c",
  popover: "#1a222c",
  primary: "oklch(0.925 0.005 250)",
  primaryForeground: "oklch(0.235 0.015 256)",
  secondary: "#232c37",
  mutedForeground: "#a3b0bd",
  accent: "#262f3b",
  destructive: "oklch(0.68 0.17 25)",
  border: "#3a4553",
  input: "#6b7684",
  ring: "#8b98a8",
  chart: [
    "oklch(0.66 0.13 258)",
    "oklch(0.7 0.12 176)",
    "oklch(0.78 0.14 66)",
    "oklch(0.68 0.15 22)",
    "oklch(0.68 0.12 300)",
  ],
  sidebar: "#161d26",
  sidebarForeground: "#e8edf2",
  sidebarPrimary: "#6b9bd8",
  sidebarPrimaryForeground: "#10161d",
  sidebarBorder: "#3a4553",
  sidebarRing: "#8b98a8",
  brand: "oklch(0.76 0.145 66)",
  brandForeground: "oklch(0.24 0.045 62)",
  success: "oklch(0.68 0.13 158)",
  successForeground: "oklch(0.185 0.011 256)",
};

/** Mirrors the @media print block in src/index.css. */
const PRINT = {
  background: "#ffffff",
  foreground: "#1b2430",
  mutedForeground: "#3c4653",
  border: "#7f8a96",
  brand: "#975200",
};

/* -------------------------------------------------------------- the checks */

const WHITE = "#ffffff";

/** `on(parent, tint, alpha)` = the tint composited over the parent surface. */
const on = (parent, tint, alpha) => toCss(blend(tint, parent, alpha));

const CHECKS = [];

/* ---- light mode ---- */
for (const [name, surface] of [
  ["canvas", LIGHT.background],
  ["card", LIGHT.card],
  ["muted surface", LIGHT.muted],
]) {
  CHECKS.push(["light", `body text on ${name}`, LIGHT.foreground, surface, 4.5]);
  CHECKS.push(["light", `muted text on ${name}`, LIGHT.mutedForeground, surface, 4.5]);
}
CHECKS.push(["light", "primary button label", LIGHT.primaryForeground, LIGHT.primary, 4.5]);
CHECKS.push(["light", "text on accent surface", LIGHT.accentForeground, LIGHT.accent, 4.5]);
CHECKS.push(["light", "destructive button label", WHITE, LIGHT.destructive, 4.5]);
CHECKS.push(["light", "destructive text on card", LIGHT.destructive, LIGHT.card, 4.5]);
CHECKS.push(["light", "destructive text on destructive/10", LIGHT.destructive, on(LIGHT.card, LIGHT.destructive, 0.1), 4.5]);
CHECKS.push(["light", "brand text on canvas", LIGHT.brand, LIGHT.background, 4.5]);
CHECKS.push(["light", "brand text on card", LIGHT.brand, LIGHT.card, 4.5]);
CHECKS.push(["light", "brand text on brand/15 chip", LIGHT.brand, on(LIGHT.card, LIGHT.brand, 0.15), 4.5]);
CHECKS.push(["light", "brand-foreground on brand/10 chip", LIGHT.brandForeground, on(LIGHT.card, LIGHT.brand, 0.1), 4.5]);
CHECKS.push(["light", "success text on card", LIGHT.success, LIGHT.card, 4.5]);
CHECKS.push(["light", "success text on success/10 chip", LIGHT.success, on(LIGHT.card, LIGHT.success, 0.1), 4.5]);
CHECKS.push(["light", "success button label", LIGHT.successForeground, LIGHT.success, 4.5]);
CHECKS.push(["light", "warning text on warning/15 chip", LIGHT.warning, on(LIGHT.card, LIGHT.warning, 0.15), 4.5]);
CHECKS.push(["light", "warning text on card", LIGHT.warning, LIGHT.card, 4.5]);
CHECKS.push(["light", "warning-foreground on warning/10 chip", LIGHT.warningForeground, on(LIGHT.card, LIGHT.warning, 0.1), 4.5]);
CHECKS.push(["light", "sidebar text", LIGHT.sidebarForeground, LIGHT.sidebar, 4.5]);
CHECKS.push(["light", "sidebar accent text", LIGHT.sidebarForeground, LIGHT.sidebarAccent, 4.5]);
CHECKS.push(["light", "input boundary on canvas (control)", LIGHT.input, LIGHT.background, 3]);
CHECKS.push(["light", "input boundary on card (control)", LIGHT.input, LIGHT.card, 3]);
CHECKS.push(["light", "focus ring on canvas", LIGHT.ring, LIGHT.background, 3]);
CHECKS.push(["light", "focus ring on card", LIGHT.ring, LIGHT.card, 3]);
CHECKS.push(["light", "sidebar focus ring", LIGHT.sidebarRing, LIGHT.sidebar, 3]);
LIGHT.chart.forEach((color, index) => {
  CHECKS.push(["light", `chart-${index + 1} on card (graphic)`, color, LIGHT.card, 3]);
});
CHECKS.push(["light", "hairline divider on canvas", LIGHT.border, LIGHT.background, "n/a"]);
CHECKS.push(["light", "sidebar hairline", LIGHT.sidebarBorder, LIGHT.sidebar, "n/a"]);

/* ---- dark mode ---- */
for (const [name, surface] of [
  ["canvas", DARK.background],
  ["card", DARK.card],
]) {
  CHECKS.push(["dark", `body text on ${name}`, DARK.foreground, surface, 4.5]);
  CHECKS.push(["dark", `muted text on ${name}`, DARK.mutedForeground, surface, 4.5]);
}
CHECKS.push(["dark", "primary button label", DARK.primaryForeground, DARK.primary, 4.5]);
// In dark mode ui/button.tsx and ui/badge.tsx render `dark:bg-destructive/60`,
// so the label sits on the 60% destructive overlay, not on the raw token.
CHECKS.push(["dark", "destructive button label", WHITE, on(DARK.card, DARK.destructive, 0.6), 4.5]);
CHECKS.push(["dark", "destructive button label on canvas", WHITE, on(DARK.background, DARK.destructive, 0.6), 4.5]);
CHECKS.push(["dark", "destructive text on card", DARK.destructive, DARK.card, 4.5]);
CHECKS.push(["dark", "destructive text on destructive/10", DARK.destructive, on(DARK.card, DARK.destructive, 0.1), 4.5]);
CHECKS.push(["dark", "brand text on canvas", DARK.brand, DARK.background, 4.5]);
CHECKS.push(["dark", "brand text on brand/15 chip", DARK.brand, on(DARK.card, DARK.brand, 0.15), 4.5]);
CHECKS.push(["dark", "success text on card", DARK.success, DARK.card, 4.5]);
CHECKS.push(["dark", "success text on success/10 chip", DARK.success, on(DARK.card, DARK.success, 0.1), 4.5]);
CHECKS.push(["dark", "sidebar text", DARK.sidebarForeground, DARK.sidebar, 4.5]);
CHECKS.push(["dark", "sidebar primary label", DARK.sidebarPrimaryForeground, DARK.sidebarPrimary, 4.5]);
CHECKS.push(["dark", "text on accent surface", DARK.foreground, DARK.accent, 4.5]);
CHECKS.push(["dark", "input boundary on canvas (control)", DARK.input, DARK.background, 3]);
CHECKS.push(["dark", "input boundary on card (control)", DARK.input, DARK.card, 3]);
CHECKS.push(["dark", "focus ring on canvas", DARK.ring, DARK.background, 3]);
CHECKS.push(["dark", "focus ring on card", DARK.ring, DARK.card, 3]);
DARK.chart.forEach((color, index) => {
  CHECKS.push(["dark", `chart-${index + 1} on card (graphic)`, color, DARK.card, 3]);
});
CHECKS.push(["dark", "hairline divider on canvas", DARK.border, DARK.background, "n/a"]);

/* ---- print / PDF ---- */
CHECKS.push(["print", "body text on paper", PRINT.foreground, PRINT.background, 4.5]);
CHECKS.push(["print", "muted text on paper", PRINT.mutedForeground, PRINT.background, 4.5]);
CHECKS.push(["print", "brand text on paper", PRINT.brand, PRINT.background, 4.5]);
CHECKS.push(["print", "rule/table border on paper (graphic)", PRINT.border, PRINT.background, 3]);

/* ------------------------------------------------------------------ report */

let failed = 0;
let required = 0;
const width = Math.max(...CHECKS.map((check) => check[1].length));
console.log(`IConcrete design-token contrast check — ${CHECKS.length} pairs\n`);

let currentMode = "";
for (const [mode, label, fg, bg, target] of CHECKS) {
  if (mode !== currentMode) {
    currentMode = mode;
    console.log(`\n[${mode}]`);
  }
  const ratio = contrast(fg, bg);
  if (target === "n/a") {
    console.log(`  n/a   ${label.padEnd(width)}  ${ratio.toFixed(2).padStart(6)}:1  (decorative)`);
    continue;
  }
  required += 1;
  const ok = ratio + 1e-9 >= target;
  if (!ok) failed += 1;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(width)}  ${ratio.toFixed(2).padStart(6)}:1  (need ${String(target)}:1)`,
  );
}

console.log(`\n${required - failed}/${required} required pairs meet their WCAG AA target.`);
console.log("Computed with the WCAG 2.1 relative-luminance formula; oklch tokens converted to sRGB,");
console.log("tints alpha-composited over their parent surface before measuring.");

process.exit(failed === 0 ? 0 : 1);
