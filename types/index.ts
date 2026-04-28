import type { Task, User, TaskHistory } from "@prisma/client";

export type TaskWithUser = Task & {
  assignee: User | null;
};

export type TasksByColumn = Record<string, TaskWithUser[]>;

export interface ParsedTask {
  title: string;
  description: string | null;
  assigneeName: string | null;
  startDate: string | null;
  endDate: string | null;
  column: string | null;
  priority?: number | null;
  difficulty?: number | null;
  neuronBlock?: string | null;
}

/** Вложение к задаче (JSON в Task.artifacts) */
export type TaskArtifact = {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
};

export function parseArtifactsJson(raw: string | null | undefined): TaskArtifact[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (!Array.isArray(p)) return [];
    return p.filter(
      (x: unknown): x is TaskArtifact =>
        !!x &&
        typeof x === "object" &&
        typeof (x as TaskArtifact).id === "string" &&
        typeof (x as TaskArtifact).name === "string" &&
        typeof (x as TaskArtifact).dataUrl === "string"
    );
  } catch {
    return [];
  }
}

export function stringifyArtifactsJson(items: TaskArtifact[]): string | null {
  if (!items.length) return null;
  return JSON.stringify(items);
}

export type DependencyType = "after" | "same";
export interface TaskDependency {
  id: string;
  type: DependencyType;
}

export type TaskHistoryWithActor = TaskHistory & {
  actor: { id: number; name: string } | null;
};

export type UserPublic = {
  id: number;
  name: string;
  login: string;
  role: string;
  color: string;
};

export type TodoItem = {
  id: number;
  title: string;
  isCompleted: boolean;
  order: number;
  userId: number | null;
  taskId: number | null;
  task: { id: number; title: string; column: string } | null;
  createdAt: string;
  updatedAt: string;
};

export function parseDependencies(raw: string | null): TaskDependency[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p) && p.length > 0 && typeof p[0] === "object") {
      return p.filter((x: unknown): x is TaskDependency =>
        !!x && typeof x === "object" && "id" in (x as object) && "type" in (x as object)
      );
    }
    // Legacy comma-separated IDs → treat as "after"
    if (typeof p === "number" || typeof p === "string") {
      return [{ id: String(p), type: "after" }];
    }
  } catch {
    // Legacy: "1,2,3"
    return raw.split(",").map((d) => d.trim()).filter(Boolean).map((id) => ({ id, type: "after" as DependencyType }));
  }
  return [];
}

export function stringifyDependencies(deps: TaskDependency[]): string | null {
  if (!deps || deps.length === 0) return null;
  return JSON.stringify(deps);
}
