/**
 * Prefab SKU code → estimated dimensions decoder.
 *
 * Used for initial catalog seeding and for runtime xlsx imports. Covers the
 * prefixes observed in Venus 2024-09 and Northville 2024-09 price lists,
 * targeting ≥80% coverage at high/medium confidence. Unknown codes fall back
 * to `{ item_type: 'cabinet', dims null, confidence: 'low' }`.
 *
 * Convention: widths/heights/depths are in inches. `null` means "unknown"
 * (leave the column empty so a human can fill it in and set `dims_locked`).
 */

import type { PrefabItemType } from '../types';

export type DecodeConfidence = 'high' | 'medium' | 'low';

export interface DecodedPrefabCode {
  item_type: PrefabItemType;
  width_in: number | null;
  height_in: number | null;
  depth_in: number | null;
  confidence: DecodeConfidence;
}

// Standard dimensions by cabinet family (inches).
const BASE_DEPTH = 24;
const BASE_HEIGHT = 34.5;
const WALL_DEPTH = 12;
const VANITY_DEPTH = 21;
const VANITY_HEIGHT = 34.5;
const TALL_DEPTH = 24;

const DEFAULT_RESULT: DecodedPrefabCode = {
  item_type: 'cabinet',
  width_in: null,
  height_in: null,
  depth_in: null,
  confidence: 'low',
};

function n2(s: string | undefined): number | null {
  if (s == null) return null;
  const v = parseInt(s, 10);
  return Number.isFinite(v) ? v : null;
}

interface Rule {
  name: string;
  re: RegExp;
  build: (m: RegExpMatchArray) => DecodedPrefabCode;
}

/**
 * Rules are evaluated in order. Always put longer prefixes before their
 * shorter parents (e.g. VSB before VS, GDWDC before GDW, WMD before W).
 *
 * Optional trailing groups absorb handedness, drawer counts, and finish
 * modifiers without polluting the dimension parse:
 *   (?:L|R|L\/R|DL\/R|DD)?   handedness
 *   (?:-\d+)?                drawer count / variant number
 *   (?:-S|-PO)?              scribed / pull-out markers
 */
const SUFFIX = '(?:DL\\/R|DL|DR|L\\/R|L|R|DD|D)?(?:-\\d+)?(?:-[A-Z]+)?';

