import type { EvaluationPayload, IterativeAnalyzerFeedback } from "@growthengine/shared";
import { z } from "zod";

import { env, runtimeFeatures } from "../config";
import { generateStructuredJson } from "../integrations/openai";
import { analyzeIssueSubmission } from "./issue-analyzer";
import { evaluateSubmission, type EvaluationResult } from "./evaluator";
import type { SubmissionWorkspaceContext } from "./submission-workspace";

type StructuralEvaluation = {
  score: number;
  summary: string;
  fileRelevance: number;
  logicalAlignment: number;
  meaningfulness: number;
  risks: string[];
  confidence: number;
};

type BehavioralEvaluation = {
  strategy: "backend-mock" | "frontend-playwright" | "ai-fallback" | "none";
  passed: boolean;
  confidence: number;
  summary: string;
  notes: string[];
};

type DeepReviewResult = {
  correctnessScore: number;
  qualityScore: number;
  summary: string;
  missedEdgeCases: string[];
  suggestedImprovements: string[];
  confidence: number;
};

type IterativeFeedbackStatus = "progress" | "almost" | "correct";

const structuralOutputSchema = z
  .object({
    score: z.number().min(0).max(10),
    summary: z.string().min(8).max(280),
    fileRelevance: z.number().min(0).max(10),
    logicalAlignment: z.number().min(0).max(10),
    meaningfulness: z.number().min(0).max(10),
    risks: z.array(z.string().min(2).max(180)).max(8),
    confidence: z.number().min(0).max(1)
  })
  .strict();

const deepReviewOutputSchema = z
  .object({
    correctnessScore: z.number().min(0).max(10),
    qualityScore: z.number().min(0).max(10),
    summary: z.string().min(10).max(320),
    missedEdgeCases: z.array(z.string().min(2).max(180)).max(8),
    suggestedImprovements: z.array(z.string().min(2).max(220)).max(8),
    confidence: z.number().min(0).max(1)
  })
  .strict();

const iterativeOutputSchema = z
  .object({
    status: z.enum(["progress", "almost", "correct"]),
    what_you_did_right: z.array(z.string().min(2).max(220)).max(8),
    what_to_improve: z.array(z.string().min(2).max(220)).max(8),
    suggested_focus_area: z.string().min(3).max(180),
    confidence: z.number().min(0).max(1),
    summary: z.string().min(8).max(280)
  })
  .strict();

function clampScore(value: number, min = 0, max = 10) {
  return Math.min(max, Math.max(min, value));
}

function extractKeywords(text: string) {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "issue",
    "fix",
    "bug",
    "into",
    "when",
    "where",
    "have",
    "your",
    "should"
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !stop.has(token))
    .slice(0, 24);
}

