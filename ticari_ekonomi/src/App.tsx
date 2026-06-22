import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Auth } from './components/Auth';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { Transactions } from './components/Transactions';
import { Wallets } from './components/Wallets';
import { Categories } from './components/Categories';
import { Tags } from './components/Tags';
import { Borsa } from './components/Borsa';
import { DovizMaden } from './components/DovizMaden';
import { fetchAllRatesData, fetchLiveStockPrices, DEFAULT_RATES } from './services/currencyService';
import type { ExchangeRates, CurrencyRate } from './services/currencyService';
import { FiAlertCircle } from 'react-icons/fi';
import './App.css';

interface Wallet {
  id: string;
  name: string;
  type: 'Vadesiz' | 'Vadeli' | 'Dolar' | 'Euro' | 'Altın' | 'Gümüş' | 'Borsa_TRY' | 'Borsa_USD' | 'Kredi_Karti';
  color: string;
  balance: number;
  interest_rate: number;
  maturity_days: number;
  last_interest_date: string;
  created_at?: string;
  cash_balance?: number;
  credit_limit?: number;
  due_date?: number;
}

interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  type: 'Gelir' | 'Gider';
  user_id: string | null;
}

interface Tag {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface UserStock {
  id: string;
  user_id: string;
  wallet_id: string;
  symbol: string;
  shares_count: number;
  average_cost: number;
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

function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // DB States
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [userStocks, setUserStocks] = useState<UserStock[]>([]);

  // Simulated & live BIST stock prices and changes
  const [stockPrices, setStockPrices] = useState<{ [key: string]: { price: number; change: number } }>({
    // Turkish Funds Fallbacks
    AFT: { price: 1.048200, change: 0.85 },
    MAC: { price: 0.838200, change: -0.42 },
    TTE: { price: 1.695600, change: 1.15 },
    YAS: { price: 14.500300, change: 0.60 },
    IPJ: { price: 21.164800, change: -0.15 },
    GMR: { price: 1.475300, change: 1.30 },
    IIH: { price: 33.674900, change: -0.80 },
    PNU: { price: 1.137246, change: 0.12 },
    PRY: { price: 2.914402, change: 0.08 },
    TP2: { price: 2.001750, change: 0.15 },

    // BIST Non-API Stock Fallbacks
    LIDER: { price: 99.25, change: 0.00 },

    // US Stocks & ETFs (USD Borsa)
    AAPL: { price: 215.30, change: 0.45 },
    MSFT: { price: 442.10, change: -0.22 },
    TSLA: { price: 228.40, change: 1.85 },
    NVDA: { price: 924.50, change: 3.10 },
    AMZN: { price: 188.75, change: -0.15 },
    GOOGL: { price: 178.20, change: 0.65 },
    META: { price: 485.40, change: 1.10 },
    NFLX: { price: 625.90, change: -0.85 },
    SPY: { price: 542.30, change: 0.12 },
    QQQ: { price: 468.50, change: 0.25 },
    VOO: { price: 498.15, change: 0.15 },
    ARKK: { price: 44.60, change: -1.20 },
    GLD: { price: 224.80, change: 0.75 },
    TLT: { price: 92.40, change: -0.35 }
  });

