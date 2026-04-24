import React, { useState, useEffect } from 'react';
import { Plus, Search, MapPin, Phone, Mail, Globe, Star, Trash2, Edit, ExternalLink, ShieldCheck, Zap, MoreVertical, X, Check, Loader2, Users, LayoutGrid, Power, PowerOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SupplierManager = () => {
   const [suppliers, setSuppliers] = useState([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState(null);
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [searchTerm, setSearchTerm] = useState('');
   const [newSupplier, setNewSupplier] = useState({
      nome: '',
      email: '',
      contato: '',
      status: 'ativo'
   });

   useEffect(() => {
      fetchSuppliers();
   }, []);

   async function fetchSuppliers() {
      try {
         const { data, error } = await supabase
            .from('fornecedores')
            .select('*')
            .order('nome');

         if (error) throw error;
         setSuppliers(data);
      } catch (err) {
         setError(err.message);
      } finally {
         setLoading(false);
      }
   }

   const handleAddSupplier = async (e) => {
      e.preventDefault();
      try {
         const payload = {
            nome: newSupplier.nome,
            email: newSupplier.email,
            whatsapp: newSupplier.contato,
            status: newSupplier.status
         };

         const { data, error } = await supabase
            .from('fornecedores')
            .insert([payload])
            .select();

         if (error) throw error;
         setSuppliers([...suppliers, data[0]]);
         setIsModalOpen(false);
         setNewSupplier({ nome: '', email: '', contato: '', status: 'ativo' });
      } catch (err) {
         alert('Erro ao adicionar fornecedor: ' + err.message);
      }
   };

   const toggleStatus = async (supplier) => {
      const newStatus = supplier.status === 'ativo' ? 'inativo' : 'ativo';
      try {
         const { error } = await supabase
            .from('fornecedores')
            .update({ status: newStatus })
            .eq('id', supplier.id);
         
         if (error) throw error;
         
         setSuppliers(suppliers.map(s => 
            s.id === supplier.id ? { ...s, status: newStatus } : s
         ));
      } catch (err) {
         alert('Erro ao atualizar status: ' + err.message);
      }
   };

   const deleteSupplier = async (id) => {
      if (!window.confirm('Tem certeza que deseja excluir este fornecedor?')) return;
      try {
         const { error } = await supabase
            .from('fornecedores')
            .delete()
            .eq('id', id);
         
         if (error) throw error;
         setSuppliers(suppliers.filter(s => s.id !== id));
      } catch (err) {
         alert('Erro ao excluir: ' + err.message);
      }
   };

   const filteredSuppliers = suppliers.filter(s => 
      s.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.cidade?.toLowerCase().includes(searchTerm.toLowerCase())
   );

   return (
      <div className="space-y-8 animate-fade-in w-full">
         {/* Header Section */}
         <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-[var(--border)]">
            <div className="space-y-3">
               <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0EA5E9] animate-pulse"></span>
                  <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Rede de Fornecedores</span>
               </div>
               <h1 className="text-3xl sm:text-5xl font-extrabold text-[var(--text-main)] tracking-tight leading-none">Gestão de Parceiros</h1>
               <p className="text-sm text-[var(--text-muted)] font-medium max-w-xl">
                  Administre sua rede de distribuição e monitore a performance estratégica da sua farmácia.
               </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
               <div className="relative group min-w-[280px] lg:min-w-[350px]">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[#0EA5E9]" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar distribuidora..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-14 pr-8 py-4 bg-[var(--accent)] border border-[var(--border)] rounded-2xl text-sm font-bold text-[var(--text-main)] outline-none focus:border-[#0EA5E9]/30 transition-all"
                  />
               </div>
               <button 
                 onClick={() => setIsModalOpen(true)}
                 className="btn-primary flex-1 sm:flex-none h-[56px] px-8"
               >
                  <Plus size={20} strokeWidth={3} />
                  Cadastrar Novo
               </button>
            </div>
         </div>

         {/* Content Grid */}
         {loading ? (
            <div className="py-24 text-center">
               <Loader2 className="animate-spin mx-auto text-[#0EA5E9] mb-6" size={48} />
               <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Sincronizando Parceiros...</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
               {filteredSuppliers.map((s) => (
                  <div key={s.id} className={`card flex flex-col h-full hover:border-[#0EA5E9]/40 hover:shadow-2xl transition-all group ${s.status === 'inativo' ? 'opacity-60 grayscale-[0.5]' : ''} !p-6`}>
                     <div className="flex items-start justify-between mb-6">
                        <div className={`w-14 h-14 border border-[var(--border)] rounded-2xl flex items-center justify-center text-xl font-black shadow-xl group-hover:scale-110 transition-transform ${s.status === 'ativo' ? 'bg-[var(--bg-main)] text-[#0EA5E9]' : 'bg-[var(--accent)] text-[var(--text-muted)]'}`}>
                           {s.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${
                           s.status === 'ativo' ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-[var(--text-muted)]'
                        }`}>
                           <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'ativo' ? 'bg-green-500' : 'bg-slate-500'}`} />
                           {s.status}
                        </div>
                     </div>

                     <div className="space-y-1 mb-6 flex-1">
                        <h3 className="text-lg font-extrabold text-[var(--text-main)] tracking-tight group-hover:text-[#0EA5E9] transition-colors line-clamp-1">{s.nome}</h3>
                     </div>

                     <div className="space-y-3 py-6 border-t border-[var(--border)]">
                        <div className="flex items-center justify-between">
                           <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">WhatsApp</span>
                           <span className="text-[11px] font-black text-[var(--text-main)]">{s.whatsapp || 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                           <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Corporativo</span>
                           <span className="text-[11px] font-black text-[#0EA5E9] truncate max-w-[120px]">{s.email || 'N/A'}</span>
                        </div>
                     </div>

                     <div className="mt-6 flex gap-2">
                        <button 
                           onClick={() => toggleStatus(s)}
                           className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[9px] uppercase tracking-widest border border-[var(--border)] transition-all ${
                              s.status === 'ativo' ? 'bg-[var(--bg-card)] text-white hover:bg-slate-700' : 'bg-[#0EA5E9] text-white hover:bg-[#0284C7]'
                           }`}
                        >
                           {s.status === 'ativo' ? <><PowerOff size={12} /> Desativar</> : <><Power size={12} /> Ativar</>}
                        </button>
                        <button 
                           onClick={() => deleteSupplier(s.id)}
                           className="w-10 h-10 flex items-center justify-center bg-[var(--accent)] hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 rounded-xl border border-[var(--border)] transition-all"
                        >
                           <Trash2 size={16} />
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         )}

         {/* Add Modal */}
         {isModalOpen && (
            <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/90 backdrop-blur-sm animate-fade-in">
               <div className="bg-[var(--bg-card)] w-full sm:max-w-2xl rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl overflow-hidden animate-scale-up max-h-[90vh] overflow-y-auto border-t sm:border border-[var(--border)]">
                  <div className="p-8 md:p-10 border-b border-[var(--border)] flex justify-between items-center bg-[var(--accent)]/50 sticky top-0 z-10">
                     <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-[#0EA5E9] text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-[#0EA5E9]/20">
                           <Users size={28} />
                        </div>
                        <div>
                           <h3 className="text-2xl font-extrabold text-[var(--text-main)] tracking-tight">Novo Parceiro</h3>
                           <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">Cadastro Estratégico</p>
                        </div>
                     </div>
                     <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center bg-[var(--accent)] border border-[var(--border)] rounded-2xl text-[var(--text-muted)] hover:text-[#0EA5E9] transition-all">
                        <X size={20} />
                     </button>
                  </div>

                  <form onSubmit={handleAddSupplier} className="p-8 md:p-10 space-y-8">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div className="sm:col-span-2 space-y-3">
                           <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">Razão Social</label>
                           <input 
                             required 
                             className="w-full px-6 py-4 bg-[var(--bg-main)] border border-[var(--border)] rounded-2xl font-bold text-[var(--text-main)] outline-none focus:border-[#0EA5E9]/30 transition-all" 
                             placeholder="Ex: Distribuidora MedFarma LTDA"
                             value={newSupplier.nome}
                             onChange={(e) => setNewSupplier({...newSupplier, nome: e.target.value})}
                           />
                        </div>

                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">WhatsApp</label>
                           <input 
                             required 
                             className="w-full px-6 py-4 bg-[var(--bg-main)] border border-[var(--border)] rounded-2xl font-bold text-[var(--text-main)] outline-none focus:border-[#0EA5E9]/30 transition-all" 
                             placeholder="(11) 99999-9999"
                             value={newSupplier.contato}
                             onChange={(e) => setNewSupplier({...newSupplier, contato: e.target.value})}
                           />
                        </div>
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">E-mail</label>
                           <input 
                             required 
                             type="email"
                             className="w-full px-6 py-4 bg-[var(--bg-main)] border border-[var(--border)] rounded-2xl font-bold text-[var(--text-main)] outline-none focus:border-[#0EA5E9]/30 transition-all" 
                             placeholder="contato@fornecedor.com.br"
                             value={newSupplier.email}
                             onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})}
                           />
                        </div>
                     </div>

                     <div className="flex justify-end pt-6">
                        <button type="submit" className="btn-primary w-full sm:w-auto px-12 py-5 text-sm">
                           Confirmar Cadastro
                        </button>
                     </div>
                  </form>
               </div>
            </div>
         )}
      </div>
   );
};

export default SupplierManager;
