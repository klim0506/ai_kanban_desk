"use client";

import { Droppable } from "@hello-pangea/dnd";
import { useState } from "react";
import TaskCard from "./TaskCard";
import type { TaskWithUser } from "@/types";
import type { COLUMNS } from "@/lib/constants";
import { apiFetch } from "@/hooks/useCurrentUser";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { BoardFilterState } from "@/lib/boardFilters";
import { taskMatchesBoardFilters } from "@/lib/boardFilters";
import Tooltip from "@/components/ui/Tooltip";

type Column = (typeof COLUMNS)[number];

interface Props {
  column: Column;
  tasks: TaskWithUser[];
  isAdmin: boolean;
  allTasks: TaskWithUser[];
  onCardClick: (task: TaskWithUser) => void;
  onAddTask: (columnId: string) => void;
  onTasksChange: (tasks: TaskWithUser[]) => void;
  onRefresh: () => void;
  filters: BoardFilterState;
  filtersActive: boolean;
}

export default function KanbanColumn({
  column,
  tasks,
  isAdmin,
  allTasks,
  onCardClick,
  onAddTask,
  onTasksChange,
  onRefresh,
  filters,
  filtersActive,
}: Props) {
  const { t } = useLocale();
  const [archivingAll, setArchivingAll] = useState(false);
  const visibleTasks = filtersActive ? tasks.filter((task) => taskMatchesBoardFilters(task, filters)) : tasks;

  async function handleValidate(taskId: number) {
    const res = await apiFetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ isValidated: true }),
    });
    if (res.ok) {
      const updated = await res.json();
      onTasksChange(allTasks.map((x) => (x.id === taskId ? updated : x)));
    } else {
      onRefresh();
    }
  }

  async function handleArchiveAllDoneSprint() {
    if (!isAdmin || column.id !== "DONE_SPRINT" || tasks.length === 0 || archivingAll) return;
    setArchivingAll(true);
    try {
      const updates = tasks.map((task) =>
        apiFetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          body: JSON.stringify({ column: "DONE_LONG_AGO" }),
        })
      );
      const results = await Promise.all(updates);
      if (results.some((r) => !r.ok)) throw new Error("archive-failed");
      onRefresh();
    } catch {
      onRefresh();
    } finally {
      setArchivingAll(false);
    }
  }

  return (
    <div
      className={`flex flex-col rounded-xl border ${column.color} flex-1 min-w-[160px] max-w-full min-h-0`}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-inherit/50 gap-2 shrink-0">
        <span className="text-[11px] font-semibold text-slate-600 leading-tight truncate">
          {t(`columns.${column.id}`)}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {column.id === "DONE_SPRINT" && isAdmin && (
            <Tooltip content="Перенести все в архив задач">
              <button
                type="button"
                onClick={handleArchiveAllDoneSprint}
                disabled={archivingAll || tasks.length === 0}
                className="p-1 rounded-md border border-slate-200 bg-white/80 text-slate-500 hover:text-[#3A97D9] hover:bg-white disabled:opacity-40"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h11m0 0-3.5-3.5M15 12l-3.5 3.5M16 5h4v14h-4" />
                </svg>
              </button>
            </Tooltip>
          )}
          <span className="text-[10px] bg-white/80 rounded-full px-2 py-0.5 text-slate-500 font-medium tabular-nums">
            {visibleTasks.length}
          </span>
        </div>
      </div>

      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-col gap-1.5 p-1.5 flex-1 min-h-[80px] overflow-y-auto transition-colors ${
              snapshot.isDraggingOver ? "bg-sky-50/50" : ""
            }`}
          >
            <div className="flex flex-col gap-1.5 items-stretch max-w-[280px] w-full mx-auto min-h-[40px]">
              {visibleTasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  onClick={() => onCardClick(task)}
                  onValidate={handleValidate}
                  compact
                  isDimmed={false}
                />
              ))}
            </div>
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <button
        type="button"
        onClick={() => onAddTask(column.id)}
        className="text-[11px] text-slate-400 hover:text-[#3A97D9] hover:bg-white/70 transition-colors px-2 py-1.5 rounded-b-xl text-left shrink-0"
      >
        + {t("board.addTask")}
      </button>
    </div>
  );
}
