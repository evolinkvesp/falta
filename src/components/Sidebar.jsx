import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, LogOut, PackageSearch, Zap, PlusCircle, Bell, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Sidebar = ({ currentView, onViewChange }) => {
  const [activeSuppliers, setActiveSuppliers] = useState(0);

  useEffect(() => {
    async function getStats() {
      const { count } = await supabase
        .from('fornecedores')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo');
      setActiveSuppliers(count || 0);
    }
    getStats();
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cotar', label: 'Nova Cotação', icon: PlusCircle },
    { id: 'fornecedores', label: 'Fornecedores', icon: Users, badge: activeSuppliers },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="desktop-sidebar sidebar bg-[#0F1113] border-r border-[#22262B] flex flex-col p-6 h-full">
        {/* Branding */}
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="w-10 h-10 bg-[#FF5722] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#FF5722]/20">
            <Zap size={22} fill="white" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-[#F8F9FA] block leading-none">Alice Farma</span>
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mt-1 block">Inteligência SaaS</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-[0.2em] mb-4 ml-2">Menu Principal</p>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full group flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 ${
                currentView === item.id 
                ? 'bg-[#FF5722] text-white shadow-xl shadow-[#FF5722]/30 font-bold' 
                : 'text-[#94A3B8] hover:bg-[#1A1C1E] hover:text-[#F8F9FA]'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon size={20} className={currentView === item.id ? 'text-white' : 'text-[#64748B] group-hover:text-[#F8F9FA]'} />
                <span className="text-sm tracking-tight">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  currentView === item.id ? 'bg-white/20 border-white/20 text-white' : 'bg-[#FF5722]/10 text-[#FF5722] border-[#FF5722]/20'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`mobile-nav-btn ${currentView === item.id ? 'active' : ''}`}
          >
            <item.icon size={22} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
};

export default Sidebar;
