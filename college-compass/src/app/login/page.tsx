"use client";
import Link from "next/link";
import React, { useState } from "react";
import { Mail } from "lucide-react";
import { BrandMark } from "@/components/ui";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [gError, setGError] = useState("");
  const [error, setError] = useState("");
  const configured = supabaseConfigured();

  const send = async () => {
    const sb = getSupabase();
    if (!sb || !email) return;
    setState("sending");
    setError("");
    const { error: err } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    if (err) {
      setState("error");
      setError(err.message);
    } else {
      setState("sent");
    }
  };

  const google = async () => {
    const sb = getSupabase();
    if (!sb) return;
    setGError("");
    const { error: err } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    if (err) setGError(err.message);
  };

  return (
    <div className="mx-auto max-w-md pt-8">
      <div className="card p-8 text-center">
        <div className="flex justify-center"><BrandMark size={26} /></div>
        <h1 className="mt-3 text-2xl font-semibold">Sign in to College Compass</h1>
        {!configured ? (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Accounts are unavailable right now, but the app is fully usable as a guest — your profile, saved colleges and tasks are kept in this browser.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              To enable accounts, set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (see .env.example), run the schema, and restart.
            </p>
            <Link href="/" className="btn-primary mt-4">Continue as guest</Link>
          </>
        ) : state === "sent" ? (
          <p className="mt-3 text-sm text-slate-600" role="status">
            Check <strong>{email}</strong> for a sign-in link. You can close this tab.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Your data syncs to your account and stays private to you.
            </p>
            <button className="btn-primary mt-4 w-full justify-center" onClick={google}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M21.35 11.1H12v2.9h5.35c-.25 1.4-1.6 4.1-5.35 4.1-3.2 0-5.85-2.65-5.85-6s2.65-6 5.85-6c1.85 0 3.05.8 3.75 1.45l2.55-2.45C16.7 3.6 14.6 2.7 12 2.7 6.9 2.7 2.7 6.85 2.7 12s4.2 9.3 9.3 9.3c5.35 0 8.9-3.75 8.9-9.05 0-.6-.05-1.05-.15-1.15Z"/></svg>
              Continue with Google
            </button>
            {gError && <p className="mt-2 text-sm text-fitRed" role="alert">{gError}</p>}
            <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-slate-400">
              <span className="h-px flex-1 bg-slate-200" /> or email link <span className="h-px flex-1 bg-slate-200" />
            </div>
            <label htmlFor="email" className="label mt-4 text-left">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="field"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            {state === "error" && <p className="mt-2 text-sm text-fitRed" role="alert">{error}</p>}
            <button className="btn-primary mt-3 w-full justify-center" onClick={send} disabled={state === "sending" || !email}>
              <Mail size={15} /> {state === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
            <Link href="/" className="mt-3 block text-sm text-brand hover:underline">
              Or continue as a guest
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
