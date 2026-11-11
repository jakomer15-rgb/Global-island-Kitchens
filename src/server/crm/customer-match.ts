import type { Tx } from "@/server/db/client";

/**
 * The customer who owns this phone or email (phone first, then the oldest record). A duplicate staff
 * merged into another record keeps its phone and email (they are unique), so a match on it continues to
 * the record it was merged into: new enquiries never land on a merged duplicate.
 */
export async function findCustomerByContact(
  tx: Tx,
  contact: { phone?: string | null; email?: string | null },
) {
  const or = [
    ...(contact.phone ? [{ phone: contact.phone }] : []),
    ...(contact.email ? [{ email: contact.email }] : []),
  ];
  if (or.length === 0) return null;
  const match = await tx.customer.findFirst({ where: { OR: or }, orderBy: { createdAt: "asc" } });
  if (!match?.mergedIntoId) return match;
  // Merges are always repointed to the final record (see mergeCustomers), so one step is enough.
  return (await tx.customer.findUnique({ where: { id: match.mergedIntoId } })) ?? match;
}
