import { z } from "zod";

import { env } from "../config";
import { generateStructuredJson } from "../integrations/openai";

type ContributionDraftInput = {
  repositoryFullName: string;
  issueTitle: string;
  issueUrl: string;
  branchName: string;
  evaluationSummary?: string | null;
  strengths?: string[];
  risks?: string[];
  suggestions?: string[];
};

const contributionDraftSchema = z
  .object({
    commitMessage: z.string().min(10).max(120),
    prTitle: z.string().min(10).max(120),
    prDescription: z.string().min(40).max(1200)
  })
  .strict();

const contributionDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    commitMessage: { type: "string", minLength: 10, maxLength: 120 },
    prTitle: { type: "string", minLength: 10, maxLength: 120 },
    prDescription: { type: "string", minLength: 40, maxLength: 1200 }
  },
  required: ["commitMessage", "prTitle", "prDescription"]
} as const;

function fallbackContributionDraft(input: ContributionDraftInput) {
  const summary = input.evaluationSummary ?? "Validated solution from developer simulation.";
  const suggestionLines = (input.suggestions ?? []).slice(0, 3).map((item) => `- ${item}`).join("\n");
  const riskLines = (input.risks ?? []).slice(0, 2).map((item) => `- ${item}`).join("\n");

  return {
    commitMessage: `fix: resolve ${input.issueTitle.slice(0, 72)}`,
    prTitle: `Fix: ${input.issueTitle}`,
    prDescription: [
      `## Summary`,
      summary,
      ``,
      `## Repository`,
      `- ${input.repositoryFullName}`,
      `- Issue: ${input.issueUrl}`,
      `- Branch: ${input.branchName}`,
      ``,
      `## Notes`,
      suggestionLines || "- Reviewed edge cases and repository conventions.",
      ``,
      `## Risks to Recheck`,
      riskLines || "- Final project-specific tests should be run locally before merge."
    ].join("\n")
  };
}

export async function createContributionDraft(input: ContributionDraftInput) {
  try {
    const prompt = [
      `Repository: ${input.repositoryFullName}`,
      `Issue title: ${input.issueTitle}`,
      `Issue URL: ${input.issueUrl}`,
      `Branch name: ${input.branchName}`,
      `Evaluation summary: ${input.evaluationSummary ?? "No AI evaluation summary available."}`,
      `Strengths: ${(input.strengths ?? []).join("; ") || "None"}`,
      `Risks: ${(input.risks ?? []).join("; ") || "None"}`,
      `Suggestions: ${(input.suggestions ?? []).join("; ") || "None"}`,
      "",
      "Write concise, production-ready git contribution copy."
    ].join("\n");

    const result = await generateStructuredJson({
      model: env.openAiEvaluatorModel,
      schemaName: "contribution_draft",
      schema: contributionDraftJsonSchema,
      parser: contributionDraftSchema,
      systemPrompt:
        "You generate commit messages and PR descriptions for open-source fixes. Be concise, specific, and professional.",
      userPrompt: prompt,
      retries: 1
    });

    return result;
  } catch {
    return fallbackContributionDraft(input);
  }
}
