import { FiPieChart, FiList, FiCreditCard, FiTrendingUp, FiDollarSign } from 'react-icons/fi';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  hasBorsaWallet: boolean;
  hasDovizMadenWallet: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, hasBorsaWallet, hasDovizMadenWallet }) => {
  const navItems = [
    { id: 'dashboard', label: 'Özet', icon: <FiPieChart /> },
    { id: 'transactions', label: 'İşlemler', icon: <FiList /> },
    { id: 'wallets', label: 'Cüzdanlar', icon: <FiCreditCard /> },
    ...(hasBorsaWallet ? [{ id: 'borsa', label: 'Borsa', icon: <FiTrendingUp /> }] : []),
    ...(hasDovizMadenWallet ? [{ id: 'doviz', label: 'Döviz/Maden', icon: <FiDollarSign /> }] : []),
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
          onClick={() => setActiveTab(item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

