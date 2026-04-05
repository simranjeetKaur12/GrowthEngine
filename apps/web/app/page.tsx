"use client";

import { ArrowRight, BrainCircuit, Code2, FolderGit2, Sparkles } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "../components/brand-logo";
import { ThemeToggle } from "../components/theme-toggle";

const howItWorks = [
  "Sync GitHub repository",
  "Issues converted into structured problems",
  "Solve inside a simulation workspace",
  "AI reviews your code like a senior engineer"
] as const;

const features = [
  "Real GitHub issue ingestion",
  "Difficulty classification",
  "Code editor with execution",
  "AI feedback system",
  "Developer profile tracking",
  "Contribution guidance"
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen text-[color:var(--text-primary)]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[color:var(--page-header-bg)]/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <BrandLogo href="/" size={48} />

          <nav className="hidden items-center gap-6 text-sm text-[color:var(--text-secondary)] lg:flex">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <Link href="/problems">Problems</Link>
            <Link href="/auth?next=%2Fdashboard">Login</Link>
            <Link href="/auth?next=%2Fdashboard" className="ui-button">
              Signup
            </Link>
            <ThemeToggle compact />
          </nav>

          <div className="flex items-center gap-3 lg:hidden">
            <ThemeToggle compact />
            <Link href="/auth?next=%2Fdashboard" className="ui-button">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1fr_0.95fr] lg:py-24">
          <div className="space-y-6">
            <p className="inline-flex items-center rounded-full border border-brand-400/20 bg-brand-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-brand-100">
              Turn Real Issues Into Real Skills.
            </p>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-[color:var(--text-primary)] md:text-6xl">
              Developer Simulation Platform Using Real GitHub Issues
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-[color:var(--text-secondary)]">
              Turn real open-source issues into structured coding simulations and learn like a professional software engineer.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/auth?next=%2Fdashboard" className="ui-button">
                Get Started
                <ArrowRight size={18} />
              </Link>
              <Link href="/problems" className="ui-button-muted">
                View Problems
              </Link>
            </div>

            <div className="grid gap-4 pt-4 sm:grid-cols-3">
              <div className="surface-subtle p-4">
                <FolderGit2 size={20} className="text-brand-200" />
                <p className="mt-3 text-sm text-[color:var(--text-secondary)]">Pull live GitHub issues into your practice pipeline.</p>
              </div>
              <div className="surface-subtle p-4">
                <Code2 size={20} className="text-brand-200" />
                <p className="mt-3 text-sm text-[color:var(--text-secondary)]">Code inside a simulation workspace with execution and review.</p>
              </div>
              <div className="surface-subtle p-4">
                <BrainCircuit size={20} className="text-brand-200" />
                <p className="mt-3 text-sm text-[color:var(--text-secondary)]">Receive structured AI feedback like a senior engineer.</p>
              </div>
            </div>
          </div>
          <div className="workspace-card flex flex-col justify-center">
            <p className="text-xs uppercase tracking-[0.24em] text-brand-300">What You Practice</p>
            <h2 className="mt-3 text-3xl font-semibold text-[color:var(--text-primary)]">
              Real repository context, real engineering loops
            </h2>
            <p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">
              GrowthEngine helps you move from issue discovery to structured problem solving, AI review, and contribution readiness without relying on toy exercises.
            </p>
            <div className="mt-8 grid gap-4">
              <article className="surface-subtle p-5">
                <p className="text-sm font-medium text-[color:var(--text-primary)]">Structured simulations from real GitHub issues</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                  GitHub issue noise is cleaned, classified, and rewritten into beginner-friendly problem scenarios.
                </p>
              </article>
              <article className="surface-subtle p-5">
                <p className="text-sm font-medium text-[color:var(--text-primary)]">Execution, review, and contribution in one flow</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                  Run code, submit for AI review, and then move into a guided contribution sequence for the original repository.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto w-full max-w-7xl px-4 py-10">
          <p className="text-xs uppercase tracking-[0.24em] text-brand-300">How It Works</p>
          <h2 className="mt-3 text-3xl font-semibold text-[color:var(--text-primary)]">A real engineering workflow from discovery to contribution</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {howItWorks.map((step, index) => (
              <article key={step} className="ui-card">
                <span className="badge status-review border">Step {index + 1}</span>
                <h3 className="mt-4 text-lg font-semibold text-[color:var(--text-primary)]">{step}</h3>
              </article>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-7xl px-4 py-10">
          <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
            <div className="workspace-card">
              <p className="text-xs uppercase tracking-[0.24em] text-brand-300">Features</p>
              <h2 className="mt-3 text-3xl font-semibold text-[color:var(--text-primary)]">Built for professional-level practice</h2>
              <p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">
                GrowthEngine connects real issue ingestion, simulation, execution, AI evaluation, and contribution guidance in one workflow.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {features.map((feature) => (
                <article key={feature} className="surface-subtle p-5">
                  <Sparkles size={18} className="text-brand-200" />
                  <p className="mt-4 text-sm font-medium text-[color:var(--text-primary)]">{feature}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-10 border-t border-white/10 bg-[color:var(--page-header-bg)]/90">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-10 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <BrandLogo href="/" size={44} />
            <p className="mt-4 max-w-md text-sm leading-6 text-[color:var(--text-secondary)]">
              GrowthEngine converts open-source issues into structured developer simulations with feedback and contribution steps.
            </p>
          </div>
          <div className="grid gap-2 text-sm text-[color:var(--text-secondary)]">
            <Link href="/auth?next=%2Fdashboard">Login</Link>
            <Link href="/auth?next=%2Fdashboard">Signup</Link>
            <Link href="/problems">Problems</Link>
            <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
            <a href="mailto:hello@growthengine.dev">hello@growthengine.dev</a>
          </div>
          <div className="flex items-start md:justify-end">
            <ThemeToggle />
          </div>
        </div>
      </footer>
    </div>
  );
}
