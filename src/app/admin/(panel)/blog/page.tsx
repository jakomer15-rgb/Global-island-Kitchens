import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Empty, fmtDate, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { listBlogPosts } from "@/server/admin/content";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Blog" };

export default async function BlogAdminPage() {
  const actor = await requireActor("content.manage");
  const posts = await listBlogPosts(db, actor);

  return (
    <>
      <PageHeader
        title="Blog"
        description="Articles in English and Arabic. The public blog appears once a post is published."
        actions={
          <Link href="/admin/blog/new" className="text-sm font-medium underline underline-offset-4">
            New post
          </Link>
        }
      />
      {posts.length === 0 ? (
        <Empty>No posts yet.</Empty>
      ) : (
        <Table label="Blog posts">
          <thead>
            <tr>
              <Th>Title</Th>
              <Th>Status</Th>
              <Th>Published</Th>
              <Th>Author</Th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <Td>
                  <Link
                    href={`/admin/blog/${p.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {p.titleEn}
                  </Link>
                  <span className="block font-mono text-xs text-ink-muted">/blog/{p.slug}</span>
                </Td>
                <Td>
                  {p.status === "published" ? <Badge tone="good">Published</Badge> : <Badge>Draft</Badge>}
                  {!p.titleAr && <Badge tone="warn">No Arabic</Badge>}
                </Td>
                <Td>{p.publishedAt ? fmtDate(p.publishedAt) : "—"}</Td>
                <Td>{p.author?.name ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
