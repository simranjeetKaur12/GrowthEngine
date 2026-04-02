import { Router } from "express";
import { z } from "zod";

import type { UserSettings } from "@growthengine/shared";

import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import {
  createUser,
  deleteUserAccount,
  ensureUserSettings,
  getUser,
  getUserSettings,
  getUserStats,
  updateUserSettings
} from "../services/users/user-store";

const createUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().email()
});

const updateSettingsSchema = z.object({
  defaultLanguage: z.enum(["javascript", "python", "java", "cpp"]).optional(),
  editorTheme: z.enum(["dark", "light"]).optional(),
  fontSize: z.number().int().min(12).max(24).optional(),
  tabSize: z.number().int().min(2).max(8).optional(),
  autoSave: z.boolean().optional(),
  feedbackVerbosity: z.enum(["minimal", "standard", "detailed"]).optional(),
  hintsEnabled: z.boolean().optional(),
  explanationAfterSubmission: z.boolean().optional(),
  skillFocus: z.enum(["frontend", "backend", "ai", "dsa"]).optional(),
  difficultyLevel: z.enum(["easy", "medium", "hard"]).optional(),
  dailyLearningGoal: z.number().int().min(15).max(240).optional(),
  adaptiveLearning: z.boolean().optional(),
  simulationMode: z.enum(["strict", "relaxed"]).optional(),
  preferredRepositoryType: z.enum(["open-source", "curated", "mixed"]).optional(),
  autoGeneratePrGuide: z.boolean().optional(),
  githubConnected: z.boolean().optional(),
  automaticRepoSync: z.boolean().optional()
});

function canManageUser(req: AuthenticatedRequest, userId: string) {
  return req.authUserId === userId || req.authUserId === "demo-user";
}

export const usersRouter = Router();

usersRouter.post("/", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const user = await createUser(parsed.data);
    const settings = await ensureUserSettings(parsed.data.id);
    return res.json({ user, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    return res.status(500).json({ error: message });
  }
});

usersRouter.get("/:id", async (req, res) => {
  try {
    const user = await getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch user";
    return res.status(500).json({ error: message });
  }
});

usersRouter.get("/:id/stats", async (req, res) => {
  try {
    const stats = await getUserStats(req.params.id);
    return res.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch user stats";
    return res.status(500).json({ error: message });
  }
});

usersRouter.get("/:id/settings", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!canManageUser(req, req.params.id)) {
    return res.status(403).json({ error: "Not allowed to access these settings." });
  }

  try {
    const settings = (await getUserSettings(req.params.id)) ?? (await ensureUserSettings(req.params.id));
    return res.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch settings";
    return res.status(500).json({ error: message });
  }
});

usersRouter.patch("/:id/settings", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!canManageUser(req, req.params.id)) {
    return res.status(403).json({ error: "Not allowed to update these settings." });
  }

  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const settings = await updateUserSettings(req.params.id, parsed.data as Partial<UserSettings>);
    return res.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update settings";
    return res.status(500).json({ error: message });
  }
});

usersRouter.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!canManageUser(req, req.params.id)) {
    return res.status(403).json({ error: "Not allowed to delete this account." });
  }

  try {
    const result = await deleteUserAccount(req.params.id);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete account";
    return res.status(500).json({ error: message });
  }
});
