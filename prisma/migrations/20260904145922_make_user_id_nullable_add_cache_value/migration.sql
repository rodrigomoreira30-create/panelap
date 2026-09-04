-- AlterTable: make user_id nullable and add cache_value column
ALTER TABLE "EventMusician" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable: add cache_value column
ALTER TABLE "EventMusician" ADD COLUMN "cache_value" DECIMAL(65,30);

-- DropIndex
DROP INDEX "EventMusician_event_id_user_id_key";

-- CreateIndex
CREATE INDEX "EventMusician_event_id_idx" ON "EventMusician"("event_id");

-- DropForeignKey
ALTER TABLE "EventMusician" DROP CONSTRAINT "EventMusician_user_id_fkey";

-- AddForeignKey (with SET NULL instead of CASCADE)
ALTER TABLE "EventMusician" ADD CONSTRAINT "EventMusician_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
