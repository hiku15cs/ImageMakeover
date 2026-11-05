"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next") ?? "/book";
  const nextPath = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/book";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

      <button type="button" disabled={busy} onClick={() => void googleSignIn()} className="w-full rounded-full border border-brand-border px-4 py-3 text-sm transition hover:border-brand-gold disabled:opacity-50">
        {busy ? "Redirecting…" : "Continue with Google"}
      </button>
      <p className="mt-6 text-center text-xs text-brand-muted"><Link href="/" className="text-brand-gold hover:text-brand-champagne">Back to the salon</Link></p>
    </div>
  );
}
