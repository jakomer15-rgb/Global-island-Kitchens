"use client";

import { useState, useTransition } from "react";
import { unsubscribeAction } from "@/app/actions/assistant";
import { PAlert } from "@/components/designers/ui";
import { Button } from "@/components/ui/button";
import { unsubscribePage as c } from "@/content/assistant";

export function UnsubscribeForm({
  token,
  channel,
  locale,
}: {
  token: string;
  channel: "email" | "whatsapp";
  locale: "en" | "ar";
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  if (state === "done") return <PAlert tone="info">{c.done[locale]}</PAlert>;
  return (
    <div className="space-y-5">
      <p className="text-lg">{c.body[channel][locale]}</p>
      {state === "failed" && <PAlert tone="error">{c.invalid[locale]}</PAlert>}
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await unsubscribeAction(token);
            setState(result.ok ? "done" : "failed");
          })
        }
      >
        {c.button[locale]}
      </Button>
    </div>
  );
}
