import { randomUUID } from "crypto";
import type {
  ClassifiedIssue,
  FinalReviewFeedback,
  IterativeAnalyzerFeedback,
  TicketBriefing,
  TicketPriority,
  TicketRecord,
  TicketStatus,
  TicketType
} from "@growthengine/shared";
import { z } from "zod";

import { env, runtimeFeatures } from "../config";
import { generateStructuredJson } from "../integrations/openai";
import { supabase } from "../integrations/supabase";
import { buildGuidedIssueContext } from "./guided-context";

const ticketMap = new Map<string, TicketRecord>();

const ticketSummarySchema = z
  .object({
    summary: z.string().min(16).max(280)
  })
  .strict();

const ticketBriefingSchema = z
  .object({
    what_is_broken: z.string().min(12).max(260),
    where_to_fix: z.array(z.string().min(3).max(180)).min(1).max(6),
    hint: z.string().min(8).max(220),
    expected_outcome: z.string().min(12).max(280),
    acceptance_criteria: z.array(z.string().min(3).max(220)).min(1).max(8)
  })
  .strict();

type TicketRow = {
  id: string;
  title: string;
  description: string;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  repo: string;
  related_issue_id: string;
  assigned_to: string;
  created_at: string;
  metadata?: TicketRecord["metadata"];
};

function nowIso() {
  return new Date().toISOString();
}

function canUseSupabase() {
  return runtimeFeatures.supabaseConfigured && Boolean(supabase);
}

function fallbackSummary(issue: ClassifiedIssue) {
  const source = issue.scenarioBody?.trim() || issue.body.trim() || issue.title;
  return source.length > 220 ? `${source.slice(0, 220)}...` : source;
}

function derivePriority(issue: ClassifiedIssue): TicketPriority {
  if (issue.difficulty === "advanced") {
    return "high";
  }
  if (issue.difficulty === "intermediate") {
    return "medium";
  }
  return "low";
}

function deriveType(issue: ClassifiedIssue): TicketType {
  const text = `${issue.title} ${issue.body} ${issue.labels.join(" ")}`.toLowerCase();

  if (/feature|enhancement|add\s|implement|support/.test(text)) {
    return "feature";
  }

  if (/improve|refactor|optimi[sz]e|cleanup|quality/.test(text)) {
    return "improvement";
  }

  return "bug";
}

function toTicket(row: TicketRow): TicketRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    priority: row.priority,
    status: row.status,
    repo: row.repo,
    related_issue_id: row.related_issue_id,
    assigned_to: row.assigned_to,
    created_at: row.created_at,
    metadata: row.metadata ?? {}
  };
}

async function summarizeIssue(issue: ClassifiedIssue) {
  if (!runtimeFeatures.openAiConfigured) {
    return fallbackSummary(issue);
  }

  try {
    const result = await generateStructuredJson({
      model: env.openAiClassifierModel,
      schemaName: "ticket_issue_summary",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          summary: { type: "string", minLength: 16, maxLength: 280 }
        },
        required: ["summary"]
      },
      parser: ticketSummarySchema,
      systemPrompt:
        "Summarize GitHub issues for engineering tickets in plain language. Do not include implementation details.",
      userPrompt: JSON.stringify({
        title: issue.title,
        body: issue.body,
        scenarioBody: issue.scenarioBody,
        acceptanceCriteria: issue.acceptanceCriteria ?? []
      }),
      retries: 1
    });

    return result.summary;
  } catch {
    return fallbackSummary(issue);
  }
}

async function buildTicketBriefing(issue: ClassifiedIssue): Promise<TicketBriefing> {
  const guided = await buildGuidedIssueContext(issue);
  const fallback: TicketBriefing = {
    what_is_broken: guided.what_is_broken,
    where_to_fix: guided.where_to_fix,
    hint: guided.hint,
    expected_outcome: guided.expected_outcome,
    acceptance_criteria:
      issue.acceptanceCriteria?.length
        ? issue.acceptanceCriteria.slice(0, 6)
        : ["Issue behavior should be resolved without regressions."]
  };

  if (!runtimeFeatures.openAiConfigured) {
    return fallback;
  }

  try {
    const result = await generateStructuredJson({
      model: env.openAiEvaluatorModel,
      schemaName: "ticket_briefing",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          what_is_broken: { type: "string", minLength: 12, maxLength: 260 },
          where_to_fix: {
            type: "array",
            items: { type: "string", minLength: 3, maxLength: 180 },
            minItems: 1,
            maxItems: 6
          },
          hint: { type: "string", minLength: 8, maxLength: 220 },
          expected_outcome: { type: "string", minLength: 12, maxLength: 280 },
          acceptance_criteria: {
            type: "array",
            items: { type: "string", minLength: 3, maxLength: 220 },
            minItems: 1,
            maxItems: 8
          }
        },
        required: [
          "what_is_broken",
          "where_to_fix",
          "hint",
          "expected_outcome",
          "acceptance_criteria"
        ]
      },
      parser: ticketBriefingSchema,
      systemPrompt:
        "You create concise Jira-style ticket briefings for engineers. Provide practical, non-solution guidance.",
      userPrompt: JSON.stringify({
        issue,
        guidedContext: guided,
        rules: [
          "Keep language direct and concise.",
          "Do not provide full code solutions.",
          "Acceptance criteria should be testable outcomes."
        ]
      }),
      retries: 1
    });

    return result;
  } catch {
    return fallback;
  }
}

