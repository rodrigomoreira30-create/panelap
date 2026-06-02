// app/(dashboard)/[bandSlug]/page.tsx
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export default async function DashboardHomePage({
  params,
}: {
  params: Promise<{ bandSlug: string }>
}) {
  const { bandSlug } = await params
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm">Visão geral do negócio</p>
      </div>
      <DashboardClient bandSlug={bandSlug} />
    </div>
  )
}
