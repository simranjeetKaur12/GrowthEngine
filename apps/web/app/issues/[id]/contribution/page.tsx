"use client";

import { ArrowUpRight, ExternalLink, GitBranchPlus, GitCommitHorizontal, GitFork, GitPullRequestArrow, TerminalSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { DashboardShell } from "../../../../components/dashboard-shell";
import {
  attachContributionPr,
  fetchContributionHistory,
  fetchIssueById,
  startContributionGuide,
  type ContributionDraft,
  type ContributionGuideRecord
} from "../../../../lib/api";
import { supabaseBrowser } from "../../../../lib/supabase-browser";

export default function ContributionPage({ params }: { params: { id: string } }) {
  const issueId = Number(params.id);
  const [session, setSession] = useState<Session | null>(null);
  const [issue, setIssue] = useState<Awaited<ReturnType<typeof fetchIssueById>> | null>(null);
  const [guide, setGuide] = useState<ContributionGuideRecord | null>(null);
  const [draft, setDraft] = useState<ContributionDraft | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prUrl, setPrUrl] = useState("");
  const [prStatus, setPrStatus] = useState<"opened" | "in_review" | "changes_requested" | "merged" | "closed">("opened");

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
    if (!Number.isFinite(issueId)) {
      setMessage("Invalid issue id.");
      setLoading(false);
      return;
    }

    Promise.all([
      fetchIssueById(issueId),
      fetchContributionHistory({ accessToken: session?.access_token, issueId })
    ])
      .then(([issueResult, history]) => {
        setIssue(issueResult);
        if (history.length) {
          setGuide(history[0]);
          setPrUrl(history[0].pr_url ?? "");
        }
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "Failed to load contribution guide");
      })
      .finally(() => setLoading(false));
  }, [issueId, session?.access_token]);

  const commands = useMemo(() => {
    if (!issue) {
      return "";
    }

    const repoName = issue.repositoryFullName.split("/")[1] ?? "repo";
    const branch = guide?.branch_name ?? `fix/issue-${issue.id}`;

    return [
      "# Fork the repository on GitHub first",
      `git clone https://github.com/${issue.repositoryFullName}.git`,
      `cd ${repoName}`,
      "git remote rename origin upstream",
      `git remote add origin https://github.com/<your-username>/${repoName}.git`,
      "git fetch upstream",
      `git checkout -b ${branch} upstream/main`,
      "# Apply your validated fix",
      "git add .",
      `git commit -m \"Fix issue #${issue.id}: ${issue.title}\"`,
      `git push -u origin ${branch}`
    ].join("\n");
  }, [guide?.branch_name, issue]);

  async function handlePrepareGuide() {
    if (!issue) {
      return;
    }

    setStarting(true);
    setMessage("Preparing contribution guide...");
    try {
      const result = await startContributionGuide({
        accessToken: session?.access_token,
        issueId: issue.id,
        repositoryFullName: issue.repositoryFullName,
        issueUrl: issue.url,
        issueTitle: issue.title
      });
      setGuide(result.guide);
      setDraft(result.draft);
      setPrUrl(result.guide.pr_url ?? "");
      setMessage("Contribution guide prepared.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to prepare contribution guide");
    } finally {
      setStarting(false);
    }
  }

  async function handleSavePr() {
    if (!guide?.id || !prUrl) {
      return;
    }

    setSaving(true);
    setMessage("Saving pull request link...");
    try {
      const result = await attachContributionPr({
        accessToken: session?.access_token,
        guideId: guide.id,
        prUrl,
        prStatus
      });
      setGuide(result.guide);
      setMessage("Pull request link saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save pull request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell
      title="Contribution Steps"
      subtitle="Carry your simulation work back into the original repository with a clean, production-ready contribution path"
      rightSlot={
        <div className="flex flex-wrap gap-2">
          <Link href={`/issues/${issueId}`} className="ui-button-muted">
            Back to Simulation
          </Link>
          {issue ? (
            <a className="ui-button" href={issue.url} target="_blank" rel="noreferrer">
              <ArrowUpRight size={18} />
              View Issue on GitHub
            </a>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
        <section className="workspace-card">
          <p className="text-xs uppercase tracking-[0.22em] text-brand-300">Ready to Contribute</p>
          <h3 className="mt-3 text-2xl font-semibold text-primary">
            {issue?.scenarioTitle ?? issue?.title ?? "Loading contribution flow..."}
          </h3>
          <p className="mt-3 text-sm leading-7 text-secondary">
            Use the validated simulation output as a starting point for an actual open-source contribution. Follow the steps below, prepare your branch, and open a pull request upstream.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="ui-button" type="button" onClick={handlePrepareGuide} disabled={starting || !issue}>
              <GitBranchPlus size={18} />
              {starting ? "Preparing..." : guide ? "Refresh Guide" : "Prepare Guide"}
            </button>
            {message ? <span className="text-sm text-brand-200">{message}</span> : null}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="workspace-card">
            <h4 className="text-lg font-semibold text-primary">Contribution Checklist</h4>
            <div className="mt-5 space-y-3">
              {[
                { icon: GitFork, label: "Fork repository" },
                { icon: TerminalSquare, label: "Clone repo locally" },
                { icon: GitBranchPlus, label: "Create a new branch" },
                { icon: GitCommitHorizontal, label: "Apply and commit the fix" },
                { icon: GitPullRequestArrow, label: "Push branch and open pull request" }
              ].map(({ icon: ItemIcon, label }, index) => {
                return (
                  <div key={label} className="step-item">
                    <span className="step-index">{index + 1}</span>
                    <div className="flex items-center gap-3">
                      <ItemIcon size={18} className="text-brand-300" />
                      <span>{label}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {issue ? (
              <div className="timeline-card mt-6">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Repository</p>
                <a
                  href={`https://github.com/${issue.repositoryFullName}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-brand-200"
                >
                  {issue.repositoryFullName}
                  <ExternalLink size={16} />
                </a>
              </div>
            ) : null}
          </div>

          <div className="workspace-card">
            <h4 className="text-lg font-semibold text-primary">Git Commands</h4>
            <pre className="code-block mt-4">{commands || "Prepare a guide to load repository commands."}</pre>

            {draft ? (
              <div className="mt-5 rounded-2xl border border-brand-400/20 bg-brand-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-100">Suggested Commit</p>
                <pre className="code-block mt-3">{draft.commitMessage}</pre>
                <p className="mt-4 text-xs uppercase tracking-[0.2em] text-brand-100">Suggested PR Title</p>
                <pre className="code-block mt-3">{draft.prTitle}</pre>
                <p className="mt-4 text-xs uppercase tracking-[0.2em] text-brand-100">Suggested PR Description</p>
                <pre className="code-block mt-3">{draft.prDescription}</pre>
              </div>
            ) : null}

            {guide ? (
              <div className="timeline-card mt-5">
                <p className="text-sm text-secondary">
                  Branch <span className="font-semibold text-brand-200">{guide.branch_name}</span>
                </p>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <input
                    className="ui-input"
                    value={prUrl}
                    onChange={(event) => setPrUrl(event.target.value)}
                    placeholder="https://github.com/owner/repo/pull/123"
                  />
                  <select
                    value={prStatus}
                    onChange={(event) =>
                      setPrStatus(
                        event.target.value as "opened" | "in_review" | "changes_requested" | "merged" | "closed"
                      )
                    }
                    className="ui-input"
                  >
                    <option value="opened">opened</option>
                    <option value="in_review">in_review</option>
                    <option value="changes_requested">changes_requested</option>
                    <option value="merged">merged</option>
                    <option value="closed">closed</option>
                  </select>
                </div>
                <button className="ui-button mt-4" type="button" onClick={handleSavePr} disabled={saving || !prUrl}>
                  {saving ? "Saving..." : "Attach Pull Request"}
                </button>
              </div>
            ) : null}
          </div>
        </section>

        {loading ? <p className="text-sm text-secondary">Loading contribution context...</p> : null}
      </div>
    </DashboardShell>
  );
}
