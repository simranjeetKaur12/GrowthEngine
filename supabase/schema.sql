-- GrowthEngine Task 1 schema: repositories, issues, classifications, submissions, evaluations

create extension if not exists pgcrypto;

create table if not exists repositories (
  id uuid primary key default gen_random_uuid(),
  full_name text not null unique,
  html_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type difficulty_level as enum ('beginner', 'intermediate', 'advanced');

create table if not exists issues (
  id bigint primary key,
  repository_full_name text not null,
  title text not null,
  body text not null default '',
  scenario_title text,
  scenario_body text,
  learning_objectives text[] not null default '{}',
  acceptance_criteria text[] not null default '{}',
  labels text[] not null default '{}',
  issue_url text not null,
  state text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint issues_repository_full_name_fkey
    foreign key (repository_full_name)
    references repositories(full_name)
    on delete cascade
);

create table if not exists classifications (
  issue_id bigint primary key references issues(id) on delete cascade,
  difficulty difficulty_level not null,
  tech_stack text[] not null,
  confidence numeric(4,3) not null,
  model_name text not null,
  reasoning text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'anonymous',
  issue_id bigint references issues(id) on delete set null,
  learning_path_id text,
  learning_day_number int,
  language_id int not null,
  source_code text not null,
  stdin text,
  expected_output text,
  stdout text,
  stderr text,
  compile_output text,
  judge0_status_id int,
  judge0_status_description text,
  is_expected_output_match boolean,
  status text,
  score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists learning_paths (
  id text primary key,
  skill text not null,
  title text not null,
  description text not null default '',
  level_label text not null default 'Beginner to advanced',
  total_days int not null default 100,
  estimated_minutes_per_day int not null default 45,
  tags text[] not null default '{}',
  adaptive boolean not null default true,
  overview text not null default '',
  phases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists learning_days (
  id uuid primary key default gen_random_uuid(),
  path_id text not null references learning_paths(id) on delete cascade,
  day_number int not null,
  topic text not null,
  title text not null,
  explanation text not null,
  task text not null,
  stretch_goal text,
  hints text[] not null default '{}',
  language_id int not null,
  tech_stack text[] not null default '{}',
  expected_output text,
  starter_code text not null default '',
  difficulty text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(path_id, day_number)
);

create table if not exists user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  path_id text not null references learning_paths(id) on delete cascade,
  day_number int not null,
  status text not null default 'available',
  attempts int not null default 0,
  score int,
  verdict text,
  latest_submission_id uuid references submissions(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, path_id, day_number),
  foreign key (path_id, day_number) references learning_days(path_id, day_number) on delete cascade
);

create table if not exists evaluations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  verdict text not null check (verdict in ('pass', 'fail', 'review')),
  summary text not null,
  strengths text[] not null default '{}',
  risks text[] not null default '{}',
  suggestions text[] not null default '{}',
  confidence numeric(4,3),
  model_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists contribution_guides (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  issue_id bigint references issues(id) on delete set null,
  repository_full_name text not null,
  issue_url text not null,
  branch_name text not null,
  pr_url text,
  pr_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists problems (
  id uuid primary key default gen_random_uuid(),
  issue_id bigint references issues(id) on delete cascade,
  title text not null,
  body text not null default '',
  difficulty text not null,
  stack text not null,
  skills text[] not null default '{}',
  source_repo text not null,
  source_issue_url text not null unique,
  labels text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key,
  name text,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists user_settings (
  user_id uuid primary key references users(id) on delete cascade,
  default_language text not null default 'python',
  editor_theme text not null default 'dark',
  font_size int not null default 14,
  tab_size int not null default 2,
  auto_save boolean not null default true,
  feedback_verbosity text not null default 'standard',
  hints_enabled boolean not null default true,
  explanation_after_submission boolean not null default true,
  skill_focus text not null default 'backend',
  difficulty_level text not null default 'medium',
  daily_learning_goal int not null default 45,
  adaptive_learning boolean not null default true,
  simulation_mode text not null default 'strict',
  preferred_repository_type text not null default 'mixed',
  auto_generate_pr_guide boolean not null default true,
  github_connected boolean not null default false,
  automatic_repo_sync boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_issues_repository_full_name on issues(repository_full_name);
create index if not exists idx_classifications_difficulty on classifications(difficulty);
create index if not exists idx_classifications_tech_stack on classifications using gin(tech_stack);
create index if not exists idx_submissions_issue_id on submissions(issue_id);
create index if not exists idx_submissions_user_issue on submissions(user_id, issue_id, created_at desc);
create index if not exists idx_submissions_learning_path on submissions(learning_path_id, learning_day_number, created_at desc);
create index if not exists idx_evaluations_submission_id on evaluations(submission_id);
create index if not exists idx_contribution_guides_user_issue on contribution_guides(user_id, issue_id, updated_at desc);
create index if not exists idx_problems_difficulty on problems(difficulty);
create index if not exists idx_problems_skills on problems using gin(skills);
create index if not exists idx_learning_days_path on learning_days(path_id, day_number);
create index if not exists idx_user_progress_path on user_progress(user_id, path_id, day_number);
create index if not exists idx_user_settings_theme on user_settings(editor_theme);
