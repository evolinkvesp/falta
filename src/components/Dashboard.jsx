import React, { useState, useEffect } from 'react'
import { Search, Plus, Clock, Calendar, CheckCircle, Zap, ShoppingCart, Users, Package, DollarSign, ArrowUpRight, ArrowDownRight, SlidersHorizontal, Activity, Target, ShieldCheck, Globe, RefreshCcw, Sparkles, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Dashboard({ onNew, onViewQuote }) {
  const [quotes, setQuotes] = useState([])
  const [supplierCount, setSupplierCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const { data: qData, error: qError } = await supabase
        .from('cotacoes_mestre')
        .select('*')
        .order('data_criacao', { ascending: false })
      
      if (qError) throw qError
      setQuotes(qData || [])

      const { count, error: sError } = await supabase
        .from('fornecedores')
        .select('*', { count: 'exact', head: true })
      
      if (sError) throw sError
      setSupplierCount(count || 0)

    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const activeCount = quotes.filter(q => q.status === 'AGUARDANDO_FORNECEDORES' || q.status === 'ABERTA').length
  const completedCount = quotes.filter(q => q.status === 'FINALIZADA').length

  const stats = [
    { label: 'Cotações Totais', value: quotes.length, icon: Package, color: '#FF5722', trend: 'Base de Dados' },
    { label: 'Cotações Ativas', value: activeCount, icon: Activity, color: '#FF5722', trend: 'Aguardando' },
    { label: 'Fornecedores', value: supplierCount, icon: Users, color: '#1A1C1E', trend: 'Cadastrados' },
    { label: 'Finalizadas', value: completedCount, icon: Target, color: '#64748B', trend: 'Concluídas' },
  ]

  if (loading) {
    return (
      <div className="p-24 text-center">
        <Loader2 className="animate-spin mx-auto text-[#FF5722] mb-6" size={48} />
        <p className="text-xs font-bold text-slate-300 uppercase tracking-[0.3em]">Alice Farma is syncing...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 px-2">
        <div className="space-y-4">
           <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sistema Operacional Alice</span>
           </div>
           <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-none">Painel de Controle</h1>
           <p className="text-sm text-slate-500 font-medium max-w-md">
              Bem-vindo à <span className="text-[#FF5722] font-extrabold">Alice Farma</span>. 
              Gere e monitore suas cotações em tempo real.
           </p>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={fetchData} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-[#FF5722] transition-all shadow-sm">
             <RefreshCcw size={18} />
           </button>
           <div className="bg-white border border-slate-100 rounded-2xl px-6 py-3.5 flex items-center gap-4 text-sm font-bold text-slate-900 shadow-sm">
             <Calendar size={18} className="text-[#FF5722]" />
             {format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}
           </div>
           <button onClick={onNew} className="bg-[#FF5722] text-white px-8 py-3.5 rounded-full font-black text-sm uppercase tracking-widest shadow-xl shadow-[#FF5722]/30 hover:scale-105 active:scale-95 transition-all">
              Nova Cotação
           </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 group">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110" style={{ color: stat.color, backgroundColor: `${stat.color}08` }}>
              <stat.icon size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{stat.label}</p>
              <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight">{stat.value}</h3>
            </div>
            <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
               <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{stat.trend}</span>
               <ArrowUpRight size={14} className="text-slate-200 group-hover:text-[#FF5722] transition-colors" />
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
           <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-slate-900/20">
                 <Activity size={28} />
              </div>
              <div>
                 <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Atividades Recentes</h3>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Acompanhamento de Fluxo Operacional</p>
              </div>
           </div>
           <div className="relative group w-full md:w-auto">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#FF5722] transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Pesquisar protocolo..." 
                className="w-full md:w-96 pl-14 pr-8 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-[#FF5722]/30 focus:bg-white transition-all shadow-sm"
              />
           </div>
        </div>

        <div className="p-4 overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left">
                <th className="px-8 py-5 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Protocolo</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Registro</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Status Alice</th>
                <th className="text-right px-8"></th>
              </tr>
            </thead>
            <tbody>
              {quotes.length > 0 ? quotes.slice(0, 10).map((quote, idx) => (
                <tr key={quote.id} onClick={() => onViewQuote(quote.id)} className="group cursor-pointer">
                  <td className="px-8 py-6 bg-slate-50/50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 rounded-l-2xl transition-all">
                     <span className="font-bold text-slate-900 tracking-tight">#{quote.id.slice(0, 8).toUpperCase()}</span>
                  </td>
                  <td className="px-8 py-6 bg-slate-50/50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 transition-all">
                    <span className="text-xs font-bold text-slate-500">{format(new Date(quote.data_criacao), "dd/MM/yyyy • HH:mm", { locale: ptBR })}</span>
                  </td>
                  <td className="px-8 py-6 bg-slate-50/50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 transition-all">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      quote.status === 'FINALIZADA' ? 'bg-green-50 text-green-600' : 
                      quote.status === 'AGUARDANDO_FORNECEDORES' ? 'bg-orange-50 text-[#FF5722]' : 
                      'bg-blue-50 text-blue-600'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        quote.status === 'FINALIZADA' ? 'bg-green-600' : 
                        quote.status === 'AGUARDANDO_FORNECEDORES' ? 'bg-[#FF5722]' : 'bg-blue-600'
                      }`} />
                      {quote.status === 'FINALIZADA' ? 'Concluída' : 
                       quote.status === 'AGUARDANDO_FORNECEDORES' ? 'Em Aberto' : 'Iniciada'}
                    </div>
                  </td>
                  <td className="px-8 py-6 bg-slate-50/50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 rounded-r-2xl text-right transition-all">
                    <ChevronRight size={20} className="text-slate-200 group-hover:text-[#FF5722] transition-colors ml-auto" />
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="text-center py-24">
                     <Package size={48} className="mx-auto text-slate-100 mb-4" />
                     <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Sem atividades no momento</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

import { Loader2 } from 'lucide-react'
