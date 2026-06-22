import React, { useState, useMemo } from 'react';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { supabase } from '../supabaseClient';
import type { ExchangeRates, CurrencyRate } from '../services/currencyService';

interface Wallet {
  id: string;
  name: string;
  type: 'Vadesiz' | 'Vadeli' | 'Dolar' | 'Euro' | 'Altın' | 'Gümüş' | 'Borsa_TRY' | 'Borsa_USD';
  color: string;
  balance: number;
}

interface Transaction {
  id: string;
  wallet_id: string;
  amount: number;
  description: string;
  date: string;
  time_range: string;
}

interface DovizMadenProps {
  wallets: Wallet[];
  rates: ExchangeRates;
  currencyRates: CurrencyRate[];
  transactions: Transaction[];
  categories: any[];
  onRefreshData: () => void;
  userId: string;
}

const DOVIZ_TYPES: Wallet['type'][] = ['Dolar', 'Euro', 'Altın', 'Gümüş'];

function formatTL(val: number, decimals = 2) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

function formatNative(val: number, type: Wallet['type']) {
  if (type === 'Dolar') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  if (type === 'Euro')  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  if (type === 'Altın') return `${val.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} gr`;
  if (type === 'Gümüş') return `${val.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} gr`;
  return val.toLocaleString('tr-TR');
}

function getRateForType(type: Wallet['type'], rates: ExchangeRates): number {
  if (type === 'Dolar') return rates.USD;
  if (type === 'Euro')  return rates.EUR;
  if (type === 'Altın') return rates.Altın;
  if (type === 'Gümüş') return rates.Gümüş;
  return 1;
}

function getChangeForType(type: Wallet['type'], rates: ExchangeRates): number {
  if (type === 'Dolar') return rates.USDChange;
  if (type === 'Euro')  return rates.EURChange;
  if (type === 'Altın') return rates.AltınChange;
  if (type === 'Gümüş') return rates.GümüşChange;
  return 0;
}

function getWalletIcon(type: Wallet['type']): string {
  if (type === 'Dolar') return '🇺🇸';
  if (type === 'Euro')  return '🇪🇺';
  if (type === 'Altın') return '🟡';
  if (type === 'Gümüş') return '⬜';
  return '💰';
}

