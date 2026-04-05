"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Bug,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  GitBranchPlus,
  GitCommitHorizontal,
  GitFork,
  GitPullRequestArrow,
  Lightbulb,
  Rocket,
  TerminalSquare,
  XCircle
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import type { ClassifiedIssue } from "@growthengine/shared";

import {
  attachContributionPr,
  evaluateSubmission,
  executeSubmission,
  fetchCurrentSimulation,
  fetchContributionHistory,
  fetchIssueById,
  fetchSubmissionHistory,
  startSimulation,
  startContributionGuide,
  type ContributionDraft,
  type ContributionGuideRecord,
  type SubmissionHistoryItem
} from "../../../lib/api";
import { DashboardShell } from "../../../components/dashboard-shell";
import { GitHubMark } from "../../../components/social-icons";
import { supabaseBrowser } from "../../../lib/supabase-browser";
import { useTheme } from "../../../components/theme-provider";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false
});

const languageOptions = [
  { id: 63, label: "JavaScript (Node.js)", monaco: "javascript" },
  { id: 71, label: "Python", monaco: "python" },
  { id: 62, label: "Java", monaco: "java" },
  { id: 54, label: "C++", monaco: "cpp" }
] as const;

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

function toStatusTone(verdict?: "pass" | "fail" | "review" | null) {
  if (verdict === "pass") return "status-pass";
  if (verdict === "fail") return "status-fail";
  return "status-review";
}

type ExecuteResult = {
  submissionId: string;
  expectedOutputMatch: boolean | null;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  status: { id: number; description: string };
};

