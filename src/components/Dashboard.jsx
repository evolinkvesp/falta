import React, { useState, useEffect } from 'react'
import { 
  Search, Plus, Clock, Calendar, CheckCircle, Zap, ShoppingCart, 
  Users, Package, DollarSign, ArrowUpRight, ArrowDownRight, 
  SlidersHorizontal, Activity, Target, ShieldCheck, Globe, 
  RefreshCcw, Sparkles, ChevronRight, Loader2, AlertTriangle, TrendingUp,
  ClipboardList, FileText, Trash2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '../lib/AuthContext'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar 
} from 'recharts'

export default function Dashboard({ onNew, onViewQuote }) {
  const { profile } = useAuth()
  const [quotes, setQuotes] = useState([])
  const [supplierCount, setSupplierCount] = useState(0)
  const [savingsData, setSavingsData] = useState([])
  const [criticalItemsCount, setCriticalItemsCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile?.farmacia_id) {
      fetchData()
    }
  }, [profile])

  async function fetchData() {
    try {
      setLoading(true)
      // 1. Cotações
      const { data: qData } = await supabase
        .from('cotacoes_mestre')
        .select('*')
        .eq('farmacia_id', profile.farmacia_id)
        .order('data_criacao', { ascending: false })
      
      setQuotes(qData || [])

      // 2. Fornecedores
      const { count } = await supabase
        .from('fornecedores')
        .select('*', { count: 'exact', head: true })
        .eq('farmacia_id', profile.farmacia_id)
      
      setSupplierCount(count || 0)

      // 3. Economia e Gráficos (últimos 30 dias)
      const { data: sData } = await supabase
        .from('vw_resumo_economia')
        .select('*')
        .eq('farmacia_id', profile.farmacia_id)
        .order('data_criacao', { ascending: true })
      
      const chartData = (sData || []).map(d => ({
        name: format(new Date(d.data_criacao), 'dd/MM'),
        economia: parseFloat(d.economia_estimada) || 0,
        itens: d.total_itens
      }))
      setSavingsData(chartData)

      // 4. Itens Críticos
      const { count: critCount } = await supabase
        .from('vw_itens_criticos_validade')
        .select('*', { count: 'exact', head: true })
        .eq('farmacia_id', profile.farmacia_id)
      
      setCriticalItemsCount(critCount || 0)

    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const totalSavings = savingsData.reduce((acc, curr) => acc + curr.economia, 0)
  const activeCount = quotes.filter(q => q.status === 'AGUARDANDO_FORNECEDORES' || q.status === 'ABERTA').length
  
  const statusPieData = [
    { name: 'Concluídas', value: quotes.filter(q => q.status === 'FINALIZADA').length, color: '#10B981' },
    { name: 'Em Aberto', value: activeCount, color: '#0EA5E9' },
  ]
  
  async function handleDeleteQuote(e, id) {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja apagar esta cotação? Esta ação não pode ser desfeita.')) return;
    
    try {
      const { error } = await supabase
        .from('cotacoes_mestre')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setQuotes(quotes.filter(q => q.id !== id));
    } catch (err) {
      console.error('Error deleting quote:', err);
      alert('Erro ao apagar cotação.');
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#0EA5E9]/20 border-t-[#0EA5E9] rounded-full animate-spin"></div>
          <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#0EA5E9]" size={24} />
        </div>
        <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest animate-pulse">Inteligência Alice Sincronizando...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Dynamic Welcome Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-black text-[#0EA5E9] uppercase tracking-[0.3em]">
            <Sparkles size={12} />
            Visão Estratégica Ativa
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-[var(--text-main)] tracking-tight">
            Olá, <span className="text-[#0EA5E9]">{profile?.nome_completo?.split(' ')[0] || 'Usuário'}</span>
          </h1>
          <p className="text-sm text-[var(--text-muted)] font-medium">
            Você economizou <span className="text-[var(--text-main)] font-bold">R$ {totalSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> nas últimas cotações.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onNew} className="btn-primary shadow-xl shadow-[#0EA5E9]/20 h-[56px] px-8 rounded-2xl">
            <Plus size={20} strokeWidth={3} />
            Nova Cotação
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI: Economia Total */}
        <div className="card relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign size={80} />
          </div>
          <div className="space-y-4 relative z-10">
            <div className="w-10 h-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Economia Real</p>
              <h3 className="text-3xl font-black text-[var(--text-main)] tracking-tighter">
                R$ {totalSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-green-500">
              <ArrowUpRight size={14} /> +12% vs mês anterior
            </div>
          </div>
        </div>

        {/* KPI: Cotações Ativas */}
        <div className="card group">
          <div className="space-y-4">
            <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center">
              <Activity size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Protocolos Ativos</p>
              <h3 className="text-3xl font-black text-[var(--text-main)] tracking-tighter">{activeCount}</h3>
            </div>
            <p className="text-[10px] font-bold text-[var(--text-muted)]">Aguardando ofertas dos parceiros</p>
          </div>
        </div>

        {/* KPI: Validades Críticas */}
        <div className={`card group border-l-4 ${criticalItemsCount > 0 ? 'border-amber-500' : 'border-green-500'}`}>
          <div className="space-y-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${criticalItemsCount > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'}`}>
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Alertas Short-Date</p>
              <h3 className="text-3xl font-black text-[var(--text-main)] tracking-tighter">{criticalItemsCount}</h3>
            </div>
            <p className="text-[10px] font-bold text-[var(--text-muted)]">Itens com validade &lt; 6 meses</p>
          </div>
        </div>

        {/* KPI: Fornecedores */}
        <div className="card group">
          <div className="space-y-4">
            <div className="w-10 h-10 bg-teal-500/10 text-teal-500 rounded-xl flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Rede de Parceiros</p>
              <h3 className="text-3xl font-black text-[var(--text-main)] tracking-tighter">{supplierCount}</h3>
            </div>
            <p className="text-[10px] font-bold text-[var(--text-muted)]">Distribuidoras homologadas</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Card */}
        <div className="lg:col-span-2 card !p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="text-lg font-black text-[var(--text-main)] tracking-tight">Performance Alice</h4>
              <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">Economia estimada por cotação</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0EA5E9]"></span>
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">R$ Economia</span>
              </div>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={savingsData}>
                <defs>
                  <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--text-muted)' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--text-muted)' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-card)', 
                    border: '1px solid var(--border)', 
                    borderRadius: '16px',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="economia" 
                  stroke="#0EA5E9" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorSavings)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Card */}
        <div className="card !p-8 flex flex-col">
          <h4 className="text-lg font-black text-[var(--text-main)] tracking-tight mb-1">Status Operacional</h4>
          <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest mb-8">Ciclo de vida dos protocolos</p>
          
          <div className="flex-1 flex items-center justify-center min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-black text-[var(--text-main)]">{quotes.length}</span>
              <span className="text-[8px] font-black text-[var(--text-muted)] uppercase">Total</span>
            </div>
          </div>

          <div className="space-y-3 mt-6">
            {statusPieData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{item.name}</span>
                </div>
                <span className="text-xs font-black text-[var(--text-main)]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--accent)] text-[#0EA5E9] rounded-xl flex items-center justify-center">
              <ClipboardList size={20} />
            </div>
            <h4 className="text-xl font-black text-[var(--text-main)] tracking-tight">Últimos Protocolos</h4>
          </div>
          <button className="text-[10px] font-black text-[#0EA5E9] uppercase tracking-widest hover:underline transition-all">Ver todos</button>
        </div>

        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Identificador</th>
                  <th>Registro</th>
                  <th>Status Alice</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {quotes.slice(0, 5).map((quote) => (
                  <tr key={quote.id} onClick={() => onViewQuote(quote.id)} className="hover:bg-[var(--accent)]/50 cursor-pointer transition-colors group">
                    <td className="font-bold text-[var(--text-main)]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--bg-main)] flex items-center justify-center text-[10px] border border-[var(--border)]">
                          <FileText size={14} className="text-[var(--text-muted)]" />
                        </div>
                        #{quote.id.slice(0, 8).toUpperCase()}
                      </div>
                    </td>
                    <td className="text-xs font-bold text-[var(--text-muted)]">
                      {format(new Date(quote.data_criacao), "dd MMM, HH:mm", { locale: ptBR })}
                    </td>
                    <td>
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        quote.status === 'FINALIZADA' ? 'bg-green-500/10 text-green-600' : 
                        quote.status === 'AGUARDANDO_FORNECEDORES' ? 'bg-amber-500/10 text-amber-600' : 
                        'bg-blue-500/10 text-blue-600'
                      }`}>
                        <span className="w-1 h-1 rounded-full bg-current" />
                        {quote.status === 'FINALIZADA' ? 'Concluída' : 
                         quote.status === 'AGUARDANDO_FORNECEDORES' ? 'Pendente' : 'Ativa'}
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => handleDeleteQuote(e, quote.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all"
                          title="Apagar Cotação"
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] group-hover:text-[#0EA5E9] group-hover:bg-[#0EA5E9]/10 transition-all">
                          <ChevronRight size={18} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
