import type { ClassifiedIssue, SubmissionPayload } from "@growthengine/shared";

import { executeSubmission as runJudge0, type Judge0Result } from "../../integrations/judge0";

function createFrontendResult(): Judge0Result {
  return {
    stdout: null,
    stderr: null,
    compile_output: null,
    status: {
      id: 0,
      description: "Skipped execution for frontend-focused problem"
    }
  };
}

export async function executeWithHybridStrategy(input: {
  issue: ClassifiedIssue;
  submission: SubmissionPayload;
}) {
  const isFrontendProblem = input.issue.techStack.includes("react");

  if (isFrontendProblem) {
    return createFrontendResult();
  }

  return runJudge0(input.submission);
}
