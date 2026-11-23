-- Decisions of 21 Nov 2026: snag list (key handover and before the soft launch), daily site photos,
-- and design versions with a final version locked by the design approver.

-- CreateEnum
CREATE TYPE "SnagStatus" AS ENUM ('OPEN', 'FIXED', 'CLOSED');

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "approved_at" TIMESTAMPTZ(6),
ADD COLUMN     "approved_by" UUID,
ADD COLUMN     "site_update_id" UUID,
ADD COLUMN     "snag_id" UUID;

-- CreateTable
CREATE TABLE "snags" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "team" TEXT NOT NULL,
    "due_date" DATE,
    "status" "SnagStatus" NOT NULL DEFAULT 'OPEN',
    "raised_by" UUID NOT NULL,
    "raised_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fixed_by" UUID,
    "fixed_at" TIMESTAMPTZ(6),
    "fix_note" TEXT,
    "closed_by" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "return_note" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "snags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_updates" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "store_module_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "snags_store_id_status_idx" ON "snags"("store_id", "status");

-- CreateIndex
CREATE INDEX "site_updates_store_id_date_idx" ON "site_updates"("store_id", "date");

-- CreateIndex
CREATE INDEX "attachments_snag_id_idx" ON "attachments"("snag_id");

-- CreateIndex
CREATE INDEX "attachments_site_update_id_idx" ON "attachments"("site_update_id");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_snag_id_fkey" FOREIGN KEY ("snag_id") REFERENCES "snags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_site_update_id_fkey" FOREIGN KEY ("site_update_id") REFERENCES "site_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snags" ADD CONSTRAINT "snags_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snags" ADD CONSTRAINT "snags_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snags" ADD CONSTRAINT "snags_fixed_by_fkey" FOREIGN KEY ("fixed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snags" ADD CONSTRAINT "snags_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_updates" ADD CONSTRAINT "site_updates_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_updates" ADD CONSTRAINT "site_updates_store_module_id_fkey" FOREIGN KEY ("store_module_id") REFERENCES "store_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_updates" ADD CONSTRAINT "site_updates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Keep Supabase's public Data API out of the new tables: only the Next.js server (Prisma, table
-- owner) reads them. service_role keeps server-side access as the project convention requires.
ALTER TABLE public.snags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.snags, public.site_updates FROM anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.snags, public.site_updates TO service_role;
  END IF;
END $$;
