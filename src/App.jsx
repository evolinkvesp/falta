import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import QuoteInput from './components/QuoteInput'
import ComparisonView from './components/ComparisonView'
import SupplierPortal from './components/SupplierPortal'
import SupplierManager from './components/SupplierManager'
import Login from './components/Login'
import { useAuth } from './lib/AuthContext'
import { Loader2 } from 'lucide-react'
import Settings from './components/Settings'
import BottomNav from './components/BottomNav'
import logo from './assets/logo.png'

function App() {
  const [view, setView] = useState('dashboard')
  const [selectedQuoteId, setSelectedQuoteId] = useState(null)
  const { user, profile, loading } = useAuth()
  const pharmacyName = profile?.farmacias?.nome
  const pharmacyInitials = (pharmacyName?.substring(0, 2) || 'AF').toUpperCase()
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      setView('supplier')
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    )
  }

  // Se for um fornecedor acessando via link direto (token), não precisa de login
  if (view === 'supplier') return <SupplierPortal />

  // Se não estiver logado ou não tiver perfil/farmácia, mostra tela de login/onboarding
  if (!user || !profile?.farmacia_id) {
    return <Login />
  }

  const handleViewChange = (newView) => {
    setView(newView)
  }

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard onNew={() => setView('cotar')} onViewQuote={(id) => { setSelectedQuoteId(id); setView('comparison'); }} />
      case 'cotar':
        return <QuoteInput onBack={() => setView('dashboard')} onProcessComplete={(id) => { setSelectedQuoteId(id); setView('comparison'); }} />
      case 'comparison':
        return <ComparisonView quoteId={selectedQuoteId} onBack={() => setView('dashboard')} />
      case 'fornecedores':
        return <SupplierManager />
      case 'configuracoes':
        return <Settings />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="app-container">
      <div className="main-wrapper">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[1100] focus:rounded-lg focus:bg-[var(--bg-card)] focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-[var(--text-main)] focus:shadow-lg"
        >
          Pular para o conteúdo
        </a>
        <Sidebar currentView={view} onViewChange={handleViewChange} />
        <main id="main" className="main-content">
          <div className="content-container">
             <div className="mb-8 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                   {/* Logo para Mobile */}
                   <div className="block md:hidden">
                      <img 
                        src={logo} 
                        alt="Alice Farma" 
                        className="h-10 w-auto transition-all duration-300 dark:invert" 
                      />
                   </div>

                   {/* Initials para Desktop (já que tem logo no sidebar) */}
                   <div className="hidden md:flex w-10 h-10 rounded-xl bg-blue-500/10 items-center justify-center text-blue-500">
                      <span className="text-xs font-black">{pharmacyInitials}</span>
                   </div>

                   <div className="min-w-0">
                      <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Unidade Ativa</p>
                      <h2 className="truncate text-sm font-bold text-[var(--text-main)]">{profile?.farmacias?.nome || 'Alice Farma'}</h2>
                   </div>
                </div>
             </div>
            {renderView()}
          </div>
        </main>
      </div>
      <BottomNav currentView={view} onViewChange={handleViewChange} />
    </div>
  )
}

export default App
