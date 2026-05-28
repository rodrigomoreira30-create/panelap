import { ContractStatus } from '@/lib/generated/prisma/client'

const STATUS_CONFIG: Record<ContractStatus, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-gray-100 text-gray-700' },
  pending_review: { label: 'Em Revisão', className: 'bg-yellow-100 text-yellow-700' },
  sent: { label: 'Enviado', className: 'bg-blue-100 text-blue-700' },
  signed: { label: 'Assinado', className: 'bg-green-100 text-green-700' },
}

type Props = { status: ContractStatus }

export function ContractStatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