export default function IssueSolvePage({ params }: { params: { id: string } }) {
  const issueId = Number(params.id);
  const router = useRouter();
  const { mounted, theme } = useTheme();

  const [issue, setIssue] = useState<ClassifiedIssue | null>(null);
  const [history, setHistory] = useState<SubmissionHistoryItem[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [contributions, setContributions] = useState<ContributionGuideRecord[]>([]);
  const [simulationSession, setSimulationSession] = useState<{
    id: string;
    status: "not_started" | "in_progress" | "ready_to_contribute" | "completed";
    totalAttempts: number;
    contributionReady: boolean;
  } | null>(null);
  const [activeGuide, setActiveGuide] = useState<ContributionGuideRecord | null>(null);
  const [guideSteps, setGuideSteps] = useState<string[]>([]);
  const [contributionDraft, setContributionDraft] = useState<ContributionDraft | null>(null);
  const [prUrl, setPrUrl] = useState("");
  const [prStatus, setPrStatus] = useState<"opened" | "in_review" | "changes_requested" | "merged" | "closed">("opened");
  const [contextTab, setContextTab] = useState<"scenario" | "requirements" | "source">("scenario");
  const [leftPanelPercent, setLeftPanelPercent] = useState(40);
  const [languageId, setLanguageId] = useState(71);
  const [sourceCode, setSourceCode] = useState(starterCode(71));
  const [stdin, setStdin] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [execution, setExecution] = useState<ExecuteResult | null>(null);
  const [evaluation, setEvaluation] = useState<{
    verdict: "pass" | "fail" | "review";
    summary: string;
    strengths: string[];
    risks: string[];
    suggestions: string[];
    confidence: number;
    modelName: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isStartingSimulation, setIsStartingSimulation] = useState(false);
  const [isStartingGuide, setIsStartingGuide] = useState(false);
  const [isSavingPr, setIsSavingPr] = useState(false);

  const selectedLanguage = useMemo(
    () => languageOptions.find((option) => option.id === languageId) ?? languageOptions[1],
    [languageId]
  );

  const aiCleanSummary = useMemo(() => {
    if (!issue) {
      return "This issue requires an implementation update in the target repository.";
    }

    const scenarioText = issue.scenarioBody ?? issue.body;
    return scenarioText.length > 320 ? `${scenarioText.slice(0, 320)}...` : scenarioText;
  }, [issue]);

  const splitClass = useMemo(() => {
    if (leftPanelPercent <= 33) return "xl:grid-cols-[32%_68%]";
    if (leftPanelPercent <= 37) return "xl:grid-cols-[36%_64%]";
    if (leftPanelPercent <= 43) return "xl:grid-cols-[40%_60%]";
    if (leftPanelPercent <= 49) return "xl:grid-cols-[46%_54%]";
    return "xl:grid-cols-[52%_48%]";
  }, [leftPanelPercent]);

  const contributionCommands = useMemo(() => {
    if (!issue) {
      return "";
    }

    const branchName = activeGuide?.branch_name ?? `fix/issue-${issue.id}`;
    const repoUrl = `https://github.com/${issue.repositoryFullName}.git`;

    return [
      "# fork the repository in GitHub first",
      `git clone ${repoUrl}`,
      `cd ${issue.repositoryFullName.split("/")[1] ?? "repo"}`,
      "git remote rename origin upstream",
      `git remote add origin https://github.com/<your-username>/${issue.repositoryFullName.split("/")[1] ?? "repo"}.git`,
      "git fetch upstream",
      `git checkout -b ${branchName} upstream/main`,
      "# apply your fix, then run tests locally",
      "git add .",
      `git commit -m "Fix issue #${issue.id}: ${issue.title}"`,
      `git push -u origin ${branchName}`
    ].join("\n");
  }, [activeGuide?.branch_name, issue]);

  const contributionSteps = guideSteps.length
    ? guideSteps
    : [
        "Fork the repository",
        "Clone it locally",
        "Create a new branch",
        "Apply the fix",
        "Commit and push",
        "Open a pull request"
      ];

  const contributionUnlocked = Boolean(
    execution && (execution.expectedOutputMatch === true || evaluation?.verdict === "pass" || evaluation?.verdict === "review")
  );

  async function loadIssueAndHistory(accessToken?: string) {
    const [issueData, historyData, contributionItems, sessionResult] = await Promise.all([
      fetchIssueById(issueId),
      fetchSubmissionHistory(issueId, accessToken, 20),
      fetchContributionHistory({ accessToken, issueId }),
      fetchCurrentSimulation({ accessToken, issueId })
    ]);

    setIssue(issueData);
    setHistory(historyData);
    setContributions(contributionItems);
    setSimulationSession(sessionResult.session);
    if (contributionItems.length) {
      setActiveGuide(contributionItems[0]);
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
    if (!Number.isFinite(issueId)) {
      return;
    }

    fetchSubmissionHistory(issueId, session?.access_token, 20)
      .then((items) => setHistory(items))
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "Failed to load history");
      });
  }, [issueId, session?.access_token]);

  async function refreshHistory() {
    const nextHistory = await fetchSubmissionHistory(issueId, session?.access_token, 20);
    setHistory(nextHistory);
  }

  async function refreshContributionHistory() {
    const items = await fetchContributionHistory({ accessToken: session?.access_token, issueId });
    setContributions(items);
    if (items.length) {
      setActiveGuide(items[0]);
      setPrUrl(items[0].pr_url ?? "");
    }
  }

  async function refreshSimulationSession() {
    const result = await fetchCurrentSimulation({ accessToken: session?.access_token, issueId });
    setSimulationSession(result.session);
  }

  useEffect(() => {
    if (activeGuide?.pr_url) {
      setPrUrl(activeGuide.pr_url);
    }
  }, [activeGuide?.pr_url]);

  async function handleExecute() {
    setIsRunning(true);
    setMessage("Running code in Judge0 sandbox...");
    setEvaluation(null);

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
        expectedOutput
      });

      setExecution(result);
      setSimulationSession(result.simulationSession);
      setMessage("Execution completed.");
      await refreshHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Execution failed");
    } finally {
      setIsRunning(false);
    }
  }

  async function handleEvaluate() {
    if (!execution?.submissionId) {
      setMessage("Run execution first to create a submission.");
      return;
    }

    setIsEvaluating(true);
    setMessage("Requesting AI engineering review...");

    try {
      if (!simulationSession?.id) {
        setMessage("Start the simulation before evaluation.");
        return;
      }

      const result = await evaluateSubmission({
        accessToken: session?.access_token,
        submissionId: execution.submissionId,
        simulationSessionId: simulationSession.id
      });
      setEvaluation(result.evaluation);
      setSimulationSession(result.simulationSession);
      setMessage("Evaluation completed.");
      await refreshHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Evaluation failed");
    } finally {
      setIsEvaluating(false);
    }
  }

  async function handleStartContributionGuide() {
    if (!issue || !simulationSession?.id) {
      setMessage("Start the simulation and load the issue before starting contribution guide.");
      return;
    }

    setIsStartingGuide(true);
    setMessage("Creating contribution guide...");

    try {
      const result = await startContributionGuide({
        accessToken: session?.access_token,
        issueId: issue.id,
        simulationSessionId: simulationSession.id,
        repositoryFullName: issue.repositoryFullName,
        issueUrl: issue.url,
        issueTitle: issue.title
      });

      setActiveGuide(result.guide);
      setGuideSteps(result.steps);
      setContributionDraft(result.draft);
      setMessage("Contribution guide created. Follow the steps and attach your PR URL.");
      await refreshContributionHistory();
      await refreshSimulationSession();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to start contribution guide");
    } finally {
      setIsStartingGuide(false);
    }
  }

  async function handleAttachPr() {
    if (!activeGuide?.id || !prUrl) {
      setMessage("Start a guide and provide a PR URL first.");
      return;
    }

    setIsSavingPr(true);
    setMessage("Saving PR link...");

    try {
      const result = await attachContributionPr({
        accessToken: session?.access_token,
        guideId: activeGuide.id,
        prUrl,
        prStatus
      });

      setActiveGuide(result.guide);
      setMessage("PR URL saved to contribution history.");
      await refreshContributionHistory();
      await refreshSimulationSession();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save PR URL");
    } finally {
      setIsSavingPr(false);
    }
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
    </div>
  );

  return (
    <DashboardShell
      title="Simulation Workspace"
      subtitle="Resolve this real issue like a production engineer with code execution, mentoring feedback, and contribution tracking"
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
            <div className="mb-3 flex flex-wrap gap-2">
              {issue ? (
                <>
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
                  {issue.techStack.map((tag) => (
                    <span key={tag} className="badge border border-white/15 bg-white/5 text-primary">
                      {tag}
                    </span>
                  ))}
                </>
              ) : null}
            </div>

            <h3 className="text-xl font-semibold text-primary">
              {issue?.scenarioTitle ?? issue?.title ?? "Loading issue..."}
            </h3>
            <p className="mt-2 text-sm leading-6 text-secondary">
              You are a software engineer assigned to triage and deliver a production-safe fix with
              testable output and contribution-ready changes.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={`ui-button-muted ${contextTab === "scenario" ? "ring-2 ring-brand-500/40" : ""}`}
                onClick={() => setContextTab("scenario")}
              >
                Scenario
              </button>
              <button
                type="button"
                className={`ui-button-muted ${contextTab === "requirements" ? "ring-2 ring-brand-500/40" : ""}`}
                onClick={() => setContextTab("requirements")}
              >
                Requirements
              </button>
              <button
                type="button"
                className={`ui-button-muted ${contextTab === "source" ? "ring-2 ring-brand-500/40" : ""}`}
                onClick={() => setContextTab("source")}
              >
                Original Issue
              </button>
            </div>

            <div className="surface-elevated mt-4 p-4 text-sm leading-6 text-primary">
              {contextTab === "scenario" ? (
                <div className="space-y-4">
                  <p>{aiCleanSummary}</p>
                  <div className="rounded-2xl border border-brand-400/20 bg-brand-500/10 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-brand-100">Max Learning Workflow</p>
                    <p className="mt-2 text-sm leading-6 text-secondary">
                      Treat this like real engineering work. Study the repository first, understand where the behavior lives,
                      and only then move into implementation.
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="step-item">
                        <span className="step-index">1</span>
                        <span>Open the GitHub repository and scan the README, contribution docs, and issue thread for context.</span>
                      </div>
                      <div className="step-item">
                        <span className="step-index">2</span>
                        <span>Explore the codebase structure to find the feature area, related modules, and existing tests.</span>
                      </div>
                      <div className="step-item">
                        <span className="step-index">3</span>
                        <span>Trace where the current behavior is implemented, then identify the exact place where a fix is most likely needed.</span>
                      </div>
                      <div className="step-item">
                        <span className="step-index">4</span>
                        <span>Write down the expected behavior, edge cases, and how you will verify the fix before changing code.</span>
                      </div>
                      <div className="step-item">
                        <span className="step-index">5</span>
                        <span>Only after you understand the flow, use the editor here to implement, test, review, and improve your solution.</span>
                      </div>
                    </div>
                    {issue ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a className="ui-button-muted" href={`https://github.com/${issue.repositoryFullName}`} target="_blank" rel="noreferrer">
                          Open Repository
                        </a>
                        <a className="ui-button-muted" href={issue.url} target="_blank" rel="noreferrer">
                          Review Original Issue
                        </a>
                      </div>
                    ) : null}
                  </div>
                  {issue?.learningObjectives?.length ? (
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted">Learning Objectives</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-secondary">
                        {issue.learningObjectives.map((objective) => (
                          <li key={objective}>{objective}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {contextTab === "requirements" ? (
                issue?.acceptanceCriteria?.length ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {issue.acceptanceCriteria.map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                  </ul>
                ) : (
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Implement a deterministic, testable fix for the issue.</li>
                    <li>Handle edge cases and malformed input safely.</li>
                    <li>Ensure output aligns with expected contract.</li>
                    <li>Prepare code for upstream PR submission.</li>
                  </ul>
                )
              ) : null}
              {contextTab === "source" ? (
                <div className="space-y-2">
                  <p className="text-secondary">Reference the original issue for full project context:</p>
                  <a href={issue?.url ?? "#"} target="_blank" rel="noreferrer" className="ui-button-muted inline-flex gap-2">
                    <ExternalLink size={18} />
                    View on GitHub
                  </a>
                </div>
              ) : null}
            </div>

            <details className="surface-elevated mt-4 rounded-xl p-3 text-sm text-secondary">
              <summary className="cursor-pointer font-semibold text-primary">Expand raw issue details</summary>
              <p className="mt-3 whitespace-pre-wrap leading-6">{issue?.body ?? "No issue body"}</p>
            </details>
          </div>

          <div className="ui-card">
            <h4 className="flex items-center gap-2 text-lg font-semibold text-primary">
              <CircleDashed size={22} />
              AI Review Panel
            </h4>
            {evaluation ? (
              <div className="mt-3 space-y-3 text-sm text-primary">
                <div>
                  <span className={`status-chip ${toStatusTone(evaluation.verdict)} gap-1`}>
                    {evaluation.verdict === "pass" ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    Verdict: {evaluation.verdict.toUpperCase()}
                  </span>
                  <span className="status-chip status-review">
                    Confidence {(evaluation.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <p>{evaluation.summary}</p>
                <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3">
                  <h5 className="mb-1 flex items-center gap-2 font-semibold text-rose-200">
                    <Bug size={20} />
                    Bugs
                  </h5>
                  <ul className="list-disc space-y-1 pl-5 text-secondary">
                    {evaluation.risks.length ? (
                      evaluation.risks.map((item) => <li key={item}>{item}</li>)
                    ) : (
                      <li>No critical bug detected from current execution output.</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3">
                  <h5 className="mb-1 flex items-center gap-2 font-semibold text-blue-200">
                    <Lightbulb size={20} />
                    Improvements
                  </h5>
                  <ul className="list-disc space-y-1 pl-5 text-secondary">
                    {evaluation.suggestions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3">
                  <h5 className="mb-1 flex items-center gap-2 font-semibold text-amber-200">
                    <Rocket size={20} />
                    Optimization
                  </h5>
                  <ul className="list-disc space-y-1 pl-5 text-secondary">
                    {evaluation.strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-secondary">
                Run and evaluate your code to receive senior engineer style feedback with bugs,
                optimizations, and code quality notes.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="ui-card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-lg font-semibold text-primary">Coding Environment</h4>
              <div className="flex flex-wrap gap-2">
                {simulationSession ? (
                  <>
                    <span className="status-chip status-review border">
                      Status {simulationSession.status.replace(/_/g, " ")}
                    </span>
                    <span className="status-chip status-review border">
                      Attempts {simulationSession.totalAttempts}
                    </span>
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
                    <button className="ui-button-muted" type="button" onClick={() => setSourceCode(starterCode(languageId))}>
                      Reset
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {simulationSession ? (
              <>
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <MonacoEditor
                    height="460px"
                    language={selectedLanguage.monaco}
                    value={sourceCode}
                    theme={mounted && theme === "light" ? "light" : "vs-dark"}
                    onChange={(value) => setSourceCode(value ?? "")}
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
                    <textarea
                      value={stdin}
                      onChange={(event) => setStdin(event.target.value)}
                      rows={4}
                      className="ui-input"
                    />
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
                  <button className="ui-button" type="button" onClick={handleExecute} disabled={isRunning || !sourceCode.trim()}>
                    {isRunning ? "Running..." : "Run Code"}
                  </button>
                  <button
                    className="ui-button-muted"
                    type="button"
                    onClick={() => setShowHint((value) => !value)}
                    disabled={!issue?.learningObjectives?.length}
                  >
                    {showHint ? "Hide Hint" : "Show Hint"}
                  </button>
                  <button
                    className="ui-button-muted"
                    type="button"
                    onClick={handleEvaluate}
                    disabled={isEvaluating || !execution?.submissionId}
                  >
                    {isEvaluating ? "Reviewing..." : "Submit Solution"}
                  </button>
                  {message ? <span className="text-sm text-brand-200">{message}</span> : null}
                </div>

                {showHint && issue?.learningObjectives?.length ? (
                  <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-100">Hint</p>
                    <p className="mt-2 text-sm leading-6 text-primary">{issue.learningObjectives[0]}</p>
                  </div>
                ) : null}

                {execution ? (
                  <div className="surface-elevated mt-4 p-4">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className={`status-chip border gap-1 ${execution.status.id === 3 ? "status-pass" : "status-fail"}`}>
                        {execution.status.id === 3 ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                        {execution.status.description}
                      </span>
                      <span
                        className={`status-chip border gap-1 ${
                          execution.expectedOutputMatch === true
                            ? "status-pass"
                            : execution.expectedOutputMatch === false
                              ? "status-fail"
                              : "status-review"
                        }`}
                      >
                        {execution.expectedOutputMatch === true ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                        Expected Output {execution.expectedOutputMatch === null ? "N/A" : execution.expectedOutputMatch ? "Matched" : "Mismatch"}
                      </span>
                    </div>
                    <p className="mb-1 text-xs uppercase tracking-wide text-muted">Console Output</p>
                    <pre className="code-block">{execution.stdout || "<no stdout>"}</pre>
                    {execution.stderr ? <pre className="code-block">stderr: {execution.stderr}</pre> : null}
                    {execution.compile_output ? (
                      <pre className="code-block">compile: {execution.compile_output}</pre>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="surface-subtle p-6">
                <p className="text-xs uppercase tracking-[0.22em] text-brand-300">Simulation Workspace</p>
                <h5 className="mt-3 text-2xl font-semibold text-primary">Start Simulation</h5>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">
                  Initialize a tracked session for this issue, unlock the coding environment, and
                  capture your attempts, AI reviews, and contribution readiness from one workflow.
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

          {contributionUnlocked ? (
            <div className="ui-card">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-brand-300">Guided Contribution Mode</p>
                  <h4 className="mt-2 text-xl font-semibold text-primary">Ready to Contribute?</h4>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
                    Use this issue as a bridge from simulation to real-world contribution. Follow the
                    workflow below, apply your validated fix, and open a PR upstream.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="ui-button"
                    type="button"
                    onClick={handleStartContributionGuide}
                    disabled={isStartingGuide || !issue || !simulationSession}
                  >
                    <GitBranchPlus size={18} />
                    {isStartingGuide ? "Preparing..." : "Prepare Guide"}
                  </button>
                  {issue ? (
                    <a className="ui-button-muted" href={issue.url} target="_blank" rel="noreferrer">
                      <ArrowUpRight size={18} />
                      View Issue on GitHub
                    </a>
                  ) : null}
                  {issue ? (
                    <Link className="ui-button-muted" href={`/issues/${issue.id}/contribution`}>
                      Open Contribution Page
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="surface-subtle p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/80">
                      <GitHubMark size={20} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted">Repository</p>
                      <a
                        href={issue ? `https://github.com/${issue.repositoryFullName}` : "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-brand-200"
                      >
                        {issue?.repositoryFullName ?? "Loading repository..."}
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="step-item">
                      <span className="step-index">1</span>
                      <div className="flex items-start gap-3">
                        <GitFork size={18} className="mt-0.5 text-brand-300" />
                        <span>Fork the repository</span>
                      </div>
                    </div>
                    <div className="step-item">
                      <span className="step-index">2</span>
                      <div className="flex items-start gap-3">
                        <TerminalSquare size={18} className="mt-0.5 text-brand-300" />
                        <span>Clone it locally</span>
                      </div>
                    </div>
                    <div className="step-item">
                      <span className="step-index">3</span>
                      <div className="flex items-start gap-3">
                        <GitBranchPlus size={18} className="mt-0.5 text-brand-300" />
                        <span>Create a new branch</span>
                      </div>
                    </div>
                    <div className="step-item">
                      <span className="step-index">4</span>
                      <div className="flex items-start gap-3">
                        <Bug size={18} className="mt-0.5 text-brand-300" />
                        <span>Apply the fix</span>
                      </div>
                    </div>
                    <div className="step-item">
                      <span className="step-index">5</span>
                      <div className="flex items-start gap-3">
                        <GitCommitHorizontal size={18} className="mt-0.5 text-brand-300" />
                        <span>Commit and push</span>
                      </div>
                    </div>
                    <div className="step-item">
                      <span className="step-index">6</span>
                      <div className="flex items-start gap-3">
                        <GitPullRequestArrow size={18} className="mt-0.5 text-brand-300" />
                        <span>Open a pull request</span>
                      </div>
                    </div>
                  </div>

                  <div className="timeline-card mt-6">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Ready to Contribute?</p>
                    <p className="mt-2 text-sm leading-6 text-secondary">
                      Your simulation run is done. Carry the same fix into the upstream repository and
                      submit it as a real contribution.
                    </p>
                  </div>

                  {guideSteps.length ? (
                    <div className="mt-6 rounded-2xl border border-brand-400/20 bg-brand-500/10 p-4">
                      <p className="text-sm font-medium text-brand-100">Guide status</p>
                      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-secondary">
                        {contributionSteps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>

                <div className="surface-subtle p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted">Git Commands</p>
                      <p className="mt-2 text-sm text-secondary">
                        Run these locally after forking to move your fix into a real branch.
                      </p>
                    </div>
                    {issue ? (
                      <a className="ui-button" href={issue.url} target="_blank" rel="noreferrer">
                        <ArrowUpRight size={18} />
                        View Issue on GitHub
                      </a>
                    ) : null}
                  </div>

                  <pre className="code-block mt-4">{contributionCommands || "Run code to unlock contribution guidance."}</pre>

                  {contributionDraft ? (
                    <div className="mt-5 rounded-2xl border border-brand-400/20 bg-brand-500/10 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-brand-100">Suggested Commit</p>
                      <pre className="code-block mt-3">{contributionDraft.commitMessage}</pre>
                      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-brand-100">Suggested PR Title</p>
                      <pre className="code-block mt-3">{contributionDraft.prTitle}</pre>
                      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-brand-100">Suggested PR Description</p>
                      <pre className="code-block mt-3">{contributionDraft.prDescription}</pre>
                    </div>
                  ) : null}

                  {activeGuide ? (
                    <div className="timeline-card mt-5">
                      <p className="text-sm text-secondary">
                        Branch <span className="font-semibold text-brand-200">{activeGuide.branch_name}</span>
                      </p>
                      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
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
                              event.target.value as
                                | "opened"
                                | "in_review"
                                | "changes_requested"
                                | "merged"
                                | "closed"
                            )
                          }
                          title="Pull request status"
                          aria-label="Pull request status"
                          className="ui-input"
                        >
                          <option value="opened">opened</option>
                          <option value="in_review">in_review</option>
                          <option value="changes_requested">changes_requested</option>
                          <option value="merged">merged</option>
                          <option value="closed">closed</option>
                        </select>
                      </div>
                      <button
                        className="ui-button mt-4"
                        type="button"
                        disabled={isSavingPr || !prUrl}
                        onClick={handleAttachPr}
                      >
                        {isSavingPr ? "Saving..." : "Attach Pull Request"}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-secondary">
                      Prepare the guide to generate a tracked branch name and save your pull request URL.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

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
                      <span
                        className={`status-chip border ${
                          item.is_expected_output_match === true
                            ? "status-pass"
                            : item.is_expected_output_match === false
                              ? "status-fail"
                              : "status-review"
                        }`}
                      >
                        {item.is_expected_output_match === null
                          ? "Expected N/A"
                          : item.is_expected_output_match
                            ? "Expected Match"
                            : "Expected Mismatch"}
                      </span>
                      {item.evaluation ? (
                        <span className={`status-chip border ${toStatusTone(item.evaluation.verdict)}`}>
                          AI {item.evaluation.verdict}
                        </span>
                      ) : null}
                    </div>
                    <p>Judge0: {item.judge0_status_description ?? "Unknown"}</p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-brand-300">Output details</summary>
                      <pre className="code-block">stdout: {item.stdout || "<none>"}</pre>
                      <pre className="code-block">stderr: {item.stderr || "<none>"}</pre>
                    </details>
                  </article>
                ))
              ) : (
                <p className="text-sm text-secondary">No submissions yet for this issue.</p>
              )}
            </div>
          </div>

          <div className="ui-card">
            <h4 className="text-lg font-semibold text-primary">Contribution History</h4>
            <div className="mt-3 space-y-2">
              {contributions.length ? (
                contributions.map((guide) => (
                  <article key={guide.id} className="surface-elevated rounded-xl p-3 text-sm text-secondary">
                    <div className="mb-1 flex flex-wrap gap-2">
                      <span className="status-chip status-review border">{new Date(guide.updated_at).toLocaleString()}</span>
                      <span className="status-chip status-review border">{guide.pr_status}</span>
                    </div>
                    <p>Branch: {guide.branch_name}</p>
                    <p>
                      PR: {guide.pr_url ? <a href={guide.pr_url}>{guide.pr_url}</a> : "Not attached"}
                    </p>
                  </article>
                ))
              ) : (
                <p className="text-sm text-secondary">No contribution records yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
