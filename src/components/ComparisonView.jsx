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

  const copyLink = (supId) => {
    const token = tokens.find(t => t.fornecedor_id === supId)?.token
    if (!token) return alert('Token não encontrado para este fornecedor.')
    const url = generateSupplierLink(token)
    navigator.clipboard.writeText(url)
    alert('Link de acesso único copiado!')
  }

  const sendWebhookIndividual = async (sup) => {
    const token = tokens.find(t => t.fornecedor_id === sup.id)?.token
    if (!token) return alert('Token não encontrado.')
    
    const payload = {
      action: 'individual_notification',
      cotacao_id: quoteId,
      fornecedor: {
        id: sup.id,
        nome: sup.nome,
        representante: sup.nome_representante,
        whatsapp: sup.whatsapp,
        link: generateSupplierLink(token)
      }
    }
    
    const res = await triggerWebhook(payload)
    if (res.success) alert(`Notificação enviada para o Webhook (n8n)!`)
    else alert('Erro ao disparar webhook.')
  }

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
    <div className="p-24 text-center animate-fade-in">
      <div className="relative inline-block mb-8">
        <div className="absolute inset-0 bg-[#eb5e28] blur-2xl opacity-20 animate-pulse"></div>
        <BarChart3 className="relative z-10 text-[#eb5e28]" size={64} />
      </div>
      <p className="text-xl font-black text-[#252422]">Processando Inteligência de Preços...</p>
      <p className="text-[#adb5bd] font-semibold mt-2 uppercase tracking-widest text-[10px]">Alice Engine v2.0</p>
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
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex justify-between items-start mb-12">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-[#6c757d] hover:text-[#eb5e28] transition-all mb-4 text-[10px] font-bold uppercase tracking-widest">
            <ArrowLeft size={14} /> Voltar ao Painel
          </button>
          <h1 className="text-3xl font-black text-[#252422]">
            Mapa <span className="text-[#eb5e28]">Comparativo</span>
          </h1>
          <p className="text-sm text-[#adb5bd] font-semibold">Análise algorítmica das {data.length} ofertas recebidas.</p>
        </div>
        
        <div className="flex gap-4">
          <button className="px-6 py-4 bg-[#f8f9fa] text-[#403d39] font-bold rounded-2xl border border-[#e9ecef] hover:bg-slate-100 transition-all flex items-center gap-2" onClick={() => setShowLinks(!showLinks)}>
            <Share2 size={18} /> Notificar n8n
          </button>
          <button className="btn-primary" onClick={handleConfirmOrder}>
            <CheckCircle size={20} /> Finalizar Pedido
          </button>
        </div>
      </div>

      {/* Visual Insights Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
        {/* Main Winner Spotlight */}
          <div className="lg:col-span-2 card relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Award size={150} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[#fff3e0] rounded-xl text-[#ef6c00]">
                <Award size={20} />
              </div>
              <span className="font-bold text-[#252422] uppercase tracking-widest text-[10px]">Melhor Desempenho</span>
            </div>
            
            <div className="flex items-end gap-12">
              <div>
                <h3 className="text-3xl font-black text-[#252422] mb-1">{topWinner?.nome || 'Nenhum'}</h3>
                <p className="text-sm text-[#adb5bd] font-semibold">Maior número de ofertas vencedoras.</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black text-[#eb5e28] mb-1">{topWinner?.wins || 0}</div>
                <p className="text-[9px] font-bold text-[#adb5bd] uppercase tracking-widest">Itens Ganhos</p>
              </div>
            </div>

            {/* Simple Performance Bars */}
            <div className="mt-8 space-y-3">
              <div className="flex justify-between text-[9px] font-bold text-[#adb5bd] uppercase tracking-widest">
                <span>Concentração de Pedido</span>
                <span>{Math.round((topWinner?.wins / Object.keys(groupedByItem).length) * 100) || 0}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-[#eb5e28] h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${(topWinner?.wins / Object.keys(groupedByItem).length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Economy Pulse */}
        <div className="bg-[#252422] rounded-[2rem] p-8 text-white relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <TrendingUp size={80} />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-[#eb5e28]/20 rounded-xl text-[#eb5e28]">
                <Zap size={20} />
              </div>
              <span className="font-bold text-[#eb5e28] uppercase tracking-widest text-[10px]">Economia Total</span>
            </div>
            <h3 className="text-4xl font-black mb-1">R$ {economy.toFixed(2)}</h3>
            <p className="text-[#adb5bd] font-semibold text-xs">Potencial vs. média.</p>
          </div>
          <button className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all border border-white/10 mt-8 text-xs">
            Ver Relatório
          </button>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-bold text-[#6c757d] uppercase tracking-widest">Detalhamento por Item</h2>
        <div className="flex gap-4">
          <button className="text-xs font-bold text-[#adb5bd] uppercase tracking-widest hover:text-[#eb5e28] transition-all flex items-center gap-1">
            <Printer size={14} /> Imprimir
          </button>
          <button className="text-xs font-bold text-[#adb5bd] uppercase tracking-widest hover:text-[#eb5e28] transition-all flex items-center gap-1">
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto pb-6">
        <table className="modern-table">
          <thead>
            <tr>
              <th className="min-w-[300px]">Produto Identificado</th>
              <th className="text-center">Qtd</th>
              {suppliers.map(sup => (
                <th key={sup.id} className="text-center min-w-[140px] bg-[#f8f9fa]">
                  {sup.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedByItem).map(([itemId, item], index) => (
              <tr key={itemId} className="animate-fade-in" style={{ animationDelay: `${0.2 + (index * 0.05)}s` }}>
                <td>
                  <div className="font-extrabold text-[#252422] text-lg">{item.nome}</div>
                  <div className="text-[10px] text-[#adb5bd] font-bold uppercase tracking-widest mt-1">EAN: {item.ean || '---'}</div>
                </td>
                <td className="text-center">
                  <span className="h-10 w-10 bg-[#f8f9fa] rounded-xl flex items-center justify-center mx-auto font-extrabold text-[#403d39]">1</span>
                </td>
                {suppliers.map(sup => {
                  const resp = item.respostas.find(r => r.fornecedor_id === sup.id)
                  const isWinner = resp?.e_vencedor
                  return (
                    <td 
                      key={sup.id} 
                      className={`text-center transition-all ${isWinner ? 'bg-[#fff3e0]/30' : ''}`}
                    >
                      {resp?.preco_ofertado ? (
                        <div className="flex flex-col items-center">
                          <span className={`text-xl font-black ${isWinner ? 'text-[#eb5e28]' : 'text-[#adb5bd]'}`}>
                            R$ {resp.preco_ofertado.toFixed(2)}
                          </span>
                          {isWinner && (
                            <div className="mt-2 flex items-center gap-1 px-3 py-1 bg-[#eb5e28] text-white rounded-lg text-[10px] font-bold uppercase">
                              <CheckCircle size={10} /> Vencedor
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-200 font-bold tracking-widest">---</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quick Action Floating Bar (Optional) */}
      <div className="sticky bottom-8 flex justify-center">
        <div className="bg-white/90 backdrop-blur p-4 rounded-[2rem] shadow-2xl flex items-center gap-12 border border-[#e9ecef] px-12">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-[#2e7d32] animate-pulse"></div>
            <span className="text-sm font-bold text-[#252422]">Alice Inteligência: Ativa</span>
          </div>
          <div className="h-8 w-px bg-[#e9ecef]"></div>
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-[10px] font-bold text-[#adb5bd] uppercase tracking-widest">Economia Detectada</p>
              <p className="text-xl font-black text-[#eb5e28]">R$ {economy.toFixed(2)}</p>
            </div>
            <button className="btn-primary py-4 px-12 shadow-xl shadow-[#eb5e28]/20" onClick={handleConfirmOrder}>
              Fechar Pedido Agora
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
