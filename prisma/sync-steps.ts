/**
 * `npm run db:sync-steps` — run after `npm run db:migrate` on a database with real stores.
 * Writes the launch-flow steps (src/modules) to module_templates and adds missing steps to every
 * store, keeping HQ's Settings changes. The demo seed does the same with defaults.
 */
import "dotenv/config";
import { createPrismaClient } from "../src/lib/prisma-factory";
import { syncSteps } from "../src/lib/steps-sync";

const prisma = createPrismaClient();
syncSteps(prisma, { log: console.log })
  .then((r) => console.log(`\n${r.templates} steps synced across ${r.stores} stores.${r.retired.length ? ` Retired: ${r.retired.join(", ")}.` : ""}`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
