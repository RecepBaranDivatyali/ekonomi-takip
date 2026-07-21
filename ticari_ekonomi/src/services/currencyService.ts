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

function getSellingRate(obj: any): number {
  if (!obj || typeof obj !== 'object') return 0;
  const val = obj['Satış'] || obj['Satis'] || obj['Satıs'] || obj['satis'] || obj['selling'] || '';
  return parseTurkishNumber(val);
}

function getBuyingRate(obj: any): number {
  if (!obj || typeof obj !== 'object') return 0;
  const val = obj['Alış'] || obj['Alis'] || obj['Alish'] || obj['buying'] || '';
  return parseTurkishNumber(val);
}

function parseChangePercent(obj: any): number {
  if (!obj || typeof obj !== 'object') return 0;
  const raw = obj['Değişim'] || obj['Degisim'] || '';
  if (!raw) return 0;
  const cleaned = raw.toString().replace('%', '').trim().replace(',', '.');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

// ─── CurrencyRate (DovizMaden tab) ────────────────────────────────────────
export interface CurrencyRate {
  key: string;
  label: string;
  flag: string;
  category: 'doviz' | 'maden';
  walletType?: 'Dolar' | 'Euro' | 'Altın' | 'Gümüş';
  sell: number;
  buy: number;
  change: number;
}

const CURRENCY_CONFIG: Array<{
  apiKey: string;
  label: string;
  flag: string;
  category: 'doviz' | 'maden';
  walletType?: 'Dolar' | 'Euro' | 'Altın' | 'Gümüş';
}> = [
  // Dövizler
  { apiKey: 'USD',               label: 'ABD Doları',         flag: '🇺🇸', category: 'doviz', walletType: 'Dolar' },
  { apiKey: 'EUR',               label: 'Euro',               flag: '🇪🇺', category: 'doviz', walletType: 'Euro'  },
  { apiKey: 'GBP',               label: 'İngiliz Sterlini',   flag: '🇬🇧', category: 'doviz' },
  { apiKey: 'CHF',               label: 'İsviçre Frangı',     flag: '🇨🇭', category: 'doviz' },
  { apiKey: 'CAD',               label: 'Kanada Doları',      flag: '🇨🇦', category: 'doviz' },
  { apiKey: 'AUD',               label: 'Avustralya Doları',  flag: '🇦🇺', category: 'doviz' },
  { apiKey: 'JPY',               label: 'Japon Yeni',         flag: '🇯🇵', category: 'doviz' },
  { apiKey: 'RUB',               label: 'Rus Rublesi',        flag: '🇷🇺', category: 'doviz' },
  { apiKey: 'SAR',               label: 'Suudi Riyali',       flag: '🇸🇦', category: 'doviz' },
  { apiKey: 'AED',               label: 'BAE Dirhemi',        flag: '🇦🇪', category: 'doviz' },
  { apiKey: 'KWD',               label: 'Kuveyt Dinarı',      flag: '🇰🇼', category: 'doviz' },
  { apiKey: 'CNY',               label: 'Çin Yuanı',          flag: '🇨🇳', category: 'doviz' },
  { apiKey: 'NOK',               label: 'Norveç Kronu',       flag: '🇳🇴', category: 'doviz' },
  { apiKey: 'SEK',               label: 'İsveç Kronu',        flag: '🇸🇪', category: 'doviz' },
  { apiKey: 'DKK',               label: 'Danimarka Kronu',    flag: '🇩🇰', category: 'doviz' },
  { apiKey: 'BHD',               label: 'Bahreyn Dinarı',     flag: '🇧🇭', category: 'doviz' },
  { apiKey: 'ILS',               label: 'İsrail Şekeli',      flag: '🇮🇱', category: 'doviz' },
  { apiKey: 'INR',               label: 'Hindistan Rupisi',   flag: '🇮🇳', category: 'doviz' },
  // Madenler
  { apiKey: 'gram-altin',        label: 'Gram Altın',         flag: '🟡', category: 'maden', walletType: 'Altın'  },
  { apiKey: 'ceyrek-altin',      label: 'Çeyrek Altın',       flag: '🪙', category: 'maden' },
  { apiKey: 'yarim-altin',       label: 'Yarım Altın',        flag: '🪙', category: 'maden' },
  { apiKey: 'tam-altin',         label: 'Tam Altın',          flag: '🪙', category: 'maden' },
  { apiKey: 'cumhuriyet-altini', label: 'Cumhuriyet Altını',  flag: '🏅', category: 'maden' },
  { apiKey: 'gumus',             label: 'Gram Gümüş',         flag: '⬜', category: 'maden', walletType: 'Gümüş' },
  { apiKey: 'gram-platin',       label: 'Gram Platin',        flag: '⚪', category: 'maden' },
  { apiKey: 'gram-paladyum',     label: 'Gram Paladyum',      flag: '🔘', category: 'maden' },
];

// Single fetch – returns ExchangeRates (for wallet calcs) + full CurrencyRate list (for DovizMaden tab)
export async function fetchAllRatesData(): Promise<{ rates: ExchangeRates; currencyRates: CurrencyRate[] }> {
  const response = await fetch('https://finans.truncgil.com/today.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data = await response.json();

  const rates: ExchangeRates = { ...DEFAULT_RATES };

  if (data.USD)             { const v = getSellingRate(data.USD);              if (v > 0) { rates.USD    = v; rates.USDChange    = parseChangePercent(data.USD); } }
  if (data.EUR)             { const v = getSellingRate(data.EUR);              if (v > 0) { rates.EUR    = v; rates.EURChange    = parseChangePercent(data.EUR); } }
  if (data['gram-altin'])   { const v = getSellingRate(data['gram-altin']);    if (v > 0) { rates.Altın  = v; rates.AltınChange  = parseChangePercent(data['gram-altin']); } }
  else if (data['gram-has-altin']) { const v = getSellingRate(data['gram-has-altin']); if (v > 0) { rates.Altın = v; rates.AltınChange = parseChangePercent(data['gram-has-altin']); } }
  if (data.gumus)           { const v = getSellingRate(data.gumus);            if (v > 0) { rates.Gümüş  = v; rates.GümüşChange  = parseChangePercent(data.gumus); } }

  const currencyRates: CurrencyRate[] = CURRENCY_CONFIG.map(cfg => {
    const item = data[cfg.apiKey];
    return {
      key:        cfg.apiKey,
      label:      cfg.label,
      flag:       cfg.flag,
      category:   cfg.category,
      walletType: cfg.walletType,
      sell:   item ? getSellingRate(item)      : 0,
      buy:    item ? getBuyingRate(item)       : 0,
      change: item ? parseChangePercent(item)  : 0,
    };
  });

  return { rates, currencyRates };
}

// Keep for backward compat
export async function fetchExchangeRates(): Promise<ExchangeRates> {
  const { rates } = await fetchAllRatesData();
  return rates;
}

export interface StockQuote {
  price: number;
  change: number;
}

export async function fetchLiveStockPrices(): Promise<{ [key: string]: StockQuote }> {
  const response = await fetch('https://doviz-api.onrender.com/api/borsaAll', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Borsa API HTTP error! status: ${response.status}`);
  const result = await response.json();
  if (!result.success || !Array.isArray(result.data)) throw new Error('Invalid Borsa API response structure');

  const prices: { [key: string]: StockQuote } = {};
  result.data.forEach((item: any) => {
    if (item.name) {
      prices[item.name.toUpperCase()] = {
        price:  parseTurkishNumber(item.price),
        change: parseTurkishNumber(item.change),
      };
    }
  });

  // Alias indices for easier user recognition
  if (prices['XU100']) {
    prices['BIST100'] = prices['XU100'];
  }
  if (prices['XU030']) {
    prices['BIST30'] = prices['XU030'];
  }

  return prices;
}

export interface WalletAssetBalances {
  usd: number;
  eur: number;
  gold: number;
  silver: number;
  totalTL: number;
  displayValue: string;
}

export function calculateWalletAssetBalances(
  wallet: { id: string; type: string; balance: number },
  transactions: { wallet_id: string; amount: number; description: string }[],
  rates: { USD: number; EUR: number; Altın: number; Gümüş: number }
): WalletAssetBalances {
  const wTxs = transactions.filter(tx => tx.wallet_id === wallet.id);
  
  let usd = 0;
  let eur = 0;
  let gold = 0;
  let silver = 0;
  
  let hasUsdTx = false;
  let hasEurTx = false;
  let hasGoldTx = false;
  let hasSilverTx = false;

  wTxs.forEach(tx => {
    const desc = (tx.description || '').toLowerCase();
    const isSell = desc.includes('satış') || desc.includes('satis') || desc.includes('satisi') || desc.includes('çıkış') || desc.includes('cikis');
    const multiplier = isSell ? -1 : 1;
    const absAmount = Math.abs(tx.amount);
    
    if (desc.includes('alımı için çıkış') || desc.includes('alimi icin cikis')) {
      return;
    }

    if (desc.includes('dolar') || desc.includes('usd') || desc.includes('$')) {
      usd += absAmount * multiplier;
      hasUsdTx = true;
    } else if (desc.includes('euro') || desc.includes('eur') || desc.includes('€')) {
      eur += absAmount * multiplier;
      hasEurTx = true;
    } else if (desc.includes('altın') || desc.includes('altin') || desc.includes('gold')) {
      gold += absAmount * multiplier;
      hasGoldTx = true;
    } else if (desc.includes('gümüş') || desc.includes('gumus') || desc.includes('silver')) {
      silver += absAmount * multiplier;
      hasSilverTx = true;
    } else {
      if (wallet.type === 'Dolar') {
        usd += absAmount * multiplier;
        hasUsdTx = true;
      } else if (wallet.type === 'Euro') {
        eur += absAmount * multiplier;
        hasEurTx = true;
      } else if (wallet.type === 'Altın') {
        gold += absAmount * multiplier;
        hasGoldTx = true;
      } else if (wallet.type === 'Gümüş') {
        silver += absAmount * multiplier;
        hasSilverTx = true;
      }
    }
  });

  if (wTxs.length === 0) {
    if (wallet.type === 'Dolar') usd = wallet.balance;
    else if (wallet.type === 'Euro') eur = wallet.balance;
    else if (wallet.type === 'Altın') gold = wallet.balance;
    else if (wallet.type === 'Gümüş') silver = wallet.balance;
  }

  let totalTL = 0;
  if (['Dolar', 'Euro', 'Döviz'].includes(wallet.type)) {
    totalTL = (usd * rates.USD) + (eur * rates.EUR);
  } else if (['Altın', 'Gümüş', 'Maden'].includes(wallet.type)) {
    totalTL = (gold * rates.Altın) + (silver * rates.Gümüş);
  }

  const displayParts: string[] = [];
  if (['Dolar', 'Euro', 'Döviz'].includes(wallet.type)) {
    if (eur > 0 || (!hasUsdTx && !hasEurTx && wallet.type === 'Euro')) {
      displayParts.push(`${eur.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
    }
    if (usd > 0 || (!hasUsdTx && !hasEurTx && wallet.type === 'Dolar') || displayParts.length === 0) {
      displayParts.push(`${usd.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`);
    }
  } else if (['Altın', 'Gümüş', 'Maden'].includes(wallet.type)) {
    if (gold > 0 || (!hasGoldTx && !hasSilverTx && wallet.type === 'Altın')) {
      displayParts.push(`${gold.toFixed(4)} gr Altın`);
    }
    if (silver > 0 || (!hasGoldTx && !hasSilverTx && wallet.type === 'Gümüş') || displayParts.length === 0) {
      displayParts.push(`${silver.toFixed(4)} gr Gümüş`);
    }
  }

  return {
    usd,
    eur,
    gold,
    silver,
    totalTL,
    displayValue: displayParts.join(' + ')
  };
}

