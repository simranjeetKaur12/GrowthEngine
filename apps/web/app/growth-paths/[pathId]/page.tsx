"use client";

import { ArrowRight, Flame, Gauge, Target } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { DashboardShell } from "../../../components/dashboard-shell";
import { fetchGrowthPathDetail } from "../../../lib/api";
import { supabaseBrowser } from "../../../lib/supabase-browser";

export default function GrowthPathDetailPage({ params }: { params: { pathId: string } }) {
  const [session, setSession] = useState<Session | null>(null);
  const [path, setPath] = useState<Awaited<ReturnType<typeof fetchGrowthPathDetail>>["path"] | null>(null);
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof fetchGrowthPathDetail>>["progress"] | null>(null);
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
    fetchGrowthPathDetail(params.pathId, session?.access_token)
      .then((result) => {
        setPath(result.path);
        setProgress(result.progress);
        setError("");
      })
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "Failed to load roadmap");
      });
  }, [params.pathId, session?.access_token]);

  return (
    <DashboardShell
      title={path?.title ?? "GrowthPath"}
      subtitle="A 100-day roadmap with daily implementation tasks, AI review, and tracked momentum"
      rightSlot={
        progress ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge status-review border">{progress.recommendedIntensity}</span>
            <Link href={`/growth-paths/${params.pathId}/days/${progress.currentDay}`} className="ui-button">
              Continue Day {progress.currentDay}
            </Link>
          </div>
        ) : null
      }
    >
      <div className="space-y-6">
        {error ? (
          <section className="workspace-card">
            <p className="text-sm text-rose-300">{error}</p>
          </section>
        ) : null}

        <section className="workspace-card">
          <p className="text-xs uppercase tracking-[0.22em] text-brand-300">Roadmap Overview</p>
          <h3 className="mt-3 text-3xl font-semibold text-primary">{path?.title ?? "Loading roadmap..."}</h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">{path?.overview}</p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="metric-card">
              <div className="flex items-center gap-3 text-brand-200">
                <Target size={20} />
                <span className="text-sm">Completed days</span>
              </div>
              <p className="metric-value">{progress?.completedDays ?? 0}</p>
            </article>
            <article className="metric-card">
              <div className="flex items-center gap-3 text-brand-200">
                <Gauge size={20} />
                <span className="text-sm">Average score</span>
              </div>
              <p className="metric-value">{progress?.averageScore ?? 0}</p>
            </article>
            <article className="metric-card">
              <div className="flex items-center gap-3 text-brand-200">
                <Flame size={20} />
                <span className="text-sm">Streak</span>
              </div>
              <p className="metric-value">{progress?.streak ?? 0}</p>
            </article>
          </div>
        </section>

        <section className="workspace-card">
          <h3 className="text-lg font-semibold text-primary">Phases</h3>
          <div className="mt-4 grid gap-4 xl:grid-cols-5">
            {path?.phases.map((phase) => (
              <article key={phase.dayRange} className="surface-elevated p-4">
                <p className="text-xs uppercase tracking-wide text-muted">{phase.dayRange}</p>
                <h4 className="mt-2 text-base font-semibold text-primary">{phase.title}</h4>
                <p className="mt-2 text-sm leading-6 text-secondary">{phase.summary}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="workspace-card">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-primary">100-Day Roadmap</h3>
            {progress ? (
              <Link href={`/growth-paths/${params.pathId}/days/${progress.currentDay}`} className="ui-button-muted">
                Jump to current day
                <ArrowRight size={18} />
              </Link>
            ) : null}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {path?.days.map((day) => (
              <Link
                key={day.dayNumber}
                href={day.status === "locked" ? "#" : `/growth-paths/${params.pathId}/days/${day.dayNumber}`}
                className={`rounded-2xl border p-4 transition duration-200 ${
                  day.status === "completed"
                    ? "border-emerald-400/25 bg-emerald-500/10"
                    : day.status === "in_review"
                      ? "border-brand-400/25 bg-brand-500/10"
                      : "surface-subtle"
                } ${day.status === "locked" ? "pointer-events-none opacity-55" : "hover:-translate-y-0.5"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="badge status-review border">Day {day.dayNumber}</span>
                  <span className="text-xs uppercase tracking-wide text-muted">{day.status.replace(/_/g, " ")}</span>
                </div>
                <h4 className="mt-4 text-base font-semibold text-primary">{day.title}</h4>
                <p className="mt-2 text-sm leading-6 text-secondary">{day.topic}</p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-muted">{day.difficulty}</span>
                  <span className="text-primary">{day.score ?? "--"}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
