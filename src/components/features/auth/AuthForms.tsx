"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInWithPassword, signUpWithPassword, type AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

function Submit({ label, pending: pendingLabel }: { label: string; pending: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? pendingLabel : label}
    </Button>
  );
}

function ErrorLine({ state }: { state: AuthState }) {
  return state?.error ? (
    <p role="alert" className="text-body-sm text-danger">
      {state.error}
    </p>
  ) : null;
}

export function SignInForm({ demo }: { demo?: { email: string; password: string } }) {
  const [state, action] = useActionState(signInWithPassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-ds-4">
      <Field label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={demo?.email} />
      </Field>
      <Field label="Password" htmlFor="password" required>
        <Input id="password" name="password" type="password" autoComplete="current-password" required defaultValue={demo?.password} />
      </Field>
      <ErrorLine state={state} />
      <Submit label="Sign in" pending="Signing in…" />
      <p className="text-body-sm text-center">
        New here?{" "}
        <Link href="/sign-up" className="text-blue-700 underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUpWithPassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-ds-4">
      <Field label="Full name" htmlFor="name" required>
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password" required hint="At least 8 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <ErrorLine state={state} />
      <Submit label="Create account" pending="Creating your account…" />
      <p className="text-body-sm text-center">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-blue-700 underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
