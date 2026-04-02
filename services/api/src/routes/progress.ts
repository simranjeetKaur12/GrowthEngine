import { Router } from "express";

import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { getUserProgressOverview } from "../modules/store";

export const progressRouter = Router();

progressRouter.use(requireAuth);

progressRouter.get("/overview", async (req: AuthenticatedRequest, res) => {
  try {
    const overview = await getUserProgressOverview(req.authUserId ?? "demo-user");
    return res.json(overview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load progress overview";
    return res.status(500).json({ error: message });
  }
});
