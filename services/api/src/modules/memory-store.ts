import { randomUUID } from "crypto";

import type {
  ClassifiedIssue,
  Difficulty,
  ProgressTimelineItem,
  SimulationSessionRecord,
  UserProgressOverview
} from "@growthengine/shared";

import type { Judge0Result } from "../integrations/judge0";
import type { ClassifiedIssueWithMetadata } from "./classifier";
import type { EvaluationResult } from "./evaluator";

type SubmissionInsert = {
  issueId?: number;
  userId?: string;
  languageId: number;
  sourceCode: string;
  stdin?: string;
  expectedOutput?: string;
  simulationSessionId?: string;
  learningPathId?: string;
  learningDayNumber?: number;
};

type ContributionGuideInsert = {
  userId: string;
  issueId: number;
  repositoryFullName: string;
  issueUrl: string;
  branchName: string;
};

type EvaluationSummary = {
  id: string;
  submission_id: string;
  verdict: "pass" | "fail" | "review";
  summary: string;
  confidence: number | null;
  model_name: string;
  created_at: string;
};

type EvaluationRecord = EvaluationSummary & {
  strengths: string[];
  risks: string[];
  suggestions: string[];
};

type SubmissionRecord = {
  id: string;
  issue_id: number | null;
  learning_path_id?: string | null;
  learning_day_number?: number | null;
  user_id: string;
  language_id: number;
  source_code: string;
  stdin: string | null;
  expected_output: string | null;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  is_expected_output_match: boolean | null;
  judge0_status_id: number | null;
  judge0_status_description: string | null;
  status: string | null;
  score: number | null;
  created_at: string;
  updated_at: string;
  simulation_session_id: string | null;
};

type ContributionGuideRecord = {
  id: string;
  user_id: string;
  issue_id: number | null;
  repository_full_name: string;
  issue_url: string;
  branch_name: string;
  pr_url: string | null;
  pr_status: string;
  created_at: string;
  updated_at: string;
};

const repositories = new Map<string, { fullName: string; htmlUrl: string; updatedAt: string }>();
const issues = new Map<number, ClassifiedIssueWithMetadata>();
const submissions = new Map<string, SubmissionRecord>();
const evaluations = new Map<string, EvaluationRecord>();
const contributionGuides = new Map<string, ContributionGuideRecord>();
const simulationSessions = new Map<string, SimulationSessionRecord>();
const growthPathCatalog = new Map<string, { id: string; totalDays: number }>();
const growthPathDays = new Map<string, Set<number>>();
const growthPathProgress = new Map<string, {
  userId: string;
  pathId: string;
  dayNumber: number;
  status: "locked" | "available" | "in_review" | "completed";
  attempts: number;
  score: number | null;
  verdict: "pass" | "fail" | "review" | null;
  completedAt: string | null;
  submissionId: string | null;
}>();

function nowIso() {
  return new Date().toISOString();
}

function normalizeOutput(text?: string | null): string {
  return (text ?? "").replace(/\s+$/g, "");
}

function toDifficultyDistribution() {
  return {
    beginner: 0,
    intermediate: 0,
    advanced: 0
  } satisfies Record<Difficulty, number>;
}

function sortNewest<T>(items: T[]) {
  return [...items].sort((a, b) => {
    const left = (a as any).updatedAt ?? (a as any).updated_at ?? (a as any).createdAt ?? (a as any).created_at ?? "";
    const right = (b as any).updatedAt ?? (b as any).updated_at ?? (b as any).createdAt ?? (b as any).created_at ?? "";
    return right.localeCompare(left);
  });
}

function getIssueOrThrow(issueId: number) {
  const issue = issues.get(issueId);
  if (!issue) {
    throw new Error("Issue not found");
  }
  return issue;
}

function markSimulationStatus(sessionId: string, patch: Partial<SimulationSessionRecord>) {
  const current = simulationSessions.get(sessionId);
  if (!current) {
    return;
  }

  simulationSessions.set(sessionId, {
    ...current,
    ...patch,
    updatedAt: nowIso()
  });
}

