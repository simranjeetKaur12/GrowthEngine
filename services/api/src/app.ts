import cors from "cors";
import express from "express";

import { contributionRouter } from "./routes/contributions";
import { growthPathsRouter } from "./routes/growth-paths";
import { issueRouter } from "./routes/issues";
import { progressRouter } from "./routes/progress";
import { problemsRouter } from "./routes/problems";
import { simulationRouter } from "./routes/simulations";
import { submissionRouter } from "./routes/submissions";
import { ticketRouter } from "./routes/tickets";
import { usersRouter } from "./routes/users";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "api" });
  });

  app.use("/api/issues", issueRouter);
  app.use("/api/problems", problemsRouter);
  app.use("/api/submissions", submissionRouter);
  app.use("/api/contributions", contributionRouter);
  app.use("/api/simulations", simulationRouter);
  app.use("/api/progress", progressRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/growth-paths", growthPathsRouter);
  app.use("/api/tickets", ticketRouter);

  return app;
}
