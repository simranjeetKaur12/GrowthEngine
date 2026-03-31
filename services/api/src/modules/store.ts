import { runtimeFeatures } from "../config";
import * as memoryStore from "./memory-store";
import * as supabaseStore from "./supabase-store";

const backend = runtimeFeatures.supabaseConfigured ? supabaseStore : memoryStore;

export type LearningPathProgressRow = {
  pathId: string;
  dayNumber: number;
  status: "locked" | "available" | "in_review" | "completed";
  attempts: number;
  score: number | null;
  verdict: "pass" | "fail" | "review" | null;
  completedAt?: string | null;
  submissionId?: string | null;
};

export const upsertIssues = backend.upsertIssues;
export const listIssues = backend.listIssues;
export const getIssueById = backend.getIssueById;
export const createSubmission = backend.createSubmission;
export const updateSubmissionExecution = backend.updateSubmissionExecution;
export const getSubmissionById = backend.getSubmissionById;
export const listSubmissionHistory = backend.listSubmissionHistory;
export const listAllSubmissionHistory = backend.listAllSubmissionHistory;
export const createEvaluation = backend.createEvaluation;
export const getLatestEvaluationForIssue = backend.getLatestEvaluationForIssue;
export const createContributionGuide = backend.createContributionGuide;
export const updateContributionGuidePr = backend.updateContributionGuidePr;
export const listContributionGuides = backend.listContributionGuides;
export const startSimulationSession = backend.startSimulationSession;
export const getSimulationSession = backend.getSimulationSession;
export const updateSimulationSessionAfterExecution = backend.updateSimulationSessionAfterExecution;
export const updateSimulationSessionAfterEvaluation = backend.updateSimulationSessionAfterEvaluation;
export const markSimulationContributionReady = backend.markSimulationContributionReady;
export const getUserProgressOverview = backend.getUserProgressOverview;
export const ensureGrowthPathCatalog = backend.ensureGrowthPathCatalog;
export const listGrowthPathProgress = backend.listGrowthPathProgress;
export const getGrowthPathDayProgress = backend.getGrowthPathDayProgress;
export const updateGrowthPathProgressAfterExecution = backend.updateGrowthPathProgressAfterExecution;
export const updateGrowthPathProgressAfterEvaluation = backend.updateGrowthPathProgressAfterEvaluation;
