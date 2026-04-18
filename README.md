# GrowthEngine
<p align="center">
  <img src="./images/Screenshot%202026-04-12%20211319.png" alt="GrowthEngine product screen 1" width="47%" />
</p>

### Turning Real GitHub Issues into Real Developer Growth 🚀

GrowthEngine is an AI-powered developer simulation platform designed to bridge one of the biggest gaps in software education:

students often learn syntax, frameworks, and theory, but still struggle when they face a real codebase, a vague issue description, unclear context, and the expectation to ship a meaningful fix.

This project was built to close that gap.

Instead of giving users artificial coding questions, GrowthEngine converts real open-source issues into structured, guided engineering simulations. The result is a learning experience that feels much closer to actual software development: understand the issue, inspect context, attempt a fix, get feedback, improve, and move toward contribution readiness.

---

## Why This Project Exists 🧠

Most learning platforms are optimized for correctness on isolated problems.

Real engineering is different.

In real projects, developers need to:

- understand messy issue statements
- work with existing architecture
- make decisions with incomplete context
- iterate through failed attempts
- review tradeoffs, not just outputs
- communicate solutions clearly enough to contribute back

GrowthEngine was created as a response to that mismatch.

The core idea is simple:

> Don’t just practice coding. Practice engineering.

---

## The Problem to the Solution Flow 🎯

### 1. The Problem

Open-source issues are valuable learning material, but they are not beginner-friendly by default.

They are often:

- too broad
- missing step-by-step context
- tied to unfamiliar repositories
- difficult to evaluate consistently

That makes them powerful for growth, but hard to use as a structured learning system.

### 2. The System Response

GrowthEngine transforms those raw issues into a guided pipeline:

`GitHub Issue -> Classification -> Problem Adaptation -> Simulation Workspace -> AI Evaluation -> Progress Tracking -> Contribution Guidance`

This lets users move smoothly from discovery to execution without losing the realism of the original problem.

### 3. The End Goal

The platform is not just trying to help someone solve one task.

It is trying to help them build confidence in the full engineering loop:

- finding meaningful problems
- understanding project context
- writing better solutions
- learning from feedback
- preparing for real contributions

---

## What GrowthEngine Does ✨

- ingests real GitHub issues from repositories
- classifies issue difficulty and likely skill area
- adapts issues into more guided beginner-friendly problem statements
- provides a simulation workflow for working through solutions
- supports execution and AI review paths
- tracks submission progress and contribution history
- generates contribution guidance for taking work back to GitHub

This makes GrowthEngine part practice environment, part feedback engine, and part contribution bridge.

---

## System Architecture 🏗️

GrowthEngine is structured as a modular monorepo so each part of the platform has a clear responsibility.

```text
apps/
  web/                  Next.js frontend

services/
  api/                  Express orchestration API
  worker/               Curated discovery worker
  workers/              Legacy placeholder worker

packages/
  shared/               Shared contracts and types

supabase/
  schema.sql            Persistence schema
```

### Frontend: `apps/web`

The frontend is built with Next.js and acts as the user-facing simulation environment.

It currently supports flows such as:

- landing and onboarding
- authentication
- problem discovery
- issue detail and simulation views
- dashboard and profile pages
- growth path exploration
- submission and progress surfaces

Its job is to make the experience feel continuous from the moment a learner finds a problem to the moment they are ready to contribute.

### API Layer: `services/api`

The API is the orchestration core of the system.

It is responsible for:

- fetching and normalizing GitHub issues
- classifying issues
- adapting issues into guided problems
- coordinating submissions and evaluations
- persisting user progress
- generating contribution guidance
- exposing discovery, simulation, progress, and user endpoints

This layer keeps route handlers thin and moves most behavior into focused modules and services.

### Worker Layer: `services/worker`

The worker handles curated discovery refreshes. Instead of pulling fresh GitHub data on every user request, the system can refresh and materialize discoverable problems ahead of time.

That improves responsiveness and keeps discovery closer to a product experience than a raw live fetch.

### Shared Contracts: `packages/shared`

The shared package holds common types and contracts used across the monorepo. This reduces drift between frontend expectations and backend responses and makes the system easier to extend safely.

### Persistence: Supabase

Supabase is used as the main persistence layer for:

- repositories
- issues
- classifications
- submissions
- evaluations
- contribution guides
- curated problems
- users

When key infrastructure is unavailable, the system is intentionally designed with graceful fallbacks so development and demos can still continue.

---

## Architectural Thinking Behind the Platform 🧩

One of the most important design choices in GrowthEngine is that it does not depend on a single fragile happy path.

The platform supports multiple operating modes:

- Supabase-backed persistence when credentials are configured
- in-memory fallback storage for local development
- AI-powered classification and evaluation when model access is available
- heuristic or rule-based fallback behavior when AI infrastructure is unavailable
- hybrid evaluation for problems that are not naturally Judge0-style execution tasks

That decision made the system much more practical to build and iterate on. It also reflects a real engineering mindset: design for progress, not perfection.

---

## Core User Journey 🔄

GrowthEngine is built around a realistic developer workflow:

1. A repository or curated source is selected.
2. GitHub issues are fetched and normalized.
3. The system classifies and adapts issues into structured learning problems.
4. The user opens a problem and starts a simulation session.
5. They write a solution and submit work for execution or review.
6. The system stores attempts and returns AI-supported feedback.
7. Strong submissions can unlock contribution guidance.
8. Progress is tracked over time through submissions, sessions, and contribution records.

This flow is the main reason the project feels different from a standard coding practice app. It is built around iteration and context, not just answer checking.

---

## Key Backend Responsibilities 🔧

The backend is intentionally separated into layers so the codebase stays extensible:

