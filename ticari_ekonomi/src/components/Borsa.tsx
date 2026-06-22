import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { FiTrendingUp, FiTrendingDown, FiAlertCircle, FiClock } from 'react-icons/fi';

interface Wallet {
  id: string;
  name: string;
  type: 'Vadesiz' | 'Vadeli' | 'Dolar' | 'Euro' | 'Altın' | 'Gümüş' | 'Borsa_TRY' | 'Borsa_USD';
  color: string;
  balance: number;
  cash_balance?: number;
}

interface UserStock {
  id: string;
  wallet_id: string;
  symbol: string;
  shares_count: number;
  average_cost: number;
}

interface Transaction {
  id: string;
  wallet_id: string;
  category_id: string | null;
  tag_id?: string | null;
  amount: number;
  description: string;
  date: string;
  time_range: string;
}

interface BorsaProps {
  wallets: Wallet[];
  userStocks: UserStock[];
  stockPrices: { [key: string]: { price: number; change: number } };
  transactions: Transaction[];
  onRefreshData: () => void;
  userId: string;
}

const TRY_STOCKS = [
  'AEFES', 'AGHOL', 'AKBNK', 'AKSA', 'AKSEN', 'ALARK', 'ALTNY', 'ANHYT', 'ANSGR', 'ARCLK', 
  'ASELS', 'ASTOR', 'BERA', 'BIMAS', 'BRSAN', 'BRYAT', 'BSOKE', 'BTCIM', 'CANTE', 'CCOLA', 
  'CIMSA', 'CLEBI', 'CVKMD', 'CWENE', 'DAPGM', 'DOAS', 'DOHOL', 'DSTKF', 'ECILC', 'EFOR', 
  'EGEEN', 'EKGYO', 'ENERY', 'ENJSA', 'ENKAI', 'EREGL', 'EUPWR', 'FENER', 'FROTO', 'GARAN', 
  'GENIL', 'GESAN', 'GLRMK', 'GRSEL', 'GRTHO', 'GSRAY', 'GUBRF', 'HALKB', 'HEKTS', 'IEYHO', 
  'ISCTR', 'ISMEN', 'KCAER', 'KCHOL', 'KONTR', 'KONYA', 'KRDMD', 'KTLEV', 'KUYAS', 'LIDER', 
  'MAGEN', 'MAVI', 'MGROS', 'MIATK', 'MPARK', 'OBAMS', 'ODAS', 'OTKAR', 'OYAKC', 'PAHOL', 
  'PASEU', 'PETKM', 'PGSUS', 'RALYH', 'REEDR', 'RYGYO', 'SAHOL', 'SARKY', 'SASA', 'SELEC', 
  'SISE', 'SKBNK', 'SOKM', 'TABGD', 'TAVHL', 'TCELL', 'THYAO', 'TKFEN', 'TOASO', 'TRALT', 
  'TRENJ', 'TRMET', 'TSKB', 'TTKOM', 'TTRAK', 'TUKAS', 'TUPRS', 'TUREX', 'TURSG', 'ULKER', 
  'VAKBN', 'VESTL', 'YKBNK', 'ZOREN'
];
const TRY_FUNDS = ['AFT', 'MAC', 'TTE', 'YAS', 'IPJ', 'GMR', 'IIH', 'PNU', 'PRY', 'TP2'];

const USD_STOCKS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'AMZN', 'GOOGL', 'META', 'NFLX'];
const USD_ETFS = ['SPY', 'QQQ', 'VOO', 'ARKK', 'GLD', 'TLT'];

