import type { UserSettings, UserStats } from "@growthengine/shared";

import { supabase } from "../../integrations/supabase";
import { getUserProgressOverview, listContributionGuides } from "../../modules/store";

const inMemoryUsers = new Map<string, { id: string; name: string | null; email: string; created_at: string }>();
const inMemorySettings = new Map<string, UserSettings>();

function db() {
  return supabase;
}

function isSettingsStoreError(message: string) {
  return (
    message.includes("user_settings") ||
    message.includes("schema cache") ||
    message.includes("Could not find the table") ||
    message.includes("relation \"user_settings\" does not exist")
  );
}

function getFallbackSettings(userId: string) {
  const existing = inMemorySettings.get(userId);
  if (existing) {
    return existing;
  }

  const defaults = defaultUserSettings(userId);
  inMemorySettings.set(userId, defaults);
  return defaults;
}

export function defaultUserSettings(userId: string): UserSettings {
  const now = new Date().toISOString();
  return {
    userId,
    defaultLanguage: "python",
    editorTheme: "dark",
    fontSize: 14,
    tabSize: 2,
    autoSave: true,
    feedbackVerbosity: "standard",
    hintsEnabled: true,
    explanationAfterSubmission: true,
    skillFocus: "backend",
    difficultyLevel: "medium",
    dailyLearningGoal: 45,
    adaptiveLearning: true,
    simulationMode: "strict",
    preferredRepositoryType: "mixed",
    autoGeneratePrGuide: true,
    githubConnected: false,
    automaticRepoSync: false,
    createdAt: now,
    updatedAt: now
  };
}

function toSettingsRow(settings: UserSettings) {
  return {
    user_id: settings.userId,
    default_language: settings.defaultLanguage,
    editor_theme: settings.editorTheme,
    font_size: settings.fontSize,
    tab_size: settings.tabSize,
    auto_save: settings.autoSave,
    feedback_verbosity: settings.feedbackVerbosity,
    hints_enabled: settings.hintsEnabled,
    explanation_after_submission: settings.explanationAfterSubmission,
    skill_focus: settings.skillFocus,
    difficulty_level: settings.difficultyLevel,
    daily_learning_goal: settings.dailyLearningGoal,
    adaptive_learning: settings.adaptiveLearning,
    simulation_mode: settings.simulationMode,
    preferred_repository_type: settings.preferredRepositoryType,
    auto_generate_pr_guide: settings.autoGeneratePrGuide,
    github_connected: settings.githubConnected,
    automatic_repo_sync: settings.automaticRepoSync,
    created_at: settings.createdAt,
    updated_at: settings.updatedAt
  };
}

