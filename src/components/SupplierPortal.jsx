import React, { useState, useEffect } from 'react'
import { Save, Package, CheckCircle, AlertCircle, Truck, Zap, DollarSign, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function SupplierPortal() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [quoteId, setQuoteId] = useState(null)
  const [supplierId, setSupplierId] = useState(null)
  const [prices, setPrices] = useState({})

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    
    if (t) {
      fetchByToken(t)
    } else {
      setLoading(false)
    }
  }, [])

  async function fetchByToken(t) {
    try {
      const { data: tokenData, error: tError } = await supabase
        .from('tokens_acesso_fornecedores')
        .select('cotacao_id, fornecedor_id')
        .eq('token', t)
        .single()
      
      if (tError) throw tError

      setQuoteId(tokenData.cotacao_id)
      setSupplierId(tokenData.fornecedor_id)
      fetchItems(tokenData.cotacao_id, tokenData.fornecedor_id)
    } catch (err) {
      console.error('Invalid token:', err)
      setLoading(false)
    }
  }

  async function fetchItems(q, s) {
    try {
      const { data: quoteItems, error } = await supabase
        .from('itens_cotacao')
        .select('id, produto_id, produtos(nome, ean, custo_medio), quantidade_desejada')
        .eq('cotacao_id', q)
      
      if (error) throw error

      // Get existing responses if any
      const { data: responses } = await supabase
        .from('respostas_fornecedores')
        .select('*')
        .eq('fornecedor_id', s)

      const initialPrices = {}
      responses?.forEach(r => {
        initialPrices[r.item_cotacao_id] = r.preco_ofertado
      })

      setItems(quoteItems || [])
      setPrices(initialPrices)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payloads = []
      
      for (const [itemId, price] of Object.entries(prices)) {
        const val = parseFloat(price)
        if (!val) continue

        // Logic Validation: Check if price is suspiciously low
        const item = items.find(i => i.id === itemId)
        if (item?.produtos?.custo_medio > 0 && val < item.produtos.custo_medio * 0.1) {
          if (!window.confirm(`O preço R$ ${val} para ${item.produtos.nome} está 90% abaixo do custo médio. Deseja confirmar?`)) {
            setLoading(false)
            return
          }
        }

        payloads.push({
          item_cotacao_id: itemId,
          fornecedor_id: supplierId,
          preco_ofertado: val,
          estoque_disponivel: 100
        })
      }

      for (const payload of payloads) {
        if (!payload.preco_ofertado) continue
        
        await supabase
          .from('respostas_fornecedores')
          .upsert(payload, { onConflict: 'item_cotacao_id,fornecedor_id' })
      }

      setSubmitted(true)
    } catch (err) {
      console.error('Error submitting:', err)
      alert('Erro ao salvar preços.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#f4f4f4]">
        <div className="bg-white rounded-[2rem] p-12 text-center max-w-md shadow-2xl animate-fade-in">
          <div className="bg-[#e8f5e9] w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle className="text-[#2e7d32]" size={48} />
          </div>
          <h2 className="text-3xl font-black text-[#252422] mb-4">Preços Enviados!</h2>
          <p className="text-[#6c757d] font-semibold">Obrigado pela sua resposta. Seus preços já estão sendo analisados pelo comprador.</p>
        </div>
      </div>
    )
  }

  if (!quoteId || !supplierId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#f4f4f4]">
        <div className="bg-white rounded-[2rem] p-12 text-center max-w-md shadow-2xl">
          <AlertCircle className="text-[#c62828] mx-auto mb-6" size={64} />
          <h2 className="text-2xl font-black text-[#252422] mb-4">Link Expirado ou Inválido</h2>
          <p className="text-[#6c757d] font-semibold">Este link de acesso único não é mais válido. Solicite um novo link ao comprador.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f4f4] p-4 md:p-8">
      <div className="max-w-xl mx-auto">
        <header className="text-center mb-12">
          <div className="bg-[#eb5e28] w-20 h-20 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-[#eb5e28]/30">
            <Zap className="text-white" size={32} fill="white" />
          </div>
          <h2 className="text-4xl font-black tracking-tighter text-[#252422]">Alice</h2>
          <p className="text-[#adb5bd] font-bold uppercase tracking-widest text-[10px] mt-2">Portal de Cotação Rápida</p>
        </header>

        <div className="space-y-6">
          {items.map((item, idx) => (
            <div key={item.id} className="bg-white rounded-[1.5rem] border border-[#e9ecef] p-6 shadow-sm hover:shadow-md transition-all animate-fade-in" style={{ animationDelay: `${idx * 0.05}s` }}>
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1 pr-4">
                  <h4 className="font-extrabold text-[#252422] text-lg leading-tight">{item.produtos.nome}</h4>
                  <div className="flex items-center gap-2 mt-2">
                     <span className="text-[10px] text-[#adb5bd] font-bold uppercase tracking-wider">EAN: {item.produtos.ean || 'N/A'}</span>
                     <div className="h-1 w-1 rounded-full bg-[#adb5bd]"></div>
                     <span className="text-[10px] text-[#eb5e28] font-black uppercase">Qtd: {item.quantidade_desejada}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#adb5bd] mb-2 ml-1">Preço Unitário</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#adb5bd] text-sm font-black">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      id={`price-${idx}`}
                      className="w-full bg-[#f8f9fa] border border-[#e9ecef] rounded-xl py-4 pl-10 pr-4 text-xl outline-none focus:border-[#eb5e28] transition-all font-black text-[#252422]"
                      placeholder="0,00"
                      value={prices[item.id] || ''}
                      onChange={(e) => setPrices({ ...prices, [item.id]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const next = document.getElementById(`price-${idx + 1}`)
                          if (next) next.focus()
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-col justify-center bg-[#f8f9fa] rounded-xl border border-[#e9ecef] p-4">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-[#adb5bd]" />
                        <span className="text-[11px] font-bold text-[#403d39]">Envio Imediato</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-[#e9ecef] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#eb5e28]"></div>
                      </label>
                   </div>
                </div>
              </div>
            </div>
          ))}

          <div className="pt-8 sticky bottom-8">
            <button 
              onClick={handleSubmit} 
              disabled={loading} 
              className="btn-primary w-full py-6 text-xl flex items-center justify-center gap-4 shadow-2xl shadow-[#eb5e28]/30"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-4 border-white/20 border-t-white"></div>
              ) : (
                <>
                  <CheckCircle size={28} strokeWidth={3} />
                  Confirmar e Enviar Cotação
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
