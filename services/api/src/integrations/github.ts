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

function isValidRepoPart(value: string) {
  return /^[A-Za-z0-9._-]+$/.test(value);
}

export function normalizeRepositoryInput(input: string) {
  const raw = input.trim();
  if (!raw.length) {
    throw new Error("Repository is required.");
  }

  let normalizedPath = raw;

  if (/^https?:\/\//i.test(raw)) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error("Repository URL is invalid. Use a GitHub repository URL or owner/repo.");
    }

    const host = parsed.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") {
      throw new Error("Only github.com repositories are supported.");
    }

    normalizedPath = parsed.pathname;
  }

  normalizedPath = normalizedPath
    .replace(/^github\.com\//i, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new Error("Repository must include both owner and repo (example: vercel/next.js). ");
  }

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, "");

  if (!isValidRepoPart(owner) || !isValidRepoPart(repo)) {
    throw new Error("Repository format is invalid. Use owner/repo or a valid GitHub repository URL.");
  }

  return `${owner}/${repo}`;
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
  const normalizedRepo = normalizeRepositoryInput(repoFullName);
  const allIssues = [];

  for (let page = 1; page <= 1; page += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const url = `https://api.github.com/repos/${normalizedRepo}/issues?state=open&per_page=10&page=${page}`;

      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          ...(env.githubToken ? { Authorization: `Bearer ${env.githubToken}` } : {})
        },
        signal: controller.signal
      });

      if (!response.ok) {
        let details = "";
        try {
          const payload = await response.json() as { message?: string };
          details = payload.message ? `: ${payload.message}` : "";
        } catch {
          details = "";
        }

        throw new Error(`GitHub request failed with status ${response.status}${details}`);
      }

      const data = await response.json();
      const parsed = z.array(githubIssueSchema).parse(data);
      allIssues.push(...parsed);

      if (parsed.length < 10) {
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

export async function fetchRepositoryFilePaths(repoFullName: string): Promise<string[]> {
  const normalizedRepo = normalizeRepositoryInput(repoFullName);

  const repoResponse = await fetch(`https://api.github.com/repos/${normalizedRepo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(env.githubToken ? { Authorization: `Bearer ${env.githubToken}` } : {})
    }
  });

  if (!repoResponse.ok) {
    throw new Error(`GitHub repository lookup failed with status ${repoResponse.status}`);
  }

  const repoData = (await repoResponse.json()) as { default_branch?: string };
  const defaultBranch = repoData.default_branch ?? "main";

  const treeResponse = await fetch(
    `https://api.github.com/repos/${normalizedRepo}/git/trees/${defaultBranch}?recursive=1`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        ...(env.githubToken ? { Authorization: `Bearer ${env.githubToken}` } : {})
      }
    }
  );

  if (!treeResponse.ok) {
    throw new Error(`GitHub tree lookup failed with status ${treeResponse.status}`);
  }

  const treeData = (await treeResponse.json()) as {
    tree?: Array<{ path?: string; type?: string }>;
  };

  return (treeData.tree ?? [])
    .filter((item) => item.type === "blob" && typeof item.path === "string")
    .map((item) => item.path)
    .filter((path) => /\.(ts|tsx|js|jsx|py|java|cpp|cxx|cc|css|json|md)$/i.test(path))
    .filter((path) => !/(node_modules|dist|build|coverage|\.next|target|vendor)\//i.test(path))
    .slice(0, 120);
}