function findSession(sessionId?: string, userId?: string, issueId?: number) {
  if (sessionId) {
    return simulationSessions.get(sessionId) ?? null;
  }

  const match = [...simulationSessions.values()].find(
    (session) => session.userId === userId && session.issueId === issueId
  );
  return match ?? null;
}

export async function upsertIssues(nextIssues: ClassifiedIssueWithMetadata[]) {
  const now = nowIso();

  for (const issue of nextIssues) {
    repositories.set(issue.repositoryFullName, {
      fullName: issue.repositoryFullName,
      htmlUrl: `https://github.com/${issue.repositoryFullName}`,
      updatedAt: now
    });
    issues.set(issue.id, {
      ...issue,
      modelName: issue.modelName ?? "unknown-model",
      reasoning: issue.reasoning ?? undefined
    });
  }
}

export async function listIssues(filters?: { difficulty?: string; stack?: string }) {
  return sortNewest([...issues.values()])
    .filter((issue) => (filters?.difficulty ? issue.difficulty === filters.difficulty : true))
    .filter((issue) => (filters?.stack ? issue.techStack.includes(filters.stack as any) : true))
    .map((issue) => ({ ...issue } satisfies ClassifiedIssue));
}

export async function getIssueById(id: number) {
  return issues.get(id) ?? null;
}

export async function createSubmission(input: SubmissionInsert) {
  const submissionId = randomUUID();
  const createdAt = nowIso();
  submissions.set(submissionId, {
    id: submissionId,
    issue_id: input.issueId ?? null,
    learning_path_id: input.learningPathId ?? null,
    learning_day_number: input.learningDayNumber ?? null,
    user_id: input.userId ?? "anonymous",
    language_id: input.languageId,
    source_code: input.sourceCode,
    stdin: input.stdin ?? null,
    expected_output: input.expectedOutput ?? null,
    stdout: null,
    stderr: null,
    compile_output: null,
    is_expected_output_match: null,
    judge0_status_id: null,
    judge0_status_description: null,
    status: "created",
    score: null,
    created_at: createdAt,
    updated_at: createdAt,
    simulation_session_id: input.simulationSessionId ?? null
  });
  return submissionId;
}

export async function updateSubmissionExecution(
  submissionId: string,
  execution: Judge0Result,
  expectedOutput?: string
) {
  const submission = submissions.get(submissionId);
  if (!submission) {
    throw new Error("Submission not found");
  }

  const stdout = execution.stdout ?? null;
  const isExpectedOutputMatch =
    typeof expectedOutput === "string"
      ? normalizeOutput(stdout) === normalizeOutput(expectedOutput)
      : null;

  submissions.set(submissionId, {
    ...submission,
    stdout,
    stderr: execution.stderr,
    compile_output: execution.compile_output,
    judge0_status_id: execution.status.id,
    judge0_status_description: execution.status.description,
    is_expected_output_match: isExpectedOutputMatch,
    status: execution.status.description,
    updated_at: nowIso()
  });

  return { isExpectedOutputMatch };
}

export async function getSubmissionById(submissionId: string) {
  return submissions.get(submissionId) ?? null;
}

export async function listSubmissionHistory(issueId: number, userId: string, limit = 20) {
  const items = sortNewest(
    [...submissions.values()].filter((submission) => submission.issue_id === issueId && submission.user_id === userId)
  ).slice(0, limit);

  return items.map((submission) => ({
    ...submission,
    evaluation:
      sortNewest(
        [...evaluations.values()].filter((evaluation) => evaluation.submission_id === submission.id)
      )[0] ?? null
  }));
}

export async function listAllSubmissionHistory(userId: string, limit = 100) {
  const items = sortNewest(
    [...submissions.values()].filter((submission) => submission.user_id === userId)
  ).slice(0, limit);

  return items.map((submission) => ({
    ...submission,
    evaluation:
      sortNewest(
        [...evaluations.values()].filter((evaluation) => evaluation.submission_id === submission.id)
      )[0] ?? null
  }));
}

