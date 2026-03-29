import { createApp } from "./app";
import { env, runtimeFeatures } from "./config";

const app = createApp();

app.listen(env.apiPort, () => {
  console.log(
    `API listening on http://localhost:${env.apiPort} (store=${runtimeFeatures.supabaseConfigured ? "supabase" : "memory"}, execution=${runtimeFeatures.judge0Configured ? "judge0" : "mock"}, ai=${runtimeFeatures.openAiConfigured ? "openai" : "fallback"})`
  );
});
