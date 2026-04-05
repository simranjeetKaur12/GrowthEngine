# Supabase Persistence Setup (Task 1)

## 1) Apply schema
Run the SQL in supabase/schema.sql from the Supabase SQL editor.

## 2) Environment
Set these values in .env:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_SCHEMA=public
- OPENAI_API_KEY
- OPENAI_BASE_URL (optional, default https://api.openai.com/v1)
- OPENAI_MODEL_CLASSIFIER (default gpt-4.1-mini)
- OPENAI_MODEL_EVALUATOR (default gpt-4.1)

## 3) API behavior after refactor
- POST /api/issues/ingest: fetches + classifies GitHub issues and upserts repositories, issues, classifications.
- GET /api/issues: reads issues from Supabase, supports difficulty and stack filters.
- GET /api/issues/:id: returns one issue for solve workspace.
- POST /api/submissions/execute: creates submission row, runs Judge0, stores execution output and expected-output match.
- POST /api/submissions/evaluate: loads stored submission + issue context, runs evaluator, stores evaluation row.
- GET /api/submissions/history?issueId=<id>&limit=20: returns recent submissions for authenticated user.
- POST /api/contributions/start: creates guided contribution record with suggested branch.
- POST /api/contributions/pr: attaches PR URL and status to contribution record.
- GET /api/contributions/history?issueId=<id>: returns authenticated user contribution records.

## 3.2) Authentication requirements
- `/api/submissions/*` and `/api/contributions/*` routes require `Authorization: Bearer <supabase_access_token>`.
- API validates JWT with Supabase Auth and binds records to authenticated `user_id`.
- Frontend solve workspace redirects to `/auth` if there is no active session.

## 3.1) LLM classification and evaluation
- Classifier uses strict JSON schema output with retries and zod validation.
- Evaluator uses strict JSON schema output with retries and zod validation.
- Both persist confidence scores and model names.
- If LLM call or schema validation fails after retries, deterministic fallback logic is used with lower confidence.

## 4) Request samples
### Execute submission
POST /api/submissions/execute
{
  "issueId": 123456,
  "userId": "anonymous",
  "languageId": 71,
  "sourceCode": "print('hello')",
  "stdin": "",
  "expectedOutput": "hello"
}

### Evaluate submission
POST /api/submissions/evaluate
{
  "submissionId": "00000000-0000-0000-0000-000000000000"
}

### History
GET /api/submissions/history?issueId=123456&userId=anonymous&limit=20
