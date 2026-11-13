import "server-only";
import { createPrismaClient } from "./prisma-factory";
import type { PrismaClient } from "@/generated/prisma/client";

// One PrismaClient per server process (reused across hot reloads in development).
// Created lazily on first use, so `next build` never needs DATABASE_URL (e.g. on Vercel);
// a missing DATABASE_URL surfaces as a clear error on the first request instead.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function client(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createPrismaClient();
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const c = client();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
