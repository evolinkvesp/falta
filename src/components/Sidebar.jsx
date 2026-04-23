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
    <div className="sidebar bg-white border-r border-[#E2E8F0] flex flex-col p-6 h-full">
      {/* Branding */}
      <div className="flex items-center gap-3 mb-12 px-2">
        <div className="w-10 h-10 bg-[#FF5722] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#FF5722]/20">
          <Zap size={22} fill="white" />
        </div>
        <div>
          <span className="text-xl font-extrabold tracking-tight text-[#1A1C1E] block leading-none">Alice Farma</span>
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mt-1 block">Inteligência SaaS</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.2em] mb-4 ml-2">Menu Principal</p>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full group flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 ${
              currentView === item.id 
              ? 'bg-[#FF5722] text-white shadow-xl shadow-[#FF5722]/30 font-bold' 
              : 'text-[#64748B] hover:bg-[#F8F9FA] hover:text-[#1A1C1E]'
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon size={20} className={currentView === item.id ? 'text-white' : 'text-[#94A3B8] group-hover:text-[#1A1C1E]'} />
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

      {/* User Profile Section at Bottom */}
      <div className="mt-auto space-y-4">
        <div className="p-4 bg-[#F8F9FA] rounded-[1.25rem] border border-[#E2E8F0] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center text-[#1A1C1E] font-black shadow-sm">
            RA
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-[#1A1C1E] truncate">Ryan Asafe</p>
            <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-widest truncate">Administrador</p>
          </div>
        </div>
        <button className="flex items-center gap-3 w-full px-4 py-3 text-sm font-bold text-[#64748B] hover:text-[#FF5722] hover:bg-[#FF5722]/5 rounded-xl transition-all group">
          <LogOut size={18} className="text-[#94A3B8] group-hover:text-[#FF5722]" />
          <span>Sair da Conta</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
