/**
 * Public barrel for the cabinet domain module.
 *
 * This is the single import surface for the cut-list engine and its adapters.
 * The engine itself (`computeCutList`) is pure and agnostic to the origin of
 * its input. Adapters translate from specific sources (today: catalog rows;
 * later: Draft Tool custom cabinets) into the canonical `CabinetConfig`.
 */

export type {
  CabinetConfig,
  CabinetFamily,
  EngineFamily,
  EdgebandType,
} from './CabinetConfig';
export { toEngineFamily } from './CabinetConfig';

export { computeCutList } from './computeCutList';

export {
  cabinetConfigFromCatalogProduct,
  parse2dFromSku,
  type CatalogProductInput,
  type CatalogAdapterResult,
  type CatalogAdapterReason,
} from './fromCatalogProduct';

// NOTE: `cabinetConfigFromCustomPiece` is intentionally NOT exported here —
// it belongs to the Draft Tool Phase 2 work, not this refactor.
