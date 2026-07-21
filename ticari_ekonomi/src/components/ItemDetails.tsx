import React, { useMemo, useState, useEffect } from 'react';
import { type ExchangeRates, calculateWalletAssetBalances } from '../services/currencyService';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  CartesianGrid
} from 'recharts';
import { FiArrowLeft, FiClock } from 'react-icons/fi';


interface Wallet {
  id: string;
  name: string;
  type: 'Vadesiz' | 'Vadeli' | 'Dolar' | 'Euro' | 'Altın' | 'Gümüş' | 'Borsa_TRY' | 'Borsa_USD' | 'Kredi_Karti';
  color: string;
  balance: number;
  credit_limit?: number;
  due_date?: number;
  cash_balance?: number;
  created_at?: string;
}

interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  type: 'Gelir' | 'Gider';
}

interface Tag {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface Transaction {
  id: string;
  wallet_id: string;
  category_id: string;
  tag_id?: string | null;
  amount: number;
  description: string;
  date: string;
  time_range: string;
}

const getWalletEmoji = (type: string) => {
  switch (type) {
    case 'Vadesiz':
    case 'Vadeli':
      return '🏦';
    case 'Dolar':
      return '💵';
    case 'Euro':
      return '💶';
    case 'Altın':
      return '🟡';
    case 'Gümüş':
      return '⚪';
    case 'Borsa_TRY':
    case 'Borsa_USD':
      return '📈';
    case 'Kredi_Karti':
      return '💳';
    default:
      return '💼';
  }
};

// Global dynamic category resolver helper (matches Dashboard/Transactions fallback)
const resolveTxCategory = (tx: Transaction, categories: Category[], wallets: Wallet[]) => {
  const cat = categories.find(c => c.id === tx.category_id);
  const isOther = cat && (cat.name === 'Diğer' || cat.id === 'diger-fallback');

  if (cat && !isOther) return cat;

  const w = wallets.find(wl => wl.id === tx.wallet_id);
  const desc = (tx.description || '').toLowerCase();

  if ((w && (w.type === 'Borsa_TRY' || w.type === 'Borsa_USD')) || desc.includes('hisse') || desc.includes('borsa')) {
    const isSell = desc.includes('satış') || desc.includes('satisi') || desc.includes('satışı') || desc.includes('temettü') || desc.includes('gelir') || desc.includes('giriş');
    return {
      id: 'borsa-fallback',
      name: 'Borsa / Yatırım',
      emoji: '📈',
      color: '#84CC16',
      type: isSell ? 'Gelir' : 'Gider' as const
    };
  }

  if ((w && ['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(w.type)) || desc.includes('döviz') || desc.includes('altın') || desc.includes('gümüş') || desc.includes('kur ')) {
    return {
      id: 'doviz-fallback',
      name: 'Döviz / Maden',
      emoji: '💱',
      color: '#3B82F6',
      type: tx.amount < 0 ? 'Gider' : 'Gelir' as const
    };
  }

  if (cat) return cat;

  return {
    id: 'diger-fallback',
    name: 'Diğer',
    emoji: '🪙',
    color: '#64748B',
    type: tx.amount < 0 ? 'Gider' : 'Gelir' as const
  };
};

const formatCurrency = (val: number, type: Wallet['type'] = 'Vadesiz') => {
  if (type === 'Dolar' || type === 'Borsa_USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  }
  if (type === 'Euro') {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  }
  if (type === 'Altın' || type === 'Gümüş') {
    return `${Number(val).toFixed(2)} gr`;
  }
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

interface DividendPayment {
  symbol: string;
  date: string; // YYYY-MM-DD
  amount: number; // Dividend per share
}

const BIST_DIVIDENDS: DividendPayment[] = [
  // 2024
  { symbol: 'TUPRS', date: '2024-04-03', amount: 9.34 },
  { symbol: 'TUPRS', date: '2024-09-27', amount: 10.74 },
  { symbol: 'EREGL', date: '2024-09-12', amount: 0.45 },
  { symbol: 'FROTO', date: '2024-04-08', amount: 39.30 },
  { symbol: 'FROTO', date: '2024-11-22', amount: 26.78 },
  { symbol: 'TOASO', date: '2024-04-04', amount: 18.00 },
  { symbol: 'KCHOL', date: '2024-04-24', amount: 7.20 },
  { symbol: 'SAHOL', date: '2024-05-02', amount: 2.73 },
  { symbol: 'TCELL', date: '2024-12-05', amount: 2.57 },
  { symbol: 'AKBNK', date: '2024-04-02', amount: 2.50 },
  { symbol: 'ISCTR', date: '2024-04-01', amount: 0.59 },
  { symbol: 'YKBNK', date: '2024-04-03', amount: 1.09 },
  { symbol: 'BIMAS', date: '2024-07-17', amount: 3.60 },
  { symbol: 'BIMAS', date: '2024-10-02', amount: 3.60 },
  { symbol: 'BIMAS', date: '2024-12-18', amount: 3.60 },
  { symbol: 'SISE', date: '2024-05-31', amount: 0.72 },
  { symbol: 'ASELS', date: '2024-10-16', amount: 0.11 },

  // 2025
  { symbol: 'TUPRS', date: '2025-04-08', amount: 12.50 },
  { symbol: 'EREGL', date: '2025-05-20', amount: 0.80 },
  { symbol: 'FROTO', date: '2025-04-10', amount: 45.00 },
  { symbol: 'TOASO', date: '2025-04-09', amount: 22.00 },
  { symbol: 'KCHOL', date: '2025-04-22', amount: 9.00 },
  { symbol: 'SAHOL', date: '2025-05-06', amount: 3.50 },
  { symbol: 'TCELL', date: '2025-06-18', amount: 3.10 },
  { symbol: 'AKBNK', date: '2025-04-04', amount: 3.20 },
  { symbol: 'ISCTR', date: '2025-04-03', amount: 0.75 },
  { symbol: 'YKBNK', date: '2025-04-08', amount: 1.40 },
  { symbol: 'BIMAS', date: '2025-07-16', amount: 4.20 },
  { symbol: 'BIMAS', date: '2025-10-01', amount: 4.20 },
  { symbol: 'BIMAS', date: '2025-12-17', amount: 4.20 },
  { symbol: 'SISE', date: '2025-05-28', amount: 0.85 },
  { symbol: 'ASELS', date: '2025-10-15', amount: 0.15 },

  // 2026
  { symbol: 'TUPRS', date: '2026-04-07', amount: 15.00 },
  { symbol: 'EREGL', date: '2026-05-19', amount: 1.10 },
  { symbol: 'FROTO', date: '2026-04-09', amount: 52.00 },
  { symbol: 'TOASO', date: '2026-04-08', amount: 25.00 },
  { symbol: 'KCHOL', date: '2026-04-21', amount: 11.00 },
  { symbol: 'SAHOL', date: '2026-05-05', amount: 4.50 },
  { symbol: 'TCELL', date: '2026-06-17', amount: 3.80 },
  { symbol: 'AKBNK', date: '2026-04-03', amount: 4.00 },
  { symbol: 'ISCTR', date: '2026-04-02', amount: 0.95 },
  { symbol: 'YKBNK', date: '2026-04-07', amount: 1.80 },
  { symbol: 'BIMAS', date: '2026-07-15', amount: 5.00 },
  { symbol: 'BIMAS', date: '2026-10-07', amount: 5.00 },
  { symbol: 'SISE', date: '2026-05-27', amount: 1.00 },
  { symbol: 'ASELS', date: '2026-10-14', amount: 0.20 },
];

const GLOBAL_DIVIDENDS: DividendPayment[] = [
  // AAPL (Quarterly)
  { symbol: 'AAPL', date: '2024-02-09', amount: 0.24 },
  { symbol: 'AAPL', date: '2024-05-10', amount: 0.25 },
  { symbol: 'AAPL', date: '2024-08-09', amount: 0.25 },
  { symbol: 'AAPL', date: '2024-11-08', amount: 0.25 },
  { symbol: 'AAPL', date: '2025-02-07', amount: 0.25 },
  { symbol: 'AAPL', date: '2025-05-09', amount: 0.26 },
  { symbol: 'AAPL', date: '2025-08-08', amount: 0.26 },
  { symbol: 'AAPL', date: '2025-11-07', amount: 0.26 },
  { symbol: 'AAPL', date: '2026-02-06', amount: 0.26 },
  { symbol: 'AAPL', date: '2026-05-08', amount: 0.28 },

  // MSFT (Quarterly)
  { symbol: 'MSFT', date: '2024-03-14', amount: 0.75 },
  { symbol: 'MSFT', date: '2024-06-13', amount: 0.75 },
  { symbol: 'MSFT', date: '2024-09-12', amount: 0.75 },
  { symbol: 'MSFT', date: '2024-12-12', amount: 0.80 },
  { symbol: 'MSFT', date: '2025-03-13', amount: 0.80 },
  { symbol: 'MSFT', date: '2025-06-12', amount: 0.80 },
  { symbol: 'MSFT', date: '2025-09-11', amount: 0.80 },
  { symbol: 'MSFT', date: '2025-12-11', amount: 0.85 },
  { symbol: 'MSFT', date: '2026-03-12', amount: 0.85 },
  { symbol: 'MSFT', date: '2026-06-11', amount: 0.85 },

  // NVDA (Quarterly)
  { symbol: 'NVDA', date: '2024-03-27', amount: 0.04 },
  { symbol: 'NVDA', date: '2024-06-28', amount: 0.01 }, // post-split
  { symbol: 'NVDA', date: '2024-09-27', amount: 0.01 },
  { symbol: 'NVDA', date: '2024-12-27', amount: 0.01 },
  { symbol: 'NVDA', date: '2025-03-27', amount: 0.01 },
  { symbol: 'NVDA', date: '2025-06-27', amount: 0.01 },
  { symbol: 'NVDA', date: '2025-09-26', amount: 0.01 },
  { symbol: 'NVDA', date: '2025-12-24', amount: 0.01 },
  { symbol: 'NVDA', date: '2026-03-27', amount: 0.01 },
  { symbol: 'NVDA', date: '2026-06-26', amount: 0.01 },
];

const getStockColor = (symbol: string): string => {
  const sym = symbol.toUpperCase().trim();
  const brandColors: { [key: string]: string } = {
    // Turkish Stocks (BIST)
    'THY': '#E30A17',
    'THYAO': '#E30A17',
    'AKBNK': '#E30613',
    'EREGL': '#1565C0',
    'TUPRS': '#0057B8',
    'FROTO': '#003399',
    'TOASO': '#A70C2A',
    'KCHOL': '#D32F2F',
    'SAHOL': '#005CA9',
    'TCELL': '#FFC72C',
    'ISCTR': '#003A70',
    'YKBNK': '#002D62',
    'BIMAS': '#005A9C',
    'SISE': '#007A87',
    'ASELS': '#002B49',
    'ISMEN': '#003366',
    'PETKM': '#007A87',
    'SASA': '#E30613',
    'HEKTS': '#00A3A6',
    'GUBRF': '#059669',
    'PGSUS': '#FFC72C',
    'ARCLK': '#E30613',
    'VESTL': '#DC2626',

    // Global Stocks
    'AAPL': '#8E8E93',
    'MSFT': '#00A4EF',
    'NVDA': '#76B900',
    'GOOG': '#4285F4',
    'GOOGL': '#4285F4',
    'AMZN': '#FF9900',
    'TSLA': '#CC0000',
    'META': '#0081FB',
    'NFLX': '#E50914',
    'AMD': '#ED1C24',
    'INTC': '#0071C5',
    'COIN': '#0052FF',
  };

  if (brandColors[sym]) {
    return brandColors[sym];
  }

  // Generate HSL color based on string hash
  let hash = 0;
  for (let i = 0; i < sym.length; i++) {
    hash = sym.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  const s = 65 + (Math.abs(hash >> 3) % 20); // 65% - 85%
  const l = 45 + (Math.abs(hash >> 6) % 15); // 45% - 60%
  return `hsl(${h}, ${s}%, ${l}%)`;
};

// ==================== WALLET DETAILS ====================
interface WalletDetailsProps {
  walletId: string;
  wallets: Wallet[];
  transactions: Transaction[];
  categories: Category[];
  tags: Tag[];
  onBack: () => void;
  rates: ExchangeRates;
  stockPrices: { [key: string]: { price: number; change: number } };
  userStocks: { id: string; user_id: string; wallet_id: string; symbol: string; shares_count: number; average_cost: number }[];
}

export const WalletDetails: React.FC<WalletDetailsProps> = ({
  walletId,
  wallets,
  transactions,
  categories,
  tags,
  onBack,
  rates,
  stockPrices,
  userStocks,
}) => {
  const wallet = wallets.find((w) => w.id === walletId);
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const walletType = wallet?.type;
  const walletCreatedAt = wallet?.created_at;
  const walletBalance = wallet?.balance ?? 0;
  const walletCashBalance = wallet?.cash_balance;
  const walletIdVal = wallet?.id;

  const walletAssetBalances = useMemo(() => {
    if (!wallet || !['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(wallet.type)) return null;
    return calculateWalletAssetBalances(wallet, transactions, rates);
  }, [wallet, transactions, rates]);

  const dovizMadenDetails = useMemo(() => {
    if (!wallet || !['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(wallet.type) || !walletAssetBalances) {
      return { totalInvested: 0, profitLoss: 0, hasCostData: false };
    }

    const wTxs = transactions.filter(tx => tx.wallet_id === wallet.id);

    const getAssetCostDetails = (assetMatchStr: string, liveAssetRate: number, currentAssetBalance: number) => {
      let totalAmountBought = 0;
      let totalCostSpent = 0;

      wTxs.forEach(tx => {
        const desc = (tx.description || '').toLowerCase();
        if (desc.includes('alış (kur:') || desc.includes('alis (kur:')) {
          const hasAssetMatch = desc.includes(assetMatchStr);
          const matchesLegacyType = !desc.includes('dolar') && !desc.includes('euro') && !desc.includes('altın') && !desc.includes('gümüş') &&
            ((assetMatchStr === 'dolar' && wallet.type === 'Dolar') ||
             (assetMatchStr === 'euro' && wallet.type === 'Euro') ||
             (assetMatchStr === 'altın' && wallet.type === 'Altın') ||
             (assetMatchStr === 'gümüş' && wallet.type === 'Gümüş'));

          if (hasAssetMatch || matchesLegacyType) {
            const match = tx.description.match(/Kur:\s*([\d.]+)/);
            if (match && match[1]) {
              const parsedRate = parseFloat(match[1]);
              const boughtAmount = tx.amount;
              if (boughtAmount > 0 && parsedRate > 0) {
                totalAmountBought += boughtAmount;
                totalCostSpent += (boughtAmount * parsedRate);
              }
            }
          }
        }
      });

      const hasCostData = totalAmountBought > 0;
      const averageCost = hasCostData ? (totalCostSpent / totalAmountBought) : 0;
      const profitLoss = hasCostData ? (liveAssetRate - averageCost) * currentAssetBalance : 0;
      const invested = hasCostData ? averageCost * currentAssetBalance : liveAssetRate * currentAssetBalance;

      return { averageCost, profitLoss, invested, hasCostData };
    };

    let profitLoss = 0;
    let totalInvested = 0;
    let hasCostData = false;

    if (['Dolar', 'Euro'].includes(wallet.type)) {
      const usdDetails = getAssetCostDetails('dolar', rates.USD, walletAssetBalances.usd);
      const eurDetails = getAssetCostDetails('euro', rates.EUR, walletAssetBalances.eur);

      hasCostData = usdDetails.hasCostData || eurDetails.hasCostData;
      totalInvested = usdDetails.invested + eurDetails.invested;
      profitLoss = usdDetails.profitLoss + eurDetails.profitLoss;
    } else if (['Altın', 'Gümüş'].includes(wallet.type)) {
      const goldDetails = getAssetCostDetails('altın', rates.Altın, walletAssetBalances.gold);
      const silverDetails = getAssetCostDetails('gümüş', rates.Gümüş, walletAssetBalances.silver);

      hasCostData = goldDetails.hasCostData || silverDetails.hasCostData;
      totalInvested = goldDetails.invested + silverDetails.invested;
      profitLoss = goldDetails.profitLoss + silverDetails.profitLoss;
    }

    return { totalInvested, profitLoss, hasCostData };
  }, [wallet, walletAssetBalances, transactions, rates]);

  const totalCostBasis = useMemo(() => {
    if (walletType === 'Borsa_TRY' || walletType === 'Borsa_USD') {
      return Number(walletCashBalance ?? walletBalance) + userStocks
        .filter(s => s.wallet_id === walletIdVal)
        .reduce((sum, s) => sum + Number(s.shares_count) * Number(s.average_cost), 0);
    }
    if (['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(walletType || '')) {
      return dovizMadenDetails.totalInvested;
    }
    return 0;
  }, [walletType, walletCashBalance, walletBalance, userStocks, walletIdVal, dovizMadenDetails]);

  const assetAllocationData = useMemo(() => {
    if (!walletAssetBalances || !wallet) return [];
    const data = [];
    if (['Dolar', 'Euro'].includes(wallet.type)) {
      if (walletAssetBalances.eur > 0) {
        data.push({
          name: 'Euro',
          value: walletAssetBalances.eur * rates.EUR,
          originalAmount: walletAssetBalances.eur,
          symbol: '€',
          color: '#8b5cf6'
        });
      }
      if (walletAssetBalances.usd > 0) {
        data.push({
          name: 'Amerikan Doları',
          value: walletAssetBalances.usd * rates.USD,
          originalAmount: walletAssetBalances.usd,
          symbol: '$',
          color: '#3b82f6'
        });
      }
    } else if (['Altın', 'Gümüş'].includes(wallet.type)) {
      if (walletAssetBalances.gold > 0) {
        data.push({
          name: 'Gram Altın',
          value: walletAssetBalances.gold * rates.Altın,
          originalAmount: walletAssetBalances.gold,
          symbol: 'gr Altın',
          color: '#eab308'
        });
      }
      if (walletAssetBalances.silver > 0) {
        data.push({
          name: 'Gram Gümüş',
          value: walletAssetBalances.silver * rates.Gümüş,
          originalAmount: walletAssetBalances.silver,
          symbol: 'gr Gümüş',
          color: '#94a3b8'
        });
      }
    }
    return data.sort((a, b) => b.value - a.value);
  }, [walletAssetBalances, wallet, rates]);

  // State for historical rates of foreign currency and metal wallets
  const [histRates, setHistRates] = useState<{
    thirtyDaysAgo: { USD: number; EUR: number; Altın: number; Gümüş: number } | null;
    creation: { USD: number; EUR: number; Altın: number; Gümüş: number } | null;
    loading: boolean;
  }>({
    thirtyDaysAgo: null,
    creation: null,
    loading: false,
  });

  // Helper function to fetch historical rates for a specific date from Frankfurter API
  const fetchRatesForDate = async (dateStr: string, currentRates: ExchangeRates) => {
    try {
      const res = await fetch(`https://api.frankfurter.dev/v1/${dateStr}?base=USD&symbols=TRY,EUR`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.rates || !data.rates.TRY || !data.rates.EUR) return null;

      const usdRate = data.rates.TRY;
      const eurRate = data.rates.TRY / data.rates.EUR;
      
      // Estimate Gold and Silver proportionally to USD change
      const goldRate = currentRates.Altın * (usdRate / currentRates.USD);
      const silverRate = currentRates.Gümüş * (usdRate / currentRates.USD);

      return {
        USD: usdRate,
        EUR: eurRate,
        Altın: goldRate,
        Gümüş: silverRate,
      };
    } catch (err) {
      console.error('Failed to fetch historical rates for', dateStr, err);
      return null;
    }
  };

  // Fetch rates on mount / wallet change
  useEffect(() => {
    if (!walletType) return;
    const isCurrencyOrMetal = ['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(walletType);
    if (!isCurrencyOrMetal) return;

    let active = true;

    const loadRates = async () => {
      setHistRates(prev => ({ ...prev, loading: true }));

      const today = new Date();
      
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString('sv-SE');

      let createdAtStr = '';
      if (walletCreatedAt) {
        createdAtStr = new Date(walletCreatedAt).toLocaleDateString('sv-SE');
      }

      // Fetch 30 days ago
      let rates30 = null;
      if (thirtyDaysAgoStr) {
        rates30 = await fetchRatesForDate(thirtyDaysAgoStr, rates);
      }

      // Fetch creation date
      let ratesCreation = null;
      if (createdAtStr) {
        if (createdAtStr === new Date().toLocaleDateString('sv-SE')) {
          ratesCreation = {
            USD: rates.USD,
            EUR: rates.EUR,
            Altın: rates.Altın,
            Gümüş: rates.Gümüş,
          };
        } else {
          ratesCreation = await fetchRatesForDate(createdAtStr, rates);
        }
      }

      if (active) {
        setHistRates({
          thirtyDaysAgo: rates30,
          creation: ratesCreation,
          loading: false,
        });
      }
    };

    loadRates();

    return () => {
      active = false;
    };
  }, [walletIdVal, walletType, rates, walletCreatedAt]);

  // Exchange rate helper
  const getCurrentRate = (type: Wallet['type']) => {
    if (type === 'Dolar') return rates.USD;
    if (type === 'Euro') return rates.EUR;
    if (type === 'Altın') return rates.Altın;
    if (type === 'Gümüş') return rates.Gümüş;
    return 1;
  };

  // Exchange rate resolver at date
  const getRateAtDate = (type: Wallet['type'], dateStr: string, useYesterday: boolean = false) => {
    const currentRate = getCurrentRate(type);
    
    // Determine target date string
    const todayStr = new Date().toLocaleDateString('sv-SE');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('sv-SE');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString('sv-SE');

    let createdAtStr = '';
    if (walletCreatedAt) {
      createdAtStr = new Date(walletCreatedAt).toLocaleDateString('sv-SE');
    }

    const checkDateStr = useYesterday ? yesterdayStr : dateStr;

    if (checkDateStr >= todayStr) {
      return currentRate;
    }

    if (checkDateStr === yesterdayStr) {
      let change = 0;
      if (type === 'Dolar') change = rates.USDChange;
      else if (type === 'Euro') change = rates.EURChange;
      else if (type === 'Altın') change = rates.AltınChange;
      else if (type === 'Gümüş') change = rates.GümüşChange;
      return currentRate / (1 + change / 100);
    }

    if (checkDateStr === createdAtStr && histRates.creation) {
      if (type === 'Dolar') return histRates.creation.USD;
      if (type === 'Euro') return histRates.creation.EUR;
      if (type === 'Altın') return histRates.creation.Altın;
      if (type === 'Gümüş') return histRates.creation.Gümüş;
    }

    if (checkDateStr === thirtyDaysAgoStr && histRates.thirtyDaysAgo) {
      if (type === 'Dolar') return histRates.thirtyDaysAgo.USD;
      if (type === 'Euro') return histRates.thirtyDaysAgo.EUR;
      if (type === 'Altın') return histRates.thirtyDaysAgo.Altın;
      if (type === 'Gümüş') return histRates.thirtyDaysAgo.Gümüş;
    }

    // Default fallback to yesterday's rate
    let change = 0;
    if (type === 'Dolar') change = rates.USDChange;
    else if (type === 'Euro') change = rates.EURChange;
    else if (type === 'Altın') change = rates.AltınChange;
    else if (type === 'Gümüş') change = rates.GümüşChange;
    return currentRate / (1 + change / 100);
  };

  if (!wallet) {
    return (
      <div style={{ textAlign: 'center', padding: '24px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Cüzdan bulunamadı.</p>
        <button onClick={onBack} className="btn">Geri Dön</button>
      </div>
    );
  }

  const isBorsaWallet = wallet.type === 'Borsa_TRY' || wallet.type === 'Borsa_USD';

  // Filter transactions for this wallet
  const walletTx = useMemo(() => {
    return transactions
      .filter((tx) => tx.wallet_id === walletIdVal)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, walletIdVal]);

  // Group Incomes by Category
  const incomePieData = useMemo(() => {
    const dataMap: { [key: string]: { value: number; name: string; color: string } } = {};
    walletTx.forEach((tx) => {
      const cat = resolveTxCategory(tx, categories, wallets);
      if (cat.type === 'Gelir') {
        const amt = Number(tx.amount);
        if (dataMap[cat.id]) {
          dataMap[cat.id].value += amt;
        } else {
          dataMap[cat.id] = {
            value: amt,
            name: `${cat.emoji} ${cat.name}`,
            color: cat.color,
          };
        }
      }
    });
    return Object.values(dataMap).sort((a, b) => b.value - a.value);
  }, [walletTx, categories, wallets]);

  // Group Expenses by Category
  const expensePieData = useMemo(() => {
    const dataMap: { [key: string]: { value: number; name: string; color: string } } = {};
    walletTx.forEach((tx) => {
      const cat = resolveTxCategory(tx, categories, wallets);
      if (cat.type === 'Gider') {
        const amt = Number(tx.amount);
        if (dataMap[cat.id]) {
          dataMap[cat.id].value += amt;
        } else {
          dataMap[cat.id] = {
            value: amt,
            name: `${cat.emoji} ${cat.name}`,
            color: cat.color,
          };
        }
      }
    });
    return Object.values(dataMap).sort((a, b) => b.value - a.value);
  }, [walletTx, categories, wallets]);

  // Artan & Azalan Borsa Slices
  interface StockSlice {
    name: string;
    value: number;
    originalChange: number;
    color: string;
  }

  const { artanData, azalanData } = useMemo<{ artanData: StockSlice[]; azalanData: StockSlice[] }>(() => {
    const artan: StockSlice[] = [];
    const azalan: StockSlice[] = [];

    if (wallet && (wallet.type === 'Borsa_TRY' || wallet.type === 'Borsa_USD')) {
      const myStocks = userStocks.filter(s => s.wallet_id === walletIdVal && Number(s.shares_count) > 0);

      myStocks.forEach(s => {
        const averageCost = Number(s.average_cost);
        const sym = s.symbol === 'THY' ? 'THYAO' : s.symbol.toUpperCase();
        const quote = stockPrices[sym];
        const currentPrice = quote ? quote.price : averageCost;
        const changePercent = averageCost > 0 ? ((currentPrice - averageCost) / averageCost) * 100 : 0;

        if (changePercent > 0) {
          artan.push({
            name: s.symbol.toUpperCase(),
            value: changePercent,
            originalChange: changePercent,
            color: getStockColor(s.symbol),
          });
        } else if (changePercent < 0) {
          azalan.push({
            name: s.symbol.toUpperCase(),
            value: Math.abs(changePercent),
            originalChange: changePercent,
            color: getStockColor(s.symbol),
          });
        }
      });
    }

    const sortedArtan = [...artan].sort((a, b) => b.value - a.value);
    const sortedAzalan = [...azalan].sort((a, b) => b.value - a.value);
    return { artanData: sortedArtan, azalanData: sortedAzalan };
  }, [wallet, userStocks, stockPrices, walletIdVal]);

  // Reconstruct Daily Ending Balance Timeline (or historical state)
  const getBalanceAtDate = (targetDateStr: string, useYesterday: boolean) => {
    if (!wallet) return 0;
    // If the target date is before the wallet was created, the balance was 0
    if (walletCreatedAt) {
      const createdAtDateStr = new Date(walletCreatedAt).toLocaleDateString('sv-SE');
      if (targetDateStr < createdAtDateStr) {
        return 0;
      }
    }

    const isBorsaWallet = walletType === 'Borsa_TRY' || walletType === 'Borsa_USD';
    const isDovizMaden = ['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(walletType || '');

    if (isDovizMaden && walletAssetBalances) {
      // Reconstruct historical asset balances
      let tempUsd = walletAssetBalances.usd;
      let tempEur = walletAssetBalances.eur;
      let tempGold = walletAssetBalances.gold;
      let tempSilver = walletAssetBalances.silver;

      // Sort transactions descending to undo them back to targetDateStr
      const sortedTxs = [...walletTx].sort((a, b) => b.date.localeCompare(a.date));

      for (const tx of sortedTxs) {
        if (tx.date > targetDateStr) {
          const desc = (tx.description || '').toLowerCase();
          if (desc.includes('alımı için çıkış') || desc.includes('alimi icin cikis')) {
            continue;
          }

          const isSell = desc.includes('satış') || desc.includes('satis') || desc.includes('satisi') || desc.includes('çıkış') || desc.includes('cikis');
          const multiplier = isSell ? -1 : 1;
          const absAmount = Math.abs(tx.amount);

          if (desc.includes('dolar') || desc.includes('usd') || desc.includes('$')) {
            tempUsd -= absAmount * multiplier;
          } else if (desc.includes('euro') || desc.includes('eur') || desc.includes('€')) {
            tempEur -= absAmount * multiplier;
          } else if (desc.includes('altın') || desc.includes('altin') || desc.includes('gold')) {
            tempGold -= absAmount * multiplier;
          } else if (desc.includes('gümüş') || desc.includes('gumus') || desc.includes('silver')) {
            tempSilver -= absAmount * multiplier;
          } else {
            if (walletType === 'Dolar') tempUsd -= absAmount * multiplier;
            else if (walletType === 'Euro') tempEur -= absAmount * multiplier;
            else if (walletType === 'Altın') tempGold -= absAmount * multiplier;
            else if (walletType === 'Gümüş') tempSilver -= absAmount * multiplier;
          }
        }
      }

      // Convert the reconstructed balances to TL at targetDateStr
      const rateUSD = getRateAtDate('Dolar', targetDateStr, useYesterday);
      const rateEUR = getRateAtDate('Euro', targetDateStr, useYesterday);
      const rateGold = getRateAtDate('Altın', targetDateStr, useYesterday);
      const rateSilver = getRateAtDate('Gümüş', targetDateStr, useYesterday);

      return (tempUsd * rateUSD) + (tempEur * rateEUR) + (tempGold * rateGold) + (tempSilver * rateSilver);
    }

    let tempCash = Number(walletCashBalance ?? walletBalance);
    
    // Sort transactions descending to undo them back to targetDateStr
    const sortedTxs = [...walletTx].sort((a, b) => b.date.localeCompare(a.date));
    
    const holdings: { [symbol: string]: number } = {};
    
    if (isBorsaWallet) {
      userStocks.forEach(s => {
        if (s.wallet_id === walletIdVal) {
          holdings[s.symbol.toUpperCase()] = Number(s.shares_count);
        }
      });
    }

    for (const tx of sortedTxs) {
      if (tx.date > targetDateStr) {
        const cat = resolveTxCategory(tx, categories, wallets);
        const isStockTx = isBorsaWallet && (cat.id === 'borsa-fallback' || tx.description.toLowerCase().includes('hisse'));
        
        if (isStockTx) {
          const match = tx.description.match(/^([A-Z0-9]+)\s+Hisse\s+(Alımı|Alimi|Satışı|Satisi)\s*\((\d+)\s+Adet/i);
          if (match) {
            const symbol = match[1].toUpperCase();
            const type = match[2];
            const count = Number(match[3]);
            
            if (type.toLowerCase().startsWith('al')) {
              holdings[symbol] = (holdings[symbol] || 0) - count;
              tempCash += Number(tx.amount);
            } else {
              holdings[symbol] = (holdings[symbol] || 0) + count;
              tempCash -= Number(tx.amount);
            }
          }
        } else {
          const isIncome = cat.type === 'Gelir';
          const amt = Number(tx.amount);
          if (isIncome) {
            tempCash -= amt;
          } else {
            tempCash += amt;
          }
        }
      }
    }

    let stockVal = 0;
    
    const todayStr = new Date().toLocaleDateString('sv-SE');
    const isPastDate = targetDateStr < todayStr;
    const needPastPrice = useYesterday || isPastDate;

    if (isBorsaWallet) {
      Object.entries(holdings).forEach(([symbol, shares]) => {
        if (shares > 0) {
          const sym = symbol === 'THY' ? 'THYAO' : symbol.toUpperCase();
          const quote = stockPrices[sym];
          if (quote) {
            const price = needPastPrice 
              ? (quote.price / (1 + (quote.change || 0) / 100))
              : quote.price;
            stockVal += shares * price;
          } else {
            const stockInfo = userStocks.find(s => s.wallet_id === walletIdVal && s.symbol.toUpperCase() === sym);
            stockVal += shares * (stockInfo ? Number(stockInfo.average_cost) : 0);
          }
        }
      });
    }

    const totalVal = tempCash + stockVal;
    return totalVal;
  };

  // Reconstruct Daily Ending Balance Timeline
  const timelineData = useMemo(() => {
    const txDates = walletTx.map((tx) => tx.date);
    if (walletCreatedAt) {
      txDates.push(new Date(walletCreatedAt).toLocaleDateString('sv-SE'));
    }
    const uniqueDates = Array.from(new Set(txDates));
    uniqueDates.sort((a, b) => b.localeCompare(a));

    const points: { date: string; balance: number }[] = [];

    const isDovizMaden = ['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(walletType || '');
    const currentVal = isDovizMaden && walletAssetBalances
      ? walletAssetBalances.totalTL
      : (walletType === 'Borsa_TRY' || walletType === 'Borsa_USD'
          ? (Number(walletCashBalance ?? walletBalance) + userStocks
              .filter(s => s.wallet_id === walletIdVal)
              .reduce((sum, s) => {
                const sym = s.symbol === 'THY' ? 'THYAO' : s.symbol.toUpperCase();
                const quote = stockPrices[sym];
                const price = quote ? quote.price : Number(s.average_cost);
                return sum + Number(s.shares_count) * price;
              }, 0))
          : Number(walletBalance));

    const shouldConvertToTL = !isDovizMaden && walletType !== 'Borsa_USD' && ['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(walletType || '');
    const currentRate = (shouldConvertToTL && walletType) ? getCurrentRate(walletType) : 1;

    points.push({
      date: 'Şimdi',
      balance: Number((isDovizMaden && walletAssetBalances ? walletAssetBalances.totalTL : currentVal * currentRate).toFixed(2))
    });

    uniqueDates.forEach((dStr) => {
      const balanceAtDate = getBalanceAtDate(dStr, false);
      const label = new Date(dStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      points.push({
        date: label,
        balance: Number(balanceAtDate.toFixed(2))
      });
    });

    if (uniqueDates.length > 0) {
      const oldestDateStr = uniqueDates[uniqueDates.length - 1];
      const oldestDate = new Date(oldestDateStr);
      oldestDate.setDate(oldestDate.getDate() - 1);
      const prevLabel = oldestDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      const balanceBefore = getBalanceAtDate(oldestDate.toLocaleDateString('sv-SE'), false);
      points.push({
        date: prevLabel,
        balance: Number(balanceBefore.toFixed(2))
      });
    }

    return points.reverse();
  }, [walletTx, walletIdVal, walletType, walletCreatedAt, walletBalance, walletCashBalance, userStocks, stockPrices, rates, categories, wallets, walletAssetBalances]);

  // Calculate change statistics over time (1 day, 30 days, total)
  const changeStats = useMemo(() => {
    if (!wallet || (walletType && walletType === 'Vadesiz')) return null;

    const today = new Date();
    
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString('sv-SE');

    const isTLBase = walletType !== 'Borsa_USD';
    const displayFormatType = isTLBase ? 'Vadesiz' : 'Borsa_USD';
    
    const currentVal = walletType === 'Borsa_TRY' || walletType === 'Borsa_USD'
      ? (Number(walletCashBalance ?? walletBalance) + userStocks
          .filter(s => s.wallet_id === walletIdVal)
          .reduce((sum, s) => {
            const sym = s.symbol === 'THY' ? 'THYAO' : s.symbol.toUpperCase();
            const quote = stockPrices[sym];
            const price = quote ? quote.price : Number(s.average_cost);
            return sum + Number(s.shares_count) * price;
          }, 0))
      : Number(walletBalance);

    const shouldConvertToTL = walletType !== 'Borsa_USD' && ['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(walletType || '');
    const currentRate = (shouldConvertToTL && walletType) ? getCurrentRate(walletType) : 1;
    const currentValTL = currentVal * currentRate;

    const getDiffStr = (historicalVal: number) => {
      const diff = currentValTL - historicalVal;
      const pct = historicalVal !== 0 ? (diff / historicalVal) * 100 : 0;
      const isUp = diff >= 0;
      const formattedDiff = formatCurrency(Math.abs(diff), displayFormatType);
      return {
        diff,
        pct: Number(pct.toFixed(2)),
        isUp,
        formattedDiff,
        text: `${isUp ? '▲' : '▼'} ${formattedDiff} (${isUp ? '+' : ''}${pct.toFixed(2)}%)`
      };
    };

    if (walletType === 'Borsa_TRY' || walletType === 'Borsa_USD') {
      const day1Diff = userStocks
        .filter(s => s.wallet_id === walletIdVal)
        .reduce((sum, s) => {
          const sym = s.symbol === 'THY' ? 'THYAO' : s.symbol.toUpperCase();
          const quote = stockPrices[sym];
          if (quote) {
            const changePercent = quote.change || 0;
            const currentVal = Number(s.shares_count) * quote.price;
            const yesterdayVal = currentVal / (1 + changePercent / 100);
            return sum + (currentVal - yesterdayVal);
          }
          return sum;
        }, 0);

      const totalInvested = Number(walletCashBalance ?? walletBalance) + userStocks
        .filter(s => s.wallet_id === walletIdVal)
        .reduce((sum, s) => sum + Number(s.shares_count) * Number(s.average_cost), 0);

      const thirtyDaysAgoValTL = getBalanceAtDate(thirtyDaysAgoStr, false);

      // ─── Calculate Dividends for Borsa Wallet ───
      const getSharesCountAtDate = (stockSymbol: string, targetDateStr: string) => {
        const currentStock = userStocks.find(s => {
          const sSym = s.symbol === 'THY' ? 'THYAO' : s.symbol.toUpperCase();
          const targetSym = stockSymbol === 'THY' ? 'THYAO' : stockSymbol.toUpperCase();
          return s.wallet_id === walletIdVal && sSym === targetSym;
        });

        let shares = currentStock ? Number(currentStock.shares_count) : 0;
        const sortedTxs = [...walletTx].sort((a, b) => b.date.localeCompare(a.date));

        for (const tx of sortedTxs) {
          if (tx.date > targetDateStr) {
            const cat = resolveTxCategory(tx, categories, wallets);
            const isStockTx = cat.id === 'borsa-fallback' || tx.description.toLowerCase().includes('hisse');
            if (isStockTx) {
              const match = tx.description.match(/^([A-Z0-9]+)\s+Hisse\s+(Alımı|Alimi|Satışı|Satisi)\s*\((\d+)\s+Adet/i);
              if (match) {
                const symbol = match[1].toUpperCase();
                const type = match[2];
                const count = Number(match[3]);

                const isThisStock = (symbol === 'THY' ? 'THYAO' : symbol) === (stockSymbol === 'THY' ? 'THYAO' : stockSymbol.toUpperCase());
                if (isThisStock) {
                  if (type.toLowerCase().startsWith('al')) {
                    shares -= count;
                  } else {
                    shares += count;
                  }
                }
              }
            }
          }
        }
        return Math.max(0, shares);
      };

      let totalDividends = 0;
      const isUSD = walletType === 'Borsa_USD';
      const dividendList = isUSD ? GLOBAL_DIVIDENDS : BIST_DIVIDENDS;

      const stockSymbols = new Set<string>();
      userStocks.forEach(s => {
        if (s.wallet_id === walletIdVal) {
          stockSymbols.add(s.symbol === 'THY' ? 'THYAO' : s.symbol.toUpperCase());
        }
      });
      walletTx.forEach(tx => {
        const match = tx.description.match(/^([A-Z0-9]+)\s+Hisse/i);
        if (match) {
          stockSymbols.add(match[1] === 'THY' ? 'THYAO' : match[1].toUpperCase());
        }
      });

      stockSymbols.forEach(sym => {
        const stockDivs = dividendList.filter(d => d.symbol === sym);
        stockDivs.forEach(div => {
          let walletCreatedStr = '';
          if (walletCreatedAt) {
            walletCreatedStr = new Date(walletCreatedAt).toLocaleDateString('sv-SE');
          }
          const todayStr = new Date().toLocaleDateString('sv-SE');

          if (div.date >= walletCreatedStr && div.date <= todayStr) {
            const sharesCount = getSharesCountAtDate(sym, div.date);
            if (sharesCount > 0) {
              totalDividends += sharesCount * div.amount;
            }
          }
        });
      });

      return {
        day1: getDiffStr(currentValTL - (day1Diff * currentRate)),
        days30: getDiffStr(thirtyDaysAgoValTL),
        total: getDiffStr(totalInvested * currentRate),
        dividends: {
          amount: totalDividends,
          text: `+${formatCurrency(totalDividends, walletType)}`,
          isPositive: totalDividends > 0
        }
      };
    }

    // ─── Currency / Metal Wallet 1-Day & 30-Day Rate-Based Statistics ───
    if (['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(walletType || '') && walletAssetBalances) {
      const currentValTL = walletAssetBalances.totalTL;

      const rateYesterdayUSD = rates.USD / (1 + rates.USDChange / 100);
      const rateYesterdayEUR = rates.EUR / (1 + rates.EURChange / 100);
      const rateYesterdayGold = rates.Altın / (1 + rates.AltınChange / 100);
      const rateYesterdaySilver = rates.Gümüş / (1 + rates.GümüşChange / 100);

      const yesterdayValTL = 
        (walletAssetBalances.usd * rateYesterdayUSD) +
        (walletAssetBalances.eur * rateYesterdayEUR) +
        (walletAssetBalances.gold * rateYesterdayGold) +
        (walletAssetBalances.silver * rateYesterdaySilver);

      let thirtyDaysAgoValTL = yesterdayValTL;
      let is30DaysLoading = false;

      if (histRates.thirtyDaysAgo) {
        thirtyDaysAgoValTL = 
          (walletAssetBalances.usd * histRates.thirtyDaysAgo.USD) +
          (walletAssetBalances.eur * histRates.thirtyDaysAgo.EUR) +
          (walletAssetBalances.gold * histRates.thirtyDaysAgo.Altın) +
          (walletAssetBalances.silver * histRates.thirtyDaysAgo.Gümüş);
      } else if (histRates.loading) {
        is30DaysLoading = true;
      }

      const totalInvestedTL = dovizMadenDetails.totalInvested;

      const getDiffStr = (historicalVal: number) => {
        const diff = currentValTL - historicalVal;
        const pct = historicalVal !== 0 ? (diff / historicalVal) * 100 : 0;
        const isUp = diff >= 0;
        const formattedDiff = formatCurrency(Math.abs(diff), 'Vadesiz');
        return {
          diff,
          pct: Number(pct.toFixed(2)),
          isUp,
          formattedDiff,
          text: `${isUp ? '▲' : '▼'} ${formattedDiff} (${isUp ? '+' : ''}${pct.toFixed(2)}%)`
        };
      };

      const day1Stats = getDiffStr(yesterdayValTL);
      
      let days30Stats;
      if (is30DaysLoading) {
        days30Stats = {
          diff: 0,
          pct: 0,
          isUp: true,
          formattedDiff: '...',
          text: 'Yükleniyor...'
        };
      } else {
        days30Stats = getDiffStr(thirtyDaysAgoValTL);
      }

      let totalStats;
      if (dovizMadenDetails.hasCostData) {
        totalStats = getDiffStr(totalInvestedTL);
      } else {
        totalStats = {
          diff: 0,
          pct: 0,
          isUp: true,
          formattedDiff: formatCurrency(0, 'Vadesiz'),
          text: '0,00 TL (0.00%)'
        };
      }

      return {
        day1: day1Stats,
        days30: days30Stats,
        total: totalStats,
        dividends: undefined
      };
    }

    // Default fallback
    const day1Stats = { diff: 0, pct: 0, isUp: true, formattedDiff: '0,00 TL', text: '0,00 TL (0.00%)' };
    const days30Stats = { diff: 0, pct: 0, isUp: true, formattedDiff: '0,00 TL', text: '0,00 TL (0.00%)' };
    const totalStats = { diff: 0, pct: 0, isUp: true, formattedDiff: '0,00 TL', text: '0,00 TL (0.00%)' };

    return {
      day1: day1Stats,
      days30: days30Stats,
      total: totalStats,
      dividends: undefined
    };
  }, [
    wallet,
    walletTx,
    userStocks,
    stockPrices,
    rates,
    categories,
    wallets,
    histRates,
    walletIdVal,
    walletType,
    walletCreatedAt,
    walletBalance,
    walletCashBalance,
    walletAssetBalances,
    dovizMadenDetails
  ]);

  const isTLBase = wallet.type !== 'Borsa_USD';
  const displayFormatType = isTLBase ? 'Vadesiz' : 'Borsa_USD';

  return (
    <div style={{ textAlign: 'left' }}>
      {/* Back Header */}
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: '16px',
          padding: 0
        }}
      >
        <FiArrowLeft />
        <span>Geri Dön</span>
      </button>

      {/* Wallet Card Info */}
      <div className="card muted" style={{ borderLeft: `5px solid ${wallet.color}`, marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span>{wallet.name}</span>
          <span style={{ fontSize: '0.62rem', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
            {wallet.type === 'Kredi_Karti' ? 'Kredi Kartı' : 
             (['Dolar', 'Euro'].includes(wallet.type) ? 'DÖVİZ HESABI' :
              (['Altın', 'Gümüş'].includes(wallet.type) ? 'MADEN HESABI' : wallet.type))}
          </span>
        </h3>
        <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
          <span>
            {['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(wallet.type) && walletAssetBalances
              ? walletAssetBalances.displayValue
              : formatCurrency(wallet.balance, wallet.type)}
          </span>
          {(wallet.type === 'Borsa_TRY' || wallet.type === 'Borsa_USD') && (
            <span style={{ fontSize: '1.05rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              ({formatCurrency(totalCostBasis, wallet.type)})
            </span>
          )}
          {['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(wallet.type) && dovizMadenDetails.hasCostData && (
            <span style={{ fontSize: '1.05rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              ({new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalCostBasis)})
            </span>
          )}
        </h2>
        {['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(wallet.type) && walletAssetBalances && (
          <div style={{ fontSize: '1.05rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(walletAssetBalances.totalTL)}
          </div>
        )}
        {wallet.type === 'Kredi_Karti' && (
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            <span>Limit: {formatCurrency(wallet.credit_limit || 0, 'Vadesiz')}</span>
            <span>Son Ödeme: Ayın {wallet.due_date || 15}'i</span>
          </div>
        )}

        {changeStats && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
            {/* 1 Günlük Değişim */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '0.7rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '2px',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              flex: '1 1 100px'
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.58rem', fontWeight: 600 }}>1 GÜNLÜK DEĞİŞİM</span>
              <span style={{
                color: changeStats.day1.isUp ? '#34d399' : '#f87171',
                fontWeight: 700,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1px',
                marginTop: '2px'
              }}>
                <span>{changeStats.day1.isUp ? '▲' : '▼'} {changeStats.day1.formattedDiff}</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 600 }}>
                  ({changeStats.day1.isUp ? '+' : ''}{changeStats.day1.pct.toFixed(2)}%)
                </span>
              </span>
            </div>

            {/* Temettü Geliri veya 30 Günlük Değişim */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '0.7rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '2px',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              flex: '1 1 100px'
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.58rem', fontWeight: 600 }}>
                {isBorsaWallet ? 'TEMETTÜ GELİRİ' : '30 GÜNLÜK DEĞİŞİM'}
              </span>
              {isBorsaWallet ? (
                <span style={{
                  color: changeStats.dividends?.isPositive ? '#34d399' : 'var(--text-muted)',
                  fontWeight: 700,
                  marginTop: '2px'
                }}>
                  {changeStats.dividends?.text}
                </span>
              ) : (
                <span style={{
                  color: changeStats.days30.isUp ? '#34d399' : '#f87171',
                  fontWeight: 700,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1px',
                  marginTop: '2px'
                }}>
                  <span>{changeStats.days30.isUp ? '▲' : '▼'} {changeStats.days30.formattedDiff}</span>
                  <span style={{ fontSize: '0.62rem', fontWeight: 600 }}>
                    ({changeStats.days30.isUp ? '+' : ''}{changeStats.days30.pct.toFixed(2)}%)
                  </span>
                </span>
              )}
            </div>

            {/* Toplam Değişim */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '0.7rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '2px',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              flex: '1 1 100px'
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.58rem', fontWeight: 600 }}>TOPLAM DEĞİŞİM</span>
              <span style={{
                color: changeStats.total.isUp ? '#34d399' : '#f87171',
                fontWeight: 700,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1px',
                marginTop: '2px'
              }}>
                <span>{changeStats.total.isUp ? '▲' : '▼'} {changeStats.total.formattedDiff}</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 600 }}>
                  ({changeStats.total.isUp ? '+' : ''}{changeStats.total.pct.toFixed(2)}%)
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Balance over time timeline */}
      <div className="card muted" style={{ marginBottom: '20px', padding: '16px 12px' }}>
        <div className="card-title" style={{ marginBottom: '14px' }}>Bakiye Değişimi (Zamana Bağlı)</div>
        <div style={{ width: '100%', height: '180px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="walletColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={wallet.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={wallet.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="rgba(255, 255, 255, 0.2)" fontSize={10} />
              <YAxis stroke="rgba(255, 255, 255, 0.2)" fontSize={10} />
              <Tooltip
                formatter={(value: any) => formatCurrency(Number(value), displayFormatType)}
                contentStyle={{
                  background: '#121826',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '11px',
                }}
              />
              <CartesianGrid stroke="rgba(255, 255, 255, 0.03)" vertical={false} />
              <Area type="monotone" dataKey="balance" stroke={wallet.color} strokeWidth={2} fillOpacity={1} fill="url(#walletColor)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gelir / Gider veya Varlık/Hisse Performans Dağılımları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(wallet.type) ? (
          <>
            {/* Varlık Dağılımı */}
            <div className="card muted" style={{ minHeight: '220px', padding: '16px', gridColumn: 'span 2', display: 'flex', flexDirection: 'column' }}>
              <div className="card-title" style={{ textAlign: 'center', marginBottom: '14px', fontSize: '0.9rem', fontWeight: 700 }}>Varlık Dağılımı</div>
              
              {assetAllocationData.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-around', gap: '20px', width: '100%', flex: 1 }}>
                  
                  {/* Pie Chart */}
                  <div style={{ width: '130px', height: '130px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={assetAllocationData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                          {assetAllocationData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(value))}
                          contentStyle={{ background: '#121826', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', fontSize: '11px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Legend & Asset details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '180px' }}>
                    {assetAllocationData.map((d, _, arr) => {
                      const total = arr.reduce((sum, item) => sum + item.value, 0);
                      const percent = total > 0 ? (d.value / total) * 100 : 0;
                      return (
                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '4px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: d.color }} />
                            <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{d.name}</span>
                          </span>
                          <div style={{ textAlign: 'right', fontSize: '0.75rem' }}>
                            <div style={{ color: 'var(--text-bright)', fontWeight: 700 }}>
                              {d.originalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {d.symbol}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(d.value)} ({percent.toFixed(1)}%)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Cüzdanda bakiye bulunmuyor.
                </div>
              )}
            </div>

            {/* Güncel Kurlar */}
            <div className="card muted" style={{ padding: '16px', gridColumn: 'span 2' }}>
              <div className="card-title" style={{ textAlign: 'center', marginBottom: '14px', fontSize: '0.85rem', fontWeight: 700 }}>Güncel Kur Bilgileri</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                {['Dolar', 'Euro'].includes(wallet.type) ? (
                  <>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid rgba(255, 255, 255, 0.04)'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>USD / TRY</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(rates.USD)}
                        </span>
                      </div>
                      <span style={{
                        color: rates.USDChange >= 0 ? '#34d399' : '#f87171',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {rates.USDChange >= 0 ? '▲' : '▼'} {rates.USDChange.toFixed(2)}%
                      </span>
                    </div>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid rgba(255, 255, 255, 0.04)'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>EUR / TRY</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(rates.EUR)}
                        </span>
                      </div>
                      <span style={{
                        color: rates.EURChange >= 0 ? '#34d399' : '#f87171',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {rates.EURChange >= 0 ? '▲' : '▼'} {rates.EURChange.toFixed(2)}%
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid rgba(255, 255, 255, 0.04)'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>GRAM ALTIN / TRY</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(rates.Altın)}
                        </span>
                      </div>
                      <span style={{
                        color: rates.AltınChange >= 0 ? '#34d399' : '#f87171',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {rates.AltınChange >= 0 ? '▲' : '▼'} {rates.AltınChange.toFixed(2)}%
                      </span>
                    </div>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid rgba(255, 255, 255, 0.04)'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>GRAM GÜMÜŞ / TRY</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(rates.Gümüş)}
                        </span>
                      </div>
                      <span style={{
                        color: rates.GümüşChange >= 0 ? '#34d399' : '#f87171',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {rates.GümüşChange >= 0 ? '▲' : '▼'} {rates.GümüşChange.toFixed(2)}%
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        ) : !isBorsaWallet ? (
          <>
            {/* Gider Dağılımı */}
            <div className="card muted" style={{ minHeight: '200px', padding: '12px' }}>
              <div className="card-title" style={{ textAlign: 'center', marginBottom: '10px', fontSize: '0.85rem' }}>Gider Dağılımı</div>
              {expensePieData.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                  <div style={{ width: '100%', height: '110px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={expensePieData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                          {expensePieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => formatCurrency(Number(value), wallet.type)}
                          contentStyle={{ background: '#121826', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', fontSize: '10px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '8px', fontSize: '0.62rem' }}>
                    {expensePieData.map((d) => (
                      <span key={d.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: d.color }} />
                        <span style={{ color: 'var(--text-muted)' }}>{d.name}:</span>
                        <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{formatCurrency(d.value, wallet.type)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Harcama kaydı yok.
                </div>
              )}
            </div>

            {/* Gelir Dağılımı */}
            <div className="card muted" style={{ minHeight: '200px', padding: '12px' }}>
              <div className="card-title" style={{ textAlign: 'center', marginBottom: '10px', fontSize: '0.85rem' }}>Gelir Dağılımı</div>
              {incomePieData.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                  <div style={{ width: '100%', height: '110px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={incomePieData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                          {incomePieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => formatCurrency(Number(value), wallet.type)}
                          contentStyle={{ background: '#121826', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', fontSize: '10px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '8px', fontSize: '0.62rem' }}>
                    {incomePieData.map((d) => (
                      <span key={d.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: d.color }} />
                        <span style={{ color: 'var(--text-muted)' }}>{d.name}:</span>
                        <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{formatCurrency(d.value, wallet.type)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Gelir kaydı yok.
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Artan Hisseler */}
            <div className="card muted" style={{ minHeight: '200px', padding: '12px' }}>
              <div className="card-title" style={{ textAlign: 'center', marginBottom: '10px', fontSize: '0.85rem', color: '#10b981', fontWeight: 700 }}>Artan Hisseler (Kar Dağılımı)</div>
              {artanData.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                  <div style={{ width: '100%', height: '110px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={artanData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                          {artanData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => `+${Number(value).toFixed(2)}%`}
                          contentStyle={{ background: '#121826', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', fontSize: '10px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '8px', fontSize: '0.62rem' }}>
                    {artanData.map((d, _, arr) => {
                      const total = arr.reduce((sum, item) => sum + item.value, 0);
                      const relativePercent = total > 0 ? (d.value / total) * 100 : 0;
                      return (
                        <span key={d.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: d.color }} />
                          <span style={{ color: 'var(--text-muted)' }}>{d.name}:</span>
                          <span style={{ color: '#10b981', fontWeight: 600 }}>+{d.originalChange.toFixed(2)}%</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.55rem' }}>({relativePercent.toFixed(1)}%)</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Yükselen hisse bulunmuyor.
                </div>
              )}
            </div>

            {/* Azalan Hisseler */}
            <div className="card muted" style={{ minHeight: '200px', padding: '12px' }}>
              <div className="card-title" style={{ textAlign: 'center', marginBottom: '10px', fontSize: '0.85rem', color: '#ef4444', fontWeight: 700 }}>Azalan Hisseler (Zarar Dağılımı)</div>
              {azalanData.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                  <div style={{ width: '100%', height: '110px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={azalanData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                          {azalanData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => `-${Number(value).toFixed(2)}%`}
                          contentStyle={{ background: '#121826', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', fontSize: '10px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '8px', fontSize: '0.62rem' }}>
                    {azalanData.map((d, _, arr) => {
                      const total = arr.reduce((sum, item) => sum + item.value, 0);
                      const relativePercent = total > 0 ? (d.value / total) * 100 : 0;
                      return (
                        <span key={d.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: d.color }} />
                          <span style={{ color: 'var(--text-muted)' }}>{d.name}:</span>
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>{d.originalChange.toFixed(2)}%</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.55rem' }}>({relativePercent.toFixed(1)}%)</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Düşen hisse bulunmuyor.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Wallet Transactions List */}
      <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Hesap İşlem Geçmişi</h3>
      <div className="tx-feed">
        {walletTx.length > 0 ? (
          walletTx.map((tx) => {
            const cat = resolveTxCategory(tx, categories, wallets);
            return (
              <div key={tx.id} className="tx-item" style={{ cursor: 'default' }}>
                <div className="tx-left">
                  <div
                    className="badge-category"
                    style={{
                      backgroundColor: `${wallet.color}15`,
                      color: wallet.color,
                      borderColor: `${wallet.color}30`,
                    }}
                  >
                    <span>{getWalletEmoji(wallet.type)}</span>
                    <span>{wallet.name}</span>
                  </div>
                  <div className="tx-details">
                    <span className="tx-description">{tx.description || 'Açıklama yok'}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                      <span className="tx-date">
                        {new Date(tx.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                      </span>
                      <span
                        style={{
                          fontSize: '0.62rem',
                          color: cat.color,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        • {cat.emoji} {cat.name}
                      </span>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                        <FiClock style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                        {tx.time_range}
                      </span>
                      {tx.tag_id && tagMap.get(tx.tag_id) && (() => {
                        const tag = tagMap.get(tx.tag_id)!;
                        return (
                          <>
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>•</span>
                            <span style={{ fontSize: '0.62rem', color: tag.color, fontWeight: 700 }}>
                              {tag.emoji} {tag.name}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <div className="tx-right">
                  <span className={`tx-amount ${cat.type === 'Gelir' ? 'gelir' : 'gider'}`}>
                    {cat.type === 'Gelir' ? '+' : '-'}
                    {formatCurrency(Number(tx.amount), wallet.type)}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Bu hesapta henüz bir hareket yok.
          </div>
        )}
      </div>
    </div>
  );
};


// ==================== CATEGORY DETAILS ====================
interface CategoryDetailsProps {
  categoryId: string;
  categories: Category[];
  transactions: Transaction[];
  wallets: Wallet[];
  onBack: () => void;
}

export const CategoryDetails: React.FC<CategoryDetailsProps> = ({
  categoryId,
  categories,
  transactions,
  wallets,
  onBack,
}) => {
  const category = categories.find((c) => c.id === categoryId);
  const walletMap = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);

  if (!category) {
    return (
      <div style={{ textAlign: 'center', padding: '24px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Kategori bulunamadı.</p>
        <button onClick={onBack} className="btn">Geri Dön</button>
      </div>
    );
  }

  // Filter transactions in this category
  const categoryTx = useMemo(() => {
    return transactions
      .filter((tx) => tx.category_id === category.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, category.id]);

  // Wallet Distribution Pie Chart
  const walletPieData = useMemo(() => {
    const dataMap: { [key: string]: { value: number; name: string; color: string } } = {};
    categoryTx.forEach((tx) => {
      const w = walletMap.get(tx.wallet_id);
      if (w) {
        const amt = Number(tx.amount);
        if (dataMap[w.id]) {
          dataMap[w.id].value += amt;
        } else {
          dataMap[w.id] = {
            value: amt,
            name: w.name,
            color: w.color,
          };
        }
      }
    });
    return Object.values(dataMap).sort((a, b) => b.value - a.value);
  }, [categoryTx, walletMap]);

  // Timeline BarChart (Spending / Income trend)
  const timelineData = useMemo(() => {
    const dataMap: { [key: string]: number } = {};
    categoryTx.forEach((tx) => {
      const dateStr = tx.date; // "YYYY-MM-DD"
      dataMap[dateStr] = (dataMap[dateStr] || 0) + Number(tx.amount);
    });
    return Object.keys(dataMap)
      .sort((a, b) => a.localeCompare(b))
      .map(dateStr => ({
        date: new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
        tutar: Number(dataMap[dateStr].toFixed(2))
      }));
  }, [categoryTx]);

  return (
    <div style={{ textAlign: 'left' }}>
      {/* Back Header */}
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: '16px',
          padding: 0
        }}
      >
        <FiArrowLeft />
        <span>Geri Dön</span>
      </button>

      {/* Category Info Header */}
      <div className="card muted" style={{ borderLeft: `5px solid ${category.color}`, marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{category.emoji} {category.name}</span>
          <span style={{
            fontSize: '0.62rem',
            background: category.type === 'Gelir' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderColor: category.type === 'Gelir' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            borderWidth: '1px',
            borderStyle: 'solid',
            color: category.type === 'Gelir' ? '#34d399' : '#f87171',
            padding: '2px 6px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            fontWeight: 700
          }}>
            {category.type} Kategorisi
          </span>
        </h3>
        <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>
          {formatCurrency(categoryTx.reduce((sum, tx) => sum + Number(tx.amount), 0), 'Vadesiz')}
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '8px' }}>
            toplam tutar ({categoryTx.length} işlem)
          </span>
        </h2>
      </div>

      {/* Wallet Distribution (Pie Chart) & Trend (Bar Chart) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* Wallet Distribution */}
        <div className="card muted" style={{ padding: '16px 12px' }}>
          <div className="card-title" style={{ marginBottom: '14px' }}>Hesaplara / Cüzdanlara Göre Dağılımı</div>
          {walletPieData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <div style={{ width: '100%', height: '140px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={walletPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                      {walletPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => formatCurrency(Number(value), 'Vadesiz')}
                      contentStyle={{ background: '#121826', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '10px', fontSize: '0.68rem' }}>
                {walletPieData.map((d) => (
                  <span key={d.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: d.color }} />
                    <span style={{ color: 'var(--text-muted)' }}>{d.name}:</span>
                    <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{formatCurrency(d.value, 'Vadesiz')}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '180px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Veri bulunmuyor.
            </div>
          )}
        </div>

        {/* Trend Bar Chart */}
        <div className="card muted" style={{ padding: '16px 12px' }}>
          <div className="card-title" style={{ marginBottom: '14px' }}>Harcama / Gelir Trendi</div>
          {timelineData.length > 0 ? (
            <div style={{ width: '100%', height: '180px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timelineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" stroke="rgba(255, 255, 255, 0.2)" fontSize={9} />
                  <YAxis stroke="rgba(255, 255, 255, 0.2)" fontSize={9} />
                  <Tooltip
                    formatter={(value: any) => formatCurrency(Number(value), 'Vadesiz')}
                    contentStyle={{ background: '#121826', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', fontSize: '10px', color: '#fff' }}
                  />
                  <Bar dataKey="tutar" fill={category.color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '180px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Haraket yok.
            </div>
          )}
        </div>
      </div>

      {/* Transaction History for this Category */}
      <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Kategori İşlem Geçmişi</h3>
      <div className="tx-feed">
        {categoryTx.length > 0 ? (
          categoryTx.map((tx) => {
            const w = walletMap.get(tx.wallet_id);
            return (
              <div key={tx.id} className="tx-item" style={{ cursor: 'default' }}>
                <div className="tx-left">
                  <div
                    className="badge-category"
                    style={{
                      backgroundColor: `${w?.color || '#64748b'}15`,
                      color: w?.color || '#64748b',
                      borderColor: `${w?.color || '#64748b'}30`,
                    }}
                  >
                    <span>{w ? getWalletEmoji(w.type) : '💼'}</span>
                    <span>{w?.name || 'Hesap'}</span>
                  </div>
                  <div className="tx-details">
                    <span className="tx-description">{tx.description || 'Açıklama yok'}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                      <span className="tx-date">
                        {new Date(tx.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                      </span>
                      <span
                        style={{
                          fontSize: '0.62rem',
                          color: category.color,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        • {category.emoji} {category.name}
                      </span>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                        <FiClock style={{ verticalAlign: 'middle', marginRight: '2px', marginLeft: '4px' }} />
                        {tx.time_range}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="tx-right">
                  <span className={`tx-amount ${category.type === 'Gelir' ? 'gelir' : 'gider'}`}>
                    {category.type === 'Gelir' ? '+' : '-'}
                    {formatCurrency(Number(tx.amount), w?.type)}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Bu kategoride henüz bir işlem yok.
          </div>
        )}
      </div>
    </div>
  );
};


// ==================== TAG DETAILS ====================
interface TagDetailsProps {
  tagId: string;
  tags: Tag[];
  transactions: Transaction[];
  wallets: Wallet[];
  categories: Category[];
  onBack: () => void;
}

export const TagDetails: React.FC<TagDetailsProps> = ({
  tagId,
  tags,
  transactions,
  wallets,
  categories,
  onBack,
}) => {
  const tag = tags.find((t) => t.id === tagId);
  const walletMap = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);

  if (!tag) {
    return (
      <div style={{ textAlign: 'center', padding: '24px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Etiket bulunamadı.</p>
        <button onClick={onBack} className="btn">Geri Dön</button>
      </div>
    );
  }

  // Filter transactions with this tag
  const tagTx = useMemo(() => {
    return transactions
      .filter((tx) => tx.tag_id === tag.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, tag.id]);

  // Wallet Distribution
  const walletPieData = useMemo(() => {
    const dataMap: { [key: string]: { value: number; name: string; color: string } } = {};
    tagTx.forEach((tx) => {
      const w = walletMap.get(tx.wallet_id);
      if (w) {
        const amt = Number(tx.amount);
        if (dataMap[w.id]) {
          dataMap[w.id].value += amt;
        } else {
          dataMap[w.id] = {
            value: amt,
            name: w.name,
            color: w.color,
          };
        }
      }
    });
    return Object.values(dataMap).sort((a, b) => b.value - a.value);
  }, [tagTx, walletMap]);

  // Category Distribution
  const categoryPieData = useMemo(() => {
    const dataMap: { [key: string]: { value: number; name: string; color: string } } = {};
    tagTx.forEach((tx) => {
      const cat = resolveTxCategory(tx, categories, wallets);
      if (cat) {
        const amt = Number(tx.amount);
        if (dataMap[cat.id]) {
          dataMap[cat.id].value += amt;
        } else {
          dataMap[cat.id] = {
            value: amt,
            name: `${cat.emoji} ${cat.name}`,
            color: cat.color,
          };
        }
      }
    });
    return Object.values(dataMap).sort((a, b) => b.value - a.value);
  }, [tagTx, categories, wallets]);

  // Timeline Trend
  const timelineData = useMemo(() => {
    const dataMap: { [key: string]: number } = {};
    tagTx.forEach((tx) => {
      const dateStr = tx.date; // "YYYY-MM-DD"
      dataMap[dateStr] = (dataMap[dateStr] || 0) + Number(tx.amount);
    });
    return Object.keys(dataMap)
      .sort((a, b) => a.localeCompare(b))
      .map(dateStr => ({
        date: new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
        tutar: Number(dataMap[dateStr].toFixed(2))
      }));
  }, [tagTx]);

  return (
    <div style={{ textAlign: 'left' }}>
      {/* Back Header */}
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: '16px',
          padding: 0
        }}
      >
        <FiArrowLeft />
        <span>Geri Dön</span>
      </button>

      {/* Tag Info Header */}
      <div className="card muted" style={{ borderLeft: `5px solid ${tag.color}`, marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{tag.emoji} {tag.name}</span>
          <span style={{ fontSize: '0.62rem', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 6px', borderRadius: '4px' }}>
            Etiket Detayı
          </span>
        </h3>
        <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>
          {formatCurrency(tagTx.reduce((sum, tx) => sum + Number(tx.amount), 0), 'Vadesiz')}
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '8px' }}>
            toplam tutar ({tagTx.length} işlem)
          </span>
        </h2>
      </div>

      {/* Distributions Side by Side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* Wallet Distribution */}
        <div className="card muted" style={{ minHeight: '200px', padding: '12px' }}>
          <div className="card-title" style={{ textAlign: 'center', marginBottom: '10px', fontSize: '0.85rem' }}>Cüzdan Dağılımı</div>
          {walletPieData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <div style={{ width: '100%', height: '110px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={walletPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                      {walletPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => formatCurrency(Number(value), 'Vadesiz')}
                      contentStyle={{ background: '#121826', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', fontSize: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '8px', fontSize: '0.62rem' }}>
                {walletPieData.map((d) => (
                  <span key={d.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: d.color }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>{d.name}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Veri yok.
            </div>
          )}
        </div>

        {/* Category Distribution */}
        <div className="card muted" style={{ minHeight: '200px', padding: '12px' }}>
          <div className="card-title" style={{ textAlign: 'center', marginBottom: '10px', fontSize: '0.85rem' }}>Kategori Dağılımı</div>
          {categoryPieData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <div style={{ width: '100%', height: '110px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                      {categoryPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => formatCurrency(Number(value), 'Vadesiz')}
                      contentStyle={{ background: '#121826', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', fontSize: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '8px', fontSize: '0.62rem' }}>
                {categoryPieData.map((d) => (
                  <span key={d.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: d.color }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>{d.name}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Veri yok.
            </div>
          )}
        </div>
      </div>

      {/* Trend chart */}
      <div className="card muted" style={{ marginBottom: '20px', padding: '16px 12px' }}>
        <div className="card-title" style={{ marginBottom: '14px' }}>Kullanım Trendi</div>
        {timelineData.length > 0 ? (
          <div style={{ width: '100%', height: '160px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timelineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" stroke="rgba(255, 255, 255, 0.2)" fontSize={9} />
                <YAxis stroke="rgba(255, 255, 255, 0.2)" fontSize={9} />
                <Tooltip
                  formatter={(value: any) => formatCurrency(Number(value), 'Vadesiz')}
                  contentStyle={{ background: '#121826', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', fontSize: '10px' }}
                />
                <Bar dataKey="tutar" fill={tag.color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Haraket yok.
          </div>
        )}
      </div>

      {/* Transactions List */}
      <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Etiketli İşlemler</h3>
      <div className="tx-feed">
        {tagTx.length > 0 ? (
          tagTx.map((tx) => {
            const cat = resolveTxCategory(tx, categories, wallets);
            const w = walletMap.get(tx.wallet_id);
            return (
              <div key={tx.id} className="tx-item" style={{ cursor: 'default' }}>
                <div className="tx-left">
                  <div
                    className="badge-category"
                    style={{
                      backgroundColor: `${w?.color || '#64748b'}15`,
                      color: w?.color || '#64748b',
                      borderColor: `${w?.color || '#64748b'}30`,
                    }}
                  >
                    <span>{w ? getWalletEmoji(w.type) : '💼'}</span>
                    <span>{w?.name || 'Hesap'}</span>
                  </div>
                  <div className="tx-details">
                    <span className="tx-description">{tx.description || 'Açıklama yok'}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                      <span className="tx-date">
                        {new Date(tx.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                      </span>
                      <span
                        style={{
                          fontSize: '0.62rem',
                          color: cat.color,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        • {cat.emoji} {cat.name}
                      </span>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                        <FiClock style={{ verticalAlign: 'middle', marginRight: '2px', marginLeft: '4px' }} />
                        {tx.time_range}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="tx-right">
                  <span className={`tx-amount ${cat.type === 'Gelir' ? 'gelir' : 'gider'}`}>
                    {cat.type === 'Gelir' ? '+' : '-'}
                    {formatCurrency(Number(tx.amount), w?.type)}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Bu etiketle ilişkili işlem bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
};
