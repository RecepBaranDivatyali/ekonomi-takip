import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { FiPlus, FiTrash2, FiClock, FiAlertCircle } from 'react-icons/fi';

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

interface Tag {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface TransactionsProps {
  wallets: Wallet[];
  categories: Category[];
  tags: Tag[];
  transactions: Transaction[];
  onRefreshData: () => void;
  userId: string;
}

export const Transactions: React.FC<TransactionsProps> = ({
  wallets,
  categories,
  tags,
  transactions,
  onRefreshData,
  userId,
}) => {
  // Form States
  const [txType, setTxType] = useState<'Gelir' | 'Gider'>('Gider');
  const [walletId, setWalletId] = useState(wallets[0]?.id || '');
  const [categoryId, setCategoryId] = useState('');
  const [tagId, setTagId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // UI States
  const [activeTxId, setActiveTxId] = useState<string | null>(null); // For click-to-reveal action row

  // Filter categories based on transaction type (Income vs Expense)
  const filteredCategories = React.useMemo(() => {
    return categories.filter((c) => c.type === txType);
  }, [categories, txType]);

  // Set default category when type changes
  React.useEffect(() => {
    if (filteredCategories.length > 0) {
      setCategoryId(filteredCategories[0].id);
    } else {
      setCategoryId('');
    }
  }, [filteredCategories]);

  // Ensure selected wallet defaults correctly if wallets load after initial render
  React.useEffect(() => {
    if (!walletId && wallets.length > 0) {
      setWalletId(wallets[0].id);
    }
  }, [wallets, walletId]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setErrorMsg('Lütfen geçerli bir tutar girin.');
      return;
    }
    if (!walletId) {
      setErrorMsg('Lütfen bir cüzdan seçin. Eğer cüzdan yoksa Cüzdanlar sekmesinden ekleyin.');
      return;
    }
    if (!categoryId) {
      setErrorMsg('Lütfen bir kategori seçin.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const selectedWallet = wallets.find((w) => w.id === walletId);
      if (!selectedWallet) throw new Error('Cüzdan bulunamadı.');

      const numAmount = Number(amount);

      // 1. Insert transaction into Supabase
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: userId,
        wallet_id: walletId,
        category_id: categoryId,
        tag_id: tagId || null,
        amount: numAmount,
        description: description.trim(),
        date,
        time_range: time,
      });

      if (txError) throw txError;

      // 2. Adjust wallet balance in the DB
      const balanceChange = txType === 'Gelir' ? numAmount : -numAmount;
      const newBalance = Number(selectedWallet.balance) + balanceChange;

      const { error: walletError } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', walletId);

      if (walletError) throw walletError;

      // Reset form
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setTime(() => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      });
      setTagId('');
      setShowAddForm(false);
      onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'İşlem eklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (tx: Transaction) => {
    if (!window.confirm('Bu işlemi silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      // Find category type
      const cat = categories.find((c) => c.id === tx.category_id);
      const isIncome = cat ? cat.type === 'Gelir' : false;

      // Find wallet
      const wallet = wallets.find((w) => w.id === tx.wallet_id);
      if (wallet) {
        // Reverse balance change
        const balanceChange = isIncome ? -Number(tx.amount) : Number(tx.amount);
        const newBalance = Number(wallet.balance) + balanceChange;

        // 1. Update wallet balance
        const { error: walletError } = await supabase
          .from('wallets')
          .update({ balance: newBalance })
          .eq('id', tx.wallet_id);

        if (walletError) throw walletError;
      }

      // 2. Delete transaction from DB
      const { error: txError } = await supabase.from('transactions').delete().eq('id', tx.id);
      if (txError) throw txError;

      setActiveTxId(null);
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'İşlem silinirken hata oluştu.');
    }
  };

