import { Router } from "express";
import { z } from "zod";

import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { evaluateSubmission } from "../modules/evaluator";
import {
  createEvaluation,
  createSubmission,
  ensureGrowthPathCatalog,
  getGrowthPathDayProgress,
  getSubmissionById,
  listGrowthPathProgress,
  updateGrowthPathProgressAfterEvaluation,
  updateGrowthPathProgressAfterExecution
} from "../modules/store";
import { executeWithHybridStrategy } from "../services/executor/hybrid-executor";
import { getGrowthPathCatalog, listGrowthPathCatalog } from "../services/growth-paths/catalog";
import {
  buildGrowthPathProgress,
  buildLearningDayDetail,
  buildLearningPathDetail,
  buildLearningPathIssue,
  listGrowthPaths,
  markProgressStatusFromEvaluation
} from "../services/growth-paths/growth-paths-service";

const executeSchema = z.object({
  languageId: z.number(),
  sourceCode: z.string().min(1),
  stdin: z.string().optional(),
  expectedOutput: z.string().optional()
});

const submitSchema = z.object({
  submissionId: z.string().uuid()
});

async function syncCatalog() {
  const catalogs = listGrowthPathCatalog();
  await ensureGrowthPathCatalog(
    catalogs.map((summary) => {
      const catalog = getGrowthPathCatalog(summary.id);
      return {
        id: summary.id,
        totalDays: summary.totalDays,
        title: summary.title,
        skill: summary.skill,
        description: summary.description,
        levelLabel: summary.levelLabel,
        estimatedMinutesPerDay: summary.estimatedMinutesPerDay,
        tags: summary.tags,
        adaptive: summary.adaptive,
        overview: catalog?.overview ?? "",
        phases: catalog?.phases ?? [],
        days:
          catalog?.days.map((day) => ({
            dayNumber: day.dayNumber,
            topic: day.topic,
            title: day.title,
            explanation: day.explanation,
            task: day.task,
            stretchGoal: day.stretchGoal ?? null,
            hints: day.hints,
            languageId: day.languageId,
            techStack: day.techStack,
            expectedOutput: day.expectedOutput ?? null,
            starterCode: day.starterCode,
            difficulty: day.difficulty
          })) ?? []
      };
    })
  );
}

export const growthPathsRouter = Router();

growthPathsRouter.use(requireAuth);

growthPathsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    await syncCatalog();
    const items = await Promise.all(
      listGrowthPaths().map(async (path) => {
        const progress = buildGrowthPathProgress(
          path.id,
          await listGrowthPathProgress(req.authUserId ?? "demo-user", path.id)
        );

        return {
          ...path,
          progress
        };
      })
    );

    return res.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load learning paths";
    return res.status(500).json({ error: message });
  }
});

growthPathsRouter.get("/:pathId", async (req: AuthenticatedRequest, res) => {
  try {
    await syncCatalog();
    const path = buildLearningPathDetail(
      req.params.pathId,
      await listGrowthPathProgress(req.authUserId ?? "demo-user", req.params.pathId)
    );
    const progress = buildGrowthPathProgress(
      req.params.pathId,
      await listGrowthPathProgress(req.authUserId ?? "demo-user", req.params.pathId)
    );
    return res.json({ path, progress });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load path";
    return res.status(404).json({ error: message });
  }
});

growthPathsRouter.get("/:pathId/days/:dayNumber", async (req: AuthenticatedRequest, res) => {
  const dayNumber = Number(req.params.dayNumber);
  if (!Number.isFinite(dayNumber)) {
    return res.status(400).json({ error: "Invalid day number" });
  }

  try {
    await syncCatalog();
    const detail = buildLearningDayDetail(
      req.params.pathId,
      dayNumber,
      await listGrowthPathProgress(req.authUserId ?? "demo-user", req.params.pathId)
    );
    return res.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load day";
    return res.status(404).json({ error: message });
  }
});

