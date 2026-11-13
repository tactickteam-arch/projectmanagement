-- CreateTable
CREATE TABLE "file_blobs" (
    "key" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_blobs_pkey" PRIMARY KEY ("key")
);

-- Keep Supabase's public Data API out of the new table
ALTER TABLE public.file_blobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.file_blobs FROM anon, authenticated;
