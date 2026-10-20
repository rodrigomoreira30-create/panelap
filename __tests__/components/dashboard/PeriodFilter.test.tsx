import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PeriodFilter, selectionForPreset, type PeriodSelection } from '@/components/dashboard/PeriodFilter'
import { resolvePresetRange } from '@/lib/dashboard-period'

const base: PeriodSelection = selectionForPreset('30d', 'evento')

describe('PeriodFilter', () => {
  it('mantém 7/30/90 dias e adiciona Este mês, Este ano e Personalizado', () => {
    render(<PeriodFilter value={base} onChange={() => {}} />)
    for (const label of ['7 dias', '30 dias', '90 dias', 'Este mês', 'Este ano', 'Personalizado']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it.each([
    ['7 dias', '7d'],
    ['30 dias', '30d'],
    ['90 dias', '90d'],
    ['Este mês', 'month'],
    ['Este ano', 'year'],
  ] as const)('preset %s resolve o intervalo correspondente', (label, preset) => {
    const onChange = vi.fn()
    render(<PeriodFilter value={base} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(onChange).toHaveBeenCalledWith({ preset, criterion: 'evento', ...resolvePresetRange(preset, new Date()) })
  })

  it('personalizado: aplica intervalo entre anos diferentes', () => {
    const onChange = vi.fn()
    render(<PeriodFilter value={base} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }))
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2025-01-01' } })
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2027-06-30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtro' }))
    expect(onChange).toHaveBeenCalledWith({ preset: 'custom', criterion: 'evento', from: '2025-01-01', to: '2027-06-30' })
  })

  it('personalizado: bloqueia data inicial depois da final', () => {
    const onChange = vi.fn()
    render(<PeriodFilter value={base} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }))
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-06-01' } })
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtro' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText(/data inicial deve ser anterior/i)).toBeInTheDocument()
  })

  it('limpar filtro volta ao padrão de 30 dias, preservando o critério', () => {
    const onChange = vi.fn()
    render(<PeriodFilter value={{ ...base, criterion: 'recebimento' }} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtro' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ preset: '30d', criterion: 'recebimento' }))
  })

  it('troca o critério de análise sem alterar o período', () => {
    const onChange = vi.fn()
    render(<PeriodFilter value={base} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Data do recebimento' }))
    expect(onChange).toHaveBeenCalledWith({ ...base, criterion: 'recebimento' })
  })
})