  // Fetch and update live stock prices (with 30-second polling & US/fund simulations)
  useEffect(() => {
    const updateStockPrices = async () => {
      try {
        const prices = await fetchLiveStockPrices();
        setStockPrices(prev => {
          const nextPrices = { ...prev, ...prices };
          
          // Random walk for custom symbols (US stocks)
          const customKeys = [
            'AAPL', 'MSFT', 'TSLA', 'NVDA', 'AMZN', 'GOOGL', 'META', 'NFLX',
            'SPY', 'QQQ', 'VOO', 'ARKK', 'GLD', 'TLT'
          ];
          customKeys.forEach(key => {
            if (nextPrices[key]) {
              const current = nextPrices[key];
              const drift = (Math.random() - 0.5) * 0.004; // max 0.2% change
              // Funds use 6 decimal places, stocks use 2 decimal places
              const decimals = key.length === 3 && !['QQQ', 'SPY', 'VOO', 'GLD', 'TLT'].includes(key) ? 6 : 2;
              const newPrice = Number((current.price * (1 + drift)).toFixed(decimals));
              const newChange = Number((current.change + drift * 100).toFixed(2));
              nextPrices[key] = { price: newPrice, change: newChange };
            }
          });
          
          return nextPrices;
        });
      } catch (error) {
        console.error('Failed to fetch live stock prices:', error);
      }
    };

    updateStockPrices(); // Initial fetch
    const interval = setInterval(updateStockPrices, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Filter selection
  const [selectedWalletId, setSelectedWalletId] = useState<string>('all');

  // Rates State
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_RATES);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);
  const [ratesError, setRatesError] = useState(false);
  const [hasCheckedInterest, setHasCheckedInterest] = useState(false);

  // Fetch and update exchange rates (with 60-second polling)
  useEffect(() => {
    const updateRates = async () => {
      try {
        const { rates, currencyRates } = await fetchAllRatesData();
        setRates(rates);
        setCurrencyRates(currencyRates);
        setRatesError(false);
      } catch (err) {
        console.error('Failed to fetch rates', err);
        setRates(DEFAULT_RATES);
        setRatesError(true);
      }
    };

    updateRates(); // Initial fetch
    const interval = setInterval(updateRates, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Listen to Auth State
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check and process Vadeli accounts interest accruals
  const checkAndProcessInterest = async (
    walletsList: Wallet[],
    categoriesList: Category[],
    userId: string
  ) => {
    const vadeliWallets = walletsList.filter(
      (w) => w.type === 'Vadeli' && Number(w.interest_rate) > 0 && w.maturity_days > 0
    );

    if (vadeliWallets.length === 0) return false;

    let hasUpdates = false;
    const alertMessages: string[] = [];

    for (const wallet of vadeliWallets) {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayTime = new Date(todayStr).getTime();
      const lastInterestDateVal = wallet.last_interest_date || wallet.created_at || todayStr;
      const lastInterestTime = new Date(lastInterestDateVal.split('T')[0]).getTime();
      const maturityMs = wallet.maturity_days * 24 * 60 * 60 * 1000;

      if (todayTime >= lastInterestTime + maturityMs) {
        let cycles = 0;
        let currentBalance = Number(wallet.balance);
        let tempLastInterestTime = lastInterestTime;
        const interestTxLog = [];

        while (todayTime >= tempLastInterestTime + maturityMs) {
          // Faiz = Bakiye * (Oran / 100) * (Vade Gün / 365) * 0.95 (%5 stopaj)
          const grossInterest = currentBalance * (Number(wallet.interest_rate) / 100) * (wallet.maturity_days / 365);
          const netInterest = Number((grossInterest * 0.95).toFixed(2));

          if (netInterest <= 0) break;

          currentBalance = Number((currentBalance + netInterest).toFixed(2));
          tempLastInterestTime += maturityMs;
          cycles++;

          const cycleDateStr = new Date(tempLastInterestTime).toISOString().split('T')[0];
          interestTxLog.push({
            netInterest,
            dateStr: cycleDateStr,
          });
        }

        if (cycles > 0) {
          hasUpdates = true;
          const finalLastInterestDate = new Date(tempLastInterestTime).toISOString().split('T')[0];

          // 1. Update wallet balance and last_interest_date in Supabase
          const { error: walletError } = await supabase
            .from('wallets')
            .update({
              balance: currentBalance,
              last_interest_date: finalLastInterestDate,
            })
            .eq('id', wallet.id);

          if (walletError) {
            console.error('Faiz güncellenirken hata oluştu:', walletError);
            continue;
          }

          // 2. Insert transaction history logs
          const faizCategory = categoriesList.find(
            (c) => c.name === 'Faiz & Yatırım' && c.type === 'Gelir'
          );
          const categoryId = faizCategory ? faizCategory.id : null;

          for (const tx of interestTxLog) {
            const { error: txError } = await supabase.from('transactions').insert({
              user_id: userId,
              wallet_id: wallet.id,
              category_id: categoryId,
              amount: tx.netInterest,
              description: `${wallet.name} - %${wallet.interest_rate} Faiz Getirisi (${wallet.maturity_days} Günlük Vade)`,
              date: tx.dateStr,
              time_range: '09:00 - 17:00',
            });
            if (txError) {
              console.error('Faiz işlem kaydı eklenirken hata oluştu:', txError);
            }
          }

          const totalEarned = Number((currentBalance - wallet.balance).toFixed(2));
          alertMessages.push(
            `"${wallet.name}" vadeli hesabınızın ${cycles} adet vade dönemi tamamlandı! Hesabınıza toplamda +${totalEarned} ₺ net faiz geliri otomatik olarak yansıtıldı.`
          );
        }
      }
    }

    if (hasUpdates) {
      if (alertMessages.length > 0) {
        alert(alertMessages.join('\n\n'));
      }
      return true;
    }
    return false;
  };

  // Fetch all user data from Supabase
  const fetchUserData = useCallback(async () => {
    setDataLoading(true);
    try {
      // 1. Fetch Wallets
      const { data: walletsData, error: wError } = await supabase
        .from('wallets')
        .select('*')
        .order('name', { ascending: true });
      if (wError) throw wError;
      setWallets(walletsData || []);

      // 2. Fetch Categories (Rls automatically filters defaults + custom)
      const { data: categoriesData, error: cError } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
      if (cError) throw cError;
      setCategories(categoriesData || []);

      // 3. Fetch Tags
      const { data: tagsData, error: tagError } = await supabase
        .from('tags')
        .select('*')
        .order('name', { ascending: true });
      if (tagError) throw tagError;
      setTags(tagsData || []);

      // 4. Fetch Transactions
      const { data: transactionsData, error: tError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });
      if (tError) throw tError;
      setTransactions(transactionsData || []);

      // 5. Fetch Debts
      const { data: debtsData, error: dError } = await supabase
        .from('debts')
        .select('*')
        .order('created_at', { ascending: false });
      if (dError) throw dError;
      setDebts(debtsData || []);

      // 6. Fetch User Stocks
      const { data: stocksData, error: sError } = await supabase
        .from('user_stocks')
        .select('*')
        .order('symbol', { ascending: true });
      if (sError) throw sError;
      setUserStocks(stocksData || []);

      // Check interest if not checked in this session yet
      if (session?.user?.id && !hasCheckedInterest && walletsData && categoriesData) {
        setHasCheckedInterest(true);
        const didUpdate = await checkAndProcessInterest(walletsData, categoriesData, session.user.id);
        if (didUpdate) {
          // Re-fetch wallets and transactions since they were updated in database
          const { data: updatedWallets } = await supabase
            .from('wallets')
            .select('*')
            .order('name', { ascending: true });
          setWallets(updatedWallets || []);

          const { data: updatedTransactions } = await supabase
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });
          setTransactions(updatedTransactions || []);
        }
      }
    } catch (err: any) {
      console.error('Error fetching data from Supabase:', err.message);
    } finally {
      setDataLoading(false);
    }
  }, [session, hasCheckedInterest]);

  // Load data when session is established
  useEffect(() => {
    if (session?.user?.id) {
      fetchUserData();
    } else {
      // Clear states if logged out
      setWallets([]);
      setCategories([]);
      setTags([]);
      setTransactions([]);
      setDebts([]);
      setUserStocks([]);
      setHasCheckedInterest(false);
    }
  }, [session, fetchUserData]);

  const handleSignOut = async () => {
    if (window.confirm('Oturumu kapatmak istediğinize emin misiniz?')) {
      await supabase.auth.signOut();
      setActiveTab('dashboard');
    }
  };

  const handleRefresh = () => {
    if (session?.user?.id) {
      fetchUserData();
    }
  };

  // Dynamic wallets with simulated stock portfolio values
  const computedWallets = useMemo(() => {
    return wallets.map(w => {
      if (w.type === 'Borsa_TRY' || w.type === 'Borsa_USD') {
        const stocks = userStocks.filter(s => s.wallet_id === w.id);
        const stockVal = stocks.reduce((sum, s) => {
          const sym = s.symbol === 'THY' ? 'THYAO' : s.symbol.toUpperCase();
          const quote = stockPrices[sym];
          const price = quote ? quote.price : (Number(s.average_cost) || 0);
          return sum + Number(s.shares_count) * price;
        }, 0);
        return {
          ...w,
          cash_balance: Number(w.balance),
          balance: Number((Number(w.balance) + stockVal).toFixed(2))
        } as Wallet;
      }
      return w;
    });
  }, [wallets, userStocks, stockPrices]);

  // If active tab is borsa but no borsa wallets exist, redirect to dashboard
  useEffect(() => {
    if (activeTab === 'borsa') {
      const hasBorsa = computedWallets.some(w => w.type === 'Borsa_TRY' || w.type === 'Borsa_USD');
      if (computedWallets.length > 0 && !hasBorsa) {
        setActiveTab('dashboard');
      }
    }
  }, [computedWallets, activeTab]);

  // If active tab is doviz but no doviz wallets exist, redirect to dashboard
  useEffect(() => {
    if (activeTab === 'doviz') {
      const hasDovizMaden = computedWallets.some(w => ['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(w.type));
      if (computedWallets.length > 0 && !hasDovizMaden) {
        setActiveTab('dashboard');
      }
    }
  }, [computedWallets, activeTab]);

  // Render Loading Screen
  if (authLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#07090e',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '3px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: '#3b82f6',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px',
          }}
        />
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
          Yükleniyor...
        </span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Render Auth screen if no user is signed in
  if (!session) {
    return (
      <div className="app-frame" style={{ justifyContent: 'center' }}>
        <Auth onAuthSuccess={() => {}} />
      </div>
    );
  }

  return (
    <div className="app-frame">
            <div className="app-content">
              {ratesError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    borderColor: 'rgba(239, 68, 68, 0.25)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    color: '#fca5a5',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    textAlign: 'left',
                  }}
                >
                  <FiAlertCircle style={{ flexShrink: 0, fontSize: '1.1rem', color: '#f87171' }} />
                  <span>
                    Güncel döviz kurları çekilemedi. Son çevrimdışı kurlar veya sabit değerler kullanılıyor.
                  </span>
                </div>
              )}
      
