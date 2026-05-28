'use client'

import { createContext, useContext } from 'react'
import type { Band, SessionUser } from '@/types'

interface BandContextValue {
  band: Band
  user: SessionUser
}

const BandContext = createContext<BandContextValue | null>(null)

export function BandProvider({
  band,
  user,
  children,
}: BandContextValue & { children: React.ReactNode }) {
  return (
    <BandContext.Provider value={{ band, user }}>
      {children}
    </BandContext.Provider>
  )
}

export function useBand(): BandContextValue {
  const ctx = useContext(BandContext)
  if (!ctx) throw new Error('useBand deve ser usado dentro de BandProvider')
  return ctx
}
