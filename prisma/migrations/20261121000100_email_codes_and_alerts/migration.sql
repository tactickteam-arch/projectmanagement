-- Decisions of 21 Nov 2026: sign in with an e-mail code only; every alert also goes by e-mail.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "login_code_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "login_code_expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "login_code_hash" TEXT,
ADD COLUMN     "login_code_sent_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "emailed_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "notifications_emailed_at_created_at_idx" ON "notifications"("emailed_at", "created_at");


-- Alerts created before e-mail was switched on are not e-mailed afterwards.
UPDATE "notifications" SET "emailed_at" = "created_at" WHERE "emailed_at" IS NULL;
