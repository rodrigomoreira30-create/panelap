import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    lead: {
      findUnique: vi.fn(),
    },
    event: {
      findUnique: vi.fn(),
    },
    contract: {
      findFirst: vi.fn(),
    },
    contractTemplate: {
      findFirst: vi.fn(),
    },
  },
}))

// Mock callClaude to avoid real API calls
vi.mock('@/lib/claude/client', () => ({
  callClaude: vi.fn().mockResolvedValue({ content: [], stop_reason: 'end_turn' }),
  buildSystemWithCache: vi.fn().mockReturnValue([]),
  MODEL: 'claude-sonnet-4-6',
}))

// Mock executeContractTool
vi.mock('@/lib/claude/tools/contract-tools', () => ({
  contractTools: [],
  executeContractTool: vi.fn().mockResolvedValue('{"success":true}'),
}))

// Mock contracts prompts
vi.mock('@/lib/claude/prompts/contracts', () => ({
  CONTRACTS_SYSTEM_PROMPT: 'system prompt',
  buildContractsContext: vi.fn().mockReturnValue('dynamic context'),
}))

import { runContractsAgent } from '@/lib/claude/agents/contracts-agent'
import { prisma } from '@/lib/prisma'

const mockLead = {
  id: 'lead-1',
  client_name: 'João',
  phone: '11999999999',
  event_type: 'wedding',
  event_date: null,
  city: 'São Paulo',
  venue_name: 'Salão X',
  venue_has_sound: false,
  venue_has_light: false,
  budget: null,
  observations: null,
}

const mockEvent = {
  id: 'event-1',
  lead_id: 'lead-1',
  client_name: 'João',
  notes: null,
}

const mockTemplate = {
  id: 'template-1',
  band_id: 'band-1',
  is_default: true,
  content: 'Contrato para {{cliente_nome}}',
}

describe('runContractsAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna silenciosamente quando lead não existe', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(null)
    await expect(runContractsAgent({ lead_id: 'nonexistent', band_id: 'band-1' })).resolves.toBeUndefined()
    expect(prisma.event.findUnique).not.toHaveBeenCalled()
  })

  it('retorna silenciosamente quando evento não existe', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockLead as any)
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null)
    await expect(runContractsAgent({ lead_id: 'lead-1', band_id: 'band-1' })).resolves.toBeUndefined()
    expect(prisma.contract.findFirst).not.toHaveBeenCalled()
  })

  it('retorna silenciosamente quando já existe contrato', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockLead as any)
    vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
    vi.mocked(prisma.contract.findFirst).mockResolvedValue({ id: 'contract-existing' } as any)
    await expect(runContractsAgent({ lead_id: 'lead-1', band_id: 'band-1' })).resolves.toBeUndefined()
    expect(prisma.contractTemplate.findFirst).not.toHaveBeenCalled()
  })

  it('retorna silenciosamente quando não há template padrão', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockLead as any)
    vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
    vi.mocked(prisma.contract.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.contractTemplate.findFirst).mockResolvedValue(null)
    await expect(runContractsAgent({ lead_id: 'lead-1', band_id: 'band-1' })).resolves.toBeUndefined()
  })

  it('chama callClaude quando todos os dados estão presentes', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockLead as any)
    vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
    vi.mocked(prisma.contract.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.contractTemplate.findFirst).mockResolvedValue(mockTemplate as any)

    const { callClaude } = await import('@/lib/claude/client')
    await runContractsAgent({ lead_id: 'lead-1', band_id: 'band-1' })
    expect(callClaude).toHaveBeenCalledOnce()
  })
})
