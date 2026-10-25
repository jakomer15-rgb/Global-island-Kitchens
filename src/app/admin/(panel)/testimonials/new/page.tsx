import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/ui";
import { requireActor } from "@/server/auth/session";
import { TestimonialForm } from "../testimonial-form";

export const metadata: Metadata = { title: "Add testimonial" };

export default async function NewTestimonialPage() {
  await requireActor("content.manage");
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/testimonials" className="underline underline-offset-4">
          ← Testimonials
        </Link>
      </p>
      <PageHeader title="Add testimonial" />
      <Panel>
        <TestimonialForm />
      </Panel>
    </>
  );
}
