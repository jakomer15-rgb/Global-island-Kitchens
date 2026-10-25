import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { CUID } from "@/server/admin/action";
import { getBlogPost } from "@/server/admin/content";
import { listMedia } from "@/server/admin/media";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { deletePostAction } from "../actions";
import { PostForm } from "../post-form";

export const metadata: Metadata = { title: "Post" };

export default async function PostPage({ params }: PageProps<"/admin/blog/[id]">) {
  const actor = await requireActor("content.manage");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  const post = await getBlogPost(db, actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const images = await listMedia(db, actor, "blog_image");

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/blog" className="underline underline-offset-4">
          ← Blog
        </Link>
      </p>
      <PageHeader
        title={post.titleEn}
        actions={
          post.status === "published" ? (
            <a
              href={`/blog/${post.slug}`}
              target="_blank"
              rel="noopener"
              className="text-sm underline underline-offset-4"
            >
              View on the website
            </a>
          ) : undefined
        }
      />
      <Panel>
        <PostForm post={post} images={images} />
      </Panel>
      <Panel title="Delete" className="mt-6 max-w-xl">
        <ActionForm
          action={deletePostAction.bind(null, post.id)}
          submitLabel="Delete post"
          variant="outline"
          confirm="Delete this post permanently?"
        />
      </Panel>
    </>
  );
}
