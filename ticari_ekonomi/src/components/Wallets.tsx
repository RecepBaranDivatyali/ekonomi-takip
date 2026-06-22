import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { FiPlus, FiTrash2, FiAlertCircle, FiEdit2 } from 'react-icons/fi';
import type { ExchangeRates } from '../services/currencyService';

interface Wallet {
  id: string;
  name: string;
  type: 'Vadesiz' | 'Vadeli' | 'Dolar' | 'Euro' | 'Altın' | 'Gümüş' | 'Borsa_TRY' | 'Borsa_USD';
  color: string;
  balance: number;
  interest_rate: number;
  maturity_days: number;
  last_interest_date: string;
}

interface WalletsProps {
  wallets: Wallet[];
  onRefreshData: () => void;
  userId: string;
  rates: ExchangeRates;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#ef4444', // red
  '#f59e0b', // orange
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export const Wallets: React.FC<WalletsProps> = ({ wallets, onRefreshData, userId, rates }) => {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [type, setType] = useState<'Vadesiz' | 'Vadeli' | 'Dolar' | 'Euro' | 'Altın' | 'Gümüş' | 'Borsa_TRY' | 'Borsa_USD'>('Vadesiz');
  const [interestRate, setInterestRate] = useState('');
  const [maturityDays, setMaturityDays] = useState('32');
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);

  const handleStartEditWallet = (w: Wallet) => {
    setEditingWallet(w);
    setName(w.name);
    setBalance(String(w.balance));
    setType(w.type);
    setInterestRate(String(w.interest_rate));
    setMaturityDays(String(w.maturity_days));
    setColor(w.color);
    setShowAddForm(false);
    setErrorMsg(null);
  };

  const handleSaveEditWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWallet || !name.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase
        .from('wallets')
        .update({
          name: name.trim(),
          type,
          balance: balance ? Number(balance) : 0,
          color,
          interest_rate: type === 'Vadeli' ? (Number(interestRate) || 0) : 0,
          maturity_days: type === 'Vadeli' ? (Number(maturityDays) || 30) : 30,
        })
        .eq('id', editingWallet.id);

      if (error) throw error;

      setEditingWallet(null);
      setName('');
      setBalance('');
      setType('Vadesiz');
      setInterestRate('');
      setMaturityDays('32');
      onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Cüzdan güncellenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.from('wallets').insert({
        user_id: userId,
        name: name.trim(),
        type,
        balance: balance ? Number(balance) : 0,
        color,
        interest_rate: type === 'Vadeli' ? (Number(interestRate) || 0) : 0,
        maturity_days: type === 'Vadeli' ? (Number(maturityDays) || 30) : 30,
        last_interest_date: type === 'Vadeli' ? new Date().toISOString().split('T')[0] : null,
      });

      if (error) throw error;

      setName('');
      setBalance('');
      setType('Vadesiz');
      setInterestRate('');
      setMaturityDays('32');
      setShowAddForm(false);
      onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Cüzdan eklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWallet = async (id: string) => {
    if (!window.confirm('Bu cüzdanı silmek istediğinize emin misiniz? Cüzdana ait tüm işlemler de silinecektir.')) {
      return;
    }

    try {
      const { error } = await supabase.from('wallets').delete().eq('id', id);
      if (error) throw error;
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Cüzdan silinirken hata oluştu.');
    }
  };

  const showTryEquivalent = (val: number, walletType: string) => {
    let tryVal = 0;
    if (walletType === 'Dolar' || walletType === 'Borsa_USD') tryVal = val * rates.USD;
    else if (walletType === 'Euro') tryVal = val * rates.EUR;
    else if (walletType === 'Altın') tryVal = val * rates.Altın;
    else if (walletType === 'Gümüş') tryVal = val * rates.Gümüş;
    else return null;

    return ` (${new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(tryVal)})`;
  };

