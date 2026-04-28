"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import type { TaskWithUser, UserPublic } from "@/types";
import { COLUMNS } from "@/lib/constants";
import { NEURON_BLOCKS } from "@/lib/neuronBlocks";
import type { BoardFilterState } from "@/lib/boardFilters";
import KanbanBoard from "@/components/board/KanbanBoard";
import AiInput from "@/components/ai/AiInput";
import TaskModal from "@/components/board/TaskModal";
import AppHeader from "@/components/layout/AppHeader";
import Tooltip from "@/components/ui/Tooltip";
import { useCurrentUser, apiFetch, useRequireAuth } from "@/hooks/useCurrentUser";
import { useLocale } from "@/components/providers/LocaleProvider";

const ManageUsersModal = dynamic(() => import("@/components/ui/ManageUsersModal"), { ssr: false });
type AiMode = "board" | "chat";

export default function BoardPage() {
  const { t } = useLocale();
  const [tasks, setTasks] = useState<TaskWithUser[]>([]);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState<{ column: string } | null>(null);
  const [editTask, setEditTask] = useState<TaskWithUser | null>(null);
  const [usersModal, setUsersModal] = useState(false);
  const [filters, setFilters] = useState<BoardFilterState>({
    assignee: "",
    neuron: "",
    priority: "",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode>("board");

  const { currentUserId, setUser, isAdmin } = useCurrentUser(users);
  const { ready: authReady, authenticated, checkAuth } = useRequireAuth();

  const handleUserChange = useCallback((id: number | null) => {
    setUser(id);
    if (id != null) void checkAuth();
  }, [setUser, checkAuth]);

  const fetchTasks = useCallback(async () => {
    const res = await apiFetch("/api/tasks");
    if (res.ok) setTasks(await res.json());
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await apiFetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }, []);

  useEffect(() => {
    if (!authenticated) {
      setLoading(false);
      return;
    }
    Promise.all([fetchTasks(), fetchUsers()]).finally(() => setLoading(false));
  }, [fetchTasks, fetchUsers, authenticated]);

  const filtersActive = !!(filters.assignee || filters.neuron || filters.priority);

  const tasksByColumn = COLUMNS.reduce<Record<string, TaskWithUser[]>>(
    (acc, col) => {
      acc[col.id] = tasks
        .filter((x) => x.column === col.id)
        .sort((a, b) => a.order - b.order);
      return acc;
    },
    {}
  );

  return (
    <div className="flex flex-col h-screen bg-[#f6f9fc]">
      <AppHeader
        active="board"
        users={users}
        currentUserId={currentUserId}
        onUserChange={handleUserChange}
        extraRight={
          authenticated ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Tooltip content={t("board.filters")}>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((prev) => !prev)}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      filtersOpen || filtersActive
                      ? "border-red-400 bg-red-50 text-red-700"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M10 18h4" />
                    </svg>
                  </button>
                </Tooltip>
                {filtersOpen && (
                  <div className="absolute right-0 top-full mt-1 z-20 w-[260px] bg-white border border-slate-200 rounded-lg shadow-lg p-2 space-y-2">
                    <select
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 text-xs"
                      value={filters.assignee}
                      onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))}
                    >
                      <option value="">
                        {t("board.filterAssignee")}: {t("board.filterAll")}
                      </option>
                      {users.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 text-xs"
                      value={filters.neuron}
                      onChange={(e) => setFilters((f) => ({ ...f, neuron: e.target.value }))}
                    >
                      <option value="">
                        {t("board.filterNeuron")}: {t("board.filterAll")}
                      </option>
                      {NEURON_BLOCKS.map((b) => (
                        <option key={b.id} value={b.id}>
                          {t(`neuron.${b.id}`)}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 text-xs"
                      value={filters.priority}
                      onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
                    >
                      <option value="">
                        {t("board.filterPriority")}: {t("board.filterAll")}
                      </option>
                      <option value="1">P1</option>
                      <option value="2">P2</option>
                      <option value="3">P3</option>
                    </select>
                    {filtersActive && (
                      <button
                        type="button"
                        className="w-full text-xs text-[#3A97D9] hover:underline"
                        onClick={() => setFilters({ assignee: "", neuron: "", priority: "" })}
                      >
                        {t("board.filterClear")}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <Tooltip content={t("team")}>
                <button
                  type="button"
                  onClick={() => setUsersModal(true)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </button>
              </Tooltip>
            </div>
          ) : null
        }
      />

      <main className="flex-1 overflow-hidden min-h-0">
        {!authReady || loading ? (
          <div className="flex items-center justify-center h-full text-slate-400">{t("loading")}</div>
        ) : !authenticated ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Авторизуйтесь, чтобы смотреть проекты и задачи.
          </div>
        ) : (
          <KanbanBoard
            tasks={tasks}
            tasksByColumn={tasksByColumn}
            onTasksChange={setTasks}
            onRefresh={fetchTasks}
            onCardClick={setEditTask}
            onAddTask={(columnId) => setCreateModal({ column: columnId })}
            users={users}
            isAdmin={isAdmin}
            filters={filters}
            filtersActive={filtersActive}
          />
        )}
      </main>

      {authenticated && (
        <div className="shrink-0 bg-white/95 border-t border-slate-100">
          <div className="px-3 py-1.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setAiOpen((o) => !o)}
              className="flex-1 min-w-0 flex items-center justify-between gap-2 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
              aria-label={aiOpen ? "Свернуть AI-режим" : "Развернуть AI-режим"}
            >
              <span className="inline-flex items-center gap-1.5 truncate">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>AI</span>
              </span>
              <svg
                className={`w-3 h-3 shrink-0 transition-transform ${aiOpen ? "rotate-180" : ""}`}
                fill="currentColor" viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z" />
              </svg>
            </button>
            {aiOpen && (
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setAiMode("board")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    aiMode === "board" ? "bg-[#3A97D9] text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t("ai.modeBoard")}
                </button>
                <button
                  type="button"
                  onClick={() => setAiMode("chat")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    aiMode === "chat" ? "bg-[#3A97D9] text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t("ai.modeChat")}
                </button>
              </div>
            )}
          </div>
          {aiOpen && (
            <div className="px-3 pb-3">
              <AiInput
                users={users}
                mode={aiMode}
                onTaskCreated={() => {
                  fetchTasks();
                  setAiOpen(false);
                }}
              />
            </div>
          )}
        </div>
      )}

      {authenticated && createModal && (
        <TaskModal
          mode="create"
          defaultColumn={createModal.column}
          users={users}
          allTasks={tasks}
          isAdmin={isAdmin}
          onClose={() => setCreateModal(null)}
          onSaved={fetchTasks}
        />
      )}
      {authenticated && editTask && (
        <TaskModal
          mode="edit"
          task={editTask}
          users={users}
          allTasks={tasks}
          isAdmin={isAdmin}
          onClose={() => setEditTask(null)}
          onSaved={fetchTasks}
        />
      )}
      {authenticated && usersModal && (
        <ManageUsersModal
          users={users}
          onClose={() => setUsersModal(false)}
          onSaved={fetchUsers}
        />
      )}
    </div>
  );
}
