-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "proposal_discount" DECIMAL(65,30) DEFAULT 0;

-- CreateTable
CREATE TABLE "Attraction" (
    "id" TEXT NOT NULL,
    "band_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "default_value" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadAttraction" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "attraction_id" TEXT,
    "name" TEXT NOT NULL,
    "custom_value" DECIMAL(65,30) NOT NULL,
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadAttraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attraction_band_id_idx" ON "Attraction"("band_id");

-- CreateIndex
CREATE INDEX "LeadAttraction_lead_id_idx" ON "LeadAttraction"("lead_id");

-- AddForeignKey
ALTER TABLE "Attraction" ADD CONSTRAINT "Attraction_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAttraction" ADD CONSTRAINT "LeadAttraction_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAttraction" ADD CONSTRAINT "LeadAttraction_attraction_id_fkey" FOREIGN KEY ("attraction_id") REFERENCES "Attraction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
