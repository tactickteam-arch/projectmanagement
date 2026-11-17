import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { SUPABASE_ROOT_CA } from "./db-ca";

/**
 * Builds a PrismaClient over node-postgres with TLS verified against the Supabase
 * root CA. Shared by the app (src/lib/db.ts) and scripts (prisma/seed.ts).
 */
export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const adapter = new PrismaPg({
    connectionString,
    // DATABASE_SSL=disable is only for a local Postgres during development; Supabase always uses verified TLS.
    ssl: process.env.DATABASE_SSL === "disable" ? false : { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true },
    max: 10,
    // The Supabase pooler closes idle client connections; retire ours first and keep TCP alive,
    // so a request never picks up a connection the server has already dropped.
    idleTimeoutMillis: 20_000,
    keepAlive: true,
    connectionTimeoutMillis: 15_000,
    // A query on a silently dropped socket errors after 20 s instead of hanging the request.
    query_timeout: 20_000,
  });
  // Interactive transactions make several round-trips to Supabase; the 5 s default is too tight from Vercel.
  return new PrismaClient({ adapter, transactionOptions: { maxWait: 10_000, timeout: 20_000 } });
}
