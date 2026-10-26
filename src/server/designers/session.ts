import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { DesignerStatus } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { auth } from "@/server/auth/auth";

/** The signed-in designer for this request. Re-read from the database on every request. */
export interface DesignerActor {
  userId: string;
  designerId: string;
  name: string;
  email: string;
  status: DesignerStatus;
}

export const getDesigner = cache(async (): Promise<DesignerActor | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      kind: true,
      status: true,
      designerAccount: { select: { id: true, status: true } },
    },
  });
  if (!user || user.kind !== "designer" || user.status !== "active" || !user.designerAccount) return null;
  return {
    userId: user.id,
    designerId: user.designerAccount.id,
    name: user.name,
    email: user.email,
    status: user.designerAccount.status,
  };
});

/** Signed-in designer of any approval state (for the "waiting for approval" page), or the sign-in page. */
export async function requireDesigner(signInPath: string): Promise<DesignerActor> {
  const designer = await getDesigner();
  if (!designer) redirect(signInPath);
  return designer;
}

/** Approved designer only; others go back to the portal home, which explains their state. */
export async function requireApprovedDesigner(signInPath: string, homePath: string): Promise<DesignerActor> {
  const designer = await requireDesigner(signInPath);
  if (designer.status !== "approved") redirect(homePath);
  return designer;
}
