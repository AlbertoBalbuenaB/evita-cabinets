import { supabase } from './supabase';

export interface SettingsCache {
  laborCostNoDrawers: number;
  laborCostWithDrawers: number;
  laborCostAccessories: number;
  wastePercentageBox: number;
  wastePercentageDoors: number;
  exchangeRateUsdToMxn: number;
}

let settingsCache: SettingsCache | null = null;
let lastFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export async function getSettings(): Promise<SettingsCache> {
  const now = Date.now();

  if (settingsCache && (now - lastFetch) < CACHE_DURATION) {
    return settingsCache;
  }

  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value');

    if (error) throw error;

    const settings = data?.reduce((acc, item) => {
      acc[item.key] = parseFloat(item.value);
      return acc;
    }, {} as Record<string, number>) || {};

    settingsCache = {
      laborCostNoDrawers: settings.labor_cost_no_drawers || 400,
      laborCostWithDrawers: settings.labor_cost_with_drawers || 600,
      laborCostAccessories: settings.labor_cost_accessories || 100,
      wastePercentageBox: settings.waste_percentage_box || 10,
      wastePercentageDoors: settings.waste_percentage_doors || 10,
      exchangeRateUsdToMxn: settings.exchange_rate_usd_to_mxn || 18,
    };

    lastFetch = now;
    return settingsCache;
  } catch (error) {
    console.error('Error loading settings:', error);

    return {
      laborCostNoDrawers: 400,
      laborCostWithDrawers: 600,
      laborCostAccessories: 100,
      wastePercentageBox: 10,
      wastePercentageDoors: 10,
      exchangeRateUsdToMxn: 18,
    };
  }
}

export function clearSettingsCache() {
  settingsCache = null;
  lastFetch = 0;
}
