"use client";

import { Mail, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { BrandLogo } from "../../components/brand-logo";
import { createUserProfile } from "../../lib/api";
import { isSupabaseBrowserConfigured, supabaseBrowser } from "../../lib/supabase-browser";

export default function AuthPage() {
  const router = useRouter();

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") {
      return "/dashboard";
    }

    const params = new URLSearchParams(window.location.search);
    return params.get("next") || "/dashboard";
  }, []);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Sign in to run submissions and track contributions.");

  async function handleSignIn() {
    if (!isSupabaseBrowserConfigured) {
      setMessage("Supabase auth is not configured for the web app. Restart Next.js after loading NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabaseBrowser.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        return;
      }

      if (data.user?.id) {
        await createUserProfile({
          id: data.user.id,
          name: (data.user.user_metadata?.full_name as string | undefined) ?? name ?? undefined,
          email: data.user.email ?? email
        });
      }

      router.replace(nextPath);
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    if (!isSupabaseBrowserConfigured) {
      setMessage("Supabase auth is not configured for the web app. Restart Next.js after loading NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setLoading(true);
    setMessage("Redirecting to provider...");

    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}${nextPath}` : undefined;

      const { error } = await supabaseBrowser.auth.signInWithOAuth({
        provider,
        options: { redirectTo }
      });

      if (error) {
        setMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    if (!isSupabaseBrowserConfigured) {
      setMessage("Supabase auth is not configured for the web app. Restart Next.js after loading NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabaseBrowser.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name
          }
        }
      });
      if (error) {
        setMessage(error.message);
        return;
      }

      if (data.user?.id) {
        await createUserProfile({
          id: data.user.id,
          name,
          email: data.user.email ?? email
        });
      }

      setMessage("Signup complete. If email confirmation is enabled, confirm then sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-12">
      <section className="w-full max-w-2xl">
        <div className="ui-card">
          <div className="mb-8 flex justify-center">
            <BrandLogo size={72} priority showWordmark={false} />
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-semibold text-primary">Sign in or create an account</h1>
            <p className="mt-3 text-sm leading-6 text-secondary">{message}</p>
            {!isSupabaseBrowserConfigured ? (
              <p className="mt-3 text-sm text-amber-200">
                The frontend is currently running without public Supabase credentials.
              </p>
            ) : null}
          </div>

          <div className="mt-8 grid gap-4">
            <label className="grid gap-2 text-sm text-secondary">
              Name
              <input
                className="ui-input"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </label>
            <label className="grid gap-2 text-sm text-secondary">
              Email
              <input
                className="ui-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label className="grid gap-2 text-sm text-secondary">
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

          <div className="mt-6 space-y-2">
            <button className="ui-button flex w-full gap-3" type="button" disabled={loading || !email || !password} onClick={handleSignIn}>
              <Mail size={19} />
              {loading ? "Working..." : "Sign In"}
            </button>
            <button className="ui-button-muted flex w-full gap-3" type="button" disabled={loading || !name || !email || !password} onClick={handleSignUp}>
              <UserPlus size={19} />
              {loading ? "Working..." : "Create Account"}
            </button>

            <div className="auth-divider">
              <span>or continue with</span>
            </div>

            <button className="ui-button-muted flex w-full justify-start gap-3" type="button" disabled={loading} onClick={() => handleOAuth("google")}>
              <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.4l2.6-2.5C17 3.4 14.8 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.1-1.5z"
                />
              </svg>
              Continue with Google
            </button>
            <button className="ui-button-muted flex w-full justify-start gap-3" type="button" disabled={loading} onClick={() => handleOAuth("github")}>
              <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.1.82-.26.82-.58v-2.04c-3.34.73-4.04-1.42-4.04-1.42-.55-1.4-1.34-1.77-1.34-1.77-1.1-.75.08-.74.08-.74 1.2.09 1.84 1.25 1.84 1.25 1.08 1.85 2.84 1.32 3.54 1.01.1-.79.42-1.32.76-1.62-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.37 1.24-3.2-.13-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.22a11.4 11.4 0 0 1 6 0c2.28-1.54 3.29-1.22 3.29-1.22.66 1.64.25 2.86.12 3.16.77.83 1.24 1.89 1.24 3.2 0 4.62-2.8 5.65-5.48 5.95.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.82.57A12 12 0 0 0 12 .5Z" />
              </svg>
              Continue with GitHub
            </button>
          </div>

          <div className="mt-6 flex justify-center">
            <Link href="/" className="ui-button-muted">
              Back to Landing
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
