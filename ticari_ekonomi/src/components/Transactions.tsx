import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { FiPlus, FiTrash2, FiClock, FiAlertCircle, FiCheck, FiEdit2 } from 'react-icons/fi';

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

interface TransactionsProps {
  wallets: Wallet[];
  categories: Category[];
  tags: Tag[];
  transactions: Transaction[];
  debts: Debt[];
  onRefreshData: () => void;
  userId: string;
}

export const Transactions: React.FC<TransactionsProps> = ({
  wallets,
  categories,
  tags,
  transactions,
  debts,
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

  // Debt Mode States
  const [isDebtMode, setIsDebtMode] = useState(false);
  const [debtName, setDebtName] = useState('');
  const [debtType, setDebtType] = useState<'Alınacak' | 'Verilecek'>('Alınacak');
  const [debtDueDate, setDebtDueDate] = useState('');

  // UI States
  const [activeTxId, setActiveTxId] = useState<string | null>(null); // For click-to-reveal action row
  const [activeFeedTab, setActiveFeedTab] = useState<'transactions' | 'debts'>('transactions');
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);

  // Edit States
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  // Filter States
  const [filterWalletId, setFilterWalletId] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterMinAmount, setFilterMinAmount] = useState<string>('');
  const [filterMaxAmount, setFilterMaxAmount] = useState<string>('');

  const handleStartEditTransaction = (tx: Transaction) => {
    setEditingTx(tx);
    setEditingDebt(null);
    setAmount(String(tx.amount));
    setWalletId(tx.wallet_id);
    setCategoryId(tx.category_id);
    setTagId(tx.tag_id || '');
    setDescription(tx.description || '');
    setDate(tx.date);
    setTime(tx.time_range);
    
    const cat = categories.find(c => c.id === tx.category_id);
    if (cat) {
      setTxType(cat.type);
    }
    setShowAddForm(false);
    setErrorMsg(null);
  };

  const handleSaveEditTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !amount || Number(amount) <= 0 || !walletId || !categoryId) {
      setErrorMsg('Lütfen tüm zorunlu alanları doldurun.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const numAmount = Number(amount);
      const oldWallet = wallets.find(w => w.id === editingTx.wallet_id);
      const newWallet = wallets.find(w => w.id === walletId);
      if (!oldWallet || !newWallet) throw new Error('Cüzdan bulunamadı.');

      const oldCat = categories.find(c => c.id === editingTx.category_id);
      const oldType = oldCat ? oldCat.type : 'Gider';
      const oldReversal = oldType === 'Gelir' ? -editingTx.amount : editingTx.amount;
      const newAdjustment = txType === 'Gelir' ? numAmount : -numAmount;

      if (editingTx.wallet_id === walletId) {
        const finalBalance = Number(oldWallet.balance) + oldReversal + newAdjustment;

        if (oldWallet.type === 'Kredi_Karti') {
          const limit = oldWallet.credit_limit || 0;
          if (finalBalance < -limit) {
            throw new Error(`Kredi kartı limiti yetersiz! İşlem sonrası borç: ${formatWalletBalance(-finalBalance, 'Vadesiz')}, Limit: ${formatWalletBalance(limit, 'Vadesiz')}`);
          }
        } else {
          if (finalBalance < 0) {
            throw new Error(`Yetersiz bakiye! İşlem sonrası bakiye sıfırın altına düşemez. (Mevcut Bakiye: ${formatWalletBalance(oldWallet.balance, oldWallet.type)})`);
          }
        }

        const { error: walletErr } = await supabase
          .from('wallets')
          .update({ balance: finalBalance })
          .eq('id', walletId);
        if (walletErr) throw walletErr;
      } else {
        const finalOldBalance = Number(oldWallet.balance) + oldReversal;

        if (oldWallet.type === 'Kredi_Karti') {
          const limit = oldWallet.credit_limit || 0;
          if (finalOldBalance < -limit) {
            throw new Error(`Kredi kartı limiti yetersiz! (Eski Cüzdan: ${oldWallet.name})`);
          }
        } else {
          if (finalOldBalance < 0) {
            throw new Error(`Yetersiz bakiye! (Eski Cüzdan: ${oldWallet.name})`);
          }
        }

        const finalNewBalance = Number(newWallet.balance) + newAdjustment;

        if (newWallet.type === 'Kredi_Karti') {
          const limit = newWallet.credit_limit || 0;
          if (finalNewBalance < -limit) {
            throw new Error(`Kredi kartı limiti yetersiz! (Yeni Cüzdan: ${newWallet.name})`);
          }
        } else {
          if (finalNewBalance < 0) {
            throw new Error(`Yetersiz bakiye! (Yeni Cüzdan: ${newWallet.name})`);
          }
        }

        const { error: oldWalletErr } = await supabase
          .from('wallets')
          .update({ balance: finalOldBalance })
          .eq('id', oldWallet.id);
        if (oldWalletErr) throw oldWalletErr;

        const { error: newWalletErr } = await supabase
          .from('wallets')
          .update({ balance: finalNewBalance })
          .eq('id', walletId);
        if (newWalletErr) throw newWalletErr;
      }

      const { error: txErr } = await supabase
        .from('transactions')
        .update({
          wallet_id: walletId,
          category_id: categoryId,
          tag_id: tagId || null,
          amount: numAmount,
          description: description.trim(),
          date,
          time_range: time,
        })
        .eq('id', editingTx.id);

      if (txErr) throw txErr;

      setEditingTx(null);
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setTagId('');
      onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'İşlem güncellenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditDebt = (debt: Debt) => {
    setEditingDebt(debt);
    setEditingTx(null);
    setDebtName(debt.name);
    setAmount(String(debt.amount));
    setWalletId(debt.wallet_id);
    setCategoryId(debt.category_id || '');
    setDebtDueDate(debt.due_date || '');
    setDebtType(debt.type);
    setShowAddForm(false);
    setErrorMsg(null);
  };

  const handleSaveEditDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebt || !debtName.trim() || !amount || Number(amount) <= 0 || !walletId) {
      setErrorMsg('Lütfen gerekli alanları doldurun.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase
        .from('debts')
        .update({
          wallet_id: walletId,
          category_id: categoryId || null,
          type: debtType,
          amount: Number(amount),
          name: debtName.trim(),
          due_date: debtDueDate || null,
        })
        .eq('id', editingDebt.id);

      if (error) throw error;

      setEditingDebt(null);
      setDebtName('');
      setAmount('');
      setDebtDueDate('');
      setCategoryId('');
      onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gelecek işlem güncellenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

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
      const balanceChange = txType === 'Gelir' ? numAmount : -numAmount;
      const newBalance = Number(selectedWallet.balance) + balanceChange;

      if (selectedWallet.type === 'Kredi_Karti') {
        const limit = selectedWallet.credit_limit || 0;
        if (newBalance < -limit) {
          throw new Error(`Kredi kartı limiti yetersiz! İşlem sonrası borç: ${formatWalletBalance(-newBalance, 'Vadesiz')}, Limit: ${formatWalletBalance(limit, 'Vadesiz')}`);
        }
      } else {
        if (newBalance < 0) {
          throw new Error(`Yetersiz bakiye! İşlem sonrası bakiye sıfırın altına düşemez. (Mevcut Bakiye: ${formatWalletBalance(selectedWallet.balance, selectedWallet.type)})`);
        }
      }

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

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtName.trim() || !amount || Number(amount) <= 0 || !walletId) {
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
        name: debtName.trim(),
        due_date: debtDueDate || null,
        status: 'Bekliyor',
      });

      if (error) throw error;

      // Reset form
      setDebtName('');
      setAmount('');
      setDebtDueDate('');
      setCategoryId('');
      setShowAddForm(false);
      onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gelecek işlem eklenirken hata oluştu.');
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
      const numAmount = Number(debt.amount);
      const balanceChange = debt.type === 'Alınacak' ? numAmount : -numAmount;
      const newBalance = Number(wallet.balance) + balanceChange;

      if (wallet.type === 'Kredi_Karti') {
        const limit = wallet.credit_limit || 0;
        if (newBalance < -limit) {
          throw new Error(`Kredi kartı limiti yetersiz! Gelecek işlem gerçekleştirilemedi. (Mevcut Bakiye: ${formatWalletBalance(wallet.balance, wallet.type)})`);
        }
      } else {
        if (newBalance < 0) {
          throw new Error(`Yetersiz bakiye! Gelecek işlem gerçekleştirilemedi, hesap bakiyesi sıfırın altına düşemez. (Mevcut Bakiye: ${formatWalletBalance(wallet.balance, wallet.type)})`);
        }
      }

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
        description: `${debt.name} - Gelecek İşlem Kapanışı (${debt.type})`,
        date: new Date().toISOString().split('T')[0],
        time_range: new Date().toTimeString().slice(0, 5),
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
      alert(err.message || 'Gelecek işlem silinirken hata oluştu.');
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

        if (wallet.type === 'Kredi_Karti') {
          const limit = wallet.credit_limit || 0;
          if (newBalance < -limit) {
            throw new Error(`Kredi kartı limiti yetersiz! Bu işlemin silinmesi durumunda borç limiti aşacaktır.`);
          }
        } else {
          if (newBalance < 0) {
            throw new Error(`Yetersiz bakiye! Bu işlemin silinmesi durumunda hesap bakiyesi sıfırın altına düşecektir.`);
          }
        }

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
  const categoryMap = React.useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const walletMap = React.useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);
  const tagMap = React.useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  // Resolve category helper (handles null/automatic categories for Borsa & Döviz)
  const resolveTxCategory = React.useCallback((tx: Transaction) => {
    const cat = categoryMap.get(tx.category_id);
    const isOther = cat && (cat.name === 'Diğer' || cat.id === 'diger-fallback');

    if (cat && !isOther) return cat;

    const w = walletMap.get(tx.wallet_id);
    const desc = (tx.description || '').toLowerCase();

    if ((w && (w.type === 'Borsa_TRY' || w.type === 'Borsa_USD')) || desc.includes('hisse') || desc.includes('borsa')) {
      return {
        id: 'borsa-fallback',
        name: 'Borsa / Yatırım',
        emoji: '📈',
        color: '#84CC16',
        type: tx.amount < 0 ? 'Gider' : 'Gelir'
      };
    }

    if ((w && ['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(w.type)) || desc.includes('döviz') || desc.includes('altın') || desc.includes('gümüş') || desc.includes('kur ')) {
      return {
        id: 'doviz-fallback',
        name: 'Döviz / Maden',
        emoji: '💱',
        color: '#3B82F6',
        type: tx.amount < 0 ? 'Gider' : 'Gelir'
      };
    }

    if (cat) return cat;

    return {
      id: 'diger-fallback',
      name: 'Diğer',
      emoji: '🪙',
      color: '#64748B',
      type: tx.amount < 0 ? 'Gider' : 'Gelir'
    };
  }, [categoryMap, walletMap]);

  // Sort and filter transactions by criteria
  const sortedTransactions = React.useMemo(() => {
    let filtered = [...transactions];

    if (filterWalletId !== 'all') {
      filtered = filtered.filter(tx => tx.wallet_id === filterWalletId);
    }
    if (filterStartDate) {
      filtered = filtered.filter(tx => tx.date >= filterStartDate);
    }
    if (filterEndDate) {
      filtered = filtered.filter(tx => tx.date <= filterEndDate);
    }
    if (filterMinAmount) {
      filtered = filtered.filter(tx => Number(tx.amount) >= Number(filterMinAmount));
    }
    if (filterMaxAmount) {
      filtered = filtered.filter(tx => Number(tx.amount) <= Number(filterMaxAmount));
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterWalletId, filterStartDate, filterEndDate, filterMinAmount, filterMaxAmount]);

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

      {/* Edit Transaction Form */}
      {editingTx && (
        <div className="card muted" style={{ textAlign: 'left', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div className="card-title" style={{ margin: 0 }}>
              İşlemi Düzenle
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingTx(null);
                setAmount('');
                setDescription('');
                setTagId('');
              }}
              className="btn"
              style={{
                width: 'auto',
                margin: 0,
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 700,
                background: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--text-bright)',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Vazgeç
            </button>
          </div>

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

          <form onSubmit={handleSaveEditTransaction}>
            <div className="form-group">
              <label className="form-label">
                Tutar {activeWallet ? `(${activeWallet.type === 'Altın' || activeWallet.type === 'Gümüş' ? 'Gram' : activeWallet.type === 'Dolar' || activeWallet.type === 'Borsa_USD' ? '$' : activeWallet.type === 'Euro' ? '€' : '₺'})` : ''}
              </label>
              <input
                type="number"
                step="any"
                className="form-control"
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
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} [{w.type}] ({formatWalletBalance(Number(w.balance), w.type)})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select
                className="form-control"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                style={{ background: '#121826' }}
              >
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Etiket (İsteğe Bağlı)</label>
              <select
                className="form-control"
                value={tagId}
                onChange={(e) => setTagId(e.target.value)}
                style={{ background: '#121826' }}
              >
                <option value="">Etiketsiz</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.emoji} {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
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

            <div className="form-group">
              <label className="form-label">Açıklama</label>
              <input
                type="text"
                className="form-control"
                placeholder="İşleme ait açıklama girin..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              <span>{loading ? 'Güncelleniyor...' : 'Değişiklikleri Kaydet'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Edit Debt Form */}
      {editingDebt && (
        <div className="card muted" style={{ textAlign: 'left', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div className="card-title" style={{ margin: 0 }}>
              Gelecek İşlemi Düzenle
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingDebt(null);
                setDebtName('');
                setAmount('');
                setDebtDueDate('');
                setCategoryId('');
              }}
              className="btn"
              style={{
                width: 'auto',
                margin: 0,
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 700,
                background: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--text-bright)',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Vazgeç
            </button>
          </div>

          <div className="tab-switch" style={{ marginBottom: '16px' }}>
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

          <form onSubmit={handleSaveEditDebt}>
            <div className="form-group">
              <label className="form-label">Kişi / Kurum Adı</label>
              <input
                type="text"
                className="form-control"
                value={debtName}
                onChange={(e) => setDebtName(e.target.value)}
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">İlişkili Hesap</label>
              <select
                className="form-control"
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                required
                style={{ background: '#121826' }}
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} [{w.type}] ({formatWalletBalance(Number(w.balance), w.type)})
                  </option>
                ))}
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
                value={debtDueDate}
                onChange={(e) => setDebtDueDate(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              <span>{loading ? 'Güncelleniyor...' : 'Değişiklikleri Kaydet'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Add Transaction Card */}
      {showAddForm && (
        <div className="card muted" style={{ textAlign: 'left', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div className="card-title" style={{ margin: 0 }}>
              {isDebtMode ? `Yeni Gelecek ${debtType === 'Alınacak' ? 'Gelir' : 'Gider'} Ekle` : `Yeni ${txType} Ekle`}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsDebtMode(!isDebtMode);
                setErrorMsg(null);
              }}
              className="btn"
              style={{
                width: 'auto',
                margin: 0,
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 700,
                background: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--text-bright)',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              {isDebtMode ? 'Normal İşleme Geç' : 'Gelecek İşleme Geç'}
            </button>
          </div>

          {isDebtMode ? (
            <div className="tab-switch" style={{ marginBottom: '16px' }}>
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
          ) : (
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
          )}

          <form onSubmit={isDebtMode ? handleAddDebt : handleAddTransaction}>
            {isDebtMode ? (
              <>
                <div className="form-group">
                  <label className="form-label">Kişi / Kurum Adı</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Örn: Ahmet Yılmaz, Banka vb."
                    value={debtName}
                    onChange={(e) => setDebtName(e.target.value)}
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
                    value={debtDueDate}
                    onChange={(e) => setDebtDueDate(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ marginTop: '8px' }}
                  disabled={loading}
                >
                  <FiPlus />
                  <span>{loading ? 'Ekleniyor...' : 'Gelecek İşlem Ekle'}</span>
                </button>
              </>
            ) : (
              <>
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px', marginTop: '8px' }}>
                      {filteredCategories.map((cat) => {
                        const isSelected = categoryId === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategoryId(cat.id)}
                            title={cat.name}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 10px',
                              background: isSelected ? `${cat.color}18` : 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid',
                              borderColor: isSelected ? cat.color : 'rgba(255, 255, 255, 0.08)',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              color: isSelected ? 'var(--text-bright)' : 'var(--text-muted)',
                              transition: 'all 0.2s ease',
                              textAlign: 'left',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              width: '100%',
                              overflow: 'hidden',
                            }}
                          >
                            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{cat.emoji}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Henüz bu tipte bir kategori bulunmuyor. Cüzdanlar sekmesinden ekleyebilirsiniz.
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
              </>
            )}
          </form>
        </div>
      )}

      {/* Feed Sub-tabs */}
      <div className="tab-switch" style={{ marginBottom: '16px' }}>
        <button
          type="button"
          className={`tab-switch-btn ${activeFeedTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveFeedTab('transactions')}
          style={{ fontSize: '0.82rem', padding: '8px 12px' }}
        >
          İşlemlerim
        </button>
        <button
          type="button"
          className={`tab-switch-btn ${activeFeedTab === 'debts' ? 'active' : ''}`}
          onClick={() => setActiveFeedTab('debts')}
          style={{ fontSize: '0.82rem', padding: '8px 12px' }}
        >
          Gelecek İşlemler
        </button>
      </div>

      {activeFeedTab === 'transactions' ? (
        <>
          {/* Compact filters container */}
          <div className="card muted" style={{ padding: '12px', marginBottom: '16px', fontSize: '0.8rem', textAlign: 'left' }}>
            <div style={{ fontWeight: 700, marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>İşlem Filtreleri</span>
              {(filterWalletId !== 'all' || filterStartDate || filterEndDate || filterMinAmount || filterMaxAmount) && (
                <button 
                  onClick={() => {
                    setFilterWalletId('all');
                    setFilterStartDate('');
                    setFilterEndDate('');
                    setFilterMinAmount('');
                    setFilterMaxAmount('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fca5a5',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    padding: 0
                  }}
                >
                  Filtreleri Temizle
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.68rem', marginBottom: '2px', opacity: 0.8 }}>Cüzdan / Hesap</label>
                <select
                  className="form-control"
                  value={filterWalletId}
                  onChange={(e) => setFilterWalletId(e.target.value)}
                  style={{ background: '#121826', padding: '4px 8px', fontSize: '0.75rem', height: 'auto', borderRadius: '6px' }}
                >
                  <option value="all">Tüm Hesaplar</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.68rem', marginBottom: '2px', opacity: 0.8 }}>Başlangıç Tarihi</label>
                <input
                  type="date"
                  className="form-control"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  style={{ background: '#121826', padding: '4px 8px', fontSize: '0.75rem', height: 'auto', borderRadius: '6px' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.68rem', marginBottom: '2px', opacity: 0.8 }}>Bitiş Tarihi</label>
                <input
                  type="date"
                  className="form-control"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  style={{ background: '#121826', padding: '4px 8px', fontSize: '0.75rem', height: 'auto', borderRadius: '6px' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.68rem', marginBottom: '2px', opacity: 0.8 }}>Min Tutar</label>
                <input
                  type="number"
                  placeholder="Min"
                  className="form-control"
                  value={filterMinAmount}
                  onChange={(e) => setFilterMinAmount(e.target.value)}
                  style={{ background: '#121826', padding: '4px 8px', fontSize: '0.75rem', height: 'auto', borderRadius: '6px' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.68rem', marginBottom: '2px', opacity: 0.8 }}>Max Tutar</label>
                <input
                  type="number"
                  placeholder="Max"
                  className="form-control"
                  value={filterMaxAmount}
                  onChange={(e) => setFilterMaxAmount(e.target.value)}
                  style={{ background: '#121826', padding: '4px 8px', fontSize: '0.75rem', height: 'auto', borderRadius: '6px' }}
                />
              </div>
            </div>
          </div>

          <div className="tx-feed">
            {sortedTransactions.length > 0 ? (
              sortedTransactions.map((tx) => {
                const cat = resolveTxCategory(tx);
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
                        className="circle-action-btn edit"
                        onClick={(e) => {
                          e.stopPropagation(); // Avoid closing action bar on click
                          handleStartEditTransaction(tx);
                        }}
                        title="İşlemi Düzenle"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          color: '#60a5fa',
                          cursor: 'pointer',
                        }}
                      >
                        <FiEdit2 />
                      </button>
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
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {debts.length > 0 ? (
            debts.map((debt) => {
              const isExpanded = expandedDebtId === debt.id;
              const w = walletMap.get(debt.wallet_id);
              const cat = debt.category_id ? categoryMap.get(debt.category_id) : null;
              const isReceivable = debt.type === 'Alınacak';

              return (
                <div key={debt.id} className="debt-card" style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden' }}>
                  {/* Header */}
                  <div
                    className="debt-header"
                    onClick={() => setExpandedDebtId(isExpanded ? null : debt.id)}
                    style={{ padding: '14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.2s' }}
                  >
                    <div className="debt-header-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className={`debt-avatar ${isReceivable ? 'receivable' : 'payable'}`}>
                        {isReceivable ? 'A' : 'V'}
                      </div>
                      <div className="debt-header-info" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span className="debt-person" style={{ fontWeight: 700, color: 'var(--text-bright)', fontSize: '0.9rem' }}>{debt.name}</span>
                        {debt.due_date && (
                          <span className="debt-due" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            Vade: {new Date(debt.due_date).toLocaleDateString('tr-TR')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="debt-header-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className={`debt-amount ${isReceivable ? 'receivable' : 'payable'}`} style={{ fontWeight: 700, fontSize: '0.9rem' }}>
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
                    <div className="debt-body" style={{ padding: '14px', borderTop: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.005)', fontSize: '0.78rem' }}>
                      <div className="debt-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Tür:</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{debt.type === 'Alınacak' ? 'Gelir' : 'Gider'}</span>
                      </div>
                      <div className="debt-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>İlişkili Hesap:</span>
                        <span style={{ fontWeight: 600, color: w?.color || 'var(--text-bright)' }}>{w?.name || 'Belirtilmemiş'} ({w?.type})</span>
                      </div>
                      {cat && (
                        <div className="debt-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Kategori:</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>
                            {cat.emoji} {cat.name}
                          </span>
                        </div>
                      )}
                      <div className="debt-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Kayıt Tarihi:</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{new Date(debt.created_at).toLocaleDateString('tr-TR')}</span>
                      </div>

                      {/* Action buttons inside details */}
                      <div className="item-actions" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        {debt.status === 'Bekliyor' && (
                          <>
                            <button
                              type="button"
                              className="circle-action-btn"
                              onClick={() => handleStartEditDebt(debt)}
                              style={{
                                width: 'auto',
                                padding: '4px 12px',
                                borderRadius: '8px',
                                color: '#60a5fa',
                                borderColor: 'rgba(59, 130, 246, 0.2)',
                                background: 'rgba(59, 130, 246, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                              }}
                            >
                              <FiEdit2 />
                              <span>Düzenle</span>
                            </button>
                            <button
                              type="button"
                              className="circle-action-btn"
                              onClick={() => handleMarkAsPaid(debt)}
                              style={{
                                width: 'auto',
                                padding: '4px 12px',
                                borderRadius: '8px',
                                color: '#10b981',
                                borderColor: 'rgba(16, 185, 129, 0.2)',
                                background: 'rgba(16, 185, 129, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                              }}
                            >
                              <FiCheck />
                              <span>Ödendi Yap</span>
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="circle-action-btn delete"
                          onClick={() => handleDeleteDebt(debt.id)}
                          title="Sil"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            cursor: 'pointer',
                          }}
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
                padding: '32px 0',
                textAlign: 'center',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
              }}
            >
              Henüz gelecek bir işlem planlanmadı.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
