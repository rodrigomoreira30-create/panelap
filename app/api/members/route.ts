import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createMemberSchema = z.object({
  name:     z.string().min(2, 'Nome obrigatório'),
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha mínima de 6 caracteres'),
  role:     z.enum(['musician', 'producer', 'commercial', 'admin']),
})

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fullUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true, band_id: true },
  })
  if (!fullUser || fullUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { name, email, password, role } = parsed.data

  const existing = await prisma.user.findFirst({
    where: { band_id: fullUser.band_id, email },
  })
  if (existing) {
    return NextResponse.json({ error: 'Email já cadastrado nessa banda' }, { status: 409 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    if (authError?.message.includes('already registered')) {
      return NextResponse.json({ error: 'Email já cadastrado no sistema' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Falha ao criar usuário' }, { status: 500 })
  }

  try {
    const newUser = await prisma.user.create({
      data: {
        band_id:     fullUser.band_id,
        supabase_id: authData.user.id,
        name,
        email,
        role,
      },
      select: { id: true, name: true, email: true, role: true },
    })
    return NextResponse.json({ data: newUser }, { status: 201 })
  } catch (err) {
    await supabase.auth.admin.deleteUser(authData.user.id).catch(() => {})
    console.error('[members] Falha ao criar membro:', err)
    return NextResponse.json({ error: 'Falha ao salvar membro' }, { status: 500 })
  }
}
