import React, { useState, useMemo } from 'react';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import type { ExchangeRates, CurrencyRate } from '../services/currencyService';

interface Wallet {
  id: string;
  name: string;
  type: 'Vadesiz' | 'Vadeli' | 'Dolar' | 'Euro' | 'Altın' | 'Gümüş' | 'Borsa_TRY' | 'Borsa_USD';
  color: string;
  balance: number;
}

interface DovizMadenProps {
  wallets: Wallet[];
  rates: ExchangeRates;
  currencyRates: CurrencyRate[];
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

export const DovizMaden: React.FC<DovizMadenProps> = ({ wallets, rates, currencyRates }) => {
  const [activeCategory, setActiveCategory] = useState<'doviz' | 'maden'>('doviz');

  // Only Dolar / Euro / Altın / Gümüş wallets
  const myWallets = useMemo(
    () => wallets.filter(w => DOVIZ_TYPES.includes(w.type)),
    [wallets]
  );

  // Portfolio totals
  const portfolio = useMemo(() => {
    let totalTL = 0;
    const items = myWallets.map(w => {
      const rate   = getRateForType(w.type, rates);
      const change = getChangeForType(w.type, rates);
      const tlVal  = w.balance * rate;
      totalTL     += tlVal;
      return { ...w, rate, change, tlVal };
    });
    return { items, totalTL };
  }, [myWallets, rates]);

  // Split live rates list
  const dovizRates = useMemo(() => currencyRates.filter(r => r.category === 'doviz'), [currencyRates]);
  const madenRates = useMemo(() => currencyRates.filter(r => r.category === 'maden'), [currencyRates]);
  const activeRates = activeCategory === 'doviz' ? dovizRates : madenRates;

  return (
    <div style={{ textAlign: 'left' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Döviz &amp; Madenler</h2>
      </div>

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
              const isUp = w.change >= 0;
              return (
                <div
                  key={w.id}
                  className="tx-item"
                  style={{ cursor: 'default', background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.03)', padding: '10px 12px' }}
                >
                  <div className="tx-left" style={{ gap: '10px' }}>
                    {/* Flag badge */}
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
                        <span style={{ margin: '0 6px' }}>•</span>
                        {formatTL(w.rate, 2)} / birim
                      </div>
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
                      {isUp ? <FiTrendingUp /> : <FiTrendingDown />}
                      {isUp ? '+' : ''}{w.change.toFixed(2)}%
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
          // highlight rows that match user's wallets
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
