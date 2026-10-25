import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { CUID } from "@/server/admin/action";
import { getTestimonial } from "@/server/admin/content";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { deleteTestimonialAction } from "../actions";
import { TestimonialForm } from "../testimonial-form";

export const metadata: Metadata = { title: "Testimonial" };

export default async function TestimonialPage({ params }: PageProps<"/admin/testimonials/[id]">) {
  const actor = await requireActor("content.manage");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  const testimonial = await getTestimonial(db, actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/testimonials" className="underline underline-offset-4">
          ← Testimonials
        </Link>
      </p>
      <PageHeader title={testimonial.displayName} />
      <Panel>
        <TestimonialForm testimonial={testimonial} />
      </Panel>
      <Panel title="Delete" className="mt-6 max-w-xl">
        <p className="mb-3 text-sm text-ink-muted">
          Delete it if the customer withdraws their permission. Unticking “Show on the homepage” hides it but
          keeps the record.
        </p>
        <ActionForm
          action={deleteTestimonialAction.bind(null, testimonial.id)}
          submitLabel="Delete testimonial"
          variant="outline"
          confirm="Delete this testimonial?"
        />
      </Panel>
    </>
  );
}
