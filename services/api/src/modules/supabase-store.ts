import { randomUUID } from "crypto";

import type {
  ClassifiedIssue,
  Difficulty,
  ProgressTimelineItem,
  SimulationSessionRecord,
  UserProgressOverview
} from "@growthengine/shared";

import type { Judge0Result } from "../integrations/judge0";
import { supabase } from "../integrations/supabase";
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

const simulationSessions = new Map<string, SimulationSessionRecord>();

function db() {
  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }
  return supabase;
}

function normalizeOutput(text?: string | null): string {
  return (text ?? "").replace(/\s+$/g, "");
}

function throwIfError(error: { message: string } | null) {
  if (error) {
    if (error.message.includes("schema cache")) {
      throw new Error(
        `${error.message}. Supabase schema is out of date for this codebase. Apply supabase/schema.sql and retry ingestion.`
      );
    }

    throw new Error(error.message);
  }
}

async function upsertWithLegacyFallback<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  onConflict: string,
  legacyColumnsToDrop: string[]
) {
  const firstAttempt = await db().from(table).upsert(rows, { onConflict });
  if (!firstAttempt.error) {
    return;
  }

  const shouldRetry = legacyColumnsToDrop.some((column) =>
    firstAttempt.error?.message.includes(`'${column}'`)
  );

  if (!shouldRetry) {
    throwIfError(firstAttempt.error);
    return;
  }

  const fallbackRows = rows.map((row) => {
    const nextRow = { ...row };
    for (const column of legacyColumnsToDrop) {
      delete nextRow[column];
    }
    return nextRow;
  });

  const fallbackAttempt = await db().from(table).upsert(fallbackRows, { onConflict });
  throwIfError(fallbackAttempt.error);
}

