-- Enable Row Level Security on all public tables
-- The postgres/service_role user used by Prisma bypasses RLS automatically.
-- This blocks unauthenticated access via Supabase REST API (anon key).

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
