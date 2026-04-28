/** Идентификаторы блока Нейрона для задач (поле Task.neuronBlock) */
export const NEURON_BLOCKS = [
  { id: "NO_BLOCK", group: "core" as const },
  { id: "CHAT", group: "core" as const },
  { id: "AGENT_SYSTEM", group: "core" as const },
  { id: "FUNCTIONS", group: "core" as const },
  { id: "DOCUMENTS", group: "core" as const },
  { id: "SVC_SPEECHWRITING", group: "services" as const },
  { id: "SVC_TASK_GENERATOR", group: "services" as const },
  { id: "SVC_ORG_TASKS", group: "services" as const },
  { id: "SVC_LEGAL_CONTROL", group: "services" as const },
  { id: "SVC_PROCESS_ANALYSIS", group: "services" as const },
  { id: "SVC_REJUS_STRIP", group: "services" as const },
] as const;

export type NeuronBlockId = (typeof NEURON_BLOCKS)[number]["id"];

export const DEFAULT_NEURON_BLOCK: NeuronBlockId = "CHAT";

export function isNeuronBlockId(s: string): s is NeuronBlockId {
  return NEURON_BLOCKS.some((b) => b.id === s);
}
