"use client";

import { CheckCircle2, FolderGit2, GitPullRequestArrow, PlayCircle, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { DashboardShell } from "../../components/dashboard-shell";
import {
  createUserProfile,
  fetchProgressOverview,
  fetchUserProfile,
  fetchUserStats,
  refreshDiscoveredProblems
} from "../../lib/api";
import { supabaseBrowser } from "../../lib/supabase-browser";

const demoIdentity = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "demo@growthengine.local"
};

function getDisplayName(email?: string | null) {
  const local = (email ?? "Engineer").split("@")[0] ?? "Engineer";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function DashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState("");
  const [profileName, setProfileName] = useState<string | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchUserStats>> | null>(null);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchProgressOverview>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

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

  const identity = useMemo(
    () =>
      session?.user?.id
        ? { id: session.user.id, email: session.user.email ?? demoIdentity.email }
        : demoIdentity,
    [session?.user?.email, session?.user?.id]
  );

  useEffect(() => {
    setLoading(true);
    createUserProfile(identity)
      .then(() =>
        Promise.all([
          fetchUserProfile(identity.id),
          fetchUserStats(identity.id),
          fetchProgressOverview(session?.access_token)
        ])
      )
      .then(([profileResult, statsResult, overviewResult]) => {
        setProfileName(profileResult.user.name);
        setStats(statsResult);
        setOverview(overviewResult);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "Failed to load dashboard");
      })
      .finally(() => setLoading(false));
  }, [identity, session?.access_token]);

  async function handleSyncIssues() {
    setSyncing(true);
    setMessage("Refreshing curated GitHub issues...");
    try {
      const result = await refreshDiscoveredProblems();
      setMessage(`Refreshed curated discovery from ${result.repositories.length} repositories.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to sync GitHub issues");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <DashboardShell
      title="Dashboard"
      subtitle="Your authenticated home for developer simulations, feedback loops, and contribution readiness"
      navigationMode="sidebar"
      rightSlot={<span className="badge status-review border">{session?.user ? "Live session" : "Demo session"}</span>}
    >
      <div className="space-y-6">
        <section className="workspace-card">
          <p className="text-xs uppercase tracking-[0.22em] text-brand-300">Welcome</p>
          <h3 className="mt-3 text-3xl font-semibold text-primary">
            Welcome, {profileName || getDisplayName(identity.email)}
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">
            Start where you left off, sync more GitHub issues, and turn practice into contribution-ready engineering work.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/problems" className="ui-button">
              Go to Problems
            </Link>
            <button className="ui-button-muted" type="button" onClick={handleSyncIssues} disabled={syncing}>
              <RefreshCcw size={18} />
              {syncing ? "Syncing..." : "Sync GitHub Issues"}
            </button>
          </div>
          {message ? <p className="mt-4 text-sm text-brand-200">{message}</p> : null}
        </section>

        <section className="workspace-card">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="metric-card">
              <div className="flex items-center gap-3 text-brand-200">
                <CheckCircle2 size={20} />
                <span className="text-sm">Total problems solved</span>
              </div>
              <p className="metric-value">{loading ? "..." : stats?.problemsSolved ?? 0}</p>
            </article>
            <article className="metric-card">
              <div className="flex items-center gap-3 text-brand-200">
                <PlayCircle size={20} />
                <span className="text-sm">Total submissions</span>
              </div>
              <p className="metric-value">{loading ? "..." : overview?.metrics.totalAttempts ?? 0}</p>
            </article>
            <article className="metric-card">
              <div className="flex items-center gap-3 text-brand-200">
                <GitPullRequestArrow size={20} />
                <span className="text-sm">Contribution ready</span>
              </div>
              <p className="metric-value">{loading ? "..." : overview?.metrics.contributionReady ?? 0}</p>
            </article>
            <article className="metric-card">
              <div className="flex items-center gap-3 text-brand-200">
                <FolderGit2 size={20} />
                <span className="text-sm">Difficulty progress</span>
              </div>
              <p className="metric-detail">Easy {stats?.easy ?? 0} / Medium {stats?.medium ?? 0} / Hard {stats?.hard ?? 0}</p>
            </article>
          </div>
        </section>

        <section className="workspace-card">
          <h3 className="text-lg font-semibold text-primary">Recently Attempted Problems</h3>
          {overview?.issueSummaries.length ? (
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              {overview.issueSummaries.slice(0, 4).map((item) => (
                <article key={item.issueId} className="surface-elevated p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="status-chip status-review border">{item.status.replace(/_/g, " ")}</span>
                    <span className="text-xs uppercase tracking-wide text-muted">{item.repositoryFullName}</span>
                  </div>
                  <h4 className="mt-3 text-lg font-semibold text-primary">{item.title}</h4>
                  <p className="mt-2 text-sm text-secondary">
                    Attempts {item.attempts} • Latest verdict {item.latestVerdict ?? "not evaluated"}
                  </p>
                  <Link href={`/issues/${item.issueId}`} className="ui-button mt-5">
                    Resume Simulation
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-secondary">No recent attempts yet. Start from Problems to build your engineering history.</p>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
