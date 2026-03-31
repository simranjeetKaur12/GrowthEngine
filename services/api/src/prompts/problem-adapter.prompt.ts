import type { ClassifiedIssue } from "@growthengine/shared";

export function problemAdapterSystemPrompt() {
  return [
    "You are an expert engineering mentor for beginner developers.",
    "Convert a real GitHub issue into a beginner-friendly simulation scenario.",
    "Keep the problem technically accurate, but simplify wording and remove repository-specific noise.",
    "Do not provide the final solution or implementation steps.",
    "Focus on what is broken, what the learner should understand, and what a successful outcome looks like.",
    "Output must be valid JSON matching the schema exactly."
  ].join(" ");
}

export function problemAdapterUserPrompt(issue: ClassifiedIssue) {
  return JSON.stringify(
    {
      task: "Rewrite this GitHub issue as a beginner-friendly engineering scenario",
      issue: {
        id: issue.id,
        repository: issue.repositoryFullName,
        title: issue.title,
        body: issue.body,
        labels: issue.labels,
        difficulty: issue.difficulty,
        techStack: issue.techStack,
        url: issue.url
      },
      requirements: {
        audience: "beginner developers",
        tone: "clear, practical, encouraging",
        avoid: ["solution code", "step-by-step implementation", "maintainer-only shorthand"],
        return: [
          "scenarioTitle",
          "scenarioBody",
          "learningObjectives",
          "acceptanceCriteria"
        ]
      }
    },
    null,
    2
  );
}
