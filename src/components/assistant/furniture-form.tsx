"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { askFurnitureAction } from "@/app/actions/assistant";
import { Honeypot, PAlert, PField, PTextarea } from "@/components/designers/ui";
import { Button } from "@/components/ui/button";
import { products } from "@/content/products";
import { furniturePage as c } from "@/content/assistant";
import { pages, pathFor } from "@/config/routes";
import type { FurnitureAnswer } from "@/lib/furniture";
import { localizedPath } from "@/lib/seo";

export function FurnitureForm({ locale }: { locale: "en" | "ar" }) {
  const [pending, start] = useTransition();
  const [question, setQuestion] = useState("");
  const [website, setWebsite] = useState("");
  const [startedAt] = useState(() => Date.now());
  const [error, setError] = useState<string>();
  const [answer, setAnswer] = useState<FurnitureAnswer>();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setAnswer(undefined);
    start(async () => {
      const result = await askFurnitureAction({ question, locale, website, startedAt });
      if (result.ok) setAnswer(result.answer);
      else {
        const known = c.errors as Record<string, { en: string; ar: string }>;
        setError((known[result.error] ?? c.errors.server)[locale]);
      }
    });
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="relative space-y-5">
        <Honeypot value={website} onChange={setWebsite} />
        <PAlert tone="info">{c.notice[locale]}</PAlert>
        {error && <PAlert tone="error">{error}</PAlert>}
        <PField label={c.label[locale]} hint={c.hint[locale]}>
          {(a) => (
            <PTextarea
              id={a.id}
              aria-describedby={a.describedBy}
              rows={5}
              required
              minLength={8}
              maxLength={600}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          )}
        </PField>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? c.asking[locale] : c.submit[locale]}
        </Button>
      </form>

      {answer && (
        <section aria-live="polite" className="space-y-5 border border-line bg-white p-6">
          <p className="text-lg whitespace-pre-line" dir="auto">
            {answer.answer}
          </p>
          {answer.categories.length > 0 && (
            <div>
              <h2 className="text-sm font-medium">{c.suggested[locale]}</h2>
              <ul className="mt-2 space-y-1">
                {answer.categories.map((key) => {
                  const product = products.find((p) => p.key === key);
                  if (!product) return null;
                  return (
                    <li key={key}>
                      <Link
                        href={localizedPath(pages[product.key].path, locale)}
                        className="underline underline-offset-4"
                      >
                        {product.name[locale]}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {answer.followUp && (
            <p className="text-sm text-ink-muted" dir="auto">
              {c.nextQuestion[locale]}: {answer.followUp}
            </p>
          )}
          <Button asChild>
            <Link href={localizedPath(pathFor("requestQuote"), locale)}>{c.quote[locale]}</Link>
          </Button>
        </section>
      )}
    </div>
  );
}
