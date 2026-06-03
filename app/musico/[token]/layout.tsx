import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Minha Agenda — PanelAp',
}

export default function MusicianLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
