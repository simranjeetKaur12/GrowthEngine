"use client";

import {
  ArrowUpRight,
  Bug,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Lightbulb
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import type {
  ClassifiedIssue,
  FinalReviewFeedback,
  IssueAnalysisResult,
  IterativeAnalyzerFeedback,
  TicketRecord
} from "@growthengine/shared";

import {
  completeTicket,
  createTicket,
  executeSubmission,
  fetchCurrentSimulation,
  fetchIssueById,
  fetchSubmissionHistory,
  startTicket,
  startSimulation,
  type SubmissionHistoryItem
} from "../../../lib/api";
import { DashboardShell } from "../../../components/dashboard-shell";
import { supabaseBrowser } from "../../../lib/supabase-browser";
import { useTheme } from "../../../components/theme-provider";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false
});

const featureFlags = {
  companyWorkflow: process.env.NEXT_PUBLIC_ENABLE_COMPANY_WORKFLOW !== "false",
  ticketSystem: process.env.NEXT_PUBLIC_ENABLE_TICKET_SYSTEM !== "false",
  iterativeAnalyzer: process.env.NEXT_PUBLIC_ENABLE_ITERATIVE_AI_ANALYZER !== "false"
};

const languageOptions = [
  { id: 63, label: "JavaScript (Node.js)", monaco: "javascript" },
  { id: 71, label: "Python", monaco: "python" },
  { id: 62, label: "Java", monaco: "java" },
  { id: 54, label: "C++", monaco: "cpp" }
] as const;

type WorkspaceFileEntry = {
  path: string;
  language: string;
  originalContent: string;
  content: string;
};

function starterCode(languageId: number) {
  switch (languageId) {
    case 63:
      return [
        "function solve(input) {",
        "  // Parse and solve here",
        "  return input.trim();",
        "}",
        "",
        "const fs = require('fs');",
        "const input = fs.readFileSync(0, 'utf8');",
        "console.log(solve(input));"
      ].join("\n");
    case 62:
      return [
        "import java.util.*;",
        "",
        "public class Main {",
        "  public static void main(String[] args) {",
        "    Scanner sc = new Scanner(System.in);",
        "    String input = sc.hasNextLine() ? sc.nextLine() : \"\";",
        "    System.out.println(input);",
        "  }",
        "}"
      ].join("\n");
    case 54:
      return [
        "#include <bits/stdc++.h>",
        "using namespace std;",
        "",
        "int main() {",
        "  ios::sync_with_stdio(false);",
        "  cin.tie(nullptr);",
        "",
        "  string s;",
        "  getline(cin, s);",
        "  cout << s << '\\n';",
        "  return 0;",
        "}"
      ].join("\n");
    case 71:
    default:
      return [
        "def solve(data: str) -> str:",
        "    # Parse and solve here",
        "    return data.strip()",
        "",
        "if __name__ == '__main__':",
        "    import sys",
        "    raw = sys.stdin.read()",
        "    print(solve(raw))"
      ].join("\n");
  }
}

function inferLanguageFromPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".tsx") || lower.endsWith(".ts")) return "typescript";
  if (lower.endsWith(".jsx") || lower.endsWith(".js")) return "javascript";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".cpp") || lower.endsWith(".cc") || lower.endsWith(".cxx")) return "cpp";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".json")) return "json";
  return "plaintext";
}

function templateForPath(path: string, issue: ClassifiedIssue, fallbackSource: string) {
  const language = inferLanguageFromPath(path);

  if (language === "typescript" || language === "javascript") {
    return [
      `// Issue: ${issue.title}`,
      "export function applyFix(input: unknown) {",
      "  // Implement the fix here",
      "  return input;",
      "}"
    ].join("\n");
  }

  if (language === "python") {
    return [
      `# Issue: ${issue.title}`,
      "def apply_fix(input_data):",
      "    # Implement the fix here",
      "    return input_data"
    ].join("\n");
  }

  if (language === "css") {
    return [
      `/* Issue: ${issue.title} */`,
      ".fix-target {",
      "  /* Implement styling fix */",
      "}"
    ].join("\n");
  }

  return fallbackSource;
}

