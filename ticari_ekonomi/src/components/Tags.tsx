import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { FiPlus, FiTrash2, FiAlertCircle, FiX } from 'react-icons/fi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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
  type: string;
  color: string;
  balance: number;
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
}

const EMOJIS = ['✈️', '🏝️', '🎒', '💼', '🏠', '🚗', '💍', '🎁', '🎉', '🛠️', '🎓', '🏥', '🛒', '🍔', '🍺', '🍿', '💡', '🐾', '🏋️', '🎨'];
const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export const Tags: React.FC<TagsProps> = ({
  tags,
  transactions,
  categories,
  wallets,
  onRefreshData,
  userId,
}) => {
  // Form States
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Detail Modal State
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

  // Mappings
  const categoryMap = React.useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const walletMap = React.useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);

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
      
      if (selectedTag?.id === id) {
        setSelectedTag(null);
      }
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Etiket silinirken hata oluştu.');
    }
  };

  // Tag Statistics Calculations
  const tagStats = React.useMemo(() => {
    if (!selectedTag) return null;

    // Filter transactions by tag
    const tagTx = transactions.filter((t) => t.tag_id === selectedTag.id);

    let totalSpent = 0;
    const categoryBreakdown: { [key: string]: { value: number; name: string; color: string } } = {};

    tagTx.forEach((tx) => {
      const cat = categoryMap.get(tx.category_id);
      const isExpense = cat ? cat.type === 'Gider' : true;
      const amt = Number(tx.amount);

      if (isExpense) {
        totalSpent += amt;
        if (cat) {
          if (categoryBreakdown[cat.id]) {
            categoryBreakdown[cat.id].value += amt;
          } else {
            categoryBreakdown[cat.id] = {
              value: amt,
              name: `${cat.emoji} ${cat.name}`,
              color: cat.color,
            };
          }
        }
      }
    });

    const chartData = Object.values(categoryBreakdown);

    return {
      transactions: tagTx,
      totalSpent,
      chartData,
    };
  }, [selectedTag, transactions, categoryMap]);

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
              onClick={() => setSelectedTag(t)}
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

      {/* Tag Details Modal */}
      {selectedTag && tagStats && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(5px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setSelectedTag(null)}
        >
          <div
            className="card"
            style={{
              background: '#0e1320',
              border: `1px solid ${selectedTag.color}30`,
              width: '100%',
              maxWidth: '480px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '20px',
              position: 'relative',
              borderRadius: '16px',
            }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
          >
            <button
              onClick={() => setSelectedTag(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                color: 'var(--text-bright)',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <FiX />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <span style={{ fontSize: '2rem' }}>{selectedTag.emoji}</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-bright)', fontWeight: 800 }}>
                  {selectedTag.name}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  ETİKET DETAYI VE İSTATİSTİKLERİ
                </span>
              </div>
            </div>

            {/* Total Spent */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                padding: '14px',
                borderRadius: '12px',
                textAlign: 'center',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                BU ETİKETTEKİ TOPLAM GİDER
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f43f5e', marginTop: '4px' }}>
                {new Intl.NumberFormat('tr-TR', {
                  style: 'currency',
                  currency: 'TRY',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                }).format(tagStats.totalSpent)}
              </div>
            </div>

            {/* Donut Chart */}
            {tagStats.chartData.length > 0 ? (
              <div style={{ width: '100%', height: '170px', position: 'relative', marginBottom: '20px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tagStats.chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={68}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {tagStats.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) =>
                        new Intl.NumberFormat('tr-TR', {
                          style: 'currency',
                          currency: 'TRY',
                          minimumFractionDigits: 0,
                        }).format(Number(value))
                      }
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
                {/* Center text inside Donut */}
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
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                    DAĞILIM
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  height: '100px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  marginBottom: '20px',
                }}
              >
                Bu etikete ait harcama işlemi henüz bulunmuyor.
              </div>
            )}

            {/* Transactions Feed under Tag */}
            <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-bright)' }}>
              Etiketlenmiş İşlemler ({tagStats.transactions.length})
            </h4>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '220px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              {tagStats.transactions.length > 0 ? (
                tagStats.transactions.map((tx) => {
                  const cat = categoryMap.get(tx.category_id);
                  const w = walletMap.get(tx.wallet_id);
                  return (
                    <div
                      key={tx.id}
                      style={{
                        padding: '10px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-bright)' }}>
                          {tx.description || 'Açıklama yok'}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {new Date(tx.date).toLocaleDateString('tr-TR')} • {w?.name}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: cat?.type === 'Gelir' ? '#10b981' : '#ef4444',
                        }}
                      >
                        {cat?.type === 'Gelir' ? '+' : '-'}
                        {new Intl.NumberFormat('tr-TR', {
                          style: 'currency',
                          currency: 'TRY',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        }).format(tx.amount)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Henüz işlem yok.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
