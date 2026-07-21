"use client";
import Link from "next/link";
import React, { useState } from "react";
import { Mail } from "lucide-react";
import { BrandMark } from "@/components/ui";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
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

  return (
    <div className="mx-auto max-w-md pt-8">
      <div className="card p-8 text-center">
        <div className="flex justify-center"><BrandMark size={26} /></div>
        <h1 className="mt-3 text-2xl font-semibold">Sign in to College Compass</h1>
        {!configured ? (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Supabase isn&apos;t configured, so accounts are unavailable. The app is fully usable in
              <strong> demo mode</strong> — your profile, saved colleges and tasks are kept in this browser.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              To enable accounts, set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (see .env.example), run the schema, and restart.
            </p>
            <Link href="/" className="btn-primary mt-4">Continue in demo mode</Link>
          </>
        ) : state === "sent" ? (
          <p className="mt-3 text-sm text-slate-600" role="status">
            Check <strong>{email}</strong> for a sign-in link. You can close this tab.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              We&apos;ll email you a one-time sign-in link. Your data syncs to your account and stays
              private to you.
            </p>
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
              Or continue in demo mode
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
