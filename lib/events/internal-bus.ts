type EventMap = {
  'lead.closed':       { lead_id: string; band_id: string }
  'contract.signed':   { contract_id: string }
  'event.created':     { event_id: string; band_id: string }
  'musician.confirmed': { event_musician_id: string }
}

type EventName = keyof EventMap
type Handler<E extends EventName> = (payload: EventMap[E]) => void | Promise<void>

class InternalEventBus {
  private listeners = new Map<EventName, Set<Handler<EventName>>>()

  on<E extends EventName>(event: E, handler: Handler<E>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler as Handler<EventName>)
  }

  off<E extends EventName>(event: E, handler: Handler<E>): void {
    this.listeners.get(event)?.delete(handler as Handler<EventName>)
  }

  emit<E extends EventName>(event: E, payload: EventMap[E]): void {
    this.listeners.get(event)?.forEach(handler => handler(payload))
  }
}

const globalBus = globalThis as unknown as { __eventBus?: InternalEventBus }
export const eventBus = globalBus.__eventBus ?? new InternalEventBus()
if (process.env.NODE_ENV !== 'production') globalBus.__eventBus = eventBus
