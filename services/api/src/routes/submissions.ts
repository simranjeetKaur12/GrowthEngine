import { Router } from "express";
import { z } from "zod";

import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import {
  evaluateIterativeFeedback,
  evaluateSubmissionWithEngine
} from "../modules/evaluation-engine";
import {
  issueAnalysisToEvaluation
} from "../modules/issue-analyzer";
import { packSourceWithWorkspace, unpackSourceWorkspace } from "../modules/submission-workspace";
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

const workspaceFileSchema = z.object({
  path: z.string().min(1),
  language: z.string().optional(),
  originalContent: z.string().optional(),
  updatedContent: z.string(),
  diff: z.string().optional()
});

const workspaceContextSchema = z.object({
  repository: z.string().optional(),
  issueUrl: z.string().url().optional(),
  notes: z.string().optional(),
  files: z.array(workspaceFileSchema).max(30)
});

const executeSchema = z.object({
  issueId: z.number(),
  simulationSessionId: z.string().uuid().optional(),
  languageId: z.number(),
  sourceCode: z.string().min(1),
  stdin: z.string().optional(),
  expectedOutput: z.string().optional(),
  workspace: workspaceContextSchema.optional(),
  evaluationMode: z.enum(["iterative_feedback", "final_review"]).default("iterative_feedback")
});

const evaluateSchema = z.object({
  submissionId: z.string().uuid(),
  simulationSessionId: z.string().uuid().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  compileOutput: z.string().optional(),
  workspace: workspaceContextSchema.optional()
});

export const submissionRouter = Router();

submissionRouter.use(requireAuth);

function iterativeToLegacyAnalysis(iterative: {
  status: "progress" | "almost" | "correct";
  what_you_did_right: string[];
  what_to_improve: string[];
  suggested_focus_area: string;
  confidence: number;
  summary: string;
}) {
  return {
    status: iterative.status === "correct" ? "likely_solved" : "in_progress",
    feedback: {
      strengths: iterative.what_you_did_right,
      issues: iterative.what_to_improve,
      suggestions: [iterative.suggested_focus_area]
    },
    guidance: iterative.suggested_focus_area,
    confidence: iterative.confidence,
    summary: iterative.summary,
    modelName: "iterative-feedback"
  };
}

function toFinalReview(evaluation: {
  verdict: "pass" | "fail" | "review";
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  confidence: number;
  score: number;
  summary: string;
}) {
  const edgeCaseHandling = Math.max(0, Math.min(10, evaluation.score - 1));
  return {
    correctness_score: evaluation.score,
    code_quality: Math.max(0, Math.min(10, evaluation.score - 0.5)),
    edge_case_handling: edgeCaseHandling,
    final_verdict: evaluation.verdict === "pass" ? "approved" : "needs_work",
    strengths: evaluation.strengths,
    weaknesses: evaluation.weaknesses,
    improvements: evaluation.suggestions,
    confidence_score: evaluation.confidence,
    summary: evaluation.summary
  };
}

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

    const packedWorkspace = parsed.data.workspace ? packSourceWithWorkspace(parsed.data.sourceCode, parsed.data.workspace) : parsed.data.sourceCode;
    const submissionId = await createSubmission({
      issueId: parsed.data.issueId,
      userId: req.authUserId,
      simulationSessionId: parsed.data.simulationSessionId,
      languageId: parsed.data.languageId,
      sourceCode: packedWorkspace,
      stdin: parsed.data.stdin,
      expectedOutput: parsed.data.expectedOutput
    });

    const sessionAfterRun = await updateSimulationSessionAfterExecution({
      sessionId: parsed.data.simulationSessionId,
      userId: req.authUserId ?? "demo-user",
      issueId: parsed.data.issueId,
      submissionId
    });

    if (parsed.data.evaluationMode === "final_review") {
      const evaluation = await evaluateSubmissionWithEngine({
        payload: {
          issue,
          submission: {
            languageId: parsed.data.languageId,
            sourceCode: parsed.data.sourceCode,
            stdin: parsed.data.stdin,
            expectedOutput: parsed.data.expectedOutput
          },
          expectedOutputMatch: null
        },
        workspace: parsed.data.workspace ?? null
      });

      const finalReview = toFinalReview(evaluation);
      const syntheticResult = {
        stdout: null,
        stderr: null,
        compile_output: null,
        status: {
          id: evaluation.verdict === "pass" ? 3 : evaluation.verdict === "review" ? 2 : 0,
          description: evaluation.verdict === "pass" ? "Senior review approved" : "Senior review needs work"
        }
      };

      const persistence = await updateSubmissionExecution(
        submissionId,
        syntheticResult,
        parsed.data.expectedOutput
      );
      const evaluationId = await createEvaluation(submissionId, evaluation);
      const session = await updateSimulationSessionAfterEvaluation({
        sessionId: parsed.data.simulationSessionId,
        userId: req.authUserId ?? "demo-user",
        issueId: parsed.data.issueId,
        verdict: evaluation.verdict
      });

      return res.json({
        submissionId,
        evaluationId,
        evaluation,
        finalReview,
        simulationSession: session ?? sessionAfterRun,
        expectedOutputMatch: persistence.isExpectedOutputMatch,
        ...syntheticResult
      });
    }

    const iterativeFeedback = await evaluateIterativeFeedback({
      payload: {
        issue,
        submission: {
          languageId: parsed.data.languageId,
          sourceCode: parsed.data.sourceCode,
          stdin: parsed.data.stdin,
          expectedOutput: parsed.data.expectedOutput
        },
        expectedOutputMatch: null
      },
      workspace: parsed.data.workspace ?? null
    });

    const analysis = iterativeToLegacyAnalysis(iterativeFeedback);
    const evaluation = issueAnalysisToEvaluation(analysis);
    const syntheticResult = {
      stdout: null,
      stderr: null,
      compile_output: null,
      status: {
        id: iterativeFeedback.status === "correct" ? 3 : iterativeFeedback.status === "almost" ? 2 : 0,
        description: iterativeFeedback.status === "correct" ? "AI analyzer confident" : "AI analyzer in progress"
      }
    };

    const persistence = await updateSubmissionExecution(
      submissionId,
      syntheticResult,
      parsed.data.expectedOutput
    );
    const evaluationId = await createEvaluation(submissionId, evaluation);

    return res.json({
      submissionId,
      evaluationId,
      evaluation,
      iterativeFeedback,
      analysis,
      simulationSession: sessionAfterRun,
      expectedOutputMatch: persistence.isExpectedOutputMatch,
      ...syntheticResult
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

    const unpacked = unpackSourceWorkspace(submission.source_code);
    const evaluation = await evaluateSubmissionWithEngine({
      payload: {
      issue,
      submission: {
        languageId: submission.language_id,
        sourceCode: unpacked.sourceCode,
        stdin: submission.stdin ?? undefined,
        expectedOutput: submission.expected_output ?? undefined
      },
      stdout: parsed.data.stdout ?? submission.stdout ?? undefined,
      stderr: parsed.data.stderr ?? submission.stderr ?? undefined,
      compileOutput: parsed.data.compileOutput ?? submission.compile_output ?? undefined,
      expectedOutputMatch: submission.is_expected_output_match
      },
      workspace: parsed.data.workspace ?? unpacked.workspace
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
