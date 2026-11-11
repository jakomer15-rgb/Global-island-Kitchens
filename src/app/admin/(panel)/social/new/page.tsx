import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/ui";
import { bahrainDateTime } from "@/lib/social";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { listSocialCampaigns, usableImages } from "@/server/social/posts";
import { createPostAction } from "../actions";
import { PostForm } from "../post-form";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage({ searchParams }: PageProps<"/admin/social/new">) {
  const actor = await requireActor("social.manage");
  const { day } = await searchParams;
  const plannedAt = typeof day === "string" ? bahrainDateTime(day, "19:00") : null;
  const [images, campaigns] = await Promise.all([usableImages(db), listSocialCampaigns(db, actor)]);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/social" className="underline underline-offset-4">
          ← Content calendar
        </Link>
      </p>
      <PageHeader
        title="New post"
        description="Start with a title and brief; after saving, the AI can write the captions, hashtags and image brief and suggest project photos."
      />
      <Panel>
        <PostForm
          action={createPostAction}
          values={{ plannedAt }}
          images={images}
          campaigns={campaigns}
          submitLabel="Save draft"
        />
      </Panel>
    </>
  );
}
