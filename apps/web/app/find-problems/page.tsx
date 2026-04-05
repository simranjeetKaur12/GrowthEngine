"use client";

import { ArrowUpRight, RefreshCcw, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { DiscoveredProblem } from "@growthengine/shared";

import { DashboardShell } from "../../components/dashboard-shell";
import { discoverProblems, refreshDiscoveredProblems } from "../../lib/api";

export default function FindProblemsPage() {
  const [difficulty, setDifficulty] = useState<"" | "easy" | "medium" | "hard">("");
  const [skill, setSkill] = useState<"" | "frontend" | "backend" | "fullstack" | "devops">("");
  const [items, setItems] = useState<DiscoveredProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Choose filters and discover curated GitHub issues.");

  async function handleSearch() {
    setLoading(true);
    setError("");

    try {
      const result = await discoverProblems({
        difficulty: difficulty || undefined,
        skill: skill || undefined
      });
      setItems(result.items);
      setMessage(result.items.length ? `Found ${result.total} curated problems.` : "No curated matches yet. Try a different filter.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to discover problems");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError("");

    try {
      const result = await refreshDiscoveredProblems();
      setMessage(`Refreshed curated discovery from ${result.repositories.length} repositories.`);
      await handleSearch();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to refresh curated discovery");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <DashboardShell
      title="Find Problems"
      subtitle="Discover curated GitHub issues across popular repositories without replacing manual repo sync"
      rightSlot={
        <div className="flex flex-wrap items-center gap-3">
          <button className="ui-button-muted" type="button" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCcw size={18} />
            {refreshing ? "Refreshing..." : "Refresh Curated Index"}
          </button>
          <Link href="/problems" className="ui-button-muted">
            Back to Problems
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <section className="workspace-card">
          <div className="toolbar-panel">
            <div className="toolbar-group">
              <select
                className="toolbar-select"
                value={skill}
                onChange={(event) => setSkill(event.target.value as typeof skill)}
                aria-label="Select skill"
              >
                <option value="">All skills</option>
                <option value="frontend">frontend</option>
                <option value="backend">backend</option>
                <option value="fullstack">fullstack</option>
                <option value="devops">devops</option>
              </select>
              <select
                className="toolbar-select"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}
                aria-label="Select difficulty"
              >
                <option value="">All difficulties</option>
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
            </div>

            <div className="toolbar-group">
              <button className="ui-button" type="button" onClick={handleSearch} disabled={loading}>
                <Search size={18} />
                {loading ? "Finding..." : "Find Problems"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
              <p className="text-sm text-rose-200">{error}</p>
              <button className="ui-button mt-4" type="button" onClick={handleSearch}>
                Retry
              </button>
            </div>
          ) : (
            <p className="mt-5 text-sm text-secondary">{message}</p>
          )}
        </section>

        <section className="workspace-card">
          {items.length ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {items.map((problem) => (
                <article key={problem.id} className="ui-card">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${problem.difficulty === "easy" ? "badge-easy" : problem.difficulty === "medium" ? "badge-medium" : "badge-hard"}`}>
                      {problem.difficulty}
                    </span>
                    {problem.skills.map((item) => (
                      <span key={`${problem.id}-${item}`} className="badge border border-white/15 bg-white/5 text-primary">
                        {item}
                      </span>
                    ))}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-primary">{problem.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-secondary">{problem.body || "No description provided."}</p>
                  <p className="mt-3 text-sm text-muted">{problem.sourceRepo}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <Link href={`/issues/${problem.issueId}`} className="ui-button">
                      Start Simulation
                      <ArrowUpRight size={18} />
                    </Link>
                    <a className="ui-button-muted" href={problem.sourceIssueUrl} target="_blank" rel="noreferrer">
                      View on GitHub
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-secondary">No curated problems loaded yet. Refresh the curated index or change filters.</p>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
