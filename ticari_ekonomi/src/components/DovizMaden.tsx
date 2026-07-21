import React, { useState, useMemo } from 'react';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { supabase } from '../supabaseClient';
import type { ExchangeRates, CurrencyRate } from '../services/currencyService';
import { calculateWalletAssetBalances } from '../services/currencyService';

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
  amount: number;
  description: string;
  date: string;
  time_range: string;
}

interface DovizMadenProps {
  wallets: Wallet[];
  rates: ExchangeRates;
  currencyRates: CurrencyRate[];
  transactions: Transaction[];
  categories: any[];
  onRefreshData: () => void;
  userId: string;
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

export const DovizMaden: React.FC<DovizMadenProps> = ({ wallets, rates, currencyRates, transactions, onRefreshData, userId }) => {
  const [activeCategory, setActiveCategory] = useState<'doviz' | 'maden'>('doviz');
  // Transaction Form States
  const [showForm, setShowForm] = useState(false);
  const [tradeType, setTradeType] = useState<'AL' | 'SAT'>('AL');
  const [targetWalletId, setTargetWalletId] = useState('');
  const [sourceWalletId, setSourceWalletId] = useState('other'); // 'other' or a Vadesiz Wallet ID
  const [amount, setAmount] = useState('');
  const [customRate, setCustomRate] = useState('');
  const [tradeAsset, setTradeAsset] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Alış kuru düzenleme (maliyet girme) state
  const [editingCostWalletId, setEditingCostWalletId] = useState<string | null>(null);
  const [editingCostRate, setEditingCostRate] = useState('');
  const [editingCostAsset, setEditingCostAsset] = useState('USD');
  const [costSaving, setCostSaving] = useState(false);

  // Save the user-entered average cost rate for a wallet.
  // Deletes any stale "Başlangıç Bakiyesi" transactions for the selected asset, then inserts the correct one.
  const handleSaveCostRate = async (walletId: string) => {
    const rate = parseFloat(editingCostRate.replace(',', '.'));
    if (isNaN(rate) || rate <= 0) return;

    const targetW = myWallets.find(w => w.id === walletId);
    if (!targetW) return;

    setCostSaving(true);
    try {
      const assetBalances = calculateWalletAssetBalances(targetW, transactions, rates);
      let assetAmount = 0;
      let assetName = 'Döviz';
      let assetMatchKeyword = '';

      if (editingCostAsset === 'USD') {
        assetAmount = assetBalances.usd;
        assetName = 'Dolar';
        assetMatchKeyword = 'dolar';
      } else if (editingCostAsset === 'EUR') {
        assetAmount = assetBalances.eur;
        assetName = 'Euro';
        assetMatchKeyword = 'euro';
      } else if (editingCostAsset === 'Altın') {
        assetAmount = assetBalances.gold;
        assetName = 'Altın';
        assetMatchKeyword = 'altın';
      } else if (editingCostAsset === 'Gümüş') {
        assetAmount = assetBalances.silver;
        assetName = 'Gümüş';
        assetMatchKeyword = 'gümüş';
      }

      if (assetAmount <= 0) {
        alert(`${assetName} bakiyeniz olmadığı için alış kuru eklenemez.`);
        return;
      }

      // 1. Delete existing "Başlangıç Bakiyesi" transactions containing the keyword for this wallet
      const wTxs = transactions.filter(
        tx => tx.wallet_id === walletId && 
        tx.description && 
        tx.description.includes('Başlangıç Bakiyesi') && 
        tx.description.toLowerCase().includes(assetMatchKeyword)
      );

      for (const tx of wTxs) {
        await supabase.from('transactions').delete().eq('id', tx.id);
      }

      // 2. Insert new transaction
      const walletCreatedAt = (targetW as any).created_at as string | undefined;
      const createdDate = walletCreatedAt
        ? walletCreatedAt.split('T')[0]
        : new Date().toISOString().split('T')[0];


      const description = `Başlangıç Bakiyesi - ${assetName} Alış (Kur: ${rate.toFixed(4)})`;

      await supabase.from('transactions').insert({
        user_id: userId,
        wallet_id: walletId,
        amount: assetAmount,
        description,
        date: createdDate,
        time_range: '00:00',
      });

      setEditingCostWalletId(null);
      setEditingCostRate('');
      onRefreshData();
    } finally {
      setCostSaving(false);
    }
  };

  // Filter wallets
  const myWallets = useMemo(() => wallets.filter(w => DOVIZ_TYPES.includes(w.type)), [wallets]);
  const vadesizWallets = useMemo(() => wallets.filter(w => w.type === 'Vadesiz' || w.type === 'Kredi_Karti'), [wallets]);

  // Update trade asset and rate on wallet changes
  React.useEffect(() => {
    if (!showForm || myWallets.length === 0) return;
    
    // 1. Auto-select first wallet if none selected
    let selectedWId = targetWalletId;
    if (!selectedWId) {
      selectedWId = myWallets[0].id;
      setTargetWalletId(selectedWId);
    }
    
    const targetWallet = myWallets.find(w => w.id === selectedWId);
    if (!targetWallet) return;
    
    // 2. Auto-select default asset based on wallet type if tradeAsset is not compatible
    let defaultAsset = tradeAsset;
    if (['Dolar', 'Euro', 'Döviz'].includes(targetWallet.type)) {
      if (tradeAsset !== 'USD' && tradeAsset !== 'EUR') {
        defaultAsset = targetWallet.type === 'Euro' ? 'EUR' : 'USD';
        setTradeAsset(defaultAsset);
      }
    } else if (['Altın', 'Gümüş', 'Maden'].includes(targetWallet.type)) {
      if (tradeAsset !== 'Altın' && tradeAsset !== 'Gümüş') {
        defaultAsset = targetWallet.type === 'Gümüş' ? 'Gümüş' : 'Altın';
        setTradeAsset(defaultAsset);
      }
    }
    
    // 3. Set live rate based on the selected asset
    let rate = 0;
    if (defaultAsset === 'USD') rate = rates.USD;
    else if (defaultAsset === 'EUR') rate = rates.EUR;
    else if (defaultAsset === 'Altın') rate = rates.Altın;
    else if (defaultAsset === 'Gümüş') rate = rates.Gümüş;
    
    setCustomRate(rate > 0 ? rate.toString() : '');
  }, [showForm, targetWalletId, tradeAsset, myWallets, rates]);

  // Automatic transaction deduplication for 'Başlangıç Bakiyesi' entries
  React.useEffect(() => {
    if (!userId || transactions.length === 0 || myWallets.length === 0) return;

    const cleanDuplicates = async () => {
      let cleanedAny = false;
      
      for (const w of myWallets) {
        // Find all 'Başlangıç Bakiyesi' transactions for this wallet
        const wTxs = transactions.filter(
          tx => tx.wallet_id === w.id && 
          tx.description && 
          tx.description.includes('Başlangıç Bakiyesi')
        );

        if (wTxs.length > 1) {
          console.log(`[Deduplication] Found ${wTxs.length} duplicate starting balance txs for wallet: ${w.name}`);
          // Keep the first one, delete all subsequent ones
          const toDelete = wTxs.slice(1);
          
          for (const tx of toDelete) {
            const { error } = await supabase
              .from('transactions')
              .delete()
              .eq('id', tx.id);
              
            if (!error) {
              cleanedAny = true;
            }
          }
        }
      }

      if (cleanedAny) {
        onRefreshData();
      }
    };

    cleanDuplicates();
  }, [userId, transactions, myWallets, onRefreshData]);


  // Portfolio calculation with Average Cost
  const portfolio = useMemo(() => {
    let totalTL = 0;
    let totalInvested = 0;
    let totalProfitLoss = 0;
    
    const items = myWallets.map(w => {
      const assetBalances = calculateWalletAssetBalances(w, transactions, rates);
      const tlVal = assetBalances.totalTL;
      totalTL += tlVal;

      const wTxs = transactions.filter(tx => tx.wallet_id === w.id);
      
      const getAssetCostDetails = (assetMatchStr: string, liveAssetRate: number, currentAssetBalance: number) => {
        let totalAmountBought = 0;
        let totalCostSpent = 0;
        
        wTxs.forEach(tx => {
          const desc = (tx.description || '').toLowerCase();
          if (desc.includes('alış (kur:') || desc.includes('alis (kur:')) {
            const hasAssetMatch = desc.includes(assetMatchStr);
            const matchesLegacyType = !desc.includes('dolar') && !desc.includes('euro') && !desc.includes('altın') && !desc.includes('gümüş') &&
              ((assetMatchStr === 'dolar' && w.type === 'Dolar') ||
               (assetMatchStr === 'euro' && w.type === 'Euro') ||
               (assetMatchStr === 'altın' && w.type === 'Altın') ||
               (assetMatchStr === 'gümüş' && w.type === 'Gümüş'));

            if (hasAssetMatch || matchesLegacyType) {
              const match = tx.description.match(/Kur:\s*([\d.]+)/);
              if (match && match[1]) {
                const parsedRate = parseFloat(match[1]);
                const boughtAmount = tx.amount;
                if (boughtAmount > 0 && parsedRate > 0) {
                  totalAmountBought += boughtAmount;
                  totalCostSpent += (boughtAmount * parsedRate);
                }
              }
            }
          }
        });
        
        const hasCostData = totalAmountBought > 0;
        const averageCost = hasCostData ? (totalCostSpent / totalAmountBought) : 0;
        const profitLoss = hasCostData ? (liveAssetRate - averageCost) * currentAssetBalance : 0;
        const invested = hasCostData ? averageCost * currentAssetBalance : liveAssetRate * currentAssetBalance;
        
        return { averageCost, profitLoss, invested, hasCostData };
      };

      let averageCost = 0;
      let profitLoss = 0;
      let totalInvestedForWallet = 0;
      let hasCostData = false;

      if (['Dolar', 'Euro', 'Döviz'].includes(w.type)) {
        const usdDetails = getAssetCostDetails('dolar', rates.USD, assetBalances.usd);
        const eurDetails = getAssetCostDetails('euro', rates.EUR, assetBalances.eur);
        
        hasCostData = usdDetails.hasCostData || eurDetails.hasCostData;
        totalInvestedForWallet = usdDetails.invested + eurDetails.invested;
        profitLoss = usdDetails.profitLoss + eurDetails.profitLoss;
        
        const totalCoins = assetBalances.usd + assetBalances.eur;
        averageCost = totalCoins > 0 ? (totalInvestedForWallet / totalCoins) : 0;
      } else if (['Altın', 'Gümüş', 'Maden'].includes(w.type)) {
        const goldDetails = getAssetCostDetails('altın', rates.Altın, assetBalances.gold);
        const silverDetails = getAssetCostDetails('gümüş', rates.Gümüş, assetBalances.silver);
        
        hasCostData = goldDetails.hasCostData || silverDetails.hasCostData;
        totalInvestedForWallet = goldDetails.invested + silverDetails.invested;
        profitLoss = goldDetails.profitLoss + silverDetails.profitLoss;
        
        const totalGrams = assetBalances.gold + assetBalances.silver;
        averageCost = totalGrams > 0 ? (totalInvestedForWallet / totalGrams) : 0;
      }

      totalInvested += totalInvestedForWallet;
      totalProfitLoss += profitLoss;

      const liveRate = getRateForType(w.type, rates);
      const change = getChangeForType(w.type, rates);

      return {
        ...w,
        liveRate,
        change,
        tlVal,
        averageCost,
        profitLoss,
        hasCostData,
        assetBalances
      };
    });

    const totalProfitLossPercent = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;
    const anyHasCostData = items.some(i => i.hasCostData);
    
    return { items, totalTL, totalInvested, totalProfitLoss, totalProfitLossPercent, anyHasCostData };
  }, [myWallets, rates, transactions]);

  // Form Submit Handler
  const handleTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetWalletId) return;
    
