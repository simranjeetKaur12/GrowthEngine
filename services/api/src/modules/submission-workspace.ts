export type WorkspaceFileEdit = {
  path: string;
  language?: string;
  originalContent?: string;
  updatedContent: string;
  diff?: string;
};

export type SubmissionWorkspaceContext = {
  repository?: string;
  issueUrl?: string;
  notes?: string;
  files: WorkspaceFileEdit[];
};

const WORKSPACE_SENTINEL_START = "\n\n[GE_WORKSPACE_META]";
const WORKSPACE_SENTINEL_END = "[/GE_WORKSPACE_META]";

export function packSourceWithWorkspace(
  sourceCode: string,
  workspace?: SubmissionWorkspaceContext
) {
  if (!workspace?.files?.length) {
    return sourceCode;
  }

  const encoded = Buffer.from(JSON.stringify(workspace), "utf8").toString("base64");
  return `${sourceCode}${WORKSPACE_SENTINEL_START}${encoded}${WORKSPACE_SENTINEL_END}`;
}

export function unpackSourceWorkspace(rawSourceCode: string): {
  sourceCode: string;
  workspace: SubmissionWorkspaceContext | null;
} {
  const startIndex = rawSourceCode.indexOf(WORKSPACE_SENTINEL_START);
  const endIndex = rawSourceCode.indexOf(WORKSPACE_SENTINEL_END);

  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    return { sourceCode: rawSourceCode, workspace: null };
  }

  const cleanSourceCode = rawSourceCode.slice(0, startIndex);
  const encoded = rawSourceCode
    .slice(startIndex + WORKSPACE_SENTINEL_START.length, endIndex)
    .trim();

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as SubmissionWorkspaceContext;
    if (!Array.isArray(parsed?.files)) {
      return { sourceCode: cleanSourceCode, workspace: null };
    }

    return { sourceCode: cleanSourceCode, workspace: parsed };
  } catch {
    return { sourceCode: cleanSourceCode, workspace: null };
  }
}