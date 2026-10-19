-- Cancelamento de eventos: colunas opcionais, sem alterar dados existentes.
ALTER TABLE "Event" ADD COLUMN "cancelled_at" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "cancellation_reason" TEXT;
