import "dotenv/config";

function readOptional(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length ? value.trim() : undefined;
}

function readNumber(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) ? value : fallback;
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
  openAiEvaluatorModel: readOptional("OPENAI_MODEL_EVALUATOR") ?? "gpt-4.1"
};

export const runtimeFeatures = {
  supabaseConfigured: Boolean(env.supabaseUrl && env.supabaseServiceRoleKey),
  openAiConfigured: Boolean(env.openAiApiKey),
  judge0Configured: Boolean(env.judge0BaseUrl)
};
