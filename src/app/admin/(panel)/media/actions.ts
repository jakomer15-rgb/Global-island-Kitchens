"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import { CUID, runAction } from "@/server/admin/action";
import { deleteMedia, finishMediaUpload, mediaKinds, startMediaUpload } from "@/server/admin/media";
import { requireActor } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/staff";
import { db } from "@/server/db";
import { RuleError } from "@/server/errors";
import type { UploadTarget } from "@/server/storage/driver";
import { getStorage } from "@/server/storage/driver";

const startSchema = z.object({
  kind: z.enum(Object.keys(mediaKinds) as [keyof typeof mediaKinds]),
  name: z.string().min(1).max(255),
  type: z.string().max(100),
  size: z.number().int(),
});

export type StartResult = { id: string; ticket: string; upload: UploadTarget } | { error: string };

export async function startMediaAction(input: {
  kind: string;
  name: string;
  type: string;
  size: number;
}): Promise<StartResult> {
  const actor = await requireActor();
  const storage = getStorage();
  if (!storage) return { error: "File storage isn't configured yet (docs/DEPLOYMENT.md)." };
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid file." };
  try {
    return await startMediaUpload(db, storage, actor, parsed.data);
  } catch (error) {
    if (error instanceof RuleError) return { error: error.message };
    if (error instanceof ForbiddenError)
      return { error: "You don't have permission to upload this kind of image." };
    throw error;
  }
}

export async function finishMediaAction(input: {
  id: string;
  ticket: string;
  credit: string;
}): Promise<ActionState> {
  const actor = await requireActor();
  const storage = getStorage();
  if (
    !storage ||
    !CUID.test(input.id) ||
    typeof input.ticket !== "string" ||
    typeof input.credit !== "string"
  )
    return { error: "Invalid upload." };
  const result = await runAction(() => finishMediaUpload(db, storage, actor, input), "Image uploaded.");
  revalidatePath("/admin/media");
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function deleteMediaAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor();
  const storage = getStorage();
  if (!storage || !CUID.test(id)) return { error: "Invalid image." };
  const result = await runAction(() => deleteMedia(db, storage, actor, id), "Image deleted.");
  revalidatePath("/admin/media");
  return result;
}
