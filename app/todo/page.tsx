"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TaskWithUser, TodoItem, UserPublic } from "@/types";
import { COLUMNS } from "@/lib/constants";
import AppHeader from "@/components/layout/AppHeader";
import { apiFetch, useCurrentUser, useRequireAuth } from "@/hooks/useCurrentUser";
import { useLocale } from "@/components/providers/LocaleProvider";
import Modal from "@/components/ui/Modal";

const SPRINT_ACTIVE_COLUMNS = new Set(["SPRINT_BACKLOG", "DEV", "TESTING"]);

export default function TodoPage() {
  const { t } = useLocale();
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [tasks, setTasks] = useState<TaskWithUser[]>([]);
  const [authUser, setAuthUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoValue, setTodoValue] = useState("");
  const [addPersonalModalOpen, setAddPersonalModalOpen] = useState(false);
  const [moveDialog, setMoveDialog] = useState<{
    task: TaskWithUser;
    targetColumn: string;
  } | null>(null);
  const [moving, setMoving] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [boardUserPickerOpen, setBoardUserPickerOpen] = useState(false);
  const [boardViewedUserId, setBoardViewedUserId] = useState<number | null>(null);

  const { currentUserId, setUser } = useCurrentUser(users);
  const { ready: authReady, authenticated, checkAuth } = useRequireAuth();

  const handleUserChange = useCallback((id: number | null) => {
    setUser(id);
    if (id != null) void checkAuth();
  }, [setUser, checkAuth]);

  const canViewAllUsersTodos = authUser?.role === "admin";
  const viewedUserId = canViewAllUsersTodos ? (boardViewedUserId ?? authUser?.id ?? null) : (authUser?.id ?? null);
  const viewedUser = users.find((u) => u.id === viewedUserId) ?? authUser;
  const personalUserId = authUser?.id ?? null;
  const isOwnTodoScope = true;

  const fetchUsers = useCallback(async () => {
    const res = await apiFetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }, []);

  const fetchTasks = useCallback(async () => {
    const res = await apiFetch("/api/tasks");
    if (res.ok) setTasks(await res.json());
  }, []);

  const fetchPersonalTodos = useCallback(async () => {
    if (!personalUserId) return;
    const res = await apiFetch("/api/todos");
    if (res.ok) setTodos(await res.json());
  }, [personalUserId]);

  const fetchSession = useCallback(async () => {
    const res = await apiFetch("/api/auth/me");
    if (!res.ok) return;
    const data = (await res.json()) as { user: UserPublic };
    setAuthUser(data.user);
  }, []);

  useEffect(() => {
    if (!authenticated) {
      setLoading(false);
      return;
    }
    Promise.all([fetchSession(), fetchUsers(), fetchTasks()]).finally(() => setLoading(false));
  }, [fetchSession, fetchUsers, fetchTasks, authenticated]);

  useEffect(() => {
    if (!authUser) return;
    if (currentUserId == null) setUser(authUser.id);
    if (boardViewedUserId == null) setBoardViewedUserId(authUser.id);
  }, [authUser, currentUserId, setUser, boardViewedUserId]);

  useEffect(() => {
    if (!authenticated) return;
    fetchTasks();
  }, [fetchTasks, authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    fetchPersonalTodos();
  }, [fetchPersonalTodos, authenticated]);

  const userBoardTasks = useMemo(() => {
    if (viewedUserId == null) return [];
    return tasks.filter(
      (x) =>
        x.assigneeId === viewedUserId &&
        (SPRINT_ACTIVE_COLUMNS.has(x.column) || x.column === "DONE_SPRINT")
    );
  }, [tasks, viewedUserId]);

  const activeBoardTasks = useMemo(
    () => userBoardTasks.filter((x) => x.column !== "DONE_SPRINT"),
    [userBoardTasks]
  );
  const completedBoardTasks = useMemo(
    () => userBoardTasks.filter((x) => x.column === "DONE_SPRINT"),
    [userBoardTasks]
  );
  const activePersonalTodos = useMemo(() => todos.filter((x) => !x.isCompleted), [todos]);
  const completedPersonalTodos = useMemo(() => todos.filter((x) => x.isCompleted), [todos]);

  const canArchive = authUser?.role === "admin";
  const moveTargetColumns = useMemo(
    () =>
      COLUMNS.filter((c) => c.id !== "GLOBAL_BACKLOG" && (canArchive || c.id !== "DONE_LONG_AGO")).map((c) => c.id),
    [canArchive]
  );

  function openMoveDialog(task: TaskWithUser) {
    setMoveDialog({ task, targetColumn: "DONE_SPRINT" });
  }

  async function confirmMoveTask() {
    if (!moveDialog) return;
    setMoving(true);
    try {
      const res = await apiFetch(`/api/tasks/${moveDialog.task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ column: moveDialog.targetColumn }),
      });
      if (!res.ok) return;
      await fetchTasks();
      setMoveDialog(null);
    } finally {
      setMoving(false);
    }
  }

  async function addPersonalTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!todoValue.trim() || !isOwnTodoScope) return;
    const res = await apiFetch("/api/todos", {
      method: "POST",
      body: JSON.stringify({ title: todoValue.trim(), taskId: null }),
    });
    if (!res.ok) return;
    setTodoValue("");
    setAddPersonalModalOpen(false);
    await fetchPersonalTodos();
  }

  async function togglePersonalTodo(todo: TodoItem) {
    if (!isOwnTodoScope) return;
    const res = await apiFetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isCompleted: !todo.isCompleted }),
    });
    if (!res.ok) return;
    await fetchPersonalTodos();
  }

  async function removePersonalTodo(id: number) {
    if (!isOwnTodoScope) return;
    const res = await apiFetch(`/api/todos/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    await fetchPersonalTodos();
  }

  async function openStatusReport() {
    if (!viewedUserId) return;
    setStatusOpen(true);
    setStatusLoading(true);
    setStatusText("");
    try {
      const q = canViewAllUsersTodos ? `?userId=${viewedUserId}` : "";
      const res = await apiFetch(`/api/todos/status${q}`);
      if (!res.ok) return;
      const data = (await res.json()) as { text?: string };
      setStatusText(data.text ?? "");
    } finally {
      setStatusLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#f6f9fc]">
      <AppHeader active="todo" users={users} currentUserId={currentUserId} onUserChange={handleUserChange} />

      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Add form */}
          {authenticated && (
            <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-3 text-sm flex items-center justify-between gap-3">
              <div>
                <span className="text-slate-500">{t("todo.viewing")} </span>
                {canViewAllUsersTodos ? (
                  <button
                    type="button"
                    onClick={() => setBoardUserPickerOpen(true)}
                    className="font-medium text-slate-700 underline decoration-dotted underline-offset-2 hover:text-slate-900"
                  >
                    {viewedUser?.name ?? "—"}
                  </button>
                ) : (
                  <span className="font-medium text-slate-700">{viewedUser?.name ?? "—"}</span>
                )}
                {canViewAllUsersTodos && viewedUserId !== authUser?.id && (
                  <span className="ml-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                    {t("todo.readOnly")}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={openStatusReport}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                {t("todo.status")}
              </button>
            </div>
          )}

          {!authReady || loading ? (
            <div className="text-sm text-slate-400 text-center py-8">{t("loading")}</div>
          ) : !authenticated ? (
            <div className="text-sm text-slate-500 text-center py-8">{t("todo.authRequired")}</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-4">
                <Section title={t("todo.fromBoard")} icon="📋">
                  {activeBoardTasks.map((task) => (
                    <BoardTaskRow key={task.id} task={task} onMarkDone={() => openMoveDialog(task)} />
                  ))}
                  {activeBoardTasks.length === 0 && (
                    <div className="px-4 py-3 text-xs text-slate-400">{t("todo.empty")}</div>
                  )}
                </Section>
                <Section title={t("todo.completed")} icon="✓" muted>
                  {completedBoardTasks.map((task) => (
                    <BoardTaskRow key={task.id} task={task} />
                  ))}
                  {completedBoardTasks.length === 0 && (
                    <div className="px-4 py-3 text-xs text-slate-400">{t("todo.empty")}</div>
                  )}
                </Section>
              </div>

              <div className="space-y-4">
                <Section
                  title={t("todo.userTasks")}
                  icon="✏️"
                  extraRight={
                    <button
                      type="button"
                      onClick={() => setAddPersonalModalOpen(true)}
                      className="w-6 h-6 rounded-full bg-[#3A97D9] text-white text-sm leading-none"
                      aria-label={t("todo.add")}
                    >
                      +
                    </button>
                  }
                >
                  {activePersonalTodos.map((todo) => (
                    <PersonalTodoRow
                      key={todo.id}
                      todo={todo}
                      canEdit={isOwnTodoScope}
                      onToggle={() => togglePersonalTodo(todo)}
                      onDelete={() => removePersonalTodo(todo.id)}
                    />
                  ))}
                  {activePersonalTodos.length === 0 && (
                    <div className="px-4 py-3 text-xs text-slate-400">{t("todo.empty")}</div>
                  )}
                </Section>
                <Section title={t("todo.completed")} icon="✓" muted>
                  {completedPersonalTodos.map((todo) => (
                    <PersonalTodoRow
                      key={todo.id}
                      todo={todo}
                      canEdit={isOwnTodoScope}
                      onToggle={() => togglePersonalTodo(todo)}
                      onDelete={() => removePersonalTodo(todo.id)}
                    />
                  ))}
                  {completedPersonalTodos.length === 0 && (
                    <div className="px-4 py-3 text-xs text-slate-400">{t("todo.empty")}</div>
                  )}
                </Section>
              </div>
            </div>
          )}
        </div>
      </main>

      {moveDialog && (
        <Modal title={t("todo.moveDoneTitle")} onClose={() => !moving && setMoveDialog(null)}>
          <p className="text-sm text-slate-600 mb-3">
            {t("todo.moveDoneBody")} <span className="font-medium">«{moveDialog.task.title}»</span>.
          </p>
          <label className="block text-xs text-slate-500 mb-1">{t("todo.moveDonePickColumn")}</label>
          <select
            value={moveDialog.targetColumn}
            onChange={(e) => setMoveDialog((prev) => (prev ? { ...prev, targetColumn: e.target.value } : prev))}
            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
            disabled={moving}
          >
            {moveTargetColumns.map((columnId) => (
              <option key={columnId} value={columnId}>
                {t(`columns.${columnId}`)}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => setMoveDialog(null)}
              className="px-4 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
              disabled={moving}
            >
              {t("task.cancel")}
            </button>
            <button
              type="button"
              onClick={confirmMoveTask}
              disabled={moving}
              className="px-4 py-1.5 text-sm bg-[#3A97D9] text-white rounded-lg hover:bg-[#2d87c4] disabled:opacity-50"
            >
              {moving ? t("task.saving") : t("todo.moveDoneConfirm")}
            </button>
          </div>
        </Modal>
      )}

      {addPersonalModalOpen && isOwnTodoScope && (
        <Modal title={t("todo.userTasks")} onClose={() => setAddPersonalModalOpen(false)}>
          <form onSubmit={addPersonalTodo} className="flex flex-col gap-3">
            <input
              value={todoValue}
              onChange={(e) => setTodoValue(e.target.value)}
              placeholder={t("todo.addPlaceholder")}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/30"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddPersonalModalOpen(false)}
                className="px-4 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                {t("task.cancel")}
              </button>
              <button
                type="submit"
                disabled={!todoValue.trim()}
                className="px-4 py-1.5 text-sm bg-[#3A97D9] text-white rounded-lg hover:bg-[#2d87c4] disabled:opacity-50"
              >
                {t("todo.add")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {boardUserPickerOpen && canViewAllUsersTodos && (
        <Modal title={t("todo.viewing")} onClose={() => setBoardUserPickerOpen(false)}>
          <div className="space-y-2 max-h-[50vh] overflow-auto">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setBoardViewedUserId(u.id);
                  setBoardUserPickerOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                  viewedUserId === u.id
                    ? "border-[#3A97D9] bg-[#3A97D9]/10 text-slate-800"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {u.name}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {statusOpen && (
        <Modal title={t("todo.status")} onClose={() => setStatusOpen(false)}>
          {statusLoading ? (
            <p className="text-sm text-slate-400">{t("loading")}</p>
          ) : (
            <div className="space-y-3">
              <textarea
                readOnly
                value={statusText}
                className="w-full min-h-[220px] border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(statusText)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  {t("todo.copyStatus")}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  muted,
  extraRight,
  children,
}: {
  title: string;
  icon: string;
  muted?: boolean;
  extraRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
      <div className={`px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-2 ${muted ? "bg-slate-50" : "bg-white"}`}>
        <span className="inline-flex items-center gap-2 min-w-0">
          <span className="text-sm">{icon}</span>
          <span className={`text-xs font-semibold uppercase tracking-wide ${muted ? "text-slate-400" : "text-slate-500"}`}>
            {title}
          </span>
        </span>
        {extraRight}
      </div>
      <div className="divide-y divide-slate-50">{children}</div>
    </div>
  );
}

function BoardTaskRow({
  task,
  onMarkDone,
}: {
  task: TaskWithUser;
  onMarkDone?: () => void;
}) {
  const { t, locale } = useLocale();
  const dateLocale = locale === "en" ? "en-GB" : "ru-RU";

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
      <input
        type="checkbox"
        checked={task.column === "DONE_SPRINT"}
        onChange={() => onMarkDone?.()}
        disabled={!onMarkDone}
        className="accent-[#3A97D9] w-4 h-4 shrink-0 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <span className={`text-sm block truncate ${task.column === "DONE_SPRINT" ? "line-through text-slate-400" : "text-slate-700"}`}>
          {task.title}
        </span>
        <span className="text-[10px] text-slate-500 font-medium mt-0.5 block truncate">
          {t(`columns.${task.column}`)}
          {task.startDate && task.endDate
            ? ` • ${new Date(task.startDate).toLocaleDateString(dateLocale)}–${new Date(task.endDate).toLocaleDateString(dateLocale)}`
            : ""}
          {task.assignee ? ` • ${task.assignee.name}` : ""}
        </span>
        {task.description && (
          <span className="text-[10px] text-[#3A97D9] mt-0.5 block truncate">
            {task.description}
          </span>
        )}
      </div>
    </div>
  );
}

function PersonalTodoRow({
  todo,
  canEdit,
  onToggle,
  onDelete,
}: {
  todo: TodoItem;
  canEdit: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
      <input
        type="checkbox"
        checked={todo.isCompleted}
        onChange={onToggle}
        disabled={!canEdit}
        className="accent-[#3A97D9] w-4 h-4 shrink-0 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <span className={`text-sm block truncate ${todo.isCompleted ? "line-through text-slate-400" : "text-slate-700"}`}>
          {todo.title}
        </span>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={!canEdit}
        className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none shrink-0"
      >
        ×
      </button>
    </div>
  );
}
