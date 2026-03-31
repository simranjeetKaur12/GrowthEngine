import { z } from "zod";

import type { IssueRecord } from "@growthengine/shared";
import { env } from "../config";

const githubIssueSchema = z.object({
  id: z.number(),
  title: z.string(),
  body: z.string().nullable().default(""),
  html_url: z.string().url(),
  labels: z.array(z.object({ name: z.string() })).default([]),
  pull_request: z.unknown().optional()
});

function normalizeRepository(repoFullName: string) {
  return repoFullName.trim().replace(/^https:\/\/github\.com\//i, "").replace(/\/+$/, "");
}

function sanitizeIssueBody(body: string | null | undefined) {
  return (body ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 $2")
    .replace(/[>#*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchGithubIssues(repoFullName: string): Promise<IssueRecord[]> {
  const normalizedRepo = normalizeRepository(repoFullName);
  const allIssues = [];

  for (let page = 1; page <= 4; page += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const url = `https://api.github.com/repos/${normalizedRepo}/issues?state=open&per_page=50&page=${page}`;

      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          ...(env.githubToken ? { Authorization: `Bearer ${env.githubToken}` } : {})
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`GitHub request failed with status ${response.status}`);
      }

      const data = await response.json();
      const parsed = z.array(githubIssueSchema).parse(data);
      allIssues.push(...parsed);

      if (parsed.length < 50) {
        break;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!allIssues.length) {
    return [];
  }

  return allIssues
    .filter((issue) => !issue.pull_request)
    .filter((issue) => !issue.title.toLowerCase().startsWith("[meta]"))
    .map((issue) => ({
      id: issue.id,
      repositoryFullName: normalizedRepo,
      title: issue.title.trim(),
      body: sanitizeIssueBody(issue.body),
      labels: issue.labels.map((label) => label.name),
      url: issue.html_url
    }));
}
