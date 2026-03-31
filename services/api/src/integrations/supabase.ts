import { createClient } from "@supabase/supabase-js";

import { env, runtimeFeatures } from "../config";

export const supabase = runtimeFeatures.supabaseConfigured
  ? createClient(env.supabaseUrl!, env.supabaseServiceRoleKey!, {
      db: { schema: env.supabaseSchema },
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;
