import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { 
  ArrowLeft, Send, CheckCircle, Truck, FileText, Share2, 
  BarChart3, Package, Rocket, Download, Printer, TrendingUp, 
  Award, Zap, Trash2, Maximize2, Minimize2, ChevronRight,
  TrendingDown, ShieldCheck, AlertCircle, Info, Loader2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { triggerWebhook, triggerPedidoWebhook, generateSupplierLink } from '../lib/webhook'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Cell, Legend, ReferenceLine
} from 'recharts'

export default function ComparisonView({ quoteId, onBack }) {
  const { profile } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [sendingWebhook, setSendingWebhook] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [tokens, setTokens] = useState([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [notificationProgress, setNotificationProgress] = useState({ active: false, current: 0, total: 0, supplierName: '' })

  useEffect(() => {
    fetchComparison()
    fetchTokens()
  }, [quoteId])

  useEffect(() => {
    if (quoteId && profile?.farmacia_id) {
      fetchSuppliers()
    }
  }, [quoteId, profile?.farmacia_id])

  async function fetchTokens() {
    const { data } = await supabase.from('tokens_acesso_fornecedores').select('*').eq('cotacao_id', quoteId)
    setTokens(data || [])
  }

  async function fetchSuppliers() {
    const { data } = await supabase.from('fornecedores').select('*').eq('status', 'ativo').eq('farmacia_id', profile.farmacia_id)
    setSuppliers(data || [])
  }

  async function fetchComparison() {
    try {
      const { data: results, error } = await supabase
        .from('vw_comparativo_cotacao')
        .select('*')
        .eq('cotacao_id', quoteId)
      
      if (error) throw error
      setData(results || [])
    } catch (err) {
      console.error('Error:', err)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  const groupedByItem = data.reduce((acc, curr) => {
    if (!acc[curr.item_cotacao_id]) {
      acc[curr.item_cotacao_id] = {
        id: curr.item_cotacao_id,
        nome: curr.produto_nome,
        ean: curr.produto_ean,
        quantidade: curr.quantidade || 1,
        respostas: []
      }
    }
    acc[curr.item_cotacao_id].respostas.push(curr)
    return acc
  }, {})

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-[#0EA5E9]/20 border-t-[#0EA5E9] rounded-full animate-spin"></div>
        <BarChart3 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#0EA5E9]" size={24} />
      </div>
      <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest animate-pulse">Alice Processando Ofertas...</p>
    </div>
  )

  const economy = Object.values(groupedByItem).reduce((sum, item) => {
    const prices = item.respostas.map(r => r.preco_ofertado).filter(p => p > 0)
    if (prices.length < 2) return sum
    const best = Math.min(...prices)
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length
    return sum + (avg - best) * item.quantidade
  }, 0)

  const supplierWins = suppliers.map(sup => {
    const wins = data.filter(d => d.fornecedor_id === sup.id && d.e_vencedor).length
    const totalValue = data.filter(d => d.fornecedor_id === sup.id && d.e_vencedor)
                         .reduce((acc, curr) => acc + (curr.preco_ofertado * curr.quantidade || 0), 0)
    return { ...sup, wins, totalValue }
  }).sort((a, b) => b.wins - a.wins)

  const topWinner = supplierWins[0]

  const getChartDataForItem = (item) => {
    return item.respostas.map(r => ({
      name: suppliers.find(s => s.id === r.fornecedor_id)?.nome || '---',
      preco: parseFloat(r.preco_ofertado) || 0,
      isWinner: r.e_vencedor
    })).sort((a, b) => a.preco - b.preco)
  }

  const handleConfirmOrder = async () => {
    if (!window.confirm('Deseja finalizar a cotação e enviar os pedidos automaticamente?')) return;
    
    setLoading(true)
    try {
      const { data: farmacia, error: fError } = await supabase
        .from('farmacias')
        .select('webhook_pedido, nome')
        .eq('id', profile.farmacia_id)
        .single()

      if (fError) throw fError

      const winningItems = data.filter(d => d.e_vencedor).map(item => ({
        produto: item.produto_nome,
        ean: item.produto_ean,
        quantidade: item.quantidade,
        preco_unitario: item.preco_ofertado,
        fornecedor: suppliers.find(s => s.id === item.fornecedor_id)?.nome,
        fornecedor_email: suppliers.find(s => s.id === item.fornecedor_id)?.email,
        fornecedor_whatsapp: suppliers.find(s => s.id === item.fornecedor_id)?.whatsapp,
        data_validade: item.data_validade,
        total_item: item.preco_ofertado * item.quantidade
      }))

      if (winningItems.length === 0) {
        alert('Nenhum item vencedor selecionado.')
        setLoading(false)
        return
      }

      const payload = {
        farmacia: farmacia.nome,
        quote_id: quoteId,
        data_fechamento: new Date().toISOString(),
        itens: winningItems,
        total_pedido: winningItems.reduce((acc, curr) => acc + curr.total_item, 0),
        economia_estimada: economy
      }

      setSendingWebhook(true)
      let res
      try {
        res = await triggerPedidoWebhook(payload, farmacia.webhook_pedido)
      } finally {
        setSendingWebhook(false)
      }

      if (res.success) {
        await supabase
          .from('cotacoes_mestre')
          .update({ status: 'FINALIZADA' })
          .eq('id', quoteId)

        alert('Pedido finalizado e enviado com sucesso!')
        onBack()
      } else {
        throw new Error(res.error)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que deseja apagar esta cotação? Esta ação não poderá ser desfeita.')) return;
    
    setLoading(true)
    try {
      const { error } = await supabase
        .from('cotacoes_mestre')
        .delete()
        .eq('id', quoteId);
        
      if (error) throw error;
      
      alert('Cotação apagada com sucesso.');
      onBack();
    } catch (err) {
      console.error('Error deleting quote:', err);
      alert('Erro ao apagar cotação.');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 animate-fade-in pb-36 md:pb-24">
      {sendingWebhook && (
        <div className="fixed inset-0 z-[2100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-3">
            <Loader2 className="animate-spin text-[#0EA5E9]" size={18} />
            <p className="text-sm font-black text-[var(--text-main)] tracking-tight">Enviando para o webhook…</p>
          </div>
        </div>
      )}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[var(--border)]">
        <div className="space-y-2">
          <button onClick={onBack} className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[#0EA5E9] font-bold text-[10px] uppercase tracking-[0.2em] transition-all">
            <ArrowLeft size={14} /> Voltar ao Painel
          </button>
          <h1 className="text-3xl sm:text-5xl font-black text-[var(--text-main)] tracking-tight">
            Mapa <span className="text-[#0EA5E9]">Comparativo</span>
          </h1>
          <p className="text-sm text-[var(--text-muted)] font-medium">Análise de {Object.keys(groupedByItem).length} itens com {data.length} ofertas recebidas.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => window.print()} className="w-12 h-12 flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl text-[var(--text-muted)] hover:text-[#0EA5E9] transition-all">
            <Printer size={20} />
          </button>
          <button 
            onClick={handleDelete}
            className="w-12 h-12 flex items-center justify-center bg-[var(--bg-card)] border border-red-500/20 rounded-2xl text-red-500 hover:bg-red-500/10 transition-all"
            title="Apagar Cotação"
          >
            <Trash2 size={20} />
          </button>
          <button 
             onClick={handleConfirmOrder}
             className="btn-primary h-[56px] px-8 rounded-2xl shadow-xl shadow-[#0EA5E9]/20"
          >
            <ShieldCheck size={20} strokeWidth={3} />
            Finalizar Pedido
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card relative overflow-hidden flex flex-col justify-between border-l-4 border-green-500">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Award size={120} />
          </div>
          <div className="space-y-4">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center">
                   <Award size={20} />
                </div>
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Melhor Performance</span>
             </div>
             <div>
                <h3 className="text-2xl font-black text-[var(--text-main)] tracking-tight truncate">{topWinner?.nome || 'Nenhum'}</h3>
                <p className="text-xs font-bold text-green-500 flex items-center gap-1">
                  <CheckCircle size={12} /> {topWinner?.wins} itens vencedores
                </p>
             </div>
          </div>
          <div className="mt-8 pt-6 border-t border-[var(--border)]">
             <div className="flex justify-between items-end">
                <div>
                   <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Valor do Pedido</p>
                   <p className="text-xl font-black text-[var(--text-main)]">R$ {topWinner?.totalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-right">
                   <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Market Share</p>
                   <p className="text-xl font-black text-[#0EA5E9]">{Math.round((topWinner?.wins / Object.keys(groupedByItem).length) * 100) || 0}%</p>
                </div>
             </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-[#0EA5E9] to-[#2563EB] text-white border-none shadow-2xl shadow-blue-500/20">
           <div className="h-full flex flex-col justify-between">
              <div className="space-y-2">
                 <div className="flex items-center gap-3 text-white/80">
                    <Zap size={20} fill="currentColor" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Economia Gerada</span>
                 </div>
                 <h3 className="text-4xl font-black tracking-tighter">R$ {economy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                 <p className="text-xs font-medium text-white/70">Economia estimada comparada à média de mercado.</p>
              </div>
              <div className="mt-8">
                 <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest w-fit">
                    <TrendingDown size={14} />
                    Alta Eficiência
                 </div>
              </div>
           </div>
        </div>

        <div className="card !p-6 flex flex-col">
           <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-black text-[var(--text-main)] uppercase tracking-widest">Mix de Compras</h4>
              <Info size={14} className="text-[var(--text-muted)]" />
           </div>
           <div className="flex-1 min-h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={supplierWins.slice(0, 4)}>
                    <Bar dataKey="wins" radius={[4, 4, 0, 0]}>
                       {supplierWins.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#0EA5E9' : 'var(--border)'} />
                       ))}
                    </Bar>
                    <XAxis dataKey="nome" hide />
                    <Tooltip 
                       contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}
                       labelStyle={{ display: 'none' }}
                    />
                 </BarChart>
              </ResponsiveContainer>
           </div>
           <p className="mt-4 text-[9px] text-center font-bold text-[var(--text-muted)] uppercase tracking-widest">Top 4 Fornecedores por Itens</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-[var(--text-main)] tracking-tight">Detalhamento por Item</h2>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-muted)]">
                <div className="w-3 h-3 rounded bg-[#0EA5E9]"></div> Melhor Preço
             </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
               <h2 className="text-sm font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Listagem de Itens</h2>
               <button 
                  onClick={() => setIsFullscreen(true)}
                  className="p-1.5 hover:bg-[var(--accent)] rounded-lg text-[var(--text-muted)] hover:text-[#0EA5E9] transition-all"
               >
                  <Maximize2 size={14} />
               </button>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[2rem] overflow-hidden shadow-sm">
            <div className="hidden lg:grid grid-cols-12 gap-4 px-8 py-4 bg-[var(--accent)]/30 border-b border-[var(--border)] text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
              <div className="col-span-4 text-left">Produto / EAN</div>
              <div className="col-span-1 text-center">Qtd</div>
              <div className="col-span-4 text-center">Ofertas / Distribuição</div>
              <div className="col-span-3 text-right">Melhor Valor</div>
            </div>

            <div className="divide-y divide-[var(--border)]">
              {Object.values(groupedByItem).map((item, idx) => (
                <div key={item.id} className="group hover:bg-[var(--accent)]/20 transition-all">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center px-6 lg:px-8 py-4">
                    <div className="col-span-4 flex items-center gap-4">
                      <span className="w-8 h-8 flex items-center justify-center bg-[var(--bg-main)] border border-[var(--border)] rounded-lg text-[10px] font-black text-[var(--text-muted)]">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-[var(--text-main)] truncate">{item.nome}</h4>
                        <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">EAN: {item.ean || '---'}</p>
                      </div>
                    </div>

                    <div className="col-span-1 text-center hidden lg:block">
                      <span className="px-2 py-1 bg-[var(--bg-main)] rounded-md text-[11px] font-black text-[var(--text-main)] border border-[var(--border)]">
                        {item.quantidade}
                      </span>
                    </div>

                    <div className="col-span-4 px-4">
                      {item.respostas.length > 0 ? (
                        <div className="flex items-center gap-1.5 h-6">
                          {item.respostas.sort((a,b) => a.preco_ofertado - b.preco_ofertado).map((r, rIdx) => (
                            <div 
                              key={rIdx} 
                              className={`h-full flex-1 rounded-sm transition-all ${r.e_vencedor ? 'bg-[#0EA5E9] scale-y-110 shadow-[0_0_8px_rgba(14,165,233,0.4)]' : 'bg-[var(--border)] opacity-40'}`}
                              title={`${suppliers.find(s => s.id === r.fornecedor_id)?.nome}: R$ ${r.preco_ofertado}`}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center">
                          <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-30 italic">Aguardando ofertas...</span>
                        </div>
                      )}
                    </div>

                    <div className="col-span-3 text-right">
                      {item.respostas.find(r => r.e_vencedor) ? (
                        <div className="space-y-1">
                          <div className="text-lg font-black text-green-500 leading-none">
                            R$ {item.respostas.find(r => r.e_vencedor).preco_ofertado.toFixed(2)}
                          </div>
                          <div className="flex items-center justify-end gap-1.5 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-tight">
                             <Truck size={10} className="text-[#0EA5E9]" />
                             {suppliers.find(s => s.id === item.respostas.find(r => r.e_vencedor).fornecedor_id)?.nome}
                          </div>
                        </div>
                      ) : (
                        <AlertCircle size={14} className="ml-auto text-[var(--text-muted)] opacity-20" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Submit Footer */}
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-[90]">
        <div className="flex items-center justify-between bg-[var(--bg-card)]/80 backdrop-blur-xl border border-[var(--border)] p-4 md:p-6 rounded-[2rem] shadow-2xl shadow-black/5">
           <div className="flex items-center gap-4">
              <div className="hidden sm:flex -space-x-3">
                 {suppliers.slice(0, 3).map((s, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-[var(--bg-main)] border-2 border-[var(--bg-card)] flex items-center justify-center text-[8px] font-black text-[var(--text-muted)] uppercase">
                       {s.nome.substring(0, 2)}
                    </div>
                 ))}
              </div>
              <div>
                 <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Participantes</p>
                 <p className="text-xs font-black text-[var(--text-main)]">{suppliers.length} Fornecedores</p>
              </div>
           </div>

           <div className="flex items-center gap-3">
              <div className="hidden md:block text-right mr-2">
                 <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Economia</p>
                 <p className="text-sm font-black text-green-500">R$ {economy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <button 
                  onClick={handleConfirmOrder}
                  className="flex items-center gap-2 px-6 py-3.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#0EA5E9]/20 transition-all active:scale-[0.98]"
              >
                 <span>Fechar Pedido</span>
                 <Rocket size={14} strokeWidth={3} />
              </button>
           </div>
        </div>
      </div>


      {isFullscreen && (
         <div className="fixed inset-0 z-[9999] bg-[var(--bg-main)] animate-fade-in flex flex-col overflow-hidden">
            {/* Header Responsivo */}
            <div className="px-4 md:px-8 py-4 md:py-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-card)]/80 backdrop-blur-xl sticky top-0 z-10">
               <div className="space-y-0.5">
                  <h3 className="text-base md:text-xl font-black text-[var(--text-main)] tracking-tight">Análise Detalhada</h3>
                  <p className="text-[8px] md:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                    {Object.keys(groupedByItem).length} Itens • Modo Tela Cheia
                  </p>
               </div>
               <button 
                  onClick={() => { setIsFullscreen(false); window.scrollTo(0,0); }}
                  className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border)] rounded-xl md:rounded-2xl text-[var(--text-muted)] hover:text-red-500 transition-all shadow-lg"
               >
                  <Minimize2 size={18} />
               </button>
            </div>

            {/* Content Responsivo */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
               <div className="max-w-5xl mx-auto space-y-4">
                  {/* Títulos visíveis apenas em desktop */}
                  <div className="hidden md:grid grid-cols-12 gap-4 px-6 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                    <div className="col-span-6">Produto</div>
                    <div className="col-span-2 text-center">Quantidade</div>
                    <div className="col-span-4 text-right">Melhor Oferta</div>
                  </div>

                  {Object.values(groupedByItem).map((item, idx) => {
                     const winner = item.respostas.find(r => r.e_vencedor)
                     return (
                        <div key={item.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl md:rounded-[1.5rem] p-4 md:p-6 transition-all hover:border-[#0EA5E9]/30">
                           <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                              {/* Nome e Info */}
                              <div className="col-span-1 md:col-span-6 flex items-center gap-4">
                                 <span className="text-xs font-black text-[var(--text-muted)]/30">{(idx + 1).toString().padStart(2, '0')}</span>
                                 <div>
                                    <p className="text-sm md:text-base font-black text-[var(--text-main)] leading-tight">{item.nome}</p>
                                    <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase">EAN: {item.ean || '---'}</p>
                                 </div>
                              </div>

                              {/* Qtd */}
                              <div className="col-span-1 md:col-span-2 flex md:justify-center items-center gap-2">
                                 <span className="text-[8px] font-black text-[var(--text-muted)] uppercase md:hidden">Qtd:</span>
                                 <span className="px-3 py-1 bg-[var(--bg-main)] rounded-lg text-xs font-black text-[var(--text-main)] border border-[var(--border)]">
                                    {item.quantidade}
                                 </span>
                              </div>

                              {/* Vencedor */}
                              <div className="col-span-1 md:col-span-4 flex flex-row md:flex-col justify-between md:items-end gap-1">
                                 {winner ? (
                                    <>
                                       <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-md bg-[var(--accent)] flex items-center justify-center text-[8px] font-black text-[#0EA5E9]">
                                             {suppliers.find(s => s.id === winner.fornecedor_id)?.nome.substring(0, 2)}
                                          </div>
                                          <span className="text-[10px] md:text-xs font-bold text-[var(--text-main)] truncate">
                                             {suppliers.find(s => s.id === winner.fornecedor_id)?.nome}
                                          </span>
                                       </div>
                                       <div className="flex items-baseline gap-1 text-green-500 font-black">
                                          <span className="text-[9px]">R$</span>
                                          <span className="text-base md:text-lg">{winner.preco_ofertado.toFixed(2)}</span>
                                       </div>
                                    </>
                                 ) : (
                                    <span className="text-[9px] font-black text-red-400 uppercase tracking-widest italic">Sem Ofertas</span>
                                 )}
                              </div>
                           </div>
                        </div>
                     )
                  })}
               </div>
            </div>

            {/* Footer Responsivo */}
            <div className="px-4 md:px-8 py-4 md:py-6 border-t border-[var(--border)] bg-[var(--bg-card)]/80 backdrop-blur-xl flex justify-between items-center sticky bottom-0 z-10">
               <div>
                  <p className="text-[8px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Total Estimado</p>
                  <p className="text-lg md:text-2xl font-black text-[var(--text-main)]">
                     R$ {Object.values(groupedByItem).reduce((acc, curr) => acc + (curr.respostas.find(r => r.e_vencedor)?.preco_ofertado * curr.quantidade || 0), 0).toFixed(2)}
                  </p>
               </div>
               <button onClick={() => { setIsFullscreen(false); window.scrollTo(0,0); }} className="px-6 py-3 bg-[var(--bg-main)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-main)] rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
                  Sair
               </button>
            </div>
         </div>
      )}

    </div>
  )
}
