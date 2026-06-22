import React from 'react';
import { FiTrendingUp, FiTrendingDown, FiLogOut } from 'react-icons/fi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { ExchangeRates } from '../services/currencyService';

interface Wallet {
  id: string;
  name: string;
  type: 'Vadesiz' | 'Vadeli' | 'Dolar' | 'Euro' | 'Altın' | 'Gümüş' | 'Borsa_TRY' | 'Borsa_USD';
  color: string;
  balance: number;
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
}

interface DashboardProps {
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  selectedWalletId: string;
  setSelectedWalletId: (id: string) => void;
  onSignOut: () => void;
  rates: ExchangeRates;
  tags: Tag[];
  userEmail?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({
  wallets,
  categories,
  transactions,
  selectedWalletId,
  setSelectedWalletId,
  onSignOut,
  rates,
  tags,
  userEmail,
}) => {
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);

  // Categories mapping
  const categoryMap = React.useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  // Wallets mapping
  const walletMap = React.useMemo(() => {
    return new Map(wallets.map((w) => [w.id, w]));
  }, [wallets]);

  // Tags mapping
  const tagMap = React.useMemo(() => {
    return new Map(tags.map((t) => [t.id, t]));
  }, [tags]);

  // Active wallet if selected
  const activeWallet = React.useMemo(() => {
    if (selectedWalletId === 'all') return null;
    return wallets.find((w) => w.id === selectedWalletId) || null;
  }, [wallets, selectedWalletId]);

  // Filter transactions based on selected wallet
  const filteredTransactions = React.useMemo(() => {
    if (selectedWalletId === 'all') {
      return transactions;
    }
    return transactions.filter((t) => t.wallet_id === selectedWalletId);
  }, [transactions, selectedWalletId]);

