import { describe, it, expect } from 'vitest';
import { cabinetConfigFromCatalogProduct } from './fromCatalogProduct';
import { computeCutList } from './computeCutList';
import { GOLDEN_FIXTURES, stripIds } from './fixtures/catalogFixtures';

/**
 * Golden snapshot tests for the full catalog-row → cut-list pipeline.
 *
 * If you intentionally change the engine's output, run `vitest -u` to update
 * the committed snapshots and make sure the diff is what you expect.
 *
 * These snapshots protect against any unintended regression in the pure
 * engine and in the catalog adapter. `id` fields are stripped because
 * `crypto.randomUUID()` is non-deterministic.
 */
describe('computeCutList — golden snapshots (catalog pipeline)', () => {
  for (const fixture of GOLDEN_FIXTURES) {
    it(`${fixture.label}`, () => {
      const result = cabinetConfigFromCatalogProduct(fixture.row);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const pieces = computeCutList(result.config);
      expect(stripIds(pieces)).toMatchSnapshot();
    });
  }
});
