-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'commercial', 'producer', 'musician');
-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('wedding', 'party', 'show', 'corporate', 'other');
-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('draft', 'pending_review', 'sent', 'signed');
-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('contracted', 'active', 'done');
-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('contract', 'rider', 'briefing', 'map', 'other');
-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('in', 'out');
-- CreateEnum
CREATE TYPE "MusicianConfirmStatus" AS ENUM ('pending', 'confirmed', 'declined');
-- CreateEnum
CREATE TYPE "SaasPlan" AS ENUM ('starter', 'pro', 'enterprise');
-- CreateTable
CREATE TABLE "Band" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "SaasPlan" NOT NULL DEFAULT 'starter',
    "logo_url" TEXT,
    "asaas_id" TEXT,
    "pipeline_stages" JSONB,
    "lead_sources" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Band_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "band_id" TEXT NOT NULL,
    "supabase_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "schedule_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "band_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "event_date" TIMESTAMP(3),
    "city" TEXT,
    "venue_name" TEXT,
    "venue_has_sound" BOOLEAN NOT NULL DEFAULT false,
    "venue_has_light" BOOLEAN NOT NULL DEFAULT false,
    "budget" DECIMAL(65,30),
    "status" TEXT NOT NULL DEFAULT 'new_lead',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "source" TEXT,
    "assigned_to" TEXT,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "band_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "event_time" TEXT,
    "venue_name" TEXT NOT NULL,
    "venue_address" TEXT,
    "venue_has_sound" BOOLEAN NOT NULL DEFAULT false,
    "venue_has_light" BOOLEAN NOT NULL DEFAULT false,
    "value" DECIMAL(65,30) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'contracted',
    "technical_visit_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" TEXT NOT NULL,
    "band_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "pdf_url" TEXT,
    "zapsign_doc_id" TEXT,
    "zapsign_link" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'draft',
    "reviewed_by" TEXT,
    "signed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Checklist" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assigned_to" TEXT,
    CONSTRAINT "Checklist_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "due_date" TIMESTAMP(3),
    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "EventMusician" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "instrument" TEXT,
    "status" "MusicianConfirmStatus" NOT NULL DEFAULT 'pending',
    "confirmed_at" TIMESTAMP(3),
    CONSTRAINT "EventMusician_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "band_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "event_id" TEXT,
    "type" "DocumentType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "content" TEXT NOT NULL,
    "sent_by" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "Band_slug_key" ON "Band"("slug");
-- CreateIndex
CREATE UNIQUE INDEX "User_supabase_id_key" ON "User"("supabase_id");
-- CreateIndex
CREATE UNIQUE INDEX "User_schedule_token_key" ON "User"("schedule_token");
-- CreateIndex
CREATE INDEX "User_band_id_idx" ON "User"("band_id");
-- CreateIndex
CREATE UNIQUE INDEX "User_band_id_email_key" ON "User"("band_id", "email");
-- CreateIndex
CREATE INDEX "Lead_band_id_idx" ON "Lead"("band_id");
-- CreateIndex
CREATE INDEX "Lead_assigned_to_idx" ON "Lead"("assigned_to");
-- CreateIndex
CREATE UNIQUE INDEX "Event_lead_id_key" ON "Event"("lead_id");
-- CreateIndex
CREATE INDEX "Event_band_id_idx" ON "Event"("band_id");
-- CreateIndex
CREATE INDEX "ContractTemplate_band_id_idx" ON "ContractTemplate"("band_id");
-- CreateIndex
CREATE UNIQUE INDEX "ContractTemplate_band_id_name_key" ON "ContractTemplate"("band_id", "name");
-- CreateIndex
CREATE INDEX "Contract_event_id_idx" ON "Contract"("event_id");
-- CreateIndex
CREATE INDEX "Contract_template_id_idx" ON "Contract"("template_id");
-- CreateIndex
CREATE INDEX "Contract_reviewed_by_idx" ON "Contract"("reviewed_by");
-- CreateIndex
CREATE INDEX "Checklist_event_id_idx" ON "Checklist"("event_id");
-- CreateIndex
CREATE INDEX "ChecklistItem_checklist_id_idx" ON "ChecklistItem"("checklist_id");
-- CreateIndex
CREATE UNIQUE INDEX "EventMusician_event_id_user_id_key" ON "EventMusician"("event_id", "user_id");
-- CreateIndex
CREATE INDEX "Document_band_id_idx" ON "Document"("band_id");
-- CreateIndex
CREATE INDEX "Document_lead_id_idx" ON "Document"("lead_id");
-- CreateIndex
CREATE INDEX "Document_event_id_idx" ON "Document"("event_id");
-- CreateIndex
CREATE INDEX "Document_uploaded_by_idx" ON "Document"("uploaded_by");
-- CreateIndex
CREATE INDEX "Message_lead_id_idx" ON "Message"("lead_id");
-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ContractTemplate" ADD CONSTRAINT "ContractTemplate_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "ContractTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "EventMusician" ADD CONSTRAINT "EventMusician_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "EventMusician" ADD CONSTRAINT "EventMusician_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