export async function createEvaluation(submissionId: string, evaluation: EvaluationResult) {
  const id = randomUUID();
  const submission = submissions.get(submissionId);
  evaluations.set(id, {
    id,
    submission_id: submissionId,
    verdict: evaluation.verdict,
    summary: evaluation.summary,
    strengths: evaluation.strengths,
    risks: evaluation.risks,
    suggestions: evaluation.suggestions,
    confidence: evaluation.confidence,
    model_name: evaluation.modelName,
    created_at: nowIso()
  });

  if (submission) {
    submissions.set(submissionId, {
      ...submission,
      status: evaluation.correctness,
      score: evaluation.score,
      updated_at: nowIso()
    });
  }
  return id;
}

export async function getLatestEvaluationForIssue(userId: string, issueId: number) {
  const issueSubmissionIds = [...submissions.values()]
    .filter((submission) => submission.user_id === userId && submission.issue_id === issueId)
    .map((submission) => submission.id);

  return (
    sortNewest(
      [...evaluations.values()].filter((evaluation) => issueSubmissionIds.includes(evaluation.submission_id))
    )[0] ?? null
  );
}

export async function createContributionGuide(input: ContributionGuideInsert) {
  const id = randomUUID();
  const createdAt = nowIso();
  const record: ContributionGuideRecord = {
    id,
    user_id: input.userId,
    issue_id: input.issueId,
    repository_full_name: input.repositoryFullName,
    issue_url: input.issueUrl,
    branch_name: input.branchName,
    pr_url: null,
    pr_status: "draft",
    created_at: createdAt,
    updated_at: createdAt
  };
  contributionGuides.set(id, record);
  return record;
}

export async function updateContributionGuidePr(input: {
  guideId: string;
  userId: string;
  prUrl: string;
  prStatus: string;
}) {
  const current = contributionGuides.get(input.guideId);
  if (!current || current.user_id !== input.userId) {
    throw new Error("Contribution guide not found for user");
  }

  const updated = {
    ...current,
    pr_url: input.prUrl,
    pr_status: input.prStatus,
    updated_at: nowIso()
  };
  contributionGuides.set(input.guideId, updated);
  return updated;
}

export async function listContributionGuides(userId: string, issueId?: number) {
  return sortNewest(
    [...contributionGuides.values()].filter(
      (guide) => guide.user_id === userId && (typeof issueId === "number" ? guide.issue_id === issueId : true)
    )
  );
}

export async function startSimulationSession(input: { userId: string; issueId: number }) {
  const existing = findSession(undefined, input.userId, input.issueId);
  if (existing) {
    return existing;
  }

  const issue = getIssueOrThrow(input.issueId);
  const createdAt = nowIso();
  const session: SimulationSessionRecord = {
    id: randomUUID(),
    userId: input.userId,
    issueId: input.issueId,
    repositoryFullName: issue.repositoryFullName,
    issueTitle: issue.title,
    status: "in_progress",
    startedAt: createdAt,
    updatedAt: createdAt,
    totalAttempts: 0,
    latestSubmissionId: null,
    latestVerdict: null,
    contributionReady: false
  };

  simulationSessions.set(session.id, session);
  return session;
}

export async function getSimulationSession(userId: string, issueId: number) {
  return findSession(undefined, userId, issueId);
}

export async function updateSimulationSessionAfterExecution(input: {
  sessionId?: string;
  userId: string;
  issueId: number;
  submissionId: string;
}) {
  const session = findSession(input.sessionId, input.userId, input.issueId);
  if (!session) {
    return null;
  }

  markSimulationStatus(session.id, {
    latestSubmissionId: input.submissionId,
    totalAttempts: session.totalAttempts + 1,
    status: "in_progress"
  });

  return simulationSessions.get(session.id) ?? null;
}

