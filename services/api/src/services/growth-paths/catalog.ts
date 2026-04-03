import type {
  GrowthPathDifficulty,
  GrowthPathSkill,
  LearningDayRecord,
  LearningPathPhase,
  LearningPathSummary,
  TechStack
} from "@growthengine/shared";

type DaySeed = {
  topic: string;
  title: string;
  explanation: string;
  task: string;
  stretchGoal?: string;
  hints: string[];
  expectedOutput?: string;
};

type PathCatalog = {
  summary: LearningPathSummary;
  overview: string;
  phases: LearningPathPhase[];
  days: LearningDayRecord[];
};

function starterCodeFor(skill: GrowthPathSkill, title: string) {
  if (skill === "web-development") {
    return [
      "export function solveTask() {",
      `  // ${title}`,
      "  const notes = [];",
      "  return notes;",
      "}"
    ].join("\n");
  }

  return [
    `# ${title}`,
    "def solve_task(input_data: str = \"\") -> str:",
    "    # Write your implementation here",
    "    return input_data.strip()",
    "",
    "if __name__ == '__main__':",
    "    import sys",
    "    raw = sys.stdin.read()",
    "    print(solve_task(raw))"
  ].join("\n");
}

function languageIdFor(skill: GrowthPathSkill) {
  return skill === "web-development" ? 63 : 71;
}

function stackFor(skill: GrowthPathSkill): TechStack[] {
  if (skill === "web-development") {
    return ["react"];
  }

  if (skill === "machine-learning") {
    return ["python", "other"];
  }

  return ["python"];
}

function difficultyFor(dayNumber: number): GrowthPathDifficulty {
  if (dayNumber <= 30) return "foundation";
  if (dayNumber <= 70) return "build";
  return "ship";
}

function buildDays(skill: GrowthPathSkill, daySeeds: DaySeed[]): LearningDayRecord[] {
  return daySeeds.map((seed, index) => {
    const dayNumber = index + 1;
    return {
      pathId: skill,
      dayNumber,
      topic: seed.topic,
      title: seed.title,
      explanation: seed.explanation,
      task: seed.task,
      stretchGoal: seed.stretchGoal ?? null,
      hints: seed.hints,
      languageId: languageIdFor(skill),
      techStack: stackFor(skill),
      expectedOutput: seed.expectedOutput ?? null,
      starterCode: starterCodeFor(skill, seed.title),
      difficulty: difficultyFor(dayNumber)
    };
  });
}

function createSeeds(
  phaseName: string,
  nouns: string[],
  actionPrefix: string,
  implementationPrefix: string,
  stretchPrefix: string
) {
  return nouns.map((noun, index) => ({
    topic: `${phaseName}: ${noun}`,
    title: `${actionPrefix} ${noun}`,
    explanation: `Focus on ${noun.toLowerCase()} and practice the concrete implementation habits that make the concept usable in production code.`,
    task: `${implementationPrefix} ${noun.toLowerCase()} in a small, testable implementation. Write code that demonstrates the idea clearly and leaves room for iteration.`,
    stretchGoal: `${stretchPrefix} ${noun.toLowerCase()} by handling a broader edge case or making the solution easier to reuse.`,
    hints: [
      `Break ${noun.toLowerCase()} into one small implementation step first.`,
      "Prefer readable code over clever shortcuts.",
      `Leave one clear place where you can extend the ${noun.toLowerCase()} behavior.`
    ],
    expectedOutput: index % 3 === 0 ? "done" : undefined
  }));
}