export const DovizMaden: React.FC<DovizMadenProps> = ({ wallets, rates, currencyRates, transactions, onRefreshData, userId }) => {
  const [activeCategory, setActiveCategory] = useState<'doviz' | 'maden'>('doviz');
  
  // Transaction Form States
  const [showForm, setShowForm] = useState(false);
  const [tradeType, setTradeType] = useState<'AL' | 'SAT'>('AL');
  const [targetWalletId, setTargetWalletId] = useState('');
  const [sourceWalletId, setSourceWalletId] = useState('other'); // 'other' or a Vadesiz Wallet ID
  const [amount, setAmount] = useState('');
  const [customRate, setCustomRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter wallets
  const myWallets = useMemo(() => wallets.filter(w => DOVIZ_TYPES.includes(w.type)), [wallets]);
  const vadesizWallets = useMemo(() => wallets.filter(w => w.type === 'Vadesiz'), [wallets]);

  // Set default target wallet
  React.useEffect(() => {
    if (showForm && myWallets.length > 0 && !targetWalletId) {
      setTargetWalletId(myWallets[0].id);
      
      // Auto-fill custom rate based on live rate
      const targetW = myWallets[0];
      const liveRate = getRateForType(targetW.type, rates);
      setCustomRate(liveRate.toString());
    }
  }, [showForm, myWallets, targetWalletId, rates]);

  // Portfolio calculation with Average Cost
  const portfolio = useMemo(() => {
    let totalTL = 0;
    
    const items = myWallets.map(w => {
      const liveRate = getRateForType(w.type, rates);
      const change = getChangeForType(w.type, rates);
      const tlVal = w.balance * liveRate;
      totalTL += tlVal;

      // Calculate Average Cost from transactions
      // Format: "Döviz Alış (Kur: 35.50)"
      const wTxs = transactions.filter(tx => tx.wallet_id === w.id);
      let totalAmountBought = 0;
      let totalCostSpent = 0;

      wTxs.forEach(tx => {
        if (tx.description.includes('Alış (Kur:')) {
          const match = tx.description.match(/Kur:\s*([\d.]+)/);
          if (match && match[1]) {
            const parsedRate = parseFloat(match[1]);
            const boughtAmount = tx.amount; // amount of currency/metal bought
            totalAmountBought += boughtAmount;
            totalCostSpent += (boughtAmount * parsedRate);
          }
        }
      });

      const averageCost = totalAmountBought > 0 ? (totalCostSpent / totalAmountBought) : 0;
      const profitLoss = averageCost > 0 ? (liveRate - averageCost) * w.balance : 0;

      return { ...w, liveRate, change, tlVal, averageCost, profitLoss };
    });
    
    return { items, totalTL };
  }, [myWallets, rates, transactions]);

  // Form Submit Handler
  const handleTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetWalletId) return;
    
    const tradeAmount = parseFloat(amount);
    const tradeRate = parseFloat(customRate);

    if (isNaN(tradeAmount) || tradeAmount <= 0) {
      setErrorMsg('Geçerli bir miktar girin.');
      return;
    }
    if (isNaN(tradeRate) || tradeRate <= 0) {
      setErrorMsg('Geçerli bir kur girin.');
      return;
    }

    const targetWallet = myWallets.find(w => w.id === targetWalletId);
    if (!targetWallet) return;

    const totalTLRequired = tradeAmount * tradeRate;

    setLoading(true);
    setErrorMsg(null);

    try {
      if (tradeType === 'AL') {
        // Source Wallet check
        let newSourceBalance = 0;
        if (sourceWalletId !== 'other') {
          const sourceW = vadesizWallets.find(w => w.id === sourceWalletId);
          if (!sourceW) throw new Error('Kaynak hesap bulunamadı.');
          if (sourceW.balance < totalTLRequired) {
            throw new Error(`Kaynak hesapta yeterli bakiye yok. Gerekli: ${formatTL(totalTLRequired)}`);
          }
          newSourceBalance = sourceW.balance - totalTLRequired;
        }

        // 1. Update Source Wallet (if not other)
        if (sourceWalletId !== 'other') {
          const { error: sErr } = await supabase.from('wallets').update({ balance: newSourceBalance }).eq('id', sourceWalletId);
          if (sErr) throw sErr;

          await supabase.from('transactions').insert({
            user_id: userId,
            wallet_id: sourceWalletId,
            amount: -totalTLRequired, // expense
            description: `${targetWallet.name} Alımı İçin Çıkış`,
            date: new Date().toISOString().split('T')[0],
            time_range: new Date().toTimeString().slice(0, 5),
          });
        }

        // 2. Update Target Wallet
        const newTargetBalance = targetWallet.balance + tradeAmount;
        const { error: tErr } = await supabase.from('wallets').update({ balance: newTargetBalance }).eq('id', targetWallet.id);
        if (tErr) throw tErr;

        // 3. Log Target Transaction (Important for avg cost)
        const assetName = targetWallet.type === 'Altın' || targetWallet.type === 'Gümüş' ? 'Maden' : 'Döviz';
        await supabase.from('transactions').insert({
          user_id: userId,
          wallet_id: targetWallet.id,
          amount: tradeAmount, // amount bought
          description: `${assetName} Alış (Kur: ${tradeRate})`,
          date: new Date().toISOString().split('T')[0],
          time_range: new Date().toTimeString().slice(0, 5),
        });

      } else {
        // SELL
        if (targetWallet.balance < tradeAmount) {
          throw new Error('Cüzdanınızda yeterli varlık yok.');
        }

        // 1. Update Source Wallet (adds TL back if not other)
        if (sourceWalletId !== 'other') {
          const sourceW = vadesizWallets.find(w => w.id === sourceWalletId);
          if (!sourceW) throw new Error('Hedef hesap bulunamadı.');
          
          const newSourceBalance = sourceW.balance + totalTLRequired;
          const { error: sErr } = await supabase.from('wallets').update({ balance: newSourceBalance }).eq('id', sourceWalletId);
          if (sErr) throw sErr;

          await supabase.from('transactions').insert({
            user_id: userId,
            wallet_id: sourceWalletId,
            amount: totalTLRequired, // income
            description: `${targetWallet.name} Satışı İçin Giriş`,
            date: new Date().toISOString().split('T')[0],
            time_range: new Date().toTimeString().slice(0, 5),
          });
        }

        // 2. Update Target Wallet
        const newTargetBalance = targetWallet.balance - tradeAmount;
        const { error: tErr } = await supabase.from('wallets').update({ balance: newTargetBalance }).eq('id', targetWallet.id);
        if (tErr) throw tErr;

        // 3. Log Target Transaction
        const assetName = targetWallet.type === 'Altın' || targetWallet.type === 'Gümüş' ? 'Maden' : 'Döviz';
        await supabase.from('transactions').insert({
          user_id: userId,
          wallet_id: targetWallet.id,
          amount: -tradeAmount, // amount sold
          description: `${assetName} Satış (Kur: ${tradeRate})`,
          date: new Date().toISOString().split('T')[0],
          time_range: new Date().toTimeString().slice(0, 5),
        });
      }

      setAmount('');
      setShowForm(false);
      onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'İşlem gerçekleştirilirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleTargetWalletChange = (wid: string) => {
    setTargetWalletId(wid);
    const w = myWallets.find(x => x.id === wid);
    if (w) {
      setCustomRate(getRateForType(w.type, rates).toString());
    }
  };

  // Split live rates list
  const dovizRates = useMemo(() => currencyRates.filter(r => r.category === 'doviz'), [currencyRates]);
  const madenRates = useMemo(() => currencyRates.filter(r => r.category === 'maden'), [currencyRates]);
  const activeRates = activeCategory === 'doviz' ? dovizRates : madenRates;

  return (
    <div style={{ textAlign: 'left', paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Döviz &amp; Madenler</h2>
        {myWallets.length > 0 && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              width: 'auto',
              borderRadius: '8px',
            }}
          >
            {showForm ? 'İptal Et' : '+ İşlem Ekle'}
          </button>
        )}
      </div>

      {/* Transaction Modal (Inline) */}
      {showForm && (
        <div className="card" style={{ marginBottom: '20px', border: '1px solid var(--accent-color)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Döviz/Maden İşlemi</h3>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              className={`btn ${tradeType === 'AL' ? '' : 'outline'}`}
              style={{ flex: 1, backgroundColor: tradeType === 'AL' ? '#10b981' : '' }}
              onClick={() => setTradeType('AL')}
            >
              AL
            </button>
            <button
              className={`btn ${tradeType === 'SAT' ? '' : 'outline'}`}
              style={{ flex: 1, backgroundColor: tradeType === 'SAT' ? '#ef4444' : '' }}
              onClick={() => setTradeType('SAT')}
            >
              SAT
            </button>
          </div>

          <form onSubmit={handleTradeSubmit}>
            <div className="form-group">
              <label>İşlem Yapılacak Varlık</label>
              <select value={targetWalletId} onChange={(e) => handleTargetWalletChange(e.target.value)} required>
                <option value="" disabled>Seçiniz</option>
                {myWallets.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({formatNative(w.balance, w.type)})</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label>Miktar</label>
                <input
                  type="number"
                  step="any"
                  placeholder="Ör: 1.5"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label>İşlem Kuru</label>
                <input
                  type="number"
                  step="any"
                  placeholder="Kur fiyatı"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>{tradeType === 'AL' ? 'Ödemenin Çekileceği Hesap' : 'Paranın Yatacağı Hesap'}</label>
              <select value={sourceWalletId} onChange={(e) => setSourceWalletId(e.target.value)}>
                <option value="other">Diğer (Banka Dışı / Hediye)</option>
                {vadesizWallets.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({formatTL(w.balance)})</option>
                ))}
              </select>
            </div>

            {amount && customRate && (
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                textAlign: 'center',
                fontSize: '0.85rem'
              }}>
                Toplam Tutar: <strong style={{ color: 'var(--text-bright)', fontSize: '1rem' }}>{formatTL(parseFloat(amount) * parseFloat(customRate))}</strong>
              </div>
            )}

            {errorMsg && (
              <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '12px', textAlign: 'center' }}>
                {errorMsg}
              </div>
            )}

            <button type="submit" className="btn" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'İşleniyor...' : 'Onayla'}
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
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            Toplam TL Değeri
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-bright)', marginTop: '4px' }}>
            {formatTL(portfolio.totalTL, 0)}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
            {portfolio.items.length} hesap
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            Kur Bilgisi
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.8 }}>
            <span style={{ color: 'var(--text-bright)', fontWeight: 700 }}>${rates.USD.toFixed(2)}</span>
            <span style={{ marginLeft: 8, color: rates.USDChange >= 0 ? '#10b981' : '#ef4444', fontSize: '0.6rem' }}>
              {rates.USDChange >= 0 ? '▲' : '▼'}{Math.abs(rates.USDChange).toFixed(2)}%
            </span>
            <br />
            <span style={{ color: 'var(--text-bright)', fontWeight: 700 }}>€{rates.EUR.toFixed(2)}</span>
            <span style={{ marginLeft: 8, color: rates.EURChange >= 0 ? '#10b981' : '#ef4444', fontSize: '0.6rem' }}>
              {rates.EURChange >= 0 ? '▲' : '▼'}{Math.abs(rates.EURChange).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* My Holdings */}
      {portfolio.items.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '10px', paddingLeft: '4px', color: 'var(--text-bright)' }}>
            Varlıklarım
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
            {portfolio.items.map(w => {
              const isUp = w.profitLoss >= 0;
              return (
                <div
                  key={w.id}
                  className="tx-item"
                  style={{ cursor: 'default', background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.03)', padding: '10px 12px' }}
                >
                  <div className="tx-left" style={{ gap: '10px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '10px',
                      background: `${w.color}15`, border: `1px solid ${w.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1rem', flexShrink: 0,
                    }}>
                      {getWalletIcon(w.type)}
                    </div>
                    <div className="tx-details">
                      <span className="tx-description" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                        {w.name}
                      </span>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
                        {formatNative(w.balance, w.type)}
                      </div>
                      {w.averageCost > 0 && (
                        <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Maliyet: {formatTL(w.averageCost)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="tx-right" style={{ alignItems: 'flex-end' }}>
                    <span className="tx-amount" style={{ fontSize: '0.78rem', color: 'var(--text-bright)' }}>
                      {formatTL(w.tlVal, 0)}
                    </span>
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 700, marginTop: '2px',
                      color: isUp ? '#10b981' : '#ef4444',
                      display: 'flex', alignItems: 'center', gap: '2px',
                    }}>
                      {w.averageCost > 0 ? (
                        <>
                          {isUp ? <FiTrendingUp /> : <FiTrendingDown />}
                          Kâr: {isUp ? '+' : ''}{formatTL(w.profitLoss, 0)}
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Güncel: {formatTL(w.liveRate)}</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Live Rates Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '0.95rem', margin: 0, paddingLeft: '4px', color: 'var(--text-bright)' }}>
          Canlı Kurlar
        </h3>
      </div>

      {/* Category Tab Switch */}
      <div className="tab-switch" style={{ marginBottom: '14px' }}>
        <button
          type="button"
          className={`tab-switch-btn ${activeCategory === 'doviz' ? 'active' : ''}`}
          onClick={() => setActiveCategory('doviz')}
          style={{ fontSize: '0.8rem', padding: '8px 12px' }}
        >
          💱 Dövizler
        </button>
        <button
          type="button"
          className={`tab-switch-btn ${activeCategory === 'maden' ? 'active' : ''}`}
          onClick={() => setActiveCategory('maden')}
          style={{ fontSize: '0.8rem', padding: '8px 12px' }}
        >
          🪙 Madenler
        </button>
      </div>

      {/* Rates Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
        {activeRates.map(rate => {
          if (rate.sell === 0) return null;
          const isUp = rate.change >= 0;
          const isOwned = portfolio.items.some(w => {
            if (rate.walletType === 'Dolar' && w.type === 'Dolar') return true;
            if (rate.walletType === 'Euro'  && w.type === 'Euro')  return true;
            if (rate.walletType === 'Altın' && w.type === 'Altın') return true;
            if (rate.walletType === 'Gümüş' && w.type === 'Gümüş') return true;
            return false;
          });

          return (
            <div
              key={rate.key}
              className="tx-item"
              style={{
                cursor: 'default',
                background: isOwned ? 'rgba(59,130,246,0.04)' : 'rgba(255,255,255,0.01)',
                borderColor: isOwned ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                padding: '8px 12px',
              }}
            >
              <div className="tx-left" style={{ gap: '10px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.9rem', flexShrink: 0,
                }}>
                  {rate.flag}
                </div>
                <div className="tx-details">
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                    {rate.label}
                    {isOwned && (
                      <span style={{ marginLeft: 6, fontSize: '0.55rem', color: '#60a5fa', background: 'rgba(59,130,246,0.15)', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                        SAHİBİM
                      </span>
                    )}
                  </span>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '1px', fontWeight: 600 }}>
                    Alış: {formatTL(rate.buy, 4)}
                  </div>
                </div>
              </div>
              <div className="tx-right" style={{ alignItems: 'flex-end' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-bright)' }}>
                  {formatTL(rate.sell, 4)}
                </span>
                <span style={{
                  fontSize: '0.6rem', fontWeight: 700, marginTop: '2px',
                  color: isUp ? '#10b981' : '#ef4444',
                  display: 'flex', alignItems: 'center', gap: '2px',
                }}>
                  {isUp ? '▲' : '▼'} {Math.abs(rate.change).toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
