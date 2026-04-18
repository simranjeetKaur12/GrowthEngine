import { Router } from "express";
import { z } from "zod";

import { fetchGithubIssues, normalizeRepositoryInput } from "../integrations/github";
import { classifyIssues } from "../modules/classifier";
import { buildGuidedIssueContext } from "../modules/guided-context";
import { adaptIssuesForBeginners } from "../modules/problem-adapter";
import { getIssueById, listIssues, upsertIssues } from "../modules/store";
import { materializeDiscoveredProblems } from "../services/problems/materialize";
import { upsertDiscoveredProblems } from "../services/problems/problem-store";

const ingestSchema = z.object({
  repository: z.string().trim().min(3, "Repository is required")
});

export const issueRouter = Router();

issueRouter.post("/ingest", async (req, res) => {
  const parsed = ingestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  let normalizedRepository = "";
  try {
    normalizedRepository = normalizeRepositoryInput(parsed.data.repository);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Repository format is invalid";
    return res.status(400).json({ error: message });
  }

  try {
    const rawIssues = await fetchGithubIssues(normalizedRepository);
    const classified = await classifyIssues(rawIssues);
    const adapted = await adaptIssuesForBeginners(classified);
    await upsertIssues(adapted);
    await upsertDiscoveredProblems(materializeDiscoveredProblems(adapted));

    return res.json({
      repository: normalizedRepository,
      fetched: rawIssues.length,
      ingested: adapted.length,
      problemsCreated: adapted.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion error";
    return res.status(500).json({ error: message });
  }
});

issueRouter.get("/", async (req, res) => {
  const difficulty = req.query.difficulty as string | undefined;
  const stack = req.query.stack as string | undefined;

  try {
    const items = await listIssues({ difficulty, stack });
    return res.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list issues";
    return res.status(500).json({ error: message });
  }
});

issueRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Issue id must be numeric" });
  }

  try {
    const issue = await getIssueById(id);
    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }

    const guidedContext = await buildGuidedIssueContext(issue);
    return res.json({
      item: {
        ...issue,
        guided_context: guidedContext
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load issue";
    return res.status(500).json({ error: message });
  }
});