const pythonSeeds = [
  ...createSeeds(
    "Core Syntax",
    [
      "Variables and expressions",
      "Conditionals",
      "Loops",
      "Functions",
      "Lists",
      "Tuples",
      "Dictionaries",
      "Sets",
      "String processing",
      "Input parsing",
      "Defensive branching",
      "Reusable helpers",
      "Function arguments",
      "List transformations",
      "Dictionary updates",
      "Nested data",
      "Sorting basics",
      "Readable output formatting",
      "Simple validation",
      "Mini CLI flow"
    ],
    "Practice",
    "Implement",
    "Extend"
  ),
  ...createSeeds(
    "Problem Solving",
    [
      "Sliding windows",
      "Counting patterns",
      "Frequency maps",
      "Stack-based parsing",
      "Queue workflows",
      "Greedy decisions",
      "Two-pointer reasoning",
      "Prefix sums",
      "Recursion basics",
      "Backtracking setup",
      "State tracking",
      "Data cleanup scripts",
      "Modular utilities",
      "Object modeling",
      "File handling",
      "Error handling",
      "Parsing structured text",
      "Transform pipelines",
      "Testing core logic",
      "Refactoring repetition"
    ],
    "Build",
    "Ship a working solution that uses",
    "Refactor"
  ),
  ...createSeeds(
    "Applied Python",
    [
      "API requests",
      "JSON transformation",
      "CSV automation",
      "Package structure",
      "Command modules",
      "Logging flow",
      "Configuration loading",
      "Caching basics",
      "Small services",
      "Database adapters",
      "Task orchestration",
      "Runtime profiling",
      "Concurrency basics",
      "Typing improvements",
      "Reusable decorators",
      "Pipeline composition",
      "Validation layers",
      "Report generation",
      "Automation scripts",
      "Deployment-minded cleanup"
    ],
    "Apply",
    "Create a practical implementation around",
    "Add production polish to"
  ),
  ...createSeeds(
    "Systems Thinking",
    [
      "Memory-aware loops",
      "Time complexity tradeoffs",
      "Large input handling",
      "Streaming transformations",
      "Retries and backoff",
      "Observability hooks",
      "Service boundaries",
      "Dependency isolation",
      "Robust parsing",
      "Schema mapping",
      "Batch processing",
      "Failure recovery",
      "Test fixtures",
      "Interface design",
      "Performance measurement",
      "Debug workflows",
      "Stable abstractions",
      "API contracts",
      "Review-ready cleanup",
      "Release checklist"
    ],
    "Engineer",
    "Solve a more realistic systems task using",
    "Strengthen"
  ),
  ...createSeeds(
    "Capstone Delivery",
    [
      "User import tool",
      "Metrics summarizer",
      "CLI task runner",
      "Small ETL job",
      "Validation service",
      "Retryable worker",
      "Reporting endpoint",
      "Data quality checker",
      "Workflow coordinator",
      "Incident replay tool",
      "Batch formatter",
      "Scheduling helper",
      "Integration adapter",
      "Audit log parser",
      "Ops automation",
      "Feature flag script",
      "Release script",
      "Migration helper",
      "Stability hardening",
      "Final polish review"
    ],
    "Deliver",
    "Build and refine",
    "Make"
  )
];

const webSeeds = [
  ...createSeeds(
    "Frontend Foundations",
    [
      "Semantic HTML",
      "CSS layout",
      "Spacing systems",
      "Typography scale",
      "Reusable components",
      "Buttons and forms",
      "Responsive containers",
      "Navigation states",
      "Card layouts",
      "Stateful UI basics",
      "Conditional rendering",
      "List rendering",
      "Event handling",
      "Input validation",
      "Component props",
      "Accessible labels",
      "Error messaging",
      "Loading states",
      "Theme variables",
      "Design tokens"
    ],
    "Practice",
    "Build a browser-facing task around",
    "Improve"
  ),
  ...createSeeds(
    "Interactive Apps",
    [
      "Search UX",
      "Filter bars",
      "Paginated lists",
      "Split layouts",
      "Modal flows",
      "Toast feedback",
      "Optimistic updates",
      "Keyboard support",
      "Form submission loops",
      "Route-driven state",
      "Data fetching",
      "Caching boundaries",
      "Error recovery",
      "Skeleton states",
      "Timeline views",
      "Dashboard metrics",
      "Sidebar systems",
      "Table interactions",
      "Drawer patterns",
      "Editor embeds"
    ],
    "Build",
    "Implement an interactive UI workflow using",
    "Add resilience to"
  ),
  ...createSeeds(
    "Professional UI",
    [
      "Theme switching",
      "Motion hierarchy",
      "Card composition",
      "Empty states",
      "Onboarding flows",
      "Settings screens",
      "Profile surfaces",
      "Submission review",
      "Data visual cards",
      "Roadmap boards",
      "Accessibility audits",
      "Color contrast",
      "Reusable hooks",
      "Suspense boundaries",
      "Server data shaping",
      "Client transitions",
      "State machines",
      "Form architecture",
      "Reusable layouts",
      "Navigation polish"
    ],
    "Craft",
    "Create a polished product feature around",
    "Refine"
  ),
  ...createSeeds(
    "Full Product Thinking",
    [
      "Auth-first flows",
      "Multi-step onboarding",
      "Permissions UI",
      "Role-aware rendering",
      "API state orchestration",
      "Error observability",
      "Performance budgets",
      "Component libraries",
      "Accessibility regression checks",
      "Responsive QA",
      "Interaction metrics",
      "Editor workflows",
      "Review loops",
      "Contribution guidance",
      "Product copy",
      "Conversion funnels",
      "Cross-page consistency",
      "Feature flags",
      "Fallback states",
      "Release readiness"
    ],
    "Design",
    "Deliver a cohesive product interaction for",
    "Harden"
  ),
  ...createSeeds(
    "Ship Real Features",
    [
      "Learning dashboard",
      "Daily task player",
      "Submission center",
      "Analytics overview",
      "Interactive roadmap",
      "Profile scorecard",
      "Contribution checklist",
      "Settings architecture",
      "Notification center",
      "Search workspace",
      "Mentor feedback panel",
      "Adaptive roadmap card",
      "Execution console shell",
      "Auth recovery page",
      "Issue browser refresh",
      "Accessibility remediation",
      "Visual regression cleanup",
      "Microcopy sweep",
      "Launch checklist",
      "Final showcase build"
    ],
    "Ship",
    "Implement",
    "Push"
  )
];

