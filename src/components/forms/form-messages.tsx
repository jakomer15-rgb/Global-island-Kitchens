import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

/** Gives the form components (client) the strings they need: Common and Forms only. */
export async function FormMessages({ children }: { children: ReactNode }) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={{ Common: messages.Common, Forms: messages.Forms }}>
      {children}
    </NextIntlClientProvider>
  );
}
