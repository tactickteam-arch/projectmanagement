import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma CLI (migrate, seed) uses the session pooler (DIRECT_URL) with TLS verified against the
// Supabase root CA. `prisma generate` (e.g. during a Vercel build) needs no database, so the URL
// is optional here. The app itself connects via src/lib/prisma-factory.ts.
const direct = process.env.DIRECT_URL;
const caPath = path.resolve(process.cwd(), process.env.DATABASE_CA_CERT ?? "certs/supabase-prod-ca-2021.crt");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  ...(direct
    ? { datasource: { url: `${direct}?sslmode=require&sslaccept=strict&sslcert=${encodeURIComponent(caPath)}` } }
    : {}),
});
