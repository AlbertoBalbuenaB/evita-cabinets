import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';

// Stub the supabase module so importing prefabImport.ts doesn't trip the
// env-var check in src/lib/supabase.ts. The parser helpers we're testing are
// pure and never touch the network.
vi.mock('./supabase', () => ({ supabase: {} }));

const { __testables } = await import('./prefabImport');
const { parseSheet, pickSheet } = __testables;

/**
 * Builds a workbook in-memory that mimics the Venus/Northville xlsx layout:
 * a header row on row 2 (row 1 could hold an optional vendor banner), then
 * SKU rows grouped by category (category filled on the first row of each
 * group, empty on subsequent rows — the parser forward-fills).
 */
function fixtureWorkbook(): XLSX.WorkBook {
  const aoa: (string | number)[][] = [
    ['Venus Cabinetry — Lista de precios', '', '', ''],
    ['CODE', 'FINISH', 'PRICE USD', 'CATEGORY'],
    ['B12', 'Houston Frost', 161, 'BASE CABINETS'],
    ['B12', 'Houston Ash', 175, ''],
    ['B12', 'Houston Blue', 180, ''],
    ['B24', 'Houston Frost', 223, ''],
    ['B24', 'Houston Ash', 240, ''],
    ['SB36', 'Houston Frost', 320, 'SINK BASE CABINET'],
    ['SB36', 'Houston Ash', 345, ''],
    ['W3030', 'Houston Frost', 210, 'WALL CABINET'],
    ['W3030', 'Houston Ash', 225, ''],
    // A stray empty row:
    ['', '', '', ''],
    // A junk-price row to verify errors are accumulated:
    ['TK8', 'N/A', 'not-a-number', 'ACCESSORIES'],
    // And a valid linear accessory:
    ['SM8', 'N/A', 45, ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Lista de precios Venus');
  // Add a dummy second sheet to verify pickSheet picks the hinted one.
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['unrelated']]), 'Notes');
  return wb;
}

describe('prefabImport.parseSheet', () => {
  it('finds header row and parses all valid rows', () => {
    const wb = fixtureWorkbook();
    const { rows, errors } = parseSheet(wb.Sheets['Lista de precios Venus']);
    // B12×3 + B24×2 + SB36×2 + W3030×2 + SM8 = 10 valid rows
    expect(rows).toHaveLength(10);
    // TK8 has a junk price → 1 error
    expect(errors.some((e) => /TK8/.test(e))).toBe(true);
  });

  it('forward-fills category across grouped rows', () => {
    const wb = fixtureWorkbook();
    const { rows } = parseSheet(wb.Sheets['Lista de precios Venus']);
    const b12Rows = rows.filter((r) => r.code === 'B12');
    expect(b12Rows).toHaveLength(3);
    for (const r of b12Rows) expect(r.category).toBe('BASE CABINETS');
    const sbRows = rows.filter((r) => r.code === 'SB36');
    for (const r of sbRows) expect(r.category).toBe('SINK BASE CABINET');
  });

  it('parses numeric price values', () => {
    const wb = fixtureWorkbook();
    const { rows } = parseSheet(wb.Sheets['Lista de precios Venus']);
    const b24 = rows.find((r) => r.code === 'B24' && r.finish === 'Houston Frost');
    expect(b24?.cost_usd).toBe(223);
  });

  it('accepts rows with different header labels (PRECIO / ACABADO)', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['CODIGO', 'ACABADO', 'PRECIO', 'CATEGORIA'],
      ['VB2421', 'Elegant White', 300, 'VANITIES'],
      ['VB3621', 'Elegant White', 380, ''],
    ]);
    const { rows, errors } = parseSheet(ws);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0].code).toBe('VB2421');
    expect(rows[1].category).toBe('VANITIES');
  });

  it('returns error when header row is missing', () => {
    const ws = XLSX.utils.aoa_to_sheet([['Random', 'junk'], ['data', 123]]);
    const { rows, errors } = parseSheet(ws);
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('strips wrapping quotes from codes', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['CODE', 'FINISH', 'USD', 'CATEGORY'],
      ['"B24"', 'Houston Frost', 223, 'BASE CABINETS'],
    ]);
    const { rows } = parseSheet(ws);
    expect(rows[0].code).toBe('B24');
  });
});

describe('prefabImport.pickSheet', () => {
  it('picks the "lista de precios" sheet over sibling sheets', () => {
    const wb = fixtureWorkbook();
    expect(pickSheet(wb)).toBe('Lista de precios Venus');
  });

  it('falls back to the first sheet when no hint matches', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Sheet1');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['y']]), 'Sheet2');
    expect(pickSheet(wb)).toBe('Sheet1');
  });
});
