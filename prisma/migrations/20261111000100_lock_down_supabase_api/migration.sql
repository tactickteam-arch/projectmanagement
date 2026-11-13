-- Supabase exposes the public schema through its REST/GraphQL Data API using the
-- anon and authenticated roles. This app never uses that API: all access goes
-- through the Next.js server (Prisma as the table owner), where roles are checked.
-- Lock the Data API out of every app table.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'stores', 'module_templates', 'store_modules', 'attachments',
    'comments', 'notifications', 'activity_log', '_prisma_migrations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- Tables, sequences and functions created later by migrations are not granted to the API roles either.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
