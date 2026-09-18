CREATE TABLE "EventPayment" (
  "id"             TEXT NOT NULL,
  "finance_id"     TEXT NOT NULL,
  "payment_date"   TIMESTAMP(3) NOT NULL,
  "amount"         DECIMAL(65,30) NOT NULL,
  "payment_method" TEXT NOT NULL,
  "notes"          TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventPayment_finance_id_idx" ON "EventPayment"("finance_id");

ALTER TABLE "EventPayment"
  ADD CONSTRAINT "EventPayment_finance_id_fkey"
  FOREIGN KEY ("finance_id") REFERENCES "EventFinance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventPayment" ENABLE ROW LEVEL SECURITY;
