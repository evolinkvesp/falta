import React, { useState, useEffect, useCallback } from 'react'
import { 
  Upload, Send, Trash2, Edit3, CheckCircle, Package, AlertCircle, 
  ArrowLeft, Rocket, ListChecks, Loader2, Sparkles, Check, 
  ChevronRight, ClipboardList, SendHorizonal, ArrowRight, 
  HelpCircle, FileText, Activity, MousePointer2, FileCode, CheckCircle2,
  MousePointer, LayoutGrid, Pill, Thermometer, Bath, RefreshCcw
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { triggerWebhook, generateSupplierLink } from '../lib/webhook'

export default function QuoteInput({ onProcessComplete, onBack }) {
  const { profile } = useAuth()
  const [text, setText] = useState('')
  const [items, setItems] = useState([])
  const [liveParsed, setLiveParsed] = useState([])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1) // 1: Input, 2: Review, 3: Success/Dispatch
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')

  // Real-time parser feedback
  useEffect(() => {
    const lines = text.split('\n').filter(l => l.trim());
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
    { label: 'Antibióticos', text: 'Amoxicilina 500mg | 10\nAzitromicina 500mg | 5', icon: Pill, color: '#0EA5E9' },
    { label: 'Gripais', text: 'Paracetamol 750mg | 20\nDipirona 500mg | 15', icon: Thermometer, color: '#3B82F6' },
    { label: 'Higiene', text: 'Fralda G | 50\nShampoo Infantil | 12', icon: Bath, color: '#10B981' }
  ]

  const handleParse = () => {
    const lines = text.split('\n').filter(l => l.trim());
    const parsed = lines.map((line, idx) => {
      const parts = line.split(/[|;,]/)
      return {
        tempId: idx,
        query: parts[0]?.trim() || '',
        quantity: parseInt(parts[1]) || 1,
        status: 'pending'
      }
    }).filter(item => item.query.length > 2)

    if (parsed.length === 0) {
      alert('Insira ao menos um item válido com mais de 2 caracteres.')
      return
    }
    setItems(parsed)
    setStep(2)
  }

  const handleProcess = async () => {
    setLoading(true)
    setProgress(5)
    setStatusText('Iniciando Alice Engine...')
    
    try {
      // Create master record
      const { data: master, error: mError } = await supabase
        .from('cotacoes_mestre')
        .insert({ 
          status: 'AGUARDANDO_FORNECEDORES',
          farmacia_id: profile.farmacia_id 
        })
        .select()
        .single()
      
      if (mError) throw mError
      setProgress(15)
      setStatusText('Estruturando Protocolo...')

      // Create products and items
      const itemPayload = [];
      for (const [idx, item] of items.entries()) {
         setStatusText(`Processando item: ${item.query}...`)
         const { data: prodData, error: pError } = await supabase
           .from('produtos')
           .insert({ 
             nome: item.query, 
             ean: item.query,
             farmacia_id: profile.farmacia_id 
           })
           .select()
           .single()
         
         let prodId;
         if (pError && pError.code === '23505') {
            const { data: existing } = await supabase.from('produtos')
              .select('id')
              .eq('ean', item.query)
              .eq('farmacia_id', profile.farmacia_id)
              .single();
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
         setProgress(15 + ((idx + 1) / items.length) * 20)
      }

      if(itemPayload.length > 0) {
         const { error: iError } = await supabase
           .from('itens_cotacao')
           .insert(itemPayload)
         if (iError) throw iError
      }
      
      setProgress(40)
      setStatusText('Sincronizando Rede de Distribuição...')

      const { data: suppliers } = await supabase.from('fornecedores')
        .select('*')
        .eq('status', 'ativo')
        .eq('farmacia_id', profile.farmacia_id)
      
      if (suppliers && suppliers.length > 0) {
        const stepSize = 60 / suppliers.length
        for (const [idx, s] of suppliers.entries()) {
          setStatusText(`Notificando n8n: ${s.nome}...`)
          
          const { data: tData, error: tError } = await supabase.from('tokens_acesso_fornecedores').insert({
            cotacao_id: master.id,
            fornecedor_id: s.id
          }).select().single();

          if (!tError && tData) {
             const link = generateSupplierLink(master.id, tData.token);
             await triggerWebhook({ 
                cotacao_id: master.id, 
                fornecedor_id: s.id, 
                link: link,
                fornecedor_nome: s.nome,
                whatsapp: s.whatsapp
             }, profile?.farmacias?.webhook_cotacao);
          }
          setProgress(40 + (idx + 1) * stepSize)
        }
      }

      setProgress(100)
      setStatusText('Cotação disparada com sucesso!')
      
      setTimeout(() => {
        onProcessComplete(master.id)
      }, 800)

    } catch (err) {
      console.error(err)
      alert('Erro ao processar cotação.')
      setLoading(false)
      setProgress(0)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-[var(--border)]">
        <div className="space-y-2">
           <button onClick={onBack} className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[#0EA5E9] font-bold text-[10px] uppercase tracking-[0.2em] transition-all">
              <ArrowLeft size={14} /> Voltar ao Painel
           </button>
           <h1 className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight">Nova Cotação</h1>
        </div>
        
        {/* Minimalist Stepper */}
        <div className="flex items-center gap-3 bg-[var(--accent)] p-1.5 rounded-2xl border border-[var(--border)] self-start md:self-auto overflow-x-auto max-w-full">
           {[
             { id: 1, label: 'Entrada', icon: ClipboardList },
             { id: 2, label: 'Revisão', icon: ListChecks },
             { id: 3, label: 'Disparo', icon: Rocket }
           ].map((s, idx) => (
             <div key={s.id} className="flex items-center gap-2 flex-shrink-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                  step === s.id ? 'bg-[#0EA5E9] text-[var(--text-main)] shadow-lg shadow-[#0EA5E9]/20' : 
                  step > s.id ? 'bg-green-500 text-[var(--text-main)]' : 'bg-[var(--bg-main)] text-[var(--text-muted)]'
                }`}>
                   {step > s.id ? <Check size={14} strokeWidth={3} /> : s.id}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-1 ${step === s.id ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>
                   {s.label}
                </span>
                {idx < 2 && <ChevronRight size={14} className="text-[var(--text-muted)] mx-1 hidden sm:block" />}
             </div>
           ))}
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in">
           <div className="w-full max-w-md space-y-8 text-center">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-[#0EA5E9] blur-3xl opacity-20 animate-pulse"></div>
                <Activity className="text-[#0EA5E9] relative z-10 animate-bounce" size={64} fill="currentColor" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-[var(--text-main)] tracking-tight">Alice Engine em Ação</h2>
                <p className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-[0.2em]">{statusText}</p>
              </div>
              <div className="w-full h-3 bg-[var(--accent)] rounded-full overflow-hidden border border-[var(--border)]">
                 <div 
                   className="h-full bg-[#0EA5E9] transition-all duration-500 shadow-lg shadow-[#0EA5E9]/40"
                   style={{ width: `${progress}%` }}
                 />
              </div>
              <div className="flex justify-between items-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                 <span>Processando Dados</span>
                 <span>{Math.round(progress)}%</span>
              </div>
           </div>
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Input Area */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card shadow-2xl shadow-black/50">
               <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-[#0EA5E9]/10 rounded-2xl flex items-center justify-center text-[#0EA5E9]">
                        <Activity size={24} fill="currentColor" />
                     </div>
                     <div>
                        <h3 className="text-xl font-extrabold text-[var(--text-main)] tracking-tight">Parser Inteligente</h3>
                        <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">Processamento Alice v2</p>
                     </div>
                  </div>
                  {liveParsed.length > 0 && (
                    <div className="bg-green-500/10 text-green-500 px-4 py-2 rounded-full border border-green-500/20 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-fade-in">
                       <CheckCircle size={14} />
                       {liveParsed.length} Itens
                    </div>
                  )}
               </div>

               <div className="relative group">
                  <textarea
                    className="w-full h-[300px] md:h-[450px] p-6 md:p-8 text-base md:text-xl font-medium bg-[var(--bg-main)] border border-[var(--border)] rounded-2xl outline-none placeholder:text-[var(--text-muted)] resize-none leading-relaxed text-[var(--text-main)] focus:border-[#0EA5E9]/40 transition-all duration-300"
                    placeholder={"EAN | Quantidade \nEx: 789123456789 | 10"}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
               </div>

               <div className="mt-8 flex justify-end">
                  <button 
                    onClick={handleParse} 
                    disabled={!text.trim()} 
                    className="btn-primary w-full sm:w-auto px-10 py-5"
                  >
                    Analisar Itens
                    <ArrowRight size={20} strokeWidth={3} />
                  </button>
               </div>
            </div>

            {/* Templates Section */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               {templates.map((temp, i) => (
                <button 
                  key={i} 
                  onClick={() => setText(temp.text)}
                  className="group p-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl hover:border-[#0EA5E9] hover:bg-[var(--accent)] transition-all text-left"
                >
                   <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform" style={{ backgroundColor: `${temp.color}15`, color: temp.color }}>
                      <temp.icon size={20} />
                   </div>
                   <h5 className="font-bold text-[var(--text-main)] mb-1 text-sm">{temp.label}</h5>
                   <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest">Usar Template</p>
                </button>
               ))}
            </div>
          </div>

          {/* Right Preview Panel */}
          <div className="space-y-6">
            <div className="card border-dashed border-slate-800 bg-[#0F1113]">
               <div className="flex items-center gap-3 mb-8">
                  <Sparkles size={20} className="text-[#0EA5E9]" />
                  <h4 className="text-[10px] font-black text-[var(--text-main)] uppercase tracking-widest">Preview em Tempo Real</h4>
               </div>
               <div className="space-y-2">
                  {liveParsed.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {liveParsed.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-[#0EA5E9]/5 rounded-lg border border-[#0EA5E9]/10 animate-fade-in">
                           <span className="text-[10px] font-bold text-[#0EA5E9] truncate max-w-[120px]">{p.query}</span>
                           <span className="text-[10px] font-black text-[#0EA5E9]/40">x{p.quantity}</span>
                         </div>
                       ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center opacity-30">
                       <Loader2 className="mx-auto text-[var(--text-muted)] animate-spin mb-4" size={32} />
                       <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Aguardando entrada...</p>
                    </div>
                  )}
               </div>
            </div>

            <div className="p-8 bg-[#0EA5E9]/5 rounded-[2rem] border border-[#0EA5E9]/10 text-[var(--text-main)] relative overflow-hidden">
               <HelpCircle size={24} className="mb-4 text-[#0EA5E9]" />
               <h4 className="text-base font-bold mb-2 tracking-tight">Dica da Alice</h4>
               <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
                 Você pode colar listas diretas do WhatsApp ou Excel. Nossa IA limpa e identifica cada item para você.
               </p>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card shadow-2xl animate-fade-in">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <h3 className="text-2xl font-black text-[var(--text-main)] tracking-tight">Revisão Final</h3>
              <div className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                 Total de Itens: <span className="text-[#0EA5E9]">{items.length}</span>
              </div>
           </div>
           
           <div className="overflow-x-auto rounded-2xl border border-[var(--border)] mb-8">
              <table className="modern-table min-w-[560px] sm:min-w-0">
                <thead className="bg-[var(--accent)]">
                  <tr>
                    <th>Produto / Descrição</th>
                    <th className="text-center">Qtd</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--bg-main)]">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="font-bold text-[var(--text-main)]">{item.query}</td>
                      <td className="font-black text-[var(--text-main)] text-center">{item.quantity}</td>
                      <td className="text-right">
                         <button className="p-2 text-[var(--text-muted)] hover:text-red-500 transition-colors">
                            <Trash2 size={18} />
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>

           <div className="flex flex-col-reverse sm:flex-row justify-between gap-4">
              <button onClick={() => setStep(1)} className="px-8 py-4 font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors text-xs uppercase tracking-widest">
                 Alterar Lista
              </button>
              <button 
                onClick={handleProcess} 
                disabled={loading}
                className="btn-primary w-full sm:w-auto px-12 py-5"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <><span>Disparar Cotação</span> <Rocket size={20} /></>}
              </button>
           </div>
        </div>
      )}
    </div>
  )
}
