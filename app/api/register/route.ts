import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { registerSchema } from '@/lib/validations/band'
import { createAsaasCustomer, createAsaasSubscription } from '@/lib/asaas/client'
import { SaasPlan } from '@/lib/generated/prisma/client'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { band_name, admin_name, email, password, plan, cpf_cnpj } = parsed.data

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
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Falha ao criar usuário' }, { status: 500 })
  }

  const supabaseUserId = authData.user.id

  try {
    let slug = generateSlug(band_name)
    const existing = await prisma.band.findUnique({ where: { slug } })
    if (existing) slug = `${slug}-${Date.now()}`

    const asaasCustomer = process.env.ASAAS_API_KEY
      ? await createAsaasCustomer({ name: band_name, email, cpfCnpj: cpf_cnpj }).catch(() => null)
      : null

    const band = await prisma.band.create({
      data: {
        name:     band_name,
        slug,
        plan:     plan as SaasPlan,
        asaas_id: asaasCustomer?.id ?? null,
      },
    })

    await prisma.user.create({
      data: {
        band_id:     band.id,
        supabase_id: supabaseUserId,
        name:        admin_name,
        email,
        role:        'admin',
      },
    })

    if (asaasCustomer) {
      createAsaasSubscription({
        customer_id: asaasCustomer.id,
        plan,
        band_name,
      }).catch(err => console.error('Asaas subscription creation failed:', err))
    }

    return NextResponse.json(
      { data: { band_slug: band.slug, band_id: band.id } },
      { status: 201 }
    )
  } catch (err) {
    await supabase.auth.admin.deleteUser(supabaseUserId).catch(() => {})
    console.error('Registration failed:', err)
    return NextResponse.json({ error: 'Falha no registro' }, { status: 500 })
  }
}
