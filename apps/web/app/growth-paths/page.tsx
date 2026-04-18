"use client";

import { ArrowRight, BrainCircuit, Code2, Map, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { DashboardShell } from "../../components/dashboard-shell";
import { fetchGrowthPaths, type GrowthPathListItem } from "../../lib/api";
import { supabaseBrowser } from "../../lib/supabase-browser";

const iconMap = {
  python: Code2,
  "web-development": Sparkles,
  "machine-learning": BrainCircuit,
  "ai-engineering": BrainCircuit,
  "data-engineering": Map,
  "cloud-devops": Sparkles,
  cybersecurity: Map,
  "mobile-development": Code2
} as const;

export default function GrowthPathsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<GrowthPathListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => {
    setLoading(true);
    fetchGrowthPaths(session?.access_token)
      .then((result) => {
        setItems(result.items);
        setError("");
      })
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "Failed to load growth paths");
      })
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  return (
    <DashboardShell
      title="GrowthPaths"
      subtitle="AI-powered 100-day roadmaps that turn one skill into a daily implementation habit"
      rightSlot={<span className="badge status-review border">100-day learning system</span>}
    >
      <div className="space-y-6">
        <section className="workspace-card">
          <p className="text-xs uppercase tracking-[0.22em] text-brand-300">Learning By Building</p>
          <h3 className="mt-3 text-3xl font-semibold text-primary">Pick a skill and commit to 100 days of implementation</h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">
            Every path includes a daily topic, a concise explanation, a hands-on task, an optional stretch goal, and AI feedback to help you build momentum from beginner to advanced.
          </p>
        </section>

        {error ? (
          <section className="workspace-card">
            <p className="text-sm text-rose-300">{error}</p>
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-3">
          {items.map((item) => {
            const Icon = iconMap[item.skill];
            return (
              <article key={item.id} className="ui-card">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                    <Icon size={22} className="text-brand-200" />
                  </div>
                  <span className="badge status-review border">{item.levelLabel}</span>
                </div>

                <h3 className="mt-5 text-xl font-semibold text-primary">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-secondary">{item.description}</p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="surface-subtle p-4">
                    <p className="text-xs uppercase tracking-wide text-muted">Completed</p>
                    <p className="mt-2 text-2xl font-semibold text-primary">{item.progress.completedDays}/{item.totalDays}</p>
                  </div>
                  <div className="surface-subtle p-4">
                    <p className="text-xs uppercase tracking-wide text-muted">Intensity</p>
                    <p className="mt-2 text-2xl font-semibold text-primary">{item.progress.recommendedIntensity}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-wide text-muted">
                    <span>Progress</span>
                    <span>{item.progress.completionRate}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5">
                    <progress
                      value={Math.max(item.progress.completionRate, 4)}
                      max={100}
                      className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-white/5 [&::-webkit-progress-value]:bg-brand-400 [&::-moz-progress-bar]:bg-brand-400"
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="badge border border-white/15 bg-white/5 text-primary">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <div className="text-sm text-secondary">
                    Day {item.progress.currentDay} next
                  </div>
                  <Link href={`/growth-paths/${item.id}`} className="ui-button">
                    Open roadmap
                    <ArrowRight size={18} />
                  </Link>
                </div>
              </article>
            );
          })}

          {!loading && !items.length ? (
            <article className="workspace-card xl:col-span-3">
              <div className="mx-auto flex max-w-lg flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Map size={28} className="text-brand-200" />
                </div>
                <h3 className="mt-6 text-2xl font-semibold text-primary">No learning paths available yet</h3>
                <p className="mt-3 text-sm leading-6 text-secondary">
                  GrowthPaths will appear here once the roadmap catalog is loaded.
                </p>
              </div>
            </article>
          ) : null}
        </section>
      </div>
    </DashboardShell>
  );
}