  // Dynamic currency format helper
  const formatCurrency = React.useCallback((val: number, type: 'Vadesiz' | 'Vadeli' | 'Dolar' | 'Euro' | 'Altın' | 'Gümüş' | 'Borsa_TRY' | 'Borsa_USD' = 'Vadesiz') => {
    if (type === 'Dolar' || type === 'Borsa_USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(val);
    }
    if (type === 'Euro') {
      return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(val);
    }
    if (type === 'Altın') {
      return `${Number(val).toFixed(2)} gr`;
    }
    if (type === 'Gümüş') {
      return `${Number(val).toFixed(2)} gr`;
    }
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val);
  }, []);

  // Calculate current balances
  const displayBalanceStr = React.useMemo(() => {
    if (selectedWalletId === 'all') {
      const sum = wallets.reduce((total, w) => {
        const bal = Number(w.balance);
        if (w.type === 'Dolar' || w.type === 'Borsa_USD') return total + bal * rates.USD;
        if (w.type === 'Euro') return total + bal * rates.EUR;
        if (w.type === 'Altın') return total + bal * rates.Altın;
        if (w.type === 'Gümüş') return total + bal * rates.Gümüş;
        return total + bal;
      }, 0);
      return formatCurrency(sum, 'Vadesiz');
    }
    return activeWallet ? formatCurrency(Number(activeWallet.balance), activeWallet.type) : '₺0';
  }, [wallets, activeWallet, selectedWalletId, formatCurrency, rates]);

  // Calculate monthly income/expense totals for current filter
  const { incomeTotal, expenseTotal } = React.useMemo(() => {
    let inc = 0;
    let exp = 0;
    filteredTransactions.forEach((tx) => {
      const cat = categoryMap.get(tx.category_id);
      const isIncome = cat ? cat.type === 'Gelir' : false;
      const txWallet = walletMap.get(tx.wallet_id);
      let amt = Number(tx.amount);

      // Convert to TRY if viewing all accounts consolidated
      if (selectedWalletId === 'all' && txWallet) {
        if (txWallet.type === 'Dolar' || txWallet.type === 'Borsa_USD') amt *= rates.USD;
        else if (txWallet.type === 'Euro') amt *= rates.EUR;
        else if (txWallet.type === 'Altın') amt *= rates.Altın;
        else if (txWallet.type === 'Gümüş') amt *= rates.Gümüş;
      }

      if (isIncome) {
        inc += amt;
      } else {
        exp += amt;
      }
    });
    return { incomeTotal: inc, expenseTotal: exp };
  }, [filteredTransactions, categoryMap, walletMap, selectedWalletId, rates]);

  // Recharts Chart Data (Expenses by Category)
  const chartData = React.useMemo(() => {
    const expenseByCat: { [key: string]: { value: number; name: string; color: string } } = {};

    filteredTransactions.forEach((tx) => {
      const cat = categoryMap.get(tx.category_id);
      const isExpense = cat ? cat.type === 'Gider' : true;
      if (isExpense && cat) {
        let amt = Number(tx.amount);

        // Convert to TRY if viewing all accounts consolidated
        const txWallet = walletMap.get(tx.wallet_id);
        if (selectedWalletId === 'all' && txWallet) {
          if (txWallet.type === 'Dolar' || txWallet.type === 'Borsa_USD') amt *= rates.USD;
          else if (txWallet.type === 'Euro') amt *= rates.EUR;
          else if (txWallet.type === 'Altın') amt *= rates.Altın;
          else if (txWallet.type === 'Gümüş') amt *= rates.Gümüş;
        }

        if (expenseByCat[cat.id]) {
          expenseByCat[cat.id].value += amt;
        } else {
          expenseByCat[cat.id] = {
            value: amt,
            name: `${cat.emoji} ${cat.name}`,
            color: cat.color,
          };
        }
      }
    });

    return Object.values(expenseByCat);
  }, [filteredTransactions, categoryMap, walletMap, selectedWalletId, rates]);

  // Recent 3 transactions
  const recentTransactions = React.useMemo(() => {
    return [...filteredTransactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
  }, [filteredTransactions]);

  const getWalletIcon = (walletType: 'Vadesiz' | 'Vadeli' | 'Dolar' | 'Euro' | 'Altın' | 'Gümüş' | 'Borsa_TRY' | 'Borsa_USD') => {
    switch (walletType) {
      case 'Dolar': return '$';
      case 'Euro': return '€';
      case 'Altın': return '🪙';
      case 'Gümüş': return '🥈';
      case 'Vadeli': return '🏦';
      case 'Borsa_TRY':
      case 'Borsa_USD': return '📈';
      default: return '💵';
    }
  };

  return (
    <div>
      {/* Top Header Row with Profile */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 4px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Ekonomi Takip
        </h2>
        
        {/* Profile Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.1rem',
              color: 'var(--text-bright)',
              transition: 'all 0.2s',
            }}
          >
            👤
          </button>
          
          {showProfileMenu && (
            <>
              {/* Backdrop overlay to close when clicking outside */}
              <div 
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }}
                onClick={() => setShowProfileMenu(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '42px',
                  right: 0,
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  padding: '12px',
                  width: '200px',
                  zIndex: 100,
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Kullanıcı
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-bright)', fontWeight: 600, wordBreak: 'break-all', marginBottom: '12px' }}>
                  {userEmail || 'Giriş yapılmış'}
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '8px 0' }} />
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onSignOut();
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                >
                  <FiLogOut />
                  <span>Oturumu Kapat</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Wallet Selector Row */}
      <div className="wallet-scroll">
        <div
          className={`wallet-pill ${selectedWalletId === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedWalletId('all')}
        >
          <div className="wallet-dot" style={{ backgroundColor: '#a8a29e' }} />
          <span>Tüm Hesaplar</span>
        </div>
        {wallets.map((w) => (
          <div
            key={w.id}
            className={`wallet-pill ${selectedWalletId === w.id ? 'active' : ''}`}
            onClick={() => setSelectedWalletId(w.id)}
          >
            <div className="wallet-dot" style={{ backgroundColor: w.color }} />
            <span>{w.name} ({getWalletIcon(w.type)})</span>
          </div>
        ))}
      </div>

      {/* Main Balance Header */}
      <div className="dashboard-header">
        <div className="total-balance-title">
          {selectedWalletId === 'all' ? 'Toplam Varlık' : `${activeWallet?.name} Bakiyesi`}
        </div>
        <div className="total-balance-amount">{displayBalanceStr}</div>

        <div className="balance-flow-row">
          <div className="flow-pill income">
            <FiTrendingUp />
            <span>{formatCurrency(incomeTotal, activeWallet?.type)}</span>
          </div>
          <div className="flow-pill expense">
            <FiTrendingDown />
            <span>{formatCurrency(expenseTotal, activeWallet?.type)}</span>
          </div>
        </div>
      </div>

      {/* Live Rates Ticker */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '6px',
        marginBottom: '16px',
      }}>
        {[
          { label: 'Dolar', symbol: '$', value: rates.USD, change: rates.USDChange, decimals: 2 },
          { label: 'Euro', symbol: '€', value: rates.EUR, change: rates.EURChange, decimals: 2 },
          { label: 'Altın', symbol: '₺', value: rates.Altın, change: rates.AltınChange, decimals: 0 },
          { label: 'Gümüş', symbol: '₺', value: rates.Gümüş, change: rates.GümüşChange, decimals: 2 },
        ].map((item) => {
          const isUp = item.change >= 0;
          return (
            <div key={item.label} style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '10px',
              padding: '8px 6px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-bright)' }}>
                {item.symbol}{item.value.toLocaleString('tr-TR', { minimumFractionDigits: item.decimals, maximumFractionDigits: item.decimals })}
              </div>
              <div style={{
                fontSize: '0.55rem',
                fontWeight: 700,
                color: isUp ? '#10b981' : '#ef4444',
                marginTop: '2px',
              }}>
                {isUp ? '▲' : '▼'} {Math.abs(item.change).toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="card muted" style={{ minHeight: '260px', padding: '14px 10px 10px 10px' }}>
        <div className="card-title" style={{ textAlign: 'center', marginBottom: '8px' }}>
          Gider Dağılımı
        </div>
        {chartData.length > 0 ? (
          <div style={{ width: '100%', height: '180px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => formatCurrency(Number(value), activeWallet?.type)}
                  contentStyle={{
                    background: '#121826',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text inside Donut */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                TOPLAM GİDER
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-bright)' }}>
                {formatCurrency(expenseTotal, activeWallet?.type)}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              height: '180px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              fontWeight: 500,
            }}
          >
            Henüz bu hesapta gider işlemi bulunmuyor.
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <h3 style={{ fontSize: '1rem', textAlign: 'left', marginBottom: '12px', paddingLeft: '4px' }}>
        Son İşlemler
      </h3>
      <div className="tx-feed">
        {recentTransactions.length > 0 ? (
          recentTransactions.map((tx) => {
            const cat = categoryMap.get(tx.category_id);
            const txWallet = walletMap.get(tx.wallet_id);
            return (
              <div key={tx.id} className="tx-item" style={{ cursor: 'default' }}>
                <div className="tx-left">
                  <div
                    className="badge-category"
                    style={{
                      backgroundColor: `${cat?.color || '#64748b'}15`,
                      color: cat?.color || '#64748b',
                      borderColor: `${cat?.color || '#64748b'}30`,
                    }}
                  >
                    <span>{cat?.emoji || '🪙'}</span>
                    <span>{cat?.name || 'Diğer'}</span>
                  </div>
                  <div className="tx-details">
                    <span className="tx-description">{tx.description || 'Açıklama yok'}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                      <span className="tx-date">
                        {new Date(tx.date).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'long',
                        })}
                      </span>
                      <span style={{ fontSize: '0.62rem', color: txWallet?.color, fontWeight: 700, textTransform: 'uppercase' }}>
                        • {txWallet?.name || 'Hesap'}
                      </span>
                      {tx.tag_id && tagMap.get(tx.tag_id) && (() => {
                        const tag = tagMap.get(tx.tag_id)!;
                        return (
                          <>
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>•</span>
                            <span
                              style={{
                                fontSize: '0.62rem',
                                backgroundColor: `${tag.color}15`,
                                color: tag.color,
                                borderColor: `${tag.color}30`,
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                              }}
                            >
                              <span>{tag.emoji}</span>
                              <span>{tag.name}</span>
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <div className="tx-right">
                  <span
                    className={`tx-amount ${cat?.type === 'Gelir' ? 'gelir' : 'gider'}`}
                  >
                    {cat?.type === 'Gelir' ? '+' : '-'}
                    {formatCurrency(Number(tx.amount), txWallet?.type)}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div
            style={{
              padding: '24px 0',
              textAlign: 'center',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            İşlem geçmişi temiz.
          </div>
        )}
      </div>
    </div>
  );
};
