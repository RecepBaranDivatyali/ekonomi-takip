export interface ExchangeRates {
  USD: number;
  EUR: number;
  Altın: number; // gram-altin
  Gümüş: number; // gumus
}

export const DEFAULT_RATES: ExchangeRates = {
  USD: 45.0,
  EUR: 49.0,
  Altın: 3100.0,
  Gümüş: 38.0,
};

// Helper function to parse Turkish number strings (e.g. "6.204,69" or "46,4792") into floats
export function parseTurkishNumber(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const str = val.toString().trim();
  if (!str) return 0;
  
  // Remove thousands separators (.) and replace decimal separator (,) with (.)
  const cleaned = str.replace(/\./g, '').replace(/,/g, '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Extract selling price (Satış) safely handling different possible property names
function getSellingRate(obj: any): number {
  if (!obj || typeof obj !== 'object') return 0;
  const val = obj['Satış'] || obj['Satis'] || obj['Satıs'] || obj['satis'] || obj['selling'] || '';
  return parseTurkishNumber(val);
}

export async function fetchExchangeRates(): Promise<ExchangeRates> {
  const response = await fetch('https://finans.truncgil.com/today.json');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  
  const rates: ExchangeRates = { ...DEFAULT_RATES };

  if (data.USD) {
    const usdRate = getSellingRate(data.USD);
    if (usdRate > 0) rates.USD = usdRate;
  }
  
  if (data.EUR) {
    const eurRate = getSellingRate(data.EUR);
    if (eurRate > 0) rates.EUR = eurRate;
  }
  
  // Altın için 'gram-altin' veya 'gram-has-altin' kontrolü
  if (data['gram-altin']) {
    const goldRate = getSellingRate(data['gram-altin']);
    if (goldRate > 0) rates.Altın = goldRate;
  } else if (data['gram-has-altin']) {
    const goldRate = getSellingRate(data['gram-has-altin']);
    if (goldRate > 0) rates.Altın = goldRate;
  }
  
  // Gümüş için 'gumus' kontrolü
  if (data.gumus) {
    const silverRate = getSellingRate(data.gumus);
    if (silverRate > 0) rates.Gümüş = silverRate;
  }

  console.log('Successfully fetched live rates:', rates);
  return rates;
}
