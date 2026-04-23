import React, { useState, useEffect } from 'react'
import { ArrowLeft, Send, CheckCircle, Truck, FileText, Share2, BarChart3, Package, Rocket, Download, Printer, TrendingUp, Award, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { triggerWebhook, generateSupplierLink } from '../lib/webhook'

export default function ComparisonView({ quoteId, onBack }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState([])
  const [tokens, setTokens] = useState([])

  useEffect(() => {
    fetchComparison()
    fetchSuppliers()
    fetchTokens()
  }, [quoteId])

  async function fetchTokens() {
    const { data } = await supabase.from('tokens_acesso_fornecedores').select('*').eq('cotacao_id', quoteId)
    setTokens(data || [])
  }

  async function fetchSuppliers() {
    const { data } = await supabase.from('fornecedores').select('*').eq('status', 'ativo')
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
        respostas: []
      }
    }
    acc[curr.item_cotacao_id].respostas.push(curr)
    return acc
  }, {})

  const [showLinks, setShowLinks] = useState(false)

  const handleConfirmOrder = async () => {
    try {
      const { error } = await supabase
        .from('cotacoes_mestre')
        .update({ status: 'FINALIZADA' })
        .eq('id', quoteId)
      
      if (error) throw error
      onBack()
    } catch (err) {
      console.error(err)
      alert('Erro ao finalizar pedido.')
    }
  }

  if (loading) return (
    <div className="p-12 md:p-24 text-center animate-fade-in">
      <div className="relative inline-block mb-8">
        <div className="absolute inset-0 bg-[#eb5e28] blur-2xl opacity-20 animate-pulse"></div>
        <BarChart3 className="relative z-10 text-[#eb5e28]" size={48} />
      </div>
      <p className="text-lg md:text-xl font-black text-[#F8F9FA]">Processando Inteligência de Preços...</p>
      <p className="text-[#94A3B8] font-semibold mt-2 uppercase tracking-widest text-[10px]">Alice Engine v2.0</p>
    </div>
  )

  const economy = Object.values(groupedByItem).reduce((sum, item) => {
    const prices = item.respostas.map(r => r.preco_ofertado).filter(p => p > 0)
    if (prices.length < 2) return sum
    const best = Math.min(...prices)
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length
    return sum + (avg - best)
  }, 0)

  // Calculate winner insights
  const supplierWins = suppliers.map(sup => {
    const wins = data.filter(d => d.fornecedor_id === sup.id && d.e_vencedor).length
    const totalValue = data.filter(d => d.fornecedor_id === sup.id && d.e_vencedor)
                         .reduce((acc, curr) => acc + (curr.preco_ofertado || 0), 0)
    return { ...sup, wins, totalValue }
  }).sort((a, b) => b.wins - a.wins)

  const topWinner = supplierWins[0]

  return (
    <div className="animate-slide-up px-4 sm:px-6 lg:px-2 pt-6 md:pt-0 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 md:gap-0 mb-8 md:mb-12">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-[#94A3B8] hover:text-[#eb5e28] transition-all mb-3 md:mb-4 text-[10px] font-bold uppercase tracking-widest">
            <ArrowLeft size={14} /> Voltar ao Painel
          </button>
          <h1 className="text-2xl md:text-3xl font-black text-[#F8F9FA]">
            Mapa <span className="text-[#eb5e28]">Comparativo</span>
          </h1>
          <p className="text-xs md:text-sm text-[#94A3B8] font-semibold mt-1">Análise algorítmica das {data.length} ofertas recebidas.</p>
        </div>
        
        <div className="flex flex-wrap gap-3 md:gap-4 w-full md:w-auto">
          <button className="flex-1 md:flex-none px-4 md:px-6 py-3 md:py-4 bg-[#1A1C1E] text-[#F8F9FA] font-bold rounded-xl md:rounded-2xl border border-[#22262B] hover:bg-[#22262B] transition-all flex items-center justify-center gap-2 text-xs md:text-sm">
            <Share2 size={16} /> <span className="hidden sm:inline">Notificar</span> n8n
          </button>
          <button className="flex-1 md:flex-none btn-primary flex items-center justify-center gap-2 text-xs md:text-sm" onClick={handleConfirmOrder}>
            <CheckCircle size={18} /> <span className="hidden sm:inline">Finalizar</span> Pedido
          </button>
        </div>
      </div>

      {/* Visual Insights Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mb-10 md:mb-16">
        {/* Main Winner Spotlight */}
          <div className="lg:col-span-2 card bg-[#14171A] border border-[#22262B] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 md:p-8 opacity-5">
            <Award size={100} className="md:hidden" />
            <Award size={150} className="hidden md:block" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <div className="p-2 bg-[#FF5722]/10 rounded-xl text-[#eb5e28]">
                <Award size={18} />
              </div>
              <span className="font-bold text-[#F8F9FA] uppercase tracking-widest text-[9px] md:text-[10px]">Melhor Desempenho</span>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 md:gap-12">
              <div className="flex-1">
                <h3 className="text-2xl md:text-3xl font-black text-[#F8F9FA] mb-1">{topWinner?.nome || 'Nenhum'}</h3>
                <p className="text-xs md:text-sm text-[#94A3B8] font-semibold">Maior número de ofertas vencedoras.</p>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-3xl md:text-4xl font-black text-[#eb5e28] mb-1">{topWinner?.wins || 0}</div>
                <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">Itens Ganhos</p>
              </div>
            </div>

            {/* Simple Performance Bars */}
            <div className="mt-6 md:mt-8 space-y-3">
              <div className="flex justify-between text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest">
                <span>Concentração de Pedido</span>
                <span>{Math.round((topWinner?.wins / Object.keys(groupedByItem).length) * 100) || 0}%</span>
              </div>
              <div className="w-full bg-[#1A1C1E] h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-[#eb5e28] h-full rounded-full transition-all duration-1000 shadow-lg shadow-[#eb5e28]/40" 
                  style={{ width: `${(topWinner?.wins / Object.keys(groupedByItem).length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Economy Pulse */}
        <div className="bg-[#0A0C0E] border border-[#22262B] rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 text-white relative overflow-hidden flex flex-col justify-between shadow-2xl">
          <div className="absolute top-0 right-0 p-4 md:p-6 opacity-10">
            <TrendingUp size={60} className="md:hidden" />
            <TrendingUp size={80} className="hidden md:block" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-3 md:mb-4">
              <div className="p-2 bg-[#eb5e28]/20 rounded-xl text-[#eb5e28]">
                <Zap size={18} />
              </div>
              <span className="font-bold text-[#eb5e28] uppercase tracking-widest text-[9px] md:text-[10px]">Economia Total</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-black mb-1">R$ {economy.toFixed(2)}</h3>
            <p className="text-[#94A3B8] font-semibold text-xs">Potencial vs. média.</p>
          </div>
          <button className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10 mt-6 md:mt-8 text-xs">
            Ver Relatório
          </button>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h2 className="text-xs md:text-sm font-bold text-[#94A3B8] uppercase tracking-widest">Detalhamento por Item</h2>
        <div className="flex gap-4">
          <button className="text-[10px] md:text-xs font-bold text-[#64748B] uppercase tracking-widest hover:text-[#eb5e28] transition-all flex items-center gap-1">
            <Printer size={14} /> Imprimir
          </button>
          <button className="text-[10px] md:text-xs font-bold text-[#64748B] uppercase tracking-widest hover:text-[#eb5e28] transition-all flex items-center gap-1">
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      <div className="card bg-[#14171A] border border-[#22262B] overflow-x-auto pb-4 md:pb-6">
        <table className="modern-table min-w-[600px]">
          <thead>
            <tr>
              <th className="min-w-[200px] md:min-w-[300px]">Produto Identificado</th>
              <th className="text-center">Qtd</th>
              {suppliers.map(sup => (
                <th key={sup.id} className="text-center min-w-[120px] md:min-w-[140px] bg-[#1A1C1E]">
                  {sup.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedByItem).map(([itemId, item], index) => (
              <tr key={itemId} className="animate-fade-in" style={{ animationDelay: `${0.2 + (index * 0.05)}s` }}>
                <td className="border-b border-[#22262B]">
                  <div className="font-extrabold text-[#F8F9FA] text-base md:text-lg">{item.nome}</div>
                  <div className="text-[9px] md:text-[10px] text-[#94A3B8] font-bold uppercase tracking-widest mt-1">EAN: {item.ean || '---'}</div>
                </td>
                <td className="text-center border-b border-[#22262B]">
                  <span className="h-8 w-8 md:h-10 md:w-10 bg-[#1A1C1E] rounded-lg md:rounded-xl flex items-center justify-center mx-auto font-extrabold text-[#F8F9FA] text-sm md:text-base">1</span>
                </td>
                {suppliers.map(sup => {
                  const resp = item.respostas.find(r => r.fornecedor_id === sup.id)
                  const isWinner = resp?.e_vencedor
                  return (
                    <td 
                      key={sup.id} 
                      className={`text-center transition-all border-b border-[#22262B] ${isWinner ? 'bg-[#eb5e28]/5' : ''}`}
                    >
                      {resp?.preco_ofertado ? (
                        <div className="flex flex-col items-center">
                          <span className={`text-base md:text-xl font-black ${isWinner ? 'text-[#eb5e28]' : 'text-slate-600'}`}>
                            R$ {resp.preco_ofertado.toFixed(2)}
                          </span>
                          {isWinner && (
                            <div className="mt-1.5 md:mt-2 flex items-center gap-1 px-2 md:px-3 py-1 bg-[#eb5e28] text-white rounded-lg text-[9px] md:text-[10px] font-bold uppercase shadow-lg shadow-[#eb5e28]/20">
                              <CheckCircle size={10} /> Vencedor
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#1A1C1E] font-bold tracking-widest">---</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quick Action Floating Bar */}
      <div className="sticky bottom-20 md:bottom-8 flex justify-center mt-8">
        <div className="bg-[#1A1C1E]/90 backdrop-blur-xl p-3 md:p-4 rounded-[1.5rem] md:rounded-[2rem] shadow-2xl flex flex-col sm:flex-row items-center gap-4 sm:gap-8 md:gap-12 border border-[#22262B] px-6 md:px-12 w-full sm:w-auto">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs md:text-sm font-bold text-[#F8F9FA]">Alice: Ativa</span>
          </div>
          <div className="hidden sm:block h-8 w-px bg-[#22262B]"></div>
          <div className="flex items-center gap-4 sm:gap-8 w-full sm:w-auto">
            <div className="text-left sm:text-right">
              <p className="text-[9px] md:text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Economia</p>
              <p className="text-lg md:text-xl font-black text-[#eb5e28]">R$ {economy.toFixed(2)}</p>
            </div>
            <button className="btn-primary py-3 md:py-4 px-6 md:px-12 shadow-xl shadow-[#eb5e28]/30 text-xs md:text-sm flex-1 sm:flex-none text-center" onClick={handleConfirmOrder}>
              Fechar Pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