    const tradeAmount = parseFloat(amount);
    const tradeRate = parseFloat(customRate);

    if (isNaN(tradeAmount) || tradeAmount <= 0) {
      setErrorMsg('Geçerli bir miktar girin.');
      return;
    }
    if (isNaN(tradeRate) || tradeRate <= 0) {
      setErrorMsg('Geçerli bir kur girin.');
      return;
    }

    const targetWallet = myWallets.find(w => w.id === targetWalletId);
    if (!targetWallet) return;

    const totalTLRequired = tradeAmount * tradeRate;

    setLoading(true);
    setErrorMsg(null);

    try {
      const isDoviz = ['Dolar', 'Euro', 'Döviz'].includes(targetWallet.type);
      const assetName = isDoviz
        ? (tradeAsset === 'EUR' ? 'Euro' : 'Dolar')
        : (tradeAsset === 'Gümüş' ? 'Gümüş' : 'Altın');

      if (tradeType === 'AL') {
        // Source Wallet check
        let newSourceBalance = 0;
        if (sourceWalletId !== 'other') {
          const sourceW = vadesizWallets.find(w => w.id === sourceWalletId);
          if (!sourceW) throw new Error('Kaynak hesap bulunamadı.');

          const isCreditCard = sourceW.type === 'Kredi_Karti';
          const maxSpendingLimit = isCreditCard ? (sourceW.balance + (sourceW.credit_limit || 0)) : sourceW.balance;

          if (maxSpendingLimit < totalTLRequired) {
            if (isCreditCard) {
              throw new Error(`Kredi kartı limiti yetersiz! Gerekli: ${formatTL(totalTLRequired)}, Kalan Limit: ${formatTL(maxSpendingLimit)}`);
            } else {
              throw new Error(`Kaynak hesapta yeterli bakiye yok. Gerekli: ${formatTL(totalTLRequired)}`);
            }
          }
          newSourceBalance = sourceW.balance - totalTLRequired;
        }

        // 1. Update Source Wallet (if not other)
        if (sourceWalletId !== 'other') {
          const { error: sErr } = await supabase.from('wallets').update({ balance: newSourceBalance }).eq('id', sourceWalletId);
          if (sErr) throw sErr;

          await supabase.from('transactions').insert({
            user_id: userId,
            wallet_id: sourceWalletId,
            amount: -totalTLRequired, // expense
            description: `${targetWallet.name} Alımı İçin Çıkış`,
            date: new Date().toLocaleDateString('sv-SE'),
            time_range: new Date().toTimeString().slice(0, 5),
          });
        }

        // 2. Update Target Wallet
        const newTargetBalance = targetWallet.balance + tradeAmount;
        const { error: tErr } = await supabase.from('wallets').update({ balance: newTargetBalance }).eq('id', targetWallet.id);
        if (tErr) throw tErr;

        // 3. Log Target Transaction (Important for avg cost)
        await supabase.from('transactions').insert({
          user_id: userId,
          wallet_id: targetWallet.id,
          amount: tradeAmount, // amount bought
          description: `${assetName} Alış (Kur: ${tradeRate})`,
          date: new Date().toLocaleDateString('sv-SE'),
          time_range: new Date().toTimeString().slice(0, 5),
        });

      } else {
        // SELL
        const currentBalanceOfAsset = isDoviz
          ? ((targetWallet as any).assetBalances?.eur !== undefined 
              ? (tradeAsset === 'EUR' ? (targetWallet as any).assetBalances.eur : (targetWallet as any).assetBalances.usd)
              : targetWallet.balance)
          : ((targetWallet as any).assetBalances?.silver !== undefined
              ? (tradeAsset === 'Gümüş' ? (targetWallet as any).assetBalances.silver : (targetWallet as any).assetBalances.gold)
              : targetWallet.balance);

        if (currentBalanceOfAsset < tradeAmount) {
          throw new Error(`Cüzdanınızda yeterli ${assetName} yok. Mevcut: ${currentBalanceOfAsset}`);
        }

        // 1. Update Source Wallet (adds TL back if not other)
        if (sourceWalletId !== 'other') {
          const sourceW = vadesizWallets.find(w => w.id === sourceWalletId);
          if (!sourceW) throw new Error('Hedef hesap bulunamadı.');
          
          const newSourceBalance = sourceW.balance + totalTLRequired;
          const { error: sErr } = await supabase.from('wallets').update({ balance: newSourceBalance }).eq('id', sourceWalletId);
          if (sErr) throw sErr;

          await supabase.from('transactions').insert({
            user_id: userId,
            wallet_id: sourceWalletId,
            amount: totalTLRequired, // income
            description: `${targetWallet.name} Satışı İçin Giriş`,
            date: new Date().toLocaleDateString('sv-SE'),
            time_range: new Date().toTimeString().slice(0, 5),
          });
        }

        // 2. Update Target Wallet
        const newTargetBalance = targetWallet.balance - tradeAmount;
        const { error: tErr } = await supabase.from('wallets').update({ balance: newTargetBalance }).eq('id', targetWallet.id);
        if (tErr) throw tErr;

        // 3. Log Target Transaction
        await supabase.from('transactions').insert({
          user_id: userId,
          wallet_id: targetWallet.id,
          amount: -tradeAmount, // amount sold
          description: `${assetName} Satış (Kur: ${tradeRate})`,
          date: new Date().toLocaleDateString('sv-SE'),
          time_range: new Date().toTimeString().slice(0, 5),
        });
      }

      setAmount('');
      setShowForm(false);
      onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'İşlem gerçekleştirilirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleTargetWalletChange = (wid: string) => {
    setTargetWalletId(wid);
    const w = myWallets.find(x => x.id === wid);
    if (w) {
      let defaultAsset = 'USD';
      if (w.type === 'Euro') defaultAsset = 'EUR';
      else if (w.type === 'Gümüş') defaultAsset = 'Gümüş';
      else if (w.type === 'Altın') defaultAsset = 'Altın';
      
      setTradeAsset(defaultAsset);

      let rate = rates.USD;
      if (defaultAsset === 'EUR') rate = rates.EUR;
      else if (defaultAsset === 'Altın') rate = rates.Altın;
      else if (defaultAsset === 'Gümüş') rate = rates.Gümüş;
      
      setCustomRate(rate.toString());
    }
  };

