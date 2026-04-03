import type {
  ClassifiedIssue,
  GrowthPathDayStatus,
  GrowthPathIntensity,
  GrowthPathProgress,
  LearningDayDetail,
  LearningDayPreview,
  LearningPathDetail
} from "@growthengine/shared";

import { getGrowthPathCatalog, listGrowthPathCatalog } from "./catalog";

import type { EvaluationResult } from "../../modules/evaluator";
import type { LearningPathProgressRow } from "../../modules/store";

function toIssueDifficulty(dayNumber: number) {
  if (dayNumber <= 30) return "beginner" as const;
  if (dayNumber <= 70) return "intermediate" as const;
  return "advanced" as const;
}

function toStatus(progress: LearningPathProgressRow | undefined, currentDay: number, dayNumber: number): GrowthPathDayStatus {
  if (progress?.status === "completed") return "completed";
  if (progress?.status === "in_review") return "in_review";
  return dayNumber <= currentDay ? "available" : "locked";
}

function recommendedIntensity(scores: number[]): GrowthPathIntensity {
  if (!scores.length) return "steady";
  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  if (average >= 8) return "stretch";
  if (average <= 5) return "reset";
  return "steady";
}

export function buildLearningPathIssue(pathId: string, dayNumber: number) {
  const catalog = getGrowthPathCatalog(pathId);
  if (!catalog) {
    return null;
  }

  const day = catalog.days.find((item) => item.dayNumber === dayNumber);
  if (!day) {
    return null;
  }

  const pseudoIssue: ClassifiedIssue = {
    id: Number(`9${dayNumber.toString().padStart(3, "0")}`),
    repositoryFullName: `growthpaths/${catalog.summary.id}`,
    title: day.title,
    body: `${day.explanation}\n\nTask:\n${day.task}`,
    labels: [catalog.summary.skill, day.difficulty, "growthpaths"],
    url: `https://growthengine.local/growth-paths/${catalog.summary.id}/days/${day.dayNumber}`,
    difficulty: toIssueDifficulty(day.dayNumber),
    techStack: day.techStack,
    confidence: 1,
    scenarioTitle: day.title,
    scenarioBody: `${day.explanation}\n\nTask:\n${day.task}`,
    learningObjectives: day.hints,
    acceptanceCriteria: [
      "Submit a working implementation for the daily task.",
      "Explain the tradeoff or reasoning behind the chosen solution.",
      "Iterate based on AI feedback before marking the day complete."
    ]
  };

  return { path: catalog.summary, day, pseudoIssue };
}

export function buildGrowthPathProgress(pathId: string, rows: LearningPathProgressRow[]): GrowthPathProgress {
  const catalog = getGrowthPathCatalog(pathId);
  if (!catalog) {
    throw new Error("Growth path not found");
  }

  const sortedRows = [...rows].sort((a, b) => a.dayNumber - b.dayNumber);
  const scoreValues = sortedRows.map((row) => row.score).filter((value): value is number => typeof value === "number");
  const completedDays = sortedRows.filter((row) => row.status === "completed").length;
  const currentDay = Math.min(completedDays + 1, catalog.summary.totalDays);
  const submissionsCount = sortedRows.reduce((sum, row) => sum + row.attempts, 0);
  const averageScore = scoreValues.length
    ? Number((scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length).toFixed(1))
    : 0;

  let streak = 0;
  for (const row of sortedRows) {
    if (row.dayNumber === streak + 1 && row.status === "completed") {
      streak += 1;
      continue;
    }

    if (row.dayNumber > streak + 1 || row.status !== "completed") {
      break;
    }
  }

  return {
    pathId,
    completedDays,
    totalDays: catalog.summary.totalDays,
    currentDay,
    streak,
    averageScore,
    recommendedIntensity: recommendedIntensity(scoreValues.slice(-5)),
    submissionsCount,
    completionRate: Number(((completedDays / catalog.summary.totalDays) * 100).toFixed(1)),
    days: sortedRows
  };
}

export function buildLearningPathDetail(pathId: string, rows: LearningPathProgressRow[]): LearningPathDetail {
  const catalog = getGrowthPathCatalog(pathId);
  if (!catalog) {
    throw new Error("Growth path not found");
  }

  const progressOverview = buildGrowthPathProgress(pathId, rows);
  const rowMap = new Map(rows.map((row) => [row.dayNumber, row]));

  const days: LearningDayPreview[] = catalog.days.map((day) => {
    const progress = rowMap.get(day.dayNumber);
    return {
      dayNumber: day.dayNumber,
      topic: day.topic,
      title: day.title,
      difficulty: day.difficulty,
      status: toStatus(progress, progressOverview.currentDay, day.dayNumber),
      score: progress?.score ?? null,
      completedAt: progress?.completedAt ?? null
    };
  });

  return {
    ...catalog.summary,
    overview: catalog.overview,
    phases: catalog.phases,
    days
  };
}

export function buildLearningDayDetail(pathId: string, dayNumber: number, rows: LearningPathProgressRow[]): LearningDayDetail {
  const catalog = getGrowthPathCatalog(pathId);
  if (!catalog) {
    throw new Error("Growth path not found");
  }

  const day = catalog.days.find((item) => item.dayNumber === dayNumber);
  if (!day) {
    throw new Error("Learning day not found");
  }

  const progressOverview = buildGrowthPathProgress(pathId, rows);
  const progress = rows.find((item) => item.dayNumber === dayNumber) ?? null;

  return {
    path: catalog.summary,
    day,
    progress,
    progressOverview
  };
}

export function listGrowthPaths() {
  return listGrowthPathCatalog();
}

export function markProgressStatusFromEvaluation(evaluation: EvaluationResult): GrowthPathDayStatus {
  return evaluation.verdict === "pass" ? "completed" : "in_review";
}
