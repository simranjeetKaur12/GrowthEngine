"use client";

import { FolderGit2, Map, Search, Settings, TerminalSquare, UserCircle2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthControls } from "./auth-controls";
import { BrandLogo } from "./brand-logo";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/problems", label: "Problems", icon: FolderGit2 },
  { href: "/growth-paths", label: "GrowthPaths", icon: Map },
  { href: "/find-problems", label: "Find Problems", icon: Search },
  { href: "/my-submissions", label: "My Submissions", icon: TerminalSquare },
  { href: "/profile", label: "Profile", icon: UserCircle2 },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function DashboardShell({
  title,
  subtitle,
  rightSlot,
  children
}: {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarVisible, setSidebarVisible] = useState(false);

  useEffect(() => {
    setSidebarVisible(false);
  }, [pathname]);

  return (
    <div className="min-h-screen text-primary">
      <div className="relative mx-auto min-h-screen w-full max-w-[1500px]">
        <button
          type="button"
          aria-label="Reveal sidebar"
          className="fixed inset-y-0 left-0 z-30 hidden w-8 bg-transparent lg:block"
          onMouseEnter={() => setSidebarVisible(true)}
        />

        <aside
          className={`fixed left-4 top-4 z-40 hidden h-[calc(100vh-2rem)] w-[260px] flex-col rounded-[28px] border border-white/10 bg-[color:var(--shell-sidebar-bg)] p-5 shadow-panel backdrop-blur-xl transition-transform duration-300 ease-out lg:flex ${
            sidebarVisible ? "translate-x-0" : "-translate-x-[calc(100%+1.5rem)]"
          }`}
          onMouseEnter={() => setSidebarVisible(true)}
          onMouseLeave={() => setSidebarVisible(false)}
        >
          <div className="mb-8">
            <BrandLogo href="/dashboard" size={52} className="mb-4" />
            <h1 className="text-[26px] font-bold leading-tight text-[color:var(--text-primary)]">Developer Simulation</h1>
          </div>

          <nav className="space-y-2.5">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group sidebar-link ${active ? "sidebar-link-active" : ""}`}
                >
                  <span className="sidebar-icon-badge">
                    <Icon size={20} className={`${active ? "text-brand-200" : "text-slate-400 group-hover:text-slate-200"}`} />
                  </span>
                  <span className={`${active ? "text-slate-50" : "text-slate-300"}`}>{item.label}</span>
                  <span className={`ml-auto h-2 w-2 rounded-full transition-all duration-200 ${active ? "bg-brand-300 shadow-[0_0_12px_rgba(96,165,250,0.8)]" : "bg-slate-700 group-hover:bg-slate-500"}`} />
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="p-4 lg:p-4">
          <header className="section-card mb-6 rounded-[28px]">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-[26px] font-bold tracking-tight text-primary">{title}</h2>
                {subtitle ? <p className="mt-1 text-[15px] leading-6 text-secondary">{subtitle}</p> : null}
              </div>
              <div className="flex flex-col items-stretch gap-4 md:items-end">
                {rightSlot}
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <ThemeToggle compact />
                  <AuthControls />
                </div>
              </div>
            </div>
          </header>

          <main className="animate-floatIn">{children}</main>
        </div>
      </div>
    </div>
  );
}