function getFallbackGuidedContext(issue: ClassifiedIssue) {
  return {
    what_is_broken:
      issue.scenarioBody?.slice(0, 200) ??
      issue.body.slice(0, 200) ??
      `${issue.title} is causing behavior that needs a targeted fix.`,
    where_to_fix: issue.techStack.includes("react")
      ? ["src/components/IssueView.tsx", "src/pages/issue.tsx"]
      : issue.techStack.includes("nodejs")
        ? ["src/routes/issues.ts", "src/services/issue-service.ts"]
        : ["solution/main.py", "solution/helpers.py"],
    hint: issue.learningObjectives?.[0] ?? "Start from the most likely file and patch the smallest logic branch first.",
    expected_outcome:
      issue.acceptanceCriteria?.[0] ?? "After the fix, the issue behavior should be resolved with no obvious regressions."
  };
}

function buildWorkspaceSeed(issue: ClassifiedIssue, languageId: number): WorkspaceFileEntry[] {
  const base = starterCode(languageId);

  const guidedPaths: string[] = (issue.guided_context?.where_to_fix ?? getFallbackGuidedContext(issue).where_to_fix)
    .slice(0, 5)
    .filter((path: string) => typeof path === "string" && path.trim().length > 0);

  if (guidedPaths.length) {
    return guidedPaths.map((path: string) => {
      const content = templateForPath(path, issue, base);
      return {
        path,
        language: inferLanguageFromPath(path),
        originalContent: content,
        content
      };
    });
  }

  return [
    {
      path: "solution/main.py",
      language: "python",
      originalContent: base,
      content: base
    },
    {
      path: "solution/helpers.py",
      language: "python",
      originalContent: "def normalize(value: str) -> str:\n    return value.strip()\n",
      content: "def normalize(value: str) -> str:\n    return value.strip()\n"
    }
  ];
}

function buildSimpleDiff(path: string, originalContent: string, updatedContent: string) {
  if (originalContent === updatedContent) {
    return `--- a/${path}\n+++ b/${path}\n`;
  }

  const before = originalContent.split("\n");
  const after = updatedContent.split("\n");
  const lines = [`--- a/${path}`, `+++ b/${path}`];
  const max = Math.max(before.length, after.length);

  for (let index = 0; index < max; index += 1) {
    const left = before[index];
    const right = after[index];

    if (left === right) {
      continue;
    }

    if (typeof left === "string") {
      lines.push(`-${left}`);
    }
    if (typeof right === "string") {
      lines.push(`+${right}`);
    }
  }

  return lines.join("\n");
}

function getStatusLabel(
  hasSession: boolean,
  hasCodeEdits: boolean,
  analysis: IssueAnalysisResult | null,
  completed: boolean
) {
  if (completed) return "Completed";
  if (!hasSession) return "Not Started";
  if (analysis?.confidence && analysis.confidence >= 0.85) return "Ready for Submission";
  if (hasCodeEdits || analysis) return "In Progress";
  return "Not Started";
}

