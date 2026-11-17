-- New outlet launch flow (17 Nov 2026): teams, approver per step, 13 steps.

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TEAM_MEMBER';
ALTER TYPE "OverallStatus" ADD VALUE 'PREMISES_CLEARED' BEFORE 'TOKEN_PAID';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "teams" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "module_templates" DROP COLUMN "is_milestone",
ADD COLUMN "approver_team" TEXT,
ADD COLUMN "edit_teams" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Store Location becomes step 1 "Location filing" (its fields carry over).
UPDATE "module_templates" SET "module_type" = 'LOCATION_FILING', "display_name" = 'Location filing' WHERE "module_type" = 'STORE_LOCATION';
UPDATE "store_modules" SET "module_type" = 'LOCATION_FILING' WHERE "module_type" = 'STORE_LOCATION';

-- The other new steps, their teams and approvers are written by `npm run db:sync-steps`
-- (from src/modules), which also adds the new steps to existing stores.
