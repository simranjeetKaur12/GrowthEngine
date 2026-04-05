"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { isSupabaseBrowserConfigured } from "../lib/supabase-browser";
import { BrandLogo } from "./brand-logo";

export function AuthLanding() {
  const pathname = usePathname();

  const authHref = useMemo(() => {
    const next = pathname && pathname.length ? pathname : "/";
    return `/auth?next=${encodeURIComponent(next)}`;
  }, [pathname]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="auth-landing-card w-full max-w-3xl overflow-hidden">
        <div className="auth-landing-glow" aria-hidden="true" />

        <div className="relative grid gap-10 p-8 md:p-12">
          <BrandLogo size={88} showWordmark={false} priority className="mx-auto" />

          <div className="space-y-4 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-brand-300">GrowthEngine</p>
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
              Developer Simulation Platform
            </h1>
            <p className="mx-auto max-w-2xl text-base leading-7 text-slate-300">
              Practice on real GitHub issues, get AI feedback, and move from simulation to open-source contribution.
            </p>
          </div>

          <div className="mx-auto grid w-full max-w-xl gap-4 rounded-[22px] border border-white/10 bg-slate-950/55 p-5 text-center shadow-panel">
            <p className="text-sm font-medium text-slate-200">
              Sign up or log in with email, GitHub, or Google to enter the workspace.
            </p>

            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={authHref} className="ui-button min-w-[180px]">
                Create Account
                <ArrowRight size={18} />
              </Link>
              <Link href={authHref} className="ui-button-muted min-w-[180px]">
                Log In
              </Link>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
              <ShieldCheck size={16} className="text-emerald-300" />
              <span>Authentication is required before accessing simulations, submissions, and profiles.</span>
            </div>

            {!isSupabaseBrowserConfigured ? (
              <p className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Supabase web auth is not configured yet. Set `NEXT_PUBLIC_SUPABASE_URL` and
                `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then restart Next.js.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
