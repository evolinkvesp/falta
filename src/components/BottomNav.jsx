import React from 'react'
import { LayoutDashboard, PlusCircle, Users, Settings } from 'lucide-react'

export default function BottomNav({ currentView, onViewChange }) {
  const menuItems = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'cotar', label: 'Cotar', icon: PlusCircle },
    { id: 'fornecedores', label: 'Fornecedores', icon: Users },
    { id: 'configuracoes', label: 'Config', icon: Settings },
  ]

  return (
    <nav className="mobile-bottom-nav">
      {menuItems.map((item) => {
        const Icon = item.icon
        const isActive = currentView === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onViewChange(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
          >
            <Icon size={20} strokeWidth={isActive ? 3 : 2} />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
