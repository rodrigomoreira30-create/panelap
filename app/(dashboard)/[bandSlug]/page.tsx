import { redirect } from 'next/navigation'

export default async function DashboardHomePage({
  params,
}: {
  params: Promise<{ bandSlug: string }>
}) {
  const { bandSlug } = await params
  redirect(`/${bandSlug}/comercial`)
}