async function upsertSupabaseTicket(ticket: TicketRecord) {
  if (!canUseSupabase()) {
    return false;
  }

  try {
    const response = await supabase!
      .from("tickets")
      .upsert(
        {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description,
          type: ticket.type,
          priority: ticket.priority,
          status: ticket.status,
          repo: ticket.repo,
          related_issue_id: ticket.related_issue_id,
          assigned_to: ticket.assigned_to,
          created_at: ticket.created_at,
          metadata: ticket.metadata ?? {}
        },
        { onConflict: "id" }
      );

    if (response.error) {
      throw response.error;
    }

    return true;
  } catch {
    return false;
  }
}

async function fetchSupabaseTicketById(ticketId: string) {
  if (!canUseSupabase()) {
    return null;
  }

  try {
    const response = await supabase!
      .from("tickets")
      .select("id, title, description, type, priority, status, repo, related_issue_id, assigned_to, created_at, metadata")
      .eq("id", ticketId)
      .maybeSingle();

    if (response.error || !response.data) {
      return null;
    }

    return toTicket(response.data as TicketRow);
  } catch {
    return null;
  }
}

async function fetchSupabaseTicketsByAssignee(assigneeId: string, issueId?: string) {
  if (!canUseSupabase()) {
    return null;
  }

  try {
    let query = supabase!
      .from("tickets")
      .select("id, title, description, type, priority, status, repo, related_issue_id, assigned_to, created_at, metadata")
      .eq("assigned_to", assigneeId)
      .order("created_at", { ascending: false });

    if (issueId) {
      query = query.eq("related_issue_id", issueId);
    }

    const response = await query;
    if (response.error) {
      return null;
    }

    return (response.data ?? []).map((row) => toTicket(row as TicketRow));
  } catch {
    return null;
  }
}

export async function listTickets(input: { assignedTo: string; issueId?: string }) {
  const dbTickets = await fetchSupabaseTicketsByAssignee(input.assignedTo, input.issueId);
  if (dbTickets) {
    return dbTickets;
  }

  return [...ticketMap.values()]
    .filter((ticket) => ticket.assigned_to === input.assignedTo)
    .filter((ticket) => (input.issueId ? ticket.related_issue_id === input.issueId : true))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function getTicketById(ticketId: string) {
  const dbTicket = await fetchSupabaseTicketById(ticketId);
  if (dbTicket) {
    return dbTicket;
  }

  return ticketMap.get(ticketId) ?? null;
}

export async function createTicketFromIssue(input: {
  issue: ClassifiedIssue;
  assignedTo: string;
}) {
  const existing = await listTickets({
    assignedTo: input.assignedTo,
    issueId: String(input.issue.id)
  });

  const reusable = existing.find((ticket) => ticket.status !== "done");
  if (reusable) {
    return reusable;
  }

  const description = await summarizeIssue(input.issue);
  const briefing = await buildTicketBriefing(input.issue);

  const ticket: TicketRecord = {
    id: randomUUID(),
    title: input.issue.title,
    description,
    type: deriveType(input.issue),
    priority: derivePriority(input.issue),
    status: "todo",
    repo: input.issue.repositoryFullName,
    related_issue_id: String(input.issue.id),
    assigned_to: input.assignedTo,
    created_at: nowIso(),
    metadata: {
      briefing
    }
  };

  ticketMap.set(ticket.id, ticket);
  await upsertSupabaseTicket(ticket);
  return ticket;
}

export async function updateTicketStatus(input: {
  ticketId: string;
  assignedTo: string;
  status: TicketStatus;
  iterativeFeedback?: IterativeAnalyzerFeedback;
  finalReview?: FinalReviewFeedback;
}) {
  const current = await getTicketById(input.ticketId);
  if (!current || current.assigned_to !== input.assignedTo) {
    return null;
  }

  const next: TicketRecord = {
    ...current,
    status: input.status,
    metadata: {
      ...(current.metadata ?? {}),
      ...(input.iterativeFeedback
        ? { latest_iterative_feedback: input.iterativeFeedback }
        : {}),
      ...(input.finalReview ? { latest_final_review: input.finalReview } : {})
    }
  };

  ticketMap.set(next.id, next);
  await upsertSupabaseTicket(next);
  return next;
}
