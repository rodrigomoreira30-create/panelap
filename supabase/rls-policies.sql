-- PanelAp RLS Policies
-- Execute this in Supabase Dashboard → SQL Editor
-- Run AFTER applying Prisma migrations

-- Enable RLS on all tables
ALTER TABLE "Band" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contract" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContractTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Checklist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChecklistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventMusician" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;

-- Helper function: returns band_id of the authenticated user
CREATE OR REPLACE FUNCTION auth_band_id()
RETURNS TEXT AS $$
  SELECT band_id FROM "User"
  WHERE supabase_id = auth.uid()::text
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Band policies
CREATE POLICY "band_own" ON "Band"
  USING (id = auth_band_id());

-- User policies
CREATE POLICY "user_own_band" ON "User"
  USING (band_id = auth_band_id());

-- Lead policies
CREATE POLICY "lead_own_band" ON "Lead"
  USING (band_id = auth_band_id());

-- Event policies
CREATE POLICY "event_own_band" ON "Event"
  USING (band_id = auth_band_id());

-- ContractTemplate policies
CREATE POLICY "template_own_band" ON "ContractTemplate"
  USING (band_id = auth_band_id());

-- Contract policies (via event → band)
CREATE POLICY "contract_own_band" ON "Contract"
  USING (
    event_id IN (
      SELECT id FROM "Event" WHERE band_id = auth_band_id()
    )
  );

-- Checklist policies (via event → band)
CREATE POLICY "checklist_own_band" ON "Checklist"
  USING (
    event_id IN (
      SELECT id FROM "Event" WHERE band_id = auth_band_id()
    )
  );

-- ChecklistItem policies (via checklist → event → band)
CREATE POLICY "checklist_item_own_band" ON "ChecklistItem"
  USING (
    checklist_id IN (
      SELECT c.id FROM "Checklist" c
      JOIN "Event" e ON e.id = c.event_id
      WHERE e.band_id = auth_band_id()
    )
  );

-- EventMusician policies (via event → band)
CREATE POLICY "event_musician_own_band" ON "EventMusician"
  USING (
    event_id IN (
      SELECT id FROM "Event" WHERE band_id = auth_band_id()
    )
  );

-- Document policies
CREATE POLICY "document_own_band" ON "Document"
  USING (band_id = auth_band_id());

-- Message policies (via lead → band)
CREATE POLICY "message_own_band" ON "Message"
  USING (
    lead_id IN (
      SELECT id FROM "Lead" WHERE band_id = auth_band_id()
    )
  );

-- Storage bucket policy (run after creating 'documents' bucket)
-- CREATE POLICY "storage_own_band"
-- ON storage.objects FOR ALL
-- USING (
--   bucket_id = 'documents'
--   AND (storage.foldername(name))[1] = auth_band_id()
-- );
