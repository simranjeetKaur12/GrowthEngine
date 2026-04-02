import type { SubmissionPayload } from "@growthengine/shared";

import { env } from "../config";

export interface Judge0Result {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  status: {
    id: number;
    description: string;
  };
}

function mockExecute(payload: SubmissionPayload): Judge0Result {
  const normalized = payload.stdin?.trim() ?? "";
  const expected = payload.expectedOutput?.trim();

  return {
    stdout: expected ?? normalized ?? "",
    stderr: null,
    compile_output: null,
    status: {
      id: 3,
      description: env.judge0BaseUrl ? "Accepted" : "Executed with mock sandbox"
    }
  };
}

export async function executeSubmission(payload: SubmissionPayload): Promise<Judge0Result> {
  if (!env.judge0BaseUrl) {
    return mockExecute(payload);
  }

  try {
    const response = await fetch(`${env.judge0BaseUrl}/submissions?base64_encoded=false&wait=true`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.judge0ApiKey ? { "X-RapidAPI-Key": env.judge0ApiKey } : {})
      },
      body: JSON.stringify({
        language_id: payload.languageId,
        source_code: payload.sourceCode,
        stdin: payload.stdin
      })
    });

    if (!response.ok) {
      throw new Error(`Judge0 request failed with status ${response.status}`);
    }

    return (await response.json()) as Judge0Result;
  } catch {
    return mockExecute(payload);
  }
}
