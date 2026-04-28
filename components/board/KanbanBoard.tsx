"use client";

import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { useState } from "react";
import { COLUMNS } from "@/lib/constants";
import KanbanColumn from "./KanbanColumn";
import GlobalBacklogStrip from "./GlobalBacklogStrip";
import DoneLongAgoStrip from "./DoneLongAgoStrip";
import AssigneeChangeModal from "./AssigneeChangeModal";
import type { TaskWithUser, UserPublic } from "@/types";
import type { BoardFilterState } from "@/lib/boardFilters";
import { apiFetch } from "@/hooks/useCurrentUser";

interface Props {
  tasks: TaskWithUser[];
  tasksByColumn: Record<string, TaskWithUser[]>;
  onTasksChange: (tasks: TaskWithUser[]) => void;
  onRefresh: () => void;
  onCardClick: (task: TaskWithUser) => void;
  onAddTask: (columnId: string) => void;
  users: UserPublic[];
  isAdmin: boolean;
  filters: BoardFilterState;
  filtersActive: boolean;
}

const HIDDEN_COLS = new Set(["GLOBAL_BACKLOG", "DONE_LONG_AGO"]);
const IN_WORK_COLS = new Set(["DEV", "TESTING", "DONE_SPRINT"]);

function shouldPromptAssignee(src: string, dst: string): boolean {
  if (src === "GLOBAL_BACKLOG" && dst === "SPRINT_BACKLOG") return true;
  if (src === "DEV" && dst === "TESTING") return true;
  return false;
}

export default function KanbanBoard({
  tasks,
  tasksByColumn,
  onTasksChange,
  onRefresh,
  onCardClick,
  onAddTask,
  users,
  isAdmin,
  filters,
  filtersActive,
}: Props) {
  const [assigneePrompt, setAssigneePrompt] = useState<{
    task: TaskWithUser;
  } | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);

  const visibleColumns = COLUMNS.filter((c) => !HIDDEN_COLS.has(c.id));

  async function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    const taskId = parseInt(draggableId);
    const srcCol = source.droppableId;
    const dstCol = destination.droppableId;

    // Block move from SPRINT_BACKLOG into work columns without assignee
    if (srcCol === "SPRINT_BACKLOG" && IN_WORK_COLS.has(dstCol)) {
      const task = (tasksByColumn[srcCol] ?? []).find((t) => t.id === taskId);
      if (task && !task.assigneeId) {
        setBlockError("Нельзя взять задачу в работу без исполнителя");
        setTimeout(() => setBlockError(null), 3000);
        return;
      }
    }

    // Only admins can move tasks into archive column.
    if (dstCol === "DONE_LONG_AGO" && !isAdmin) {
      setBlockError("Переносить задачи в архив может только администратор");
      setTimeout(() => setBlockError(null), 3000);
      return;
    }

    const newByColumn = { ...tasksByColumn };
    const srcTasks = [...(newByColumn[srcCol] ?? [])];
    const [moved] = srcTasks.splice(source.index, 1);

    let dstTasks: TaskWithUser[];
    if (srcCol === dstCol) {
      dstTasks = srcTasks;
    } else {
      dstTasks = [...(newByColumn[dstCol] ?? [])];
    }
    const movedUpdated = { ...moved, column: dstCol };
    dstTasks.splice(destination.index, 0, movedUpdated);

    newByColumn[srcCol] = srcCol === dstCol ? dstTasks : srcTasks;
    if (srcCol !== dstCol) newByColumn[dstCol] = dstTasks;

    newByColumn[srcCol].forEach((t, i) => {
      t.order = i;
    });
    if (srcCol !== dstCol)
      newByColumn[dstCol].forEach((t, i) => {
        t.order = i;
      });

    onTasksChange(Object.values(newByColumn).flat());

    try {
      const updates: Array<Promise<Response>> = [];
      updates.push(
        apiFetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify({ column: dstCol, order: destination.index }),
        })
      );

      const reindexCols = srcCol === dstCol ? [dstCol] : [srcCol, dstCol];
      for (const colId of reindexCols) {
        const colTasks = newByColumn[colId] ?? [];
        for (let i = 0; i < colTasks.length; i++) {
          const t = colTasks[i];
          if (t.id === taskId && colId === dstCol) continue;
          updates.push(
            apiFetch(`/api/tasks/${t.id}`, {
              method: "PATCH",
              body: JSON.stringify({ order: i }),
            })
          );
        }
      }

      const results = await Promise.all(updates);
      if (results.some((r) => !r.ok)) throw new Error("fail");

      if (srcCol !== dstCol && shouldPromptAssignee(srcCol, dstCol)) {
        setAssigneePrompt({ task: movedUpdated });
      }
    } catch {
      onRefresh();
    }
  }

  return (
    <>
      {blockError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white text-sm px-4 py-2 rounded-xl shadow-lg pointer-events-none">
          {blockError}
        </div>
      )}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex flex-col h-full min-h-0">
          <GlobalBacklogStrip
            tasks={tasksByColumn["GLOBAL_BACKLOG"] ?? []}
            allTasks={tasks}
            onCardClick={onCardClick}
            onTasksChange={onTasksChange}
            onRefresh={onRefresh}
            onAddGlobal={() => onAddTask("GLOBAL_BACKLOG")}
            filters={filters}
            filtersActive={filtersActive}
          />

          <div className="flex gap-2 flex-1 px-2 py-2 kanban-scroll min-h-0">
            {visibleColumns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                tasks={tasksByColumn[col.id] ?? []}
                isAdmin={isAdmin}
                onCardClick={onCardClick}
                onAddTask={onAddTask}
                allTasks={tasks}
                onTasksChange={onTasksChange}
                onRefresh={onRefresh}
                filters={filters}
                filtersActive={filtersActive}
              />
            ))}
          </div>

          <DoneLongAgoStrip
            tasks={tasksByColumn["DONE_LONG_AGO"] ?? []}
            onCardClick={onCardClick}
            allTasks={tasks}
            onTasksChange={onTasksChange}
            onRefresh={onRefresh}
            filters={filters}
            filtersActive={filtersActive}
          />
        </div>
      </DragDropContext>

      {assigneePrompt && (
        <AssigneeChangeModal
          task={assigneePrompt.task}
          users={users}
          onClose={() => setAssigneePrompt(null)}
          onSaved={() => {
            setAssigneePrompt(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
