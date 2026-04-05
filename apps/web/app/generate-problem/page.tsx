import { DashboardShell } from "../../components/dashboard-shell";

export default function GenerateProblemPage() {
  return (
    <DashboardShell
      title="Generate Problem"
      subtitle="Create AI-tailored simulation scenarios from repository context"
    >
      <section className="ui-card">
        <h3 className="text-lg font-semibold text-primary">Coming next</h3>
        <p className="mt-2 text-sm text-secondary">
          This area will support custom problem generation from repository metadata, issue labels,
          and skill targets.
        </p>
      </section>
    </DashboardShell>
  );
}
