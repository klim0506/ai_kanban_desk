"use client";

import { useState } from "react";
import type { ParsedTask } from "@/types";
import { COLUMNS } from "@/lib/constants";
import { NEURON_BLOCKS, DEFAULT_NEURON_BLOCK, isNeuronBlockId, type NeuronBlockId } from "@/lib/neuronBlocks";
import Modal from "@/components/ui/Modal";
import { apiFetch } from "@/hooks/useCurrentUser";
import { useLocale } from "@/components/providers/LocaleProvider";
import { readApiError } from "@/lib/apiError";

interface Props {
  parsed: ParsedTask[];
  users: { id: number; name: string }[];
  onClose: () => void;
  onConfirmed: () => void;
}

type EditableTask = {
  title: string;
  description: string;
  column: string;
  assigneeId: string;
  startDate: string;
  endDate: string;
  noDeadline: boolean;
  assigneeName: string | null;
  priority: number;
  difficulty: number;
  isValidated: boolean;
  neuronBlock: NeuronBlockId;
};

function toEditable(p: ParsedTask, users: { id: number; name: string }[]): EditableTask {
  const guessed = p.assigneeName
    ? users.find((u) => u.name.toLowerCase().includes(p.assigneeName!.toLowerCase()))
    : null;
  const nb = p.neuronBlock && isNeuronBlockId(p.neuronBlock) ? p.neuronBlock : DEFAULT_NEURON_BLOCK;
  return {
    title: p.title,
    description: p.description ?? "",
    column: p.column ?? "SPRINT_BACKLOG",
    assigneeId: guessed?.id.toString() ?? "",
    startDate: p.startDate ?? "",
    endDate: p.endDate ?? "",
    noDeadline: !p.startDate && !p.endDate,
    assigneeName: p.assigneeName,
    priority: p.priority ?? 2,
    difficulty: p.difficulty ?? 2,
    isValidated: false,
    neuronBlock: nb,
  };
}

