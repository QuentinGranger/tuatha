-- Payment status refinement: rename legacy values to new granular statuses
-- See src/lib/paymentStatus.ts for the full status list.

-- Rename: pending → payment_pending
UPDATE "Payment" SET status = 'payment_pending' WHERE status = 'pending';

-- Rename: failed → payment_failed
UPDATE "Payment" SET status = 'payment_failed' WHERE status = 'failed';

-- Rename: expired → cancelled
UPDATE "Payment" SET status = 'cancelled' WHERE status = 'expired';

-- Update default value for new rows
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'appointment_created';
