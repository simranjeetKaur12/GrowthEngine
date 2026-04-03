"use client";

import { ArrowRight, CheckCircle2, Lightbulb, RotateCcw, TerminalSquare } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { DashboardShell } from "../../../../../components/dashboard-shell";
import { useTheme } from "../../../../../components/theme-provider";
import {
  executeGrowthPathDay,
  fetchGrowthPathDay,
  submitGrowthPathDay
} from "../../../../../lib/api";
import { supabaseBrowser } from "../../../../../lib/supabase-browser";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function GrowthPathDayPage({ params }: { params: { pathId: string; dayNumber: string } }) {
  const dayNumber = Number(params.dayNumber);
  const { mounted, theme } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchGrowthPathDay>> | null>(null);
  const [sourceCode, setSourceCode] = useState("");
  const [stdin, setStdin] = useState("");
  const [execution, setExecution] = useState<Awaited<ReturnType<typeof executeGrowthPathDay>> | null>(null);
  const [evaluation, setEvaluation] = useState<Awaited<ReturnType<typeof submitGrowthPathDay>>["evaluation"] | null>(null);
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mountedState = true;
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!mountedState) return;
      setSession(data.session ?? null);
    });

    const { data } = supabaseBrowser.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mountedState = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!Number.isFinite(dayNumber)) {
      return;
    }

    fetchGrowthPathDay(params.pathId, dayNumber, session?.access_token)
      .then((result) => {
        setDetail(result);
        setSourceCode(result.day.starterCode);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "Failed to load learning day");
      });
  }, [dayNumber, params.pathId, session?.access_token]);

  const nextDayHref = useMemo(() => {
    if (!detail) return `/growth-paths/${params.pathId}`;
    const nextDay = Math.min(dayNumber + 1, detail.path.totalDays);
    return `/growth-paths/${params.pathId}/days/${nextDay}`;
  }, [dayNumber, detail, params.pathId]);

  async function handleRun() {
    if (!detail) return;
    setRunning(true);
    setMessage("Running daily task...");
    try {
      const result = await executeGrowthPathDay({
        accessToken: session?.access_token,
        pathId: params.pathId,
        dayNumber,
        languageId: detail.day.languageId,
        sourceCode,
        stdin,
        expectedOutput: detail.day.expectedOutput ?? undefined
      });
      setExecution(result);
      setMessage("Execution completed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to execute day");
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit() {
    if (!execution?.submissionId) {
      setMessage("Run the day first so we can evaluate your code.");
      return;
    }

    setSubmitting(true);
    setMessage("Requesting AI feedback...");
    try {
      const result = await submitGrowthPathDay({
        accessToken: session?.access_token,
        pathId: params.pathId,
        dayNumber,
        submissionId: execution.submissionId
      });
      setEvaluation(result.evaluation);
      setMessage(result.progress.status === "completed" ? "Day completed." : "Feedback returned. Iterate once more to complete the day.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to submit day");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell
      title={detail ? `Day ${detail.day.dayNumber}: ${detail.day.title}` : "GrowthPath Day"}
      subtitle="Daily implementation practice with execution, AI review, and progress tracking"
      rightSlot={
        <div className="flex flex-wrap gap-2">
          <Link href={`/growth-paths/${params.pathId}`} className="ui-button-muted">
            Back to roadmap
          </Link>
          {detail ? <span className="badge status-review border">{detail.progressOverview.recommendedIntensity}</span> : null}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.42fr_0.58fr]">
        <div className="space-y-6">
          <section className="workspace-card">
            <p className="text-xs uppercase tracking-[0.22em] text-brand-300">{detail?.path.title ?? "GrowthPath"}</p>
            <h3 className="mt-3 text-2xl font-semibold text-primary">{detail?.day.topic ?? "Loading day..."}</h3>
            <p className="mt-3 text-sm leading-7 text-secondary">{detail?.day.explanation}</p>

            <div className="timeline-card mt-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Hands-on task</p>
              <p className="mt-3 text-sm leading-7 text-secondary">{detail?.day.task}</p>
            </div>

            {detail?.day.stretchGoal ? (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-100">Stretch Goal</p>
                <p className="mt-2 text-sm leading-6 text-primary">{detail.day.stretchGoal}</p>
              </div>
            ) : null}

            {detail?.day.hints.length ? (
              <div className="mt-5">
                <div className="mb-3 flex items-center gap-2 text-primary">
                  <Lightbulb size={18} className="text-brand-200" />
                  <h4 className="text-base font-semibold">Hints</h4>
                </div>
                <div className="space-y-3">
                  {detail.day.hints.map((hint) => (
                    <div key={hint} className="step-item">
                      <span className="step-index">+</span>
                      <span>{hint}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="workspace-card">
            <h4 className="text-lg font-semibold text-primary">Progress snapshot</h4>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="metric-card">
                <p className="text-xs uppercase tracking-wide text-muted">Completed days</p>
                <p className="metric-value">{detail?.progressOverview.completedDays ?? 0}</p>
              </div>
              <div className="metric-card">
                <p className="text-xs uppercase tracking-wide text-muted">Current score</p>
                <p className="metric-value">{detail?.progress?.score ?? "--"}</p>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="workspace-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-lg font-semibold text-primary">Implementation Workspace</h4>
              <span className="badge status-review border">
                {detail?.progress?.status ?? "available"}
              </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
              <MonacoEditor
                height="420px"
                language={detail?.day.languageId === 63 ? "javascript" : "python"}
                theme={mounted && theme === "light" ? "light" : "vs-dark"}
                value={sourceCode}
                onChange={(value) => setSourceCode(value ?? "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineHeight: 22,
                  automaticLayout: true,
                  smoothScrolling: true
                }}
              />
            </div>

            <label className="mt-4 grid gap-2 text-xs uppercase tracking-wider text-secondary">
              Standard Input
              <textarea className="ui-input" rows={4} value={stdin} onChange={(event) => setStdin(event.target.value)} />
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button className="ui-button" type="button" onClick={handleRun} disabled={running || !sourceCode.trim()}>
                {running ? "Running..." : "Run Code"}
              </button>
              <button className="ui-button-muted" type="button" onClick={handleSubmit} disabled={submitting || !execution?.submissionId}>
                {submitting ? "Submitting..." : "Submit Day"}
              </button>
              <button className="ui-button-muted" type="button" onClick={() => setSourceCode(detail?.day.starterCode ?? "")}>
                <RotateCcw size={18} />
                Reset Code
              </button>
              {message ? <span className="text-sm text-brand-200">{message}</span> : null}
            </div>
          </section>

          {execution ? (
            <section className="workspace-card">
              <div className="flex items-center gap-2 text-primary">
                <TerminalSquare size={18} className="text-brand-200" />
                <h4 className="text-lg font-semibold">Console Output</h4>
              </div>
              <pre className="code-block mt-4">{execution.stdout || execution.stderr || execution.compile_output || "<no output>"}</pre>
            </section>
          ) : null}

          {evaluation ? (
            <section className="workspace-card">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 size={18} className="text-brand-200" />
                <h4 className="text-lg font-semibold">AI Feedback</h4>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Summary</p>
                <p className="mt-2 text-sm leading-6 text-secondary">{evaluation.summary}</p>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="surface-elevated p-4">
                  <p className="text-xs uppercase tracking-wide text-muted">Bugs</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-secondary">
                    {evaluation.bugs.length ? evaluation.bugs.map((item) => <li key={item}>{item}</li>) : <li>No major bugs detected.</li>}
                  </ul>
                </div>
                <div className="surface-elevated p-4">
                  <p className="text-xs uppercase tracking-wide text-muted">Improvements</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-secondary">
                    {evaluation.improvements.length ? evaluation.improvements.map((item) => <li key={item}>{item}</li>) : <li>No major improvements suggested.</li>}
                  </ul>
                </div>
                <div className="surface-elevated p-4">
                  <p className="text-xs uppercase tracking-wide text-muted">Optimization</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-secondary">
                    {evaluation.optimization.length ? evaluation.optimization.map((item) => <li key={item}>{item}</li>) : <li>No optimization notes yet.</li>}
                  </ul>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <span className="badge status-review border">Score {evaluation.score}</span>
                  <span className={`badge border ${evaluation.verdict === "pass" ? "status-pass" : evaluation.verdict === "fail" ? "status-fail" : "status-review"}`}>
                    {evaluation.verdict}
                  </span>
                </div>
                <Link href={nextDayHref} className="ui-button">
                  Continue forward
                  <ArrowRight size={18} />
                </Link>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}
