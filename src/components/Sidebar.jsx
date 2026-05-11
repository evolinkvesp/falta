import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, LogOut, PackageSearch, PlusSquare, PlusCircle, Bell, Settings, Activity, Moon, Sun } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import logo from '../assets/logo.png';

const Sidebar = ({ currentView, onViewChange }) => {
  const { profile, signOut } = useAuth();
  const [activeSuppliers, setActiveSuppliers] = useState(0);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    if (!profile?.farmacia_id) return;

    async function getStats() {
      const { count } = await supabase
        .from('fornecedores')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo')
        .eq('farmacia_id', profile.farmacia_id);
      setActiveSuppliers(count || 0);
    }
    getStats();
  }, [profile]);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cotar', label: 'Nova Cotação', icon: PlusCircle },
    { id: 'fornecedores', label: 'Fornecedores', icon: Users, badge: activeSuppliers },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  return (
      <div className="desktop-sidebar sidebar bg-[var(--bg-sidebar)] border-r border-[var(--border)] flex flex-col p-6 h-full transition-colors duration-300">
        {/* Branding */}
        <div className="flex items-center gap-3 mb-10 px-1">
          <img 
            src={logo} 
            alt="Alice Farma" 
            className={`h-24 w-auto transition-all duration-300 ${isDark ? 'invert brightness-200' : ''}`}
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4 ml-2">Menu Principal</p>
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              aria-current={currentView === item.id ? 'page' : undefined}
              className={`w-full group flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 ${
                currentView === item.id 
                ? 'bg-[#0EA5E9] text-white shadow-xl shadow-[#0EA5E9]/30 font-bold' 
                : 'text-[var(--text-muted)] hover:bg-[var(--accent)] hover:text-[#0EA5E9]'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-sidebar)]`}
            >
              <div className="flex items-center gap-3">
                <item.icon size={20} className={currentView === item.id ? 'text-white' : 'text-[var(--text-muted)] group-hover:text-[#0EA5E9]'} />
                <span className="text-sm tracking-tight">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  currentView === item.id ? 'bg-[var(--bg-card)]/20 border-white/20 text-white' : 'bg-[#0EA5E9]/10 text-[#0EA5E9] border-[#0EA5E9]/20'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom Actions: Theme Toggle & Logout */}
        <div className="pt-6 border-t border-[var(--border)] space-y-2">
          <button 
            type="button"
            onClick={() => setIsDark(!isDark)}
            aria-pressed={isDark}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[var(--text-muted)] hover:bg-[var(--accent)] hover:text-[#0EA5E9] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-sidebar)]"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
            <span className="text-sm font-semibold">{isDark ? 'Modo Claro' : 'Modo Noite'}</span>
          </button>
          <button 
            type="button"
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-sidebar)]"
          >
            <LogOut size={20} />
            <span className="text-sm font-semibold">Sair</span>
          </button>
        </div>
      </div>
  );
};

export default Sidebar;
