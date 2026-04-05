"use client";

import { BarChart3, CheckCircle2, GitPullRequestArrow, PlayCircle, TimerReset } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { UserProgressOverview } from "@growthengine/shared";
import type { Session } from "@supabase/supabase-js";

import { DashboardShell } from "../../components/dashboard-shell";
import { fetchProgressOverview } from "../../lib/api";
import { supabaseBrowser } from "../../lib/supabase-browser";

export default function MySubmissionsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [overview, setOverview] = useState<UserProgressOverview | null>(null);
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
    fetchProgressOverview(session?.access_token)
      .then((data) => {
        setOverview(data);
        setError("");
      })
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "Failed to load progress");
      })
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const metrics = overview?.metrics;

  return (
    <DashboardShell
      title="My Submissions"
      subtitle="A timeline of simulations, attempts, AI feedback, and contribution readiness"
      rightSlot={
        <div className="flex flex-wrap items-center gap-3">
          <span className="badge status-review border">
            {session?.access_token ? "Authenticated progress" : "Demo progress"}
          </span>
          <Link href="/problems" className="ui-button">
            Browse Problems
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <section className="workspace-card">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="metric-card">
              <div className="flex items-center gap-3 text-brand-200">
                <CheckCircle2 size={20} />
                <span className="text-sm">Problems Solved</span>
              </div>
              <p className="metric-value">{metrics?.problemsSolved ?? 0}</p>
            </article>
            <article className="metric-card">
              <div className="flex items-center gap-3 text-brand-200">
                <TimerReset size={20} />
                <span className="text-sm">Total Attempts</span>
              </div>
              <p className="metric-value">{metrics?.totalAttempts ?? 0}</p>
            </article>
            <article className="metric-card">
              <div className="flex items-center gap-3 text-brand-200">
                <PlayCircle size={20} />
                <span className="text-sm">Sessions Started</span>
              </div>
              <p className="metric-value">{metrics?.sessionsStarted ?? 0}</p>
            </article>
            <article className="metric-card">
              <div className="flex items-center gap-3 text-brand-200">
                <GitPullRequestArrow size={20} />
                <span className="text-sm">Contribution Ready</span>
              </div>
              <p className="metric-value">{metrics?.contributionReady ?? 0}</p>
            </article>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="surface-elevated p-5">
              <div className="flex items-center gap-3 text-brand-200">
                <BarChart3 size={20} />
                <span className="text-sm">Difficulty Distribution</span>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="surface-subtle rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-muted">Beginner</p>
                  <p className="mt-3 text-2xl font-semibold text-primary">{metrics?.difficultyDistribution.beginner ?? 0}</p>
                </div>
                <div className="surface-subtle rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-muted">Intermediate</p>
                  <p className="mt-3 text-2xl font-semibold text-primary">{metrics?.difficultyDistribution.intermediate ?? 0}</p>
                </div>
                <div className="surface-subtle rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-muted">Advanced</p>
                  <p className="mt-3 text-2xl font-semibold text-primary">{metrics?.difficultyDistribution.advanced ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="surface-elevated p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Tracking</p>
              <p className="mt-3 text-sm leading-6 text-secondary">
                Every simulation session now records attempts, AI verdicts, and contribution readiness.
                This page turns that data into an engineering progress dashboard.
              </p>
            </div>
          </div>
        </section>

        <section className="workspace-card">
          <h3 className="text-lg font-semibold text-primary">Issue Progress</h3>
          {loading ? <p className="mt-4 text-sm text-secondary">Loading progress overview...</p> : null}
          {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

          {!loading && !error ? (
            overview?.issueSummaries.length ? (
              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                {overview.issueSummaries.map((item) => (
                  <article key={item.issueId} className="ui-card">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`badge ${
                          item.difficulty === "beginner"
                            ? "badge-easy"
                            : item.difficulty === "intermediate"
                              ? "badge-medium"
                              : "badge-hard"
                        }`}
                      >
                        {item.difficulty}
                      </span>
                      <span className="status-chip status-review border">{item.status.replace(/_/g, " ")}</span>
                      {item.latestVerdict ? (
                        <span className={`status-chip border ${item.latestVerdict === "pass" ? "status-pass" : item.latestVerdict === "fail" ? "status-fail" : "status-review"}`}>
                          {item.latestVerdict}
                        </span>
                      ) : null}
                    </div>
                    <h4 className="mt-4 text-lg font-semibold text-primary">{item.title}</h4>
                    <p className="mt-2 text-sm text-secondary">{item.repositoryFullName}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-secondary">
                      <span>Attempts {item.attempts}</span>
                      <span>{item.contributionReady ? "Contribution ready" : "Still iterating"}</span>
                    </div>
                    <Link href={`/issues/${item.issueId}`} className="ui-button mt-5">
                      Open Workspace
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-secondary">No tracked sessions yet. Start a simulation from the Problems page.</p>
            )
          ) : null}
        </section>

        <section className="workspace-card">
          <h3 className="text-lg font-semibold text-primary">Activity Timeline</h3>
          {overview?.timeline.length ? (
            <div className="mt-5 space-y-4">
              {overview.timeline.map((item) => (
                <article key={item.id} className="timeline-card relative pl-8">
                  <span className="absolute left-4 top-6 h-2.5 w-2.5 rounded-full bg-brand-300 shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="status-chip status-review border">{item.type.replace(/_/g, " ")}</span>
                    <span className="text-xs uppercase tracking-wide text-muted">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h4 className="mt-3 text-base font-semibold text-primary">{item.issueTitle}</h4>
                  <p className="mt-1 text-sm text-secondary">{item.repositoryFullName}</p>
                  <p className="mt-3 text-sm leading-6 text-secondary">{item.summary}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-secondary">Your timeline will populate after you start a simulation and submit code.</p>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
