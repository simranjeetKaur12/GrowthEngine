# GrowthEngine Architecture

## Overview

GrowthEngine is a modular developer simulation platform built around one unified lifecycle:

Discover Problem  
→ Understand Context  
→ Start Simulation  
→ Write Code  
→ Execute or Review  
→ Get AI Feedback  
→ Track Progress  
→ Contribute Back to GitHub

The platform intentionally supports multiple operating modes so development can continue even when some infrastructure is unavailable.

## Operating Modes

### Storage
- Primary mode: Supabase-backed persistence.
- Fallback mode: in-memory storage when `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing.

### Execution
- Primary mode: Judge0-backed execution for executable problems.
- Fallback mode: mock execution when Judge0 is unavailable.
- Hybrid mode: frontend-heavy problems can skip Judge0 and still go through AI evaluation.

### AI
- Primary mode: OpenAI structured outputs for classification and evaluation.
- Fallback mode: heuristic classification and rule-based evaluation.

## High-Level Services

### `apps/web`
Next.js application that provides:
- manual issue ingestion
- curated problem discovery
- simulation workspace
- AI review UI
- contribution guidance
- progress dashboard
- profile page
- auth entry points

### `services/api`
Express API that orchestrates:
- GitHub issue ingestion
- curated problem discovery APIs
- simulation session tracking
- submissions and hybrid execution
- AI evaluation
- contribution guide creation
- progress aggregation
- user profile/stat endpoints

### `services/worker`
Scheduled curated discovery worker that:
- triggers curated problem refresh
- can run periodically
- can be manually invoked

### `services/workers`
Legacy placeholder worker service retained for backward compatibility.

### `packages/shared`
Shared contracts for:
- issues
- submissions
- evaluation payloads
- simulation sessions
- progress/timeline models
- curated problem records
- user stats

## Core Workflows

### 1. Manual Repository Ingestion
1. User enters `owner/repo` on `/`.
2. API calls GitHub issues endpoint.
3. Raw issues are normalized.
4. Classification assigns difficulty and tech stack.
5. Issues and classifications are stored.
6. Problems are shown in the main list.

This flow remains the original base workflow and is preserved unchanged at the route level.

### 2. Curated Problem Discovery
1. Worker or manual refresh calls curated discovery service.
2. GitHub issues are fetched across a configured repository list.
3. Problems are cleaned and classified.
4. Curated metadata is derived:
   difficulty, stack, skills, source repo, source issue URL.
5. Curated records are stored in the `problems` table or in-memory fallback store.
6. `/find-problems` queries `GET /api/problems/discover`.

This is additive and does not replace manual ingestion.

### 3. Simulation Workspace
1. User opens `/issues/[id]`.
2. User explicitly starts a simulation session.
3. Workspace tracks:
   attempts, latest verdict, contribution readiness, session state.
4. User writes code and submits execution.
5. Execution result is returned and persisted.
6. AI evaluation is requested and persisted.
7. Contribution guidance unlocks when evaluation is strong enough.

### 4. Guided Contribution
1. User prepares contribution guide after evaluation.
2. System generates:
   branch strategy, git commands, commit message, PR title, PR description.
3. User can attach PR URL/status.
4. Contribution data is stored in contribution history.

### 5. Progress and Profile
1. Submissions, evaluations, sessions, and contribution records are aggregated.
2. `/my-submissions` shows metrics, issue summaries, and timeline.
3. `/profile` exposes proof-of-work style stats and activity history.

## API Surface

### Existing Core Routes
- `POST /api/issues/ingest`
- `GET /api/issues`
- `GET /api/issues/:id`
- `POST /api/submissions/execute`
- `POST /api/submissions/evaluate`
- `GET /api/submissions/history`
- `POST /api/contributions/start`
- `POST /api/contributions/pr`
- `GET /api/contributions/history`

### Added Extension Routes
- `GET /api/problems/discover`
- `POST /api/problems/discover/refresh`
- `POST /api/simulations/start`
- `GET /api/simulations/current`
- `GET /api/progress/overview`
- `POST /api/users`
- `GET /api/users/:id`
- `GET /api/users/:id/stats`

The extension routes were added without renaming or removing the original endpoints.

## Backend Module Boundaries

### Integrations
- `integrations/github.ts`
- `integrations/judge0.ts`
- `integrations/openai.ts`
- `integrations/supabase.ts`

These own external-system interaction only.

### Core Modules
- `modules/classifier.ts`
- `modules/evaluator.ts`
- `modules/store.ts`
- `modules/memory-store.ts`
- `modules/supabase-store.ts`
- `modules/contribution-guide.ts`

These own classification, evaluation, persistence abstraction, and contribution draft generation.

### Services
- `services/github/discovery-client.ts`
- `services/problems/discovery-service.ts`
- `services/problems/problem-store.ts`
- `services/executor/hybrid-executor.ts`
- `services/users/user-store.ts`

These are extension-oriented orchestration layers added without rewriting the original modules.

### Routes
- `routes/issues.ts`
- `routes/submissions.ts`
- `routes/contributions.ts`
- `routes/simulations.ts`
- `routes/progress.ts`
- `routes/problems.ts`
- `routes/users.ts`

Routes are thin orchestration layers around services/modules.

## Data Model

### Existing Tables
- `repositories`
- `issues`
- `classifications`
- `submissions`
- `evaluations`
- `contribution_guides`

### Extended Tables / Fields
- `problems`
  curated discovery records
- `users`
  lightweight app-level profile table
- `submissions.status`
  latest submission/evaluation status
- `submissions.score`
  score derived from evaluation

### In-Memory Fallback
When Supabase is unavailable, equivalent runtime collections are used in `memory-store.ts` and curated/user stores.

## Authentication Model

### Frontend
- Browser auth uses Supabase JS client.
- Public env vars:
  `NEXT_PUBLIC_SUPABASE_URL`
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Auth UI supports:
  email/password sign-up
  email/password sign-in
  GitHub OAuth
  Google OAuth

### Backend
- If Supabase is configured, bearer tokens are validated through Supabase Auth.
- If Supabase is unavailable, protected APIs can fall back to demo identity handling for local development.

## Error Handling and Reliability

### API
- Route-level validation with Zod.
- `try/catch` in route handlers.
- safe fallbacks for missing infrastructure.
- timeout handling in curated GitHub discovery calls.

### Frontend
- loading states on long-running actions
- error banners/messages
- retry-style actions in curated discovery and progress surfaces
- conditional messaging when auth config is missing

## Performance Notes
- Curated discovery results are cached in storage rather than fetched on every page load.
- Discovery API is paginated.
- Submission and progress queries are limited.
- GitHub worker refresh runs on a schedule rather than per-request.

## Current Tradeoffs
- Simulation sessions are currently stored in memory even in the Supabase-backed path.
  This keeps the extension non-breaking, but long-term they should move into a dedicated persistent table.
- The root workspace script still points to legacy `services/workers`.
  The newer curated worker lives in `services/worker`.
- Hybrid execution currently uses tech-stack inference to decide whether to skip Judge0 for frontend-oriented problems.

## Suggested Next Improvements
1. Persist simulation sessions in Supabase.
2. Add background queueing for large discovery refreshes.
3. Add throttling/rate limiting on public ingestion routes.
4. Add richer skill inference and deduping across curated problems.
5. Introduce automated migrations instead of SQL-only schema updates.
