import { Router } from "express";
import { z } from "zod";

import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { evaluateSubmission } from "../modules/evaluator";
import {
  createEvaluation,
  createSubmission,
  getIssueById,
  getSubmissionById,
  listSubmissionHistory,
  updateSimulationSessionAfterEvaluation,
  updateSimulationSessionAfterExecution,
  updateSubmissionExecution
} from "../modules/store";
import { executeWithHybridStrategy } from "../services/executor/hybrid-executor";

const executeSchema = z.object({
  issueId: z.number(),
  simulationSessionId: z.string().uuid().optional(),
  languageId: z.number(),
  sourceCode: z.string().min(1),
  stdin: z.string().optional(),
  expectedOutput: z.string().optional()
});

const evaluateSchema = z.object({
  submissionId: z.string().uuid(),
  simulationSessionId: z.string().uuid().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  compileOutput: z.string().optional()
});

export const submissionRouter = Router();

submissionRouter.use(requireAuth);

submissionRouter.post("/execute", async (req: AuthenticatedRequest, res) => {
  const parsed = executeSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const issue = await getIssueById(parsed.data.issueId);
    if (!issue) {
      return res.status(404).json({ error: "Issue not found. Ingest or discover problems first." });
    }

    const submissionId = await createSubmission({
      issueId: parsed.data.issueId,
      userId: req.authUserId,
      simulationSessionId: parsed.data.simulationSessionId,
      languageId: parsed.data.languageId,
      sourceCode: parsed.data.sourceCode,
      stdin: parsed.data.stdin,
      expectedOutput: parsed.data.expectedOutput
    });

    const result = await executeWithHybridStrategy({
      issue,
      submission: {
        languageId: parsed.data.languageId,
        sourceCode: parsed.data.sourceCode,
        stdin: parsed.data.stdin,
        expectedOutput: parsed.data.expectedOutput
      }
    });
    const persistence = await updateSubmissionExecution(
      submissionId,
      result,
      parsed.data.expectedOutput
    );
    const session = await updateSimulationSessionAfterExecution({
      sessionId: parsed.data.simulationSessionId,
      userId: req.authUserId ?? "demo-user",
      issueId: parsed.data.issueId,
      submissionId
    });

    return res.json({
      submissionId,
      simulationSession: session,
      expectedOutputMatch: persistence.isExpectedOutputMatch,
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Execution failed";
    return res.status(500).json({ error: message });
  }
});

submissionRouter.post("/evaluate", async (req: AuthenticatedRequest, res) => {
  const parsed = evaluateSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const submission = await getSubmissionById(parsed.data.submissionId);
    if (!submission) {
      return res.status(404).json({ error: "Submission not found." });
    }

    if (submission.user_id !== req.authUserId) {
      return res.status(403).json({ error: "Submission does not belong to the authenticated user." });
    }

    if (!submission.issue_id) {
      return res.status(400).json({ error: "Submission has no linked issue." });
    }

    const issue = await getIssueById(submission.issue_id);

    if (!issue) {
      return res.status(404).json({ error: "Issue not found. Ingest issue list first." });
    }

    const evaluation = await evaluateSubmission({
      issue,
      submission: {
        languageId: submission.language_id,
        sourceCode: submission.source_code,
        stdin: submission.stdin ?? undefined,
        expectedOutput: submission.expected_output ?? undefined
      },
      stdout: parsed.data.stdout ?? submission.stdout ?? undefined,
      stderr: parsed.data.stderr ?? submission.stderr ?? undefined,
      compileOutput: parsed.data.compileOutput ?? submission.compile_output ?? undefined,
      expectedOutputMatch: submission.is_expected_output_match
    });

    const evaluationId = await createEvaluation(parsed.data.submissionId, evaluation);
    const session = await updateSimulationSessionAfterEvaluation({
      sessionId: parsed.data.simulationSessionId,
      userId: req.authUserId ?? "demo-user",
      issueId: issue.id,
      verdict: evaluation.verdict
    });

    return res.json({
      evaluationId,
      submissionId: parsed.data.submissionId,
      simulationSession: session,
      evaluation
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evaluation failed";
    return res.status(500).json({ error: message });
  }
});

submissionRouter.get("/history", async (req: AuthenticatedRequest, res) => {
  const issueId = Number(req.query.issueId);
  const limit = Number(req.query.limit ?? 20);

  if (!Number.isFinite(issueId)) {
    return res.status(400).json({ error: "issueId query parameter is required" });
  }

  try {
    const items = await listSubmissionHistory(
      issueId,
      req.authUserId ?? "",
      Number.isFinite(limit) ? limit : 20
    );
    return res.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load history";
    return res.status(500).json({ error: message });
  }
});