function nowIso() {
  return new Date().toISOString();
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

function updateSession(sessionId: string, patch: Partial<SimulationSessionRecord>) {
  const current = simulationSessions.get(sessionId);
  if (!current) {
    return null;
  }

  const next = {
    ...current,
    ...patch,
    updatedAt: nowIso()
  };
  simulationSessions.set(sessionId, next);
  return next;
}

function baseDifficultyDistribution() {
  return {
    beginner: 0,
    intermediate: 0,
    advanced: 0
  } satisfies Record<Difficulty, number>;
}

export async function upsertIssues(nextIssues: ClassifiedIssueWithMetadata[]) {
  if (!nextIssues.length) {
    return;
  }

  const now = nowIso();
  const repositories = Array.from(new Set(nextIssues.map((issue) => issue.repositoryFullName))).map(
    (fullName) => ({
      full_name: fullName,
      html_url: `https://github.com/${fullName}`,
      updated_at: now
    })
  );

  const issueRows = nextIssues.map((issue) => ({
    id: issue.id,
    repository_full_name: issue.repositoryFullName,
    title: issue.title,
    body: issue.body,
    scenario_title: issue.scenarioTitle ?? null,
    scenario_body: issue.scenarioBody ?? null,
    learning_objectives: issue.learningObjectives ?? [],
    acceptance_criteria: issue.acceptanceCriteria ?? [],
    labels: issue.labels,
    issue_url: issue.url,
    state: "open",
    updated_at: now
  }));

  const classificationRows = nextIssues.map((issue) => ({
    issue_id: issue.id,
    difficulty: issue.difficulty,
    tech_stack: issue.techStack,
    confidence: issue.confidence,
    model_name: issue.modelName ?? "unknown-model",
    reasoning: issue.reasoning ?? null,
    updated_at: now
  }));

  await upsertWithLegacyFallback("repositories", repositories, "full_name", ["updated_at"]);
  await upsertWithLegacyFallback("issues", issueRows, "id", [
    "updated_at",
    "scenario_title",
    "scenario_body",
    "learning_objectives",
    "acceptance_criteria"
  ]);
  await upsertWithLegacyFallback("classifications", classificationRows, "issue_id", ["updated_at"]);
}

export async function listIssues(filters?: { difficulty?: string; stack?: string }) {
  let classificationQuery = db()
    .from("classifications")
    .select("issue_id, difficulty, tech_stack, confidence")
    .order("issue_id", { ascending: false });

  if (filters?.difficulty) {
    classificationQuery = classificationQuery.eq("difficulty", filters.difficulty);
  }

  if (filters?.stack) {
    classificationQuery = classificationQuery.contains("tech_stack", [filters.stack]);
  }

  const classificationsResult = await classificationQuery;
  throwIfError(classificationsResult.error);

  const classifications = classificationsResult.data ?? [];
  if (!classifications.length) {
    return [];
  }

  const issueIds = classifications.map((row) => row.issue_id);
  const issuesResult = await db()
    .from("issues")
    .select("id, repository_full_name, title, body, scenario_title, scenario_body, learning_objectives, acceptance_criteria, labels, issue_url")
    .in("id", issueIds);
  throwIfError(issuesResult.error);

  const issues = issuesResult.data ?? [];
  const issuesById = new Map(issues.map((issue) => [issue.id, issue]));

  return classifications
    .map((classification) => {
      const issue = issuesById.get(classification.issue_id);
      if (!issue) {
        return null;
      }

      const mappedIssue: ClassifiedIssue = {
        id: issue.id,
        repositoryFullName: issue.repository_full_name,
        title: issue.title,
        body: issue.body,
        scenarioTitle: issue.scenario_title ?? undefined,
        scenarioBody: issue.scenario_body ?? undefined,
        learningObjectives: issue.learning_objectives ?? [],
        acceptanceCriteria: issue.acceptance_criteria ?? [],
        labels: issue.labels,
        url: issue.issue_url,
        difficulty: classification.difficulty,
        techStack: classification.tech_stack,
        confidence: Number(classification.confidence)
      };

      return mappedIssue;
    })
    .filter((issue): issue is NonNullable<typeof issue> => Boolean(issue));
}

export async function getIssueById(id: number) {
  const issueResult = await db()
    .from("issues")
    .select("id, repository_full_name, title, body, scenario_title, scenario_body, learning_objectives, acceptance_criteria, labels, issue_url")
    .eq("id", id)
    .maybeSingle();
  throwIfError(issueResult.error);

  const classificationResult = await db()
    .from("classifications")
    .select("difficulty, tech_stack, confidence")
    .eq("issue_id", id)
    .maybeSingle();
  throwIfError(classificationResult.error);

  if (!issueResult.data || !classificationResult.data) {
    return null;
  }

  return {
    id: issueResult.data.id,
    repositoryFullName: issueResult.data.repository_full_name,
    title: issueResult.data.title,
    body: issueResult.data.body,
    scenarioTitle: issueResult.data.scenario_title ?? undefined,
    scenarioBody: issueResult.data.scenario_body ?? undefined,
    learningObjectives: issueResult.data.learning_objectives ?? [],
    acceptanceCriteria: issueResult.data.acceptance_criteria ?? [],
    labels: issueResult.data.labels,
    url: issueResult.data.issue_url,
    difficulty: classificationResult.data.difficulty,
    techStack: classificationResult.data.tech_stack,
    confidence: Number(classificationResult.data.confidence)
  } satisfies ClassifiedIssue;
}

export async function createSubmission(input: SubmissionInsert) {
  const created = await db()
    .from("submissions")
    .insert({
      issue_id: input.issueId ?? null,
      learning_path_id: input.learningPathId ?? null,
      learning_day_number: input.learningDayNumber ?? null,
      user_id: input.userId ?? "anonymous",
      language_id: input.languageId,
      source_code: input.sourceCode,
      stdin: input.stdin ?? null,
      expected_output: input.expectedOutput ?? null,
      status: "created",
      score: null
    })
    .select("id")
    .single();
  throwIfError(created.error);
  if (!created.data) {
    throw new Error("Submission insert returned no row");
  }
  return created.data.id as string;
}

export async function updateSubmissionExecution(
  submissionId: string,
  execution: Judge0Result,
  expectedOutput?: string
) {
  const stdout = execution.stdout ?? null;
  const isExpectedOutputMatch =
    typeof expectedOutput === "string"
      ? normalizeOutput(stdout) === normalizeOutput(expectedOutput)
      : null;

  throwIfError(
    (
      await db()
        .from("submissions")
        .update({
          stdout,
          stderr: execution.stderr,
          compile_output: execution.compile_output,
          judge0_status_id: execution.status.id,
          judge0_status_description: execution.status.description,
          is_expected_output_match: isExpectedOutputMatch,
          status: execution.status.description,
          updated_at: nowIso()
        })
        .eq("id", submissionId)
    ).error
  );

  return { isExpectedOutputMatch };
}

export async function getSubmissionById(submissionId: string) {
  const result = await db()
    .from("submissions")
    .select(
      "id, issue_id, learning_path_id, learning_day_number, user_id, language_id, source_code, stdin, expected_output, stdout, stderr, compile_output, is_expected_output_match, judge0_status_id, judge0_status_description, created_at"
    )
    .eq("id", submissionId)
    .maybeSingle();
  throwIfError(result.error);
  return result.data;
}

export async function listSubmissionHistory(issueId: number, userId: string, limit = 20) {
  const result = await db()
    .from("submissions")
    .select(
      "id, issue_id, learning_path_id, learning_day_number, user_id, language_id, source_code, stdin, expected_output, stdout, stderr, compile_output, is_expected_output_match, judge0_status_id, judge0_status_description, created_at"
    )
    .eq("issue_id", issueId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  throwIfError(result.error);

  const submissions = result.data ?? [];
  if (!submissions.length) {
    return [];
  }

  const submissionIds = submissions.map((submission) => submission.id);
  const evaluationsResult = await db()
    .from("evaluations")
    .select("id, submission_id, verdict, summary, confidence, model_name, created_at")
    .in("submission_id", submissionIds)
    .order("created_at", { ascending: false });
  throwIfError(evaluationsResult.error);

  const evaluations = evaluationsResult.data ?? [];
  const evaluationsBySubmissionId = new Map<string, (typeof evaluations)[number]>();

  for (const evaluation of evaluations) {
    if (!evaluationsBySubmissionId.has(evaluation.submission_id)) {
      evaluationsBySubmissionId.set(evaluation.submission_id, evaluation);
    }
  }

  return submissions.map((submission) => ({
    ...submission,
    evaluation: evaluationsBySubmissionId.get(submission.id) ?? null
  }));
}

export async function listAllSubmissionHistory(userId: string, limit = 100) {
  const result = await db()
    .from("submissions")
    .select(
      "id, issue_id, learning_path_id, learning_day_number, user_id, language_id, source_code, stdin, expected_output, stdout, stderr, compile_output, is_expected_output_match, judge0_status_id, judge0_status_description, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  throwIfError(result.error);

  const submissions = result.data ?? [];
  if (!submissions.length) {
    return [];
  }

  const submissionIds = submissions.map((submission) => submission.id);
  const evaluationsResult = await db()
    .from("evaluations")
    .select("id, submission_id, verdict, summary, confidence, model_name, created_at")
    .in("submission_id", submissionIds)
    .order("created_at", { ascending: false });
  throwIfError(evaluationsResult.error);

  const evaluations = evaluationsResult.data ?? [];
  const evaluationsBySubmissionId = new Map<string, (typeof evaluations)[number]>();

  for (const evaluation of evaluations) {
    if (!evaluationsBySubmissionId.has(evaluation.submission_id)) {
      evaluationsBySubmissionId.set(evaluation.submission_id, evaluation);
    }
  }

  return submissions.map((submission) => ({
    ...submission,
    evaluation: evaluationsBySubmissionId.get(submission.id) ?? null
  }));
}

export async function createEvaluation(submissionId: string, evaluation: EvaluationResult) {
  const result = await db()
    .from("evaluations")
    .insert({
      submission_id: submissionId,
      verdict: evaluation.verdict,
      summary: evaluation.summary,
      strengths: evaluation.strengths,
      risks: evaluation.risks,
      suggestions: evaluation.suggestions,
      confidence: evaluation.confidence,
      model_name: evaluation.modelName
    })
    .select("id")
    .single();
  throwIfError(result.error);
  if (!result.data) {
    throw new Error("Evaluation insert returned no row");
  }

  throwIfError(
    (
      await db()
        .from("submissions")
        .update({
          status: evaluation.correctness,
          score: evaluation.score,
          updated_at: nowIso()
        })
        .eq("id", submissionId)
    ).error
  );

  return result.data.id as string;
}

export async function getLatestEvaluationForIssue(userId: string, issueId: number) {
  const submissionsResult = await db()
    .from("submissions")
    .select("id")
    .eq("user_id", userId)
    .eq("issue_id", issueId);
  throwIfError(submissionsResult.error);

  const submissionIds = (submissionsResult.data ?? []).map((item) => item.id);
  if (!submissionIds.length) {
    return null;
  }

  const evaluationResult = await db()
    .from("evaluations")
    .select("id, submission_id, verdict, summary, strengths, risks, suggestions, confidence, model_name, created_at")
    .in("submission_id", submissionIds)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(evaluationResult.error);

  return evaluationResult.data ?? null;
}

export async function createContributionGuide(input: ContributionGuideInsert) {
  const result = await db()
    .from("contribution_guides")
    .insert({
      user_id: input.userId,
      issue_id: input.issueId,
      repository_full_name: input.repositoryFullName,
      issue_url: input.issueUrl,
      branch_name: input.branchName,
      pr_status: "draft"
    })
    .select("id, user_id, issue_id, repository_full_name, issue_url, branch_name, pr_url, pr_status, created_at, updated_at")
    .single();
  throwIfError(result.error);

  if (!result.data) {
    throw new Error("Contribution guide insert returned no row");
  }

  return result.data;
}

export async function updateContributionGuidePr(input: {
  guideId: string;
  userId: string;
  prUrl: string;
  prStatus: string;
}) {
  const result = await db()
    .from("contribution_guides")
    .update({
      pr_url: input.prUrl,
      pr_status: input.prStatus,
      updated_at: nowIso()
    })
    .eq("id", input.guideId)
    .eq("user_id", input.userId)
    .select("id, user_id, issue_id, repository_full_name, issue_url, branch_name, pr_url, pr_status, created_at, updated_at")
    .single();
  throwIfError(result.error);

  if (!result.data) {
    throw new Error("Contribution guide not found for user");
  }

  return result.data;
}

export async function listContributionGuides(userId: string, issueId?: number) {
  let query = db()
    .from("contribution_guides")
    .select("id, user_id, issue_id, repository_full_name, issue_url, branch_name, pr_url, pr_status, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (typeof issueId === "number") {
    query = query.eq("issue_id", issueId);
  }

  const result = await query;
  throwIfError(result.error);
  return result.data ?? [];
}

export async function startSimulationSession(input: { userId: string; issueId: number }) {
  const existing = findSession(undefined, input.userId, input.issueId);
  if (existing) {
    return existing;
  }

  const issue = await getIssueById(input.issueId);
  if (!issue) {
    throw new Error("Issue not found");
  }

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

  return updateSession(session.id, {
    latestSubmissionId: input.submissionId,
    totalAttempts: session.totalAttempts + 1,
    status: "in_progress"
  });
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
  return updateSession(session.id, {
    latestVerdict: input.verdict,
    contributionReady,
    status: contributionReady ? "ready_to_contribute" : "in_progress"
  });
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

  return updateSession(session.id, {
    contributionReady: true,
    status: input.completed ? "completed" : "ready_to_contribute"
  });
}

export async function getUserProgressOverview(userId: string): Promise<UserProgressOverview> {
  const sessionItems = [...simulationSessions.values()]
    .filter((session) => session.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const submissions = await listAllSubmissionHistory(userId, 200);
  const guides = await listContributionGuides(userId);

  const metrics = {
    problemsSolved: sessionItems.filter((session) => session.latestVerdict === "pass").length,
    totalAttempts: submissions.length,
    sessionsStarted: sessionItems.length,
    contributionReady: sessionItems.filter((session) => session.contributionReady).length,
    difficultyDistribution: baseDifficultyDistribution()
  };

  const issueSummaries = [];
  for (const session of sessionItems) {
    const issue = await getIssueById(session.issueId);
    if (!issue) {
      continue;
    }

    metrics.difficultyDistribution[issue.difficulty as Difficulty] += 1;
    issueSummaries.push({
      issueId: session.issueId,
      title: session.issueTitle,
      repositoryFullName: session.repositoryFullName,
      difficulty: issue.difficulty,
      attempts: session.totalAttempts,
      latestVerdict: session.latestVerdict ?? null,
      status: session.status,
      contributionReady: session.contributionReady,
      updatedAt: session.updatedAt
    });
  }

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

  for (const submission of submissions) {
    if (!submission.issue_id) {
      continue;
    }
    const issue = await getIssueById(submission.issue_id);
    if (!issue) {
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
    if (!guide.issue_id) {
      continue;
    }
    const issue = await getIssueById(guide.issue_id);
    if (!issue) {
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

  timeline.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  issueSummaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    metrics,
    issueSummaries,
    timeline: timeline.slice(0, 120)
  };
}

export async function ensureGrowthPathCatalog(paths: Array<{
  id: string;
  totalDays: number;
  title?: string;
  skill?: string;
  description?: string;
  levelLabel?: string;
  estimatedMinutesPerDay?: number;
  tags?: string[];
  adaptive?: boolean;
  overview?: string;
  phases?: unknown;
  days: Array<{
    dayNumber: number;
    topic?: string;
    title?: string;
    explanation?: string;
    task?: string;
    stretchGoal?: string | null;
    hints?: string[];
    languageId?: number;
    techStack?: string[];
    expectedOutput?: string | null;
    starterCode?: string;
    difficulty?: string;
  }>;
}>) {
  for (const path of paths) {
    const pathResult = await db().from("learning_paths").upsert({
      id: path.id,
      skill: path.skill ?? path.id,
      title: path.title ?? path.id,
      description: path.description ?? "",
      level_label: path.levelLabel ?? "Beginner to advanced",
      total_days: path.totalDays,
      estimated_minutes_per_day: path.estimatedMinutesPerDay ?? 45,
      tags: path.tags ?? [],
      adaptive: path.adaptive ?? true,
      overview: path.overview ?? "",
      phases: path.phases ?? []
    }, { onConflict: "id" });
    throwIfError(pathResult.error);

    const dayRows = path.days.map((day) => ({
      path_id: path.id,
      day_number: day.dayNumber,
      topic: day.topic ?? "",
      title: day.title ?? "",
      explanation: day.explanation ?? "",
      task: day.task ?? "",
      stretch_goal: day.stretchGoal ?? null,
      hints: day.hints ?? [],
      language_id: day.languageId ?? 71,
      tech_stack: day.techStack ?? [],
      expected_output: day.expectedOutput ?? null,
      starter_code: day.starterCode ?? "",
      difficulty: day.difficulty ?? "foundation"
    }));

    const dayResult = await db().from("learning_days").upsert(dayRows, { onConflict: "path_id,day_number" });
    throwIfError(dayResult.error);
  }
}

export async function listGrowthPathProgress(userId: string, pathId: string) {
  const pathResult = await db().from("learning_paths").select("total_days").eq("id", pathId).maybeSingle();
  throwIfError(pathResult.error);
  const totalDays = pathResult.data?.total_days ?? 0;

  const progressResult = await db()
    .from("user_progress")
    .select("day_number, status, attempts, score, verdict, completed_at, latest_submission_id")
    .eq("user_id", userId)
    .eq("path_id", pathId)
    .order("day_number", { ascending: true });
  throwIfError(progressResult.error);

  const progressByDay = new Map((progressResult.data ?? []).map((item) => [item.day_number, item]));

  return Array.from({ length: totalDays }, (_, index) => {
    const dayNumber = index + 1;
    const current = progressByDay.get(dayNumber);
    return {
      pathId,
      dayNumber,
      status: current?.status ?? "available",
      attempts: current?.attempts ?? 0,
      score: current?.score ?? null,
      verdict: current?.verdict ?? null,
      completedAt: current?.completed_at ?? null,
      submissionId: current?.latest_submission_id ?? null
    };
  });
}

export async function getGrowthPathDayProgress(userId: string, pathId: string, dayNumber: number) {
  const result = await db()
    .from("user_progress")
    .select("status, attempts, score, verdict, completed_at, latest_submission_id")
    .eq("user_id", userId)
    .eq("path_id", pathId)
    .eq("day_number", dayNumber)
    .maybeSingle();
  throwIfError(result.error);

  if (!result.data) {
    return null;
  }

  return {
    pathId,
    dayNumber,
    status: result.data.status,
    attempts: result.data.attempts,
    score: result.data.score,
    verdict: result.data.verdict,
    completedAt: result.data.completed_at ?? null,
    submissionId: result.data.latest_submission_id ?? null
  };
}

export async function updateGrowthPathProgressAfterExecution(input: {
  userId: string;
  pathId: string;
  dayNumber: number;
  submissionId: string;
}) {
  const current = await getGrowthPathDayProgress(input.userId, input.pathId, input.dayNumber);
  const nextAttempts = (current?.attempts ?? 0) + 1;
  const result = await db()
    .from("user_progress")
    .upsert({
      user_id: input.userId,
      path_id: input.pathId,
      day_number: input.dayNumber,
      status: current?.status === "completed" ? "completed" : "in_review",
      attempts: nextAttempts,
      score: current?.score ?? null,
      verdict: current?.verdict ?? null,
      latest_submission_id: input.submissionId,
      completed_at: current?.completedAt ?? null,
      updated_at: nowIso()
    }, { onConflict: "user_id,path_id,day_number" })
    .select("status, attempts, score, verdict, completed_at, latest_submission_id")
    .single();
  throwIfError(result.error);
  if (!result.data) {
    throw new Error("Failed to persist growth path execution progress");
  }

  return {
    pathId: input.pathId,
    dayNumber: input.dayNumber,
    status: result.data.status,
    attempts: result.data.attempts,
    score: result.data.score,
    verdict: result.data.verdict,
    completedAt: result.data.completed_at ?? null,
    submissionId: result.data.latest_submission_id ?? null
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
  const current = await getGrowthPathDayProgress(input.userId, input.pathId, input.dayNumber);
  const completedAt = input.verdict === "pass" ? nowIso() : current?.completedAt ?? null;
  const result = await db()
    .from("user_progress")
    .upsert({
      user_id: input.userId,
      path_id: input.pathId,
      day_number: input.dayNumber,
      status: input.verdict === "pass" ? "completed" : "in_review",
      attempts: current?.attempts ?? 0,
      score: input.score,
      verdict: input.verdict,
      latest_submission_id: input.submissionId,
      completed_at: completedAt,
      updated_at: nowIso()
    }, { onConflict: "user_id,path_id,day_number" })
    .select("status, attempts, score, verdict, completed_at, latest_submission_id")
    .single();
  throwIfError(result.error);
  if (!result.data) {
    throw new Error("Failed to persist growth path evaluation progress");
  }

  return {
    pathId: input.pathId,
    dayNumber: input.dayNumber,
    status: result.data.status,
    attempts: result.data.attempts,
    score: result.data.score,
    verdict: result.data.verdict,
    completedAt: result.data.completed_at ?? null,
    submissionId: result.data.latest_submission_id ?? null
  };
}
