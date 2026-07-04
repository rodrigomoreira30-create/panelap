CREATE TABLE "EventFinance" (
  "id"               TEXT NOT NULL,
  "band_id"          TEXT NOT NULL,
  "event_id"         TEXT,
  "name"             TEXT NOT NULL,
  "client"           TEXT,
  "product"          TEXT,
  "event_date"       TIMESTAMP(3) NOT NULL,
  "expected_revenue" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "received_amount"  DECIMAL(65,30) NOT NULL DEFAULT 0,
  "notes"            TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventFinance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventFinance_event_id_key" ON "EventFinance"("event_id");
CREATE INDEX "EventFinance_band_id_idx"  ON "EventFinance"("band_id");
CREATE INDEX "EventFinance_event_id_idx" ON "EventFinance"("event_id");

ALTER TABLE "EventFinance"
  ADD CONSTRAINT "EventFinance_band_id_fkey"
  FOREIGN KEY ("band_id") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventFinance"
  ADD CONSTRAINT "EventFinance_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EventFinanceItem" (
  "id"         TEXT NOT NULL,
  "finance_id" TEXT NOT NULL,
  "category"   TEXT NOT NULL,
  "label"      TEXT NOT NULL,
  "amount"     DECIMAL(65,30) NOT NULL DEFAULT 0,
  "paid"       BOOLEAN NOT NULL DEFAULT false,
  "notes"      TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventFinanceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventFinanceItem_finance_id_idx" ON "EventFinanceItem"("finance_id");

ALTER TABLE "EventFinanceItem"
  ADD CONSTRAINT "EventFinanceItem_finance_id_fkey"
  FOREIGN KEY ("finance_id") REFERENCES "EventFinance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventFinance"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventFinanceItem" ENABLE ROW LEVEL SECURITY;
