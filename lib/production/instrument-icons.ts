import {
  Guitar,
  Drum,
  Piano,
  MicVocal,
  Volume2,
  Turntable,
  Lightbulb,
  Users,
  Music,
  Music2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

/** Ícone genérico usado quando não há instrumento/função definida, ou quando o
 * valor não possui um ícone específico mapeado. Garante que a UI nunca quebre
 * ao encontrar um instrumento novo/ainda não mapeado. */
export const DEFAULT_INSTRUMENT_ICON: LucideIcon = Music

/** Mapa instrumento/função → ícone, usando os valores exatos que já existem no
 * PanelAp (ver components/producao/InstrumentPicker.tsx). As chaves ficam em
 * minúsculas — a normalização de capitalização/espaços é feita em getInstrumentIcon. */
const INSTRUMENT_ICON_MAP: Record<string, LucideIcon> = {
  // Teclas
  'acordeom':     Piano,
  'órgão':        Piano,
  'piano':        Piano,
  'sintetizador': Piano,
  'teclado':      Piano,

  // Voz
  'backing vocal':  MicVocal,
  'baixo (voz)':    MicVocal,
  'barítono':       MicVocal,
  'contralto':      MicVocal,
  'soprano':        MicVocal,
  'tenor':          MicVocal,
  'vocal':          MicVocal,
  'voz feminina':   MicVocal,
  'voz masculina':  MicVocal,
  // variações comuns fora do seletor atual, mantidas por resiliência
  'cantor':         MicVocal,
  'cantora':        MicVocal,
  'vocalista':      MicVocal,

  // Cordas — sem ícone dedicado por instrumento na biblioteca; usa o mais próximo (violão/guitarra)
  'baixo':                 Guitar,
  'bandolim':              Guitar,
  'cavaquinho':            Guitar,
  'contrabaixo acústico':  Guitar,
  'guitarra':              Guitar,
  'harpa':                 Guitar,
  'ukulele':               Guitar,
  'viola':                 Guitar,
  'violão':                Guitar,
  'violino':               Guitar,
  'violoncelo':            Guitar,

  // Percussão
  'bateria':    Drum,
  'cajón':      Drum,
  'percussão':  Drum,

  // Sopros — sem ícone dedicado na biblioteca; usa uma nota estilizada para
  // diferenciar do fallback genérico
  'flauta':    Music2,
  'saxofone':  Music2,
  'trombone':  Music2,
  'trompete':  Music2,

  // Outros
  'dj':               Turntable,
  'equipe de som':    Volume2,
  'técnico':          Users,
  'time allmusic':    Users,
  'time beats':       Users,
  'time sb':          Users,
  'cerimônia':        Sparkles,

  // Valor não oferecido pelo seletor atual, mantido por resiliência a dados legados
  'iluminação': Lightbulb,
}

/** Resolve o ícone lucide-react correspondente a um instrumento/função da Formação.
 * Resiliente a diferenças de capitalização e espaços nas pontas (ex.: "BATERIA",
 * " Bateria ", "bateria" resolvem para o mesmo ícone). Instrumentos sem mapeamento
 * específico caem no ícone genérico de nota musical — nunca lança erro. */
export function getInstrumentIcon(instrument: string | null | undefined): LucideIcon {
  if (!instrument) return DEFAULT_INSTRUMENT_ICON
  const key = instrument.trim().toLowerCase()
  return INSTRUMENT_ICON_MAP[key] ?? DEFAULT_INSTRUMENT_ICON
}
