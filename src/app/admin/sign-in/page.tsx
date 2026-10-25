import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/site/wordmark";
import { getActor } from "@/server/auth/session";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getActor()) redirect("/admin");
  return (
    <main className="flex min-h-svh items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <Wordmark />
        <h1 className="mt-10 font-display text-display-md">Staff sign-in</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Accounts are created by the owner. There is no public sign-up.
        </p>
        <SignInForm />
      </div>
    </main>
  );
}
