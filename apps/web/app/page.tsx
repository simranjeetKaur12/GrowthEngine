"use client";

import { ArrowUpRight, FolderGit2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { ClassifiedIssue } from "@growthengine/shared";

import { DashboardShell } from "../components/dashboard-shell";
import { GitHubMark } from "../components/social-icons";
import { fetchIssues, ingestRepository } from "../lib/api";

const defaultRepo = "vercel/next.js";

export default function HomePage() {
  const [issues, setIssues] = useState<ClassifiedIssue[]>([]);
  const [repository, setRepository] = useState(defaultRepo);
  const [difficulty, setDifficulty] = useState("");
  const [stack, setStack] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadIssues(nextFilters?: { difficulty?: string; stack?: string }) {
    const data = await fetchIssues(nextFilters);
    setIssues(data);
  }

  async function handleIngest() {
    setLoading(true);
    setMessage("Ingesting real issues from GitHub...");

    try {
      const result = await ingestRepository(repository);
      setMessage(`Ingested ${result.ingested} issues from ${result.repository}`);
      await loadIssues({ difficulty, stack });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to ingest issues");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIssues({ difficulty, stack }).catch(() => {
      setIssues([]);
      setMessage("No issues available yet. Sync a repository to begin.");
    });
  }, [difficulty, stack]);

  const sortedIssues = [...issues].sort((a, b) => {
    if (sortBy === "difficulty") {
      const order = { beginner: 1, intermediate: 2, advanced: 3 } as const;
      return order[a.difficulty] - order[b.difficulty];
    }

    if (sortBy === "confidence") {
      return b.confidence - a.confidence;
    }

    return b.id - a.id;
  });

  const rightSlot = (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
      Practice against live repository issues, then move into contribution-ready execution.
    </div>
  );

  return (
    <DashboardShell
      title="Problems"
      subtitle="Real GitHub issues transformed into immersive engineering simulations"
      rightSlot={rightSlot}
    >
      <div className="space-y-6">
        <section className="workspace-card space-y-6">
          <div className="toolbar-panel">
            <div className="toolbar-group">
              <select
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value)}
                title="Filter by difficulty"
                aria-label="Filter by difficulty"
                className="toolbar-select"
              >
                <option value="">All difficulties</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <select
                value={stack}
                onChange={(event) => setStack(event.target.value)}
                title="Filter by technology stack"
                aria-label="Filter by technology stack"
                className="toolbar-select"
              >
                <option value="">All stacks</option>
                <option value="nodejs">Node.js</option>
                <option value="react">React</option>
                <option value="python">Python</option>
                <option value="database">Database</option>
                <option value="devops">DevOps</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="toolbar-group">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                title="Sort problems"
                aria-label="Sort problems"
                className="toolbar-select"
              >
                <option value="recent">Most recent</option>
                <option value="difficulty">Difficulty</option>
                <option value="confidence">AI confidence</option>
              </select>
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <input
                  value={repository}
                  onChange={(event) => setRepository(event.target.value)}
                  placeholder="owner/repo"
                  className="ui-input w-full md:w-56"
                  aria-label="Repository name"
                />
                <button className="ui-button whitespace-nowrap" onClick={handleIngest} disabled={loading}>
                  <GitHubMark size={18} />
                  {loading ? "Syncing..." : "Sync GitHub Issues"}
                </button>
              </div>
            </div>
          </div>

          {message ? <p className="mt-4 text-sm text-brand-200">{message}</p> : null}
        </section>

        <section className="workspace-card">
          {sortedIssues.length ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {sortedIssues.map((issue) => (
                <article
                  className="ui-card origin-center transition-all duration-200 ease-in-out hover:scale-[1.01]"
                  key={issue.id}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`badge ${
                        issue.difficulty === "beginner"
                          ? "badge-easy"
                          : issue.difficulty === "intermediate"
                            ? "badge-medium"
                            : "badge-hard"
                      }`}
                    >
                      {issue.difficulty}
                    </span>
                    <span className="badge status-review border">AI {(issue.confidence * 100).toFixed(0)}%</span>
                    {issue.techStack.map((item) => (
                      <span key={`${issue.id}-${item}`} className="badge border border-white/15 bg-white/5 text-slate-200">
                        {item}
                      </span>
                    ))}
                  </div>

                  <h3 className="mb-2 text-[17px] font-semibold leading-6 text-[#E5E7EB]">{issue.title}</h3>
                  <p className="line-clamp-2 text-[14px] leading-6 text-[#9CA3AF]">
                    {issue.body || "No description provided."}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link href={`/issues/${issue.id}`} className="ui-button">
                      Start Simulation
                      <ArrowUpRight size={18} />
                    </Link>
                    <a className="ui-button-muted" href={issue.url} target="_blank" rel="noreferrer">
                      View on GitHub
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="py-10">
              <div className="empty-state-card">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/80">
                  <GitHubMark size={32} className="text-slate-100" />
                </div>
                <h3 className="mt-6 text-2xl font-semibold text-white">No problems yet</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Sync a GitHub repository to pull in real issues and turn them into hands-on simulation problems.
                </p>
                <div className="mt-6 flex flex-col gap-4 sm:flex-row">
                  <input
                    value={repository}
                    onChange={(event) => setRepository(event.target.value)}
                    placeholder="owner/repo"
                    className="ui-input flex-1"
                    aria-label="Repository to sync"
                  />
                  <button className="ui-button sm:min-w-[154px]" onClick={handleIngest} disabled={loading}>
                    <FolderGit2 size={18} />
                    {loading ? "Syncing..." : "Sync Issues"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
