import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { FiPlus, FiTrash2, FiCheck, FiAlertCircle } from 'react-icons/fi';

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

interface Debt {
  id: string;
  wallet_id: string;
  category_id: string | null;
  type: 'Alınacak' | 'Verilecek';
  amount: number;
  name: string;
  due_date: string | null;
  status: 'Bekliyor' | 'Ödendi';
  created_at: string;
}

interface DebtsProps {
  wallets: Wallet[];
  categories: Category[];
  debts: Debt[];
  onRefreshData: () => void;
  userId: string;
}

export const Debts: React.FC<DebtsProps> = ({
  wallets,
  categories,
  debts,
  onRefreshData,
  userId,
}) => {
  // Form States
  const [name, setName] = useState('');
  const [debtType, setDebtType] = useState<'Alınacak' | 'Verilecek'>('Alınacak');
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState(wallets[0]?.id || '');
  const [categoryId, setCategoryId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // UI States
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);

  // Ensure default wallet is set
  React.useEffect(() => {
    if (!walletId && wallets.length > 0) {
      setWalletId(wallets[0].id);
    }
  }, [wallets, walletId]);

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount || Number(amount) <= 0 || !walletId) {
      setErrorMsg('Lütfen isim, miktar ve cüzdan bilgilerini eksiksiz doldurun.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.from('debts').insert({
        user_id: userId,
        wallet_id: walletId,
        category_id: categoryId || null,
        type: debtType,
        amount: Number(amount),
        name: name.trim(),
        due_date: dueDate || null,
        status: 'Bekliyor',
      });

      if (error) throw error;

      // Reset form
      setName('');
      setAmount('');
      setDueDate('');
      setShowAddForm(false);
      onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Borç kaydı eklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (debt: Debt) => {
    if (!window.confirm('Bu borcun ödendiğini ve cüzdan bakiyenizin güncellenmesini onaylıyor musunuz?')) {
      return;
    }

    try {
      // Find wallet
      const wallet = wallets.find((w) => w.id === debt.wallet_id);
      if (!wallet) throw new Error('İlişkili cüzdan bulunamadı.');

      // Calculate balance update
      // Alınacak (someone paid you) -> wallet increases
      // Verilecek (you paid someone) -> wallet decreases
      const numAmount = Number(debt.amount);
      const balanceChange = debt.type === 'Alınacak' ? numAmount : -numAmount;
      const newBalance = Number(wallet.balance) + balanceChange;

      // 1. Update wallet balance
      const { error: walletError } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', debt.wallet_id);

      if (walletError) throw walletError;

      // 2. Insert transaction log automatically for history
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: userId,
        wallet_id: debt.wallet_id,
        category_id: debt.category_id || null,
        amount: numAmount,
        description: `${debt.name} - Borç Kapanışı (${debt.type})`,
        date: new Date().toISOString().split('T')[0],
      });

      if (txError) throw txError;

      // 3. Mark debt as Paid
      const { error: debtError } = await supabase
        .from('debts')
        .update({ status: 'Ödendi' })
        .eq('id', debt.id);

      if (debtError) throw debtError;

      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Hata oluştu.');
    }
  };

  const handleDeleteDebt = async (id: string) => {
    if (!window.confirm('Bu borç kaydını silmek istediğinize emin misiniz? (Cüzdan bakiyesi etkilenmez)')) {
      return;
    }

    try {
      const { error } = await supabase.from('debts').delete().eq('id', id);
      if (error) throw error;
      setExpandedDebtId(null);
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Borç silinirken hata oluştu.');
    }
  };

  const formatWalletBalance = (val: number, type?: 'Vadesiz' | 'Vadeli' | 'Dolar' | 'Euro' | 'Altın' | 'Gümüş' | 'Borsa_TRY' | 'Borsa_USD' | 'Kredi_Karti') => {
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
  const walletMap = React.useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);
  const categoryMap = React.useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Active wallet type
  const activeWallet = React.useMemo(() => {
    return wallets.find((w) => w.id === walletId);
  }, [wallets, walletId]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0, textAlign: 'left' }}>
          Gelecek İşlemler
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
          {showAddForm ? 'Kapat' : '+ Yeni Kayıt'}
        </button>
      </div>

      {errorMsg && (
        <div className="toast error" style={{ position: 'static', marginBottom: '16px' }}>
          <FiAlertCircle />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Debt List */}
      <div style={{ marginBottom: '24px' }}>
        {debts.length > 0 ? (
          debts.map((debt) => {
            const isExpanded = expandedDebtId === debt.id;
            const w = walletMap.get(debt.wallet_id);
            const cat = debt.category_id ? categoryMap.get(debt.category_id) : null;
            const isReceivable = debt.type === 'Alınacak';

            return (
              <div key={debt.id} className="debt-card">
                {/* Header */}
                <div
                  className="debt-header"
                  onClick={() => setExpandedDebtId(isExpanded ? null : debt.id)}
                >
                  <div className="debt-header-left">
                    <div className={`debt-avatar ${isReceivable ? 'receivable' : 'payable'}`}>
                      {isReceivable ? 'A' : 'V'}
                    </div>
                    <div className="debt-header-info">
                      <span className="debt-person">{debt.name}</span>
                      {debt.due_date && (
                        <span className="debt-due">
                          Vade: {new Date(debt.due_date).toLocaleDateString('tr-TR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="debt-header-right">
                    <span className={`debt-amount ${isReceivable ? 'receivable' : 'payable'}`}>
                      {isReceivable ? '+' : '-'}
                      {formatWalletBalance(Number(debt.amount), w?.type)}
                    </span>
                    <span className={`debt-badge ${debt.status === 'Ödendi' ? 'paid' : 'pending'}`}>
                      {debt.status === 'Ödendi' ? 'Ödendi' : 'Bekliyor'}
                    </span>
                  </div>
                </div>

                {/* Details Accordion */}
                {isExpanded && (
                  <div className="debt-body">
                    <div className="debt-row">
                      <span>Tür:</span>
                      <span>{debt.type === 'Verilecek' ? 'Gider' : 'Gelir'}</span>
                    </div>
                    <div className="debt-row">
                      <span>İlişkili Hesap:</span>
                      <span style={{ color: w?.color }}>{w?.name || 'Belirtilmemiş'} ({w?.type})</span>
                    </div>
                    {cat && (
                      <div className="debt-row">
                        <span>Kategori:</span>
                        <span>
                          {cat.emoji} {cat.name}
                        </span>
                      </div>
                    )}
                    <div className="debt-row">
                      <span>Kayıt Tarihi:</span>
                      <span>{new Date(debt.created_at).toLocaleDateString('tr-TR')}</span>
                    </div>

                    {/* Action buttons inside details */}
                    <div className="item-actions" style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                      {debt.status === 'Bekliyor' && (
                        <button
                          type="button"
                          className="circle-action-btn"
                          onClick={() => handleMarkAsPaid(debt)}
                          style={{
                            width: 'auto',
                            padding: '4px 12px',
                            borderRadius: '8px',
                            color: 'var(--success)',
                            borderColor: 'rgba(16, 185, 129, 0.2)',
                            background: 'var(--success-glow)',
                            display: 'flex',
                            gap: '4px',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        >
                          <FiCheck />
                          <span>Ödendi Yap</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="circle-action-btn delete"
                        onClick={() => handleDeleteDebt(debt.id)}
                        title="Sil"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                )}
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
            Aktif borç veya alacak kaydı bulunmuyor.
          </div>
        )}
      </div>

      {/* Add Debt Card */}
      {showAddForm && (
        <div className="card muted" style={{ textAlign: 'left' }}>
          <div className="card-title" style={{ marginBottom: '14px' }}>
            Yeni Gelecek İşlem Ekle
          </div>
          <form onSubmit={handleAddDebt}>
            <div className="tab-switch">
              <button
                type="button"
                className={`tab-switch-btn ${debtType === 'Verilecek' ? 'active gider' : ''}`}
                onClick={() => setDebtType('Verilecek')}
              >
                Gider
              </button>
              <button
                type="button"
                className={`tab-switch-btn ${debtType === 'Alınacak' ? 'active gelir' : ''}`}
                onClick={() => setDebtType('Alınacak')}
              >
                Gelir
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Kişi / Kurum Adı</label>
              <input
                type="text"
                className="form-control"
                placeholder="Örn: Ahmet Yılmaz, Banka vb."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Miktar {activeWallet ? `(${activeWallet.type === 'Altın' || activeWallet.type === 'Gümüş' ? 'Gram' : activeWallet.type === 'Dolar' || activeWallet.type === 'Borsa_USD' ? '$' : activeWallet.type === 'Euro' ? '€' : '₺'})` : ''}
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
              <label className="form-label">İlişkili Hesap (Bakiye Güncellemesi İçin)</label>
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
              <label className="form-label">Kategori (İsteğe Bağlı)</label>
              <select
                className="form-control"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                style={{ background: '#121826' }}
              >
                <option value="">Kategori seçmeyin</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Son Ödeme Tarihi (İsteğe Bağlı)</label>
              <input
                type="date"
                className="form-control"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: '8px' }}
              disabled={loading}
            >
              <FiPlus />
              <span>{loading ? 'Ekleniyor...' : 'Kayıt Ekle'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
