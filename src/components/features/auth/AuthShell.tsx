import type { ReactNode } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { oauthProviders } from "@/server/auth/config";
import { signInWithProvider } from "@/app/(auth)/actions";

/** Shared frame for sign in / sign up: card, OAuth buttons (only those configured), divider, form. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  const providers = [
    { id: "google", label: "Continue with Google", on: oauthProviders.google },
    { id: "linkedin", label: "Continue with LinkedIn", on: oauthProviders.linkedin },
  ].filter((p) => p.on);

  return (
    <>
      <PublicHeader />
      <main className="flex min-h-[calc(100vh-60px)] items-start justify-center bg-sky-50 px-ds-4 py-ds-6">
        <div className="flex w-full max-w-md flex-col gap-ds-4">
          <section className="flex flex-col gap-ds-4 rounded-md bg-white p-ds-5 shadow-card">
            <div>
              <h1 className="text-heading-section">{title}</h1>
              <p className="text-body-sm mt-ds-1">{subtitle}</p>
            </div>
            {providers.length > 0 && (
              <>
                <div className="flex flex-col gap-ds-3">
                  {providers.map((p) => (
                    <form key={p.id} action={signInWithProvider}>
                      <input type="hidden" name="provider" value={p.id} />
                      <button type="submit" className="w-full rounded-pill bg-white px-7 py-ds-3 text-button text-navy-900 shadow-[inset_0_0_0_1.5px_var(--navy-900)] hover:bg-gray-100">
                        {p.label}
                      </button>
                    </form>
                  ))}
                </div>
                <div className="flex items-center gap-ds-3 text-caption" aria-hidden="true">
                  <span className="h-px flex-1 bg-gray-100" /> or with email <span className="h-px flex-1 bg-gray-100" />
                </div>
              </>
            )}
            {children}
          </section>
          {footer}
        </div>
      </main>
    </>
  );
}
