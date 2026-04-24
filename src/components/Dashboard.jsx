import React, { useState, useEffect } from 'react'
import { Search, Plus, Clock, Calendar, CheckCircle, Zap, ShoppingCart, Users, Package, DollarSign, ArrowUpRight, ArrowDownRight, SlidersHorizontal, Activity, Target, ShieldCheck, Globe, RefreshCcw, Sparkles, ChevronRight, Loader2 } from 'lucide-react'
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
    { label: 'Cotações Totais', value: quotes.length, icon: Package, color: '#0EA5E9', trend: 'Base de Dados' },
    { label: 'Cotações Ativas', value: activeCount, icon: Activity, color: '#3B82F6', trend: 'Aguardando' },
    { label: 'Fornecedores', value: supplierCount, icon: Users, color: '#0D9488', trend: 'Cadastrados' },
    { label: 'Finalizadas', value: completedCount, icon: ShieldCheck, color: '#10B981', trend: 'Concluídas' },
  ]

  if (loading) {
    return (
      <div className="p-12 md:p-24 text-center">
        <Loader2 className="animate-spin mx-auto text-[#0EA5E9] mb-6" size={48} />
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-[0.3em]">Alice Farma está sincronizando...</p>
      </div>
    )
  }

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[var(--border)]">
        <div className="space-y-3">
           <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Painel de Controle</span>
           </div>
           <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-main)] tracking-tight leading-none">Painel Geral</h1>
           <p className="text-sm text-[var(--text-muted)] font-medium max-w-md">
              Gere e monitore suas cotações em tempo real com inteligência.
           </p>
        </div>
        <div className="flex items-center gap-3">
           <div className="hidden lg:flex bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-6 py-3.5 items-center gap-4 text-sm font-bold text-[var(--text-main)]">
             <Calendar size={18} className="text-[#0EA5E9]" />
             {format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}
           </div>
           <button onClick={onNew} className="btn-primary">
              Nova Cotação
           </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-[var(--bg-card)] p-6 md:p-8 rounded-[1.5rem] border border-[var(--border)] shadow-sm hover:shadow-xl transition-all duration-500 group">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform" style={{ color: stat.color, backgroundColor: `${stat.color}15` }}>
              <stat.icon size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em]">{stat.label}</p>
              <h3 className="text-3xl md:text-4xl font-extrabold text-[var(--text-main)] tracking-tight">{stat.value_real ?? stat.value}</h3>
            </div>
            <div className="mt-6 pt-6 border-t border-[#F1F5F9] flex items-center justify-between">
               <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{stat.trend}</span>
               <ArrowUpRight size={14} className="text-[#CBD5E1] group-hover:text-[#0EA5E9] transition-colors" />
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity Table */}
      <div className="bg-[var(--bg-card)] rounded-[2rem] border border-[var(--border)] shadow-sm overflow-hidden !p-0">
        <div className="p-8 md:p-10 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
           <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-[var(--accent)] text-[#0EA5E9] rounded-2xl flex items-center justify-center shadow-inner">
                 <Activity size={28} />
              </div>
              <div>
                 <h3 className="text-2xl font-extrabold text-[var(--text-main)] tracking-tight">Cotações Recentes</h3>
                 <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">Fluxo de Protocolos Ativos</p>
              </div>
           </div>
           <div className="relative group min-w-[300px]">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[#0EA5E9]" size={18} />
              <input 
                type="text" 
                placeholder="Pesquisar protocolo..." 
                className="w-full pl-14 pr-8 py-4 bg-[var(--bg-main)] border border-[var(--border)] rounded-2xl text-sm font-bold text-[var(--text-main)] outline-none focus:border-[#0EA5E9]/30 transition-all placeholder:text-[var(--text-muted)]/50"
              />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="modern-table">
            <thead>
              <tr>
                <th>ID Protocolo</th>
                <th className="hidden md:table-cell">Data de Registro</th>
                <th>Status Operacional</th>
                <th className="text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {quotes.length > 0 ? quotes.slice(0, 10).map((quote, idx) => (
                <tr key={quote.id} onClick={() => onViewQuote(quote.id)} className="hover:bg-[var(--accent)]/50 cursor-pointer transition-colors group">
                  <td className="font-bold text-[var(--text-main)]">#{quote.id.slice(0, 8).toUpperCase()}</td>
                  <td className="hidden md:table-cell text-xs font-bold text-[var(--text-muted)]">
                    {format(new Date(quote.data_criacao), "dd/MM/yyyy • HH:mm", { locale: ptBR })}
                  </td>
                  <td>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      quote.status === 'FINALIZADA' ? 'bg-green-500/10 text-green-600' : 
                      quote.status === 'AGUARDANDO_FORNECEDORES' ? 'bg-amber-500/10 text-amber-600' : 
                      'bg-blue-500/10 text-blue-600'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {quote.status === 'FINALIZADA' ? 'Concluída' : 
                       quote.status === 'AGUARDANDO_FORNECEDORES' ? 'Aguardando' : 'Iniciada'}
                    </div>
                  </td>
                  <td className="text-right">
                    <ChevronRight size={18} className="text-[var(--text-muted)] ml-auto group-hover:text-[#0EA5E9] transition-colors" />
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="text-center py-24">
                     <Package size={40} className="mx-auto text-[var(--text-muted)] mb-4 opacity-20" />
                     <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Nenhuma cotação encontrada</p>
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
