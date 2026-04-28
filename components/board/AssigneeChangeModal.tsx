"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import type { TaskWithUser, UserPublic } from "@/types";
import { apiFetch } from "@/hooks/useCurrentUser";
import { useLocale } from "@/components/providers/LocaleProvider";

interface Props {
  task: TaskWithUser;
  users: UserPublic[];
  onClose: () => void;
  onSaved: () => void;
}

export default function AssigneeChangeModal({ task, users, onClose, onSaved }: Props) {
  const { t } = useLocale();
  const [assigneeId, setAssigneeId] = useState<string>(
    task.assigneeId?.toString() ?? ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await apiFetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        assigneeId: assigneeId ? parseInt(assigneeId) : null,
      }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title={t("assigneeModal.title")} onClose={onClose}>
      <p className="text-sm text-slate-600 mb-3">
        {t("assigneeModal.bodyBefore")}{" "}
        <span className="font-medium">«{task.title}»</span>{" "}
        {t("assigneeModal.bodyAfter")}{" "}
        <span className="font-medium">{t(`columns.${task.column}`)}</span>.{" "}
        {t("assigneeModal.maybeReassign")}
      </p>

      <label className="block text-xs text-slate-500 mb-1">{t("task.assignee")}</label>
      <select
        value={assigneeId}
        onChange={(e) => setAssigneeId(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/40"
      >
        <option value="">{t("task.assigneeNone")}</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>

      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          {t("assigneeModal.leave")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 text-sm bg-[#3A97D9] text-white rounded-lg hover:bg-[#2d87c4] disabled:opacity-50"
        >
          {saving ? t("task.saving") : t("assigneeModal.save")}
        </button>
      </div>
    </Modal>
  );
}