function fromSettingsRow(row: any): UserSettings {
  return {
    userId: row.user_id,
    defaultLanguage: row.default_language,
    editorTheme: row.editor_theme,
    fontSize: row.font_size,
    tabSize: row.tab_size,
    autoSave: row.auto_save,
    feedbackVerbosity: row.feedback_verbosity,
    hintsEnabled: row.hints_enabled,
    explanationAfterSubmission: row.explanation_after_submission,
    skillFocus: row.skill_focus,
    difficultyLevel: row.difficulty_level,
    dailyLearningGoal: row.daily_learning_goal,
    adaptiveLearning: row.adaptive_learning,
    simulationMode: row.simulation_mode,
    preferredRepositoryType: row.preferred_repository_type,
    autoGeneratePrGuide: row.auto_generate_pr_guide,
    githubConnected: row.github_connected,
    automaticRepoSync: row.automatic_repo_sync,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createUser(input: { id: string; name?: string; email: string }) {
  const createdAt = new Date().toISOString();

  if (!db()) {
    const user = { id: input.id, name: input.name ?? null, email: input.email, created_at: createdAt };
    inMemoryUsers.set(input.id, user);
    if (!inMemorySettings.has(input.id)) {
      inMemorySettings.set(input.id, defaultUserSettings(input.id));
    }
    return user;
  }

  const result = await db()!
    .from("users")
    .upsert({ id: input.id, name: input.name ?? null, email: input.email, created_at: createdAt }, { onConflict: "id" })
    .select("id, name, email, created_at")
    .single();

  if (result.error) {
    throw new Error(result.error.message);
  }

  try {
    await ensureUserSettings(input.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize user settings";
    if (!isSettingsStoreError(message)) {
      throw error;
    }

    getFallbackSettings(input.id);
  }

  return result.data;
}

export async function getUser(id: string) {
  if (!db()) {
    return inMemoryUsers.get(id) ?? null;
  }

  const result = await db()!.from("users").select("id, name, email, created_at").eq("id", id).maybeSingle();
  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function ensureUserSettings(userId: string) {
  const existing = await getUserSettings(userId);
  if (existing) {
    return existing;
  }

  const defaults = defaultUserSettings(userId);

  if (!db()) {
    inMemorySettings.set(userId, defaults);
    return defaults;
  }

  const result = await db()!
    .from("user_settings")
    .upsert(toSettingsRow(defaults), { onConflict: "user_id" })
    .select("*")
    .single();

  if (result.error) {
    if (isSettingsStoreError(result.error.message)) {
      return getFallbackSettings(userId);
    }

    throw new Error(result.error.message);
  }

  return fromSettingsRow(result.data);
}

export async function getUserSettings(userId: string) {
  if (!db()) {
    return inMemorySettings.get(userId) ?? null;
  }

  const result = await db()!.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
  if (result.error) {
    if (isSettingsStoreError(result.error.message)) {
      return getFallbackSettings(userId);
    }

    throw new Error(result.error.message);
  }

  return result.data ? fromSettingsRow(result.data) : getFallbackSettings(userId);
}

export async function updateUserSettings(userId: string, patch: Partial<UserSettings>) {
  const current = (await ensureUserSettings(userId)) ?? defaultUserSettings(userId);
  const next: UserSettings = {
    ...current,
    ...patch,
    userId,
    updatedAt: new Date().toISOString()
  };

  if (!db()) {
    inMemorySettings.set(userId, next);
    return next;
  }

  const result = await db()!
    .from("user_settings")
    .upsert(toSettingsRow(next), { onConflict: "user_id" })
    .select("*")
    .single();

  if (result.error) {
    if (isSettingsStoreError(result.error.message)) {
      inMemorySettings.set(userId, next);
      return next;
    }

    throw new Error(result.error.message);
  }

  return fromSettingsRow(result.data);
}

export async function deleteUserAccount(userId: string) {
  if (!db()) {
    inMemoryUsers.delete(userId);
    inMemorySettings.delete(userId);
    return { deleted: true };
  }

  const settingsDelete = await db()!.from("user_settings").delete().eq("user_id", userId);
  if (settingsDelete.error && !isSettingsStoreError(settingsDelete.error.message)) {
    throw new Error(settingsDelete.error.message);
  }

  const userDelete = await db()!.from("users").delete().eq("id", userId);
  if (userDelete.error) {
    throw new Error(userDelete.error.message);
  }

  const adminDelete = await db()!.auth.admin.deleteUser(userId);
  if (adminDelete.error) {
    throw new Error(adminDelete.error.message);
  }

  return { deleted: true };
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const overview = await getUserProgressOverview(userId);
  const contributions = await listContributionGuides(userId);

  const skillBreakdown = {
    frontend: 0,
    backend: 0,
    fullstack: 0,
    devops: 0
  } as const;

  const mutableSkillBreakdown = {
    ...skillBreakdown
  };

  for (const item of overview.issueSummaries) {
    if (item.repositoryFullName.includes("react") || item.repositoryFullName.includes("next")) {
      mutableSkillBreakdown.frontend += 1;
    } else if (item.repositoryFullName.includes("node") || item.repositoryFullName.includes("django")) {
      mutableSkillBreakdown.backend += 1;
    } else {
      mutableSkillBreakdown.fullstack += 1;
    }
  }

  const totalEvaluated = overview.issueSummaries.filter((item) => item.latestVerdict).length;
  const solved = overview.issueSummaries.filter((item) => item.latestVerdict === "pass");

  const easy = overview.issueSummaries.filter((item) => item.difficulty === "beginner" && item.latestVerdict === "pass").length;
  const medium = overview.issueSummaries.filter((item) => item.difficulty === "intermediate" && item.latestVerdict === "pass").length;
  const hard = overview.issueSummaries.filter((item) => item.difficulty === "advanced" && item.latestVerdict === "pass").length;

  return {
    problemsSolved: solved.length,
    easy,
    medium,
    hard,
    successRate: totalEvaluated ? Math.round((solved.length / totalEvaluated) * 100) : 0,
    recentActivity: overview.timeline.slice(0, 12),
    contributions: contributions.filter((item) => Boolean(item.pr_url)).length,
    skillBreakdown: mutableSkillBreakdown
  };
}