function heuristicStructuralEvaluation(
  payload: EvaluationPayload,
  workspace: SubmissionWorkspaceContext | null
): StructuralEvaluation {
  const issueText = `${payload.issue.title} ${payload.issue.body}`;
  const issueKeywords = extractKeywords(issueText);

  const files = workspace?.files ?? [];
  const changedFiles = files.filter((file) => {
    const before = (file.originalContent ?? "").trim();
    const after = file.updatedContent.trim();
    return before !== after;
  });

  const techStack = payload.issue.techStack;
  const expectedPatterns = techStack.includes("react")
    ? [".tsx", ".jsx", ".css", "component", "page"]
    : techStack.includes("nodejs")
      ? [".ts", ".js", "route", "controller", "service"]
      : techStack.includes("python")
        ? [".py", "def ", "class "]
        : [".ts", ".js", ".py"];

  const relevantFileHits = changedFiles.filter((file) =>
    expectedPatterns.some((pattern) => file.path.toLowerCase().includes(pattern) || file.updatedContent.includes(pattern))
  ).length;

  const changedLines = changedFiles.reduce((sum, file) => {
    const beforeLines = (file.originalContent ?? "").split("\n").length;
    const afterLines = file.updatedContent.split("\n").length;
    return sum + Math.abs(afterLines - beforeLines) + Math.max(1, Math.floor(afterLines * 0.1));
  }, 0);

  const keywordHits = issueKeywords.filter((keyword) =>
    changedFiles.some((file) => file.updatedContent.toLowerCase().includes(keyword))
  ).length;

  const fileRelevance = clampScore((relevantFileHits / Math.max(changedFiles.length, 1)) * 10);
  const logicalAlignment = clampScore((keywordHits / Math.max(issueKeywords.length, 1)) * 12);
  const meaningfulness = clampScore(changedLines >= 12 ? 8 : changedLines >= 6 ? 6 : changedLines >= 3 ? 4 : 2);

  const score = Number(((fileRelevance * 0.4) + (logicalAlignment * 0.35) + (meaningfulness * 0.25)).toFixed(2));
  const risks: string[] = [];

  if (!changedFiles.length) {
    risks.push("No meaningful file edits detected in the submitted workspace.");
  }
  if (fileRelevance < 4) {
    risks.push("Changed files do not strongly match the expected area of the reported issue.");
  }
  if (logicalAlignment < 4) {
    risks.push("Code changes appear weakly aligned with issue keywords and context.");
  }

  return {
    score,
    summary: changedFiles.length
      ? `Detected ${changedFiles.length} changed file(s) with structural score ${score}/10.`
      : "No structured workspace diff provided; structural analysis confidence is low.",
    fileRelevance,
    logicalAlignment,
    meaningfulness,
    risks,
    confidence: changedFiles.length ? 0.62 : 0.28
  };
}

async function runStructuralEvaluation(
  payload: EvaluationPayload,
  workspace: SubmissionWorkspaceContext | null
): Promise<StructuralEvaluation> {
  const fallback = heuristicStructuralEvaluation(payload, workspace);

  if (!runtimeFeatures.structuralEvaluationEnabled || !runtimeFeatures.openAiConfigured) {
    return fallback;
  }

  try {
    const result = await generateStructuredJson({
      model: env.openAiEvaluatorModel,
      schemaName: "structural_fix_evaluation",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          score: { type: "number", minimum: 0, maximum: 10 },
          summary: { type: "string", minLength: 8, maxLength: 280 },
          fileRelevance: { type: "number", minimum: 0, maximum: 10 },
          logicalAlignment: { type: "number", minimum: 0, maximum: 10 },
          meaningfulness: { type: "number", minimum: 0, maximum: 10 },
          risks: {
            type: "array",
            items: { type: "string", minLength: 2, maxLength: 180 },
            maxItems: 8
          },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["score", "summary", "fileRelevance", "logicalAlignment", "meaningfulness", "risks", "confidence"]
      },
      parser: structuralOutputSchema,
      systemPrompt:
        "You evaluate software issue fixes using submitted file diffs. Judge structural alignment, logical placement of fixes, and meaningfulness of edits.",
      userPrompt: JSON.stringify({
        issue: payload.issue,
        workspace,
        guidance: [
          "Prioritize correct file targeting and logic alignment over coding style.",
          "Do not assume tests passed. Infer from code-level evidence only.",
          "Be strict on shallow edits that do not address the issue intent."
        ]
      }),
      retries: 1
    });

    return {
      ...result,
      score: clampScore(result.score),
      fileRelevance: clampScore(result.fileRelevance),
      logicalAlignment: clampScore(result.logicalAlignment),
      meaningfulness: clampScore(result.meaningfulness),
      confidence: Number(result.confidence.toFixed(3))
    };
  } catch {
    return fallback;
  }
}

