"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import type { TaskWithUser, UserPublic } from "@/types";
import AppHeader from "@/components/layout/AppHeader";
import TaskModal from "@/components/board/TaskModal";
import Tooltip from "@/components/ui/Tooltip";
import { useCurrentUser, apiFetch, useRequireAuth } from "@/hooks/useCurrentUser";
import { useLocale } from "@/components/providers/LocaleProvider";

const GanttView = dynamic(() => import("@/components/gantt/GanttView"), { ssr: false });
const ManageUsersModal = dynamic(() => import("@/components/ui/ManageUsersModal"), { ssr: false });

export default function GanttPage() {
  const { t } = useLocale();
  const [tasks, setTasks] = useState<TaskWithUser[]>([]);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersModal, setUsersModal] = useState(false);
  const [editTask, setEditTask] = useState<TaskWithUser | null>(null);
  const { currentUserId, setUser, isAdmin } = useCurrentUser(users);
  const { ready: authReady, authenticated, checkAuth } = useRequireAuth();

  const handleUserChange = useCallback((id: number | null) => {
    setUser(id);
    if (id != null) void checkAuth();
  }, [setUser, checkAuth]);

  const fetchTasks = useCallback(async () => {
    const res = await apiFetch("/api/tasks");
    if (res.ok) setTasks(await res.json());
    setLoading(false);
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
    fetchTasks();
    fetchUsers();
  }, [fetchTasks, fetchUsers, authenticated]);

  const withDates = tasks.filter((x) => x.startDate && x.endDate);

  return (
    <div className="flex flex-col h-screen bg-[#f6f9fc]">
      <AppHeader
        active="gantt"
        users={users}
        currentUserId={currentUserId}
        onUserChange={handleUserChange}
        extraRight={authenticated ? (
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
        ) : null}
      />

      <main className="flex-1 overflow-auto p-3">
        {!authReady || loading ? (
          <div className="text-slate-400 mt-10 text-center">{t("loading")}</div>
        ) : !authenticated ? (
          <div className="text-slate-500 mt-10 text-center">Авторизуйтесь, чтобы смотреть проекты и задачи.</div>
        ) : withDates.length === 0 ? (
          <div className="text-slate-400 mt-10 text-center max-w-md mx-auto">{t("gantt.noDates")}</div>
        ) : (
          <div className="space-y-3">
            <div className="bg-white/80 border border-slate-100 rounded-xl px-3 py-2 text-xs text-slate-500">
              {t("gantt.withDatesCount").replace("{n}", String(withDates.length))}
            </div>
            <GanttView tasks={withDates} onDateChange={fetchTasks} onTaskClick={setEditTask} />
          </div>
        )}
      </main>

      {authenticated && usersModal && (
        <ManageUsersModal
          users={users}
          onClose={() => setUsersModal(false)}
          onSaved={fetchUsers}
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
    </div>
  );
}
