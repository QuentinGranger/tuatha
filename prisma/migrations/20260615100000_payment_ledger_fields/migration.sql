-- Add ledger fields to Payment table for full financial traceability
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "stripeFee" INTEGER;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "netAmount" INTEGER;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundAmount" INTEGER;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "payoutAt" TIMESTAMP(3);
