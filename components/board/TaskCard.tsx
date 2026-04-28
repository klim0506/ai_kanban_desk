"use client";

import { Draggable } from "@hello-pangea/dnd";
import { useState } from "react";
import type { TaskWithUser } from "@/types";
import TaskHistoryModal from "./TaskHistoryModal";
import { useLocale } from "@/components/providers/LocaleProvider";
import Tooltip from "@/components/ui/Tooltip";

interface Props {
  task: TaskWithUser;
  index: number;
  onClick: () => void;
  onValidate: (id: number) => void;
  compact?: boolean;
  /** Подсветка фильтра: не подходит — бледнее */
  isDimmed?: boolean;
}

function formatDate(d: string | Date | null, locale: string) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
}

function descriptionSnippet(text: string | null | undefined, max = 72) {
  if (!text) return null;
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max).trimEnd() + "…";
}

function toSoftAssigneeBg(color: string | null | undefined): string {
  const hex = (color ?? "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#eef2f7";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // very pale tint based on assignee color
  return `rgba(${r}, ${g}, ${b}, 0.22)`;
}

export default function TaskCard({
  task,
  index,
  onClick,
  onValidate,
  compact,
  isDimmed,
}: Props) {
  const { t, locale } = useLocale();
  const isAiUnvalidated = task.isAiGenerated && !task.isValidated;
  const [historyOpen, setHistoryOpen] = useState(false);
  const loc = locale === "en" ? "en-GB" : "ru-RU";
  const inArchive = task.column === "DONE_LONG_AGO";

  return (
    <Draggable draggableId={String(task.id)} index={index} isDragDisabled={historyOpen}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`group relative shrink-0 bg-white rounded-lg shadow-sm select-none transition-shadow overflow-hidden border ${
            isDimmed ? "opacity-40 saturate-50" : ""
          } ${
            snapshot.isDragging ? "shadow-lg ring-2 ring-[#3A97D9]/40 z-10" : "shadow-sm hover:shadow"
          } ${
            isAiUnvalidated
              ? "border-amber-200"
              : inArchive
                ? "border-emerald-200/90 bg-gradient-to-br from-white to-emerald-50/40"
                : "border-slate-100"
          }`}
        >
          <div className="flex gap-0 min-w-0">
            <div
              className={`flex-1 min-w-0 cursor-pointer ${compact ? "px-2 py-1.5" : "px-2 py-1.5"}`}
              onClick={onClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick();
                }
              }}
            >
              <div className="flex items-start gap-1.5 mb-0.5 min-w-0">
                {isAiUnvalidated && (
                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[9px] font-semibold px-1 py-0.5 rounded shrink-0">
                    AI
                    <Tooltip content={t("card.confirmAi")}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onValidate(task.id);
                        }}
                        className="text-[9px] text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-1 rounded font-semibold"
                      >
                        ✓
                      </button>
                    </Tooltip>
                  </span>
                )}
                <p
                  className={`font-medium text-slate-800 leading-tight flex-1 min-w-0 ${
                    compact ? "text-xs line-clamp-2" : "text-[13px] line-clamp-2"
                  }`}
                >
                  {task.title}
                </p>
                <Tooltip content={t("card.history")}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setHistoryOpen(true);
                    }}
                    className="shrink-0 text-slate-400 hover:text-[#3A97D9] p-0.5 rounded border border-transparent hover:border-slate-200 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100"
                    aria-label={t("card.history")}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5m0 2h.01"/>
                    </svg>
                  </button>
                </Tooltip>
              </div>

              {descriptionSnippet(task.description) && (
                <p className="text-[10px] text-slate-500 line-clamp-2 leading-snug mb-1">
                  {descriptionSnippet(task.description)}
                </p>
              )}

              <div className="flex items-center justify-between gap-1 mt-0.5">
                {task.assignee ? (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full truncate max-w-[58%] font-medium"
                    style={{
                      background: toSoftAssigneeBg(task.assignee.color),
                      color: "#111827",
                    }}
                  >
                    {task.assignee.name}
                  </span>
                ) : (
                  <span />
                )}
                {task.startDate && task.endDate && (
                  <span className="text-[10px] text-slate-400 whitespace-nowrap tabular-nums">
                    {formatDate(task.startDate, loc)}–{formatDate(task.endDate, loc)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {historyOpen && (
            <div onClick={(e) => e.stopPropagation()}>
              <TaskHistoryModal taskId={task.id} onClose={() => setHistoryOpen(false)} />
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