  const formatWalletBalance = (val: number, walletType: 'Vadesiz' | 'Vadeli' | 'Dolar' | 'Euro' | 'Altın' | 'Gümüş' | 'Borsa_TRY' | 'Borsa_USD') => {
    if (walletType === 'Dolar') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(val);
    }
    if (walletType === 'Euro') {
      return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(val);
    }
    if (walletType === 'Altın') {
      return `${Number(val).toFixed(2)} gr (Altın)`;
    }
    if (walletType === 'Gümüş') {
      return `${Number(val).toFixed(2)} gr (Gümüş)`;
    }
    if (walletType === 'Borsa_TRY') {
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(val) + ' (Borsa)';
    }
    if (walletType === 'Borsa_USD') {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0, textAlign: 'left' }}>
          Cüzdanlarım & Hesaplarım
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
          {showAddForm ? 'Kapat' : '+ Yeni Hesap'}
        </button>
      </div>

      {errorMsg && (
        <div className="toast error" style={{ position: 'static', marginBottom: '16px' }}>
          <FiAlertCircle />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Wallet List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {wallets.length > 0 ? (
          wallets.map((w) => (
            <div
              key={w.id}
              className="tx-item"
              style={{
                cursor: 'default',
                borderColor: `rgba(255, 255, 255, 0.05)`,
                borderLeft: `4px solid ${w.color}`,
              }}
            >
              <div className="tx-left">
                <div
                  style={{
                    backgroundColor: `${w.color}15`,
                    color: w.color,
                    padding: '8px',
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1rem'
                  }}
                >
                  {getWalletIcon(w.type)}
                </div>
                <div className="tx-details">
                  <span
                    className="tx-description"
                    style={{
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>{w.name}</span>
                    <span
                      style={{
                        fontSize: '0.6rem',
                        background: 'rgba(255, 255, 255, 0.06)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        color: 'var(--text-main)',
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}
                    >
                      {w.type}
                    </span>
                  </span>
                </div>
              </div>
              <div className="tx-right" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
                <span className="tx-amount" style={{ color: 'var(--text-bright)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span>{formatWalletBalance(Number(w.balance), w.type)}</span>
                  {showTryEquivalent(Number(w.balance), w.type) && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>
                      {showTryEquivalent(Number(w.balance), w.type)}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="circle-action-btn edit"
                  onClick={() => handleStartEditWallet(w)}
                  title="Cüzdanı Düzenle"
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
                  onClick={() => handleDeleteWallet(w.id)}
                  title="Cüzdanı Sil"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div
            style={{
              padding: '24px 0',
              textAlign: 'center',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            Henüz bir cüzdan oluşturmadınız. Lütfen bir cüzdan ekleyin.
          </div>
        )}
      </div>

      {/* Edit Wallet Form */}
      {editingWallet && (
        <div className="card muted" style={{ textAlign: 'left', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div className="card-title" style={{ margin: 0 }}>
              Cüzdan / Hesap Düzenle
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingWallet(null);
                setName('');
                setBalance('');
                setType('Vadesiz');
                setInterestRate('');
                setMaturityDays('32');
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
          <form onSubmit={handleSaveEditWallet}>
            <div className="form-group">
              <label className="form-label">Cüzdan / Hesap Adı</label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hesap / Para Birimi Türü</label>
              <select
                className="form-control"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                required
                style={{ background: '#121826' }}
              >
                <option value="Vadesiz">Vadesiz Hesap / Nakit (TL - ₺)</option>
                <option value="Vadeli">Vadeli Hesap / Vadeli Mevduat (TL - ₺)</option>
                <option value="Dolar">USD Hesabı (Dolar - $)</option>
                <option value="Euro">EUR Hesabı (Euro - €)</option>
                <option value="Altın">Altın Hesabı (Gram - gr)</option>
                <option value="Gümüş">Gümüş Hesabı (Gram - gr)</option>
                <option value="Borsa_TRY">Borsa Hesabı (TL - ₺)</option>
                <option value="Borsa_USD">Borsa Hesabı (Dolar - $)</option>
              </select>
            </div>

            {type === 'Vadeli' && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Yıllık Net Faiz Oranı (%)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Vade Süresi (Gün)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={maturityDays}
                    onChange={(e) => setMaturityDays(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                Bakiye {(type === 'Altın' || type === 'Gümüş') ? '(Gram Cinsinden)' : `(${type === 'Dolar' || type === 'Borsa_USD' ? '$' : type === 'Euro' ? '€' : '₺'})`}
              </label>
              <input
                type="number"
                step="any"
                className="form-control"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Cüzdan Rengi</label>
              <div className="color-radio-grid">
                {COLORS.map((c) => (
                  <div
                    key={c}
                    className={`color-dot ${color === c ? 'selected' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: '8px' }}
              disabled={loading}
            >
              <span>{loading ? 'Güncelleniyor...' : 'Değişiklikleri Kaydet'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Add Wallet Form */}
      {showAddForm && (
        <div className="card muted" style={{ textAlign: 'left' }}>
          <div className="card-title" style={{ marginBottom: '14px' }}>
            Yeni Hesap / Cüzdan Ekle
          </div>
          <form onSubmit={handleAddWallet}>
            <div className="form-group">
              <label className="form-label">Cüzdan / Hesap Adı</label>
              <input
                type="text"
                className="form-control"
                placeholder="Örn: Yapı Kredi, Maaş Kartı, Yastık Altı Altın"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hesap / Para Birimi Türü</label>
              <select
                className="form-control"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                required
                style={{ background: '#121826' }}
              >
                <option value="Vadesiz">Vadesiz Hesap / Nakit (TL - ₺)</option>
                <option value="Vadeli">Vadeli Hesap / Vadeli Mevduat (TL - ₺)</option>
                <option value="Dolar">USD Hesabı (Dolar - $)</option>
                <option value="Euro">EUR Hesabı (Euro - €)</option>
                <option value="Altın">Altın Hesabı (Gram - gr)</option>
                <option value="Gümüş">Gümüş Hesabı (Gram - gr)</option>
                <option value="Borsa_TRY">Borsa Hesabı (TL - ₺)</option>
                <option value="Borsa_USD">Borsa Hesabı (Dolar - $)</option>
              </select>
            </div>

            {type === 'Vadeli' && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Yıllık Net Faiz Oranı (%)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    placeholder="Örn: 45"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Vade Süresi (Gün)</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Örn: 32"
                    value={maturityDays}
                    onChange={(e) => setMaturityDays(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                Başlangıç Bakiyesi {(type === 'Altın' || type === 'Gümüş') ? '(Gram Cinsinden)' : `(${type === 'Dolar' || type === 'Borsa_USD' ? '$' : type === 'Euro' ? '€' : '₺'})`}
              </label>
              <input
                type="number"
                step="any"
                className="form-control"
                placeholder="0"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Cüzdan Rengi</label>
              <div className="color-radio-grid">
                {COLORS.map((c) => (
                  <div
                    key={c}
                    className={`color-dot ${color === c ? 'selected' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: '8px' }}
              disabled={loading}
            >
              <FiPlus />
              <span>{loading ? 'Ekleniyor...' : 'Hesap Ekle'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
