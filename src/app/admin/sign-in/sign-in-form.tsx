"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signInAction, type SignInState } from "../actions";

const field =
  "mt-1.5 block w-full border border-charcoal/25 bg-white px-3.5 py-3 text-base focus:border-walnut";

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAction, {});
  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className={field} />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={field}
        />
      </div>
      {state.error && (
        <p role="alert" className="border-s-2 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
