import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "Sign in | Image Makeover" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-brand-background px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface p-7 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[.25em] text-brand-antique">Image Makeover</p>
        <h1 className="mt-4 font-display text-3xl">Welcome <span className="gold-text italic">back.</span></h1>
        <p className="mt-2 text-sm leading-6 text-brand-muted">Sign in to book an appointment or manage the salon queue.</p>
        <Suspense fallback={<p className="mt-7 text-sm text-brand-muted">Loading sign-in…</p>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
