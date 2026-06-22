import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { FiPlus, FiTrash2, FiAlertCircle } from 'react-icons/fi';

interface Tag {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  type: 'Gelir' | 'Gider';
}

interface Wallet {
  id: string;
  name: string;
  type: 'Vadesiz' | 'Vadeli' | 'Dolar' | 'Euro' | 'Altın' | 'Gümüş' | 'Borsa_TRY' | 'Borsa_USD' | 'Kredi_Karti';
  color: string;
  balance: number;
  credit_limit?: number;
  due_date?: number;
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

interface TagsProps {
  tags: Tag[];
  transactions: Transaction[];
  categories: Category[];
  wallets: Wallet[];
  onRefreshData: () => void;
  userId: string;
  onViewDetails?: (id: string) => void;
}

const EMOJIS = ['✈️', '🏝️', '🎒', '💼', '🏠', '🚗', '💍', '🎁', '🎉', '🛠️', '🎓', '🏥', '🛒', '🍔', '🍺', '🍿', '💡', '🐾', '🏋️', '🎨'];
const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export const Tags: React.FC<TagsProps> = ({
  tags,
  onRefreshData,
  userId,
  onViewDetails,
}) => {
  // Form States
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Handle Add Tag
  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.from('tags').insert({
        user_id: userId,
        name: name.trim(),
        emoji,
        color,
      });

      if (error) throw error;

      setName('');
      setEmoji(EMOJIS[0]);
      setColor(COLORS[0]);
      setShowAddForm(false);
      onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Etiket eklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete Tag
  const handleDeleteTag = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Avoid opening detail view when clicking delete
    if (!window.confirm('Bu etiketi silmek istediğinize emin misiniz? İlişkili işlemler silinmez, sadece etiketsiz kalır.')) {
      return;
    }

    try {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Etiket silinirken hata oluştu.');
    }
  };



  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
          Etiketlerim / Etkinlik Takibi
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
          {showAddForm ? 'Kapat' : '+ Yeni Etiket'}
        </button>
      </div>

      {errorMsg && (
        <div className="toast error" style={{ position: 'static', marginBottom: '16px' }}>
          <FiAlertCircle />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tags Grid List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {tags.length > 0 ? (
          tags.map((t) => (
            <div
              key={t.id}
              onClick={() => onViewDetails && onViewDetails(t.id)}
              className="card muted"
              style={{
                cursor: 'pointer',
                padding: '14px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderLeft: `4px solid ${t.color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.3rem' }}>{t.emoji}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-bright)' }}>{t.name}</span>
              </div>
              <button
                type="button"
                className="circle-action-btn delete"
                onClick={(e) => handleDeleteTag(e, t.id)}
                style={{ width: '24px', height: '24px', fontSize: '0.75rem' }}
                title="Sil"
              >
                <FiTrash2 />
              </button>
            </div>
          ))
        ) : (
          <div
            style={{
              gridColumn: 'span 2',
              padding: '24px 0',
              textAlign: 'center',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            Henüz bir etiket oluşturmadınız. (Örn: "Tatil", "Düğün", "İş")
          </div>
        )}
      </div>

      {/* Add Tag Form */}
      {showAddForm && (
        <div className="card muted" style={{ marginBottom: '24px' }}>
          <div className="card-title" style={{ marginBottom: '14px' }}>
            Yeni Etiket Ekle
          </div>
          <form onSubmit={handleAddTag}>
            <div className="form-group">
              <label className="form-label">Etiket Adı</label>
              <input
                type="text"
                className="form-control"
                placeholder="Örn: Yaz Tatili 2026, Ofis Harcamaları"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Emoji Seçin</label>
              <div className="emoji-radio-grid">
                {EMOJIS.map((emo) => (
                  <button
                    key={emo}
                    type="button"
                    className={`emoji-radio-btn ${emoji === emo ? 'selected' : ''}`}
                    onClick={() => setEmoji(emo)}
                  >
                    <span>{emo}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Renk Seçin</label>
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
              <span>{loading ? 'Ekleniyor...' : 'Etiket Ekle'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
