import { env } from "../../config";

type GithubIssueApiRecord = {
  id: number;
  title: string;
  body: string | null;
  html_url: string;
  labels?: Array<{ name?: string }>;
  pull_request?: unknown;
};

function cleanBody(body: string | null | undefined) {
  return (body ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]+\]\(([^)]+)\)/g, "$1")
    .replace(/[#>*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchRepositoryIssues(repoFullName: string, maxPages = 3) {
  const results: GithubIssueApiRecord[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${repoFullName}/issues?state=open&per_page=50&page=${page}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            ...(env.githubToken ? { Authorization: `Bearer ${env.githubToken}` } : {})
          },
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub request failed for ${repoFullName} (${response.status})`);
      }

      const data = (await response.json()) as GithubIssueApiRecord[];
      if (!Array.isArray(data) || !data.length) {
        break;
      }

      results.push(...data);

      if (data.length < 50) {
        break;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return results
    .filter((item) => !item.pull_request)
    .map((item) => ({
      id: item.id,
      repositoryFullName: repoFullName,
      title: item.title,
      body: cleanBody(item.body),
      labels: (item.labels ?? []).map((label) => label.name ?? "").filter(Boolean),
      url: item.html_url
    }));
}
