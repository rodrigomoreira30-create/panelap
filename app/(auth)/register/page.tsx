'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    band_name: '', admin_name: '', email: '', password: '', plan: 'starter',
  })

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const { error } = await res.json()
      setError(typeof error === 'string' ? error : 'Erro ao criar conta')
      setLoading(false)
      return
    }

    const { data } = await res.json()

    const supabase = createClient()
    await supabase.auth.signInWithPassword({ email: form.email, password: form.password })

    router.push(`/${data.band_slug}/comercial`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Criar conta — PanelAp</CardTitle>
          <p className="text-center text-gray-500 text-sm">14 dias grátis, sem cartão de crédito</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label>Nome da banda *</Label>
              <Input value={form.band_name} onChange={e => set('band_name', e.target.value)} required />
            </div>
            <div>
              <Label>Seu nome *</Label>
              <Input value={form.admin_name} onChange={e => set('admin_name', e.target.value)} required />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div>
              <Label>Senha *</Label>
              <Input type="password" value={form.password} onChange={e => set('password', e.target.value)} required />
            </div>
            <div>
              <Label>Plano</Label>
              <Select value={form.plan} onValueChange={v => set('plan', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter — R$ 97/mês</SelectItem>
                  <SelectItem value="pro">Pro — R$ 197/mês</SelectItem>
                  <SelectItem value="enterprise">Enterprise — R$ 397/mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar conta gratuita'}
            </Button>
            <p className="text-center text-sm text-gray-500">
              Já tem conta?{' '}
              <a href="/login" className="underline">Entrar</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
