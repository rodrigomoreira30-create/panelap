'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar, Clock, MapPin, Users } from 'lucide-react'
import { EventInfoPanel } from './EventInfoPanel'
import { EventAttractionsEditor } from './EventAttractionsEditor'
import { EventDetailClient } from './EventDetailClient'
import { EventDocuments } from './EventDocuments'
import { EventAlignmentNotes } from './EventAlignmentNotes'

const eventTypeLabels: Record<string, string> = {
  wedding: 'Casamento', party: 'Festa', show: 'Show',
  corporate: 'Corporativo', other: 'Outro',
}

const statusLabels: Record<string, string> = {
  contracted: 'Contratado', active: 'Em andamento', done: 'Concluído',
}

const statusColors: Record<string, string> = {
  contracted: 'bg-blue-100 text-blue-700',
  active:     'bg-green-100 text-green-700',
  done:       'bg-gray-100 text-gray-600',
}

type Tab = 'geral' | 'formacao' | 'anexos' | 'financeiro' | 'tarefas' | 'chat'

const TABS: { key: Tab; label: string }[] = [
  { key: 'geral',       label: 'Geral' },
  { key: 'formacao',    label: 'Formação' },
  { key: 'anexos',      label: 'Anexos' },
  { key: 'financeiro',  label: 'Financeiro' },
  { key: 'tarefas',     label: 'Tarefas' },
  { key: 'chat',        label: 'Chat' },
]

interface EventInfo {
  id: string
  client_name: string
  event_type: string
  event_date: string
  event_time: string | null
  venue_name: string
  venue_address: string | null
  venue_has_sound: boolean
  venue_has_light: boolean
  value: number
  status: string
}

interface AttractionItem {
  id: string
  name: string
  custom_value: number
  observations: string | null
}

interface Doc {
  id: string
  file_name: string
  file_url: string
  created_at: string
}

interface EventTabsProps {
  // Header + EventInfoPanel
  event: EventInfo
  musicianCount: number

  // Geral — atrações
  attractions: { id: string; name: string }[]
  attractionsTotal: number | null
  assessor: string | null
  assessorPhone: string | null
  leadId: string | null
  leadAttractions: AttractionItem[]
  initialDiscount: number

  // Formação
  eventoId: string
  bandMembers: { id: string; name: string }[]
  initialTeamNotes: string | null

  // Anexos
  initialDocs: Doc[]

  // Alinhamento (Geral)
  initialNotes: string | null
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
      <p className="text-sm">Aba <strong>{label}</strong> em breve</p>
    </div>
  )
}

export function EventTabs({
  event,
  musicianCount,
  attractions,
  attractionsTotal,
  assessor,
  assessorPhone,
  leadId,
  leadAttractions,
  initialDiscount,
  eventoId,
  bandMembers,
  initialTeamNotes,
  initialDocs,
  initialNotes,
}: EventTabsProps) {
  const [tab, setTab] = useState<Tab>('geral')

  const [y, m, d] = event.event_date.slice(0, 10).split('-').map(Number)
  const dateDisplay = format(new Date(y, m - 1, d), "EEE., dd 'de' MMM. 'de' yyyy", { locale: ptBR })

  return (
    <div className="max-w-4xl space-y-0">
      {/* ── Header ── */}
      <div className="pb-4 border-b">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.client_name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{eventTypeLabels[event.event_type] ?? event.event_type}</p>
          </div>
          <span className={`mt-1 shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[event.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {statusLabels[event.status] ?? event.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <Calendar size={14} className="text-gray-400" />
            {dateDisplay}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={14} className="text-gray-400" />
            {event.event_time ?? '—'}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin size={14} className="text-gray-400" />
            {event.venue_name}
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={14} className="text-gray-400" />
            {musicianCount} músico{musicianCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex border-b">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="pt-6">
        {tab === 'geral' && (
          <div className="space-y-8">
            <EventInfoPanel
              event={event}
              attractions={attractions}
              attractionsTotal={attractionsTotal}
              assessor={assessor}
              assessorPhone={assessorPhone}
              leadId={leadId}
            />
            {leadId && (
              <EventAttractionsEditor
                leadId={leadId}
                initialAttractions={leadAttractions}
                initialDiscount={initialDiscount}
              />
            )}
            <EventDetailClient
              eventoId={eventoId}
              bandMembers={bandMembers}
              initialTeamNotes={initialTeamNotes}
              sections={['checklist']}
            />
            <EventAlignmentNotes eventId={eventoId} initialNotes={initialNotes} />
          </div>
        )}

        {tab === 'formacao' && (
          <EventDetailClient
            eventoId={eventoId}
            bandMembers={bandMembers}
            initialTeamNotes={initialTeamNotes}
            sections={['team']}
          />
        )}

        {tab === 'anexos' && (
          <EventDocuments eventId={eventoId} initialDocs={initialDocs} />
        )}

        {tab === 'financeiro' && <PlaceholderTab label="Financeiro" />}
        {tab === 'tarefas'    && <PlaceholderTab label="Tarefas" />}
        {tab === 'chat'       && <PlaceholderTab label="Chat" />}
      </div>
    </div>
  )
}
