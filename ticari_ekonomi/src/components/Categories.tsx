import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { FiPlus, FiTrash2, FiAlertCircle } from 'react-icons/fi';

interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  type: 'Gelir' | 'Gider';
  user_id: string | null;
}

interface CategoriesProps {
  categories: Category[];
  onRefreshData: () => void;
  userId: string;
  onViewDetails?: (id: string) => void;
}

const EMOJIS = [
  '🍔', '🏠', '🚗', '🎮', '🛒', '💵',
  '📈', '🪙', '🎓', '💊', '✈️', '🎁',
  '☕', '🍕', '🍻', '👕', '💇', '🍿',
  '🏋️', '🚭', '🧹', '🐾', '⛽', '💡',
];

const COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#f59e0b', // orange
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#10b981', // green
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export const Categories: React.FC<CategoriesProps> = ({
  categories,
  onRefreshData,
  userId,
  onViewDetails,
}) => {
  // Form States
  const [name, setName] = useState('');
  const [catType, setCatType] = useState<'Gelir' | 'Gider'>('Gider');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.from('categories').insert({
        user_id: userId,
        name: name.trim(),
        emoji,
        color,
        type: catType,
      });

      if (error) throw error;

      setName('');
      setShowAddForm(false);
      onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Kategori eklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Bu kategoriyi silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Kategori silinirken hata oluştu.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0, textAlign: 'left' }}>
          Kategorilerim
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
          {showAddForm ? 'Kapat' : '+ Yeni Kategori'}
        </button>
      </div>

      {errorMsg && (
        <div className="toast error" style={{ position: 'static', marginBottom: '16px' }}>
          <FiAlertCircle />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Category List */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          marginBottom: '24px',
        }}
      >
        {categories.map((cat) => {
          const isSystem = cat.user_id === null;

          return (
            <div
              key={cat.id}
              className="badge-category"
              style={{
                backgroundColor: `${cat.color}10`,
                color: cat.color,
                borderColor: `${cat.color}30`,
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '14px',
                fontSize: '0.85rem',
                cursor: onViewDetails ? 'pointer' : 'default',
              }}
              onClick={() => onViewDetails && onViewDetails(cat.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.15rem' }}>{cat.emoji}</span>
                <span style={{ fontWeight: 600 }}>{cat.name}</span>
                <span
                  style={{
                    fontSize: '0.58rem',
                    opacity: 0.6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  ({cat.type})
                </span>
              </div>
              {!isSystem && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCategory(cat.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                  }}
                  className="delete-hover"
                  title="Sil"
                >
                  <FiTrash2 size={14} style={{ transition: 'color 0.2s' }} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Custom Category Card */}
      {showAddForm && (
        <div className="card muted" style={{ textAlign: 'left' }}>
          <div className="card-title" style={{ marginBottom: '14px' }}>
            Yeni Kategori Ekle
          </div>
          <form onSubmit={handleAddCategory}>
            <div className="tab-switch">
              <button
                type="button"
                className={`tab-switch-btn ${catType === 'Gider' ? 'active gider' : ''}`}
                onClick={() => setCatType('Gider')}
              >
                Gider Kategorisi
              </button>
              <button
                type="button"
                className={`tab-switch-btn ${catType === 'Gelir' ? 'active gelir' : ''}`}
                onClick={() => setCatType('Gelir')}
              >
                Gelir Kategorisi
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Kategori Adı</label>
              <input
                type="text"
                className="form-control"
                placeholder="Örn: Sağlık, Eğitim, Hediye vb."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Emoji Seçin</label>
              <div className="emoji-radio-grid">
                {EMOJIS.map((emo) => (
                  <div
                    key={emo}
                    className={`emoji-radio-btn ${emoji === emo ? 'selected' : ''}`}
                    onClick={() => setEmoji(emo)}
                    style={{ fontSize: '1.2rem', padding: '6px' }}
                  >
                    {emo}
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Kategori Rengi</label>
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
              <span>{loading ? 'Ekleniyor...' : 'Kategori Ekle'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
