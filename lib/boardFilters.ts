import type { TaskWithUser } from "@/types";

export type BoardFilterState = {
  assignee: string;
  neuron: string;
  priority: string;
};

export function taskMatchesBoardFilters(
  t: TaskWithUser,
  f: BoardFilterState
): boolean {
  if (f.assignee && String(t.assigneeId ?? "") !== f.assignee) return false;
  const nb = (t as { neuronBlock?: string }).neuronBlock ?? "CHAT";
  if (f.neuron && nb !== f.neuron) return false;
  if (f.priority && String(t.priority) !== f.priority) return false;
  return true;
}
