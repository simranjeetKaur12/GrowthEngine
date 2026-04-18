import { Router } from "express";
import { z } from "zod";

import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { createContributionDraft } from "../modules/contribution-guide";
import {
  createContributionGuide,
  getLatestEvaluationForIssue,
  listContributionGuides,
  markSimulationContributionReady,
  updateContributionGuidePr
} from "../modules/store";

const startGuideSchema = z.object({
  issueId: z.number(),
  simulationSessionId: z.string().uuid().optional(),
  repositoryFullName: z.string().min(3),
  issueUrl: z.string().url(),
  issueTitle: z.string().min(3)
});

const attachPrSchema = z.object({
  guideId: z.string().uuid(),
  prUrl: z.string().url(),
  prStatus: z.enum(["opened", "in_review", "changes_requested", "merged", "closed"]).default("opened")
});

export const contributionRouter = Router();

contributionRouter.use(requireAuth);

contributionRouter.post("/start", async (req: AuthenticatedRequest, res) => {
  const parsed = startGuideSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const branchSlug = parsed.data.issueTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 36);
    const branchName = `fix/${parsed.data.issueId}-${branchSlug || "issue"}`;

    const guide = await createContributionGuide({
      userId: req.authUserId ?? "",
      issueId: parsed.data.issueId,
      repositoryFullName: parsed.data.repositoryFullName,
      issueUrl: parsed.data.issueUrl,
      branchName
    });
    const latestEvaluation = await getLatestEvaluationForIssue(req.authUserId ?? "demo-user", parsed.data.issueId);
    const draft = await createContributionDraft({
      repositoryFullName: parsed.data.repositoryFullName,
      issueTitle: parsed.data.issueTitle,
      issueUrl: parsed.data.issueUrl,
      branchName,
      evaluationSummary: latestEvaluation?.summary,
      strengths: latestEvaluation?.strengths ?? [],
      risks: latestEvaluation?.risks ?? [],
      suggestions: latestEvaluation?.suggestions ?? []
    });
    await markSimulationContributionReady({
      sessionId: parsed.data.simulationSessionId,
      userId: req.authUserId ?? "demo-user",
      issueId: parsed.data.issueId
    });

    return res.json({
      guide,
      steps: [
        "Fork the repository",
        "Clone it locally",
        "Create a new branch",
        "Apply the changes",
        "Write the commit message",
        "Push the branch",
        "Open a pull request"
      ],
      draft
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start contribution guide";
    return res.status(500).json({ error: message });
  }
});

contributionRouter.post("/pr", async (req: AuthenticatedRequest, res) => {
  const parsed = attachPrSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const guide = await updateContributionGuidePr({
      guideId: parsed.data.guideId,
      userId: req.authUserId ?? "",
      prUrl: parsed.data.prUrl,
      prStatus: parsed.data.prStatus
    });
    if (guide.issue_id) {
      await markSimulationContributionReady({
        userId: req.authUserId ?? "demo-user",
        issueId: guide.issue_id,
        completed: parsed.data.prStatus === "merged"
      });
    }

    return res.json({ guide });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to attach PR";
    return res.status(500).json({ error: message });
  }
});

contributionRouter.get("/history", async (req: AuthenticatedRequest, res) => {
  const issueId = req.query.issueId ? Number(req.query.issueId) : undefined;

  if (typeof issueId !== "undefined" && !Number.isFinite(issueId)) {
    return res.status(400).json({ error: "issueId must be numeric if provided" });
  }

  try {
    const items = await listContributionGuides(req.authUserId ?? "", issueId);
    return res.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch contribution history";
    return res.status(500).json({ error: message });
  }
});