growthPathsRouter.post("/:pathId/days/:dayNumber/execute", async (req: AuthenticatedRequest, res) => {
  const dayNumber = Number(req.params.dayNumber);
  const parsed = executeSchema.safeParse(req.body);

  if (!Number.isFinite(dayNumber)) {
    return res.status(400).json({ error: "Invalid day number" });
  }

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    await syncCatalog();
    const learningDay = buildLearningPathIssue(req.params.pathId, dayNumber);
    if (!learningDay) {
      return res.status(404).json({ error: "Learning day not found" });
    }

    const submissionId = await createSubmission({
      userId: req.authUserId,
      languageId: parsed.data.languageId,
      sourceCode: parsed.data.sourceCode,
      stdin: parsed.data.stdin,
      expectedOutput: parsed.data.expectedOutput ?? learningDay.day.expectedOutput ?? undefined,
      learningPathId: req.params.pathId,
      learningDayNumber: dayNumber
    });

    const result = await executeWithHybridStrategy({
      issue: learningDay.pseudoIssue,
      submission: {
        languageId: parsed.data.languageId,
        sourceCode: parsed.data.sourceCode,
        stdin: parsed.data.stdin,
        expectedOutput: parsed.data.expectedOutput ?? learningDay.day.expectedOutput ?? undefined
      },
      mode: "growth-path"
    });

    const progress = await updateGrowthPathProgressAfterExecution({
      userId: req.authUserId ?? "demo-user",
      pathId: req.params.pathId,
      dayNumber,
      submissionId
    });

    return res.json({
      submissionId,
      progress,
      expectedOutputMatch:
        typeof (parsed.data.expectedOutput ?? learningDay.day.expectedOutput) === "string"
          ? (result.stdout ?? "").trim() === (parsed.data.expectedOutput ?? learningDay.day.expectedOutput ?? "").trim()
          : null,
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to execute learning task";
    return res.status(500).json({ error: message });
  }
});

growthPathsRouter.post("/:pathId/days/:dayNumber/submit", async (req: AuthenticatedRequest, res) => {
  const dayNumber = Number(req.params.dayNumber);
  const parsed = submitSchema.safeParse(req.body);

  if (!Number.isFinite(dayNumber)) {
    return res.status(400).json({ error: "Invalid day number" });
  }

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    await syncCatalog();
    const learningDay = buildLearningPathIssue(req.params.pathId, dayNumber);
    if (!learningDay) {
      return res.status(404).json({ error: "Learning day not found" });
    }

    const submission = await getSubmissionById(parsed.data.submissionId);
    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    if (submission.user_id !== req.authUserId) {
      return res.status(403).json({ error: "Submission does not belong to the authenticated user." });
    }

    if (submission.learning_path_id !== req.params.pathId || submission.learning_day_number !== dayNumber) {
      return res.status(400).json({ error: "Submission is not attached to the requested learning day." });
    }

    const evaluation = await evaluateSubmission({
      issue: learningDay.pseudoIssue,
      submission: {
        languageId: submission.language_id,
        sourceCode: submission.source_code,
        stdin: submission.stdin ?? undefined,
        expectedOutput: submission.expected_output ?? undefined
      },
      stdout: submission.stdout ?? undefined,
      stderr: submission.stderr ?? undefined,
      compileOutput: submission.compile_output ?? undefined,
      expectedOutputMatch: submission.is_expected_output_match ?? null
    });

    const evaluationId = await createEvaluation(parsed.data.submissionId, evaluation);
    const progress = await updateGrowthPathProgressAfterEvaluation({
      userId: req.authUserId ?? "demo-user",
      pathId: req.params.pathId,
      dayNumber,
      submissionId: parsed.data.submissionId,
      verdict: evaluation.verdict,
      score: evaluation.score
    });

    return res.json({
      evaluationId,
      submissionId: parsed.data.submissionId,
      evaluation,
      progress: {
        ...progress,
        status: markProgressStatusFromEvaluation(evaluation)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit learning day";
    return res.status(500).json({ error: message });
  }
});

growthPathsRouter.get("/:pathId/progress", async (req: AuthenticatedRequest, res) => {
  try {
    await syncCatalog();
    const progress = buildGrowthPathProgress(
      req.params.pathId,
      await listGrowthPathProgress(req.authUserId ?? "demo-user", req.params.pathId)
    );
    const currentDay = await getGrowthPathDayProgress(
      req.authUserId ?? "demo-user",
      req.params.pathId,
      progress.currentDay
    );
    return res.json({ progress, currentDay });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load path progress";
    return res.status(500).json({ error: message });
  }
});
