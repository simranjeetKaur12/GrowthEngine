import "dotenv/config";

function readOptional(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length ? value.trim() : undefined;
}

function readNumber(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

function readBoolean(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (typeof raw !== "string") {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export const env = {
  apiPort: readNumber("API_PORT", 4000),
  supabaseUrl: readOptional("SUPABASE_URL"),
  supabaseServiceRoleKey: readOptional("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseSchema: readOptional("SUPABASE_SCHEMA") ?? "public",
  githubToken: readOptional("GITHUB_TOKEN"),
  openAiApiKey: readOptional("OPENAI_API_KEY"),
  openAiBaseUrl: readOptional("OPENAI_BASE_URL") ?? "https://api.openai.com/v1",
  judge0BaseUrl: readOptional("JUDGE0_BASE_URL"),
  judge0ApiKey: readOptional("JUDGE0_API_KEY"),
  openAiClassifierModel: readOptional("OPENAI_MODEL_CLASSIFIER") ?? "gpt-4.1-mini",
  openAiEvaluatorModel: readOptional("OPENAI_MODEL_EVALUATOR") ?? "gpt-4.1",
  aiAnalyzerEnabled: readBoolean("AI_ANALYZER_ENABLED", true),
  issueExecutionMode: readOptional("ISSUE_EXECUTION_MODE") ?? "ai_only",
  judge0DisabledForIssues: readBoolean("JUDGE0_DISABLED_FOR_ISSUES", true),
  issueSimulationUsesJudge0: readBoolean("ISSUE_SIMULATION_USES_JUDGE0", false),
  guidedContextEnabled: readBoolean("GUIDED_CONTEXT_ENABLED", true),
  guidedContextUseAi: readBoolean("GUIDED_CONTEXT_USE_AI", true),
  multiLayerEvaluationEnabled: readBoolean("MULTI_LAYER_EVALUATION_ENABLED", true),
  structuralEvaluationEnabled: readBoolean("STRUCTURAL_EVALUATION_ENABLED", true),
  behavioralEvaluationEnabled: readBoolean("BEHAVIORAL_EVALUATION_ENABLED", false),
  behavioralBackendMocksEnabled: readBoolean("BEHAVIORAL_BACKEND_MOCKS_ENABLED", true),
  behavioralFrontendPlaywrightEnabled: readBoolean("BEHAVIORAL_FRONTEND_PLAYWRIGHT_ENABLED", false),
  behavioralFrontendPlaywrightHeadless: readBoolean("BEHAVIORAL_FRONTEND_PLAYWRIGHT_HEADLESS", true),
  enableTicketSystem: readBoolean("ENABLE_TICKET_SYSTEM", true),
  enableIterativeAiAnalyzer: readBoolean("ENABLE_ITERATIVE_AI_ANALYZER", true),
  enableCompanyWorkflow: readBoolean("ENABLE_COMPANY_WORKFLOW", true)
};

export const runtimeFeatures = {
  supabaseConfigured: Boolean(env.supabaseUrl && env.supabaseServiceRoleKey),
  openAiConfigured: Boolean(env.openAiApiKey),
  judge0Configured: Boolean(env.judge0BaseUrl),
  aiAnalyzerEnabled: env.aiAnalyzerEnabled,
  issueExecutionMode: env.issueExecutionMode,
  judge0DisabledForIssues: env.judge0DisabledForIssues,
  issueSimulationUsesJudge0: env.issueSimulationUsesJudge0,
  guidedContextEnabled: env.guidedContextEnabled,
  guidedContextUseAi: env.guidedContextUseAi,
  multiLayerEvaluationEnabled: env.multiLayerEvaluationEnabled,
  structuralEvaluationEnabled: env.structuralEvaluationEnabled,
  behavioralEvaluationEnabled: env.behavioralEvaluationEnabled,
  behavioralBackendMocksEnabled: env.behavioralBackendMocksEnabled,
  behavioralFrontendPlaywrightEnabled: env.behavioralFrontendPlaywrightEnabled,
  enableTicketSystem: env.enableTicketSystem,
  enableIterativeAiAnalyzer: env.enableIterativeAiAnalyzer,
  enableCompanyWorkflow: env.enableCompanyWorkflow
};
