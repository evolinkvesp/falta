import React, { useState, useEffect } from 'react'
import { 
  Save, Package, CheckCircle, AlertCircle, Truck, 
  PlusSquare, DollarSign, Clock, ShieldCheck, HelpCircle,
  ChevronRight, Calendar as CalendarIcon, Info, Send
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import logo from '../assets/logo.png'

export default function SupplierPortal() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [quoteId, setQuoteId] = useState(null)
  const [supplierId, setSupplierId] = useState(null)
  const [prices, setPrices] = useState({})
  const [expirations, setExpirations] = useState({})

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
        .select('id, produto_id, produtos(nome, ean, custo_medio)')
        .eq('cotacao_id', q)
      
      if (error) throw error

      const { data: responses } = await supabase
        .from('respostas_fornecedores')
        .select('*')
        .eq('fornecedor_id', s)

      const initialPrices = {}
      const initialExpirations = {}
      responses?.forEach(r => {
        initialPrices[r.item_cotacao_id] = r.preco_ofertado
        initialExpirations[r.item_cotacao_id] = r.data_validade
      })

      setItems(quoteItems || [])
      setPrices(initialPrices)
      setExpirations(initialExpirations)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    setLoading(true)

    try {
      const payloads = []
      
      for (const [itemId, price] of Object.entries(prices)) {
        const val = parseFloat(price)
        if (!val) continue

        payloads.push({
          item_cotacao_id: itemId,
          fornecedor_id: supplierId,
          preco_ofertado: val,
          data_validade: expirations[itemId] || null,
          estoque_disponivel: 100
        })
      }

      if (payloads.length === 0) {
        alert('Por favor, insira pelo menos um preço.')
        setLoading(false)
        return
      }

      for (const payload of payloads) {
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

  const isShortDate = (date) => {
     if (!date) return false;
     const expDate = new Date(date);
     const sixMonthsFromNow = new Date();
     sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
     return expDate < sixMonthsFromNow;
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-main)]">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[3rem] p-12 text-center max-w-md w-full shadow-2xl animate-scale-in">
          <div className="bg-green-500/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 border border-green-500/20">
            <CheckCircle className="text-green-500" size={48} />
          </div>
          <h2 className="text-3xl font-black text-[var(--text-main)] mb-4">Ofertas Enviadas!</h2>
          <p className="text-[var(--text-muted)] font-semibold leading-relaxed">
            Seus preços foram criptografados e enviados para a Alice AI. O comprador será notificado instantaneamente.
          </p>
        </div>
      </div>
    )
  }

  if (loading && items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-[#0EA5E9]/20 border-t-[#0EA5E9] rounded-full animate-spin mx-auto"></div>
          <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">Criptografando Acesso...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-32">
      {/* Top Banner - Privacy Info */}
      <div className="bg-[#0EA5E9] text-white py-3 px-4 text-center">
         <p className="text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
            <ShieldCheck size={14} /> Ambiente Seguro • Alice AI Engine v2.0
         </p>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <header className="text-center mb-16">
          <img 
            src={logo} 
            alt="Alice Farma" 
            className="h-24 md:h-32 w-auto mx-auto mb-8 dark:invert"
          />
          <h1 className="text-3xl font-black text-[var(--text-main)] tracking-tight">Portal de <span className="text-[#0EA5E9]">Cotação</span></h1>
          <p className="text-sm text-[var(--text-muted)] mt-2 font-medium italic">Preencha seus melhores preços unitários abaixo.</p>
        </header>

        <div className="space-y-6">
          {items.map((item, idx) => (
            <div key={item.id} className="card relative group hover:border-[#0EA5E9]/30 transition-all !p-0 overflow-hidden border border-[var(--border)] shadow-sm">
              {/* Product Info Section */}
              <div className="p-6 border-b border-[var(--border)] bg-[var(--bg-main)]/30">
                 <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                       <h4 className="font-black text-lg text-[var(--text-main)] leading-tight">{item.produtos.nome}</h4>
                       <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">EAN: {item.produtos.ean || '---'}</p>
                    </div>
                    <div className="w-10 h-10 bg-[var(--accent)] rounded-xl flex items-center justify-center text-[var(--text-muted)]">
                       <Package size={20} />
                    </div>
                 </div>
              </div>

              {/* Input Section */}
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Preço Unitário</label>
                  <div className="relative group/input">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-[var(--text-muted)] group-focus-within/input:text-[#0EA5E9] transition-colors">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-[var(--bg-main)] border-2 border-[var(--border)] rounded-2xl py-4 pl-12 pr-4 text-xl font-black text-[var(--text-main)] outline-none focus:border-[#0EA5E9] transition-all"
                      placeholder="0,00"
                      value={prices[item.id] || ''}
                      onChange={(e) => setPrices({ ...prices, [item.id]: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Validade do Lote</label>
                    {isShortDate(expirations[item.id]) && (
                       <span className="text-[8px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded uppercase animate-pulse">Data Curta</span>
                    )}
                  </div>
                  <div className={`relative bg-[var(--bg-main)] border-2 rounded-2xl p-4 flex items-center gap-3 transition-all ${isShortDate(expirations[item.id]) ? 'border-red-500/50 bg-red-500/5' : 'border-[var(--border)]'}`}>
                    <CalendarIcon size={20} className={isShortDate(expirations[item.id]) ? 'text-red-500' : 'text-[#0EA5E9]'} />
                    <input
                      type="date"
                      className="bg-transparent border-none outline-none font-black text-[var(--text-main)] text-sm w-full"
                      value={expirations[item.id] || ''}
                      onChange={(e) => setExpirations({ ...expirations, [item.id]: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Info Note for Short Date */}
              {isShortDate(expirations[item.id]) && (
                 <div className="px-6 py-3 bg-red-500/10 border-t border-red-500/20 flex items-center gap-2">
                    <AlertCircle size={14} className="text-red-500" />
                    <p className="text-[9px] font-bold text-red-500 uppercase tracking-tighter">Atenção: Validade inferior a 6 meses pode reduzir o valor de compra.</p>
                 </div>
              )}
            </div>
          ))}
        </div>

        {/* Floating Submit Footer */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-6 z-[100]">
           <button 
              onClick={handleSubmit} 
              disabled={loading} 
              className="w-full h-16 md:h-20 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-[2rem] font-black text-base md:text-lg uppercase tracking-[0.2em] shadow-2xl shadow-[#0EA5E9]/40 flex items-center justify-center gap-4 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Send size={22} />
                  Enviar Cotação para Alice
                </>
              )}
            </button>
            <p className="text-[8px] text-center font-bold text-[var(--text-muted)] uppercase tracking-widest mt-4">
               Ao enviar, você concorda que os preços são finais para esta cotação.
            </p>
        </div>
      </div>
    </div>
  )
}
