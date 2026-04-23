import React, { useState, useEffect, useCallback } from 'react'
import { 
  Upload, Send, Trash2, Edit3, CheckCircle, Package, AlertCircle, 
  ArrowLeft, Rocket, ListChecks, Loader2, Sparkles, Check, 
  ChevronRight, ClipboardList, SendHorizonal, ArrowRight, 
  HelpCircle, FileText, Zap, MousePointer2, FileCode, CheckCircle2,
  MousePointer, LayoutGrid, Pill, Thermometer, Bath
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { triggerWebhook, generateSupplierLink } from '../lib/webhook'

export default function QuoteInput({ onProcessComplete, onBack }) {
  const [text, setText] = useState('')
  const [items, setItems] = useState([])
  const [liveParsed, setLiveParsed] = useState([])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1) // 1: Input, 2: Review, 3: Success/Dispatch
  const [isDragging, setIsDragging] = useState(false)

  // Real-time parser feedback
  useEffect(() => {
    const lines = text.split('\n').filter(l => l.trim())
    const parsed = lines.map(line => {
      const parts = line.split(/[|;,]/)
      return {
        query: parts[0]?.trim() || '',
        quantity: parseInt(parts[1]) || 1
      }
    }).filter(p => p.query.length > 2)
    setLiveParsed(parsed)
  }, [text])

  const templates = [
    { label: 'Antibióticos', text: 'Amoxicilina 500mg | 10\nAzitromicina 500mg | 5', icon: Pill, color: '#FF5722' },
    { label: 'Gripais', text: 'Paracetamol 750mg | 20\nDipirona 500mg | 15', icon: Thermometer, color: '#3B82F6' },
    { label: 'Higiene', text: 'Fralda G | 50\nShampoo Infantil | 12', icon: Bath, color: '#10B981' }
  ]

  const handleParse = () => {
    const lines = text.split('\n').filter(l => l.trim())
    const parsed = lines.map((line, idx) => {
      const parts = line.split(/[|;,]/)
      return {
        tempId: idx,
        query: parts[0]?.trim() || '',
        quantity: parseInt(parts[1]) || 1,
        status: 'pending'
      }
    })
    setItems(parsed)
    setStep(2)
  }

  const handleProcess = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: master, error: mError } = await supabase
        .from('cotacoes_mestre')
        .insert({ status: 'AGUARDANDO_FORNECEDORES' })
        .select()
        .single()
      
      if (mError) throw mError

      // Create products if they don't exist and get their IDs
      const itemPayload = [];
      for (const item of items) {
         // Upsert product (assuming query is the name, no EAN yet)
         const { data: prodData, error: pError } = await supabase
           .from('produtos')
           .insert({ nome: item.query, ean: item.query }) // Use query as ean to prevent dupes for now
           .select()
           .single()
         
         let prodId;
         if (pError && pError.code === '23505') {
            // Already exists, fetch it
            const { data: existing } = await supabase.from('produtos').select('id').eq('ean', item.query).single();
            if(existing) prodId = existing.id;
         } else if (prodData) {
            prodId = prodData.id;
         }

         if(prodId) {
            itemPayload.push({
               cotacao_id: master.id,
               produto_id: prodId,
               quantidade_desejada: item.quantity
            });
         }
      }

      if(itemPayload.length > 0) {
         const { error: iError } = await supabase
           .from('itens_cotacao')
           .insert(itemPayload)
         
         if (iError) throw iError
      }

      const { data: suppliers } = await supabase.from('fornecedores').select('*').eq('status', 'ativo')
      
      if (suppliers) {
        for (const s of suppliers) {
          // Create access token for the supplier
          const { data: tData, error: tError } = await supabase.from('tokens_acesso_fornecedores').insert({
            cotacao_id: master.id,
            fornecedor_id: s.id
          }).select().single();

          if (!tError && tData) {
             const link = generateSupplierLink(tData.token);
             await triggerWebhook({ 
                cotacao_id: master.id, 
                fornecedor_id: s.id, 
                link: link,
                fornecedor_nome: s.nome,
                whatsapp: s.whatsapp
             });
          }
        }
      }
      onProcessComplete(master.id)
    } catch (err) {
      console.error(err)
      alert('Erro ao processar cotação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="space-y-4">
           <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-[#FF5722] font-bold text-xs uppercase tracking-widest transition-all">
              <ArrowLeft size={16} /> Voltar ao Painel
           </button>
           <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Nova Cotação</h1>
        </div>
        
        {/* Minimalist Stepper */}
        <div className="flex items-center gap-8 bg-white px-8 py-4 rounded-full border border-slate-100 shadow-sm">
           {[
             { id: 1, label: 'Entrada', icon: ClipboardList },
             { id: 2, label: 'Revisão', icon: ListChecks },
             { id: 3, label: 'Disparo', icon: Rocket }
           ].map((s, idx) => (
             <div key={s.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s.id ? 'bg-[#FF5722] text-white shadow-lg shadow-[#FF5722]/30 scale-110' : 
                  step > s.id ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                   {step > s.id ? <Check size={14} strokeWidth={3} /> : s.id}
                </div>
                <span className={`text-xs font-bold uppercase tracking-widest ${step === s.id ? 'text-slate-900' : 'text-slate-400'}`}>
                   {s.label}
                </span>
                {idx < 2 && <ChevronRight size={14} className="text-slate-200 ml-4" />}
             </div>
           ))}
        </div>
      </div>

      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main Elevated Card */}
          <div className="lg:col-span-8 space-y-10">
            <div className="bg-white rounded-[2rem] p-10 shadow-2xl shadow-slate-200/50 border border-slate-100">
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-[#FF5722]/5 rounded-2xl flex items-center justify-center text-[#FF5722]">
                        <Zap size={24} fill="currentColor" />
                     </div>
                     <div>
                        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Parser Inteligente</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Processamento Neural Alice</p>
                     </div>
                  </div>
                  {liveParsed.length > 0 && (
                    <div className="bg-green-500/10 text-green-600 px-4 py-2 rounded-full border border-green-500/20 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-fade-in">
                       <CheckCircle size={14} />
                       {liveParsed.length} Itens Detectados
                    </div>
                  )}
               </div>

               <div className="relative group">
                  <textarea
                    className="w-full h-[400px] p-8 text-xl font-medium bg-slate-50 border-2 border-transparent rounded-[1.5rem] outline-none placeholder:text-slate-300 resize-none leading-relaxed text-slate-800 focus:border-[#FF5722]/20 focus:bg-white transition-all duration-300"
                    placeholder="EAN | Quantidade &#10;Ex: 789123456789 | 10"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <div className="absolute bottom-6 right-6 opacity-40 group-focus-within:opacity-100 transition-opacity">
                     <MousePointer size={20} className="text-[#FF5722]" />
                  </div>
               </div>

               <div className="mt-10 flex justify-end">
                  <button 
                    onClick={handleParse} 
                    disabled={!text.trim()} 
                    className={`px-12 py-5 rounded-full text-white font-black text-sm uppercase tracking-widest flex items-center gap-3 transition-all duration-500 ${
                      text.trim() 
                      ? 'bg-[#FF5722] shadow-2xl shadow-[#FF5722]/40 hover:scale-105 active:scale-95' 
                      : 'bg-slate-200 cursor-not-allowed'
                    }`}
                  >
                    Analisar e Seguir
                    <ArrowRight size={20} strokeWidth={3} />
                  </button>
               </div>
            </div>

            {/* Quick Templates 3-column Grid */}
            <div className="space-y-6">
               <div className="flex items-center gap-3 ml-2">
                  <LayoutGrid size={18} className="text-slate-400" />
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Templates Rápidos</h4>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {templates.map((temp, i) => (
                    <button 
                      key={i} 
                      onClick={() => setText(temp.text)}
                      className="group p-6 bg-white border border-slate-100 rounded-2xl hover:border-[#FF5722] hover:shadow-xl hover:scale-[1.02] transition-all duration-500 text-left"
                    >
                       <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-500 group-hover:rotate-12" style={{ backgroundColor: `${temp.color}10`, color: temp.color }}>
                          <temp.icon size={24} />
                       </div>
                       <h5 className="font-bold text-slate-900 mb-1">{temp.label}</h5>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Usar Estrutura</p>
                    </button>
                  ))}
               </div>
            </div>
          </div>

          {/* Right Sidebar: Preview Alice */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white rounded-[2rem] p-10 shadow-xl shadow-slate-200/40 border border-slate-100">
               <div className="flex items-center gap-3 mb-8">
                  <Sparkles size={20} className="text-[#FF5722]" />
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Preview da Alice</h4>
               </div>
               <div className="space-y-3">
                  {liveParsed.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {liveParsed.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 px-4 py-2 bg-[#FF5722]/10 rounded-xl animate-fade-in border border-[#FF5722]/10">
                           <span className="text-[11px] font-bold text-[#FF5722] truncate max-w-[120px]">{p.query}</span>
                           <span className="text-[11px] font-black text-[#FF5722]/60">x{p.quantity}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                       <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Loader2 className="text-slate-200 animate-spin" size={32} />
                       </div>
                       <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Aguardando Lista...</p>
                    </div>
                  )}
               </div>
            </div>

            <div className="p-8 bg-[#1A1C1E] rounded-[2rem] text-white relative overflow-hidden shadow-2xl">
               <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF5722] rounded-full -mr-16 -mt-16 blur-3xl opacity-20"></div>
               <HelpCircle size={32} className="mb-6 text-[#FF5722]" />
               <h4 className="text-lg font-bold mb-3 tracking-tight">Parser Inteligente</h4>
               <p className="text-sm text-slate-400 font-medium leading-relaxed">
                 Nossa IA detecta automaticamente produtos e quantidades em qualquer formato. Basta colar sua lista.
               </p>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-[2.5rem] p-12 shadow-2xl shadow-slate-200/50 border border-slate-100 animate-fade-in">
           {/* Review Step UI - Minimalist Table */}
           <div className="flex justify-between items-center mb-10">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Revisão de Itens</h3>
              <div className="text-sm font-bold text-slate-400">
                 Total: <span className="text-slate-900">{items.length} itens</span>
              </div>
           </div>
           
           <div className="overflow-hidden rounded-2xl border border-slate-100 mb-10">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto / EAN</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qtd</th>
                    <th className="px-8 py-5 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5 font-bold text-slate-700">{item.query}</td>
                      <td className="px-8 py-5 font-black text-slate-900 text-center">{item.quantity}</td>
                      <td className="px-8 py-5 text-right">
                         <button className="p-2 text-slate-200 hover:text-red-500 transition-colors">
                            <Trash2 size={18} />
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>

           <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-8 py-4 font-bold text-slate-400 hover:text-slate-900 transition-colors">
                 Voltar e Editar
              </button>
              <button 
                onClick={handleProcess} 
                disabled={loading}
                className="px-12 py-5 bg-[#FF5722] text-white rounded-full font-black uppercase tracking-widest shadow-2xl shadow-[#FF5722]/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <>Confirmar e Disparar <Rocket size={20} /></>}
              </button>
           </div>
        </div>
      )}
    </div>
  )
}
