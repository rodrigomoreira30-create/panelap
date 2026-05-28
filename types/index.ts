import type {
  Band, User, Lead, Event, Contract, ContractTemplate,
  Checklist, ChecklistItem, EventMusician, Document, Message,
  UserRole, LeadStatus, EventType, ContractStatus,
  EventStatus, DocumentType, MusicianConfirmStatus,
} from '@/lib/generated/prisma/client'

export type {
  Band, User, Lead, Event, Contract, ContractTemplate,
  Checklist, ChecklistItem, EventMusician, Document, Message,
  UserRole, LeadStatus, EventType, ContractStatus,
  EventStatus, DocumentType, MusicianConfirmStatus,
}

// Tipos com relações populadas
export type LeadWithMessages = Lead & { messages: Message[] }
export type LeadWithAssignee = Lead & { assignee: User | null }
export type LeadFull = Lead & { messages: Message[]; assignee: User | null }

export type EventFull = Event & {
  lead: Lead
  contracts: Contract[]
  checklists: (Checklist & { items: ChecklistItem[] })[]
  event_musicians: (EventMusician & { user: User })[]
  documents: Document[]
}

export type ContractFull = Contract & {
  template: ContractTemplate
  event: Event
  reviewer: User | null
}

// Payload de resposta de API
export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: string }

// Context da sessão
export type SessionUser = {
  id: string
  band_id: string
  name: string
  email: string
  role: UserRole
}