const RULES: Rule[] = [
  // ─────────── Vanity family (check before base) ───────────
  // VSD3021L, VSD60SINGLE, VSD60DOUBLE
  {
    name: 'VSD',
    re: new RegExp(`^VSD(\\d{2})(\\d{2})?(?:SINGLE|DOUBLE)?${SUFFIX}$`),
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: VANITY_HEIGHT,
      depth_in: m[2] ? n2(m[2]) : VANITY_DEPTH,
      confidence: m[2] ? 'high' : 'medium',
    }),
  },
  // VSB2421 (width + 21d), VSB2421
  {
    name: 'VSB',
    re: new RegExp(`^VSB(\\d{2})(\\d{2})?${SUFFIX}$`),
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: VANITY_HEIGHT,
      depth_in: m[2] ? n2(m[2]) : VANITY_DEPTH,
      confidence: 'high',
    }),
  },
  // Vanity drawer base. Northville: VDB12-3, VDB122134-3 (12w 21d 34h)
  //                    Venus:      VDB1221 (12w 21d)
  {
    name: 'VDB',
    re: /^VDB(\d{2})(?:(\d{2})(\d{2}))?(?:21)?(?:-\d+)?$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: m[3] ? n2(m[3]) : VANITY_HEIGHT,
      depth_in: m[2] ? n2(m[2]) : VANITY_DEPTH,
      confidence: 'high',
    }),
  },
  // Vanity base: VB1221, Northville VA242134, VA362134DL/R
  {
    name: 'VB',
    re: /^VB(\d{2})(?:21)?$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: VANITY_HEIGHT,
      depth_in: VANITY_DEPTH,
      confidence: 'high',
    }),
  },
  {
    name: 'VA',
    re: /^VA(\d{2})(?:(\d{2})(\d{2}))?(?:DL\/R|D|DD)?$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: m[3] ? n2(m[3]) : VANITY_HEIGHT,
      depth_in: m[2] ? n2(m[2]) : VANITY_DEPTH,
      confidence: 'high',
    }),
  },
  // Valance (Northville VAS4210 = 42" width, linear molding)
  {
    name: 'VAS',
    re: /^VAS(\d{2})(\d{2})?$/,
    build: (m) => ({
      item_type: 'linear',
      width_in: n2(m[1]),
      height_in: m[2] ? n2(m[2]) : null,
      depth_in: null,
      confidence: 'medium',
    }),
  },

  // ─────────── Wall family (longest first) ───────────
  // Glass door wall diagonal corner: GDWDC2415
  {
    name: 'GDWDC',
    re: /^GDWDC(\d{2})(\d{2})$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: n2(m[2]),
      depth_in: WALL_DEPTH,
      confidence: 'high',
    }),
  },
  // Glass door wall: GDW1230, GDW3636
  {
    name: 'GDW',
    re: /^GDW(\d{2})(\d{2})$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: n2(m[2]),
      depth_in: WALL_DEPTH,
      confidence: 'high',
    }),
  },
  // Wall microwave diagonal corner (Northville): WMDC2430, WMDC243615
  {
    name: 'WMDC',
    re: /^WMDC(\d{2})(\d{2})(?:\d{2})?$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: n2(m[2]),
      depth_in: WALL_DEPTH,
      confidence: 'high',
    }),
  },
  // Wall microwave (depth) – Northville WMD1215, WMD2430-2
  {
    name: 'WMD',
    re: /^WMD(\d{2})(\d{2})(?:-\d+)?$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: n2(m[2]),
      depth_in: WALL_DEPTH,
      confidence: 'high',
    }),
  },
  // Wall diagonal corner: WDC2430, WDC243615, WDC244215
  {
    name: 'WDC',
    re: /^WDC(\d{2})(\d{2})(?:\d{2})?$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: n2(m[2]),
      depth_in: WALL_DEPTH,
      confidence: 'high',
    }),
  },
  // Wall blind corner: WBC2730L/R
  {
    name: 'WBC',
    re: /^WBC(\d{2})(\d{2})(?:L\/R|L|R)?$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: n2(m[2]),
      depth_in: WALL_DEPTH,
      confidence: 'high',
    }),
  },
  // Wall pantry corner: WPC2430
  {
    name: 'WPC',
    re: /^WPC(\d{2})(\d{2})$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: n2(m[2]),
      depth_in: TALL_DEPTH,
      confidence: 'high',
    }),
  },
  // Wall pantry (tall): WP1884, WP188427 (custom depth)
  {
    name: 'WP',
    re: /^WP(\d{2})(\d{2})(\d{2})?$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: n2(m[2]),
      depth_in: m[3] ? n2(m[3]) : TALL_DEPTH,
      confidence: 'high',
    }),
  },
  // Wall standard: W1230, W301224 (6 digits = w h d), W0930, W2424
  {
    name: 'W_6d',
    re: /^W(\d{2})(\d{2})(\d{2})$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: n2(m[2]),
      depth_in: n2(m[3]),
      confidence: 'high',
    }),
  },
  {
    name: 'W_4d',
    re: /^W(\d{2})(\d{2})$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: n2(m[2]),
      depth_in: WALL_DEPTH,
      confidence: 'high',
    }),
  },

  // ─────────── Tall / Oven / Hood ───────────
  // Tall pantry: TP1884, TP3096 (w + h)
  {
    name: 'TP',
    re: /^TP(\d{2})(\d{2})$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: n2(m[2]),
      depth_in: TALL_DEPTH,
      confidence: 'high',
    }),
  },
  // Oven cabinet: OC3084, OC308427 (optional depth)
  {
    name: 'OC',
    re: /^OC(\d{2})(\d{2})(\d{2})?$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: n2(m[2]),
      depth_in: m[3] ? n2(m[3]) : TALL_DEPTH,
      confidence: 'high',
    }),
  },
  // Range hood: RHA3030, RHA4236
  {
    name: 'RHA',
    re: /^RHA(\d{2})(\d{2})$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: n2(m[2]),
      depth_in: WALL_DEPTH,
      confidence: 'high',
    }),
  },

  // ─────────── Base family (after longer prefixes) ───────────
  // Drawer base: DB12, DB24-2, DB30-3
  {
    name: 'DB',
    re: /^DB(\d{2})(?:-\d+)?$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: BASE_HEIGHT,
      depth_in: BASE_DEPTH,
      confidence: 'high',
    }),
  },
  // Sink base: SB30, SB42
  {
    name: 'SB',
    re: /^SB(\d{2})$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: BASE_HEIGHT,
      depth_in: BASE_DEPTH,
      confidence: 'high',
    }),
  },
  // Base filler (linear): BF3, BF6, BF336, BF636
  {
    name: 'BF',
    re: /^BF(\d{1,2})(\d{2})?(?:-PO)?$/,
    build: (m) => ({
      item_type: 'linear',
      width_in: n2(m[1]),
      height_in: m[2] ? n2(m[2]) : null,
      depth_in: null,
      confidence: 'medium',
    }),
  },
  // Base blind corner: BBC39/42, BBC42(45)
  {
    name: 'BBC',
    re: /^BBC(\d{2})[/(](\d{2})\)?$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: BASE_HEIGHT,
      depth_in: BASE_DEPTH,
      confidence: 'medium',
    }),
  },
  // Base cabinet: B12..B42, allow trailing letter like B18TR
  {
    name: 'B',
    re: /^B(\d{2})[A-Z]{0,2}$/,
    build: (m) => ({
      item_type: 'cabinet',
      width_in: n2(m[1]),
      height_in: BASE_HEIGHT,
      depth_in: BASE_DEPTH,
      confidence: 'high',
    }),
  },

  // ─────────── Linear / panel accessories ───────────
  // Toe kick: TK8 (8 ft linear)
  {
    name: 'TK',
    re: /^TK\d+$/,
    build: () => ({
      item_type: 'linear',
      width_in: null,
      height_in: null,
      depth_in: null,
      confidence: 'medium',
    }),
  },
  // Scribe molding: SM, SM8, SM8-S
  {
    name: 'SM',
    re: /^SM\d*(?:-S)?$/,
    build: () => ({
      item_type: 'linear',
      width_in: null,
      height_in: null,
      depth_in: null,
      confidence: 'medium',
    }),
  },
  // Refrigerator panel: RRPF, RRPF3*120, RRP2496
  {
    name: 'RRPF',
    re: /^RRPF?(?:[\d*."]+)?$/,
    build: () => ({
      item_type: 'panel',
      width_in: null,
      height_in: null,
      depth_in: null,
      confidence: 'medium',
    }),
  },
  // Base panel: BP2496-3/4, BP9636 (decorative panels)
  {
    name: 'BP',
    re: /^BP\d+(?:-\d+\/\d+)?$/,
    build: () => ({
      item_type: 'panel',
      width_in: null,
      height_in: null,
      depth_in: null,
      confidence: 'medium',
    }),
  },
  // Wall filler: WF330, WF642, WF696
  {
    name: 'WF',
    re: /^WF(\d)(\d{2})$/,
    build: (m) => ({
      item_type: 'linear',
      width_in: n2(m[1]),
      height_in: n2(m[2]),
      depth_in: null,
      confidence: 'medium',
    }),
  },
];

/**
 * Decode a prefab cabinet code into estimated dimensions.
 *
 * - Normalizes to uppercase and trims whitespace/quotes first.
 * - Returns the first matching rule (rules are ordered longest-prefix-first).
 * - Unknown codes: `{ item_type: 'cabinet', all dims null, confidence: 'low' }`
 */
export function decodePrefabCode(rawCode: string): DecodedPrefabCode {
  const code = rawCode.trim().replace(/^"+|"+$/g, '').toUpperCase();
  if (!code) return { ...DEFAULT_RESULT };

  for (const rule of RULES) {
    const m = code.match(rule.re);
    if (m) return rule.build(m);
  }
  return { ...DEFAULT_RESULT };
}