              {dataLoading && (
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    borderTopColor: '#3b82f6',
                    animation: 'spin 1s linear infinite',
                    zIndex: 1000,
                  }}
                />
              )}
      
              {/* Tab Routing */}
              {activeTab === 'dashboard' && (
                <Dashboard
                  wallets={computedWallets}
                  categories={categories}
                  transactions={transactions}
                  debts={debts}
                  selectedWalletId={selectedWalletId}
                  setSelectedWalletId={setSelectedWalletId}
                  onSignOut={handleSignOut}
                  rates={rates}
                  tags={tags}
                  userEmail={session?.user?.email}
                />
              )}
      
              {activeTab === 'transactions' && (
                <Transactions
                  wallets={computedWallets}
                  categories={categories}
                  tags={tags}
                  transactions={transactions}
                  debts={debts}
                  onRefreshData={handleRefresh}
                  userId={session.user.id}
                />
              )}
      
              {activeTab === 'wallets' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  <Wallets
                    wallets={computedWallets}
                    onRefreshData={handleRefresh}
                    userId={session.user.id}
                    rates={rates}
                  />
                  <Tags
                    tags={tags}
                    transactions={transactions}
                    categories={categories}
                    wallets={computedWallets}
                    onRefreshData={handleRefresh}
                    userId={session.user.id}
                  />
                  <Categories
                    categories={categories}
                    onRefreshData={handleRefresh}
                    userId={session.user.id}
                  />
                </div>
              )}
      
              {activeTab === 'borsa' && (
                <Borsa
                  wallets={computedWallets}
                  userStocks={userStocks}
                  stockPrices={stockPrices}
                  transactions={transactions}
                  onRefreshData={handleRefresh}
                  userId={session.user.id}
                />
              )}
      
              {activeTab === 'doviz' && (
                <DovizMaden
                  wallets={computedWallets}
                  rates={rates}
                  currencyRates={currencyRates}
                  transactions={transactions}
                  categories={categories}
                  onRefreshData={handleRefresh}
                  userId={session.user.id}
                />
              )}
            </div>

      {/* Sticky Tab Navigation Footer */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        hasBorsaWallet={computedWallets.some(w => w.type === 'Borsa_TRY' || w.type === 'Borsa_USD')}
        hasDovizMadenWallet={computedWallets.some(w => ['Dolar', 'Euro', 'Altın', 'Gümüş'].includes(w.type))}
      />
    </div>
  );
}

export default App;
