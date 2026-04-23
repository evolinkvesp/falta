import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import QuoteInput from './components/QuoteInput'
import ComparisonView from './components/ComparisonView'
import SupplierPortal from './components/SupplierPortal'
import SupplierManager from './components/SupplierManager'

function App() {
  const [view, setView] = useState('dashboard') // 'dashboard', 'cotar', 'comparison', 'supplier', 'fornecedores'
  const [selectedQuoteId, setSelectedQuoteId] = useState(null)
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      setView('supplier')
    }
  }, [])

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
      case 'supplier':
        return <SupplierPortal />
      case 'fornecedores':
        return <SupplierManager />
      default:
        return <Dashboard />
    }
  }

  // Supplier portal is standalone
  if (view === 'supplier') return <SupplierPortal />

  return (
    <div className="app-container">
      <div className="main-wrapper">
        <Sidebar currentView={view} onViewChange={handleViewChange} />
        <main className="main-content">
          <div className="content-container">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
