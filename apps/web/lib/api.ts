import type {
  ClassifiedIssue,
  DiscoveredProblem,
  GrowthPathProgress,
  LearningDayDetail,
  LearningPathDetail,
  LearningPathSummary,
  UserSettings,
  SimulationSessionRecord,
  UserStats,
  UserProgressOverview
} from "@growthengine/shared";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const demoUserId = "demo-user";

function getAuthHeaders(accessToken?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else {
    headers["X-User-Id"] = demoUserId;
  }

  return headers;
}

function getReadHeaders(accessToken?: string) {
  const headers: Record<string, string> = {};

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else {
    headers["X-User-Id"] = demoUserId;
  }

  return headers;
}

export interface SubmissionHistoryItem {
  id: string;
  issue_id: number | null;
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
  created_at: string;
  evaluation:
    | {
        id: string;
        submission_id: string;
        verdict: "pass" | "fail" | "review";
        summary: string;
        confidence: number | null;
        model_name: string;
        created_at: string;
      }
    | null;
}

export interface ContributionGuideRecord {
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
}

export interface ContributionDraft {
  commitMessage: string;
  prTitle: string;
  prDescription: string;
}

export interface ExecuteSubmissionResult {
  submissionId: string;
  simulationSession: SimulationSessionRecord | null;
  expectedOutputMatch: boolean | null;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  status: { id: number; description: string };
}

export interface EvaluateSubmissionResult {
  evaluationId: string;
  submissionId: string;
  simulationSession: SimulationSessionRecord | null;
  evaluation: {
    verdict: "pass" | "fail" | "review";
    summary: string;
    strengths: string[];
    risks: string[];
    suggestions: string[];
    bugs: string[];
    improvements: string[];
    optimization: string[];
    correctness: "pass" | "fail" | "partial";
    confidence: number;
    score: number;
    modelName: string;
  };
}

export interface GrowthPathListItem extends LearningPathSummary {
  progress: GrowthPathProgress;
}

export async function ingestRepository(repository: string) {
  const response = await fetch(`${apiBase}/api/issues/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repository })
  });

  if (!response.ok) {
    throw new Error("Failed to ingest repository issues");
  }

  return response.json();
}

export async function fetchIssues(filters?: { difficulty?: string; stack?: string }) {
  const query = new URLSearchParams();

  if (filters?.difficulty) query.set("difficulty", filters.difficulty);
  if (filters?.stack) query.set("stack", filters.stack);

  const response = await fetch(`${apiBase}/api/issues?${query.toString()}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch issues");
  }

  const payload = (await response.json()) as { items: ClassifiedIssue[] };
  return payload.items;
}

