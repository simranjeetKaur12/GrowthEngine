import type { EvaluationPayload } from "@growthengine/shared";
import { z } from "zod";

import { generateStructuredJson } from "../integrations/openai";
import { evaluatorSystemPrompt, evaluatorUserPrompt } from "../prompts/evaluator.prompt";

export interface EvaluationResult {
  verdict: "pass" | "fail" | "review";
  correctness: "pass" | "fail" | "partial";
  summary: string;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  suggestions: string[];
  edge_cases: string[];
  bugs: string[];
  improvements: string[];
  optimization: string[];
  confidence: number;
  score: number;
  modelName: string;
}

const evaluatorOutputSchema = z
  .object({
    verdict: z.enum(["pass", "fail", "review"]),
    summary: z.string().min(10).max(280),
    strengths: z.array(z.string().min(2).max(180)).min(1).max(6),
    risks: z.array(z.string().min(2).max(220)).max(6),
    suggestions: z.array(z.string().min(2).max(220)).min(1).max(8),
    confidence: z.number().min(0).max(1)
  })
  .strict();

const evaluatorJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: { type: "string", enum: ["pass", "fail", "review"] },
    summary: { type: "string", minLength: 10, maxLength: 280 },
    strengths: {
      type: "array",
      items: { type: "string", minLength: 2, maxLength: 180 },
      minItems: 1,
      maxItems: 6
    },
    risks: {
      type: "array",
      items: { type: "string", minLength: 2, maxLength: 220 },
      maxItems: 6
    },
    suggestions: {
      type: "array",
      items: { type: "string", minLength: 2, maxLength: 220 },
      minItems: 1,
      maxItems: 8
    },
    confidence: { type: "number", minimum: 0, maximum: 1 }
  },
  required: ["verdict", "summary", "strengths", "risks", "suggestions", "confidence"]
} as const;

function fallbackEvaluation(input: EvaluationPayload): EvaluationResult {
  const hasRuntimeError = Boolean(input.stderr || input.compileOutput);
  const hasOutput = Boolean(input.stdout && input.stdout.trim().length > 0);

  if (hasRuntimeError) {
    return {
      verdict: "fail",
      correctness: "fail",
      summary: "Execution failed. Fix runtime or compilation issues first.",
      strengths: ["Submission was executed in sandbox"],
      weaknesses: ["Execution produced runtime or compilation errors."],
      risks: [input.stderr ?? input.compileOutput ?? "Unknown execution issue"],
      suggestions: [
        "Reproduce the failing case locally with the same input.",
        "Add guards for null, empty, and invalid inputs.",
        "Write small unit tests before resubmitting."
      ],
      edge_cases: ["Null or malformed input handling"],
      bugs: [input.stderr ?? input.compileOutput ?? "Unknown execution issue"],
      improvements: [
        "Add guards for null, empty, and invalid inputs.",
        "Write small unit tests before resubmitting."
      ],
      optimization: ["Focus on correctness before optimization."],
      confidence: 0.4,
      score: 2,
      modelName: "fallback-rule-v1"
    };
  }

  return {
    verdict: hasOutput ? "pass" : "review",
    correctness: hasOutput ? "pass" : "partial",
    summary: hasOutput
      ? "Submission ran successfully with output. Validate against edge cases before PR."
      : "Submission executed but output is empty; expected behavior should be reviewed.",
    strengths: ["Code executes without sandbox errors"],
    weaknesses: hasOutput ? [] : ["Output path may be missing or incorrect"],
    risks: hasOutput ? [] : ["Output path may be missing or incorrect"],
    suggestions: [
      "Add tests for empty input, malformed input, and large payloads.",
      "Document algorithm complexity and tradeoffs.",
      "Match coding style and conventions from the target repository."
    ],
    edge_cases: ["Empty input", "Malformed input", "Large payload handling"],
    bugs: hasOutput ? [] : ["Output path may be missing or incorrect"],
    improvements: [
      "Add tests for empty input, malformed input, and large payloads.",
      "Match coding style and conventions from the target repository."
    ],
    optimization: ["Document algorithm complexity and tradeoffs."],
    confidence: 0.45,
    score: hasOutput ? 7 : 5,
    modelName: "fallback-rule-v1"
  };
}

export async function evaluateSubmission(input: EvaluationPayload): Promise<EvaluationResult> {
  const modelName = process.env.OPENAI_MODEL_EVALUATOR ?? "gpt-4.1";

  try {
    const llmResult = await generateStructuredJson({
      model: modelName,
      schemaName: "submission_evaluation",
      schema: evaluatorJsonSchema,
      parser: evaluatorOutputSchema,
      systemPrompt: evaluatorSystemPrompt(),
      userPrompt: evaluatorUserPrompt(input),
      retries: 2
    });

    return {
      verdict: llmResult.verdict,
      correctness: llmResult.verdict === "review" ? "partial" : llmResult.verdict,
      summary: llmResult.summary,
      strengths: llmResult.strengths,
      weaknesses: llmResult.risks,
      risks: llmResult.risks,
      suggestions: llmResult.suggestions,
      edge_cases: llmResult.risks,
      bugs: llmResult.risks,
      improvements: llmResult.suggestions,
      optimization: llmResult.strengths,
      confidence: Number(llmResult.confidence.toFixed(3)),
      score: llmResult.verdict === "pass" ? 8 : llmResult.verdict === "review" ? 6 : 3,
      modelName
    };
  } catch {
    return fallbackEvaluation(input);
  }
}
