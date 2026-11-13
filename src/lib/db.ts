import "server-only";
import { createPrismaClient } from "./prisma-factory";
import type { PrismaClient } from "@/generated/prisma/client";

// One PrismaClient per server process (reused across hot reloads in development).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
