"use client";

import { Droppable } from "@hello-pangea/dnd";
import { useState } from "react";
import TaskCard from "./TaskCard";
import type { TaskWithUser } from "@/types";
import { apiFetch } from "@/hooks/useCurrentUser";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { BoardFilterState } from "@/lib/boardFilters";
import { taskMatchesBoardFilters } from "@/lib/boardFilters";

interface Props {
  tasks: TaskWithUser[];
  allTasks: TaskWithUser[];
  onCardClick: (task: TaskWithUser) => void;
  onTasksChange: (tasks: TaskWithUser[]) => void;
  onRefresh: () => void;
  onAddGlobal: () => void;
  filters: BoardFilterState;
  filtersActive: boolean;
}

export default function GlobalBacklogStrip({
  tasks,
  allTasks,
  onCardClick,
  onTasksChange,
  onRefresh,
  onAddGlobal,
  filters,
  filtersActive,
}: Props) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const visibleTasks = filtersActive ? tasks.filter((task) => taskMatchesBoardFilters(task, filters)) : tasks;

  async function handleValidate(taskId: number) {
    const res = await apiFetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ isValidated: true }),
    });
    if (res.ok) {
      const updated = await res.json();
      onTasksChange(allTasks.map((x) => (x.id === taskId ? updated : x)));
    } else onRefresh();
  }

  return (
    <div className="mx-2 mt-2 rounded-xl border border-slate-200 bg-slate-50/90 shrink-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 gap-2 border-b border-slate-200 hover:bg-slate-100/70 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-slate-700 truncate">{t("backlog.globalTitle")}</span>
          <span className="text-[10px] bg-white/80 rounded-full px-2 py-0.5 text-slate-500 font-medium tabular-nums">
            {visibleTasks.length}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddGlobal();
              setOpen(true);
            }}
            className="text-xs font-medium text-[#3A97D9] hover:text-[#2d7fc0] px-2 py-1 rounded-md border border-slate-200 bg-white/90"
          >
            {t("backlog.globalAdd")}
          </button>
          <span className="text-[11px] text-slate-400" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </div>
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-2 pb-2">
            <Droppable droppableId="GLOBAL_BACKLOG" direction="horizontal">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex flex-wrap gap-2 min-h-[72px] rounded-lg px-1 py-1 transition-colors ${
                    snapshot.isDraggingOver ? "bg-slate-100/70 ring-1 ring-slate-200" : "bg-slate-50/60"
                  }`}
                >
                  {visibleTasks.map((task, index) => (
                    <div key={task.id} className="w-[240px] shrink-0 flex flex-col gap-1">
                      <TaskCard
                        task={task}
                        index={index}
                        onClick={() => onCardClick(task)}
                        onValidate={handleValidate}
                        compact
                        isDimmed={false}
                      />
                    </div>
                  ))}
                  {provided.placeholder}
                  {visibleTasks.length === 0 && (
                    <p className="text-[11px] text-sky-700/50 self-center px-3 py-2">
                      {t("backlog.globalEmpty")}
                    </p>
                  )}
                </div>
              )}
            </Droppable>
          </div>
        </div>
      </div>
    </div>
  );
}
