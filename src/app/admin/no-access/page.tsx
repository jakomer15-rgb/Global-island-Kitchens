import type { Metadata } from "next";
import Link from "next/link";
import { requireActor } from "@/server/auth/session";

export const metadata: Metadata = { title: "No access" };

export default async function NoAccessPage() {
  await requireActor();
  return (
    <main className="mx-auto max-w-xl px-5 py-24">
      <h1 className="font-display text-display-md">You don&apos;t have access to that page.</h1>
      <p className="mt-4 text-ink-muted">Ask the owner to add the permission to your role.</p>
      <Link href="/admin" className="mt-8 inline-block underline underline-offset-4">
        Back to the admin
      </Link>
    </main>
  );
}
