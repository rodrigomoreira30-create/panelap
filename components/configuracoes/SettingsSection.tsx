'use client'

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SettingsSectionProps {
  title: string
  description: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function SettingsSection({
  title,
  description,
  defaultOpen = false,
  children,
}: SettingsSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left"
      >
        <span className="min-w-0">
          <span className="block font-semibold">{title}</span>
          <span className="block text-sm text-muted-foreground truncate">{description}</span>
        </span>
        <ChevronDown
          size={18}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
      <div
        id={contentId}
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
      >
        <div className="overflow-hidden">
          <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t">
            <div className="pt-4">{children}</div>
          </div>
        </div>
      </div>
    </Card>
  )
}
