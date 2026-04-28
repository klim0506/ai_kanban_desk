"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import type { TaskHistoryWithActor } from "@/types";
import { apiFetch } from "@/hooks/useCurrentUser";
import { useLocale } from "@/components/providers/LocaleProvider";

interface Props {
  taskId: number;
  onClose: () => void;
}

function formatDT(d: string | Date, locale: string) {
  return new Date(d).toLocaleString(locale === "en" ? "en-GB" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TaskHistoryModal({ taskId, onClose }: Props) {
  const { t, locale } = useLocale();
  const [entries, setEntries] = useState<TaskHistoryWithActor[] | null>(null);

  useEffect(() => {
    apiFetch(`/api/tasks/${taskId}/history`).then(async (r) => {
      if (r.ok) setEntries(await r.json());
      else setEntries([]);
    });
  }, [taskId]);

  function describeEntry(h: TaskHistoryWithActor): string {
    if (h.kind === "created") return t("history.created");
    if (h.kind === "column") {
      const from = h.fromValue ? t(`columns.${h.fromValue}`) || h.fromValue : "—";
      const to = h.toValue ? t(`columns.${h.toValue}`) || h.toValue : "—";
      return `${from} → ${to}`;
    }
    if (h.kind === "assignee") {
      return `${h.fromValue ?? "—"} → ${h.toValue ?? "—"}`;
    }
    return `${h.kind}: ${h.fromValue ?? ""} → ${h.toValue ?? ""}`;
  }

  return (
    <Modal title={t("history.title")} onClose={onClose}>
      {entries === null ? (
        <p className="text-sm text-slate-400">{t("history.loading")}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-400">{t("history.empty")}</p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <ul className="flex flex-col gap-2 text-sm">
            {entries.map((h) => (
              <li key={h.id} className="flex items-start gap-3 border-b border-slate-100 pb-2 last:border-b-0">
                <div className="text-xs text-slate-400 min-w-[110px] shrink-0">
                  {formatDT(h.createdAt, locale)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-slate-800">{describeEntry(h)}</div>
                  <div className="text-xs text-slate-500">
                    {h.actor ? h.actor.name : t("history.system")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
