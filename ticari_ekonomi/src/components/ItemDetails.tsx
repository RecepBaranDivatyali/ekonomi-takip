import React, { useMemo } from 'react';
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
  if (type === 'Altın' || type === 'Gümüş') {
    return `${Number(val).toFixed(2)} gr`;
  }
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(val);
};

// ==================== WALLET DETAILS ====================
interface WalletDetailsProps {
  walletId: string;
  wallets: Wallet[];
  transactions: Transaction[];
  categories: Category[];
  tags: Tag[];
  onBack: () => void;
}

export const WalletDetails: React.FC<WalletDetailsProps> = ({
  walletId,
  wallets,
  transactions,
  categories,
  tags,
  onBack,
}) => {
  const wallet = wallets.find((w) => w.id === walletId);
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  if (!wallet) {
    return (
      <div style={{ textAlign: 'center', padding: '24px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Cüzdan bulunamadı.</p>
        <button onClick={onBack} className="btn">Geri Dön</button>
      </div>
    );
  }

  // Filter transactions for this wallet
  const walletTx = useMemo(() => {
    return transactions
      .filter((tx) => tx.wallet_id === wallet.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, wallet.id]);

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
    return Object.values(dataMap);
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
    return Object.values(dataMap);
  }, [walletTx, categories, wallets]);

  // Reconstruct Daily Ending Balance Timeline
  const timelineData = useMemo(() => {
    // 1. Group daily net changes by raw date "YYYY-MM-DD"
    const dailyChanges: { [dateStr: string]: number } = {};
    walletTx.forEach((tx) => {
      const cat = resolveTxCategory(tx, categories, wallets);
      const isIncome = cat.type === 'Gelir';
      const amt = Number(tx.amount);
      const change = isIncome ? amt : -amt;
      
      const dateStr = tx.date; // "YYYY-MM-DD"
      dailyChanges[dateStr] = (dailyChanges[dateStr] || 0) + change;
    });

    // 2. Sort dates in descending order (newest first) to step back in time
    const sortedDates = Object.keys(dailyChanges).sort((a, b) => b.localeCompare(a));

    // 3. Reconstruct balances backwards starting from current wallet.balance
    let bal = Number(wallet.balance);
    const points: { date: string; balance: number }[] = [];

    // Push the current balance as 'Şimdi'
    points.push({
      date: 'Şimdi',
      balance: bal
    });

    sortedDates.forEach((dateStr) => {
      const change = dailyChanges[dateStr];
      const label = new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      
      points.push({
        date: label,
        balance: Number(bal.toFixed(2))
      });
      
      // Step backwards: subtract this day's net change to find the balance at the end of the previous day
      bal -= change;
    });

    // Add starting point showing the balance prior to the oldest recorded day
    if (sortedDates.length > 0) {
      const oldestDateStr = sortedDates[sortedDates.length - 1];
      const oldestDate = new Date(oldestDateStr);
      oldestDate.setDate(oldestDate.getDate() - 1);
      const prevLabel = oldestDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      points.push({
        date: prevLabel,
        balance: Number(bal.toFixed(2))
      });
    }

    return points.reverse(); // chronological (oldest to newest)
  }, [walletTx, wallet.balance, categories, wallets]);

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
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{wallet.name}</span>
          <span style={{ fontSize: '0.62rem', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
            {wallet.type === 'Kredi_Karti' ? 'Kredi Kartı' : wallet.type}
          </span>
        </h3>
        <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>
          {formatCurrency(wallet.balance, wallet.type)}
        </h2>
        {wallet.type === 'Kredi_Karti' && (
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            <span>Limit: {formatCurrency(wallet.credit_limit || 0, 'Vadesiz')}</span>
            <span>Son Ödeme: Ayın {wallet.due_date || 15}'i</span>
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
                formatter={(value: any) => formatCurrency(Number(value), wallet.type)}
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

      {/* Gelir / Gider Dağılımları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* Expense Distribution */}
        <div className="card muted" style={{ minHeight: '200px', padding: '12px' }}>
          <div className="card-title" style={{ textAlign: 'center', marginBottom: '10px', fontSize: '0.85rem' }}>Gider Dağılımı</div>
          {expensePieData.length > 0 ? (
            <div style={{ width: '100%', height: '130px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expensePieData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={2} dataKey="value">
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '6px', fontSize: '0.62rem' }}>
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

        {/* Income Distribution */}
        <div className="card muted" style={{ minHeight: '200px', padding: '12px' }}>
          <div className="card-title" style={{ textAlign: 'center', marginBottom: '10px', fontSize: '0.85rem' }}>Gelir Dağılımı</div>
          {incomePieData.length > 0 ? (
            <div style={{ width: '100%', height: '130px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={incomePieData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={2} dataKey="value">
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '6px', fontSize: '0.62rem' }}>
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
    return Object.values(dataMap);
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
            <div style={{ width: '100%', height: '180px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={walletPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={60} paddingAngle={2} dataKey="value">
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
    return Object.values(dataMap);
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
    return Object.values(dataMap);
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
            <div style={{ width: '100%', height: '130px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={walletPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={2} dataKey="value">
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '6px', fontSize: '0.62rem' }}>
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
            <div style={{ width: '100%', height: '130px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={2} dataKey="value">
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '6px', fontSize: '0.62rem' }}>
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