export async function updateSimulationSessionAfterEvaluation(input: {
  sessionId?: string;
  userId: string;
  issueId: number;
  verdict: "pass" | "fail" | "review";
}) {
  const session = findSession(input.sessionId, input.userId, input.issueId);
  if (!session) {
    return null;
  }

  const contributionReady = input.verdict === "pass" || input.verdict === "review";
  markSimulationStatus(session.id, {
    latestVerdict: input.verdict,
    contributionReady,
    status: contributionReady ? "ready_to_contribute" : "in_progress"
  });

  return simulationSessions.get(session.id) ?? null;
}

export async function markSimulationContributionReady(input: {
  sessionId?: string;
  userId: string;
  issueId: number;
  completed?: boolean;
}) {
  const session = findSession(input.sessionId, input.userId, input.issueId);
  if (!session) {
    return null;
  }

  markSimulationStatus(session.id, {
    contributionReady: true,
    status: input.completed ? "completed" : "ready_to_contribute"
  });
  return simulationSessions.get(session.id) ?? null;
}

export async function getUserProgressOverview(userId: string): Promise<UserProgressOverview> {
  const sessionItems = sortNewest(
    [...simulationSessions.values()].filter((session) => session.userId === userId)
  );
  const userSubmissions = await listAllSubmissionHistory(userId, 200);
  const guides = await listContributionGuides(userId);

  const metrics = {
    problemsSolved: sessionItems.filter((session) => session.latestVerdict === "pass").length,
    totalAttempts: userSubmissions.length,
    sessionsStarted: sessionItems.length,
    contributionReady: sessionItems.filter((session) => session.contributionReady).length,
    difficultyDistribution: toDifficultyDistribution()
  };

  for (const session of sessionItems) {
    const issue = issues.get(session.issueId);
    if (issue) {
      metrics.difficultyDistribution[issue.difficulty] += 1;
    }
  }

  const issueSummaries = sessionItems.map((session) => {
    const issue = getIssueOrThrow(session.issueId);

    return {
      issueId: session.issueId,
      title: session.issueTitle,
      repositoryFullName: session.repositoryFullName,
      difficulty: issue.difficulty,
      attempts: session.totalAttempts,
      latestVerdict: session.latestVerdict ?? null,
      status: session.status,
      contributionReady: session.contributionReady,
      updatedAt: session.updatedAt
    };
  });

  const timeline: ProgressTimelineItem[] = [];

  for (const session of sessionItems) {
    timeline.push({
      id: `session-${session.id}`,
      type: "simulation_started",
      issueId: session.issueId,
      issueTitle: session.issueTitle,
      repositoryFullName: session.repositoryFullName,
      createdAt: session.startedAt,
      status: session.status,
      summary: `Simulation started with status ${session.status.replace(/_/g, " ")}.`
    });
  }

  for (const submission of userSubmissions) {
    const issue = submission.issue_id ? issues.get(submission.issue_id) : null;
    if (!issue || !submission.issue_id) {
      continue;
    }

    timeline.push({
      id: `submission-${submission.id}`,
      type: "submission",
      issueId: submission.issue_id,
      issueTitle: issue.title,
      repositoryFullName: issue.repositoryFullName,
      createdAt: submission.created_at,
      status: submission.judge0_status_description ?? "submitted",
      summary: `Code executed with status ${submission.judge0_status_description ?? "submitted"}.`
    });

    if (submission.evaluation) {
      timeline.push({
        id: `evaluation-${submission.evaluation.id}`,
        type: "evaluation",
        issueId: submission.issue_id,
        issueTitle: issue.title,
        repositoryFullName: issue.repositoryFullName,
        createdAt: submission.evaluation.created_at,
        status: submission.evaluation.verdict,
        summary: submission.evaluation.summary
      });
    }
  }

  for (const guide of guides) {
    const issue = guide.issue_id ? issues.get(guide.issue_id) : null;
    if (!issue || !guide.issue_id) {
      continue;
    }

    timeline.push({
      id: `contribution-${guide.id}`,
      type: "contribution",
      issueId: guide.issue_id,
      issueTitle: issue.title,
      repositoryFullName: guide.repository_full_name,
      createdAt: guide.updated_at,
      status: guide.pr_status,
      summary: guide.pr_url ? `Pull request tracked: ${guide.pr_status}.` : "Contribution guide prepared."
    });
  }

  return {
    metrics,
    issueSummaries: sortNewest(issueSummaries),
    timeline: sortNewest(timeline).slice(0, 120)
  };
}