### Integrations

External systems are isolated in integration modules:

- GitHub
- Supabase
- OpenAI
- Judge0

### Core Modules

Core logic includes:

- classification
- evaluation
- guided context generation
- problem adaptation
- persistence abstraction
- contribution guide generation
- submission workspace packing and unpacking

### Services

Service layers handle orchestration-heavy workflows such as:

- curated problem discovery
- problem materialization
- hybrid execution
- growth path handling
- user data access

This separation helped keep the architecture readable while the scope expanded from a simple issue ingestion demo into a broader developer growth platform.

---

## API Surface at a Glance 🌐

Some of the main routes currently exposed by the API include:

```text
POST /api/issues/ingest
GET  /api/issues
GET  /api/issues/:id

GET  /api/problems/discover
POST /api/problems/discover/refresh

POST /api/submissions/execute
POST /api/submissions/evaluate
GET  /api/submissions/history

POST /api/contributions/start
POST /api/contributions/pr
GET  /api/contributions/history

POST /api/simulations/start
GET  /api/simulations/current

GET  /api/progress/overview
POST /api/users
GET  /api/users/:id
GET  /api/users/:id/stats
```

These endpoints show that the project is not limited to issue ingestion alone. It now supports discovery, simulation, evaluation, contribution, and learner progress as connected parts of one system.

---

## Tech Stack 💻

### Frontend

- Next.js 14
- React 18
- Tailwind CSS
- Supabase browser client

### Backend

- Node.js
- Express
- TypeScript
- Zod for request validation

### Platform Services

- Supabase for persistence and authentication
- GitHub as the source of real-world issues
- OpenAI for structured classification and evaluation workflows
- Judge0-compatible execution strategy for runnable submissions

---

## Product Preview 🖼️

The screenshots below show different parts of the GrowthEngine experience, from landing and discovery to simulation and guided problem solving.

### Main Experience

<p align="center">
  <img src="./images/lightTheme.png" alt="GrowthEngine light theme landing page" width="47%" />
</p>

### Product Screens

<p align="center">
  <img src="./images/Screenshot%202026-04-17%20094241.png" alt="GrowthEngine product screen 2" width="47%" />
  <img src="./images/Screenshot%202026-04-17%20182142.png" alt="GrowthEngine product screen 3" width="47%" />
</p>

<p align="center">
  <img src="./images/Screenshot%202026-04-17%20182242.png" alt="GrowthEngine product screen 4" width="47%" />
  <img src="./images/Screenshot%202026-04-17%20182347.png" alt="GrowthEngine product screen 5" width="47%" />
</p>

---

## Why This Architecture Matters 📌

GrowthEngine is not just a feature collection.

Its architecture reflects a specific product belief:

learning becomes far more effective when users can practice inside a workflow that resembles professional software development.

That is why the system combines:

- real issue sourcing
- structured adaptation
- simulation state
- AI feedback
- contribution readiness
- long-term progress tracking

Each part is useful on its own, but the real value appears when they work together as one pipeline.

---

## My Contribution Through This Project 🙌

This project reflects my ability to think beyond isolated features and design an end-to-end system.

While building GrowthEngine, I focused on:

- designing a modular monorepo structure
- connecting product thinking with technical execution
- shaping APIs around real user journeys
- building fallback-aware backend architecture
- integrating multiple external systems responsibly
- creating a smoother learning-to-contribution experience

More importantly, I tried to build something meaningful, not just technically functional.

The platform is intended to solve a real learner pain point using a system-level approach.

---

## Skills Demonstrated 🛠️

- full-stack architecture design
- monorepo organization
- frontend application development with Next.js
- backend API design with Express and TypeScript
- schema validation with Zod
- third-party integration design
- authentication and persistence with Supabase
- AI-assisted workflow orchestration
- developer experience thinking
- product-oriented problem solving

---

## Lessons Learned While Building It 📚

GrowthEngine taught me lessons that go far beyond syntax or framework usage:

- real products become clearer when you design around user pain, not just technology
- architecture matters most when the scope starts expanding
- fallback systems are not optional if you want reliable development workflows
- AI is most useful when placed inside a structured product flow, not treated as a standalone feature
- persistence, evaluation, and UX need to evolve together in systems that track progress over time
- building developer tools requires balancing flexibility, realism, and simplicity

One of the biggest lessons was learning how to preserve a core idea while still extending the system gradually. What started as issue ingestion became a broader developer simulation platform because the architecture allowed that expansion.

---

## Local Setup ⚙️

### Install dependencies

```bash
npm install
```

### Run the frontend

```bash
npm run dev:web
```

### Run the API

```bash
npm run dev:api
```

### Build the workspace

```bash
npm run build
```

### Optional environment variables

Configure these when using Supabase and AI-backed flows:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SCHEMA=public
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL_CLASSIFIER=
OPENAI_MODEL_EVALUATOR=
```

Apply the SQL schema from [supabase/schema.sql](./supabase/schema.sql) to enable persistent storage.

---

## Current State and Next Direction 🌱

GrowthEngine is already structured around a strong end-to-end workflow, but it is still evolving.

Some of the natural next steps include:

- persisting simulation sessions more deeply
- improving curated refresh orchestration
- expanding progress analytics
- strengthening rate limiting and production hardening
- refining skill inference and personalized growth paths

That makes this project both a working MVP and a strong foundation for future iteration.

---

## Final Note

GrowthEngine represents how I think about software:

start from a real problem, design around the user journey, build systems with clear boundaries, and create room for the product to evolve without collapsing under its own complexity.

If the goal is to help developers grow through real practice, then the platform itself should be built with the same seriousness as a real product. That idea shaped every part of this project. 🌍
