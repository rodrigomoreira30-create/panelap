-- PanelAp RLS Policies
-- Execute no Supabase Dashboard → SQL Editor
-- O service_role usado pelo Prisma ignora RLS automaticamente.
-- Este script bloqueia acesso via REST API pública (anon key).

-- ─── 1. Habilitar RLS em todas as tabelas ────────────────────────────────────

ALTER TABLE "Band"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContractTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contract"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Checklist"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChecklistItem"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventMusician"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attraction"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadAttraction"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventFinance"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventFinanceItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventPayment"     ENABLE ROW LEVEL SECURITY;

-- ─── 2. Função auxiliar: retorna o band_id do usuário autenticado ─────────────

CREATE OR REPLACE FUNCTION auth_band_id()
RETURNS TEXT AS $$
  SELECT band_id FROM "User"
  WHERE supabase_id = auth.uid()::text
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ─── 3. Remover políticas antigas (evita conflito ao re-executar) ─────────────

DROP POLICY IF EXISTS "band_own"               ON "Band";
DROP POLICY IF EXISTS "user_own_band"          ON "User";
DROP POLICY IF EXISTS "lead_own_band"          ON "Lead";
DROP POLICY IF EXISTS "event_own_band"         ON "Event";
DROP POLICY IF EXISTS "template_own_band"      ON "ContractTemplate";
DROP POLICY IF EXISTS "contract_own_band"      ON "Contract";
DROP POLICY IF EXISTS "checklist_own_band"     ON "Checklist";
DROP POLICY IF EXISTS "checklist_item_own_band" ON "ChecklistItem";
DROP POLICY IF EXISTS "event_musician_own_band" ON "EventMusician";
DROP POLICY IF EXISTS "document_own_band"      ON "Document";
DROP POLICY IF EXISTS "message_own_band"       ON "Message";
DROP POLICY IF EXISTS "attraction_own_band"    ON "Attraction";
DROP POLICY IF EXISTS "lead_attraction_own_band" ON "LeadAttraction";
DROP POLICY IF EXISTS "finance_own_band"       ON "EventFinance";
DROP POLICY IF EXISTS "finance_item_own_band"  ON "EventFinanceItem";
DROP POLICY IF EXISTS "event_payment_own_band" ON "EventPayment";

-- ─── 4. Políticas por tabela ──────────────────────────────────────────────────

-- Band: acessa apenas a própria banda
CREATE POLICY "band_own" ON "Band"
  USING (id = auth_band_id())
  WITH CHECK (id = auth_band_id());

-- User: acessa apenas usuários da mesma banda
CREATE POLICY "user_own_band" ON "User"
  USING (band_id = auth_band_id())
  WITH CHECK (band_id = auth_band_id());

-- Lead: acessa apenas leads da própria banda
CREATE POLICY "lead_own_band" ON "Lead"
  USING (band_id = auth_band_id())
  WITH CHECK (band_id = auth_band_id());

-- Event: acessa apenas eventos da própria banda
CREATE POLICY "event_own_band" ON "Event"
  USING (band_id = auth_band_id())
  WITH CHECK (band_id = auth_band_id());

-- ContractTemplate: acessa apenas templates da própria banda
CREATE POLICY "template_own_band" ON "ContractTemplate"
  USING (band_id = auth_band_id())
  WITH CHECK (band_id = auth_band_id());

-- Contract: acessa apenas contratos de eventos da própria banda
CREATE POLICY "contract_own_band" ON "Contract"
  USING (
    event_id IN (SELECT id FROM "Event" WHERE band_id = auth_band_id())
  )
  WITH CHECK (
    event_id IN (SELECT id FROM "Event" WHERE band_id = auth_band_id())
  );

-- Checklist: acessa apenas checklists de eventos da própria banda
CREATE POLICY "checklist_own_band" ON "Checklist"
  USING (
    event_id IN (SELECT id FROM "Event" WHERE band_id = auth_band_id())
  )
  WITH CHECK (
    event_id IN (SELECT id FROM "Event" WHERE band_id = auth_band_id())
  );

-- ChecklistItem: acessa apenas itens de checklists da própria banda
CREATE POLICY "checklist_item_own_band" ON "ChecklistItem"
  USING (
    checklist_id IN (
      SELECT c.id FROM "Checklist" c
      JOIN "Event" e ON e.id = c.event_id
      WHERE e.band_id = auth_band_id()
    )
  )
  WITH CHECK (
    checklist_id IN (
      SELECT c.id FROM "Checklist" c
      JOIN "Event" e ON e.id = c.event_id
      WHERE e.band_id = auth_band_id()
    )
  );

-- EventMusician: acessa apenas músicos de eventos da própria banda
CREATE POLICY "event_musician_own_band" ON "EventMusician"
  USING (
    event_id IN (SELECT id FROM "Event" WHERE band_id = auth_band_id())
  )
  WITH CHECK (
    event_id IN (SELECT id FROM "Event" WHERE band_id = auth_band_id())
  );

-- Document: acessa apenas documentos da própria banda
CREATE POLICY "document_own_band" ON "Document"
  USING (band_id = auth_band_id())
  WITH CHECK (band_id = auth_band_id());

-- Message: acessa apenas mensagens de leads da própria banda
CREATE POLICY "message_own_band" ON "Message"
  USING (
    lead_id IN (SELECT id FROM "Lead" WHERE band_id = auth_band_id())
  )
  WITH CHECK (
    lead_id IN (SELECT id FROM "Lead" WHERE band_id = auth_band_id())
  );

-- Attraction: acessa apenas atrações da própria banda
CREATE POLICY "attraction_own_band" ON "Attraction"
  USING (band_id = auth_band_id())
  WITH CHECK (band_id = auth_band_id());

-- LeadAttraction: acessa apenas atrações de leads da própria banda
CREATE POLICY "lead_attraction_own_band" ON "LeadAttraction"
  USING (
    lead_id IN (SELECT id FROM "Lead" WHERE band_id = auth_band_id())
  )
  WITH CHECK (
    lead_id IN (SELECT id FROM "Lead" WHERE band_id = auth_band_id())
  );

-- EventFinance: acessa apenas finanças da própria banda
CREATE POLICY "finance_own_band" ON "EventFinance"
  USING (band_id = auth_band_id())
  WITH CHECK (band_id = auth_band_id());

-- EventFinanceItem: acessa apenas itens financeiros da própria banda
CREATE POLICY "finance_item_own_band" ON "EventFinanceItem"
  USING (
    finance_id IN (SELECT id FROM "EventFinance" WHERE band_id = auth_band_id())
  )
  WITH CHECK (
    finance_id IN (SELECT id FROM "EventFinance" WHERE band_id = auth_band_id())
  );

-- EventPayment: acessa apenas recebimentos de finanças da própria banda
CREATE POLICY "event_payment_own_band" ON "EventPayment"
  USING (
    finance_id IN (SELECT id FROM "EventFinance" WHERE band_id = auth_band_id())
  )
  WITH CHECK (
    finance_id IN (SELECT id FROM "EventFinance" WHERE band_id = auth_band_id())
  );