export async function ensureGrowthPathCatalog(paths: Array<{
  id: string;
  totalDays: number;
  days: Array<number | { dayNumber: number }>;
}>) {
  for (const path of paths) {
    growthPathCatalog.set(path.id, { id: path.id, totalDays: path.totalDays });
    growthPathDays.set(
      path.id,
      new Set(path.days.map((day) => (typeof day === "number" ? day : day.dayNumber)))
    );
  }
}

function baseGrowthPathRow(userId: string, pathId: string, dayNumber: number) {
  return {
    userId,
    pathId,
    dayNumber,
    status: "available" as const,
    attempts: 0,
    score: null,
    verdict: null,
    completedAt: null,
    submissionId: null
  };
}

export async function listGrowthPathProgress(userId: string, pathId: string) {
  const catalog = growthPathCatalog.get(pathId);
  const totalDays = catalog?.totalDays ?? 0;

  const rows = Array.from({ length: totalDays }, (_, index) => {
    const dayNumber = index + 1;
    const key = `${userId}:${pathId}:${dayNumber}`;
    const current = growthPathProgress.get(key) ?? baseGrowthPathRow(userId, pathId, dayNumber);
    return {
      pathId,
      dayNumber,
      status: current.status,
      attempts: current.attempts,
      score: current.score,
      verdict: current.verdict,
      completedAt: current.completedAt,
      submissionId: current.submissionId
    };
  });

  return rows;
}

export async function getGrowthPathDayProgress(userId: string, pathId: string, dayNumber: number) {
  const key = `${userId}:${pathId}:${dayNumber}`;
  const current = growthPathProgress.get(key);
  if (!current) {
    return null;
  }

  return {
    pathId,
    dayNumber,
    status: current.status,
    attempts: current.attempts,
    score: current.score,
    verdict: current.verdict,
    completedAt: current.completedAt,
    submissionId: current.submissionId
  };
}

export async function updateGrowthPathProgressAfterExecution(input: {
  userId: string;
  pathId: string;
  dayNumber: number;
  submissionId: string;
}) {
  const key = `${input.userId}:${input.pathId}:${input.dayNumber}`;
  const current = growthPathProgress.get(key) ?? baseGrowthPathRow(input.userId, input.pathId, input.dayNumber);
  const nextStatus: "completed" | "in_review" = current.status === "completed" ? "completed" : "in_review";
  const next = {
    ...current,
    attempts: current.attempts + 1,
    status: nextStatus,
    submissionId: input.submissionId
  };
  growthPathProgress.set(key, next);
  return {
    pathId: input.pathId,
    dayNumber: input.dayNumber,
    status: next.status,
    attempts: next.attempts,
    score: next.score,
    verdict: next.verdict,
    completedAt: next.completedAt,
    submissionId: next.submissionId
  };
}

export async function updateGrowthPathProgressAfterEvaluation(input: {
  userId: string;
  pathId: string;
  dayNumber: number;
  submissionId: string;
  verdict: "pass" | "fail" | "review";
  score: number;
}) {
  const key = `${input.userId}:${input.pathId}:${input.dayNumber}`;
  const current = growthPathProgress.get(key) ?? baseGrowthPathRow(input.userId, input.pathId, input.dayNumber);
  const completed = input.verdict === "pass";
  const nextStatus: "completed" | "in_review" = completed ? "completed" : "in_review";
  const next = {
    ...current,
    status: nextStatus,
    score: input.score,
    verdict: input.verdict,
    completedAt: completed ? nowIso() : current.completedAt,
    submissionId: input.submissionId
  };
  growthPathProgress.set(key, next);
  return {
    pathId: input.pathId,
    dayNumber: input.dayNumber,
    status: next.status,
    attempts: next.attempts,
    score: next.score,
    verdict: next.verdict,
    completedAt: next.completedAt,
    submissionId: next.submissionId
  };
}