export default function AiTaskPreview({ parsed, users, onClose, onConfirmed }: Props) {
  const { t } = useLocale();
  const [tasks, setTasks] = useState<EditableTask[]>(parsed.map((p) => toEditable(p, users)));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function updateTask(i: number, patch: Partial<EditableTask>) {
    setTasks((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function removeTask(i: number) {
    setTasks((prev) => prev.filter((_, idx) => idx !== i));
  }

  function validateAll() {
    setTasks((prev) => prev.map((x) => ({ ...x, isValidated: true })));
  }

  const allValidated = tasks.length > 0 && tasks.every((x) => x.isValidated);

  async function handleConfirmAll() {
    if (tasks.length === 0) return;
    const valid = tasks.filter((x) => x.title.trim());
    if (valid.length === 0) { setSaveError(t("ai.noTasks")); return; }
    setSaving(true);
    setSaveError(null);
    try {
      for (const x of valid) {
        const res = await apiFetch("/api/tasks", {
          method: "POST",
          body: JSON.stringify({
            title: x.title.trim(),
            description: x.description.trim() || null,
            column: x.column,
            assigneeId: x.assigneeId ? parseInt(x.assigneeId) : null,
                startDate: x.noDeadline ? null : (x.startDate || null),
                endDate: x.noDeadline ? null : (x.endDate || null),
            priority: x.priority,
            difficulty: x.difficulty,
            neuronBlock: x.neuronBlock,
            isAiGenerated: true,
            isValidated: x.isValidated,
          }),
        });
        if (!res.ok) throw new Error(await readApiError(res, t("errors.saveFailed")));
      }
      onConfirmed();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t("ai.errorNetwork"));
    } finally {
      setSaving(false);
    }
  }

  const createLabel =
    tasks.length === 1 ? t("ai.createOne") : t("ai.createN").replace("{n}", String(tasks.length));

  return (
    <Modal onClose={onClose} title={`${t("ai.previewTitle")} (${tasks.length})`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex-1">
          <span className="font-medium">AI</span>
          <span>{t("ai.previewHint")}</span>
        </div>
        {tasks.length > 1 && (
          <button
            type="button"
            onClick={validateAll}
            disabled={allValidated}
            className="shrink-0 text-xs px-3 py-2 rounded-lg border font-medium transition-colors disabled:opacity-40
              bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
          >
            {allValidated ? "✓ Все подтверждены" : "Подтвердить все"}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
        {tasks.map((x, i) => (
          <div
            key={i}
            className={`border rounded-xl p-3 flex flex-col gap-2 transition-colors ${
              x.isValidated
                ? "border-emerald-200 bg-emerald-50/30"
                : "border-amber-200/80 bg-amber-50/30"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                #{i + 1}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateTask(i, { isValidated: !x.isValidated })}
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold transition-colors ${
                    x.isValidated
                      ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {x.isValidated ? t("ai.validated") : t("ai.validate")}
                </button>
                {tasks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTask(i)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Title */}
            <input
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/30"
              value={x.title}
              onChange={(e) => updateTask(i, { title: e.target.value })}
              placeholder={t("task.titlePh")}
            />

            {/* Description */}
            <textarea
              className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/30 resize-none"
              rows={2}
              placeholder={t("task.descriptionPh")}
              value={x.description}
              onChange={(e) => updateTask(i, { description: e.target.value })}
            />

            {/* Column + Assignee */}
            <div className="grid grid-cols-2 gap-2">
              <select
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white"
                value={x.column}
                onChange={(e) => updateTask(i, { column: e.target.value })}
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>{t(`columns.${c.id}`)}</option>
                ))}
              </select>
              <select
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white"
                value={x.assigneeId}
                onChange={(e) => updateTask(i, { assigneeId: e.target.value })}
              >
                <option value="">—{x.assigneeName ? ` (${x.assigneeName})` : ""}—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            {/* Neuron block */}
            <select
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white"
              value={x.neuronBlock}
              onChange={(e) => updateTask(i, { neuronBlock: e.target.value as NeuronBlockId })}
            >
              {NEURON_BLOCKS.map((b) => (
                <option key={b.id} value={b.id}>{t(`neuron.${b.id}`)}</option>
              ))}
            </select>

            {/* Priority + Difficulty */}
            <div className="grid grid-cols-2 gap-2">
              <select
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white"
                value={x.priority}
                onChange={(e) => updateTask(i, { priority: parseInt(e.target.value) })}
              >
                {[1, 2, 3, 4].map((p) => (
                  <option key={p} value={p}>P{p} — {t(`priorities.${p}` as "priorities.1")}</option>
                ))}
              </select>
              <select
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white"
                value={x.difficulty}
                onChange={(e) => updateTask(i, { difficulty: parseInt(e.target.value) })}
              >
                {[1, 2, 3, 4].map((d) => (
                  <option key={d} value={d}>D{d} — {t(`difficulties.${d}` as "difficulties.1")}</option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={x.noDeadline}
                onChange={(e) => {
                  const checked = e.target.checked;
                  updateTask(i, {
                    noDeadline: checked,
                    startDate: checked ? "" : x.startDate,
                    endDate: checked ? "" : x.endDate,
                  });
                }}
              />
              {t("task.noDeadline")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                disabled={x.noDeadline}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs disabled:bg-slate-50"
                value={x.startDate}
                onChange={(e) => updateTask(i, { startDate: e.target.value, noDeadline: false })}
              />
              <input
                type="date"
                disabled={x.noDeadline}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs disabled:bg-slate-50"
                value={x.endDate}
                onChange={(e) => updateTask(i, { endDate: e.target.value, noDeadline: false })}
              />
            </div>
          </div>
        ))}

        {tasks.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">—</p>
        )}
      </div>

      {saveError && <p className="text-xs text-red-500 mt-2">{saveError}</p>}

      <div className="flex justify-end gap-2 pt-3 mt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          {t("task.cancel")}
        </button>
        <button
          type="button"
          onClick={handleConfirmAll}
          disabled={saving || tasks.length === 0}
          className="px-4 py-1.5 text-sm bg-[#3A97D9] text-white rounded-lg hover:bg-[#2d87c4] disabled:opacity-50"
        >
          {saving ? t("ai.creating") : createLabel}
        </button>
      </div>
    </Modal>
  );
}
