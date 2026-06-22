export interface ExchangeRates {
  USD: number;
  EUR: number;
  Altın: number; // gram-altin
  Gümüş: number; // gumus
  USDChange: number;
  EURChange: number;
  AltınChange: number;
  GümüşChange: number;
}

export const DEFAULT_RATES: ExchangeRates = {
  USD: 46.47,
  EUR: 53.22,
  Altın: 6266.0,
  Gümüş: 99.2,
  USDChange: 0,
  EURChange: 0,
  AltınChange: 0,
  GümüşChange: 0,
};

// Helper function to parse Turkish number strings (e.g. "6.204,69" or "46,4792") into floats
export function parseTurkishNumber(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  // Strip currency prefix like "$" before parsing
  const str = val.toString().trim().replace(/^\$/, '');
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

// Parse change percentage string like "%0,94" or "%-0,16" into a number
function parseChangePercent(obj: any): number {
  if (!obj || typeof obj !== 'object') return 0;
  const raw = obj['Değişim'] || obj['Degisim'] || '';
  if (!raw) return 0;
  // Remove % prefix and any leading/trailing spaces
  const cleaned = raw.toString().replace('%', '').trim().replace(',', '.');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
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
    if (usdRate > 0) {
      rates.USD = usdRate;
      rates.USDChange = parseChangePercent(data.USD);
    }
  }
  
  if (data.EUR) {
    const eurRate = getSellingRate(data.EUR);
    if (eurRate > 0) {
      rates.EUR = eurRate;
      rates.EURChange = parseChangePercent(data.EUR);
    }
  }
  
  // Altın için 'gram-altin' veya 'gram-has-altin' kontrolü
  if (data['gram-altin']) {
    const goldRate = getSellingRate(data['gram-altin']);
    if (goldRate > 0) {
      rates.Altın = goldRate;
      rates.AltınChange = parseChangePercent(data['gram-altin']);
    }
  } else if (data['gram-has-altin']) {
    const goldRate = getSellingRate(data['gram-has-altin']);
    if (goldRate > 0) {
      rates.Altın = goldRate;
      rates.AltınChange = parseChangePercent(data['gram-has-altin']);
    }
  }
  
  // Gümüş için 'gumus' kontrolü
  if (data.gumus) {
    const silverRate = getSellingRate(data.gumus);
    if (silverRate > 0) {
      rates.Gümüş = silverRate;
      rates.GümüşChange = parseChangePercent(data.gumus);
    }
  }

  console.log('Successfully fetched live rates:', rates);
  return rates;
}

export interface StockQuote {
  price: number;
  change: number;
}

export async function fetchLiveStockPrices(): Promise<{ [key: string]: StockQuote }> {
  const response = await fetch('https://doviz-api.onrender.com/api/borsaAll');
  if (!response.ok) {
    throw new Error(`Borsa API HTTP error! status: ${response.status}`);
  }
  const result = await response.json();
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error('Invalid Borsa API response structure');
  }

  const prices: { [key: string]: StockQuote } = {};
  result.data.forEach((item: any) => {
    if (item.name) {
      const priceVal = parseTurkishNumber(item.price);
      const changeVal = parseTurkishNumber(item.change);
      prices[item.name.toUpperCase()] = {
        price: priceVal,
        change: changeVal
      };
    }
  });

  return prices;
}