export default function IssueSolvePage({ params }: { params: { id: string } }) {
  const issueId = Number(params.id);
  const router = useRouter();
  const { mounted, theme } = useTheme();

  const [issue, setIssue] = useState<ClassifiedIssue | null>(null);
  const [history, setHistory] = useState<SubmissionHistoryItem[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [simulationSession, setSimulationSession] = useState<{
    id: string;
    status: "not_started" | "in_progress" | "ready_to_contribute" | "completed";
    totalAttempts: number;
    contributionReady: boolean;
  } | null>(null);
  const [leftPanelPercent, setLeftPanelPercent] = useState(40);
  const [languageId, setLanguageId] = useState(71);
  const [sourceCode, setSourceCode] = useState(starterCode(71));
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFileEntry[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string>("");
  const [stdin, setStdin] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [analysis, setAnalysis] = useState<IssueAnalysisResult | null>(null);
  const [iterativeFeedback, setIterativeFeedback] = useState<IterativeAnalyzerFeedback | null>(null);
  const [finalReview, setFinalReview] = useState<FinalReviewFeedback | null>(null);
  const [ticket, setTicket] = useState<TicketRecord | null>(null);
  const [message, setMessage] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isStartingSimulation, setIsStartingSimulation] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const selectedLanguage = useMemo(
    () => languageOptions.find((option) => option.id === languageId) ?? languageOptions[1],
    [languageId]
  );

  const activeWorkspaceFile = useMemo(
    () => workspaceFiles.find((file) => file.path === activeFilePath) ?? null,
    [workspaceFiles, activeFilePath]
  );

  const splitClass = useMemo(() => {
    if (leftPanelPercent <= 33) return "xl:grid-cols-[32%_68%]";
    if (leftPanelPercent <= 37) return "xl:grid-cols-[36%_64%]";
    if (leftPanelPercent <= 43) return "xl:grid-cols-[40%_60%]";
    if (leftPanelPercent <= 49) return "xl:grid-cols-[46%_54%]";
    return "xl:grid-cols-[52%_48%]";
  }, [leftPanelPercent]);

  const guidedContext = useMemo(
    () => (issue ? issue.guided_context ?? getFallbackGuidedContext(issue) : null),
    [issue]
  );

  const hasCodeEdits = useMemo(
    () => workspaceFiles.some((file) => file.content !== file.originalContent),
    [workspaceFiles]
  );

  const workflowSteps = useMemo(
    () => {
      if (!ticket) {
        return [
          { key: "understand", label: "UNDERSTAND", active: Boolean(issue) },
          { key: "edit", label: "IN_PROGRESS", active: hasCodeEdits },
          { key: "feedback", label: "IN_REVIEW", active: Boolean(iterativeFeedback || analysis) },
          { key: "done", label: "DONE", active: Boolean(finalReview) }
        ];
      }

      return [
        {
          key: "todo",
          label: "TODO",
          active: ticket.status === "todo" || ticket.status === "in_progress" || ticket.status === "in_review" || ticket.status === "done"
        },
        {
          key: "in_progress",
          label: "IN_PROGRESS",
          active: ticket.status === "in_progress" || ticket.status === "in_review" || ticket.status === "done"
        },
        {
          key: "in_review",
          label: "IN_REVIEW",
          active: ticket.status === "in_review" || ticket.status === "done"
        },
        { key: "done", label: "DONE", active: ticket.status === "done" }
      ];
    },
    [ticket, issue, hasCodeEdits, iterativeFeedback, analysis, finalReview]
  );

  const statusLabel = useMemo(
    () =>
      getStatusLabel(
        Boolean(simulationSession),
        hasCodeEdits,
        analysis,
        simulationSession?.status === "completed"
      ),
    [simulationSession, hasCodeEdits, analysis]
  );

  async function loadIssueAndHistory(accessToken?: string) {
    const [issueData, historyData, sessionResult] = await Promise.all([
      fetchIssueById(issueId),
      fetchSubmissionHistory(issueId, accessToken, 20),
      fetchCurrentSimulation({ accessToken, issueId })
    ]);

    setIssue(issueData);
    setHistory(historyData);
    setSimulationSession(sessionResult.session);

    if (featureFlags.companyWorkflow && featureFlags.ticketSystem) {
      try {
        const ticketResponse = await createTicket({ accessToken, issueId });
        setTicket(ticketResponse.ticket);
      } catch {
        setTicket(null);
      }
    }
  }

  useEffect(() => {
    let isMounted = true;

    supabaseBrowser.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setSession(data.session ?? null);
        setAuthReady(true);
      })
      .catch(() => {
        if (!isMounted) return;
        setAuthReady(true);
      });

    const { data } = supabaseBrowser.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!Number.isFinite(issueId)) {
      setMessage("Invalid issue id.");
      return;
    }

    loadIssueAndHistory(session?.access_token).catch((error) => {
      setMessage(error instanceof Error ? error.message : "Failed to load issue");
    });
  }, [authReady, session?.access_token, issueId]);

  useEffect(() => {
    if (!issue) {
      return;
    }

    const seededFiles = buildWorkspaceSeed(issue, languageId);
    setWorkspaceFiles(seededFiles);
    setActiveFilePath(seededFiles[0]?.path ?? "");
    setSourceCode(seededFiles[0]?.content ?? starterCode(languageId));
  }, [issue?.id]);

  async function refreshHistory() {
    const nextHistory = await fetchSubmissionHistory(issueId, session?.access_token, 20);
    setHistory(nextHistory);
  }

  async function handleExecute() {
    setIsRunning(true);
    setMessage("Running AI analyzer on your changes...");
    setAnalysis(null);

    try {
      if (!simulationSession?.id) {
        setMessage("Start the simulation before running code.");
        return;
      }

      const result = await executeSubmission({
        accessToken: session?.access_token,
        issueId,
        simulationSessionId: simulationSession.id,
        languageId,
        sourceCode,
        stdin,
        expectedOutput,
        evaluationMode:
          featureFlags.companyWorkflow && featureFlags.iterativeAnalyzer
            ? "iterative_feedback"
            : undefined,
        workspace: issue
          ? {
              repository: issue.repositoryFullName,
              issueUrl: issue.url,
              notes: "Workspace diff captured from browser IDE",
              files: workspaceFiles.map((file) => ({
                path: file.path,
                language: file.language,
                originalContent: file.originalContent,
                updatedContent: file.content,
                diff: buildSimpleDiff(file.path, file.originalContent, file.content)
              }))
            }
          : undefined
      });

      setAnalysis(result.analysis ?? null);
      setIterativeFeedback(result.iterativeFeedback ?? null);
      setSimulationSession(result.simulationSession);
      setFinalReview(null);
      setMessage("AI feedback generated. Iterate and improve.");
      await refreshHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Execution failed");
    } finally {
      setIsRunning(false);
    }
  }

  async function handleSubmitForReview() {
    if (!simulationSession?.id) {
      setMessage("Start the simulation before submitting for review.");
      return;
    }

    setIsSubmittingReview(true);
    setMessage("Submitting for senior engineer review...");

    try {
      const result = await executeSubmission({
        accessToken: session?.access_token,
        issueId,
        simulationSessionId: simulationSession.id,
        languageId,
        sourceCode,
        stdin,
        expectedOutput,
        evaluationMode: "final_review",
        workspace: issue
          ? {
              repository: issue.repositoryFullName,
              issueUrl: issue.url,
              notes: "Workspace diff captured from browser IDE",
              files: workspaceFiles.map((file) => ({
                path: file.path,
                language: file.language,
                originalContent: file.originalContent,
                updatedContent: file.content,
                diff: buildSimpleDiff(file.path, file.originalContent, file.content)
              }))
            }
          : undefined
      });

      setFinalReview(result.finalReview ?? null);
      setSimulationSession(result.simulationSession);

      if (ticket && result.finalReview && featureFlags.companyWorkflow && featureFlags.ticketSystem) {
        const approved = result.finalReview.final_verdict === "approved";
        const updatedTicket = await completeTicket({
          accessToken: session?.access_token,
          ticketId: ticket.id,
          approved,
          iterativeFeedback: iterativeFeedback ?? undefined,
          finalReview: result.finalReview
        });
        setTicket(updatedTicket.ticket);
      }

      setMessage(
        result.finalReview?.final_verdict === "approved"
          ? "Review approved. You can complete simulation and open contribution flow."
          : "Review completed. Address feedback and submit again."
      );
      await refreshHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to submit for review");
    } finally {
      setIsSubmittingReview(false);
    }
  }

  async function handleStartTicket() {
    if (!ticket) {
      setMessage("Ticket is unavailable. Falling back to simulation flow.");
      return;
    }

    try {
      const result = await startTicket({
        accessToken: session?.access_token,
        ticketId: ticket.id
      });
      setTicket(result.ticket);
      setMessage("Ticket moved to IN_PROGRESS.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to start ticket");
    }
  }

  async function handleCompleteSimulation() {
    if (!analysis && !finalReview) {
      setMessage("Run AI feedback and submit for review before completing the simulation.");
      return;
    }

    if ((finalReview?.confidence_score ?? analysis?.confidence ?? 0) < 0.7) {
      const confirmed = window.confirm(
        "The analysis confidence is below 70%. Continue to the contribution page anyway?"
      );
      if (!confirmed) {
        return;
      }
    }

    setMessage("Opening the contribution workflow...");
    router.push(`/issues/${issueId}/contribution`);
  }

  async function handleStartSimulation() {
    setIsStartingSimulation(true);
    setMessage("Starting simulation workspace...");

    try {
      const result = await startSimulation({
        accessToken: session?.access_token,
        issueId
      });
      setSimulationSession(result.session);
      setMessage("Simulation started. Begin exploring the issue and ship your first attempt.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to start simulation");
    } finally {
      setIsStartingSimulation(false);
    }
  }

  const rightSlot = (
    <div className="panel-note flex flex-wrap items-center gap-2 p-2">
      <Link href="/problems" className="ui-button-muted">
        Back to Problems
      </Link>
      <span className="badge status-review border">
        {session?.access_token ? "Authenticated mode" : "Demo mode"}
      </span>
      <span className="badge status-review border">{statusLabel}</span>
    </div>
  );

  return (
    <DashboardShell
      title="Simulation Workspace"
      subtitle="Learn, try, get AI feedback, and contribute like a production engineer"
      rightSlot={rightSlot}
    >
      <div className="section-card mb-6 flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-secondary">Panel Split</span>
        <input
          type="range"
          min={30}
          max={55}
          value={leftPanelPercent}
          onChange={(event) => setLeftPanelPercent(Number(event.target.value))}
          className="h-2 w-52 cursor-pointer accent-blue-500"
          aria-label="Resize context and editor panels"
        />
        <span className="text-sm text-primary">{leftPanelPercent}% / {100 - leftPanelPercent}%</span>
      </div>

      <section className={`grid grid-cols-1 gap-6 ${splitClass}`}>
        <div className="space-y-6">
          <div className="ui-card">
            <p className="text-xs uppercase tracking-[0.22em] text-brand-300">Ticket Header</p>
            <h3 className="mt-3 flex items-center gap-2 text-xl font-semibold text-primary">
              <ClipboardList size={22} />
              {ticket?.title ?? issue?.title ?? "Loading ticket..."}
            </h3>
            <p className="mt-2 text-sm leading-6 text-secondary">
              {ticket?.description ?? "Convert this issue into a production-style ticket lifecycle and ship with review confidence."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="status-chip status-review border">Priority {ticket?.priority ?? "medium"}</span>
              <span className="status-chip status-review border">Type {ticket?.type ?? "bug"}</span>
              <span className="status-chip status-review border">Status {(ticket?.status ?? "todo").replace("_", " ")}</span>
            </div>
            {issue ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  className="ui-button-muted"
                  href={`https://github.com/${issue.repositoryFullName}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Repository
                </a>
                <a className="ui-button-muted" href={issue.url} target="_blank" rel="noreferrer">
                  Review Original Issue
                </a>
              </div>
            ) : null}
          </div>

          <div className="ui-card">
            <p className="text-xs uppercase tracking-[0.22em] text-brand-300">AI Briefing Panel</p>
            {ticket?.metadata?.briefing || guidedContext ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="surface-elevated p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">What is broken</p>
                  <p className="mt-2 text-sm leading-6 text-secondary">{ticket?.metadata?.briefing?.what_is_broken ?? guidedContext?.what_is_broken}</p>
                </div>
                <div className="surface-elevated p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Hint</p>
                  <p className="mt-2 text-sm leading-6 text-secondary">{ticket?.metadata?.briefing?.hint ?? guidedContext?.hint}</p>
                </div>
                <div className="surface-elevated p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Where to fix</p>
                  <ul className="mt-2 space-y-1 text-sm text-secondary">
                    {(ticket?.metadata?.briefing?.where_to_fix ?? guidedContext?.where_to_fix ?? []).slice(0, 5).map((path: string) => (
                      <li key={path}>- {path}</li>
                    ))}
                  </ul>
                </div>
                <div className="surface-elevated p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Expected outcome</p>
                  <p className="mt-2 text-sm leading-6 text-secondary">{ticket?.metadata?.briefing?.expected_outcome ?? guidedContext?.expected_outcome}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-secondary">Loading briefing context...</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="ui-card">
            <p className="text-xs uppercase tracking-[0.22em] text-brand-300">Workflow Progress Bar</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {workflowSteps.map((step) => (
                <div
                  key={step.key}
                  className={`rounded-2xl border p-4 text-sm ${step.active ? "border-brand-400/40 bg-brand-500/10 text-primary" : "border-white/10 bg-white/5 text-secondary"}`}
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Ticket State</p>
                  <p className="mt-2 font-medium">{step.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="ui-card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-lg font-semibold text-primary">Coding Environment</h4>
              <div className="flex flex-wrap gap-2">
                {simulationSession ? (
                  <>
                    <span className="status-chip status-review border">Attempts {simulationSession.totalAttempts}</span>
                    <select
                      value={languageId}
                      onChange={(event) => setLanguageId(Number(event.target.value))}
                      aria-label="Select language"
                      title="Select language"
                      className="ui-input w-44"
                    >
                      {languageOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="ui-button-muted"
                      type="button"
                      onClick={() => {
                        const resetCode = starterCode(languageId);
                        setSourceCode(resetCode);
                        setWorkspaceFiles((current) =>
                          current.map((file) =>
                            file.path === activeFilePath
                              ? {
                                  ...file,
                                  content: resetCode
                                }
                              : file
                          )
                        );
                      }}
                    >
                      Reset
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {simulationSession ? (
              <>
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <div className="border-b border-white/10 bg-slate-950/70 p-2">
                    <div className="flex flex-wrap gap-2">
                      {workspaceFiles.map((file, index) => (
                        <button
                          key={file.path}
                          type="button"
                          className={`ui-button-muted text-xs ${activeFilePath === file.path ? "ring-2 ring-brand-500/40" : ""}`}
                          onClick={() => {
                            setActiveFilePath(file.path);
                            setSourceCode(file.content);
                          }}
                        >
                          {file.path}
                          {index === 0 ? " (Start here)" : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                  <MonacoEditor
                    height="460px"
                    language={activeWorkspaceFile?.language ?? selectedLanguage.monaco}
                    value={sourceCode}
                    theme={mounted && theme === "light" ? "light" : "vs-dark"}
                    onChange={(value) => {
                      const nextValue = value ?? "";
                      setSourceCode(nextValue);
                      setWorkspaceFiles((current) =>
                        current.map((file) =>
                          file.path === activeFilePath
                            ? {
                                ...file,
                                content: nextValue
                              }
                            : file
                        )
                      );
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      automaticLayout: true,
                      smoothScrolling: true,
                      lineHeight: 22
                    }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <label className="grid gap-2 text-xs uppercase tracking-wider text-secondary">
                    Standard Input
                    <textarea value={stdin} onChange={(event) => setStdin(event.target.value)} rows={4} className="ui-input" />
                  </label>
                  <label className="grid gap-2 text-xs uppercase tracking-wider text-secondary">
                    Expected Output
                    <textarea
                      value={expectedOutput}
                      onChange={(event) => setExpectedOutput(event.target.value)}
                      rows={4}
                      className="ui-input"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    className="ui-button-muted"
                    type="button"
                    onClick={handleStartTicket}
                    disabled={!ticket || ticket.status !== "todo"}
                  >
                    Start Ticket
                  </button>
                  <button className="ui-button" type="button" onClick={handleExecute} disabled={isRunning || !sourceCode.trim()}>
                    {isRunning ? "Running..." : "Run Code"}
                  </button>
                  <button
                    className="ui-button-muted"
                    type="button"
                    onClick={handleSubmitForReview}
                    disabled={isSubmittingReview || !sourceCode.trim()}
                  >
                    {isSubmittingReview ? "Submitting..." : "Submit for Review"}
                  </button>
                  <button
                    className="ui-button-muted"
                    type="button"
                    onClick={handleCompleteSimulation}
                    disabled={!finalReview && !analysis}
                  >
                    Complete Simulation
                  </button>
                  {message ? <span className="text-sm text-brand-200">{message}</span> : null}
                </div>
              </>
            ) : (
              <div className="surface-subtle p-6">
                <p className="text-xs uppercase tracking-[0.22em] text-brand-300">Simulation Workspace</p>
                <h5 className="mt-3 text-2xl font-semibold text-primary">Start Simulation</h5>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">
                  Initialize a tracked session for this issue, unlock the coding environment, and capture your attempts and AI reviews.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button className="ui-button" type="button" onClick={handleStartSimulation} disabled={isStartingSimulation}>
                    {isStartingSimulation ? "Starting..." : "Start Simulation"}
                  </button>
                  <span className="text-sm text-secondary">
                    {session?.access_token
                      ? "Your authenticated progress will be tracked."
                      : "Running in demo mode with backend in-memory tracking."}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="ui-card">
            <h4 className="flex items-center gap-2 text-lg font-semibold text-primary">
              <CircleDashed size={22} />
              AI Feedback Panel
            </h4>
            {finalReview ? (
              <div className="mt-3 space-y-3 text-sm text-primary">
                <div className="flex flex-wrap gap-2">
                  <span className={`status-chip ${finalReview.final_verdict === "approved" ? "status-pass" : "status-review"} gap-1`}>
                    {finalReview.final_verdict === "approved" ? <CheckCircle2 size={20} /> : <Bug size={20} />}
                    {finalReview.final_verdict === "approved" ? "Approved" : "Needs Work"}
                  </span>
                  <span className="status-chip status-review">Confidence {(finalReview.confidence_score * 100).toFixed(1)}%</span>
                </div>
                <p className="text-secondary">{finalReview.summary}</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Correctness</p>
                    <p className="mt-1 text-lg font-semibold text-primary">{finalReview.correctness_score.toFixed(1)}/10</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Code Quality</p>
                    <p className="mt-1 text-lg font-semibold text-primary">{finalReview.code_quality.toFixed(1)}/10</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Edge Cases</p>
                    <p className="mt-1 text-lg font-semibold text-primary">{finalReview.edge_case_handling.toFixed(1)}/10</p>
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                  <h5 className="mb-1 flex items-center gap-2 font-semibold text-emerald-200">
                    <CheckCircle2 size={20} />
                    Strengths
                  </h5>
                  <ul className="list-disc space-y-1 pl-5 text-secondary">
                    {finalReview.strengths.length ? finalReview.strengths.map((item: string) => <li key={item}>{item}</li>) : <li>Solid progress on the requested ticket scope.</li>}
                  </ul>
                </div>
                <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3">
                  <h5 className="mb-1 flex items-center gap-2 font-semibold text-rose-200">
                    <Bug size={20} />
                    Weaknesses
                  </h5>
                  <ul className="list-disc space-y-1 pl-5 text-secondary">
                    {finalReview.weaknesses.length ? finalReview.weaknesses.map((item: string) => <li key={item}>{item}</li>) : <li>No critical weaknesses detected.</li>}
                  </ul>
                </div>
              </div>
            ) : iterativeFeedback ? (
              <div className="mt-3 space-y-3 text-sm text-primary">
                <div className="flex flex-wrap gap-2">
                  <span className={`status-chip ${iterativeFeedback.status === "correct" ? "status-pass" : "status-review"} gap-1`}>
                    {iterativeFeedback.status === "correct" ? <CheckCircle2 size={20} /> : <Bug size={20} />}
                    {iterativeFeedback.status === "correct" ? "Correct" : iterativeFeedback.status === "almost" ? "Almost" : "Progress"}
                  </span>
                  <span className="status-chip status-review">Confidence {(iterativeFeedback.confidence * 100).toFixed(1)}%</span>
                </div>
                <p className="text-secondary">{iterativeFeedback.summary}</p>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                  <h5 className="mb-1 flex items-center gap-2 font-semibold text-emerald-200">
                    <CheckCircle2 size={20} />
                    What you did right
                  </h5>
                  <ul className="list-disc space-y-1 pl-5 text-secondary">
                    {iterativeFeedback.what_you_did_right.length ? (
                      iterativeFeedback.what_you_did_right.map((item: string) => <li key={item}>{item}</li>)
                    ) : (
                      <li>Your changes are moving in the right direction.</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3">
                  <h5 className="mb-1 flex items-center gap-2 font-semibold text-rose-200">
                    <Bug size={20} />
                    What needs improvement
                  </h5>
                  <ul className="list-disc space-y-1 pl-5 text-secondary">
                    {iterativeFeedback.what_to_improve.length ? (
                      iterativeFeedback.what_to_improve.map((item: string) => <li key={item}>{item}</li>)
                    ) : (
                      <li>No critical issues detected in this iteration.</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3">
                  <h5 className="mb-1 flex items-center gap-2 font-semibold text-blue-200">
                    <Lightbulb size={20} />
                    Suggested focus area
                  </h5>
                  <p className="text-secondary">{iterativeFeedback.suggested_focus_area}</p>
                </div>
                <div className="rounded-xl border border-brand-400/20 bg-brand-500/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-wide text-brand-100">Issue Progress</p>
                    <span className="text-sm text-primary">{Math.round(iterativeFeedback.confidence * 100)}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/10">
                    <progress
                      value={Math.max(1, Math.round(iterativeFeedback.confidence * 100))}
                      max={100}
                      className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-white/10 [&::-webkit-progress-value]:bg-brand-400 [&::-moz-progress-bar]:bg-brand-400"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-secondary">
                Run Code for iterative mentor feedback, then use Submit for Review to get final senior engineer verdict.
              </p>
            )}
          </div>

          <div className="ui-card">
            <h4 className="text-lg font-semibold text-primary">My Submissions</h4>
            <div className="mt-3 space-y-2">
              {history.length ? (
                history.map((item) => (
                  <article key={item.id} className="surface-elevated rounded-xl p-3 text-sm text-secondary">
                    <div className="mb-1 flex flex-wrap gap-2">
                      <span className="status-chip status-review border">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                      {item.evaluation ? (
                        <span className="status-chip status-review border">AI {item.evaluation.verdict}</span>
                      ) : null}
                    </div>
                    <p>Analyzer status: {item.judge0_status_description ?? "In progress"}</p>
                  </article>
                ))
              ) : (
                <p className="text-sm text-secondary">No submissions yet for this issue.</p>
              )}
            </div>
          </div>

          <div className="ui-card">
            <h4 className="text-lg font-semibold text-primary">Next Step</h4>
            <p className="mt-2 text-sm text-secondary">
              Once your confidence is high, continue to contribution flow with branch, commit, and PR guidance.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="ui-button"
                type="button"
                onClick={handleCompleteSimulation}
                disabled={!finalReview && !analysis}
              >
                Mark as Completed
              </button>
              {issue ? (
                <Link className="ui-button-muted" href={`/issues/${issue.id}/contribution`}>
                  Open Contribution Page
                </Link>
              ) : null}
              {issue ? (
                <a className="ui-button-muted" href={issue.url} target="_blank" rel="noreferrer">
                  <ArrowUpRight size={18} />
                  View Issue on GitHub
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