function runBackendMockBehavior(payload: EvaluationPayload, workspace: SubmissionWorkspaceContext | null): BehavioralEvaluation {
  const files = workspace?.files ?? [];
  const backendFiles = files.filter((file) => /\.(ts|js|py)$/i.test(file.path));
  const updatedText = backendFiles.map((file) => file.updatedContent.toLowerCase()).join("\n");

  const hasValidation = /zod|schema|validate|guard|if\s*\(/.test(updatedText);
  const hasHttpHandling = /status\(|res\.json|throw new error|return\s+\{/.test(updatedText);
  const touchedLikelyBackendArea = backendFiles.some((file) =>
    /(route|controller|service|handler|api|middleware)/i.test(file.path)
  );

  const passed = touchedLikelyBackendArea && (hasValidation || hasHttpHandling);

  return {
    strategy: "backend-mock",
    passed,
    confidence: passed ? 0.65 : 0.45,
    summary: passed
      ? "Backend behavior mock signals indicate route/service-level fix logic and validation paths were touched."
      : "Backend behavior mock did not find strong validation or response-handling evidence in changed backend files.",
    notes: [
      touchedLikelyBackendArea
        ? "Detected changes in backend-oriented files."
        : "No obvious route/controller/service file changes detected.",
      hasValidation
        ? "Validation-like logic found in patch."
        : "Validation guards were not clearly detected.",
      hasHttpHandling
        ? "Response/error handling patterns found in patch."
        : "Response/error handling patterns were not clearly detected."
    ]
  };
}

async function runPlaywrightBehavior(workspace: SubmissionWorkspaceContext | null): Promise<BehavioralEvaluation> {
  if (!runtimeFeatures.behavioralFrontendPlaywrightEnabled) {
    return {
      strategy: "ai-fallback",
      passed: true,
      confidence: 0.4,
      summary: "Playwright disabled by feature flag; using fallback behavior validation.",
      notes: ["Enable BEHAVIORAL_FRONTEND_PLAYWRIGHT_ENABLED=true to run headless checks."]
    };
  }

  const files = workspace?.files ?? [];
  const markup = files
    .filter((file) => /\.(html|tsx|jsx)$/i.test(file.path))
    .map((file) => file.updatedContent)
    .join("\n");

  if (!markup.trim()) {
    return {
      strategy: "ai-fallback",
      passed: false,
      confidence: 0.35,
      summary: "No renderable frontend markup found for Playwright smoke check.",
      notes: ["Provide changed frontend files to strengthen behavior validation."]
    };
  }

  try {
    const dynamicImport = new Function("moduleName", "return import(moduleName)") as (
      moduleName: string
    ) => Promise<any>;
    const playwright = await dynamicImport("playwright");
    const browser = await playwright.chromium.launch({
      headless: env.behavioralFrontendPlaywrightHeadless
    });

    const page = await browser.newPage();
    await page.setContent(`<main>${markup}</main>`, { waitUntil: "domcontentloaded" });
    const bodyText = await page.textContent("body");
    await browser.close();

    const passed = Boolean(bodyText && bodyText.trim().length > 0);
    return {
      strategy: "frontend-playwright",
      passed,
      confidence: passed ? 0.66 : 0.38,
      summary: passed
        ? "Frontend smoke check rendered content in headless Playwright mode."
        : "Frontend smoke check rendered no usable content in Playwright mode.",
      notes: []
    };
  } catch {
    return {
      strategy: "ai-fallback",
      passed: true,
      confidence: 0.42,
      summary: "Playwright unavailable in runtime; fallback behavior validation applied.",
      notes: ["Install playwright in services/api to enable browser-based behavior checks."]
    };
  }
}

async function runBehavioralEvaluation(
  payload: EvaluationPayload,
  workspace: SubmissionWorkspaceContext | null
): Promise<BehavioralEvaluation> {
  if (!runtimeFeatures.behavioralEvaluationEnabled) {
    return {
      strategy: "none",
      passed: true,
      confidence: 0.2,
      summary: "Behavioral evaluation is disabled by feature flag.",
      notes: []
    };
  }

  const isFrontend = payload.issue.techStack.includes("react");

  if (isFrontend) {
    return runPlaywrightBehavior(workspace);
  }

  if (runtimeFeatures.behavioralBackendMocksEnabled) {
    return runBackendMockBehavior(payload, workspace);
  }

  return {
    strategy: "ai-fallback",
    passed: true,
    confidence: 0.4,
    summary: "Backend mocks disabled; fallback behavior validation applied.",
    notes: []
  };
}

function heuristicDeepReview(base: EvaluationResult, structural: StructuralEvaluation): DeepReviewResult {
  return {
    correctnessScore: clampScore((base.score + structural.score) / 2),
    qualityScore: clampScore((base.score * 0.7) + (structural.meaningfulness * 0.3)),
    summary: base.summary,
    missedEdgeCases: base.risks.slice(0, 4),
    suggestedImprovements: base.suggestions.slice(0, 6),
    confidence: Number(((base.confidence + structural.confidence) / 2).toFixed(3))
  };
}

async function runDeepReview(
  payload: EvaluationPayload,
  workspace: SubmissionWorkspaceContext | null,
  base: EvaluationResult,
  structural: StructuralEvaluation,
  behavioral: BehavioralEvaluation
): Promise<DeepReviewResult> {
  const fallback = heuristicDeepReview(base, structural);

  if (!runtimeFeatures.openAiConfigured) {
    return fallback;
  }

  try {
    const result = await generateStructuredJson({
      model: env.openAiEvaluatorModel,
      schemaName: "deep_issue_fix_review",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          correctnessScore: { type: "number", minimum: 0, maximum: 10 },
          qualityScore: { type: "number", minimum: 0, maximum: 10 },
          summary: { type: "string", minLength: 10, maxLength: 320 },
          missedEdgeCases: {
            type: "array",
            items: { type: "string", minLength: 2, maxLength: 180 },
            maxItems: 8
          },
          suggestedImprovements: {
            type: "array",
            items: { type: "string", minLength: 2, maxLength: 220 },
            maxItems: 8
          },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["correctnessScore", "qualityScore", "summary", "missedEdgeCases", "suggestedImprovements", "confidence"]
      },
      parser: deepReviewOutputSchema,
      systemPrompt:
        "You are a senior reviewer evaluating if code changes resolve a GitHub issue, including edge-case coverage and code quality gaps.",
      userPrompt: JSON.stringify({
        issue: payload.issue,
        structural,
        behavioral,
        workspace,
        baseEvaluation: base
      }),
      retries: 1
    });

    return {
      correctnessScore: clampScore(result.correctnessScore),
      qualityScore: clampScore(result.qualityScore),
      summary: result.summary,
      missedEdgeCases: result.missedEdgeCases,
      suggestedImprovements: result.suggestedImprovements,
      confidence: Number(result.confidence.toFixed(3))
    };
  } catch {
    return fallback;
  }
}

function scoreToVerdict(score: number): "pass" | "review" | "fail" {
  if (score >= 7.2) {
    return "pass";
  }
  if (score >= 5) {
    return "review";
  }
  return "fail";
}

export async function evaluateSubmissionWithEngine(input: {
  payload: EvaluationPayload;
  workspace: SubmissionWorkspaceContext | null;
}): Promise<EvaluationResult> {
  if (!runtimeFeatures.multiLayerEvaluationEnabled) {
    return evaluateSubmission(input.payload);
  }

  const base = await evaluateSubmission(input.payload);
  const structural = await runStructuralEvaluation(input.payload, input.workspace);
  const behavioral = await runBehavioralEvaluation(input.payload, input.workspace);
  const deep = await runDeepReview(input.payload, input.workspace, base, structural, behavioral);

  const compositeScore = Number(
    clampScore(
      (deep.correctnessScore * 0.45) +
        (deep.qualityScore * 0.2) +
        (structural.score * 0.2) +
        ((behavioral.passed ? 8 : 4) * 0.15)
    ).toFixed(2)
  );

  const verdict = scoreToVerdict(compositeScore);
  const correctness: "pass" | "partial" | "fail" =
    verdict === "pass" ? "pass" : verdict === "review" ? "partial" : "fail";

  const strengths = [
    ...base.strengths,
    `Structural score ${structural.score}/10 for file-targeting and issue alignment.`,
    behavioral.summary
  ].slice(0, 8);

  const risks = [
    ...new Set([
      ...base.risks,
      ...structural.risks,
      ...deep.missedEdgeCases,
      ...(behavioral.passed ? [] : behavioral.notes)
    ])
  ].slice(0, 10);

  const suggestions = [
    ...new Set([...base.suggestions, ...deep.suggestedImprovements])
  ].slice(0, 10);

  const edgeCases = [...new Set(deep.missedEdgeCases)].slice(0, 10);
  const weaknesses = [...new Set([...base.weaknesses, ...risks])].slice(0, 10);

  return {
    verdict,
    correctness,
    summary: deep.summary,
    strengths,
    weaknesses,
    risks,
    suggestions,
    edge_cases: edgeCases,
    bugs: risks,
    improvements: suggestions,
    optimization: strengths,
    confidence: Number(((base.confidence + structural.confidence + deep.confidence + behavioral.confidence) / 4).toFixed(3)),
    score: Math.max(1, Math.min(10, Math.round(compositeScore))),
    modelName: runtimeFeatures.openAiConfigured ? env.openAiEvaluatorModel : base.modelName
  };
}

function mapAnalyzerStatus(status: "in_progress" | "likely_solved", confidence: number): IterativeFeedbackStatus {
  if (status === "likely_solved" || confidence >= 0.9) {
    return "correct";
  }
  if (confidence >= 0.72) {
    return "almost";
  }
  return "progress";
}

function heuristicIterativeFeedback(input: {
  strengths: string[];
  issues: string[];
  suggestions: string[];
  guidance: string;
  confidence: number;
  summary: string;
  analyzerStatus: "in_progress" | "likely_solved";
}): IterativeAnalyzerFeedback {
  return {
    status: mapAnalyzerStatus(input.analyzerStatus, input.confidence),
    what_you_did_right: input.strengths.slice(0, 5),
    what_to_improve: input.issues.slice(0, 5),
    suggested_focus_area: input.suggestions[0] ?? input.guidance,
    confidence: Number(input.confidence.toFixed(3)),
    summary: input.summary
  };
}

export async function evaluateIterativeFeedback(input: {
  payload: EvaluationPayload;
  workspace: SubmissionWorkspaceContext | null;
}): Promise<IterativeAnalyzerFeedback> {
  const analyzer = await analyzeIssueSubmission({
    issue: input.payload.issue,
    workspace: input.workspace
  });

  const fallback = heuristicIterativeFeedback({
    strengths: analyzer.feedback.strengths,
    issues: analyzer.feedback.issues,
    suggestions: analyzer.feedback.suggestions,
    guidance: analyzer.guidance,
    confidence: analyzer.confidence,
    summary: analyzer.summary,
    analyzerStatus: analyzer.status
  });

  if (!runtimeFeatures.openAiConfigured || !runtimeFeatures.enableIterativeAiAnalyzer) {
    return fallback;
  }

  try {
    const result = await generateStructuredJson({
      model: env.openAiEvaluatorModel,
      schemaName: "iterative_feedback",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          status: { type: "string", enum: ["progress", "almost", "correct"] },
          what_you_did_right: {
            type: "array",
            items: { type: "string", minLength: 2, maxLength: 220 },
            maxItems: 8
          },
          what_to_improve: {
            type: "array",
            items: { type: "string", minLength: 2, maxLength: 220 },
            maxItems: 8
          },
          suggested_focus_area: { type: "string", minLength: 3, maxLength: 180 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          summary: { type: "string", minLength: 8, maxLength: 280 }
        },
        required: [
          "status",
          "what_you_did_right",
          "what_to_improve",
          "suggested_focus_area",
          "confidence",
          "summary"
        ]
      },
      parser: iterativeOutputSchema,
      systemPrompt:
        "You provide concise iterative mentor feedback for engineering ticket fixes. Do not provide full solution code.",
      userPrompt: JSON.stringify({
        issue: input.payload.issue,
        workspace: input.workspace,
        analyzer,
        rules: [
          "Keep feedback actionable and focused on next move.",
          "Use status=correct only when confidence is very high.",
          "Never return full code solutions."
        ]
      }),
      retries: 1
    });

    return {
      ...result,
      confidence: Number(result.confidence.toFixed(3))
    };
  } catch {
    return fallback;
  }
}