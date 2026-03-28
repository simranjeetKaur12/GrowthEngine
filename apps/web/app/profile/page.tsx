"use client";

import { Activity, CheckCircle2, GitPullRequestArrow, Layers3, UserCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { UserStats } from "@growthengine/shared";

import { DashboardShell } from "../../components/dashboard-shell";
import { createUserProfile, fetchUserProfile, fetchUserStats } from "../../lib/api";
import { supabaseBrowser } from "../../lib/supabase-browser";

const demoUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "demo@growthengine.local"
};

export default function ProfilePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ id: string; email: string; created_at: string } | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
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

  const identity = useMemo(
    () =>
      session?.user?.id
        ? {
            id: session.user.id,
            email: session.user.email ?? demoUser.email
          }
        : demoUser,
    [session?.user?.email, session?.user?.id]
  );

  useEffect(() => {
    setLoading(true);
    setError("");

    createUserProfile(identity)
      .then(() => Promise.all([fetchUserProfile(identity.id), fetchUserStats(identity.id)]))
      .then(([profileResult, statsResult]) => {
        setProfile(profileResult.user);
        setStats(statsResult);
      })
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "Failed to load profile");
      })
      .finally(() => setLoading(false));
  }, [identity]);

  return (
    <DashboardShell
      title="Profile"
      subtitle="Proof of work across simulations, submissions, and contribution guidance"
      rightSlot={<span className="badge status-review border">{session?.user ? "Live profile" : "Demo profile"}</span>}
    >
      <div className="space-y-6">
        <section className="workspace-card">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Overview</p>
              <h3 className="mt-3 flex items-center gap-3 text-2xl font-semibold text-white">
                <UserCircle2 size={24} />
                {profile?.email ?? identity.email}
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                {loading ? "Loading profile..." : `Tracking developer simulation work for ${profile?.id ?? identity.id}`}
              </p>
            </div>
          </div>
          {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        </section>

        <section className="workspace-card">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="surface-subtle p-5">
              <div className="flex items-center gap-3 text-brand-200">
                <CheckCircle2 size={20} />
                <span className="text-sm">Problems Solved</span>
              </div>
              <p className="mt-4 text-3xl font-semibold text-white">{stats?.problemsSolved ?? 0}</p>
            </article>
            <article className="surface-subtle p-5">
              <div className="flex items-center gap-3 text-brand-200">
                <Activity size={20} />
                <span className="text-sm">Success Rate</span>
              </div>
              <p className="mt-4 text-3xl font-semibold text-white">{stats?.successRate ?? 0}%</p>
            </article>
            <article className="surface-subtle p-5">
              <div className="flex items-center gap-3 text-brand-200">
                <GitPullRequestArrow size={20} />
                <span className="text-sm">Contributions</span>
              </div>
              <p className="mt-4 text-3xl font-semibold text-white">{stats?.contributions ?? 0}</p>
            </article>
            <article className="surface-subtle p-5">
              <div className="flex items-center gap-3 text-brand-200">
                <Layers3 size={20} />
                <span className="text-sm">Difficulty Mix</span>
              </div>
              <p className="mt-4 text-sm text-slate-300">
                Easy {stats?.easy ?? 0} / Medium {stats?.medium ?? 0} / Hard {stats?.hard ?? 0}
              </p>
            </article>
          </div>
        </section>

        <section className="workspace-card">
          <h3 className="text-lg font-semibold text-white">Skills Breakdown</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(["frontend", "backend", "fullstack", "devops"] as const).map((item) => (
              <article key={item} className="surface-subtle p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500">{item}</p>
                <p className="mt-3 text-2xl font-semibold text-white">{stats?.skillBreakdown[item] ?? 0}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="workspace-card">
          <h3 className="text-lg font-semibold text-white">Activity Timeline</h3>
          {stats?.recentActivity.length ? (
            <div className="mt-5 space-y-4">
              {stats.recentActivity.map((item) => (
                <article key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="status-chip status-review border">{item.type.replace(/_/g, " ")}</span>
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h4 className="mt-3 text-base font-semibold text-white">{item.issueTitle}</h4>
                  <p className="mt-2 text-sm text-slate-400">{item.summary}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No recent activity yet. Start solving problems to build your profile.</p>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
