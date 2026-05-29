export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function detectConflict(targetDate: Date, bookedDates: Date[]): boolean {
  return bookedDates.some(d => isSameDay(d, targetDate))
}

export async function getConflictingEvents(
  bandId: string,
  targetDate: Date,
  excludeEventId?: string
): Promise<string[]> {
  const { prisma } = await import('@/lib/prisma')

  const events = await prisma.event.findMany({
    where: {
      band_id: bandId,
      status: { in: ['contracted', 'active'] },
      ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
    },
    select: { id: true, event_date: true },
  })

  return events
    .filter(e => isSameDay(new Date(e.event_date), targetDate))
    .map(e => e.id)
}
