import { Router } from "express";
import { z } from "zod";

import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { getSimulationSession, startSimulationSession } from "../modules/store";

const startSchema = z.object({
  issueId: z.number()
});

export const simulationRouter = Router();

simulationRouter.use(requireAuth);

simulationRouter.post("/start", async (req: AuthenticatedRequest, res) => {
  const parsed = startSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const session = await startSimulationSession({
      userId: req.authUserId ?? "demo-user",
      issueId: parsed.data.issueId
    });

    return res.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start simulation";
    return res.status(500).json({ error: message });
  }
});

simulationRouter.get("/current", async (req: AuthenticatedRequest, res) => {
  const issueId = Number(req.query.issueId);

  if (!Number.isFinite(issueId)) {
    return res.status(400).json({ error: "issueId query parameter is required" });
  }

  try {
    const session = await getSimulationSession(req.authUserId ?? "demo-user", issueId);
    return res.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load simulation session";
    return res.status(500).json({ error: message });
  }
});