const mlSeeds = [
  ...createSeeds(
    "Math and Data Basics",
    [
      "Array operations",
      "Vector intuition",
      "Matrix shapes",
      "Feature scaling",
      "Train/test splits",
      "Missing value cleanup",
      "Categorical encoding",
      "Basic statistics",
      "Visual summaries",
      "Loss intuition",
      "Gradient intuition",
      "Sampling strategies",
      "Bias and variance",
      "Overfitting checks",
      "Dataset inspection",
      "Simple baselines",
      "Evaluation metrics",
      "Data leakage checks",
      "Experiment notes",
      "Reusable preprocessing"
    ],
    "Practice",
    "Implement a data-focused exercise around",
    "Deepen"
  ),
  ...createSeeds(
    "Modeling Workflows",
    [
      "Linear regression",
      "Classification baselines",
      "Decision trees",
      "Ensemble intuition",
      "Cross-validation",
      "Hyperparameter tuning",
      "Feature selection",
      "Model comparison",
      "Error analysis",
      "Confusion matrices",
      "Precision and recall",
      "Threshold selection",
      "Class imbalance",
      "Pipeline structure",
      "Training utilities",
      "Dataset versioning",
      "Experiment tracking",
      "Reproducibility",
      "Model packaging",
      "Prediction services"
    ],
    "Build",
    "Create a modeling implementation for",
    "Extend"
  ),
  ...createSeeds(
    "Applied Machine Learning",
    [
      "Recommendation heuristics",
      "Text preprocessing",
      "Embedding intuition",
      "Clustering basics",
      "Time series features",
      "Forecast evaluation",
      "Anomaly detection",
      "Ranking signals",
      "Personalization rules",
      "Feature stores",
      "Offline evaluation",
      "Serving latency",
      "Model monitoring",
      "Drift detection",
      "Feedback loops",
      "Human review paths",
      "Fallback heuristics",
      "Data contracts",
      "Inference batching",
      "Rollout strategies"
    ],
    "Apply",
    "Solve a practical ML workflow using",
    "Make"
  ),
  ...createSeeds(
    "ML Systems",
    [
      "Training pipelines",
      "Batch jobs",
      "Online inference",
      "Backfills",
      "Feature validation",
      "Model registry",
      "A/B test framing",
      "Alerting design",
      "Resource efficiency",
      "Failure isolation",
      "Serving contracts",
      "Quality dashboards",
      "Shadow deployments",
      "Cost controls",
      "Version rollbacks",
      "Governance checks",
      "Explainability notes",
      "Quality reviews",
      "Incident response",
      "Operational playbooks"
    ],
    "Engineer",
    "Design and implement the systems side of",
    "Stress-test"
  ),
  ...createSeeds(
    "Capstone Delivery",
    [
      "Churn predictor",
      "Search ranking helper",
      "Content classifier",
      "Anomaly dashboard",
      "Forecasting report",
      "Fraud triage scorer",
      "Recommendation prototype",
      "Ops incident classifier",
      "Feedback quality model",
      "Support routing model",
      "Experiment review pack",
      "Evaluation toolkit",
      "Serving adapter",
      "Feature health check",
      "Model audit notebook",
      "Rollback plan",
      "Launch readiness review",
      "Stakeholder summary",
      "Stability hardening",
      "Final capstone wrap-up"
    ],
    "Deliver",
    "Build a capstone around",
    "Polish"
  )
];

