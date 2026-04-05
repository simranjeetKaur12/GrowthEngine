import "dotenv/config";

import { classifyIssues } from "../modules/classifier";
import { adaptIssuesForBeginners } from "../modules/problem-adapter";
import { listIssues, upsertIssues } from "../modules/store";
import { fetchGithubIssues } from "../integrations/github";
import { env, runtimeFeatures } from "../config";
import { materializeDiscoveredProblems } from "../services/problems/materialize";
import { listDiscoveredProblems, upsertDiscoveredProblems } from "../services/problems/problem-store";

async function main() {
  const repository = process.argv[2]?.trim() || "vercel/next.js";

  console.log(`[verify:ingestion] Repository: ${repository}`);
  console.log(
    `[verify:ingestion] Runtime: supabase=${runtimeFeatures.supabaseConfigured} openai=${runtimeFeatures.openAiConfigured} githubToken=${Boolean(env.githubToken)}`
  );

  const issues = await fetchGithubIssues(repository);
  console.log(`[verify:ingestion] Fetched ${issues.length} open issues from GitHub.`);

  if (!issues.length) {
    console.log("[verify:ingestion] No issues fetched. Nothing to ingest.");
    return;
  }

  const sample = issues.slice(0, 5);
  const classified = await classifyIssues(sample);
  const adapted = await adaptIssuesForBeginners(classified);
  console.log(`[verify:ingestion] Classified and adapted ${adapted.length} issues.`);

  await upsertIssues(adapted);
  const problems = materializeDiscoveredProblems(adapted);
  await upsertDiscoveredProblems(problems);

  const storedIssues = await listIssues();
  const storedProblems = await listDiscoveredProblems({ page: 1, pageSize: 10 });

  console.log(`[verify:ingestion] Stored issues available: ${storedIssues.length}`);
  console.log(`[verify:ingestion] Stored problems available: ${storedProblems.total}`);
  console.log("[verify:ingestion] Sample classified problems:");

  for (const problem of problems.slice(0, 3)) {
    console.log(
      `- ${problem.title} | difficulty=${problem.difficulty} | stack=${problem.stack} | skills=${problem.skills.join(",")}`
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[verify:ingestion] Failed: ${message}`);
  process.exit(1);
});
