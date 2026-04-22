import { getSupabase } from './supabase.ts';

export interface SettingsCache {
  laborCostNoDrawers: number;
  laborCostWithDrawers: number;
  laborCostAccessories: number;
  wastePercentageBox: number;
  wastePercentageDoors: number;
  exchangeRateUsdToMxn: number;
}

const DEFAULTS: SettingsCache = {
  laborCostNoDrawers: 400,
  laborCostWithDrawers: 600,
  laborCostAccessories: 100,
  wastePercentageBox: 10,
  wastePercentageDoors: 10,
  exchangeRateUsdToMxn: 18,
};

const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: SettingsCache | null = null;
let lastFetch = 0;
let inflight: Promise<SettingsCache> | null = null;

export async function getSettings(): Promise<SettingsCache> {
  const now = Date.now();
  if (cached && now - lastFetch < CACHE_TTL_MS) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data, error } = await getSupabase()
        .from('settings')
        .select('key, value');
      if (error) throw error;

      const raw = (data ?? []).reduce<Record<string, number>>((acc, row) => {
        const n = parseFloat(row.value);
        if (Number.isFinite(n)) acc[row.key] = n;
        return acc;
      }, {});

      cached = {
        laborCostNoDrawers: raw.labor_cost_no_drawers ?? DEFAULTS.laborCostNoDrawers,
        laborCostWithDrawers: raw.labor_cost_with_drawers ?? DEFAULTS.laborCostWithDrawers,
        laborCostAccessories: raw.labor_cost_accessories ?? DEFAULTS.laborCostAccessories,
        wastePercentageBox: raw.waste_percentage_box ?? DEFAULTS.wastePercentageBox,
        wastePercentageDoors: raw.waste_percentage_doors ?? DEFAULTS.wastePercentageDoors,
        exchangeRateUsdToMxn: raw.exchange_rate_usd_to_mxn ?? DEFAULTS.exchangeRateUsdToMxn,
      };
      lastFetch = Date.now();
      return cached;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function clearSettingsCache(): void {
  cached = null;
  lastFetch = 0;
}
