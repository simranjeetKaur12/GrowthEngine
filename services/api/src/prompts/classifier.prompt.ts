import type { IssueRecord } from "@growthengine/shared";

export function classifierSystemPrompt() {
  return [
    "You are a senior triage engineer.",
    "Classify each GitHub issue by difficulty and technology stack.",
    "Output must be valid JSON that matches the provided schema exactly.",
    "Confidence must be a number from 0 to 1 representing certainty.",
    "Reasoning must be concise and grounded in the issue text."
  ].join(" ");
}

export function classifierUserPrompt(issue: IssueRecord) {
  return JSON.stringify(
    {
      task: "Classify this GitHub issue",
      allowedTechStack: ["nodejs", "react", "python", "database", "devops", "other"],
      allowedDifficulty: ["beginner", "intermediate", "advanced"],
      issue: {
        id: issue.id,
        repository: issue.repositoryFullName,
        title: issue.title,
        body: issue.body,
        labels: issue.labels,
        url: issue.url
      }
    },
    null,
    2
  );
}