export async function fetchIssueById(id: number) {
  const response = await fetch(`${apiBase}/api/issues/${id}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to fetch issue details");
  }

  const payload = (await response.json()) as { item: ClassifiedIssue };
  return payload.item;
}

export async function executeSubmission(payload: {
  accessToken?: string;
  issueId: number;
  simulationSessionId?: string;
  languageId: number;
  sourceCode: string;
  stdin?: string;
  expectedOutput?: string;
}) {
  const { accessToken, ...body } = payload;
  const response = await fetch(`${apiBase}/api/submissions/execute`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error("Failed to execute submission");
  }

  return response.json() as Promise<ExecuteSubmissionResult>;
}

export async function evaluateSubmission(payload: {
  accessToken?: string;
  submissionId: string;
  simulationSessionId?: string;
}) {
  const { accessToken, ...body } = payload;
  const response = await fetch(`${apiBase}/api/submissions/evaluate`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error("Failed to evaluate submission");
  }

  return response.json() as Promise<EvaluateSubmissionResult>;
}

export async function fetchSubmissionHistory(
  issueId: number,
  accessToken?: string,
  limit = 20
) {
  const query = new URLSearchParams({
    issueId: String(issueId),
    limit: String(limit)
  });

  const response = await fetch(`${apiBase}/api/submissions/history?${query.toString()}`, {
    headers: getReadHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch submission history");
  }

  const payload = (await response.json()) as { items: SubmissionHistoryItem[] };
  return payload.items;
}

export async function startContributionGuide(payload: {
  accessToken?: string;
  issueId: number;
  simulationSessionId?: string;
  repositoryFullName: string;
  issueUrl: string;
  issueTitle: string;
}) {
  const { accessToken, ...body } = payload;
  const response = await fetch(`${apiBase}/api/contributions/start`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error("Failed to start contribution guide");
  }

  return response.json() as Promise<{
    guide: ContributionGuideRecord;
    steps: string[];
    draft: ContributionDraft;
  }>;
}

export async function attachContributionPr(payload: {
  accessToken?: string;
  guideId: string;
  prUrl: string;
  prStatus?: "opened" | "in_review" | "changes_requested" | "merged" | "closed";
}) {
  const { accessToken, ...body } = payload;
  const response = await fetch(`${apiBase}/api/contributions/pr`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error("Failed to attach pull request");
  }

  return response.json() as Promise<{
    guide: ContributionGuideRecord;
  }>;
}

export async function fetchContributionHistory(payload: {
  accessToken?: string;
  issueId?: number;
}) {
  const query = new URLSearchParams();
  if (typeof payload.issueId === "number") {
    query.set("issueId", String(payload.issueId));
  }

  const response = await fetch(`${apiBase}/api/contributions/history?${query.toString()}`, {
    headers: getReadHeaders(payload.accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch contribution history");
  }

  const data = (await response.json()) as { items: ContributionGuideRecord[] };
  return data.items;
}

export async function startSimulation(payload: { accessToken?: string; issueId: number }) {
  const response = await fetch(`${apiBase}/api/simulations/start`, {
    method: "POST",
    headers: getAuthHeaders(payload.accessToken),
    body: JSON.stringify({ issueId: payload.issueId })
  });

  if (!response.ok) {
    throw new Error("Failed to start simulation");
  }

  return response.json() as Promise<{ session: SimulationSessionRecord }>;
}

export async function fetchCurrentSimulation(payload: { accessToken?: string; issueId: number }) {
  const query = new URLSearchParams({ issueId: String(payload.issueId) });
  const response = await fetch(`${apiBase}/api/simulations/current?${query.toString()}`, {
    headers: getReadHeaders(payload.accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch current simulation");
  }

  return response.json() as Promise<{ session: SimulationSessionRecord | null }>;
}

export async function fetchProgressOverview(accessToken?: string) {
  const response = await fetch(`${apiBase}/api/progress/overview`, {
    headers: getReadHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch progress overview");
  }

  return response.json() as Promise<UserProgressOverview>;
}

export async function discoverProblems(filters?: {
  difficulty?: "easy" | "medium" | "hard";
  skill?: "frontend" | "backend" | "fullstack" | "devops";
  page?: number;
}) {
  const query = new URLSearchParams();
  if (filters?.difficulty) query.set("difficulty", filters.difficulty);
  if (filters?.skill) query.set("skill", filters.skill);
  if (filters?.page) query.set("page", String(filters.page));

  const response = await fetch(`${apiBase}/api/problems/discover?${query.toString()}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to discover curated problems");
  }

  return response.json() as Promise<{
    items: DiscoveredProblem[];
    page: number;
    pageSize: number;
    total: number;
  }>;
}

export async function refreshDiscoveredProblems() {
  const response = await fetch(`${apiBase}/api/problems/discover/refresh`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Failed to refresh curated problems");
  }

  return response.json() as Promise<{ repositories: string[]; discoveredCount: number }>;
}

export async function createUserProfile(input: { id: string; name?: string; email: string }) {
  const response = await fetch(`${apiBase}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Failed to create user profile");
  }

  return response.json() as Promise<{
    user: { id: string; name: string | null; email: string; created_at: string };
    settings: UserSettings;
  }>;
}

export async function fetchUserProfile(id: string) {
  const response = await fetch(`${apiBase}/api/users/${id}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to fetch user profile");
  }

  return response.json() as Promise<{ user: { id: string; name: string | null; email: string; created_at: string } }>;
}