export const Borsa: React.FC<BorsaProps> = ({
  wallets,
  userStocks,
  stockPrices,
  transactions,
  onRefreshData,
  userId,
}) => {
  // Filter wallets to only borsa wallets
  const borsaWallets = useMemo(() => {
    return wallets.filter(w => w.type === 'Borsa_TRY' || w.type === 'Borsa_USD');
  }, [wallets]);

  // Determine active market type (TRY / USD)
  const [activeMarket, setActiveMarket] = useState<'TRY' | 'USD'>(() => {
    const firstBorsa = wallets.find(w => w.type === 'Borsa_TRY' || w.type === 'Borsa_USD');
    if (firstBorsa) {
      return firstBorsa.type === 'Borsa_USD' ? 'USD' : 'TRY';
    }
    return 'TRY';
  });

  // Keep activeMarket in sync if available wallets change
  React.useEffect(() => {
    const hasTry = borsaWallets.some(w => w.type === 'Borsa_TRY');
    const hasUsd = borsaWallets.some(w => w.type === 'Borsa_USD');
    if (hasTry && !hasUsd && activeMarket !== 'TRY') {
      setActiveMarket('TRY');
    } else if (hasUsd && !hasTry && activeMarket !== 'USD') {
      setActiveMarket('USD');
    }
  }, [borsaWallets, activeMarket]);

  // Filter transactions to only active borsa wallets transactions
  const borsaTransactions = useMemo(() => {
    const borsaWalletIds = new Set(
      borsaWallets
        .filter(w => activeMarket === 'USD' ? w.type === 'Borsa_USD' : w.type === 'Borsa_TRY')
        .map(w => w.id)
    );
    return transactions
      .filter(tx => borsaWalletIds.has(tx.wallet_id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, borsaWallets, activeMarket]);

  // Form States
  const [tradeType, setTradeType] = useState<'AL' | 'SAT'>('AL');
  const [walletId, setWalletId] = useState('');
  const [symbol, setSymbol] = useState(() => activeMarket === 'TRY' ? 'THYAO' : 'AAPL');
  const [sharesCount, setSharesCount] = useState('');
  const [price, setPrice] = useState('100');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Sync default symbol when active market changes
  React.useEffect(() => {
    const defaultSymbol = activeMarket === 'TRY' ? 'THYAO' : 'AAPL';
    setSymbol(defaultSymbol);
  }, [activeMarket]);

  // Sync selected stock price when symbol changes
  React.useEffect(() => {
    const sym = symbol === 'THY' ? 'THYAO' : symbol.toUpperCase();
    if (stockPrices[sym]) {
      setPrice(String(stockPrices[sym].price));
    }
  }, [symbol, stockPrices]);

  // Sync walletId based on active market and borsaWallets
  React.useEffect(() => {
    const filtered = borsaWallets.filter(w => activeMarket === 'USD' ? w.type === 'Borsa_USD' : w.type === 'Borsa_TRY');
    if (filtered.length > 0) {
      if (!filtered.some(w => w.id === walletId)) {
        setWalletId(filtered[0].id);
      }
    } else {
      setWalletId('');
    }
  }, [activeMarket, borsaWallets, walletId]);

  // User's active stock portfolio summary based on selected market
  const portfolio = useMemo(() => {
    let totalStockVal = 0;
    let totalInvested = 0;
    
    const items = userStocks
      .map(stock => {
        const w = wallets.find(w => w.id === stock.wallet_id);
        if (!w) return null;
        
        const isUSDWallet = w.type === 'Borsa_USD';
        const matchesMarket = activeMarket === 'USD' ? isUSDWallet : !isUSDWallet;
        if (!matchesMarket) return null;

        const sym = stock.symbol === 'THY' ? 'THYAO' : stock.symbol.toUpperCase();
        const quote = stockPrices[sym];
        const currentPrice = quote ? quote.price : (stock.average_cost || 0);
        const currentValue = Number(stock.shares_count) * currentPrice;
        const totalCost = Number(stock.shares_count) * Number(stock.average_cost);
        const profitLoss = currentValue - totalCost;
        const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

        totalStockVal += currentValue;
        totalInvested += totalCost;

        return {
          ...stock,
          walletName: w.name,
          walletType: w.type,
          currentPrice,
          currentValue,
          totalCost,
          profitLoss,
          profitLossPercent,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const totalProfitLoss = totalStockVal - totalInvested;
    const totalProfitLossPercent = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

    return {
      items,
      totalStockVal,
      totalInvested,
      totalProfitLoss,
      totalProfitLossPercent,
    };
  }, [userStocks, wallets, stockPrices, activeMarket]);

  // Unique symbols owned by user to display in watchlist, falling back to popular ones if portfolio is empty
  const watchlistSymbols = useMemo(() => {
    const marketStocks = userStocks.filter(stock => {
      const w = wallets.find(w => w.id === stock.wallet_id);
      if (!w) return false;
      return activeMarket === 'USD' ? w.type === 'Borsa_USD' : w.type !== 'Borsa_USD';
    });

    if (marketStocks.length > 0) {
      return Array.from(
        new Set(marketStocks.map(s => s.symbol === 'THY' ? 'THYAO' : s.symbol.toUpperCase()))
      );
    }
    
    return activeMarket === 'TRY' 
      ? ['THYAO', 'BIMAS', 'EREGL', 'AKBNK', 'KCHOL', 'TUPRS']
      : ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'SPY', 'QQQ'];
  }, [userStocks, wallets, activeMarket]);

  // Selected wallet summary
  const activeBorsaWallet = useMemo(() => {
    return borsaWallets.find(w => w.id === walletId);
  }, [borsaWallets, walletId]);

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const count = Number(sharesCount);
    const tradePrice = Number(price);
    if (count <= 0 || tradePrice <= 0) {
      setErrorMsg('Lütfen geçerli adet ve fiyat girin.');
      return;
    }
    if (!walletId) {
      setErrorMsg('Lütfen işlem yapılacak borsa cüzdanını seçin.');
      return;
    }

    const wallet = borsaWallets.find(w => w.id === walletId);
    if (!wallet) {
      setErrorMsg('Borsa cüzdanı bulunamadı.');
      return;
    }

    const totalCost = count * tradePrice;
    const cashBalance = wallet.cash_balance ?? wallet.balance;

    setLoading(true);
    setErrorMsg(null);

    try {
      if (tradeType === 'AL') {
        // Check if cash balance is sufficient
        if (cashBalance < totalCost) {
          throw new Error(`Yetersiz nakit bakiye! Gerekli: ${totalCost} ₺/$, Mevcut Nakit: ${cashBalance} ₺/$`);
        }

        // 1. Update cash balance in Supabase
        const newCash = Number((cashBalance - totalCost).toFixed(2));
        const { error: wError } = await supabase
          .from('wallets')
          .update({ balance: newCash })
          .eq('id', wallet.id);
        if (wError) throw wError;

        // 2. Fetch existing holdings (with symbol normalization)
        const existingStock = userStocks.find(s => {
          const sSym = s.symbol === 'THY' ? 'THYAO' : s.symbol.toUpperCase();
          const targetSym = symbol === 'THY' ? 'THYAO' : symbol.toUpperCase();
          return s.wallet_id === wallet.id && sSym === targetSym;
        });

        if (existingStock) {
          // Average Cost calculation
          const oldShares = Number(existingStock.shares_count);
          const oldCost = Number(existingStock.average_cost);
          const newShares = oldShares + count;
          const newAvgCost = Number(((oldShares * oldCost + totalCost) / newShares).toFixed(4));

          const { error: sError } = await supabase
            .from('user_stocks')
            .update({
              shares_count: newShares,
              average_cost: newAvgCost,
            })
            .eq('id', existingStock.id);
          if (sError) throw sError;
        } else {
          // Insert new stock holding
          const { error: sError } = await supabase
            .from('user_stocks')
            .insert({
              user_id: userId,
              wallet_id: wallet.id,
              symbol,
              shares_count: count,
              average_cost: tradePrice,
            });
          if (sError) throw sError;
        }

        // 3. Log a transaction history entry
        const isUSD = wallet.type === 'Borsa_USD';
        await supabase.from('transactions').insert({
          user_id: userId,
          wallet_id: wallet.id,
          amount: totalCost,
          description: `${symbol} Hisse Alımı (${count} Adet @ ${tradePrice} ${isUSD ? '$' : '₺'})`,
          date: new Date().toISOString().split('T')[0],
          time_range: new Date().toTimeString().slice(0, 5),
        });

      } else {
        // SELL OPERATION
        const existingStock = userStocks.find(s => {
          const sSym = s.symbol === 'THY' ? 'THYAO' : s.symbol.toUpperCase();
          const targetSym = symbol === 'THY' ? 'THYAO' : symbol.toUpperCase();
          return s.wallet_id === wallet.id && sSym === targetSym;
        });
        if (!existingStock || Number(existingStock.shares_count) < count) {
          throw new Error(`Portföyünüzde yeterli ${symbol} hissesi bulunmuyor. Mevcut: ${existingStock ? existingStock.shares_count : 0} Adet`);
        }

        // 1. Update cash balance
        const newCash = Number((cashBalance + totalCost).toFixed(2));
        const { error: wError } = await supabase
          .from('wallets')
          .update({ balance: newCash })
          .eq('id', wallet.id);
        if (wError) throw wError;

        // 2. Update stock holdings
        const oldShares = Number(existingStock.shares_count);
        const newShares = oldShares - count;

        if (newShares <= 0) {
          // Delete row
          const { error: sError } = await supabase
            .from('user_stocks')
            .delete()
            .eq('id', existingStock.id);
          if (sError) throw sError;
        } else {
          // Update shares count, average cost remains the same
          const { error: sError } = await supabase
            .from('user_stocks')
            .update({ shares_count: newShares })
            .eq('id', existingStock.id);
          if (sError) throw sError;
        }

        // 3. Log transaction history entry
        const isUSD = wallet.type === 'Borsa_USD';
        await supabase.from('transactions').insert({
          user_id: userId,
          wallet_id: wallet.id,
          amount: totalCost,
          description: `${symbol} Hisse Satışı (${count} Adet @ ${tradePrice} ${isUSD ? '$' : '₺'})`,
          date: new Date().toISOString().split('T')[0],
          time_range: new Date().toTimeString().slice(0, 5),
        });
      }

      setSharesCount('');
      setShowForm(false);
      onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Hisse işlemi gerçekleştirilirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number, walletType?: string) => {
    const isUSD = walletType === 'Borsa_USD' || walletType === 'Dolar' || (walletType === undefined && activeMarket === 'USD');
    const isSmallFund = val > 0 && val < 1;
    const decimals = isSmallFund ? 6 : 2;
    return new Intl.NumberFormat(isUSD ? 'en-US' : 'tr-TR', {
      style: 'currency',
      currency: isUSD ? 'USD' : 'TRY',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(val);
  };

  // Helper to render asset options categorized in groups
  const renderAssetOptions = () => {
    if (activeMarket === 'TRY') {
      const stocks = TRY_STOCKS;
      const funds = TRY_FUNDS;
      return (
        <>
          <optgroup label="BIST Hisse Senetleri">
            {stocks.map(s => {
              const quote = stockPrices[s];
              const livePrice = quote ? quote.price : 0;
              return (
                <option key={s} value={s}>
                  {s} - Güncel: {formatCurrency(livePrice, 'Borsa_TRY')}
                </option>
              );
            })}
          </optgroup>
          <optgroup label="Yatırım Fonları (TEFAS)">
            {funds.map(s => {
              const quote = stockPrices[s];
              const livePrice = quote ? quote.price : 0;
              return (
                <option key={s} value={s}>
                  {s} - Güncel: {formatCurrency(livePrice, 'Borsa_TRY')}
                </option>
              );
            })}
          </optgroup>
        </>
      );
    } else {
      const stocks = USD_STOCKS;
      const etfs = USD_ETFS;
      return (
        <>
          <optgroup label="Global Hisse Senetleri (USD)">
            {stocks.map(s => {
              const quote = stockPrices[s];
              const livePrice = quote ? quote.price : 0;
              return (
                <option key={s} value={s}>
                  {s} - Güncel: {formatCurrency(livePrice, 'Borsa_USD')}
                </option>
              );
            })}
          </optgroup>
          <optgroup label="Yabancı Fonlar (ETF - USD)">
            {etfs.map(s => {
              const quote = stockPrices[s];
              const livePrice = quote ? quote.price : 0;
              return (
                <option key={s} value={s}>
                  {s} - Güncel: {formatCurrency(livePrice, 'Borsa_USD')}
                </option>
              );
            })}
          </optgroup>
        </>
      );
    }
  };

  return (
    <div style={{ textAlign: 'left' }}>
      {/* Header with Toggle Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
          Borsa Takip & Portföyüm
        </h2>
        {borsaWallets.length > 0 && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              width: 'auto',
              margin: 0,
              background: showForm ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
              borderColor: showForm ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)',
              color: showForm ? '#f87171' : '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {showForm ? 'Kapat' : '+ Hisse Al / Sat'}
          </button>
        )}
      </div>

      {/* TRY vs USD Borsa Switcher (displays only if user has both types of wallets) */}
      {borsaWallets.some(w => w.type === 'Borsa_TRY') && borsaWallets.some(w => w.type === 'Borsa_USD') && (
        <div className="tab-switch" style={{ marginBottom: '20px' }}>
          <button
            type="button"
            className={`tab-switch-btn ${activeMarket === 'TRY' ? 'active' : ''}`}
            onClick={() => setActiveMarket('TRY')}
            style={{ padding: '8px 12px', fontSize: '0.8rem' }}
          >
            🇹🇷 BIST Portföyü (₺)
          </button>
          <button
            type="button"
            className={`tab-switch-btn ${activeMarket === 'USD' ? 'active' : ''}`}
            onClick={() => setActiveMarket('USD')}
            style={{ padding: '8px 12px', fontSize: '0.8rem' }}
          >
            🇺🇸 Global Portföy ($)
          </button>
        </div>
      )}

      {borsaWallets.length === 0 && (
        <div className="card error" style={{ padding: '14px', marginBottom: '16px' }}>
          <FiAlertCircle style={{ color: '#ef4444', marginRight: '6px' }} />
          <span style={{ fontSize: '0.8rem', color: '#fca5a5' }}>
            Hisse işlemi yapabilmek için öncelikle "Cüzdanlar" sekmesinden en az bir adet **Borsa** hesabı (Borsa TL veya Borsa USD) eklemelisiniz.
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="toast error" style={{ position: 'static', marginBottom: '16px' }}>
          <FiAlertCircle />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Buy/Sell Stock Form */}
      {showForm && borsaWallets.length > 0 && (
        <div className="card muted" style={{ marginBottom: '24px' }}>
          <div className="card-title" style={{ marginBottom: '14px' }}>
            Hisse / Fon Al / Sat
          </div>
          <form onSubmit={handleTrade}>
            <div className="tab-switch">
              <button
                type="button"
                className={`tab-switch-btn ${tradeType === 'AL' ? 'active gelir' : ''}`}
                onClick={() => setTradeType('AL')}
              >
                Yatırım Al (BUY)
              </button>
              <button
                type="button"
                className={`tab-switch-btn ${tradeType === 'SAT' ? 'active gider' : ''}`}
                onClick={() => setTradeType('SAT')}
              >
                Yatırım Sat (SELL)
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">İşlem Yapılacak Borsa Hesabı</label>
              <select
                className="form-control"
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                required
                style={{ background: '#121826' }}
              >
                {borsaWallets
                  .filter(w => activeMarket === 'USD' ? w.type === 'Borsa_USD' : w.type === 'Borsa_TRY')
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} (Nakit: {formatCurrency(w.cash_balance ?? w.balance, w.type)})
                    </option>
                  ))
                }
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Yatırım Enstrümanı</label>
              <select
                className="form-control"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                required
                style={{ background: '#121826' }}
              >
                {renderAssetOptions()}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Adet</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="0"
                  value={sharesCount}
                  onChange={(e) => setSharesCount(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Hisse Fiyatı</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px', fontWeight: 600 }}>
              Tahmini Toplam Tutar:{' '}
              <span style={{ color: 'var(--text-bright)' }}>
                {formatCurrency(Number(sharesCount) * Number(price) || 0, activeBorsaWallet?.type)}
              </span>
            </div>

            <button
              type="submit"
              className={`btn ${tradeType === 'AL' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                borderColor: tradeType === 'SAT' ? 'rgba(239, 68, 68, 0.3)' : '',
                color: tradeType === 'SAT' ? '#f87171' : '',
              }}
              disabled={loading}
            >
              <span>{loading ? 'İşlem yapılıyor...' : tradeType === 'AL' ? 'Hisse Satın Al' : 'Hisse Sat'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Portfolio Summary Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(30,41,59,0.3) 0%, rgba(15,23,42,0.5) 100%)',
          borderColor: 'rgba(255,255,255,0.04)',
          padding: '16px',
          borderRadius: '16px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            Hisse Portföy Değeri
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-bright)', marginTop: '4px' }}>
            {formatCurrency(portfolio.totalStockVal)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
            Toplam Yatırılan: {formatCurrency(portfolio.totalInvested)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            Toplam Kar / Zarar
          </div>
          <div
            style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: portfolio.totalProfitLoss >= 0 ? '#10b981' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '4px',
              marginTop: '4px',
            }}
          >
            {portfolio.totalProfitLoss >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
            <span>
              {portfolio.totalProfitLoss >= 0 ? '+' : ''}
              {formatCurrency(portfolio.totalProfitLoss)}
            </span>
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: portfolio.totalProfitLoss >= 0 ? '#10b981' : '#ef4444',
              marginTop: '2px',
            }}
          >
            {portfolio.totalProfitLoss >= 0 ? '+' : ''}
            {portfolio.totalProfitLossPercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Owned Stocks Grid */}
      <h3 style={{ fontSize: '0.95rem', marginBottom: '12px', paddingLeft: '4px', color: 'var(--text-bright)' }}>
        Portföy Hisselerim
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {portfolio.items.length > 0 ? (
          portfolio.items.map((item) => (
            <div
              key={item.id}
              className="tx-item"
              style={{
                cursor: 'default',
                background: 'rgba(255, 255, 255, 0.01)',
                borderColor: 'rgba(255, 255, 255, 0.03)',
                padding: '12px 14px',
              }}
            >
              <div className="tx-left">
                <div
                  style={{
                    backgroundColor: item.profitLoss >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: item.profitLoss >= 0 ? '#10b981' : '#ef4444',
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                  }}
                >
                  {item.symbol}
                </div>
                <div className="tx-details">
                  <span className="tx-description" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                    {item.shares_count} Adet
                  </span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    <span>Maliyet: {formatCurrency(Number(item.average_cost), item.walletType)}</span>
                    <span>•</span>
                    <span>Güncel: {formatCurrency(item.currentPrice, item.walletType)}</span>
                  </div>
                </div>
              </div>
              <div className="tx-right" style={{ alignItems: 'flex-end' }}>
                <span className="tx-amount" style={{ fontSize: '0.85rem', color: 'var(--text-bright)' }}>
                  {formatCurrency(item.currentValue, item.walletType)}
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: item.profitLoss >= 0 ? '#10b981' : '#ef4444',
                    marginTop: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  {item.profitLoss >= 0 ? '+' : ''}
                  {item.profitLossPercent.toFixed(2)}%
                </span>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Sahip olduğunuz bir hisse veya fon bulunmuyor.
          </div>
        )}
      </div>

      {/* Live Market Watchlist (BIST Watchlist) */}
      <h3 style={{ fontSize: '0.95rem', marginBottom: '12px', paddingLeft: '4px', color: 'var(--text-bright)' }}>
        {activeMarket === 'TRY' ? 'Canlı BIST Fiyatları (Hisse & Fon)' : 'Canlı Global Fiyatlar (Hisse & ETF)'}
      </h3>
      {portfolio.items.length === 0 && (
        <div 
          style={{ 
            background: 'rgba(59, 130, 246, 0.06)',
            borderColor: 'rgba(59, 130, 246, 0.15)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '14px',
            fontSize: '0.78rem',
            color: '#93c5fd',
            lineHeight: '1.4'
          }}
        >
          💡 <strong>Bilgi:</strong> Portföyünüz henüz boş olduğu için popüler {activeMarket === 'TRY' ? 'BIST hisse ve fonları' : 'global hisse ve ETF\'ler'} listelenmektedir. Yatırım yaptıkça burada sadece kendi enstrümanlarınız listelenecektir.
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          marginBottom: '24px',
        }}
      >
        {watchlistSymbols.map((symbol) => {
          const quote = stockPrices[symbol];
          const price = quote ? quote.price : 0;
          const change = quote ? quote.change : 0;
          const isUp = change >= 0;

          return (
            <div
              key={symbol}
              onClick={() => {
                setSymbol(symbol);
                if (!showForm) setShowForm(true);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: '12px',
                padding: '10px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)')}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-bright)' }}>{symbol}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, margin: '4px 0' }}>
                {price > 0 ? `${price.toFixed(2)} ₺` : 'Yükleniyor...'}
              </div>
              {price > 0 ? (
                <span
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: isUp ? '#10b981' : '#ef4444',
                    backgroundColor: isUp ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {isUp ? '▲' : '▼'} {isUp ? '+' : ''}
                  {change.toFixed(2)}%
                </span>
              ) : (
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>-</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Borsa Transaction History */}
      <h3 style={{ fontSize: '0.95rem', marginBottom: '12px', paddingLeft: '4px', color: 'var(--text-bright)' }}>
        Borsa İşlem Geçmişi
      </h3>
      <div className="tx-feed" style={{ marginBottom: '24px' }}>
        {borsaTransactions.length > 0 ? (
          borsaTransactions.map((tx) => {
            const w = wallets.find((wallet) => wallet.id === tx.wallet_id);
            const isBuy = tx.description.includes('Alımı') || tx.description.toLowerCase().includes('al');
            
            return (
              <div
                key={tx.id}
                className="tx-item"
                style={{
                  cursor: 'default',
                  background: 'rgba(255, 255, 255, 0.01)',
                  borderColor: 'rgba(255, 255, 255, 0.03)',
                  padding: '12px 14px',
                }}
              >
                <div className="tx-left">
                  <div
                    style={{
                      backgroundColor: isBuy ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      color: isBuy ? '#f87171' : '#10b981',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      textAlign: 'center',
                      minWidth: '50px',
                    }}
                  >
                    {isBuy ? 'ALIM' : 'SATIM'}
                  </div>
                  <div className="tx-details">
                    <span className="tx-description" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      {tx.description}
                    </span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      <span>
                        {new Date(tx.date).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'long',
                        })}
                      </span>
                      <span>•</span>
                      <span style={{ color: w?.color, fontWeight: 700 }}>
                        {w?.name || 'Borsa Hesabı'}
                      </span>
                      {tx.time_range && (
                        <>
                          <span>•</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <FiClock /> {tx.time_range}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="tx-right" style={{ alignItems: 'flex-end' }}>
                  <span className={`tx-amount ${isBuy ? 'gider' : 'gelir'}`} style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                    {isBuy ? '-' : '+'}
                    {formatCurrency(tx.amount, w?.type)}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Henüz bir borsa işlemi gerçekleştirilmedi.
          </div>
        )}
      </div>
    </div>
  );
};
