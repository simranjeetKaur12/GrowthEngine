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
  if (skill === "web-development" || skill === "mobile-development") {
    return 63;
  }

  return 71;
}

function stackFor(skill: GrowthPathSkill): TechStack[] {
  if (skill === "web-development") {
    return ["react"];
  }

  if (skill === "mobile-development") {
    return ["react", "other"];
  }

  if (skill === "machine-learning") {
    return ["python", "other"];
  }

  if (skill === "cloud-devops") {
    return ["devops", "nodejs"];
  }

  if (skill === "data-engineering") {
    return ["python", "database"];
  }

  if (skill === "cybersecurity") {
    return ["python", "other"];
  }

  if (skill === "ai-engineering") {
    return ["python", "nodejs", "other"];
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

function createGeneratedPhaseSeeds(
  phaseName: string,
  focus: string,
  nouns: string[],
  actionPrefix: string,
  implementationPrefix: string,
  stretchPrefix: string
) {
  return nouns.map((noun, index) => ({
    topic: `${phaseName}: ${noun}`,
    title: `${actionPrefix} ${noun}`,
    explanation: `Build applied confidence in ${focus} by implementing ${noun.toLowerCase()} with production-minded constraints and clear validation.` ,
    task: `${implementationPrefix} ${noun.toLowerCase()} using a small, testable workflow with clear inputs and outputs.`,
    stretchGoal: `${stretchPrefix} ${noun.toLowerCase()} by improving reliability, observability, or reuse.`,
    hints: [
      `Start with one narrow objective for ${noun.toLowerCase()}.`,
      "Validate expected behavior before adding complexity.",
      `Leave clear extension points in your ${focus} implementation.`
    ],
    expectedOutput: index % 4 === 0 ? "done" : undefined
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

const aiEngineeringSeeds = [
  ...createGeneratedPhaseSeeds(
    "AI Foundations",
    "AI engineering",
    [
      "Prompt structuring",
      "Output schema design",
      "Token budgeting",
      "Context windows",
      "Role prompting",
      "Instruction hierarchy",
      "Guardrail basics",
      "Response validation",
      "Fallback response patterns",
      "Prompt regression checks",
      "Eval dataset setup",
      "Model behavior notes",
      "Latency tradeoffs",
      "Cost-aware prompting",
      "Prompt modularization",
      "Result normalization",
      "Error surfaces",
      "Safety intent checks",
      "Task decomposition",
      "Baseline assistant loop"
    ],
    "Practice",
    "Implement",
    "Harden"
  ),
  ...createGeneratedPhaseSeeds(
    "LLM Product Patterns",
    "AI product workflows",
    [
      "Retrieval pipelines",
      "Chunking strategies",
      "Embedding selection",
      "Vector query flow",
      "Hybrid retrieval",
      "Reranking",
      "Citation grounding",
      "Session memory",
      "Tool calling",
      "Function contracts",
      "Agent checkpoints",
      "Structured planning",
      "Result verification",
      "Guardrail policies",
      "Abuse mitigation",
      "PII redaction",
      "Streaming UX",
      "Retry orchestration",
      "Timeout handling",
      "Conversation state"
    ],
    "Build",
    "Ship",
    "Scale"
  ),
  ...createGeneratedPhaseSeeds(
    "AI Reliability",
    "AI reliability",
    [
      "Hallucination detection",
      "Confidence scoring",
      "Groundedness checks",
      "Factual consistency",
      "Robust retries",
      "Schema enforcement",
      "Prompt attack resistance",
      "Rate limit handling",
      "Provider failover",
      "Batch inference",
      "Cache architecture",
      "Replay diagnostics",
      "Canary releases",
      "Quality monitoring",
      "User feedback loops",
      "A/B prompt testing",
      "Model version pinning",
      "Incident triage",
      "Trace correlation",
      "Recovery playbooks"
    ],
    "Engineer",
    "Create",
    "Stress-test"
  ),
  ...createGeneratedPhaseSeeds(
    "AI System Design",
    "AI system architecture",
    [
      "Orchestrator services",
      "Message pipelines",
      "Event-driven AI",
      "Long-running jobs",
      "Async tool execution",
      "Workflow states",
      "Permission boundaries",
      "Audit logging",
      "Model gateway",
      "Policy engine",
      "Multi-tenant isolation",
      "Inference budgeting",
      "Secure secrets flow",
      "Regional failover",
      "API contract stability",
      "Versioned prompts",
      "Feature flags",
      "Ops runbooks",
      "Scalability tests",
      "Architecture reviews"
    ],
    "Design",
    "Implement",
    "Refine"
  ),
  ...createGeneratedPhaseSeeds(
    "AI Capstone Delivery",
    "AI product delivery",
    [
      "Support copilot",
      "Documentation assistant",
      "Code review helper",
      "PR summarizer",
      "Issue triage bot",
      "Customer FAQ agent",
      "Knowledge search assistant",
      "Ops troubleshooting bot",
      "Security policy copilot",
      "Migration planner",
      "Experiment analyzer",
      "Meeting summarizer",
      "Feedback classifier",
      "Release note generator",
      "Runbook assistant",
      "Data quality assistant",
      "Contract reviewer",
      "Risk assessor",
      "Reliability hardening",
      "Final capstone review"
    ],
    "Deliver",
    "Build",
    "Polish"
  )
];

const dataEngineeringSeeds = [
  ...createGeneratedPhaseSeeds(
    "Data Engineering Foundations",
    "data engineering",
    [
      "Data modeling basics",
      "Schema evolution",
      "Batch ingestion",
      "Streaming ingestion",
      "File formats",
      "Partitioning strategy",
      "Data quality checks",
      "Transform layers",
      "Source connectors",
      "Sink connectors",
      "CDC basics",
      "Idempotent writes",
      "Data contracts",
      "Lineage notes",
      "Metadata management",
      "Storage lifecycle",
      "Query optimization",
      "ETL orchestration",
      "Backfill workflows",
      "Validation dashboards"
    ],
    "Practice",
    "Implement",
    "Improve"
  ),
  ...createGeneratedPhaseSeeds(
    "Pipeline Building",
    "pipeline building",
    [
      "Orchestrated DAGs",
      "Retry patterns",
      "Incremental loads",
      "Late data handling",
      "Deduplication",
      "Slowly changing dimensions",
      "Warehouse staging",
      "Fact table design",
      "Dimension table design",
      "Snapshotting",
      "Transformation tests",
      "Data SLA tracking",
      "Alert routing",
      "Dependency graphs",
      "Airflow-style tasks",
      "Serverless pipelines",
      "Resource scheduling",
      "Cost visibility",
      "Pipeline docs",
      "Runbook setup"
    ],
    "Build",
    "Create",
    "Scale"
  ),
  ...createGeneratedPhaseSeeds(
    "Realtime Systems",
    "realtime data systems",
    [
      "Event schemas",
      "Topic design",
      "Consumer groups",
      "Windowing",
      "Stateful processing",
      "Exactly-once semantics",
      "Late event policies",
      "Dead-letter queues",
      "Replay streams",
      "Event enrichment",
      "Streaming joins",
      "Watermarks",
      "Backpressure handling",
      "Monitoring lag",
      "High-throughput tuning",
      "Multi-region streams",
      "Realtime dashboards",
      "Anomaly triggers",
      "Incident drills",
      "Resilience checks"
    ],
    "Engineer",
    "Ship",
    "Stress-test"
  ),
  ...createGeneratedPhaseSeeds(
    "Platform and Governance",
    "data platform governance",
    [
      "Access controls",
      "PII handling",
      "Audit trails",
      "Data retention",
      "Compliance policies",
      "Catalog curation",
      "Ownership mapping",
      "Stewardship workflows",
      "Quality scorecards",
      "Data contracts at scale",
      "Incident response",
      "Root cause analysis",
      "Policy automation",
      "Cost guardrails",
      "Self-serve analytics",
      "Semantic layers",
      "Query governance",
      "Platform onboarding",
      "Internal docs",
      "Maturity reviews"
    ],
    "Design",
    "Implement",
    "Harden"
  ),
  ...createGeneratedPhaseSeeds(
    "Data Engineering Capstone",
    "data platform delivery",
    [
      "Analytics pipeline",
      "Customer 360 feed",
      "Fraud event stream",
      "Marketing attribution model",
      "Realtime KPI layer",
      "Usage metering pipeline",
      "Feature store job",
      "Data quality platform",
      "Ops telemetry lake",
      "Compliance reporting flow",
      "Finance reconciliation job",
      "Product experiment feed",
      "Search indexing pipeline",
      "Churn signal pipeline",
      "Audit-ready exports",
      "Backfill automation",
      "Stability hardening",
      "Cost optimization",
      "Stakeholder handoff",
      "Final capstone wrap-up"
    ],
    "Deliver",
    "Build",
    "Polish"
  )
];

const cloudDevopsSeeds = [
  ...createGeneratedPhaseSeeds(
    "Cloud Foundations",
    "cloud and DevOps",
    [
      "Infrastructure basics",
      "VPC networking",
      "IAM roles",
      "Secrets management",
      "Compute options",
      "Storage options",
      "Container basics",
      "Image builds",
      "Registry workflows",
      "Service discovery",
      "Load balancing",
      "Autoscaling",
      "DNS routing",
      "TLS setup",
      "Environment configs",
      "Resource tagging",
      "Budget alerts",
      "Cloud audit logs",
      "Resilience basics",
      "Disaster recovery"
    ],
    "Practice",
    "Implement",
    "Improve"
  ),
  ...createGeneratedPhaseSeeds(
    "CI/CD and Automation",
    "deployment automation",
    [
      "Pipeline triggers",
      "Build caching",
      "Test gates",
      "Artifact management",
      "Release branches",
      "Feature flag rollouts",
      "Blue-green deploys",
      "Canary deploys",
      "Rollback automation",
      "Environment promotion",
      "IaC modules",
      "Drift detection",
      "Policy as code",
      "Secrets in pipelines",
      "Supply chain checks",
      "Image scanning",
      "Dependency updates",
      "Approval workflows",
      "Release notes",
      "Runbook links"
    ],
    "Build",
    "Create",
    "Scale"
  ),
  ...createGeneratedPhaseSeeds(
    "Observability and SRE",
    "site reliability",
    [
      "Metrics design",
      "Structured logging",
      "Distributed tracing",
      "SLOs and SLIs",
      "Error budgets",
      "On-call workflows",
      "Alert tuning",
      "Incident triage",
      "Postmortems",
      "Capacity planning",
      "Load testing",
      "Chaos checks",
      "Runtime profiling",
      "Health checks",
      "Recovery automation",
      "Multi-region failover",
      "Latency reduction",
      "Cost-performance balance",
      "Service ownership",
      "Reliability dashboards"
    ],
    "Engineer",
    "Ship",
    "Stress-test"
  ),
  ...createGeneratedPhaseSeeds(
    "Platform Engineering",
    "platform engineering",
    [
      "Internal developer platforms",
      "Golden paths",
      "Self-service templates",
      "Kubernetes operations",
      "Cluster policy",
      "Runtime isolation",
      "Service mesh",
      "Platform RBAC",
      "Tenant isolation",
      "Workload identity",
      "Cross-team standards",
      "Infra scorecards",
      "Provisioning APIs",
      "Cost governance",
      "Developer experience metrics",
      "Internal docs",
      "Platform onboarding",
      "Upgrade playbooks",
      "Risk controls",
      "Resilience reviews"
    ],
    "Design",
    "Implement",
    "Harden"
  ),
  ...createGeneratedPhaseSeeds(
    "Cloud DevOps Capstone",
    "cloud delivery",
    [
      "Production CI/CD stack",
      "Multi-env deployment system",
      "Autoscaling service platform",
      "Observability control plane",
      "Secure secret platform",
      "Resilience drill framework",
      "Release orchestration service",
      "Infra compliance checker",
      "Cost optimization automation",
      "Incident response toolkit",
      "Kubernetes platform baseline",
      "Container security baseline",
      "Edge routing setup",
      "Disaster recovery run",
      "Operations portal",
      "SRE scorecard",
      "Stability hardening",
      "Ops handoff pack",
      "Launch readiness review",
      "Final capstone wrap-up"
    ],
    "Deliver",
    "Build",
    "Polish"
  )
];

const cybersecuritySeeds = [
  ...createGeneratedPhaseSeeds(
    "Security Foundations",
    "cybersecurity engineering",
    [
      "Threat modeling basics",
      "Authentication fundamentals",
      "Authorization boundaries",
      "Session security",
      "Input validation",
      "Output encoding",
      "SQL injection prevention",
      "XSS prevention",
      "CSRF controls",
      "Secure headers",
      "Secret handling",
      "Encryption at rest",
      "Encryption in transit",
      "Key rotation",
      "Secure defaults",
      "Dependency hygiene",
      "Vulnerability triage",
      "Audit logging",
      "Security testing basics",
      "Incident basics"
    ],
    "Practice",
    "Implement",
    "Improve"
  ),
  ...createGeneratedPhaseSeeds(
    "Application Security",
    "application security",
    [
      "Auth hardening",
      "Access control tests",
      "API abuse protection",
      "Rate limiting",
      "Password policies",
      "MFA workflows",
      "Token rotation",
      "Secure file handling",
      "Upload validation",
      "Secure serialization",
      "Supply chain checks",
      "SAST workflows",
      "DAST workflows",
      "Secrets scanning",
      "Runtime protections",
      "Container hardening",
      "WAF policies",
      "Security observability",
      "Breach simulation",
      "Remediation plans"
    ],
    "Build",
    "Create",
    "Scale"
  ),
  ...createGeneratedPhaseSeeds(
    "Detection and Response",
    "security operations",
    [
      "Log normalization",
      "Detection rules",
      "Alert triage",
      "SOC workflows",
      "False positive tuning",
      "Threat intelligence",
      "Behavior analytics",
      "Endpoint telemetry",
      "Network telemetry",
      "Incident runbooks",
      "Containment workflows",
      "Forensics basics",
      "Timeline reconstruction",
      "Root cause analysis",
      "Recovery coordination",
      "Post-incident reviews",
      "Playbook automation",
      "Red team feedback",
      "Purple team drills",
      "Executive communication"
    ],
    "Engineer",
    "Ship",
    "Stress-test"
  ),
  ...createGeneratedPhaseSeeds(
    "Security Architecture",
    "security architecture",
    [
      "Zero trust patterns",
      "Identity architecture",
      "Network segmentation",
      "Privileged access",
      "Policy as code",
      "Compliance controls",
      "Data loss prevention",
      "Secure SDLC",
      "Third-party risk",
      "Security scorecards",
      "Risk quantification",
      "Architecture reviews",
      "Cloud security posture",
      "Attack surface reduction",
      "Secure platform baselines",
      "Governance workflows",
      "Evidence collection",
      "Audit readiness",
      "Security roadmap planning",
      "Resilience strategy"
    ],
    "Design",
    "Implement",
    "Harden"
  ),
  ...createGeneratedPhaseSeeds(
    "Cybersecurity Capstone",
    "security program delivery",
    [
      "Secure auth platform",
      "API hardening project",
      "Detection engineering pack",
      "Incident response toolkit",
      "Security dashboard",
      "Vulnerability management flow",
      "Access review automation",
      "Compliance evidence pipeline",
      "Security training module",
      "Cloud security baseline",
      "Container security project",
      "Threat model library",
      "Audit prep runbook",
      "Risk register automation",
      "Security launch gate",
      "Recovery test plan",
      "Stability hardening",
      "Stakeholder handoff",
      "Readiness review",
      "Final capstone wrap-up"
    ],
    "Deliver",
    "Build",
    "Polish"
  )
];

const mobileDevelopmentSeeds = [
  ...createGeneratedPhaseSeeds(
    "Mobile Foundations",
    "mobile development",
    [
      "Navigation stacks",
      "Screen lifecycle",
      "State management",
      "Offline caching",
      "Form UX",
      "Touch interactions",
      "Gesture handling",
      "Responsive layouts",
      "Accessibility basics",
      "Theme systems",
      "List performance",
      "Image optimization",
      "Device permissions",
      "Storage patterns",
      "App configuration",
      "Error boundaries",
      "Loading experiences",
      "Network handling",
      "Validation loops",
      "UI consistency"
    ],
    "Practice",
    "Implement",
    "Improve"
  ),
  ...createGeneratedPhaseSeeds(
    "Feature Development",
    "mobile feature delivery",
    [
      "Auth flows",
      "Profile surfaces",
      "Settings architecture",
      "Search interactions",
      "Notification center",
      "Realtime updates",
      "Background sync",
      "Media upload",
      "Camera workflows",
      "Location workflows",
      "Deep linking",
      "In-app messaging",
      "Checkout flow",
      "Analytics events",
      "Error reporting",
      "Release channels",
      "Feature flags",
      "Experiment toggles",
      "QA automation",
      "Crash handling"
    ],
    "Build",
    "Create",
    "Scale"
  ),
  ...createGeneratedPhaseSeeds(
    "Performance and Reliability",
    "mobile reliability",
    [
      "Startup optimization",
      "Memory management",
      "Render optimization",
      "Animation smoothness",
      "Battery efficiency",
      "Network resilience",
      "Retry policies",
      "Cache invalidation",
      "Background tasks",
      "Large list tuning",
      "Bundle optimization",
      "Dependency hygiene",
      "Native bridge tuning",
      "Telemetry pipelines",
      "Monitoring dashboards",
      "Crash triage",
      "Regression checks",
      "Device matrix testing",
      "Stability reviews",
      "Release confidence"
    ],
    "Engineer",
    "Ship",
    "Stress-test"
  ),
  ...createGeneratedPhaseSeeds(
    "Mobile Platform Patterns",
    "mobile platform architecture",
    [
      "Design system reuse",
      "Shared component libraries",
      "Platform abstractions",
      "Build pipelines",
      "Store release automation",
      "Signing workflows",
      "Config per environment",
      "Secure storage",
      "Data synchronization",
      "Analytics governance",
      "Error budget tracking",
      "Version rollout strategy",
      "Backward compatibility",
      "Policy compliance",
      "Store optimization",
      "A/B mobile tests",
      "Cross-team handoffs",
      "Documentation flow",
      "Architecture reviews",
      "Operational readiness"
    ],
    "Design",
    "Implement",
    "Harden"
  ),
  ...createGeneratedPhaseSeeds(
    "Mobile Capstone Delivery",
    "mobile product launch",
    [
      "Habit tracker app",
      "Team messaging app",
      "Creator dashboard app",
      "Learning companion app",
      "Realtime tracker app",
      "Offline-first app",
      "Commerce mobile flow",
      "Community feature app",
      "Fitness insights app",
      "Travel planner app",
      "Support operations app",
      "Personal finance app",
      "Issue triage app",
      "Field operations app",
      "Experiment app shell",
      "Production readiness review",
      "Store launch checklist",
      "Stability hardening",
      "Handoff package",
      "Final capstone wrap-up"
    ],
    "Deliver",
    "Build",
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

const aiEngineeringPhases: LearningPathPhase[] = [
  { title: "Days 1-20", dayRange: "1-20", summary: "Prompt engineering fundamentals, schema-first outputs, and safe assistant behavior." },
  { title: "Days 21-40", dayRange: "21-40", summary: "RAG, tool use, and multi-step AI product workflows." },
  { title: "Days 41-60", dayRange: "41-60", summary: "Reliability engineering for quality, latency, and cost in LLM systems." },
  { title: "Days 61-80", dayRange: "61-80", summary: "AI system architecture, governance, and production operations." },
  { title: "Days 81-100", dayRange: "81-100", summary: "Capstone delivery of real-world AI assistants and automations." }
];

const dataEngineeringPhases: LearningPathPhase[] = [
  { title: "Days 1-20", dayRange: "1-20", summary: "Data modeling, ingestion, and quality fundamentals." },
  { title: "Days 21-40", dayRange: "21-40", summary: "Pipeline orchestration, warehouse modeling, and production ETL practices." },
  { title: "Days 41-60", dayRange: "41-60", summary: "Realtime streaming systems, event reliability, and throughput tuning." },
  { title: "Days 61-80", dayRange: "61-80", summary: "Platform governance, ownership, and data compliance workflows." },
  { title: "Days 81-100", dayRange: "81-100", summary: "Capstone delivery of robust, business-facing data platforms." }
];

const cloudDevopsPhases: LearningPathPhase[] = [
  { title: "Days 1-20", dayRange: "1-20", summary: "Cloud infrastructure basics, networking, identity, and secure setup." },
  { title: "Days 21-40", dayRange: "21-40", summary: "CI/CD automation, IaC, release controls, and deployment reliability." },
  { title: "Days 41-60", dayRange: "41-60", summary: "SRE practices with observability, incident response, and performance." },
  { title: "Days 61-80", dayRange: "61-80", summary: "Platform engineering for scalable internal developer workflows." },
  { title: "Days 81-100", dayRange: "81-100", summary: "Capstone delivery of production-ready cloud and DevOps systems." }
];

const cybersecurityPhases: LearningPathPhase[] = [
  { title: "Days 1-20", dayRange: "1-20", summary: "Application security basics, secure defaults, and common vulnerability prevention." },
  { title: "Days 21-40", dayRange: "21-40", summary: "Security testing, hardening, and protection for modern apps and APIs." },
  { title: "Days 41-60", dayRange: "41-60", summary: "Detection engineering, incident response, and operational workflows." },
  { title: "Days 61-80", dayRange: "61-80", summary: "Security architecture, compliance, and governance at scale." },
  { title: "Days 81-100", dayRange: "81-100", summary: "Capstone delivery of practical security programs and tooling." }
];

const mobileDevelopmentPhases: LearningPathPhase[] = [
  { title: "Days 1-20", dayRange: "1-20", summary: "Mobile UI foundations, state patterns, and core user interactions." },
  { title: "Days 21-40", dayRange: "21-40", summary: "Feature development with auth, notifications, and app workflows." },
  { title: "Days 41-60", dayRange: "41-60", summary: "Performance, reliability, and release-quality engineering." },
  { title: "Days 61-80", dayRange: "61-80", summary: "Platform architecture, build systems, and operational scaling." },
  { title: "Days 81-100", dayRange: "81-100", summary: "Capstone delivery for polished, production-ready mobile products." }
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
  },
  "ai-engineering": {
    summary: {
      id: "ai-engineering",
      skill: "ai-engineering",
      title: "100 Days of AI Engineering Systems",
      description: "Build production AI products with strong prompting, retrieval, tool orchestration, and reliability practices.",
      levelLabel: "Beginner to advanced",
      totalDays: 100,
      estimatedMinutesPerDay: 60,
      tags: ["llm", "rag", "agents", "reliability"],
      adaptive: true
    },
    overview: "This path is built for 2026 AI product workflows: prompt design, tool use, retrieval pipelines, safety controls, quality evaluation, and production operations.",
    phases: aiEngineeringPhases,
    days: buildDays("ai-engineering", aiEngineeringSeeds)
  },
  "data-engineering": {
    summary: {
      id: "data-engineering",
      skill: "data-engineering",
      title: "100 Days of Data Engineering Delivery",
      description: "Learn to design data pipelines, streaming systems, and governed analytics foundations used in modern products.",
      levelLabel: "Beginner to advanced",
      totalDays: 100,
      estimatedMinutesPerDay: 55,
      tags: ["pipelines", "warehouse", "streaming", "governance"],
      adaptive: true
    },
    overview: "This path turns core data concepts into practical pipeline implementation, reliability engineering, and stakeholder-facing platform delivery.",
    phases: dataEngineeringPhases,
    days: buildDays("data-engineering", dataEngineeringSeeds)
  },
  "cloud-devops": {
    summary: {
      id: "cloud-devops",
      skill: "cloud-devops",
      title: "100 Days of Cloud and DevOps Engineering",
      description: "Ship cloud infrastructure, CI/CD systems, observability, and platform reliability patterns for real production teams.",
      levelLabel: "Beginner to advanced",
      totalDays: 100,
      estimatedMinutesPerDay: 55,
      tags: ["cloud", "devops", "sre", "platform"],
      adaptive: true
    },
    overview: "This path develops cloud + DevOps fluency from infrastructure basics to platform engineering and resilient operations at scale.",
    phases: cloudDevopsPhases,
    days: buildDays("cloud-devops", cloudDevopsSeeds)
  },
  cybersecurity: {
    summary: {
      id: "cybersecurity",
      skill: "cybersecurity",
      title: "100 Days of Cybersecurity Engineering",
      description: "Master practical application security, detection engineering, and secure architecture for modern software systems.",
      levelLabel: "Beginner to advanced",
      totalDays: 100,
      estimatedMinutesPerDay: 50,
      tags: ["appsec", "security", "incident-response", "governance"],
      adaptive: true
    },
    overview: "This path focuses on real security engineering outcomes: preventing vulnerabilities, detecting risk, and running robust response workflows.",
    phases: cybersecurityPhases,
    days: buildDays("cybersecurity", cybersecuritySeeds)
  },
  "mobile-development": {
    summary: {
      id: "mobile-development",
      skill: "mobile-development",
      title: "100 Days of Mobile Product Engineering",
      description: "Build polished mobile experiences with reliable architecture, performance optimization, and production release practices.",
      levelLabel: "Beginner to advanced",
      totalDays: 100,
      estimatedMinutesPerDay: 50,
      tags: ["mobile", "react-native", "product", "performance"],
      adaptive: true
    },
    overview: "This path trains mobile engineering from fundamentals to app launch readiness, covering UX quality, reliability, and platform operations.",
    phases: mobileDevelopmentPhases,
    days: buildDays("mobile-development", mobileDevelopmentSeeds)
  }
};

export function listGrowthPathCatalog() {
  return Object.values(catalog).map((item) => item.summary);
}

export function getGrowthPathCatalog(pathId: string) {
  return catalog[pathId as GrowthPathSkill] ?? null;
}
