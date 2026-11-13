import "server-only";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import type { CurrentUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { forbidden } from "@/lib/errors";
import { hqRecipients, notifyUsers } from "@/lib/notify";
import { getModuleById } from "@/lib/services/modules";

export const CommentInput = z.object({ text: z.string().trim().min(1, "Write a comment").max(2000) });

export async function listComments(user: CurrentUser, moduleId: string) {
  await getModuleById(user, moduleId);
  return prisma.comment.findMany({
    where: { storeModuleId: moduleId },
    orderBy: { createdAt: "asc" },
    select: { id: true, text: true, createdAt: true, user: { select: { id: true, name: true, role: true } } },
  });
}

/** Spec: thread per module between owner and HQ; "the other party" is notified. */
export async function addComment(user: CurrentUser, moduleId: string, raw: unknown) {
  const { store, mod } = await getModuleById(user, moduleId);
  if (!can.comment(user, store)) throw forbidden();
  const { text } = CommentInput.parse(raw);
  const template = await prisma.moduleTemplate.findUnique({ where: { moduleType: mod.moduleType } });
  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({ data: { storeModuleId: mod.id, userId: user.id, text } });
    await logActivity(tx, { userId: user.id, storeId: store.id, storeModuleId: mod.id, action: "comment.added", newValue: { text: text.slice(0, 200) } });
    const recipients =
      user.id === store.ownerId ? await hqRecipients(tx, store.state) : [store.ownerId];
    await notifyUsers(tx, recipients.filter((id) => id !== user.id), {
      type: "comment",
      message: `${user.name} commented on ${store.name} · ${template?.displayName ?? mod.moduleType}: “${text.slice(0, 120)}”`,
      storeId: store.id,
      storeModuleId: mod.id,
    });
    return comment;
  });
}
