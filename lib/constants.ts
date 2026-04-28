import { dictionaries } from "@/lib/i18n/dictionaries";

/** Цвета колонок — лёгкие пастельные, в духе Neuron Cloud */
export const COLUMNS = [
  { id: "GLOBAL_BACKLOG", color: "bg-sky-50/80 border-sky-100" },
  { id: "SPRINT_BACKLOG", color: "bg-[#e8f4fc] border-[#cfe8f7]" },
  { id: "DEV", color: "bg-violet-50/70 border-violet-100" },
  { id: "TESTING", color: "bg-slate-50/90 border-slate-100" },
  { id: "DONE_SPRINT", color: "bg-emerald-50/70 border-emerald-100" },
  { id: "DONE_LONG_AGO", color: "bg-slate-50/90 border-slate-100" },
] as const;

export type ColumnId = (typeof COLUMNS)[number]["id"];

export const COLUMN_PROGRESS: Record<string, number> = {
  GLOBAL_BACKLOG: 0,
  SPRINT_BACKLOG: 10,
  DEV: 40,
  PRODUCT_DEV: 40,
  TECH_DEV: 40,
  TESTING: 70,
  DONE_SPRINT: 90,
  DONE_LONG_AGO: 100,
};

export function normalizeColumnId(column: string): string {
  if (column === "PRODUCT_DEV" || column === "TECH_DEV") return "DEV";
  return column;
}

/** Подписи колонок (RU) для Telegram-бота и обратной совместимости */
export const COLUMN_LABELS: Record<string, string> = {
  ...dictionaries.ru.columns,
} as Record<string, string>;

/** Гармонизированная палитра для участников команды (пастельные цвета) */
export const TEAM_COLORS = [
  "#93c5fd", // blue
  "#86efac", // green
  "#fca5a5", // red
  "#fcd34d", // yellow
  "#c4b5fd", // violet
  "#f9a8d4", // pink
  "#67e8f9", // cyan
  "#fdba74", // orange
  "#a3e635", // lime
  "#d8b4fe", // purple
];

export const PRIORITIES: Record<
  number,
  { label: string; short: string; color: string; bg: string; border: string }
> = {
  1: {
    label: "Критичный баг",
    short: "P1",
    color: "text-red-700",
    bg: "bg-red-100",
    border: "border-red-400",
  },
  2: {
    label: "Важная доработка",
    short: "P2",
    color: "text-blue-700",
    bg: "bg-blue-100",
    border: "border-blue-300",
  },
  3: {
    label: "Nice to have",
    short: "P3",
    color: "text-gray-600",
    bg: "bg-gray-100",
    border: "border-gray-300",
  },
};

export const DIFFICULTIES: Record<number, { label: string; hint: string }> = {
  1: { label: "1", hint: "Fast-таска (минуты)" },
  2: { label: "2", hint: "Пара часов" },
  3: { label: "3", hint: "Пара дней" },
  4: { label: "4", hint: "Исследование — декомпозировать!" },
};
