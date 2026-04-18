import type { ClassifiedIssue } from "@growthengine/shared";
import { z } from "zod";

import { env, runtimeFeatures } from "../config";
import { generateStructuredJson } from "../integrations/openai";
import type { SubmissionWorkspaceContext } from "./submission-workspace";
import type { EvaluationResult } from "./evaluator";

export type IssueAnalyzerStatus = "in_progress" | "likely_solved";

export type IssueAnalyzerFeedback = {
  strengths: string[];
  issues: string[];
  suggestions: string[];
};

export type IssueAnalyzerResult = {
  status: IssueAnalyzerStatus;
  feedback: IssueAnalyzerFeedback;
  guidance: string;
  confidence: number;
  summary: string;
  modelName: string;
};

const analyzerOutputSchema = z
  .object({
    status: z.enum(["in_progress", "likely_solved"]),
    feedback: z
      .object({
        strengths: z.array(z.string().min(2).max(180)).max(6),
        issues: z.array(z.string().min(2).max(220)).max(6),
        suggestions: z.array(z.string().min(2).max(220)).max(6)
      })
      .strict(),
    guidance: z.string().min(10).max(220),
    confidence: z.number().min(0).max(1),
    summary: z.string().min(10).max(280)
  })
  .strict();

const analyzerJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["in_progress", "likely_solved"] },
    feedback: {
      type: "object",
      additionalProperties: false,
      properties: {
        strengths: {
          type: "array",
          items: { type: "string", minLength: 2, maxLength: 180 },
          maxItems: 6
        },
        issues: {
          type: "array",
          items: { type: "string", minLength: 2, maxLength: 220 },
          maxItems: 6
        },
        suggestions: {
          type: "array",
          items: { type: "string", minLength: 2, maxLength: 220 },
          maxItems: 6
        }
      },
      required: ["strengths", "issues", "suggestions"]
    },
    guidance: { type: "string", minLength: 10, maxLength: 220 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    summary: { type: "string", minLength: 10, maxLength: 280 }
  },
  required: ["status", "feedback", "guidance", "confidence", "summary"]
} as const;

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, value));
}

