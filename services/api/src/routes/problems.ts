import { Router } from "express";
import { z } from "zod";

import type { CuratedDifficulty, CuratedSkill } from "@growthengine/shared";

import { discoverProblems, discoverProblemsFromRepositories } from "../services/problems/discovery-service";

const discoverQuerySchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  skill: z.enum(["frontend", "backend", "fullstack", "devops"]).optional(),
  page: z.coerce.number().min(1).optional(),
  pageSize: z.coerce.number().min(1).max(48).optional()
});

export const problemsRouter = Router();

problemsRouter.get("/discover", async (req, res) => {
  const parsed = discoverQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await discoverProblems({
      difficulty: parsed.data.difficulty as CuratedDifficulty | undefined,
      skill: parsed.data.skill as CuratedSkill | undefined,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize
    });

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to discover problems";
    return res.status(500).json({ error: message });
  }
});

problemsRouter.post("/discover/refresh", async (_req, res) => {
  try {
    const result = await discoverProblemsFromRepositories();
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refresh curated problems";
    return res.status(500).json({ error: message });
  }
});
