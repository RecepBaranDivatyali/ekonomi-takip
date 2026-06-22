import React from 'react';
import { FiPieChart, FiList, FiCreditCard, FiTrendingUp, FiGrid, FiTag } from 'react-icons/fi';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  hasBorsaWallet: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, hasBorsaWallet }) => {
  const navItems = [
    { id: 'dashboard', label: 'Özet', icon: <FiPieChart /> },
    { id: 'transactions', label: 'İşlemler', icon: <FiList /> },
    { id: 'wallets', label: 'Cüzdanlar', icon: <FiCreditCard /> },
    ...(hasBorsaWallet ? [{ id: 'borsa', label: 'Borsa', icon: <FiTrendingUp /> }] : []),
    { id: 'categories', label: 'Kategoriler', icon: <FiGrid /> },
    { id: 'tags', label: 'Etiketler', icon: <FiTag /> },
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

