import { z } from "zod";

import type { ClassifiedIssue } from "@growthengine/shared";

import { env } from "../config";
import { generateStructuredJson } from "../integrations/openai";
import {
  problemAdapterSystemPrompt,
  problemAdapterUserPrompt
} from "../prompts/problem-adapter.prompt";
import type { BeginnerScenarioFields, ClassifiedIssueWithMetadata } from "./classifier";

const adapterOutputSchema = z
  .object({
    scenarioTitle: z.string().min(8).max(120),
    scenarioBody: z.string().min(40).max(900),
    learningObjectives: z.array(z.string().min(6).max(160)).min(2).max(4),
    acceptanceCriteria: z.array(z.string().min(6).max(200)).min(3).max(5)
  })
  .strict();

const adapterJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    scenarioTitle: { type: "string", minLength: 8, maxLength: 120 },
    scenarioBody: { type: "string", minLength: 40, maxLength: 900 },
    learningObjectives: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string", minLength: 6, maxLength: 160 }
    },
    acceptanceCriteria: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: { type: "string", minLength: 6, maxLength: 200 }
    }
  },
  required: ["scenarioTitle", "scenarioBody", "learningObjectives", "acceptanceCriteria"]
} as const;

function sentenceCase(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function fallbackScenario(issue: ClassifiedIssue): Pick<
  BeginnerScenarioFields,
  "scenarioTitle" | "scenarioBody" | "learningObjectives" | "acceptanceCriteria"
> {
  const shortBody = issue.body
    ? issue.body.slice(0, 420).trim()
    : "The current behavior does not match what the project expects.";
  const stackLabel = issue.techStack[0] ?? "software";

  return {
    scenarioTitle: `Simulation: ${issue.title}`,
    scenarioBody: [
      `You are working on the ${issue.repositoryFullName} codebase.`,
      `A maintainer reported a ${issue.difficulty} difficulty problem in the ${stackLabel} area.`,
      sentenceCase(shortBody),
      "Your goal is to understand the reported behavior, make the system safer or more correct, and prepare a fix that could be contributed upstream."
    ].join(" "),
    learningObjectives: [
      "Understand the reported behavior and expected outcome",
      "Identify the part of the code that likely needs a fix",
      "Think about edge cases before proposing changes"
    ],
    acceptanceCriteria: [
      "The bug or incorrect behavior is clearly addressed",
      "The change is understandable to another engineer reviewing it",
      "Edge cases or regressions are considered before contribution"
    ]
  };
}

export async function adaptIssuesForBeginners(
  issues: ClassifiedIssueWithMetadata[]
): Promise<ClassifiedIssueWithMetadata[]> {
  const modelName = env.openAiClassifierModel;

  const tasks = issues.map(async (issue) => {
    try {
      const result = await generateStructuredJson({
        model: modelName,
        schemaName: "beginner_problem_adaptation",
        schema: adapterJsonSchema,
        parser: adapterOutputSchema,
        systemPrompt: problemAdapterSystemPrompt(),
        userPrompt: problemAdapterUserPrompt(issue),
        retries: 2
      });

      return {
        ...issue,
        scenarioTitle: result.scenarioTitle,
        scenarioBody: result.scenarioBody,
        learningObjectives: result.learningObjectives,
        acceptanceCriteria: result.acceptanceCriteria
      } satisfies ClassifiedIssueWithMetadata;
    } catch {
      return {
        ...issue,
        ...fallbackScenario(issue)
      } satisfies ClassifiedIssueWithMetadata;
    }
  });

  return Promise.all(tasks);
}