  // Split live rates list & sort by owned and TL value descending
  const sortedRates = useMemo(() => {
    const getOwnedInfo = (rate: CurrencyRate) => {
      if (!rate.walletType) return null;
      const w = wallets.find(wl => wl.type === rate.walletType);
      if (w && Number(w.balance) > 0) {
        return {
          owned: true,
          tlVal: Number(w.balance) * rate.sell
        };
      }
      return null;
    };

    const sortFn = (a: CurrencyRate, b: CurrencyRate) => {
      const aInfo = getOwnedInfo(a);
      const bInfo = getOwnedInfo(b);

      if (aInfo && bInfo) {
        return bInfo.tlVal - aInfo.tlVal; // Sort by TL value descending
      }
      if (aInfo) return -1; // owned comes first
      if (bInfo) return 1;
      return 0; // retain original order
    };

    const doviz = currencyRates.filter(r => r.category === 'doviz').sort(sortFn);
    const maden = currencyRates.filter(r => r.category === 'maden').sort(sortFn);
    return { doviz, maden };
  }, [currencyRates, wallets]);

  const activeRates = activeCategory === 'doviz' ? sortedRates.doviz : sortedRates.maden;

  return (
    <div style={{ textAlign: 'left', paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Döviz &amp; Madenler</h2>
        {myWallets.length > 0 && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              width: 'auto',
              margin: 0,
              background: showForm ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
              borderColor: showForm ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)',
              color: showForm ? '#f87171' : '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {showForm ? 'Kapat' : '+ İşlem Ekle'}
          </button>
        )}
      </div>

      {/* Transaction Modal (Inline) */}
      {showForm && (
        <div className="card muted" style={{ textAlign: 'left', marginBottom: '24px' }}>
          <div className="card-title" style={{ marginBottom: '14px' }}>
            Yeni İşlem Ekle
          </div>
          
          <div className="tab-switch" style={{ marginBottom: '16px' }}>
            <button
              type="button"
              className={`tab-switch-btn ${tradeType === 'AL' ? 'active gelir' : ''}`}
              onClick={() => setTradeType('AL')}
            >
              Yatırım Al
            </button>
            <button
              type="button"
              className={`tab-switch-btn ${tradeType === 'SAT' ? 'active gider' : ''}`}
              onClick={() => setTradeType('SAT')}
            >
              Yatırım Sat
            </button>
          </div>

          <form onSubmit={handleTradeSubmit}>
            <div className="form-group">
              <label className="form-label">İşlem Yapılacak Varlık</label>
              <select className="form-control" value={targetWalletId} onChange={(e) => handleTargetWalletChange(e.target.value)} required style={{ background: '#121826' }}>
                <option value="" disabled>Seçiniz</option>
                {myWallets.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({calculateWalletAssetBalances(w, transactions, rates).displayValue})</option>
                ))}
              </select>
            </div>

            {targetWalletId && (() => {
              const w = myWallets.find(x => x.id === targetWalletId);
              if (!w) return null;
              const isDoviz = ['Dolar', 'Euro', 'Döviz'].includes(w.type);
              const isMaden = ['Altın', 'Gümüş', 'Maden'].includes(w.type);
              if (isDoviz) {
                return (
                  <div className="form-group">
                    <label className="form-label">Döviz Türü</label>
                    <select
                      className="form-control"
                      value={tradeAsset}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTradeAsset(val);
                        setCustomRate(val === 'EUR' ? rates.EUR.toString() : rates.USD.toString());
                      }}
                      style={{ background: '#121826' }}
                    >
                      <option value="USD">Dolar ($)</option>
                      <option value="EUR">Euro (€)</option>
                    </select>
                  </div>
                );
              }
              if (isMaden) {
                return (
                  <div className="form-group">
                    <label className="form-label">Maden Türü</label>
                    <select
                      className="form-control"
                      value={tradeAsset}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTradeAsset(val);
                        setCustomRate(val === 'Gümüş' ? rates.Gümüş.toString() : rates.Altın.toString());
                      }}
                      style={{ background: '#121826' }}
                    >
                      <option value="Altın">Gram Altın (gr)</option>
                      <option value="Gümüş">Gram Gümüş (gr)</option>
                    </select>
                  </div>
                );
              }
              return null;
            })()}

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Miktar</label>
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
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">İşlem Kuru</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  placeholder="Kur fiyatı"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{tradeType === 'AL' ? 'Ödemenin Çekileceği Hesap' : 'Paranın Yatacağı Hesap'}</label>
              <select className="form-control" value={sourceWalletId} onChange={(e) => setSourceWalletId(e.target.value)} style={{ background: '#121826' }}>
                <option value="other">Diğer (Banka Dışı / Hediye)</option>
                {vadesizWallets.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.type === 'Kredi_Karti' ? '(Kredi Kartı - Borç/Limit)' : ''} ({formatTL(w.balance)})
                  </option>
                ))}
              </select>
            </div>

            {amount && customRate && (
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                textAlign: 'center',
                fontSize: '0.85rem'
              }}>
                Toplam Tutar: <strong style={{ color: 'var(--text-bright)', fontSize: '1rem' }}>{formatTL(parseFloat(amount) * parseFloat(customRate))}</strong>
              </div>
            )}

            {errorMsg && (
              <div className="toast error" style={{ position: 'static', marginBottom: '16px' }}>
                <span>{errorMsg}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              <span>{loading ? 'İşleniyor...' : 'Onayla'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Portfolio Summary Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(30,41,59,0.3) 0%, rgba(15,23,42,0.5) 100%)',
          borderColor: 'rgba(255,255,255,0.04)',
          padding: '16px',
          borderRadius: '16px',
          marginBottom: '20px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          rowGap: '16px',
          columnGap: '12px',
        }}
      >
        {/* Top Left: Toplam TL Değeri */}
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            Toplam TL Değeri
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 850, color: 'var(--text-bright)', marginTop: '4px' }}>
            {formatTL(portfolio.totalTL, 0)}
          </div>
        </div>

        {/* Top Right: Toplam Kar / Zarar */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            Toplam Kar / Zarar
          </div>
          {portfolio.anyHasCostData ? (
            <>
              <div
                style={{
                  fontSize: '1.3rem',
                  fontWeight: 850,
                  color: portfolio.totalProfitLoss >= 0 ? '#10b981' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '4px',
                  marginTop: '4px',
                }}
              >
                {portfolio.totalProfitLoss >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
                <span>
                  {portfolio.totalProfitLoss >= 0 ? '+' : ''}
                  {formatTL(portfolio.totalProfitLoss, 0)}
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: portfolio.totalProfitLoss >= 0 ? '#10b981' : '#ef4444',
                  marginTop: '2px',
                }}
              >
                {portfolio.totalProfitLoss >= 0 ? '+' : ''}
                {portfolio.totalProfitLossPercent.toFixed(2)}%
              </div>
            </>
          ) : (
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Maliyet verisi yok
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px', opacity: 0.7 }}>
                İşlem ekleyin
              </div>
            </div>
          )}
        </div>


        {/* Bottom Left: Günlük TL Değişimi */}
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            Günlük Değişim
          </div>
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 850,
              color: (() => {
                const dailyChange = portfolio.items.reduce((sum, w) => sum + (w.tlVal * (w.change / 100)), 0);
                return dailyChange >= 0 ? '#10b981' : '#ef4444';
              })(),
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {(() => {
              const dailyChange = portfolio.items.reduce((sum, w) => sum + (w.tlVal * (w.change / 100)), 0);
              return (
                <>
                  {dailyChange >= 0 ? <FiTrendingUp style={{ fontSize: '1rem' }} /> : <FiTrendingDown style={{ fontSize: '1rem' }} />}
                  <span>{dailyChange >= 0 ? '+' : ''}{formatTL(dailyChange, 0)}</span>
                </>
              );
            })()}
          </div>
        </div>

        {/* Bottom Right: Toplam Yatırılan */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            Toplam Yatırılan
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: '4px' }}>
            {formatTL(portfolio.totalInvested, 0)}
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
              const isUp = w.profitLoss >= 0;
              return (
                <div
                  key={w.id}
                  className="tx-item"
                  style={{ cursor: 'default', background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.03)', padding: '10px 12px' }}
                >
                  <div className="tx-left" style={{ gap: '10px' }}>
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
                        {w.assetBalances.displayValue}
                      </div>
                      {editingCostWalletId === w.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
                          <select
                            value={editingCostAsset}
                            onChange={e => setEditingCostAsset(e.target.value)}
                            style={{
                              fontSize: '0.62rem',
                              padding: '2px 4px',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '4px',
                              color: 'var(--text-bright)',
                            }}
                          >
                            {['Dolar', 'Euro', 'Döviz'].includes(w.type) ? (
                              <>
                                <option value="USD">Dolar ($)</option>
                                <option value="EUR">Euro (€)</option>
                              </>
                            ) : (
                              <>
                                <option value="Altın">Altın (gr)</option>
                                <option value="Gümüş">Gümüş (gr)</option>
                              </>
                            )}
                          </select>
                          <input
                            type="text"
                            value={editingCostRate}
                            onChange={e => setEditingCostRate(e.target.value)}
                            placeholder="Kur girin"
                            style={{
                              width: '70px',
                              fontSize: '0.62rem',
                              padding: '2px 4px',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '4px',
                              color: 'var(--text-bright)',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveCostRate(w.id)}
                            disabled={costSaving}
                            style={{
                              fontSize: '0.58rem',
                              padding: '2px 6px',
                              background: 'var(--primary)',
                              border: 'none',
                              borderRadius: '4px',
                              color: 'white',
                              cursor: 'pointer',
                            }}
                          >
                            {costSaving ? '...' : 'Kaydet'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCostWalletId(null);
                              setEditingCostRate('');
                            }}
                            style={{
                              fontSize: '0.58rem',
                              padding: '2px 6px',
                              background: 'rgba(255,255,255,0.1)',
                              border: 'none',
                              borderRadius: '4px',
                              color: 'var(--text-bright)',
                              cursor: 'pointer',
                            }}
                          >
                            İptal
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <span>Maliyet: {w.hasCostData ? formatTL(w.averageCost) : 'Maliyet verisi yok'}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCostWalletId(w.id);
                              setEditingCostRate(w.hasCostData ? w.averageCost.toFixed(4) : '');
                              setEditingCostAsset(['Altın', 'Gümüş', 'Maden'].includes(w.type) ? 'Altın' : 'USD');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              cursor: 'pointer',
                              padding: 0,
                              fontSize: '0.6rem',
                              textDecoration: 'underline',
                            }}
                          >
                            {w.hasCostData ? 'Düzenle' : 'Maliyet Gir'}
                          </button>
                        </div>
                      )}
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
                      {w.hasCostData ? (
                        <>
                          {isUp ? <FiTrendingUp /> : <FiTrendingDown />}
                          Kâr: {isUp ? '+' : ''}{formatTL(w.profitLoss, 0)}
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Güncel: {formatTL(w.liveRate)}</span>
                      )}
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
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-bright)', display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    {rate.label}
                    {isOwned && (
                      <span style={{ fontSize: '0.55rem', color: '#60a5fa', background: 'rgba(59,130,246,0.15)', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
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
