"use client";

import type { ComponentType, ReactNode } from "react";

import { Bot, BrainCircuit, Loader2, LogOut, Settings2, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { UserSettings } from "@growthengine/shared";

import { DashboardShell } from "../../components/dashboard-shell";
import { GitHubMark } from "../../components/social-icons";
import { useTheme } from "../../components/theme-provider";
import {
  createUserProfile,
  deleteUserProfile,
  fetchUserSettings,
  updateUserSettings
} from "../../lib/api";
import { supabaseBrowser } from "../../lib/supabase-browser";

const demoIdentity = {
  id: "demo-user",
  email: "demo@growthengine.local"
};

function SectionCard({
  icon: Icon,
  title,
  description,
  children
}: {
  icon: ComponentType<any>;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="workspace-card">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <Icon size={20} className="text-brand-200" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-primary">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-secondary">{description}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="surface-elevated p-4">
      <span className="text-sm font-medium text-primary">{label}</span>
      {hint ? <p className="mt-1 text-sm leading-6 text-secondary">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  disabled = false
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
        checked ? "border-brand-400/40 bg-brand-500/25" : "border-white/10 bg-white/5"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { setTheme } = useTheme();

  useEffect(() => {
    let mounted = true;

    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
    });

    const { data } = supabaseBrowser.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const identity = useMemo(
    () =>
      session?.user?.id
        ? {
            id: session.user.id,
            email: session.user.email ?? demoIdentity.email,
            githubConnected:
              session.user.app_metadata?.provider === "github" ||
              session.user.identities?.some((identityItem) => identityItem.provider === "github") ||
              false
          }
        : {
            ...demoIdentity,
            githubConnected: false
          },
    [session?.user]
  );

  useEffect(() => {
    setLoading(true);
    createUserProfile({ id: identity.id, email: identity.email })
      .then(() => fetchUserSettings(identity.id, session?.access_token))
      .then(({ settings: loadedSettings }) => {
        const nextSettings =
          loadedSettings.githubConnected === identity.githubConnected
            ? loadedSettings
            : { ...loadedSettings, githubConnected: identity.githubConnected };

        setSettings(nextSettings);
        setTheme(nextSettings.editorTheme);
        setError("");

        if (loadedSettings.githubConnected !== identity.githubConnected) {
          return updateUserSettings(
            identity.id,
            { githubConnected: identity.githubConnected },
            session?.access_token
          ).then(({ settings: synced }) => setSettings(synced));
        }

        return Promise.resolve();
      })
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "Failed to load settings");
      })
      .finally(() => setLoading(false));
  }, [identity.email, identity.githubConnected, identity.id, session?.access_token, setTheme]);

  async function patchSettings(patch: Partial<UserSettings>, saveLabel: string) {
    if (!settings) return;

    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);
    setSavingKey(saveLabel);
    setMessage("");
    setError("");

    if (patch.editorTheme) {
      setTheme(patch.editorTheme);
    }

    try {
      const result = await updateUserSettings(identity.id, patch, session?.access_token);
      setSettings(result.settings);
      setMessage("Settings saved.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save settings");
      setSettings(settings);
      if (settings.editorTheme) {
        setTheme(settings.editorTheme);
      }
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSignOut() {
    await supabaseBrowser.auth.signOut();
  }

  async function handleDeleteAccount() {
    if (!session?.user?.id) {
      setError("Delete account is only available for authenticated users.");
      return;
    }

    const confirmed = window.confirm("Delete your GrowthEngine account and saved settings? This cannot be undone.");
    if (!confirmed) return;

    setDeleting(true);
    setError("");
    setMessage("");

    try {
      await deleteUserProfile(session.user.id, session.access_token);
      await supabaseBrowser.auth.signOut();
      setMessage("Account deleted.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <DashboardShell
      title="Settings"
      subtitle="Customize your development environment, AI guidance, learning focus, and connected account behavior"
      rightSlot={
        <div className="flex flex-wrap items-center gap-3">
          {savingKey ? (
            <span className="badge status-review border gap-2">
              <Loader2 size={14} className="animate-spin" />
              Saving {savingKey}
            </span>
          ) : null}
          {settings ? <span className="badge status-review border">{settings.editorTheme} theme</span> : null}
        </div>
      }
    >
      <div className="space-y-6">
        {loading ? (
          <section className="workspace-card">
            <p className="text-sm text-secondary">Loading your workspace preferences...</p>
          </section>
        ) : null}

        {error ? (
          <section className="workspace-card">
            <p className="text-sm text-rose-300">{error}</p>
          </section>
        ) : null}

        {message ? (
          <section className="workspace-card">
            <p className="text-sm text-emerald-300">{message}</p>
          </section>
        ) : null}

        {settings ? (
          <>
            <SectionCard
              icon={Settings2}
              title="Developer Preferences"
              description="Shape the coding environment you land in every time you open a simulation or daily learning task."
            >
              <Field label="Default programming language" hint="Used as the preferred starter language for new workspaces.">
                <select className="ui-input" value={settings.defaultLanguage} onChange={(event) => patchSettings({ defaultLanguage: event.target.value as UserSettings["defaultLanguage"] }, "language")}>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                </select>
              </Field>

              <Field label="Editor theme" hint="Syncs the full app theme and code editor appearance.">
                <select className="ui-input" value={settings.editorTheme} onChange={(event) => patchSettings({ editorTheme: event.target.value as UserSettings["editorTheme"] }, "theme")}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </Field>

              <Field label={`Font size: ${settings.fontSize}px`} hint="Set the default editor font size for code tasks.">
                <input className="w-full accent-blue-500" type="range" min={12} max={22} step={1} value={settings.fontSize} onChange={(event) => patchSettings({ fontSize: Number(event.target.value) }, "font size")} />
              </Field>

              <Field label="Tab size" hint="Choose indentation width for new code sessions.">
                <select className="ui-input" value={settings.tabSize} onChange={(event) => patchSettings({ tabSize: Number(event.target.value) }, "tab size")}>
                  <option value={2}>2 spaces</option>
                  <option value={4}>4 spaces</option>
                  <option value={8}>8 spaces</option>
                </select>
              </Field>

              <Field label="Auto-save" hint="Keep drafts persisted while you work through simulations and roadmaps.">
                <Toggle checked={settings.autoSave} onChange={(next) => patchSettings({ autoSave: next }, "auto-save")} />
              </Field>
            </SectionCard>

            <SectionCard
              icon={Bot}
              title="AI Behavior"
              description="Control how much guidance the AI reviewer gives and how supportive the workspace feels."
            >
              <Field label="Feedback verbosity" hint="Tune how concise or detailed the AI review should be.">
                <select className="ui-input" value={settings.feedbackVerbosity} onChange={(event) => patchSettings({ feedbackVerbosity: event.target.value as UserSettings["feedbackVerbosity"] }, "AI verbosity")}>
                  <option value="minimal">Minimal</option>
                  <option value="standard">Standard</option>
                  <option value="detailed">Detailed</option>
                </select>
              </Field>

              <Field label="Hints enabled" hint="Allow guided hints to appear before or during implementation.">
                <Toggle checked={settings.hintsEnabled} onChange={(next) => patchSettings({ hintsEnabled: next }, "hints")} />
              </Field>

              <Field label="Code explanation after submission" hint="Show AI-generated reasoning and explanation after reviews.">
                <Toggle checked={settings.explanationAfterSubmission} onChange={(next) => patchSettings({ explanationAfterSubmission: next }, "AI explanation")} />
              </Field>
            </SectionCard>

            <SectionCard
              icon={BrainCircuit}
              title="Learning Preferences"
              description="Steer GrowthPaths and challenge pacing toward the type of engineer you want to become."
            >
              <Field label="Skill focus" hint="Bias learning recommendations toward a core area.">
                <select className="ui-input" value={settings.skillFocus} onChange={(event) => patchSettings({ skillFocus: event.target.value as UserSettings["skillFocus"] }, "skill focus")}>
                  <option value="frontend">Frontend</option>
                  <option value="backend">Backend</option>
                  <option value="ai">AI</option>
                  <option value="dsa">DSA</option>
                </select>
              </Field>

              <Field label="Difficulty level" hint="Set the default challenge level for recommended tasks.">
                <select className="ui-input" value={settings.difficultyLevel} onChange={(event) => patchSettings({ difficultyLevel: event.target.value as UserSettings["difficultyLevel"] }, "difficulty")} >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </Field>

              <Field label={`Daily learning goal: ${settings.dailyLearningGoal} min`} hint="Target focus time per day for roadmap progress.">
                <input className="w-full accent-blue-500" type="range" min={15} max={120} step={15} value={settings.dailyLearningGoal} onChange={(event) => patchSettings({ dailyLearningGoal: Number(event.target.value) }, "daily goal")} />
              </Field>

              <Field label="Adaptive learning" hint="Adjust recommendations based on recent scores and completion momentum.">
                <Toggle checked={settings.adaptiveLearning} onChange={(next) => patchSettings({ adaptiveLearning: next }, "adaptive learning")} />
              </Field>
            </SectionCard>

            <SectionCard
              icon={SlidersHorizontal}
              title="Simulation Settings"
              description="Decide how strict the simulation loop should feel and what kind of repositories you prefer practicing against."
            >
              <Field label="Simulation mode" hint="Strict mode expects closer output and review discipline.">
                <select className="ui-input" value={settings.simulationMode} onChange={(event) => patchSettings({ simulationMode: event.target.value as UserSettings["simulationMode"] }, "simulation mode")}>
                  <option value="strict">Strict</option>
                  <option value="relaxed">Relaxed</option>
                </select>
              </Field>

              <Field label="Preferred repository type" hint="Used when surfacing issues and contribution-oriented tasks.">
                <select className="ui-input" value={settings.preferredRepositoryType} onChange={(event) => patchSettings({ preferredRepositoryType: event.target.value as UserSettings["preferredRepositoryType"] }, "repository preference")}>
                  <option value="open-source">Open source</option>
                  <option value="curated">Curated</option>
                  <option value="mixed">Mixed</option>
                </select>
              </Field>

              <Field label="Automatic PR guide generation" hint="Prepare contribution steps as soon as a solution becomes contribution-ready.">
                <Toggle checked={settings.autoGeneratePrGuide} onChange={(next) => patchSettings({ autoGeneratePrGuide: next }, "PR guide")} />
              </Field>
            </SectionCard>

            <SectionCard
              icon={GitHubMark}
              title="Account & Integrations"
              description="Review GitHub connection state, syncing behavior, and account-level actions."
            >
              <Field label="GitHub connection status" hint="Reflects whether your active account is connected through GitHub OAuth.">
                <div className="flex items-center justify-between gap-3">
                  <span className={`badge border ${settings.githubConnected ? "status-pass" : "status-review"}`}>
                    {settings.githubConnected ? "Connected" : "Not connected"}
                  </span>
                  {!settings.githubConnected ? <a href="/auth?next=%2Fsettings" className="ui-button-muted">Connect GitHub</a> : null}
                </div>
              </Field>

              <Field label="Automatic repository syncing" hint="Refresh connected repository data without manually triggering sync every time.">
                <Toggle checked={settings.automaticRepoSync} onChange={(next) => patchSettings({ automaticRepoSync: next }, "repo sync")} />
              </Field>

              <Field label="Logout" hint="End the current session on this device.">
                <button className="ui-button-muted" type="button" onClick={handleSignOut}>
                  <LogOut size={18} />
                  Logout
                </button>
              </Field>

              <Field label="Delete account" hint="Remove your GrowthEngine profile, settings, and authenticated account.">
                <button className="ui-button-muted border-rose-400/25 text-rose-200" type="button" onClick={handleDeleteAccount} disabled={deleting}>
                  <Trash2 size={18} />
                  {deleting ? "Deleting..." : "Delete account"}
                </button>
              </Field>
            </SectionCard>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}
