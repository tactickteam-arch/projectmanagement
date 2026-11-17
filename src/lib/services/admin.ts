import "server-only";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { isStateCode } from "@/lib/india-states";
import { setSetting, SETTING_KEYS } from "@/lib/settings";
import { isTeamKey, STORE_OWNER_TEAM } from "@/lib/teams";
import type { FieldDef } from "@/modules/types";

const password = z.string().min(8, "Password must be at least 8 characters").max(200);
const teams = z.array(z.string().refine(isTeamKey, "Unknown team")).max(20);

export const CreateUserInput = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.email("Enter a valid e-mail").transform((e) => e.trim().toLowerCase()),
  phone: z
    .string()
    .trim()
    .regex(/^\+?\d{10,13}$/, "Enter a valid phone number")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  role: z.enum(["SUPER_ADMIN", "REGIONAL_MANAGER", "STORE_OWNER", "TEAM_MEMBER"]),
  regionStates: z.array(z.string().refine(isStateCode, "Unknown state")).default([]),
  teams: teams.default([]),
  password,
});

export const UpdateUserInput = z.object({
  isActive: z.boolean().optional(),
  regionStates: z.array(z.string().refine(isStateCode, "Unknown state")).optional(),
  teams: teams.optional(),
  password: password.optional(),
  name: z.string().trim().min(2).max(120).optional(),
});

export async function listUsers(user: CurrentUser) {
  if (!can.manageUsers(user)) throw forbidden();
  return prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, phone: true, role: true, regionStates: true, teams: true, isActive: true, createdAt: true, _count: { select: { ownedStores: true } } },
  });
}

export async function createUser(user: CurrentUser, raw: unknown) {
  if (!can.manageUsers(user)) throw forbidden();
  const input = CreateUserInput.parse(raw);
  if (input.role === "REGIONAL_MANAGER" && input.regionStates.length === 0) {
    throw badRequest("Choose at least one state for a Regional Manager.", { regionStates: "Required" });
  }
  if (input.role === "TEAM_MEMBER" && input.teams.length === 0) {
    throw badRequest("Choose at least one team for a Sangeetha team member.", { teams: "Required" });
  }
  try {
    const created = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        role: input.role,
        regionStates: input.role === "REGIONAL_MANAGER" || input.role === "TEAM_MEMBER" ? input.regionStates : [],
        teams: input.role === "STORE_OWNER" ? [] : input.teams,
        passwordHash: await bcrypt.hash(input.password, 12),
      },
      select: { id: true },
    });
    return created;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw conflict("A user with this e-mail or phone already exists.");
    throw e;
  }
}

export async function updateUser(user: CurrentUser, userId: string, raw: unknown) {
  if (!can.manageUsers(user)) throw forbidden();
  const input = UpdateUserInput.parse(raw);
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw notFound("User not found");
  if (target.id === user.id && input.isActive === false) throw badRequest("You cannot deactivate your own account.");
  const data: Prisma.UserUpdateInput = {};
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.name) data.name = input.name;
  if (input.regionStates && (target.role === "REGIONAL_MANAGER" || target.role === "TEAM_MEMBER")) data.regionStates = input.regionStates;
  if (input.teams && target.role !== "STORE_OWNER") {
    if (target.role === "TEAM_MEMBER" && input.teams.length === 0) throw badRequest("A Sangeetha team member needs at least one team.");
    data.teams = input.teams;
  }
  if (input.password) data.passwordHash = await bcrypt.hash(input.password, 12);
  await prisma.user.update({ where: { id: userId }, data });
}

/** Settings → steps: schedule defaults, who fills in / approves the step, checklist items. */
export const TemplateUpdateInput = z.object({
  defaultStartOffsetDays: z.number().int().min(0).max(365).nullable().optional(),
  defaultDurationDays: z.number().int().min(1).max(365).nullable().optional(),
  editTeams: z.array(z.string().refine((t) => t === STORE_OWNER_TEAM || isTeamKey(t), "Unknown team")).min(1, "Choose at least one team").max(20).optional(),
  approverTeam: z.string().refine(isTeamKey, "Unknown team").nullable().optional(),
  /** Checklist field key → default rows. */
  checklistItems: z.record(z.string(), z.array(z.string().trim().min(1).max(80)).max(30)).optional(),
});

export async function updateTemplate(user: CurrentUser, moduleType: string, raw: unknown) {
  if (!can.manageTemplates(user)) throw forbidden();
  const input = TemplateUpdateInput.parse(raw);
  const t = await prisma.moduleTemplate.findUnique({ where: { moduleType } });
  if (!t) throw notFound("Step not found");
  const data: Prisma.ModuleTemplateUpdateInput = {};
  if (t.defaultStartOffsetDays !== null) {
    if (input.defaultStartOffsetDays !== undefined) data.defaultStartOffsetDays = input.defaultStartOffsetDays;
    if (input.defaultDurationDays !== undefined) data.defaultDurationDays = input.defaultDurationDays;
  }
  if (input.editTeams) data.editTeams = [...new Set(input.editTeams)];
  if (input.approverTeam !== undefined) data.approverTeam = input.approverTeam;
  if (input.checklistItems) {
    const fields = (t.fieldSchema as unknown as FieldDef[]).map((f) =>
      f.type === "checklist" && input.checklistItems?.[f.key] ? { ...f, defaultItems: input.checklistItems[f.key] } : f,
    );
    data.fieldSchema = fields as unknown as Prisma.InputJsonArray;
  }
  // Changing the approver does not touch steps already waiting: the new approver team sees them in
  // its queue, and a step that loses its approver can still be approved by HQ (SuperAdmin).
  await prisma.moduleTemplate.update({ where: { moduleType }, data });
}

export async function updateTargetLaunchOffset(user: CurrentUser, raw: unknown) {
  if (!can.manageTemplates(user)) throw forbidden();
  const { days } = z.object({ days: z.number().int().min(1).max(365) }).parse(raw);
  await setSetting(SETTING_KEYS.targetLaunchOffsetDays, days);
}
