import type { CuratedDifficulty, CuratedSkill, DiscoveredProblem } from "@growthengine/shared";

import type { ClassifiedIssueWithMetadata } from "../../modules/classifier";
import { createProblemId } from "./problem-store";

function mapDifficulty(
  difficulty: "beginner" | "intermediate" | "advanced"
): CuratedDifficulty {
  if (difficulty === "beginner") return "easy";
  if (difficulty === "intermediate") return "medium";
  return "hard";
}

function inferSkills(techStack: string[]): CuratedSkill[] {
  const skills = new Set<CuratedSkill>();

  if (techStack.includes("react")) skills.add("frontend");
  if (techStack.includes("nodejs") || techStack.includes("python") || techStack.includes("database")) {
    skills.add("backend");
  }
  if (techStack.includes("devops")) skills.add("devops");
  if (skills.has("frontend") && skills.has("backend")) skills.add("fullstack");

  if (!skills.size) {
    skills.add("backend");
  }

  return [...skills];
}

function primaryStack(techStack: string[]) {
  if (techStack.includes("react")) return "frontend";
  if (techStack.includes("devops")) return "devops";
  if (techStack.includes("nodejs")) return "backend";
  if (techStack.includes("python")) return "backend";
  if (techStack.includes("database")) return "backend";
  return "fullstack";
}

export function materializeDiscoveredProblems(
  issues: ClassifiedIssueWithMetadata[]
): DiscoveredProblem[] {
  return issues.map((issue) => ({
    id: createProblemId(),
    issueId: issue.id,
    title: issue.scenarioTitle ?? issue.title,
    body: issue.scenarioBody ?? issue.body,
    difficulty: mapDifficulty(issue.difficulty),
    stack: primaryStack(issue.techStack),
    skills: inferSkills(issue.techStack),
    sourceRepo: issue.repositoryFullName,
    sourceIssueUrl: issue.url,
    labels: issue.labels
  }));
}
