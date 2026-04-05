"use client";

import type { Session } from "@supabase/supabase-js";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { isSupabaseBrowserConfigured, supabaseBrowser } from "../lib/supabase-browser";
import { AuthLanding } from "./auth-landing";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseBrowserConfigured);

  useEffect(() => {
    if (!isSupabaseBrowserConfigured) {
      setLoading(false);
      setSession(null);
      return;
    }

    let mounted = true;

    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data } = supabaseBrowser.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const isAuthRoute = pathname?.startsWith("/auth");
  const isPublicRoute = pathname === "/";

  if (isAuthRoute || isPublicRoute) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="section-card flex w-full max-w-md flex-col items-center gap-4 text-center">
          <div className="h-12 w-12 animate-pulse rounded-2xl border border-brand-400/30 bg-brand-500/15" />
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-brand-300">GrowthEngine</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Checking your session</h1>
            <p className="mt-2 text-sm text-slate-400">
              Hold on while we verify access to your developer workspace.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!session?.user) {
    return <AuthLanding />;
  }

  return <>{children}</>;
}
