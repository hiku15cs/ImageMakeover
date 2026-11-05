"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next") ?? "/book";
  const nextPath = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/book";
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const result = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
      });
      if (result.error) throw new Error(result.error.message);
      setLinkSent(true);
      setMessage("Check your email for a secure sign-in link.");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send your sign-in link.");
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setError("");
    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
      });
      if (oauthError) throw new Error(oauthError.message);
    } catch (oauthError) {
      setError(oauthError instanceof Error ? oauthError.message : "Google sign-in failed.");
      setBusy(false);
    }
  }

  const errorParam = searchParams.get("error");
  const authErrorMessage = errorParam === "role"
    ? "We couldn't verify your staff access. Please contact an administrator."
    : errorParam
      ? "Sign-in could not be completed. Please try again."
      : "";

  return (
    <div className="mt-7">
      {(error || authErrorMessage) && <p role="alert" className="mb-4 rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2.5 text-sm text-red-200">{error || authErrorMessage}</p>}
      {message && <p role="status" className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2.5 text-sm text-emerald-200">{message}</p>}

      <button type="button" disabled={busy} onClick={() => void googleSignIn()} className="w-full rounded-full border border-brand-border px-4 py-3 text-sm transition hover:border-brand-gold disabled:opacity-50">
        Continue with Google
      </button>
      <div className="my-5 flex items-center gap-3 text-xs text-brand-muted"><span className="h-px flex-1 bg-brand-border" />or continue with email<span className="h-px flex-1 bg-brand-border" /></div>

      <form onSubmit={sendMagicLink}>
        <label htmlFor="email" className="mb-2 block text-sm">Email address</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => { setEmail(event.target.value); setLinkSent(false); }} placeholder="you@example.com" className="w-full rounded-lg border border-brand-border bg-brand-background px-3 py-3 text-sm outline-none focus:border-brand-gold" />
        <button disabled={busy} className="mt-4 w-full rounded-full bg-brand-gold px-4 py-3 text-sm font-semibold text-brand-background disabled:opacity-50">{busy ? "Sending…" : linkSent ? "Resend sign-in link" : "Email me a sign-in link"}</button>
      </form>
      <p className="mt-6 text-center text-xs text-brand-muted"><Link href="/" className="text-brand-gold hover:text-brand-champagne">Back to the salon</Link></p>
    </div>
  );
}
