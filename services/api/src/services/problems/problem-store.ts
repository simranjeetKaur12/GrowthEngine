import { randomUUID } from "crypto";

import type { CuratedDifficulty, CuratedSkill, DiscoveredProblem } from "@growthengine/shared";

import { supabase } from "../../integrations/supabase";

const inMemoryProblems = new Map<string, DiscoveredProblem>();

function db() {
  return supabase;
}

function throwProblemStoreError(error: { message: string } | null) {
  if (!error) {
    return;
  }

  if (error.message.includes("schema cache")) {
    throw new Error(
      `${error.message}. Supabase schema is out of date for this codebase. Apply supabase/schema.sql and retry ingestion.`
    );
  }

  throw new Error(error.message);
}

function toProblemRecord(problem: DiscoveredProblem) {
  return {
    id: problem.id,
    issue_id: problem.issueId,
    title: problem.title,
    body: problem.body,
    difficulty: problem.difficulty,
    stack: problem.stack,
    skills: problem.skills,
    source_repo: problem.sourceRepo,
    source_issue_url: problem.sourceIssueUrl,
    labels: problem.labels,
    updated_at: new Date().toISOString()
  };
}

export function createProblemId() {
  return randomUUID();
}

export async function upsertDiscoveredProblems(problems: DiscoveredProblem[]) {
  if (!problems.length) {
    return;
  }

  if (!db()) {
    for (const problem of problems) {
      inMemoryProblems.set(problem.sourceIssueUrl, problem);
    }
    return;
  }

  const result = await db()!
    .from("problems")
    .upsert(problems.map(toProblemRecord), { onConflict: "source_issue_url" });

  throwProblemStoreError(result.error);
}

export async function listDiscoveredProblems(filters: {
  difficulty?: CuratedDifficulty;
  skill?: CuratedSkill;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 12, 1), 48);

  if (!db()) {
    const filtered = [...inMemoryProblems.values()]
      .filter((problem) => (filters.difficulty ? problem.difficulty === filters.difficulty : true))
      .filter((problem) => (filters.skill ? problem.skills.includes(filters.skill) : true))
      .sort((a, b) => b.issueId - a.issueId);

    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      page,
      pageSize,
      total: filtered.length
    };
  }

  let query = db()!
    .from("problems")
    .select(
      "id, issue_id, title, body, difficulty, stack, skills, source_repo, source_issue_url, labels",
      { count: "exact" }
    )
    .order("updated_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filters.difficulty) {
    query = query.eq("difficulty", filters.difficulty);
  }

  if (filters.skill) {
    query = query.contains("skills", [filters.skill]);
  }

  const result = await query;
  throwProblemStoreError(result.error);

  return {
    items: (result.data ?? []).map((row) => ({
      id: row.id,
      issueId: row.issue_id,
      title: row.title,
      body: row.body,
      difficulty: row.difficulty,
      stack: row.stack,
      skills: row.skills,
      sourceRepo: row.source_repo,
      sourceIssueUrl: row.source_issue_url,
      labels: row.labels ?? []
    })) as DiscoveredProblem[],
    page,
    pageSize,
    total: result.count ?? 0
  };
}
