import type { CuratedDifficulty, CuratedSkill } from "@growthengine/shared";

import { fetchRepositoryIssues } from "../github/discovery-client";
import { listDiscoveredProblems, upsertDiscoveredProblems } from "./problem-store";
import { classifyIssues } from "../../modules/classifier";
import { adaptIssuesForBeginners } from "../../modules/problem-adapter";
import { upsertIssues } from "../../modules/store";
import { materializeDiscoveredProblems } from "./materialize";

const defaultRepos = [
  "facebook/react",
  "vercel/next.js",
  "nodejs/node",
  "microsoft/vscode",
  "django/django"
];

export async function discoverProblemsFromRepositories(repositories = defaultRepos) {
  const fetched = await Promise.allSettled(repositories.map((repo) => fetchRepositoryIssues(repo)));
  const rawIssues = fetched.flatMap((result) => (result.status === "fulfilled" ? result.value : []));

  const classified = await classifyIssues(rawIssues);
  const adapted = await adaptIssuesForBeginners(classified);
  await upsertIssues(adapted);
  const discovered = materializeDiscoveredProblems(adapted);

  await upsertDiscoveredProblems(discovered);

  return {
    repositories,
    discoveredCount: discovered.length
  };
}

export async function discoverProblems(filters: {
  difficulty?: CuratedDifficulty;
  skill?: CuratedSkill;
  page?: number;
  pageSize?: number;
}) {
  return listDiscoveredProblems(filters);
}