export async function fetchUserStats(id: string) {
  const response = await fetch(`${apiBase}/api/users/${id}/stats`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to fetch user stats");
  }

  return response.json() as Promise<UserStats>;
}

export async function fetchUserSettings(id: string, accessToken?: string) {
  const response = await fetch(`${apiBase}/api/users/${id}/settings`, {
    headers: getReadHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user settings");
  }

  return response.json() as Promise<{ settings: UserSettings }>;
}

export async function updateUserSettings(
  id: string,
  patch: Partial<UserSettings>,
  accessToken?: string
) {
  const response = await fetch(`${apiBase}/api/users/${id}/settings`, {
    method: "PATCH",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    throw new Error("Failed to update user settings");
  }

  return response.json() as Promise<{ settings: UserSettings }>;
}

export async function deleteUserProfile(id: string, accessToken?: string) {
  const response = await fetch(`${apiBase}/api/users/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(accessToken)
  });

  if (!response.ok) {
    throw new Error("Failed to delete account");
  }

  return response.json() as Promise<{ deleted: boolean }>;
}

export async function fetchGrowthPaths(accessToken?: string) {
  const response = await fetch(`${apiBase}/api/growth-paths`, {
    headers: getReadHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch growth paths");
  }

  return response.json() as Promise<{ items: GrowthPathListItem[] }>;
}

export async function fetchGrowthPathDetail(pathId: string, accessToken?: string) {
  const response = await fetch(`${apiBase}/api/growth-paths/${pathId}`, {
    headers: getReadHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch growth path");
  }

  return response.json() as Promise<{ path: LearningPathDetail; progress: GrowthPathProgress }>;
}

export async function fetchGrowthPathDay(pathId: string, dayNumber: number, accessToken?: string) {
  const response = await fetch(`${apiBase}/api/growth-paths/${pathId}/days/${dayNumber}`, {
    headers: getReadHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch learning day");
  }

  return response.json() as Promise<LearningDayDetail>;
}

export async function executeGrowthPathDay(payload: {
  accessToken?: string;
  pathId: string;
  dayNumber: number;
  languageId: number;
  sourceCode: string;
  stdin?: string;
  expectedOutput?: string;
}) {
  const { accessToken, pathId, dayNumber, ...body } = payload;
  const response = await fetch(`${apiBase}/api/growth-paths/${pathId}/days/${dayNumber}/execute`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error("Failed to execute learning task");
  }

  return response.json() as Promise<ExecuteSubmissionResult & {
    progress: {
      pathId: string;
      dayNumber: number;
      status: "locked" | "available" | "in_review" | "completed";
      attempts: number;
      score: number | null;
      verdict: "pass" | "fail" | "review" | null;
      completedAt?: string | null;
      submissionId?: string | null;
    };
  }>;
}

export async function submitGrowthPathDay(payload: {
  accessToken?: string;
  pathId: string;
  dayNumber: number;
  submissionId: string;
}) {
  const { accessToken, pathId, dayNumber, ...body } = payload;
  const response = await fetch(`${apiBase}/api/growth-paths/${pathId}/days/${dayNumber}/submit`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error("Failed to submit learning day");
  }

  return response.json() as Promise<EvaluateSubmissionResult & {
    progress: {
      pathId: string;
      dayNumber: number;
      status: "locked" | "available" | "in_review" | "completed";
      attempts: number;
      score: number | null;
      verdict: "pass" | "fail" | "review" | null;
      completedAt?: string | null;
      submissionId?: string | null;
    };
  }>;
}

export async function fetchGrowthPathProgress(pathId: string, accessToken?: string) {
  const response = await fetch(`${apiBase}/api/growth-paths/${pathId}/progress`, {
    headers: getReadHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch growth path progress");
  }

  return response.json() as Promise<{
    progress: GrowthPathProgress;
    currentDay: {
      pathId: string;
      dayNumber: number;
      status: "locked" | "available" | "in_review" | "completed";
      attempts: number;
      score: number | null;
      verdict: "pass" | "fail" | "review" | null;
      completedAt?: string | null;
      submissionId?: string | null;
    } | null;
  }>;
}
