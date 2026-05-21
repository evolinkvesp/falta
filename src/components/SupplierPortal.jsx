import { useCallback, useEffect, useState } from 'react'
import { 
  Package, CheckCircle, AlertCircle, Clock, ShieldCheck,
  Calendar as CalendarIcon, Send, XCircle, RefreshCcw
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import logo from '../assets/logo.png'

function getSupplierTokenFromUrl() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('token')
}

export default function SupplierPortal() {
  const [accessToken] = useState(() => getSupplierTokenFromUrl())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(() => Boolean(accessToken))
  const [submitted, setSubmitted] = useState(false)
  const [prices, setPrices] = useState({})
  const [expirations, setExpirations] = useState({})
  const [error, setError] = useState(() => (accessToken ? null : 'no_token')) // 'no_token' | 'invalid_token' | 'expired' | 'no_items' | 'fetch_error'
  const [submitError, setSubmitError] = useState(null)

  const fetchItems = useCallback(async (token) => {
    try {
      const { data: quoteItems, error } = await supabase
        .rpc('listar_itens_fornecedor', { p_token: token })
      
      if (error) {
        console.error('Error fetching items:', error)
        setError('fetch_error')
        setLoading(false)
        return
      }

      if (!quoteItems || quoteItems.length === 0) {
        setError('no_items')
        setLoading(false)
        return
      }

      const normalizedItems = quoteItems.map((item) => ({
        id: item.item_cotacao_id,
        produto_id: item.produto_id,
        quantidade_desejada: item.quantidade_desejada,
        produtos: {
          nome: item.produto_nome,
          ean: item.produto_ean,
          custo_medio: item.produto_custo_medio
        }
      }))

      const initialPrices = {}
      const initialExpirations = {}
      quoteItems.forEach(item => {
        if (item.preco_ofertado !== null && item.preco_ofertado !== undefined) {
          initialPrices[item.item_cotacao_id] = item.preco_ofertado
        }
        if (item.data_validade) {
          initialExpirations[item.item_cotacao_id] = item.data_validade
        }
      })

      setItems(normalizedItems)
      setPrices(initialPrices)
      setExpirations(initialExpirations)
    } catch (err) {
      console.error('Error:', err)
      setError('fetch_error')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchByToken = useCallback(async (token) => {
    try {
      const { data: tokenData, error: tokenError } = await supabase
        .rpc('validar_token_fornecedor', { p_token: token })
        .maybeSingle()
      
      if (tokenError || !tokenData) {
        console.error('Invalid token:', tokenError)
        setError('invalid_token')
        setLoading(false)
        return
      }

      if (tokenData.status === 'expired') {
        setError('expired')
        setLoading(false)
        return
      }

      await fetchItems(token)
    } catch (err) {
      console.error('Invalid token:', err)
      setError('invalid_token')
      setLoading(false)
    }
  }, [fetchItems])

  useEffect(() => {
    if (accessToken) {
      // The token comes from URL state; the portal must validate it on first load.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchByToken(accessToken)
    }
  }, [accessToken, fetchByToken])

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    setLoading(true)

    try {
      const payloads = []
      setSubmitError(null)
      
      for (const [itemId, price] of Object.entries(prices)) {
        const val = Number(String(price).replace(',', '.'))
        if (!Number.isFinite(val) || val <= 0) continue

        payloads.push({
          item_cotacao_id: itemId,
          preco_ofertado: val,
          data_validade: expirations[itemId] || null
        })
      }

      if (payloads.length === 0) {
        const message = 'Informe pelo menos um preco maior que zero antes de enviar.'
        setSubmitError(message)
        alert(message)
        setLoading(false)
        return
      }

      if (!accessToken) {
        throw new Error('Token de acesso ausente.')
      }

      const { error: saveError } = await supabase.rpc('salvar_precos_fornecedor', {
        p_token: accessToken,
        p_respostas: payloads
      })

      if (saveError) throw saveError

      setSubmitted(true)
    } catch (err) {
      console.error('Error submitting:', err)
      const message = getSaveErrorMessage(err)
      setSubmitError(message)
      alert(message)
    } finally {
      setLoading(false)
    }
  }

  const getSaveErrorMessage = (err) => {
    const message = err?.message || ''

    if (message.includes('expired_token')) {
      return 'Este link expirou. Solicite um novo link ao comprador antes de enviar os precos.'
    }

    if (message.includes('invalid_token')) {
      return 'Este link nao e mais valido. Solicite um novo link ao comprador.'
    }

    if (message.includes('invalid_item')) {
      return 'Um dos itens enviados nao pertence a esta cotacao. Recarregue o link e tente novamente.'
    }

    if (message.includes('invalid_payload')) {
      return 'Os dados enviados estao invalidos. Revise os precos e datas antes de tentar novamente.'
    }

    return 'Nao foi possivel salvar os precos agora. Verifique sua conexao e tente novamente.'
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
            Seus preços foram criptografados e enviados para a Alice. O comprador será notificado instantaneamente.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    const errorMessages = {
      no_token: {
        title: 'Link Inválido',
        desc: 'Este link não contém um token de acesso. Solicite um novo link ao comprador.',
        icon: XCircle,
        color: 'red'
      },
      invalid_token: {
        title: 'Token Não Encontrado',
        desc: 'Este token de acesso não é válido ou foi revogado. Solicite um novo link ao comprador.',
        icon: XCircle,
        color: 'red'
      },
      expired: {
        title: 'Link Expirado',
        desc: 'O prazo para preenchimento desta cotação já expirou. Solicite um novo link ao comprador.',
        icon: Clock,
        color: 'amber'
      },
      no_items: {
        title: 'Cotação Vazia',
        desc: 'Esta cotação ainda não possui produtos cadastrados. O comprador pode estar preparando a lista.',
        icon: AlertCircle,
        color: 'amber'
      },
      fetch_error: {
        title: 'Erro de Conexão',
        desc: 'Não foi possível carregar os dados. Verifique sua conexão e tente novamente.',
        icon: AlertCircle,
        color: 'red'
      }
    }

    const errInfo = errorMessages[error] || errorMessages.fetch_error
    const IconComp = errInfo.icon
    const colorMap = {
      red: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-500' },
      amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-500' }
    }
    const colors = colorMap[errInfo.color]

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-main)]">
        {/* Top Banner */}
        <div className="fixed top-0 left-0 right-0 bg-[#0EA5E9] text-white py-3 px-4 text-center z-50">
           <p className="text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
              <ShieldCheck size={14} /> Ambiente Seguro • Alice Engine v2.0
           </p>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[3rem] p-12 text-center max-w-md w-full shadow-2xl animate-scale-in">
          <img 
            src={logo} 
            alt="Alice Farma" 
            className="h-16 w-auto mx-auto mb-8 dark:invert"
          />
          <div className={`${colors.bg} w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 border ${colors.border}`}>
            <IconComp className={colors.text} size={48} />
          </div>
          <h2 className="text-2xl font-black text-[var(--text-main)] mb-4">{errInfo.title}</h2>
          <p className="text-sm text-[var(--text-muted)] font-medium leading-relaxed mb-8">
            {errInfo.desc}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#0EA5E9] text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#0284C7] transition-all"
          >
            <RefreshCcw size={16} /> Tentar Novamente
          </button>
        </div>
      </div>
    )
  }

  if (loading && items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-main)]">
        <div className="relative">
           {/* Outer Ring */}
           <div className="w-16 h-16 border-4 border-[var(--primary)]/10 rounded-full"></div>
           {/* Spinning Ring */}
           <div className="absolute top-0 left-0 w-16 h-16 border-4 border-t-[var(--primary)] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
           {/* Inner Pulse */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-[var(--primary)]/20 rounded-full animate-pulse"></div>
        </div>
        <div className="mt-8 text-center px-6">
           <p className="text-[10px] font-black text-[var(--primary)] uppercase tracking-[0.4em] animate-pulse">
              Criptografando Acesso
           </p>
           <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-2">
              Alice • Ambiente Seguro
           </p>
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-32">
      {/* Top Banner - Privacy Info */}
      <div className="bg-[#0EA5E9] text-white py-3 px-4 text-center">
         <p className="text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
            <ShieldCheck size={14} /> Ambiente Seguro • Alice Engine v2.0
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
          {items.map((item) => (
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

            </div>
          ))}
        </div>

        {submitError && (
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-500">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}


        {/* Modern Floating Submit Footer */}
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-4 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)]/90 to-transparent z-[100]">
           <div className="max-w-2xl mx-auto">
              <button 
                 onClick={handleSubmit} 
                 disabled={loading} 
                 className="w-full h-14 md:h-16 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-2xl font-black text-xs md:text-sm uppercase tracking-[0.2em] shadow-xl shadow-[#0EA5E9]/30 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
               >
                 {loading ? (
                   <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
                 ) : (
                   <>
                     <Send size={18} strokeWidth={2.5} />
                     Enviar Cotação Agora
                   </>
                 )}
               </button>
               <p className="text-[7px] md:text-[8px] text-center font-bold text-[var(--text-muted)] uppercase tracking-[0.15em] mt-3 opacity-60">
                  Ambiente Seguro e Criptografado pela Alice
               </p>
           </div>
        </div>

      </div>
    </div>
  )
}
