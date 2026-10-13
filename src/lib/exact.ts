/**
 * IConcrete System — exact decimal arithmetic for compliance boundaries.
 *
 * The Egyptian-code rules compare a test result against a limit that is a
 * percentage of the characteristic strength, e.g. "a result is accepted when it
 * is **at least** 22.5 MPa". With IEEE-754 doubles, `22.5 - 25 * 0.1` is
 * `-2.7755575615628914e-16`, so a result that is exactly on the limit can be
 * judged "below" it. Quality acceptance is a legal question — the comparison has
 * to be exact.
 *
 * Everything here is `bigint` arithmetic on a fixed micro-unit scale (10⁻⁶).
 * Values are parsed from their **decimal text**, so `0.1 + 0.2` style binary
 * noise never enters the system. `fromUnits` is the only place a float appears,
 * and callers use it for display only — never for a comparison.
 *
 * Not a general-purpose decimal library: no rounding modes beyond half-up on
 * input, no arbitrary precision. That is deliberate — the domain needs exact
 * comparisons and exact sums, and nothing more.
 */

/** Fractional digits kept. 6 covers mm, MPa, m³, EGP and percentages. */
const SCALE = 6;
const FACTOR = 10n ** BigInt(SCALE);

const PATTERN = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;

/**
 * Parses decimal text (or a number, via its shortest decimal representation)
 * into exact micro-units. Throws on anything that is not a finite decimal.
 */
export function toUnits(value: number | string): bigint {
  const text = typeof value === "number" ? numberToDecimalText(value) : value.trim();
  const match = PATTERN.exec(text);
  if (!match || (match[2] === "" && (match[3] ?? "") === "")) {
    throw new Error(`exact: ليس رقمًا عشريًا صالحًا: ${String(value)}`);
  }
  const sign = match[1] === "-" ? -1n : 1n;
  const integer = match[2] || "0";
  const fraction = match[3] ?? "";
  const exponent = match[4] ? Number(match[4]) : 0;

  // digits × 10^(exponent - fraction.length)
  let digits = BigInt(integer + fraction);
  let power = exponent - fraction.length;

  if (power >= 0) {
    digits *= 10n ** BigInt(power);
    power = 0;
  }
  if (power + SCALE >= 0) {
    digits *= 10n ** BigInt(power + SCALE);
  } else {
    // More decimals than the scale keeps: round half-up on the digit after the
    // last kept one, using only integer arithmetic.
    const drop = BigInt(-(power + SCALE));
    const divisor = 10n ** drop;
    const quotient = digits / divisor;
    const remainder = digits % divisor;
    digits = remainder * 2n >= divisor ? quotient + 1n : quotient;
  }
  return sign * digits;
}

/** Shortest round-trip decimal text for a finite number. */
function numberToDecimalText(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`exact: قيمة غير منتهية: ${String(value)}`);
  }
  const text = String(value);
  if (!text.includes("e") && !text.includes("E")) return text;
  // Very large/small magnitudes: expand the exponent without float maths.
  const match = /^([+-]?)(\d*)(?:\.(\d*))?[eE]([+-]?\d+)$/.exec(text);
  if (!match) throw new Error(`exact: تعبير غير مدعوم: ${text}`);
  const sign = match[1];
  const integer = match[2] || "0";
  const fraction = match[3] ?? "";
  const exponent = Number(match[4]);
  const digits = integer + fraction;
  const pointAt = integer.length + exponent;
  if (pointAt <= 0) return `${sign}0.${"0".repeat(-pointAt)}${digits}`;
  if (pointAt >= digits.length) return `${sign}${digits}${"0".repeat(pointAt - digits.length)}`;
  return `${sign}${digits.slice(0, pointAt)}.${digits.slice(pointAt)}`;
}

/** For display only — never compare two `fromUnits` results. */
export function fromUnits(units: bigint): number {
  return Number(units) / Number(FACTOR);
}

/** Human-readable fixed-point text, e.g. `formatUnits(toUnits(22.5), 1)` → "22.5". */
export function formatUnits(units: bigint, decimals = 2): string {
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const whole = absolute / FACTOR;
  const fraction = (absolute % FACTOR).toString().padStart(SCALE, "0").slice(0, decimals);
  const sign = negative ? "-" : "";
  return decimals === 0 ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
}

/** -1 | 0 | 1, exact. */
export function compare(a: bigint, b: bigint): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Exact sum of exact values. */
export function sum(values: bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n);
}

/** units × integer, exact. */
export function scaleByInteger(units: bigint, factor: number | bigint): bigint {
  return units * BigInt(factor);
}

/**
 * Exact `units × numerator / denominator` with round-half-up on the last
 * micro-unit. Integer division on bigints truncates toward zero, so negatives
 * are rounded symmetrically.
 */
export function scaleByRatio(units: bigint, numerator: number | bigint, denominator: number | bigint): bigint {
  const n = BigInt(numerator);
  const d = BigInt(denominator);
  if (d === 0n) throw new Error("exact: القسمة على صفر");
  const product = units * n;
  const quotient = product / d;
  const remainder = product % d;
  const rounded = (remainder < 0n ? -remainder : remainder) * 2n >= (d < 0n ? -d : d)
    ? quotient + (product < 0n ? -1n : 1n)
    : quotient;
  return rounded;
}

/** Exact percentage of an amount: `amount × pct / 100`. */
export function percentOf(amount: bigint, pct: number | string): bigint {
  return scaleByRatio(amount, toUnits(pct), toUnits(100));
}

/**
 * Exact comparison of a mean against a threshold, without dividing.
 *
 * `mean(sum, count) >= threshold`  ⇔  `sum >= threshold × count`
 *
 * so the mean of four cube results is compared at full precision instead of
 * being rounded through a float first.
 */
export function compareMean(
  totalUnits: bigint,
  count: number,
  thresholdUnits: bigint,
): -1 | 0 | 1 {
  return compare(totalUnits, thresholdUnits * BigInt(count));
}

/**
 * Exact test of `count / total > pct / 100` — the R-FIN "share of results below
 * fcu" comparison.
 *
 * Cross-multiplied so no division happens and the micro-unit scale cancels:
 * `count/total > pct/100`  ⇔  `count × 100 × 10^SCALE > toUnits(pct) × total`.
 * Comparing `toUnits(pct)` directly against `count × 100` would mix scales (the
 * first version of this code did, and 7.5% came out as "within 5%").
 */
export function shareExceeds(
  count: number,
  total: number,
  pct: number | string,
): boolean {
  if (total <= 0) return false;
  const left = BigInt(count) * 100n * FACTOR;
  const right = toUnits(pct) * BigInt(total);
  return left > right;
}

/** Convenience: exact "value >= limit". */
export function atLeast(value: bigint, limit: bigint): boolean {
  return value >= limit;
}

/** Convenience: exact "value <= limit". */
export function atMost(value: bigint, limit: bigint): boolean {
  return value <= limit;
}

/** Exact absolute difference. */
export function absoluteDifference(a: bigint, b: bigint): bigint {
  return a >= b ? a - b : b - a;
}