  const formatWalletBalance = (val: number, type?: 'Vadesiz' | 'Vadeli' | 'Dolar' | 'Euro' | 'Altın' | 'Gümüş' | 'Borsa_TRY' | 'Borsa_USD') => {
    if (type === 'Dolar') {
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
      return `${Number(val).toFixed(2)} gr (Altın)`;
    }
    if (type === 'Gümüş') {
      return `${Number(val).toFixed(2)} gr (Gümüş)`;
    }
    if (type === 'Borsa_TRY') {
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(val) + ' (Borsa)';
    }
    if (type === 'Borsa_USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(val) + ' (Borsa)';
    }
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Maps
  const categoryMap = React.useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const walletMap = React.useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);
  const tagMap = React.useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  // Sort transactions by date descending
  const sortedTransactions = React.useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  // Active wallet type
  const activeWallet = React.useMemo(() => {
    return wallets.find((w) => w.id === walletId);
  }, [wallets, walletId]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0, textAlign: 'left' }}>
          İşlemler
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn"
          style={{
            padding: '6px 12px',
            fontSize: '0.8rem',
            width: 'auto',
            margin: 0,
            background: showAddForm ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
            borderColor: showAddForm ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)',
            color: showAddForm ? '#f87171' : '#60a5fa',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            borderRadius: '8px',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          {showAddForm ? 'Kapat' : '+ Yeni İşlem'}
        </button>
      </div>

      {errorMsg && (
        <div className="toast error" style={{ position: 'static', marginBottom: '16px' }}>
          <FiAlertCircle />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Add Transaction Card */}
      {showAddForm && (
        <>
          {/* Transaction Type Tab Switcher */}
          <div className="tab-switch" style={{ marginBottom: '16px' }}>
            <button
              type="button"
              className={`tab-switch-btn ${txType === 'Gider' ? 'active gider' : ''}`}
              onClick={() => setTxType('Gider')}
            >
              Gider
            </button>
            <button
              type="button"
              className={`tab-switch-btn ${txType === 'Gelir' ? 'active gelir' : ''}`}
              onClick={() => setTxType('Gelir')}
            >
              Gelir
            </button>
          </div>

          <div className="card muted" style={{ textAlign: 'left', marginBottom: '24px' }}>
            <div className="card-title" style={{ marginBottom: '14px' }}>
              Yeni {txType} Ekle
            </div>
            <form onSubmit={handleAddTransaction}>
              <div className="form-group">
                <label className="form-label">
                  Tutar {activeWallet ? `(${activeWallet.type === 'Altın' || activeWallet.type === 'Gümüş' ? 'Gram' : activeWallet.type === 'Dolar' || activeWallet.type === 'Borsa_USD' ? '$' : activeWallet.type === 'Euro' ? '€' : '₺'})` : ''}
                </label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Cüzdan / Hesap</label>
                <select
                  className="form-control"
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  required
                  style={{ background: '#121826' }}
                >
                  {wallets.length === 0 ? (
                    <option value="">Lütfen cüzdan oluşturun...</option>
                  ) : (
                    wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} [{w.type}] ({formatWalletBalance(Number(w.balance), w.type)})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Kategori Seçin</label>
                {filteredCategories.length > 0 ? (
                  <div className="emoji-radio-grid">
                    {filteredCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        className={`emoji-radio-btn ${categoryId === cat.id ? 'selected' : ''}`}
                        onClick={() => setCategoryId(cat.id)}
                        title={cat.name}
                        style={{ borderColor: categoryId === cat.id ? cat.color : 'rgba(255, 255, 255, 0.05)' }}
                      >
                        <span>{cat.emoji}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Henüz bu tipte bir kategori bulunmuyor. Kategoriler sekmesinden ekleyebilirsiniz.
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Açıklama</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Örn: Market alışverişi, Maaş, Kira vb."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Etiket (İsteğe Bağlı)</label>
                <select
                  className="form-control"
                  value={tagId}
                  onChange={(e) => setTagId(e.target.value)}
                  style={{ background: '#121826' }}
                >
                  <option value="">Etiket Yok</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.emoji} {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Tarih</label>
                  <input
                    type="date"
                    className="form-control"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Saat</label>
                  <input
                    type="time"
                    className="form-control"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ marginTop: '8px' }}
                disabled={loading}
              >
                <FiPlus />
                <span>{loading ? 'Ekleniyor...' : 'İşlem Ekle'}</span>
              </button>
            </form>
          </div>
        </>
      )}

      {/* Transactions List */}
      <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', textAlign: 'left' }}>
        İşlem Geçmişi
      </h2>

      <div className="tx-feed">
        {sortedTransactions.length > 0 ? (
          sortedTransactions.map((tx) => {
            const cat = categoryMap.get(tx.category_id);
            const w = walletMap.get(tx.wallet_id);
            const isActive = activeTxId === tx.id;

            return (
              <div
                key={tx.id}
                className="tx-item"
                style={{
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  borderColor: isActive ? 'var(--border-hover)' : 'var(--border-color)',
                }}
                onClick={() => setActiveTxId(isActive ? null : tx.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                        <span
                          style={{
                            fontSize: '0.62rem',
                            color: w?.color || 'var(--text-muted)',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          • {w?.name || 'Bilinmeyen Cüzdan'}
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
                      {formatWalletBalance(Number(tx.amount), w?.type)}
                    </span>
                  </div>
                </div>

                {/* Click-to-reveal Action Row */}
                {isActive && (
                  <div className="item-actions">
                    <div
                      style={{
                        marginRight: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.68rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <FiClock />
                      <span>{tx.time_range}</span>
                    </div>
                    <button
                      type="button"
                      className="circle-action-btn delete"
                      onClick={(e) => {
                        e.stopPropagation(); // Avoid closing action bar on click
                        handleDeleteTransaction(tx);
                      }}
                      title="İşlemi Sil"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div
            style={{
              padding: '32px 0',
              textAlign: 'center',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            Henüz bir işlem kaydedilmedi.
          </div>
        )}
      </div>
    </div>
  );
};
