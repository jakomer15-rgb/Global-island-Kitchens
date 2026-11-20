"use server";

import { revalidatePath } from "next/cache";
import { centreText } from "@/content/automation-centre";
import type { ActionState } from "@/lib/admin/action-state";
import { runAction } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import {
  approveProspectTemplate,
  saveAutopilotOptions,
  stopAutopilot,
  turnOnAutopilot,
  writeProspectTemplateWithAi,
} from "@/server/autopilot/admin";
import { readAutopilot } from "@/server/autopilot/state";
import { db } from "@/server/db";
import { updateSetting } from "@/server/settings/update";
import { getCentreLang } from "../lang";

const T = centreText.autopilot;
const done = () => {
  revalidatePath("/admin/automation", "layout");
};
const num = (f: FormData, name: string) => Number(f.get(name));
const on = (f: FormData, name: string) => f.get(name) === "on";

export async function turnOnAutopilotAction(_: ActionState): Promise<ActionState> {
  void _;
  const actor = await requireActor("workflows.manage");
  const result = await runAction(() => turnOnAutopilot(db, actor), T.turnedOn[await getCentreLang()]);
  done();
  return result;
}

export async function stopAutopilotAction(_: ActionState): Promise<ActionState> {
  void _;
  const actor = await requireActor("workflows.manage");
  const result = await runAction(() => stopAutopilot(db, actor), T.stopped[await getCentreLang()]);
  done();
  return result;
}

export async function saveAutopilotOptionsAction(_: ActionState, f: FormData): Promise<ActionState> {
  const actor = await requireActor("workflows.manage");
  const result = await runAction(
    () =>
      saveAutopilotOptions(db, actor, {
        mode: f.get("mode") === "auto" ? "auto" : "approve",
        approvalEmails: on(f, "approvalEmails"),
        copyEmails: on(f, "copyEmails"),
        replies: on(f, "replies"),
        customerEmailsPerDay: num(f, "customerEmailsPerDay"),
        followUpsPerLead: num(f, "followUpsPerLead"),
        prospectEmails: on(f, "prospectEmails"),
        prospectEmailsPerDay: num(f, "prospectEmailsPerDay"),
        social: on(f, "social"),
        postsPerWeek: num(f, "postsPerWeek"),
        socialPlatforms: f.getAll("socialPlatforms").map(String) as ("instagram" | "facebook")[],
        socialLanguage: String(f.get("socialLanguage")) as "en" | "ar" | "both",
        dailySummary: on(f, "dailySummary"),
      }),
    T.saved[await getCentreLang()],
  );
  done();
  return result;
}

export async function approveTemplateAction(_: ActionState, f: FormData): Promise<ActionState> {
  const actor = await requireActor("workflows.manage");
  const result = await runAction(
    () =>
      approveProspectTemplate(db, actor, {
        subject: String(f.get("subject") ?? ""),
        body: String(f.get("body") ?? ""),
        language: f.get("language") === "ar" ? "ar" : "en",
      }),
    T.templateApproved[await getCentreLang()],
  );
  done();
  return result;
}

/** The AI writes a template; it is saved unapproved and shown in the form for the owner to approve. */
export async function writeTemplateAction(_: ActionState, f: FormData): Promise<ActionState> {
  const actor = await requireActor("workflows.manage");
  const language = f.get("language") === "ar" ? "ar" : "en";
  const result = await runAction(
    async () => {
      const draft = await writeProspectTemplateWithAi(db, actor, {
        brief: String(f.get("brief") ?? ""),
        language,
      });
      const s = await readAutopilot(db);
      await updateSetting(db, actor, "autopilot", {
        ...s,
        prospectEmails: false,
        prospectTemplate: { ...draft, language, approvedById: null, approvedByName: null, approvedAt: null },
      });
    },
    T.aiWritten[await getCentreLang()],
  );
  done();
  return result;
}
