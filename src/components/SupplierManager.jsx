import React, { useState, useEffect } from 'react';
import { Plus, Search, MapPin, Phone, Mail, Globe, Star, Trash2, Edit, ExternalLink, ShieldCheck, Zap, MoreVertical, X, Check, Loader2, Users, LayoutGrid } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SupplierManager = () => {
   const [suppliers, setSuppliers] = useState([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState(null);
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [newSupplier, setNewSupplier] = useState({
      nome: '',
      email: '',
      contato: '',
      cidade: '',
      estado: '',
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
            cidade: newSupplier.cidade,
            estado: newSupplier.estado,
            status: newSupplier.status
         };

         const { data, error } = await supabase
            .from('fornecedores')
            .insert([payload])
            .select();

         if (error) throw error;
         setSuppliers([...suppliers, data[0]]);
         setIsModalOpen(false);
         setNewSupplier({ nome: '', email: '', contato: '', cidade: '', estado: '', status: 'ativo' });
      } catch (err) {
         alert('Erro ao adicionar fornecedor: ' + err.message);
      }
   };

   return (
      <div className="max-w-7xl mx-auto space-y-12 pb-24 animate-fade-in">
         {/* Header Section */}
         <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 px-2">
            <div className="space-y-4">
               <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#FF5722] animate-pulse"></span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rede de Distribuição</span>
               </div>
               <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-none">Gestão de Fornecedores</h1>
               <p className="text-sm text-slate-500 font-medium max-w-md">
                  Monitore a performance e gerencie o cadastro das distribuidoras parceiras na <span className="text-[#FF5722] font-extrabold">Alice Farma</span>.
               </p>
            </div>
            <div className="flex items-center gap-4">
               <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#FF5722]" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar fornecedor..." 
                    className="pl-14 pr-6 py-3.5 bg-white border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-[#FF5722]/30 transition-all shadow-sm w-64"
                  />
               </div>
               <button 
                 onClick={() => setIsModalOpen(true)}
                 className="bg-[#FF5722] text-white px-8 py-3.5 rounded-full font-black text-sm uppercase tracking-widest shadow-xl shadow-[#FF5722]/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
               >
                  <Plus size={20} strokeWidth={3} />
                  Novo Parceiro
               </button>
            </div>
         </div>

         {/* Content Grid */}
         {loading ? (
            <div className="p-24 text-center">
               <Loader2 className="animate-spin mx-auto text-[#FF5722] mb-6" size={48} />
               <p className="text-xs font-bold text-slate-300 uppercase tracking-[0.3em]">Carregando Fornecedores...</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {suppliers.map((s) => (
                  <div key={s.id} className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 group relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -mr-12 -mt-12 group-hover:bg-[#FF5722]/5 transition-colors"></div>
                     
                     <div className="flex items-start justify-between relative z-10 mb-8">
                        <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-xl font-black shadow-xl shadow-slate-900/10">
                           {s.nome.charAt(0)}
                        </div>
                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                           s.status === 'ativo' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
                        }`}>
                           {s.status}
                        </div>
                     </div>

                     <div className="space-y-2 mb-8 relative z-10">
                        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight group-hover:text-[#FF5722] transition-colors">{s.nome}</h3>
                        <div className="flex items-center gap-2 text-slate-400">
                           <MapPin size={14} />
                           <span className="text-xs font-bold uppercase tracking-wider">{s.cidade} - {s.estado}</span>
                        </div>
                     </div>

                     <div className="space-y-3 pt-8 border-t border-slate-50 relative z-10">
                        <div className="flex items-center justify-between text-sm">
                           <span className="font-bold text-slate-400">Contato</span>
                           <span className="font-black text-slate-900">{s.whatsapp}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                           <span className="font-bold text-slate-400">E-mail</span>
                           <span className="font-black text-[#FF5722]">{s.email}</span>
                        </div>
                     </div>

                     <div className="mt-8 pt-6 flex items-center gap-2 relative z-10">
                        <button className="flex-1 bg-slate-50 hover:bg-[#FF5722] hover:text-white text-slate-900 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
                           Ver Performance
                        </button>
                        <button className="w-12 h-12 flex items-center justify-center bg-slate-50 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-xl transition-all">
                           <Trash2 size={18} />
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         )}

         {/* Add Modal */}
         {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
               <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-up">
                  <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                     <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-[#FF5722] text-white rounded-2xl flex items-center justify-center shadow-xl shadow-[#FF5722]/20">
                           <Users size={28} />
                        </div>
                        <div>
                           <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Novo Parceiro</h3>
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cadastrar Fornecedor na Alice Farma</p>
                        </div>
                     </div>
                     <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-100 rounded-2xl text-slate-300 hover:text-[#FF5722] transition-all">
                        <X size={24} />
                     </button>
                  </div>

                  <form onSubmit={handleAddSupplier} className="p-10 space-y-8">
                     <div className="grid grid-cols-2 gap-8">
                        <div className="col-span-2 space-y-3">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Razão Social</label>
                           <input 
                             required 
                             className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-[#FF5722]/30 focus:bg-white transition-all shadow-sm" 
                             placeholder="Ex: Distribuidora MedFarma LTDA"
                             value={newSupplier.nome}
                             onChange={(e) => setNewSupplier({...newSupplier, nome: e.target.value})}
                           />
                        </div>
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Cidade</label>
                           <input 
                             required 
                             className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-[#FF5722]/30 focus:bg-white transition-all shadow-sm" 
                             placeholder="Ex: São Paulo"
                             value={newSupplier.cidade}
                             onChange={(e) => setNewSupplier({...newSupplier, cidade: e.target.value})}
                           />
                        </div>
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Estado</label>
                           <input 
                             required 
                             className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-[#FF5722]/30 focus:bg-white transition-all shadow-sm" 
                             placeholder="Ex: SP"
                             value={newSupplier.estado}
                             onChange={(e) => setNewSupplier({...newSupplier, estado: e.target.value})}
                           />
                        </div>
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">WhatsApp / Contato</label>
                           <input 
                             required 
                             className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-[#FF5722]/30 focus:bg-white transition-all shadow-sm" 
                             placeholder="(11) 99999-9999"
                             value={newSupplier.contato}
                             onChange={(e) => setNewSupplier({...newSupplier, contato: e.target.value})}
                           />
                        </div>
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">E-mail Corporativo</label>
                           <input 
                             required 
                             type="email"
                             className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-[#FF5722]/30 focus:bg-white transition-all shadow-sm" 
                             placeholder="contato@fornecedor.com.br"
                             value={newSupplier.email}
                             onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})}
                           />
                        </div>
                     </div>

                     <div className="flex justify-end pt-6">
                        <button type="submit" className="px-12 py-5 bg-[#FF5722] text-white rounded-full font-black uppercase tracking-widest shadow-2xl shadow-[#FF5722]/30 hover:scale-105 active:scale-95 transition-all">
                           Finalizar Cadastro
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
