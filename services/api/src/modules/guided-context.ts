import type { ClassifiedIssue, GuidedIssueContext } from "@growthengine/shared";
import { z } from "zod";

import { env, runtimeFeatures } from "../config";
import { fetchRepositoryFilePaths } from "../integrations/github";
import { generateStructuredJson } from "../integrations/openai";

const guidedContextSchema = z
  .object({
    what_is_broken: z.string().min(12).max(260),
    where_to_fix: z.array(z.string().min(3).max(180)).min(2).max(5),
    hint: z.string().min(8).max(220),
    expected_outcome: z.string().min(12).max(280)
  })
  .strict();

function inferFileHints(issue: ClassifiedIssue, filePaths: string[]) {
  const text = `${issue.title} ${issue.body} ${issue.labels.join(" ")}`.toLowerCase();
  const candidates = filePaths.length ? filePaths : [];

  const scored = candidates
    .map((path) => {
      const lower = path.toLowerCase();
      let score = 0;

      if (issue.techStack.includes("react") && /(component|page|view|tsx|jsx|hook)/.test(lower)) {
        score += 4;
      }
      if (issue.techStack.includes("nodejs") && /(route|controller|service|api|middleware|handler)/.test(lower)) {
        score += 4;
      }
      if (issue.techStack.includes("python") && /(py|test|service|app|main)/.test(lower)) {
        score += 4;
      }
      if (issue.techStack.includes("database") && /(db|sql|schema|migration|model)/.test(lower)) {
        score += 3;
      }
      if (/(test|spec)/.test(lower)) {
        score += 1;
      }
      if (text.includes("test") && /(test|spec)/.test(lower)) {
        score += 1;
      }

      return { path, score };
    })
    .sort((left, right) => right.score - left.score)
    .map((item) => item.path);

  return scored.slice(0, 5);
}

function fallbackGuidedContext(issue: ClassifiedIssue, filePaths: string[]): GuidedIssueContext {
  const conciseBody = (issue.scenarioBody ?? issue.body ?? "").trim();
  const shortBody = conciseBody.length > 180 ? `${conciseBody.slice(0, 180)}...` : conciseBody;

  return {
    what_is_broken: shortBody || `${issue.title} is causing behavior that does not match project expectations.`,
    where_to_fix: inferFileHints(issue, filePaths).slice(0, 5),
    hint:
      issue.learningObjectives?.[0] ??
      "Start from the first likely file, trace data flow, and patch the smallest logic branch that fixes the reported behavior.",
    expected_outcome:
      issue.acceptanceCriteria?.[0] ??
      "After the fix, the problematic behavior should be resolved without regressing existing flows."
  };
}

export async function buildGuidedIssueContext(issue: ClassifiedIssue): Promise<GuidedIssueContext> {
  let repositoryFiles: string[] = [];
  try {
    repositoryFiles = await fetchRepositoryFilePaths(issue.repositoryFullName);
  } catch {
    repositoryFiles = [];
  }

  const fallback = fallbackGuidedContext(issue, repositoryFiles);

  if (!runtimeFeatures.guidedContextEnabled) {
    return fallback;
  }

  if (!runtimeFeatures.guidedContextUseAi || !runtimeFeatures.openAiConfigured) {
    return fallback;
  }

  try {
    const result = await generateStructuredJson({
      model: env.openAiEvaluatorModel,
      schemaName: "guided_issue_context",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          what_is_broken: { type: "string", minLength: 12, maxLength: 260 },
          where_to_fix: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            items: { type: "string", minLength: 3, maxLength: 180 }
          },
          hint: { type: "string", minLength: 8, maxLength: 220 },
          expected_outcome: { type: "string", minLength: 12, maxLength: 280 }
        },
        required: ["what_is_broken", "where_to_fix", "hint", "expected_outcome"]
      },
      parser: guidedContextSchema,
      systemPrompt:
        "You are an engineering mentor. Provide short guided learning context for a software issue without revealing full solution code.",
      userPrompt: JSON.stringify({
        issue,
        repositoryFiles,
        fallbackFileHints: inferFileHints(issue, repositoryFiles),
        rules: [
          "Use plain language.",
          "Return 2-5 likely file paths.",
          "Hint must be actionable but not a direct solution.",
          "Expected outcome must describe post-fix behavior."
        ]
      }),
      retries: 1
    });

    return result;
  } catch {
    return fallback;
  }
}