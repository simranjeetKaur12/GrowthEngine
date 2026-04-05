"use client";

import { LogOut, Mail, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { isSupabaseBrowserConfigured, supabaseBrowser } from "../lib/supabase-browser";
import { GitHubMark, GoogleMark } from "./social-icons";

export function AuthControls() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const authHref = useMemo(() => {
    const next = pathname && pathname.length ? pathname : "/";
    return `/auth?next=${encodeURIComponent(next)}`;
  }, [pathname]);

  useEffect(() => {
    let mounted = true;

    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
    });

    const { data } = supabaseBrowser.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleOAuth(provider: "google" | "github") {
    if (!isSupabaseBrowserConfigured) {
      setError("Supabase auth is not configured for the web app. Restart Next.js after loading NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}${pathname || "/"}` : undefined;

      const { error: signInError } = await supabaseBrowser.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo
        }
      });

      if (signInError) {
        setError(signInError.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    if (!isSupabaseBrowserConfigured) {
      setError("Supabase auth is not configured for the web app. Restart Next.js after loading NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const { error: signUpError } = await supabaseBrowser.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setNotice("Check your inbox to confirm your account, then sign in to continue.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabaseBrowser.auth.signOut();
  }

  if (session?.user) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="badge status-review border max-w-[240px] truncate" title={session.user.email ?? session.user.id}>
          {session.user.email ?? "Signed in"}
        </span>
        <button className="ui-button-muted gap-2" type="button" onClick={handleSignOut}>
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex justify-end">
      <button className="ui-button min-w-[154px]" type="button" onClick={() => setOpen(true)}>
        <UserPlus size={18} />
        Get Started
      </button>

      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)} aria-hidden="true">
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="get-started-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-brand-300">Get Started</p>
                <h3 id="get-started-title" className="mt-2 text-2xl font-semibold text-white">
                  Create your developer workspace
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Save runs, track contributions, and turn practice into real open-source work.
                </p>
              </div>
              <button
                className="ui-button-muted h-10 w-10 shrink-0 p-0"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="auth-group-card mt-6">
              <div className="grid gap-4">
                <label className="grid gap-2 text-sm text-slate-300">
                  Email
                  <input
                    className="ui-input"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                <label className="grid gap-2 text-sm text-slate-300">
                  Password
                  <input
                    className="ui-input"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 6 characters"
                  />
                </label>
              </div>

              <button
                className="ui-button mt-6 flex w-full justify-center"
                type="button"
                disabled={loading || !email || password.length < 6}
                onClick={handleSignUp}
              >
                <Mail size={18} />
                {loading ? "Creating account..." : "Create account with email"}
              </button>
            </div>

            <div className="auth-divider mt-6">
              <span>or continue with</span>
            </div>

            <div className="mt-4 grid gap-3">
              <button
                className="ui-button-muted flex w-full justify-start gap-3 px-4"
                type="button"
                disabled={loading}
                onClick={() => handleOAuth("github")}
              >
                <span className="flex h-5 w-5 items-center justify-center">
                  <GitHubMark size={20} />
                </span>
                <span>Continue with GitHub</span>
              </button>
              <button
                className="ui-button-muted flex w-full justify-start gap-3 px-4"
                type="button"
                disabled={loading}
                onClick={() => handleOAuth("google")}
              >
                <span className="flex h-5 w-5 items-center justify-center">
                  <GoogleMark size={20} />
                </span>
                <span>Continue with Google</span>
              </button>
            </div>

            {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
            {notice ? <p className="mt-4 text-sm text-emerald-300">{notice}</p> : null}
            {!isSupabaseBrowserConfigured ? (
              <p className="mt-4 text-sm text-amber-200">
                Web auth config is missing. The frontend needs `NEXT_PUBLIC_SUPABASE_URL` and
                `NEXT_PUBLIC_SUPABASE_ANON_KEY` available when Next.js starts.
              </p>
            ) : null}

            <p className="mt-4 text-sm text-slate-400">
              Already have an account?{" "}
              <Link href={authHref} onClick={() => setOpen(false)} className="font-medium text-brand-300">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
