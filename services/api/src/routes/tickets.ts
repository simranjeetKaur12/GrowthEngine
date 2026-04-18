import { Router } from "express";
import { z } from "zod";

import type { FinalReviewFeedback, IterativeAnalyzerFeedback } from "@growthengine/shared";

import { runtimeFeatures } from "../config";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { getIssueById } from "../modules/store";
import {
  createTicketFromIssue,
  getTicketById,
  listTickets,
  updateTicketStatus
} from "../modules/ticket-service";

const createTicketSchema = z.object({
  issueId: z.number()
});

const listTicketSchema = z.object({
  issueId: z.string().optional()
});

const startTicketSchema = z.object({
  ticketId: z.string().uuid()
});

const iterativeFeedbackSchema: z.ZodType<IterativeAnalyzerFeedback> = z.object({
  status: z.enum(["progress", "almost", "correct"]),
  what_you_did_right: z.array(z.string()),
  what_to_improve: z.array(z.string()),
  suggested_focus_area: z.string(),
  confidence: z.number(),
  summary: z.string()
});

const finalReviewSchema: z.ZodType<FinalReviewFeedback> = z.object({
  correctness_score: z.number(),
  code_quality: z.number(),
  edge_case_handling: z.number(),
  final_verdict: z.enum(["approved", "needs_work"]),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  improvements: z.array(z.string()),
  confidence_score: z.number(),
  summary: z.string()
});

const completeTicketSchema = z.object({
  ticketId: z.string().uuid(),
  approved: z.boolean().default(false),
  iterativeFeedback: iterativeFeedbackSchema.optional(),
  finalReview: finalReviewSchema.optional()
});

export const ticketRouter = Router();

ticketRouter.use(requireAuth);

ticketRouter.use((_req, res, next) => {
  if (!runtimeFeatures.enableTicketSystem || !runtimeFeatures.enableCompanyWorkflow) {
    return res.status(404).json({ error: "Ticket workflow is disabled by feature flags." });
  }

  return next();
});

ticketRouter.post("/create", async (req: AuthenticatedRequest, res) => {
  const parsed = createTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const issue = await getIssueById(parsed.data.issueId);
    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }

    const ticket = await createTicketFromIssue({
      issue,
      assignedTo: req.authUserId ?? "demo-user"
    });

    return res.json({ ticket });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create ticket";
    return res.status(500).json({ error: message });
  }
});

ticketRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const parsed = listTicketSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const tickets = await listTickets({
      assignedTo: req.authUserId ?? "demo-user",
      issueId: parsed.data.issueId
    });
    return res.json({ items: tickets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list tickets";
    return res.status(500).json({ error: message });
  }
});

ticketRouter.get("/:id", async (req: AuthenticatedRequest, res) => {
  const ticketId = req.params.id;
  if (!ticketId || ticketId.length < 8) {
    return res.status(400).json({ error: "Ticket id is required" });
  }

  try {
    const ticket = await getTicketById(ticketId);
    if (!ticket || ticket.assigned_to !== (req.authUserId ?? "demo-user")) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    return res.json({ ticket });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch ticket";
    return res.status(500).json({ error: message });
  }
});

ticketRouter.post("/start", async (req: AuthenticatedRequest, res) => {
  const parsed = startTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const ticket = await updateTicketStatus({
      ticketId: parsed.data.ticketId,
      assignedTo: req.authUserId ?? "demo-user",
      status: "in_progress"
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    return res.json({ ticket });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start ticket";
    return res.status(500).json({ error: message });
  }
});

ticketRouter.post("/complete", async (req: AuthenticatedRequest, res) => {
  const parsed = completeTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const ticket = await updateTicketStatus({
      ticketId: String(parsed.data.ticketId),
      assignedTo: req.authUserId ?? "demo-user",
      status: parsed.data.approved ? "done" : "in_review",
      iterativeFeedback: parsed.data.iterativeFeedback,
      finalReview: parsed.data.finalReview
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    return res.json({ ticket });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to complete ticket";
    return res.status(500).json({ error: message });
  }
});
