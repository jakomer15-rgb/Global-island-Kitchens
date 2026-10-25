import { notFound } from "next/navigation";

// Any path that doesn't match a page renders the localised 404 page.
export default function CatchAll() {
  notFound();
}
