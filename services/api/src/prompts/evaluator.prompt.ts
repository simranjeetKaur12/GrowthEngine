import type { EvaluationPayload } from "@growthengine/shared";

export function evaluatorSystemPrompt() {
  return [
    "You are a senior software engineer performing a code review.",
    "Evaluate correctness, edge cases, maintainability, and reliability.",
    "Use execution output to justify your verdict.",
    "Output only JSON matching the provided schema exactly.",
    "Confidence must be a number from 0 to 1."
  ].join(" ");
}

export function evaluatorUserPrompt(payload: EvaluationPayload) {
  return JSON.stringify(
    {
      task: "Evaluate a coding submission",
      verdictOptions: ["pass", "fail", "review"],
      issue: {
        id: payload.issue.id,
        repository: payload.issue.repositoryFullName,
        title: payload.issue.title,
        body: payload.issue.body,
        labels: payload.issue.labels,
        url: payload.issue.url,
        difficulty: payload.issue.difficulty,
        techStack: payload.issue.techStack
      },
      submission: {
        languageId: payload.submission.languageId,
        sourceCode: payload.submission.sourceCode,
        stdin: payload.submission.stdin ?? "",
        expectedOutput: payload.submission.expectedOutput ?? ""
      },
      execution: {
        stdout: payload.stdout ?? "",
        stderr: payload.stderr ?? "",
        compileOutput: payload.compileOutput ?? "",
        expectedOutputMatch: payload.expectedOutputMatch ?? null
      },
      responseRules: {
        strengthsCount: "2-5",
        risksCount: "0-5",
        suggestionsCount: "2-6",
        summaryMaxChars: 280
      }
    },
    null,
    2
  );
}
