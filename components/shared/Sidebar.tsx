'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, FileText, Cog, Calendar, FolderOpen, Settings,
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
]

export function Sidebar() {
  const { band } = useBand()
  const pathname = usePathname()
  const base = `/${band.slug}`

  return (
    <aside className="w-56 bg-white border-r flex flex-col">
      <div className="p-4 border-b">
        <h1 className="font-bold text-lg">{band.name}</h1>
        <p className="text-xs text-gray-400">PanelAp</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const fullPath = `${base}${href}`
          const isActive = href === ''
            ? pathname === base
            : pathname.startsWith(fullPath)
          return (
            <Link
              key={href}
              href={fullPath}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
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
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <Settings size={14} /> Configurações
        </Link>
      </div>
    </aside>
  )
}
