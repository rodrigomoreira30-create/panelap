-- AlterTable: EventFinanceItem ganha % automático, override e vínculo com músico
ALTER TABLE "EventFinanceItem" ADD COLUMN "percent_of_revenue" DECIMAL(5,2);
ALTER TABLE "EventFinanceItem" ADD COLUMN "is_overridden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EventFinanceItem" ADD COLUMN "event_musician_id" TEXT;

-- CreateIndex
CREATE INDEX "EventFinanceItem_event_musician_id_idx" ON "EventFinanceItem"("event_musician_id");

-- AddForeignKey
ALTER TABLE "EventFinanceItem" ADD CONSTRAINT "EventFinanceItem_event_musician_id_fkey" FOREIGN KEY ("event_musician_id") REFERENCES "EventMusician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: EventFinance.event_id passa a ser obrigatório
-- (pré-requisito: `npm run check:orphan-finance` precisa reportar zero órfãos antes de rodar isto em produção)
ALTER TABLE "EventFinance" ALTER COLUMN "event_id" SET NOT NULL;

-- DropForeignKey (SetNull antigo)
ALTER TABLE "EventFinance" DROP CONSTRAINT "EventFinance_event_id_fkey";

-- AddForeignKey (Cascade)
ALTER TABLE "EventFinance" ADD CONSTRAINT "EventFinance_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
