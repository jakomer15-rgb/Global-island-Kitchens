import { z } from "zod";
import { products } from "@/content/products";

export const furnitureProductKeys = products.map((p) => p.key) as [string, ...string[]];

/** What the furniture assistant may return: plain text, up to three of our own product lines, one question. */
export const furnitureAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(900),
  categories: z.array(z.enum(furnitureProductKeys)).max(3),
  followUp: z.string().trim().max(200).optional(),
});
export type FurnitureAnswer = z.output<typeof furnitureAnswerSchema>;
