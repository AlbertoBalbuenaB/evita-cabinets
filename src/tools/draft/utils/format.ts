/**
 * Draft Tool — formatting helpers.
 *
 * Canonical internal unit is millimeters. These helpers convert to AWI-spec
 * fractional inches or metric (cm) strings at render time. Nothing in this
 * file persists anything; they are pure functions consumed by the canvas,
 * dimension labels, and the AWI spec string builder.
 */

/** Convert inches to millimeters. */
export const inToMm = (n: number): number => n * 25.4;

/** Convert millimeters to inches (exact). */
export const mmToIn = (mm: number): number => mm / 25.4;

/** Convert millimeters to centimeters with 1-decimal rounding. */
export const mmToCm = (mm: number): number => Math.round((mm / 10) * 10) / 10;

/**
 * Format a millimeter value as an AWI-standard fractional inch string, rounded
 * to the nearest 1/16". Examples:
 *   694.5mm → '27 3/8"'
 *   610mm   → '24"'
 *   6.35mm  → '1/4"'
 *
 * The output always ends in the `"` (double-prime) character, and reduces
 * any fraction whose numerator divides 16 (2/16 → 1/8, 8/16 → 1/2, etc).
 */
export function formatInchesFractional(mm: number): string {
  if (!Number.isFinite(mm)) return '—';
  const sign = mm < 0 ? '-' : '';
  const abs = Math.abs(mm);
  const totalSixteenths = Math.round((abs / 25.4) * 16);
  const whole = Math.floor(totalSixteenths / 16);
  const remainder = totalSixteenths - whole * 16;

  if (remainder === 0) return `${sign}${whole}"`;

  // Reduce the fraction to lowest terms over a denominator that is a
  // power of two dividing 16.
  let num = remainder;
  let den = 16;
  while (num % 2 === 0 && den % 2 === 0) {
    num /= 2;
    den /= 2;
  }

  if (whole === 0) return `${sign}${num}/${den}"`;
  return `${sign}${whole} ${num}/${den}"`;
}

/** Format a millimeter value in centimeters with 1-decimal precision. */
export function formatCm(mm: number): string {
  if (!Number.isFinite(mm)) return '—';
  const cm = mmToCm(mm);
  // Keep trailing zero (e.g. "69.5 cm") for consistency with manufacturing spec sheets.
  return `${cm.toFixed(1)} cm`;
}

/** Format a millimeter value with feet-and-inches for long wall dimensions. */
export function formatFeetInches(mm: number): string {
  if (!Number.isFinite(mm)) return '—';
  const totalInches = mmToIn(mm);
  const totalSixteenths = Math.round(totalInches * 16);
  const sign = totalSixteenths < 0 ? '-' : '';
  const abs = Math.abs(totalSixteenths);
  const feet = Math.floor(abs / (12 * 16));
  const sixteenthsRem = abs - feet * 12 * 16;
  const inches = Math.floor(sixteenthsRem / 16);
  const fractionSixteenths = sixteenthsRem - inches * 16;

  const inchPart = (() => {
    if (fractionSixteenths === 0) return `${inches}"`;
    let num = fractionSixteenths;
    let den = 16;
    while (num % 2 === 0 && den % 2 === 0) {
      num /= 2;
      den /= 2;
    }
    return inches === 0 ? `${num}/${den}"` : `${inches} ${num}/${den}"`;
  })();

  if (feet === 0) return `${sign}${inchPart}`;
  return `${sign}${feet}' ${inchPart}`;
}

/**
 * Parse a length expression typed by the user into millimeters. Accepts:
 *   - plain inches:    `189"` / `189 in` / `189`
 *   - feet-inches:     `15' 9"` / `15-9` / `15 9`
 *   - metric:          `4800mm` / `480cm` / `4.8m`
 *
 * Returns `null` on any parse failure.
 */
export function parseLengthExpression(raw: string): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');

  // Metric
  const mmMatch = s.match(/^([-+]?\d+(?:\.\d+)?)\s*mm$/);
  if (mmMatch) return parseFloat(mmMatch[1]);
  const cmMatch = s.match(/^([-+]?\d+(?:\.\d+)?)\s*cm$/);
  if (cmMatch) return parseFloat(cmMatch[1]) * 10;
  const mMatch = s.match(/^([-+]?\d+(?:\.\d+)?)\s*m$/);
  if (mMatch) return parseFloat(mMatch[1]) * 1000;

  // Feet-inches: `15' 9"`, `15' 9 1/2"`, `15-9`, `15 9`
  const ftInMatch = s.match(
    /^([-+]?\d+)\s*(?:'|ft|-|\s)\s*(\d+)(?:\s+(\d+)\/(\d+))?\s*(?:"|in)?$/
  );
  if (ftInMatch) {
    const feet = parseInt(ftInMatch[1], 10);
    const inches = parseInt(ftInMatch[2], 10);
    const fracNum = ftInMatch[3] ? parseInt(ftInMatch[3], 10) : 0;
    const fracDen = ftInMatch[4] ? parseInt(ftInMatch[4], 10) : 1;
    const totalIn = feet * 12 + inches + (fracDen ? fracNum / fracDen : 0);
    return inToMm(totalIn);
  }

  // Plain inches with optional fraction: `27 3/8"` / `27.5"` / `27`
  const inchMatch = s.match(/^([-+]?\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?\s*(?:"|in)?$/);
  if (inchMatch) {
    const whole = parseFloat(inchMatch[1]);
    const fracNum = inchMatch[2] ? parseInt(inchMatch[2], 10) : 0;
    const fracDen = inchMatch[3] ? parseInt(inchMatch[3], 10) : 1;
    const totalIn = whole + (fracDen ? fracNum / fracDen : 0);
    return inToMm(totalIn);
  }

  return null;
}

/**
 * Build the AWI spec string shown next to the diamond tag. Format varies by
 * language:
 *   EN → `102-36"x30"x24"`              (fractional inches, no decimals)
 *   ES → `102-91.4 cm x 76.2 cm x 61.0 cm`
 *
 * The CDS prefix is optional — if omitted we just return the dimensions.
 */
export function formatAwiSpec(
  cdsCode: string | null,
  widthMm: number,
  heightMm: number,
  depthMm: number | null | undefined,
  lang: 'en' | 'es'
): string {
  const dims =
    lang === 'en'
      ? [
          formatInchesFractional(widthMm),
          formatInchesFractional(heightMm),
          depthMm != null ? formatInchesFractional(depthMm) : null,
        ]
      : [formatCm(widthMm), formatCm(heightMm), depthMm != null ? formatCm(depthMm) : null];

  const dimString = dims.filter(Boolean).join(lang === 'en' ? 'x' : ' x ');
  return cdsCode ? `${cdsCode}-${dimString}` : dimString;
}
