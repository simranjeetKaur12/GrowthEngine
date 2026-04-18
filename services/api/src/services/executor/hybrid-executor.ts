import type { ClassifiedIssue, SubmissionPayload } from "@growthengine/shared";

import { runtimeFeatures } from "../../config";
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

function createDeferredIssueResult(): Judge0Result {
  return {
    stdout: null,
    stderr: null,
    compile_output: null,
    status: {
      id: 0,
      description: "Execution deferred to multi-layer issue evaluation"
    }
  };
}

export async function executeWithHybridStrategy(input: {
  issue: ClassifiedIssue;
  submission: SubmissionPayload;
  mode?: "issue-simulation" | "growth-path";
}) {
  const mode = input.mode ?? "issue-simulation";
  const isFrontendProblem = input.issue.techStack.includes("react");

  if (mode === "issue-simulation" && !runtimeFeatures.issueSimulationUsesJudge0) {
    return createDeferredIssueResult();
  }

  if (isFrontendProblem) {
    return createFrontendResult();
  }

  return runJudge0(input.submission);
}
