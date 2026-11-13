-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "file_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "size_bytes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "module_templates" ADD COLUMN     "is_milestone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photo_tag" TEXT;

-- AlterTable
ALTER TABLE "store_modules" ADD COLUMN     "approved_at" TIMESTAMPTZ(6),
ADD COLUMN     "completed_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- Keep Supabase's public Data API out of the new table (see 20261111000100_lock_down_supabase_api)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_settings FROM anon, authenticated;
