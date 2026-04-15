/**
 * TEMPORARY parity test. Validates that the new `computeCutList` engine
 * produces bit-for-bit identical output (modulo piece IDs) to the legacy
 * `calculateDespiece` engine for the 10 golden catalog fixtures.
 *
 * This test file — AND the legacy engine it imports — are DELETED in the
 * final commit of the refactor once parity is green.
 */

import { describe, it, expect } from 'vitest';
import { calculateDespiece, type DespieceInput } from '../despieceCalculator';
import { cabinetConfigFromCatalogProduct } from './fromCatalogProduct';
import { computeCutList } from './computeCutList';
import { GOLDEN_FIXTURES, stripIds } from './fixtures/catalogFixtures';
import {
  cabinetTypeFromPrefix,
  getSeriesPrefix,
  getShelfCount,
  parseDimsFromDescription,
  parseDimsFromSku,
  parseDoorDrawerConfig,
} from './parseProductMetadata';

/**
 * Replicates the exact `DespieceInput` the old `bulkDespieceGenerator` would
 * have built for a given catalog row. Used to drive the legacy engine with
 * the same inputs the new pipeline uses.
 */
function legacyDespieceInputFromFixture(
  row: typeof GOLDEN_FIXTURES[number]['row'],
): DespieceInput {
  const prefix = getSeriesPrefix(row.sku);
  const dims = parseDimsFromSku(row.sku) ?? parseDimsFromDescription(row.description);
  if (!dims) throw new Error(`fixture ${row.sku} has unparseable dims`);
  const cabinetType = cabinetTypeFromPrefix(prefix, row.description);
  if (!cabinetType) throw new Error(`fixture ${row.sku} has unknown cabinet type`);
  const ddConfig = parseDoorDrawerConfig(row.sku, row.description, row.has_drawers);
  const shelf = getShelfCount(row.sku, row.description, cabinetType, dims.heightIn, ddConfig.isSink);

  return {
    heightIn: dims.heightIn,
    widthIn: dims.widthIn,
    depthIn: dims.depthIn,
    cabinetType,
    bodyThickness: 18,
    shelves: shelf.count,
    hasDoors: ddConfig.hasDoors,
    numDoors: ddConfig.numDoors,
    doorSectionHeightIn: 0,
    hasDrawers: ddConfig.hasDrawers,
    numDrawers: ddConfig.numDrawers,
    drawerSectionHeightIn: 0,
    shelfType: shelf.type,
    optimizeDepth: true,
    isSink: ddConfig.isSink,
    drawerBoxThickness: 15,
  };
}

describe('parity: computeCutList (new) vs calculateDespiece (legacy)', () => {
  for (const fixture of GOLDEN_FIXTURES) {
    it(`${fixture.label} — new engine output matches legacy`, () => {
      const adapted = cabinetConfigFromCatalogProduct(fixture.row);
      expect(adapted.ok).toBe(true);
      if (!adapted.ok) return;

      const newPieces = computeCutList(adapted.config);
      const legacyPieces = calculateDespiece(legacyDespieceInputFromFixture(fixture.row));

      expect(stripIds(newPieces)).toEqual(stripIds(legacyPieces));
    });
  }
});
