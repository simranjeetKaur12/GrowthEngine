import { z } from "zod";

import type { ClassifiedIssue, Difficulty, IssueRecord, TechStack } from "@growthengine/shared";

import { env } from "../config";
import { generateStructuredJson } from "../integrations/openai";
import { classifierSystemPrompt, classifierUserPrompt } from "../prompts/classifier.prompt";

export type BeginnerScenarioFields = {
  scenarioTitle?: string;
  scenarioBody?: string;
  learningObjectives?: string[];
  acceptanceCriteria?: string[];
};

export type ClassifiedIssueWithMetadata = ClassifiedIssue & {
  modelName?: string;
  reasoning?: string;
} & BeginnerScenarioFields;

const difficultyEnum = z.enum(["beginner", "intermediate", "advanced"]);
const techStackEnum = z.enum(["nodejs", "react", "python", "database", "devops", "other"]);

const classifierOutputSchema = z
  .object({
    difficulty: difficultyEnum,
    techStack: z.array(techStackEnum).min(1),
    confidence: z.number().min(0).max(1),
    reasoning: z.string().min(8).max(400)
  })
  .strict();

const classifierJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    difficulty: {
      type: "string",
      enum: ["beginner", "intermediate", "advanced"]
    },
    techStack: {
      type: "array",
      items: { type: "string", enum: ["nodejs", "react", "python", "database", "devops", "other"] },
      minItems: 1
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    reasoning: {
      type: "string",
      minLength: 8,
      maxLength: 400
    }
  },
  required: ["difficulty", "techStack", "confidence", "reasoning"]
} as const;

function fallbackClassifyIssue(issue: IssueRecord): ClassifiedIssueWithMetadata {
  const text = `${issue.title} ${issue.body} ${issue.labels.join(" ")}`.toLowerCase();

  let difficulty: Difficulty = "beginner";
  if (text.includes("refactor") || text.includes("architecture") || text.includes("performance")) {
    difficulty = "advanced";
  } else if (text.includes("bug") || text.includes("api") || text.includes("feature")) {
    difficulty = "intermediate";
  }

  const stacks: TechStack[] = [];
  if (text.includes("node") || text.includes("express")) stacks.push("nodejs");
  if (text.includes("react") || text.includes("next")) stacks.push("react");
  if (text.includes("python") || text.includes("django") || text.includes("flask")) stacks.push("python");
  if (text.includes("sql") || text.includes("postgres") || text.includes("database")) stacks.push("database");
  if (text.includes("docker") || text.includes("kubernetes") || text.includes("ci")) stacks.push("devops");

  return {
    ...issue,
    difficulty,
    techStack: stacks.length ? stacks : ["other"],
    confidence: 0.35,
    modelName: "fallback-heuristic-v1",
    reasoning: "Fallback classification used because LLM request failed validation."
  };
}

export async function classifyIssues(issues: IssueRecord[]): Promise<ClassifiedIssueWithMetadata[]> {
  const modelName = env.openAiClassifierModel;

  const tasks = issues.map(async (issue) => {
    try {
      const llmResult = await generateStructuredJson({
        model: modelName,
        schemaName: "issue_classification",
        schema: classifierJsonSchema,
        parser: classifierOutputSchema,
        systemPrompt: classifierSystemPrompt(),
        userPrompt: classifierUserPrompt(issue),
        retries: 2
      });

      const dedupedStack = Array.from(new Set(llmResult.techStack));
      return {
        ...issue,
        difficulty: llmResult.difficulty,
        techStack: dedupedStack,
        confidence: Number(llmResult.confidence.toFixed(3)),
        modelName,
        reasoning: llmResult.reasoning
      } satisfies ClassifiedIssueWithMetadata;
    } catch {
      return fallbackClassifyIssue(issue);
    }
  });

  return Promise.all(tasks);
}
