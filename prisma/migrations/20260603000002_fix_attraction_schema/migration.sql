-- CreateIndex
CREATE UNIQUE INDEX "Attraction_band_id_name_key" ON "Attraction"("band_id", "name");

-- CreateIndex
CREATE INDEX "LeadAttraction_attraction_id_idx" ON "LeadAttraction"("attraction_id");

-- AlterTable
ALTER TABLE "Lead" ALTER COLUMN "proposal_discount" DROP DEFAULT;