const pythonPhases: LearningPathPhase[] = [
  { title: "Days 1-20", dayRange: "1-20", summary: "Core syntax, control flow, and comfort with everyday Python building blocks." },
  { title: "Days 21-40", dayRange: "21-40", summary: "Problem-solving patterns and reusable implementation habits." },
  { title: "Days 41-60", dayRange: "41-60", summary: "Applied Python workflows for automation, APIs, and data handling." },
  { title: "Days 61-80", dayRange: "61-80", summary: "Systems thinking, robustness, and performance-aware design." },
  { title: "Days 81-100", dayRange: "81-100", summary: "Capstone delivery with production-minded projects and polish." }
];

const webPhases: LearningPathPhase[] = [
  { title: "Days 1-20", dayRange: "1-20", summary: "Frontend foundations, semantic structure, and resilient UI basics." },
  { title: "Days 21-40", dayRange: "21-40", summary: "Interactive product flows, state, and data-driven interfaces." },
  { title: "Days 41-60", dayRange: "41-60", summary: "Professional UI patterns, accessibility, and polished feedback loops." },
  { title: "Days 61-80", dayRange: "61-80", summary: "Product thinking, auth, orchestration, and consistency at scale." },
  { title: "Days 81-100", dayRange: "81-100", summary: "Feature shipping, refinement, and product-level delivery practice." }
];

const mlPhases: LearningPathPhase[] = [
  { title: "Days 1-20", dayRange: "1-20", summary: "Data fundamentals, metrics, and the math intuition behind models." },
  { title: "Days 21-40", dayRange: "21-40", summary: "Modeling workflows, evaluation, and reproducible experiments." },
  { title: "Days 41-60", dayRange: "41-60", summary: "Applied ML problems and practical feature engineering." },
  { title: "Days 61-80", dayRange: "61-80", summary: "ML systems, serving concerns, and operational reliability." },
  { title: "Days 81-100", dayRange: "81-100", summary: "Capstone delivery with real-world project framing and review." }
];

const catalog: Record<GrowthPathSkill, PathCatalog> = {
  python: {
    summary: {
      id: "python",
      skill: "python",
      title: "100 Days of Python Systems Practice",
      description: "Build Python confidence from syntax to production-minded automation and backend workflows.",
      levelLabel: "Beginner to advanced",
      totalDays: 100,
      estimatedMinutesPerDay: 45,
      tags: ["python", "automation", "backend"],
      adaptive: true
    },
    overview: "This path starts with implementation fundamentals, then moves into automation, service design, and capstone delivery so learners steadily build real coding instincts instead of memorizing syntax.",
    phases: pythonPhases,
    days: buildDays("python", pythonSeeds)
  },
  "web-development": {
    summary: {
      id: "web-development",
      skill: "web-development",
      title: "100 Days of Web Development Product Building",
      description: "Learn front-end and product engineering by shipping interfaces, workflows, and polished developer-tool experiences.",
      levelLabel: "Beginner to advanced",
      totalDays: 100,
      estimatedMinutesPerDay: 50,
      tags: ["frontend", "react", "product-ui"],
      adaptive: true
    },
    overview: "This path teaches web development as product delivery: component foundations first, then richer interactions, accessibility, theming, and full feature implementation across realistic SaaS-style surfaces.",
    phases: webPhases,
    days: buildDays("web-development", webSeeds)
  },
  "machine-learning": {
    summary: {
      id: "machine-learning",
      skill: "machine-learning",
      title: "100 Days of Machine Learning Implementation",
      description: "Move from data basics to model workflows and ML systems by implementing practical tasks every day.",
      levelLabel: "Beginner to advanced",
      totalDays: 100,
      estimatedMinutesPerDay: 55,
      tags: ["ml", "python", "data"],
      adaptive: true
    },
    overview: "This path blends model intuition with real implementation work, helping learners progress from datasets and metrics to production-facing ML decisions, monitoring, and capstone delivery.",
    phases: mlPhases,
    days: buildDays("machine-learning", mlSeeds)
  }
};

export function listGrowthPathCatalog() {
  return Object.values(catalog).map((item) => item.summary);
}

export function getGrowthPathCatalog(pathId: string) {
  return catalog[pathId as GrowthPathSkill] ?? null;
}
