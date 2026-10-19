"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { requestPasswordResetAction, resetPasswordAction, signInWithPassword, signUpWithPassword, type AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/Button";
import { LegalLinks } from "@/components/features/legal/LegalLinks";
import { errorProps, Field, Input } from "@/components/ui/Field";

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

export function SignInForm() {
  const [state, action] = useActionState(signInWithPassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-ds-4">
      <Field label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password" required>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Link href="/forgot-password" className="-mt-ds-2 self-end text-body-sm text-blue-700 underline">
        Forgot password?
      </Link>
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

/** Two password fields that must match; says so as soon as the second one is long enough to be wrong, and after a submit attempt. */
function usePasswordPair(confirmId: string) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tried, setTried] = useState(false);
  const mismatch = confirm !== password && (tried || confirm.length >= password.length);
  const mismatchText = mismatch && confirm !== "" ? "The two passwords don't match." : mismatch ? "Type your password again to confirm it." : undefined;
  const guard = (e: FormEvent<HTMLFormElement>) => {
    if (confirm === password) return;
    e.preventDefault();
    setTried(true);
    document.getElementById(confirmId)?.focus();
  };
  return { password, setPassword, confirm, setConfirm, mismatchText, guard };
}

function PasswordFields({ label, pair, confirmId }: { label: string; pair: ReturnType<typeof usePasswordPair>; confirmId: string }) {
  return (
    <>
      <Field label={label} htmlFor="password" required hint="At least 8 characters.">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={pair.password}
          onChange={(e) => pair.setPassword(e.target.value)}
        />
      </Field>
      <Field label="Confirm password" htmlFor={confirmId} required error={pair.mismatchText}>
        <Input
          id={confirmId}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={pair.confirm}
          onChange={(e) => pair.setConfirm(e.target.value)}
          {...errorProps(confirmId, pair.mismatchText)}
        />
      </Field>
    </>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUpWithPassword, undefined);
  const pair = usePasswordPair("confirm-password");
  return (
    <form action={action} onSubmit={pair.guard} className="flex flex-col gap-ds-4">
      <Field label="Full name" htmlFor="name" required>
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <PasswordFields label="Password" pair={pair} confirmId="confirm-password" />
      <ErrorLine state={state} />
      <Submit label="Create account" pending="Creating your account…" />
      <p className="text-caption text-center">
        By creating an account you agree to the <LegalLinks />.
      </p>
      <p className="text-body-sm text-center">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-blue-700 underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, undefined);
  if (state?.sent) {
    return (
      <div role="status" className="flex flex-col gap-ds-3">
        <p className="text-body">
          Check your email. If there is an account for <strong>{state.sent}</strong>, we have sent a link to choose a new password. It works once and expires in an hour.
        </p>
        <p className="text-body-sm">Nothing there? Look in your spam folder, or wait a minute and ask again.</p>
        <Link href="/sign-in" className="text-body-sm text-blue-700 underline">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-ds-4">
      <Field label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <ErrorLine state={state} />
      <Submit label="Send reset link" pending="Sending…" />
      <p className="text-body-sm text-center">
        <Link href="/sign-in" className="text-blue-700 underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, undefined);
  const pair = usePasswordPair("confirm-password");
  return (
    <form action={action} onSubmit={pair.guard} className="flex flex-col gap-ds-4">
      <input type="hidden" name="token" value={token} />
      <PasswordFields label="New password" pair={pair} confirmId="confirm-password" />
      <ErrorLine state={state} />
      <Submit label="Save new password" pending="Saving…" />
    </form>
  );
}
