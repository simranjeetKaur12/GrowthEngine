import { DashboardShell } from "../../components/dashboard-shell";

export default function SettingsPage() {
  return (
    <DashboardShell
      title="Settings"
      subtitle="Manage language defaults, execution preferences, and contribution behavior"
    >
      <section className="ui-card">
        <h3 className="text-lg font-semibold text-white">Preferences roadmap</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li>Default language and editor template</li>
          <li>Expected output comparison mode</li>
          <li>AI review verbosity</li>
          <li>Contribution tracking automation</li>
        </ul>
      </section>
    </DashboardShell>
  );
}
