'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, FileText, Cog, Calendar,
  FolderOpen, Settings, DollarSign, Menu, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBand } from './BandProvider'

const navItems = [
  { href: '',            label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/comercial',  label: 'Comercial',   icon: Users },
  { href: '/contratos',  label: 'Contratos',   icon: FileText },
  { href: '/producao',   label: 'Produção',    icon: Cog },
  { href: '/agenda',     label: 'Agenda',      icon: Calendar },
  { href: '/documentos', label: 'Documentos',  icon: FolderOpen },
  { href: '/financas',   label: 'Finanças',    icon: DollarSign },
]

function NavLinks({ base, pathname, onNavigate }: { base: string; pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const fullPath = `${base}${href}`
          const isActive = href === '' ? pathname === base : pathname.startsWith(fullPath)
          return (
            <Link
              key={href}
              href={fullPath}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t">
        <Link
          href={`${base}/configuracoes`}
          onClick={onNavigate}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <Settings size={14} /> Configurações
        </Link>
      </div>
    </>
  )
}

export function Sidebar() {
  const { band } = useBand()
  const pathname = usePathname()
  const base = `/${band.slug}`
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 bg-white border-r flex-col shrink-0">
        <div className="p-4 border-b">
          <h1 className="font-bold text-lg">{band.name}</h1>
          <p className="text-xs text-gray-400">PanelAp</p>
        </div>
        <NavLinks base={base} pathname={pathname} />
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b flex items-center gap-3 px-4 h-14">
        <button
          onClick={() => setOpen(true)}
          className="p-1 -ml-1 text-gray-600 hover:text-gray-900"
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </button>
        <div>
          <p className="font-bold text-sm leading-none">{band.name}</p>
          <p className="text-[10px] text-gray-400">PanelAp</p>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {open && (
        <>
          {/* Overlay */}
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40"
            onClick={() => setOpen(false)}
          />
          {/* Drawer */}
          <aside className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-64 bg-white flex flex-col shadow-2xl">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h1 className="font-bold text-lg">{band.name}</h1>
                <p className="text-xs text-gray-400">PanelAp</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700"
                aria-label="Fechar menu"
              >
                <X size={20} />
              </button>
            </div>
            <NavLinks base={base} pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </>
      )}
    </>
  )
}
