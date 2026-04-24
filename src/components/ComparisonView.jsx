import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { ArrowLeft, Send, CheckCircle, Truck, FileText, Share2, BarChart3, Package, Rocket, Download, Printer, TrendingUp, Award, Zap, Trash2, Maximize2, Minimize2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { triggerWebhook, triggerPedidoWebhook, generateSupplierLink } from '../lib/webhook'

export default function ComparisonView({ quoteId, onBack }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState([])
  const [tokens, setTokens] = useState([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [notificationProgress, setNotificationProgress] = useState({ active: false, current: 0, total: 0, supplierName: '' })

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



  if (loading) return (
    <div className="p-12 md:p-24 text-center animate-fade-in">
      <div className="relative inline-block mb-8">
        <div className="absolute inset-0 bg-[var(--primary)] blur-2xl opacity-20 animate-pulse"></div>
        <BarChart3 className="relative z-10 text-[var(--primary)]" size={48} />
      </div>
      <p className="text-lg md:text-xl font-black text-[var(--text-main)]">Processando Inteligência de Preços...</p>
      <p className="text-[var(--text-muted)] font-semibold mt-2 uppercase tracking-widest text-[10px]">Alice Engine v2.0</p>
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



  const handleNotifyN8N = async (showSuccess = true) => {
    try {
      // 1. Agrupar itens ganhos por fornecedor
      const pedidosPorFornecedor = {};

      Object.values(groupedByItem).forEach(item => {
        const winner = item.respostas.find(r => r.e_vencedor);
        if (winner) {
          const supplierId = winner.fornecedor_id;
          if (!pedidosPorFornecedor[supplierId]) {
            const supplier = suppliers.find(s => s.id === supplierId);
            pedidosPorFornecedor[supplierId] = {
              quoteId,
              fornecedor: {
                id: supplierId,
                nome: supplier?.nome || 'Desconhecido',
                email: supplier?.email || '',
                telefone: supplier?.telefone || supplier?.whatsapp || '',
                celular: supplier?.whatsapp || supplier?.telefone || ''
              },
              itens: [],
              totalPedido: 0,
              dataFinalizacao: new Date().toISOString()
            };
          }
          
          pedidosPorFornecedor[supplierId].itens.push({
            item_id: item.id,
            produto_nome: item.nome,
            produto_ean: item.ean,
            quantidade: 1,
            preco_unitario: winner.preco_ofertado,
            subtotal: winner.preco_ofertado
          });
          
          pedidosPorFornecedor[supplierId].totalPedido += winner.preco_ofertado;
        }
      });

      const fornecedoresComPedidos = Object.values(pedidosPorFornecedor);
      
      if (fornecedoresComPedidos.length === 0) {
        if (showSuccess) alert('Nenhum item vencedor para notificar.');
        return;
      }

      setNotificationProgress({ 
        active: true, 
        current: 0, 
        total: fornecedoresComPedidos.length, 
        supplierName: 'Iniciando...' 
      });

      let count = 0;
      for (const payload of fornecedoresComPedidos) {
        count++;
        setNotificationProgress(prev => ({ 
          ...prev, 
          current: count, 
          supplierName: payload.fornecedor.nome 
        }));

        // Garantir que os números sejam válidos antes de enviar
        if (isNaN(payload.totalPedido)) {
          payload.totalPedido = 0;
        }
        payload.itens = payload.itens.map(item => ({
          ...item,
          preco_unitario: isNaN(item.preco_unitario) ? 0 : item.preco_unitario,
          subtotal: isNaN(item.subtotal) ? 0 : item.subtotal
        }));

        const response = await triggerPedidoWebhook(payload);
        
        if (!response.success) {
          setNotificationProgress({ active: false, current: 0, total: 0, supplierName: '' });
          throw new Error(`O servidor n8n retornou um erro (500) ao processar o fornecedor: ${payload.fornecedor.nome}`);
        }

        // Delay obrigatório de 300ms entre fornecedores para não quebrar o fluxo do n8n
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      setNotificationProgress({ active: false, current: 0, total: 0, supplierName: '' });
      if (showSuccess) alert('Notificação enviada ao n8n com sucesso!');
    } catch (err) {
      console.error(err);
      if (showSuccess) alert('Erro ao enviar notificação ao n8n.');
      throw err;
    }
  }

  const handleConfirmOrder = async () => {
    try {
      const { error } = await supabase
        .from('cotacoes_mestre')
        .update({ status: 'FINALIZADA' })
        .eq('id', quoteId)
      
      if (error) throw error

      await handleNotifyN8N(false);

      onBack()
    } catch (err) {
      console.error(err)
      alert('Erro ao finalizar pedido.')
    }
  }

  const handleDeleteQuote = async () => {
    if (!window.confirm('Tem certeza que deseja excluir esta cotação permanentemente?')) return;
    
    try {
      const { error } = await supabase
        .from('cotacoes_mestre')
        .delete()
        .eq('id', quoteId);
      
      if (error) throw error;
      onBack();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir cotação.');
    }
  }

  const handleDownloadExcel = () => {
    try {
      // 1. Preparar os dados para o Excel de forma organizada
      const excelData = Object.values(groupedByItem).map(item => {
        const row = {
          'Produto': item.nome,
          'EAN': item.ean || '---',
          'Quantidade': 1
        };

        // Adicionar preços de cada fornecedor
        suppliers.forEach(sup => {
          const resp = item.respostas.find(r => r.fornecedor_id === sup.id);
          const preco = resp?.preco_ofertado;
          row[sup.nome] = preco ? preco : 0;
          
          if (resp?.e_vencedor) {
            row['Vencedor'] = sup.nome;
            row['Melhor Preço'] = preco;
          }
        });

        return row;
      });

      // 2. Criar a planilha
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Ajustar largura das colunas
      const wscols = [
        {wch: 40}, // Produto
        {wch: 15}, // EAN
        {wch: 40}, // Nome Produto
        ...suppliers.map(() => ({wch: 15})), // Preços fornecedores
        {wch: 15}, // Vencedor
        {wch: 15}  // Melhor Preço
      ];
      worksheet['!cols'] = wscols;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Mapa Comparativo");

      // 3. Gerar arquivo e baixar
      const fileName = `Mapa_Comparativo_Alice_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      console.error('Erro ao gerar Excel:', err);
      alert('Erro ao gerar a planilha.');
    }
  };

  return (
    <div className="animate-slide-up px-4 sm:px-6 lg:px-2 pt-6 md:pt-0 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 md:gap-0 mb-8 md:mb-12">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--primary)] transition-all mb-3 md:mb-4 text-[10px] font-bold uppercase tracking-widest">
            <ArrowLeft size={14} /> Voltar ao Painel
          </button>
          <h1 className="text-2xl md:text-3xl font-black text-[var(--text-main)]">
            Mapa <span className="text-[var(--primary)]">Comparativo</span>
          </h1>
          <p className="text-xs md:text-sm text-[var(--text-muted)] font-semibold mt-1">Análise algorítmica das {data.length} ofertas recebidas.</p>
        </div>
        
        <div className="flex flex-wrap gap-3 md:gap-4 w-full md:w-auto">
          <button 
            className="flex-1 md:flex-none px-4 md:px-6 py-3 md:py-4 bg-red-500/10 text-red-500 font-bold rounded-xl md:rounded-2xl border border-red-500/20 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 text-xs md:text-sm"
            onClick={handleDeleteQuote}
          >
            <Trash2 size={16} /> <span className="hidden sm:inline">Excluir</span>
          </button>
          <button 
            className="flex-1 md:flex-none px-4 md:px-6 py-3 md:py-4 bg-[var(--accent)] text-[var(--text-main)] font-bold rounded-xl md:rounded-2xl border border-[#BBF7D0] hover:bg-[#BBF7D0] transition-all flex items-center justify-center gap-2 text-xs md:text-sm"
            onClick={() => handleNotifyN8N(true)}
          >
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
          <div className="lg:col-span-2 card bg-[var(--bg-card)] border border-[#BBF7D0] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 md:p-8 opacity-5">
            <Award size={100} className="md:hidden" />
            <Award size={150} className="hidden md:block" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <div className="p-2 bg-[var(--primary)]/10 rounded-xl text-[var(--primary)]">
                <Award size={18} />
              </div>
              <span className="font-bold text-[var(--text-main)] uppercase tracking-widest text-[9px] md:text-[10px]">Melhor Desempenho</span>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 md:gap-12">
              <div className="flex-1">
                <h3 className="text-2xl md:text-3xl font-black text-[var(--text-main)] mb-1">{topWinner?.nome || 'Nenhum'}</h3>
                <p className="text-xs md:text-sm text-[var(--text-muted)] font-semibold">Maior número de ofertas vencedoras.</p>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-3xl md:text-4xl font-black text-[var(--primary)] mb-1">{topWinner?.wins || 0}</div>
                <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Itens Ganhos</p>
              </div>
            </div>

            {/* Simple Performance Bars */}
            <div className="mt-6 md:mt-8 space-y-3">
              <div className="flex justify-between text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                <span>Concentração de Pedido</span>
                <span>{Math.round((topWinner?.wins / Object.keys(groupedByItem).length) * 100) || 0}%</span>
              </div>
              <div className="w-full bg-[var(--accent)] h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-[var(--primary)] h-full rounded-full transition-all duration-1000 shadow-lg shadow-[var(--primary)]/40" 
                  style={{ width: `${(topWinner?.wins / Object.keys(groupedByItem).length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Economy Pulse */}
        <div className="bg-[var(--bg-main)] border border-[#BBF7D0] rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 text-white relative overflow-hidden flex flex-col justify-between shadow-2xl">
          <div className="absolute top-0 right-0 p-4 md:p-6 opacity-10">
            <TrendingUp size={60} className="md:hidden" />
            <TrendingUp size={80} className="hidden md:block" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-3 md:mb-4">
              <div className="p-2 bg-[var(--primary)]/20 rounded-xl text-[var(--primary)]">
                <Zap size={18} />
              </div>
              <span className="font-bold text-[var(--primary)] uppercase tracking-widest text-[9px] md:text-[10px]">Economia Total</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-black mb-1">R$ {economy.toFixed(2)}</h3>
            <p className="text-[var(--text-muted)] font-semibold text-xs">Potencial vs. média.</p>
          </div>
          <button className="w-full py-3 bg-[var(--bg-card)]/5 hover:bg-[var(--bg-card)]/10 text-white font-bold rounded-xl transition-all border border-white/10 mt-6 md:mt-8 text-xs">
            Ver Relatório
          </button>
        </div>
      </div>

      {/* Comparison Table */}
      <div className={isFullscreen ? "fixed inset-0 z-[100] bg-[var(--bg-main)] p-4 md:p-8 overflow-y-auto animate-fade-in" : ""}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <h2 className="text-xs md:text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest">Detalhamento por Item</h2>
          <div className="flex gap-4">
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="text-[10px] md:text-xs font-bold text-[var(--primary)] uppercase tracking-widest hover:text-[#FF8A65] transition-all flex items-center gap-1 bg-[var(--primary)]/10 px-3 py-1.5 rounded-lg"
            >
              {isFullscreen ? <><Minimize2 size={14} /> Sair Tela Cheia</> : <><Maximize2 size={14} /> Tela Cheia</>}
            </button>
            <button className="text-[10px] md:text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest hover:text-[var(--primary)] transition-all flex items-center gap-1">
              <Printer size={14} /> Imprimir
            </button>
            <button 
              onClick={handleDownloadExcel}
              className="text-[10px] md:text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest hover:text-[var(--primary)] transition-all flex items-center gap-1"
            >
              <Download size={14} /> Planilha
            </button>
          </div>
        </div>

        <div className={`card bg-[var(--bg-card)] border border-[#BBF7D0] overflow-x-auto pb-4 md:pb-6 ${isFullscreen ? 'min-h-[calc(100vh-120px)]' : ''}`}>
        <table className="modern-table min-w-[600px]">
          <thead>
            <tr>
              <th className="min-w-[200px] md:min-w-[300px]">Produto Identificado</th>
              <th className="text-center">Qtd</th>
              {suppliers.map(sup => (
                <th key={sup.id} className="text-center min-w-[120px] md:min-w-[140px] bg-[var(--accent)]">
                  {sup.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedByItem).map(([itemId, item], index) => (
              <tr key={itemId} className="animate-fade-in" style={{ animationDelay: `${0.2 + (index * 0.05)}s` }}>
                <td className="border-b border-[#BBF7D0]">
                  <div className="font-extrabold text-[var(--text-main)] text-base md:text-lg">{item.nome}</div>
                  <div className="text-[9px] md:text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">EAN: {item.ean || '---'}</div>
                </td>
                <td className="text-center border-b border-[#BBF7D0]">
                  <span className="h-8 w-8 md:h-10 md:w-10 bg-[var(--accent)] rounded-lg md:rounded-xl flex items-center justify-center mx-auto font-extrabold text-[var(--text-main)] text-sm md:text-base">1</span>
                </td>
                {suppliers.map(sup => {
                  const resp = item.respostas.find(r => r.fornecedor_id === sup.id)
                  const isWinner = resp?.e_vencedor
                  return (
                    <td 
                      key={sup.id} 
                      className={`text-center transition-all border-b border-[#BBF7D0] ${isWinner ? 'bg-[var(--primary)]/5' : ''}`}
                    >
                      {resp?.preco_ofertado ? (
                        <div className="flex flex-col items-center">
                          <span className={`text-base md:text-xl font-black ${isWinner ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
                            R$ {resp.preco_ofertado.toFixed(2)}
                          </span>
                          {isWinner && (
                            <div className="mt-1.5 md:mt-2 flex items-center gap-1 px-2 md:px-3 py-1 bg-[var(--primary)] text-white rounded-lg text-[9px] md:text-[10px] font-bold uppercase shadow-lg shadow-[var(--primary)]/20">
                              <CheckCircle size={10} /> Vencedor
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--accent)] font-bold tracking-widest">---</span>
                      )}
                    </td>
                  )
                })}
                </tr>
              ))}
            </tbody>
          </table>
      </div>
      </div>

      {/* Quick Action Floating Bar */}
      <div className="sticky bottom-20 md:bottom-8 flex justify-center mt-8">
        <div className="bg-[var(--accent)]/90 backdrop-blur-xl p-3 md:p-4 rounded-[1.5rem] md:rounded-[2rem] shadow-2xl flex flex-col sm:flex-row items-center gap-4 sm:gap-8 md:gap-12 border border-[#BBF7D0] px-6 md:px-12 w-full sm:w-auto">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs md:text-sm font-bold text-[var(--text-main)]">Alice: Ativa</span>
          </div>
          <div className="hidden sm:block h-8 w-px bg-[#BBF7D0]"></div>
          <div className="flex items-center gap-4 sm:gap-8 w-full sm:w-auto">
            <div className="text-left sm:text-right">
              <p className="text-[9px] md:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Economia</p>
              <p className="text-lg md:text-xl font-black text-[var(--primary)]">R$ {economy.toFixed(2)}</p>
            </div>
            <button className="btn-primary py-3 md:py-4 px-6 md:px-12 shadow-xl shadow-[var(--primary)]/30 text-xs md:text-sm flex-1 sm:flex-none text-center" onClick={handleConfirmOrder}>
              Fechar Pedido
            </button>
          </div>
        </div>
      </div>
      {/* Notification Progress Overlay */}
      {notificationProgress.active && (
        <div className="fixed inset-0 z-[200] bg-[var(--bg-main)]/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-[var(--bg-card)] border border-[#BBF7D0] rounded-[2rem] p-8 shadow-2xl animate-scale-in">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-[var(--primary)]/20 rounded-2xl text-[var(--primary)] animate-pulse">
                <Send size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-[var(--text-main)]">Enviando Pedidos</h3>
                <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Sincronizando com n8n...</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-[var(--primary)]">{notificationProgress.supplierName}</span>
                <span className="text-xs font-black text-[var(--text-muted)]">{notificationProgress.current} / {notificationProgress.total}</span>
              </div>
              
              <div className="w-full bg-[var(--accent)] h-3 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="bg-[var(--primary)] h-full rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(235,94,40,0.5)]"
                  style={{ width: `${(notificationProgress.current / notificationProgress.total) * 100}%` }}
                />
              </div>
              
              <p className="text-[10px] text-center text-[var(--text-muted)] font-medium italic">
                Enviando um por um para garantir a integridade do fluxo.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
