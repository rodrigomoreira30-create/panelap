import Anthropic from '@anthropic-ai/sdk'

const globalForAnthropic = globalThis as unknown as { anthropic?: Anthropic }

export const anthropic =
  globalForAnthropic.anthropic ??
  new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    // Required for jsdom test environment; safe because no real calls are made in tests
    dangerouslyAllowBrowser: process.env.NODE_ENV !== 'production',
  })

if (process.env.NODE_ENV !== 'production') globalForAnthropic.anthropic = anthropic

export const MODEL = 'claude-sonnet-4-6' as const

const CHARS_PER_TOKEN = 4

export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 13) + '...[truncado]'
}

export function buildSystemWithCache(
  staticPrompt: string,
  dynamicContext?: string
): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: staticPrompt,
      cache_control: { type: 'ephemeral' },
    },
  ]

  if (dynamicContext) {
    blocks.push({
      type: 'text',
      text: dynamicContext,
    })
  }

  return blocks
}

export async function callClaude(params: Anthropic.MessageCreateParamsNonStreaming) {
  try {
    return await anthropic.messages.create(params)
  } catch (err: unknown) {
    const e = err as { status?: number }
    if (e?.status === 529) {
      await new Promise(r => setTimeout(r, 5000))
      return await anthropic.messages.create(params)
    }
    throw err
  }
}