function toLines(text?: string | null) {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getChangedFiles(workspace: SubmissionWorkspaceContext | null) {
  return (workspace?.files ?? []).filter((file) => {
    const before = (file.originalContent ?? "").trim();
    const after = file.updatedContent.trim();
    return before !== after;
  });
}

function heuristicAnalyzeIssue(
  issue: ClassifiedIssue,
  workspace: SubmissionWorkspaceContext | null
): IssueAnalyzerResult {
  const guidedFiles = issue.guided_context?.where_to_fix ?? [];
  const changedFiles = getChangedFiles(workspace);
  const changedPaths = changedFiles.map((file) => file.path.toLowerCase());
  const guidedMatches = guidedFiles.filter((path: string) =>
    changedPaths.some((changedPath) => changedPath.includes(path.toLowerCase()) || path.toLowerCase().includes(changedPath))
  ).length;

  const diffText = changedFiles
    .flatMap((file) => [file.path, file.diff ?? "", file.updatedContent])
    .join("\n")
    .toLowerCase();

  const issueText = `${issue.title} ${issue.body} ${(issue.acceptanceCriteria ?? []).join(" ")}`.toLowerCase();

  const hasValidation = /zod|schema|validate|guard|if\s*\(/.test(diffText);
  const hasEdgeCases = /null|undefined|empty|fallback|error|try|catch|optional/.test(diffText);
  const touchesRelevantFile = guidedFiles.some((file: string) =>
    changedPaths.some((changedPath) => changedPath.includes(file.toLowerCase()) || file.toLowerCase().includes(changedPath))
  );
  const keywordOverlap = [
    ...new Set(
      issueText
        .split(/[^a-z0-9]+/g)
        .filter((token) => token.length >= 4)
        .slice(0, 24)
    )
  ].filter((keyword) => diffText.includes(keyword));

  const fileScore = touchesRelevantFile ? 0.35 : 0.15;
  const logicScore = hasValidation ? 0.25 : 0.1;
  const edgeCaseScore = hasEdgeCases ? 0.2 : 0.08;
  const overlapScore = Math.min(0.2, keywordOverlap.length * 0.03);
  const guidedScore = Math.min(0.1, guidedMatches * 0.03);

  const confidence = clampConfidence(fileScore + logicScore + edgeCaseScore + overlapScore + guidedScore + (changedFiles.length ? 0.18 : 0));
  const likelySolved = confidence >= 0.85;

  const strengths: string[] = [];
  if (touchesRelevantFile) {
    strengths.push("You changed one or more likely target files.");
  }
  if (hasValidation) {
    strengths.push("Your patch includes guard or validation style checks.");
  }
  if (changedFiles.length) {
    strengths.push(`You edited ${changedFiles.length} file(s), which shows progress on the issue scope.`);
  }
  if (!strengths.length) {
    strengths.push("You captured a working diff that can be reviewed against the issue context.");
  }

  const issues: string[] = [];
  if (!touchesRelevantFile) {
    issues.push("The current diff does not clearly touch the most likely issue files.");
  }
  if (!hasEdgeCases) {
    issues.push("Edge case coverage is still hard to see in the current patch.");
  }
  if (!guidedMatches && guidedFiles.length) {
    issues.push("The changed files do not line up with the guided fix locations yet.");
  }
  if (!changedFiles.length) {
    issues.push("No meaningful code changes were detected in the workspace.");
  }

  const suggestions: string[] = [];
  if (!touchesRelevantFile && guidedFiles.length) {
    suggestions.push(`You may want to check ${guidedFiles[0]} first.`);
  }
  suggestions.push("Consider updating the smallest logic branch that matches the issue behavior.");
  suggestions.push("Add or review the edge case path before your next run.");
  if (keywordOverlap.length) {
    suggestions.push(`Consider whether ${keywordOverlap[0]} is handled in the expected path.`);
  }

  const guidance = likelySolved
    ? "You look close. Recheck the main file and make sure the fix still holds for the corner cases described in the issue."
    : guidedFiles.length
      ? `You may want to check ${guidedFiles.slice(0, 2).join(" and ")} and tighten the branch that handles the reported behavior.`
      : "You may want to check the files most closely tied to the issue and tighten the smallest failing branch.";

  return {
    status: likelySolved ? "likely_solved" : "in_progress",
    feedback: {
      strengths,
      issues,
      suggestions
    },
    guidance,
    confidence: Number(confidence.toFixed(3)),
    summary: likelySolved
      ? "The current diff looks structurally aligned with the issue and close to a final fix."
      : "The current diff shows progress, but the targeted files or edge cases still need work.",
    modelName: "heuristic-issue-analyzer"
  };
}

export function issueAnalysisToEvaluation(result: IssueAnalyzerResult): EvaluationResult {
  const normalizedScore = Math.max(1, Math.min(10, Math.round(result.confidence * 10)));
  return {
    verdict: result.status === "likely_solved" ? "pass" : "review",
    correctness: result.status === "likely_solved" ? "pass" : "partial",
    summary: result.summary,
    strengths: result.feedback.strengths,
    weaknesses: result.feedback.issues,
    risks: result.feedback.issues,
    suggestions: result.feedback.suggestions,
    edge_cases: result.feedback.issues,
    bugs: result.feedback.issues,
    improvements: result.feedback.suggestions,
    optimization: result.feedback.strengths,
    confidence: result.confidence,
    score: normalizedScore,
    modelName: result.modelName
  };
}

export async function analyzeIssueSubmission(input: {
  issue: ClassifiedIssue;
  workspace: SubmissionWorkspaceContext | null;
}): Promise<IssueAnalyzerResult> {
  const fallback = heuristicAnalyzeIssue(input.issue, input.workspace);

  if (!runtimeFeatures.openAiConfigured || !runtimeFeatures.aiAnalyzerEnabled) {
    return fallback;
  }

  try {
    const result = await generateStructuredJson({
      model: env.openAiEvaluatorModel,
      schemaName: "issue_submission_analyzer",
      schema: analyzerJsonSchema,
      parser: analyzerOutputSchema,
      systemPrompt:
        "You are a mentor-like code reviewer for GitHub issue simulations. Do not provide solution code. Return short, actionable feedback only.",
      userPrompt: JSON.stringify({
        issue: input.issue,
        guidedContext: input.issue.guided_context,
        workspace: input.workspace,
        rules: [
          "Never provide full solution code.",
          "Focus on whether the correct files were changed, whether logic looks aligned, and what edge cases remain.",
          "Use mentor language such as 'You may want to check...' and 'Consider updating...'",
          "Confidence above 0.85 means likely_solved."
        ]
      }),
      retries: 1
    });

    return {
      ...result,
      confidence: Number(clampConfidence(result.confidence).toFixed(3)),
      modelName: env.openAiEvaluatorModel
    };
  } catch {
    return fallback;
  }
}

export function summarizeWorkspaceChanges(workspace: SubmissionWorkspaceContext | null) {
  const changedFiles = getChangedFiles(workspace);
  return changedFiles.map((file) => ({
    path: file.path,
    diff: file.diff ?? "",
    lines: toLines(file.diff).length
  }));
}
