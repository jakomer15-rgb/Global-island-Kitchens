import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/ui";
import { listMedia } from "@/server/admin/media";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { PostForm } from "../post-form";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  const actor = await requireActor("content.manage");
  const images = await listMedia(db, actor, "blog_image");
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/blog" className="underline underline-offset-4">
          ← Blog
        </Link>
      </p>
      <PageHeader title="New post" />
      <Panel>
        <PostForm images={images} />
      </Panel>
    </>
  );
}
