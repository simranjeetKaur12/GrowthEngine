export type Difficulty = "beginner" | "intermediate" | "advanced";

export type TechStack =
  | "nodejs"
  | "react"
  | "python"
  | "database"
  | "devops"
  | "other";

export interface IssueRecord {
  id: number;
  repositoryFullName: string;
  title: string;
  body: string;
  labels: string[];
  url: string;
}

export interface ClassifiedIssue extends IssueRecord {
  difficulty: Difficulty;
  techStack: TechStack[];
  confidence: number;
  modelName?: string;
  reasoning?: string;
  scenarioTitle?: string;
  scenarioBody?: string;
  learningObjectives?: string[];
  acceptanceCriteria?: string[];
}

export interface SubmissionPayload {
  languageId: number;
  sourceCode: string;
  stdin?: string;
  expectedOutput?: string;
}

export interface EvaluationPayload {
  issue: ClassifiedIssue;
  submission: SubmissionPayload;
  stdout?: string;
  stderr?: string;
  compileOutput?: string;
  expectedOutputMatch?: boolean | null;
}

export type SimulationStatus =
  | "not_started"
  | "in_progress"
  | "ready_to_contribute"
  | "completed";

export interface SimulationSessionRecord {
  id: string;
  userId: string;
  issueId: number;
  repositoryFullName: string;
  issueTitle: string;
  status: SimulationStatus;
  startedAt: string;
  updatedAt: string;
  totalAttempts: number;
  latestSubmissionId?: string | null;
  latestVerdict?: "pass" | "fail" | "review" | null;
  contributionReady: boolean;
}

export interface ProgressMetrics {
  problemsSolved: number;
  totalAttempts: number;
  sessionsStarted: number;
  contributionReady: number;
  difficultyDistribution: Record<Difficulty, number>;
}

export interface ProgressIssueSummary {
  issueId: number;
  title: string;
  repositoryFullName: string;
  difficulty: Difficulty;
  attempts: number;
  latestVerdict: "pass" | "fail" | "review" | null;
  status: SimulationStatus;
  contributionReady: boolean;
  updatedAt: string;
}

export interface ProgressTimelineItem {
  id: string;
  type: "simulation_started" | "submission" | "evaluation" | "contribution";
  issueId: number;
  issueTitle: string;
  repositoryFullName: string;
  createdAt: string;
  status: string;
  summary: string;
}

export interface UserProgressOverview {
  metrics: ProgressMetrics;
  issueSummaries: ProgressIssueSummary[];
  timeline: ProgressTimelineItem[];
}

export type CuratedDifficulty = "easy" | "medium" | "hard";
export type CuratedSkill = "frontend" | "backend" | "fullstack" | "devops";

export interface DiscoveredProblem {
  id: string;
  issueId: number;
  title: string;
  body: string;
  difficulty: CuratedDifficulty;
  stack: string;
  skills: CuratedSkill[];
  sourceRepo: string;
  sourceIssueUrl: string;
  labels: string[];
}

export interface UserStats {
  problemsSolved: number;
  easy: number;
  medium: number;
  hard: number;
  successRate: number;
  recentActivity: ProgressTimelineItem[];
  contributions: number;
  skillBreakdown: Record<CuratedSkill, number>;
}

export type SettingsLanguage = "javascript" | "python" | "java" | "cpp";
export type SettingsTheme = "dark" | "light";
export type AiVerbosity = "minimal" | "standard" | "detailed";
export type SkillFocus = "frontend" | "backend" | "ai" | "dsa";
export type LearningDifficulty = "easy" | "medium" | "hard";
export type SimulationMode = "strict" | "relaxed";
export type RepositoryPreference = "open-source" | "curated" | "mixed";

export interface UserSettings {
  userId: string;
  defaultLanguage: SettingsLanguage;
  editorTheme: SettingsTheme;
  fontSize: number;
  tabSize: number;
  autoSave: boolean;
  feedbackVerbosity: AiVerbosity;
  hintsEnabled: boolean;
  explanationAfterSubmission: boolean;
  skillFocus: SkillFocus;
  difficultyLevel: LearningDifficulty;
  dailyLearningGoal: number;
  adaptiveLearning: boolean;
  simulationMode: SimulationMode;
  preferredRepositoryType: RepositoryPreference;
  autoGeneratePrGuide: boolean;
  githubConnected: boolean;
  automaticRepoSync: boolean;
  createdAt: string;
  updatedAt: string;
}

export type GrowthPathSkill = "python" | "web-development" | "machine-learning";
export type GrowthPathDifficulty = "foundation" | "build" | "ship";
export type GrowthPathDayStatus = "locked" | "available" | "in_review" | "completed";
export type GrowthPathIntensity = "steady" | "stretch" | "reset";

export interface LearningPathSummary {
  id: string;
  skill: GrowthPathSkill;
  title: string;
  description: string;
  levelLabel: string;
  totalDays: number;
  estimatedMinutesPerDay: number;
  tags: string[];
  adaptive: boolean;
}

export interface LearningPathPhase {
  title: string;
  dayRange: string;
  summary: string;
}

export interface LearningDayRecord {
  pathId: string;
  dayNumber: number;
  topic: string;
  title: string;
  explanation: string;
  task: string;
  stretchGoal?: string | null;
  hints: string[];
  languageId: number;
  techStack: TechStack[];
  expectedOutput?: string | null;
  starterCode: string;
  difficulty: GrowthPathDifficulty;
}

export interface LearningDayPreview {
  dayNumber: number;
  topic: string;
  title: string;
  difficulty: GrowthPathDifficulty;
  status: GrowthPathDayStatus;
  score: number | null;
  completedAt?: string | null;
}

export interface LearningPathDetail extends LearningPathSummary {
  overview: string;
  phases: LearningPathPhase[];
  days: LearningDayPreview[];
}

export interface LearningDayProgress {
  pathId: string;
  dayNumber: number;
  status: GrowthPathDayStatus;
  attempts: number;
  score: number | null;
  verdict: "pass" | "fail" | "review" | null;
  completedAt?: string | null;
  submissionId?: string | null;
}

export interface GrowthPathProgress {
  pathId: string;
  completedDays: number;
  totalDays: number;
  currentDay: number;
  streak: number;
  averageScore: number;
  recommendedIntensity: GrowthPathIntensity;
  submissionsCount: number;
  completionRate: number;
  days: LearningDayProgress[];
}

export interface LearningDayDetail {
  path: LearningPathSummary;
  day: LearningDayRecord;
  progress: LearningDayProgress | null;
  progressOverview: GrowthPathProgress;
}
