import "server-only";
import { cache } from "react";
import { publicBlogPost, publicBlogPosts, publicMaterials, publicTestimonials } from "@/server/admin/content";
import { db } from "@/server/db";
import { reason } from "@/server/errors";

/**
 * Admin-managed content for the public pages. Like the site settings, these run when a page is
 * pre-rendered and again after an edit (revalidatePath). If the database can't be reached, the
 * page renders without the managed content rather than failing.
 */
async function orEmpty<T>(what: string, load: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    console.warn(`${what} unavailable:`, reason(error));
    return empty;
  }
}

export const getTestimonials = cache(() => orEmpty("Testimonials", () => publicTestimonials(db), []));
export const getMaterials = cache(() => orEmpty("Materials", () => publicMaterials(db), []));
export const getBlogPosts = cache(() => orEmpty("Blog posts", () => publicBlogPosts(db), []));
export const getBlogPost = cache((slug: string) =>
  orEmpty("Blog post", () => publicBlogPost(db, slug), null),
);
