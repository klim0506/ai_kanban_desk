"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TaskWithUser } from "@/types";
import { parseDependencies } from "@/types";
import { apiFetch } from "@/hooks/useCurrentUser";
import { useLocale } from "@/components/providers/LocaleProvider";
import Modal from "@/components/ui/Modal";

type ViewMode = "Day" | "Week" | "Month";

type GanttRuntime = {
  bar_being_dragged: string | null;
  get_bar: (id: string) => { compute_start_end_date: () => { new_start_date: Date; new_end_date: Date } };
};

const UNASSIGNED_BAR_COLOR = "#cbd5e1";

const GANTT_DISMISS_KEY = "gantt_date_confirm_dismiss_until";

function isGanttWarnDismissed(): boolean {
  try {
    const v = sessionStorage.getItem(GANTT_DISMISS_KEY);
    if (!v) return false;
    return Date.now() < parseInt(v, 10);
  } catch {
    return false;
  }
}

function setGanttWarnDismissed(minutes: number) {
  try {
    sessionStorage.setItem(GANTT_DISMISS_KEY, String(Date.now() + minutes * 60 * 1000));
  } catch {
    /* ignore */
  }
}

interface Props {
  tasks: TaskWithUser[];
  onDateChange: () => void;
  onTaskClick: (task: TaskWithUser) => void;
}

function formatDate(d: string | Date, locale: string) {
  return new Date(d).toLocaleDateString(locale === "en" ? "en-GB" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/** endDate из compute_start_end_date — эксклюзивный конец полосы; в API храним включительно */
function inclusiveEnd(exclusiveEnd: Date): Date {
  return new Date(exclusiveEnd.getTime() - 1000);
}

export default function GanttView({ tasks, onDateChange, onTaskClick }: Props) {
  const { t, locale } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<GanttRuntime | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("Week");
  const [pendingCommit, setPendingCommit] = useState<{
    taskId: number;
    start: Date;
    end: Date;
  } | null>(null);
  const [skipWarn5m, setSkipWarn5m] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const suppressClickUntilRef = useRef(0);

  const withDates = tasks.filter((x) => x.startDate && x.endDate);
  const taskIds = new Set(withDates.map((x) => String(x.id)));
  const openTaskById = useCallback(
    (id: number) => {
      const selected = withDates.find((x) => x.id === id);
      if (selected) onTaskClick(selected);
    },
    [withDates, onTaskClick]
  );

  const commitDates = useCallback(
    async (taskId: number, start: Date, end: Date) => {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(String(data.error ?? "PATCH failed"));
      }
      onDateChange();
    },
    [onDateChange]
  );

  useEffect(() => {
    if (!containerRef.current || withDates.length === 0) return;

    let cancelled = false;
    const el = containerRef.current;
    let dispose: (() => void) | undefined;

    void (async () => {
      const Gantt = (await import("frappe-gantt")).default;
      if (cancelled || !el) return;

      const ganttTasks = withDates.map((x) => {
        const deps = parseDependencies(x.dependencies).filter((d) => taskIds.has(d.id));
        return {
          id: String(x.id),
          name: x.title + (x.assignee ? ` — ${x.assignee.name}` : ""),
          start: new Date(x.startDate!).toISOString().split("T")[0],
          end: new Date(x.endDate!).toISOString().split("T")[0],
          progress: 0,
          dependencies: deps.map((d) => d.id).join(","),
          custom_class: [
            x.isAiGenerated && !x.isValidated ? "ai-task" : "",
            `prio-${x.priority ?? 2}`,
          ]
            .filter(Boolean)
            .join(" "),
        };
      });

      if (cancelled) return;
      el.innerHTML = "";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      el.appendChild(svg);

      const gantt = new Gantt(svg, ganttTasks, {
        view_mode: viewMode,
        date_format: "YYYY-MM-DD",
        language: locale === "en" ? "en" : "ru",
        bar_height: 26,
        bar_corner_radius: 4,
        padding: 18,
        on_date_change: async (task: { id: string }, start: Date, end: Date) => {
          // Drag/resize in gantt often triggers a trailing click event on mouseup.
          // Suppress task-open clicks briefly so drag doesn't open modal.
          suppressClickUntilRef.current = Date.now() + 350;
          const id = parseInt(task.id, 10);
          const safeEnd = inclusiveEnd(end);
          if (isGanttWarnDismissed()) {
            await commitDates(id, start, safeEnd);
            return;
          }
          setPendingCommit({ taskId: id, start, end: safeEnd });
        },
        on_click: (task: { id: string }) => {
          const id = parseInt(task.id, 10);
          if (!Number.isNaN(id)) openTaskById(id);
        },
      });

      ganttRef.current = gantt as unknown as GanttRuntime;

      let pressState: { id: number; x: number; y: number } | null = null;

      const resolveTaskIdFromTarget = (target: EventTarget | null): number | null => {
        let node = target as Node | null;
        while (node) {
          if (node instanceof Element) {
            const idRaw = node.getAttribute("data-id");
            if (idRaw) {
              const id = parseInt(idRaw, 10);
              if (!Number.isNaN(id)) return id;
            }
          }
          node = node.parentNode;
        }
        return null;
      };

      const onBarClick = (event: MouseEvent) => {
        if (Date.now() < suppressClickUntilRef.current) return;
        const id = resolveTaskIdFromTarget(event.target);
        if (id != null) openTaskById(id);
      };

      const directBarNodes = Array.from(
        svg.querySelectorAll(".bar-wrapper[data-id], .bar-wrapper[data-id] .bar, .bar-wrapper[data-id] .bar-progress, .bar-wrapper[data-id] .bar-label")
      ) as Element[];

      const onDirectPointerDown = (event: Event) => {
        const mouse = event as MouseEvent;
        const id = resolveTaskIdFromTarget(mouse.target);
        if (id == null) return;
        pressState = { id, x: mouse.clientX, y: mouse.clientY };
      };

      const onDirectPointerUp = (event: Event) => {
        const mouse = event as MouseEvent;
        const id = resolveTaskIdFromTarget(mouse.target);
        if (id == null || !pressState) return;
        const moved =
          Math.abs(mouse.clientX - pressState.x) > 4 ||
          Math.abs(mouse.clientY - pressState.y) > 4;
        const sameTask = pressState.id === id;
        if (moved) suppressClickUntilRef.current = Date.now() + 250;
        // frappe-gantt marks bar_being_dragged on mousedown, even for a regular click.
        // Trust pointer movement threshold instead of drag flag to avoid swallowing clicks.
        if (sameTask && !moved) {
          openTaskById(id);
        }
        pressState = null;
      };

      directBarNodes.forEach((node) => {
        node.style.cursor = "pointer";
        node.addEventListener("mousedown", onDirectPointerDown);
        node.addEventListener("mouseup", onDirectPointerUp);
      });

      svg.addEventListener("click", onBarClick);

      requestAnimationFrame(() => {
        if (!cancelled) {
          tintGanttByAssignee(withDates, viewMode);
          drawTodayLine();
        }
      });

      dispose = () => {
        svg.removeEventListener("click", onBarClick);
        directBarNodes.forEach((node) => {
          node.removeEventListener("mousedown", onDirectPointerDown);
          node.removeEventListener("mouseup", onDirectPointerUp);
        });
      };
    })();

    return () => {
      cancelled = true;
      dispose?.();
      ganttRef.current = null;
      el.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viewMode,
    locale,
    commitDates,
    openTaskById,
    withDates
      .map(
        (x) =>
          x.id +
          x.column +
          String(x.startDate) +
          String(x.endDate) +
          (x.dependencies ?? "") +
          (x.priority ?? 2) +
          (x.assignee?.color ?? "")
      )
      .join(","),
  ]);

  function exportCsv() {
    const sep = locale === "en" ? "," : ";";
    const headers = [
      t("gantt.tableTask"),
      t("gantt.tableAssignee"),
      t("gantt.tableStart"),
      t("gantt.tableEnd"),
      t("gantt.tableDeps"),
    ];
    const rows = withDates.map((x) => {
      const s = new Date(x.startDate!);
      const e = new Date(x.endDate!);
      const deps = parseDependencies(x.dependencies)
        .map((d) => {
          const target = withDates.find((y) => String(y.id) === d.id);
          if (!target) return null;
          const label = d.type === "same" ? "same" : "after";
          return `${label}:${target.title}`;
        })
        .filter(Boolean)
        .join("|");
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      return [
        esc(x.title),
        esc(x.assignee?.name ?? "—"),
        esc(formatDate(s, locale)),
        esc(formatDate(e, locale)),
        esc(deps || "—"),
      ].join(sep);
    });
    const bom = "\uFEFF";
    const blob = new Blob([bom + [headers.join(sep), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = locale === "en" ? "neuron-gantt.csv" : "neuron-gantt.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function confirmPending() {
    if (!pendingCommit) return;
    if (skipWarn5m) setGanttWarnDismissed(5);
    await commitDates(pendingCommit.taskId, pendingCommit.start, pendingCommit.end);
    setPendingCommit(null);
    setSkipWarn5m(false);
  }

  function cancelPending() {
    setPendingCommit(null);
    setSkipWarn5m(false);
    onDateChange();
  }

  if (withDates.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white/95 rounded-xl border border-slate-100 shadow-sm px-3 py-2">
        <div className="flex items-center gap-1">
          {(["Day", "Week", "Month"] as ViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setViewMode(m)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                viewMode === m
                  ? "bg-[#3A97D9] text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {m === "Day" ? t("gantt.day") : m === "Week" ? t("gantt.week") : t("gantt.month")}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-50"
          >
            {showDetails ? t("gantt.hideList") : t("gantt.showList")}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="text-xs font-medium text-[#3A97D9] hover:underline px-2"
          >
            {t("gantt.exportExcel")}
          </button>
        </div>
      </div>

      <div className="gantt-container bg-white/95 rounded-xl border border-slate-100 shadow-sm p-3 overflow-x-auto">
        <div ref={containerRef} className="min-h-[200px]" />
      </div>
      <div className="bg-white/90 rounded-xl border border-slate-100 px-3 py-2">
        <div className="text-[11px] text-slate-500 mb-2">{t("gantt.legendByAssignee")}</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-600">
          {Array.from(
            new Map(
              withDates
                .filter((x) => x.assignee)
                .map((x) => [x.assignee!.id, { name: x.assignee!.name, color: x.assignee!.color ?? UNASSIGNED_BAR_COLOR }])
            ).values()
          ).map((u) => (
            <span key={u.name} className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border border-slate-300" style={{ backgroundColor: u.color }} />
              {u.name}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm border border-slate-300"
              style={{ backgroundColor: UNASSIGNED_BAR_COLOR }}
            />
            {t("gantt.legendUnassigned")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="20" height="8" viewBox="0 0 20 8" className="text-slate-400">
              <line x1="0" y1="4" x2="16" y2="4" stroke="currentColor" strokeWidth="1.5" />
              <polygon points="16,1 20,4 16,7" fill="currentColor" />
            </svg>
            {t("gantt.legendLink")}
          </span>
          <span className="text-slate-400">{t("gantt.legendClickHint")}</span>
        </div>
      </div>

      {showDetails && (
        <div className="bg-white/95 rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-100">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">{t("gantt.tableTask")}</th>
                <th className="text-left px-3 py-2 font-semibold">{t("gantt.tableAssignee")}</th>
                <th className="text-left px-3 py-2 font-semibold">{t("gantt.tableStart")}</th>
                <th className="text-left px-3 py-2 font-semibold">{t("gantt.tableEnd")}</th>
                <th className="text-left px-3 py-2 font-semibold">{t("gantt.tableDeps")}</th>
              </tr>
            </thead>
            <tbody>
              {withDates.map((x) => {
                const isAi = x.isAiGenerated && !x.isValidated;
                const startD = new Date(x.startDate!);
                const endD = new Date(x.endDate!);
                const deps = parseDependencies(x.dependencies)
                  .map((d) => {
                    const target = withDates.find((y) => String(y.id) === d.id);
                    if (!target) return null;
                    const label =
                      d.type === "same" ? (locale === "en" ? "with" : "одновременно") : locale === "en" ? "after" : "после";
                    return `${label} «${target.title}»`;
                  })
                  .filter(Boolean);
                return (
                  <tr key={x.id} className={`border-t border-slate-100 ${isAi ? "bg-amber-50/50" : "bg-white"}`}>
                    <td className="px-3 py-1.5">
                      <span className={isAi ? "font-medium text-amber-900" : "text-slate-800"}>{x.title}</span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">
                      {x.assignee ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-slate-200"
                            style={{ background: x.assignee.color ?? "#93c5fd" }}
                          />
                          {x.assignee.name}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-slate-700 tabular-nums">
                      {formatDate(startD, locale)}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-slate-700 tabular-nums">
                      {formatDate(endD, locale)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">{deps.length ? deps.join("; ") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pendingCommit && (
        <Modal title={t("gantt.dateWarnTitle")} onClose={cancelPending}>
          <p className="text-sm text-slate-600 mb-3">{t("gantt.dateWarnBody")}</p>
          <label className="flex items-center gap-2 text-xs text-slate-600 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={skipWarn5m}
              onChange={(e) => setSkipWarn5m(e.target.checked)}
            />
            {t("gantt.dateWarnSkip")}
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelPending}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              {t("gantt.dateWarnCancel")}
            </button>
            <button
              type="button"
              onClick={confirmPending}
              className="px-3 py-1.5 text-sm bg-[#3A97D9] text-white rounded-lg hover:bg-[#2d87c4]"
            >
              {t("gantt.dateWarnConfirm")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function darkenHex(hexColor: string, amount = 0.18): string {
  const hex = hexColor.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#94a3b8";
  const toChannel = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  const apply = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  const toHex = (v: number) => apply(v).toString(16).padStart(2, "0");
  return `#${toHex(toChannel(0))}${toHex(toChannel(2))}${toHex(toChannel(4))}`;
}

/** Полосы окрашиваются по исполнителю; выходные не подсвечиваем в режиме «День» */
function tintGanttByAssignee(tasks: TaskWithUser[], viewMode: ViewMode) {
  const svg = document.querySelector(".gantt-container svg") as SVGSVGElement | null;
  if (!svg) return;

  svg.querySelectorAll("rect.weekend-col").forEach((n) => n.remove());

  const wrappers = Array.from(svg.querySelectorAll(".bar-wrapper")) as SVGGElement[];
  wrappers.forEach((w) => {
    const id = w.getAttribute("data-id");
    if (!id) return;
    const t = tasks.find((x) => String(x.id) === id);
    if (!t) return;
    const barFill = t.assignee?.color ?? UNASSIGNED_BAR_COLOR;
    const barStroke = darkenHex(barFill, 0.25);
    const bar = w.querySelector("rect.bar") as SVGRectElement | null;
    const prog = w.querySelector("rect.bar-progress") as SVGRectElement | null;
    if (bar) {
      bar.setAttribute("fill", barFill);
      bar.setAttribute("stroke", barStroke);
      bar.setAttribute("stroke-width", "1");
    }
    if (prog) {
      // Make task bars truly single-color: hide inner progress strip.
      prog.setAttribute("fill", barFill);
      prog.setAttribute("opacity", "0");
    }
    w.querySelectorAll(".edge-marker").forEach((n) => n.remove());
  });

  const gridRows = svg.querySelectorAll("rect.grid-row");
  gridRows.forEach((r) => {
    r.setAttribute("fill", "#fafbfc");
  });

  if (viewMode === "Day") {
    svg.querySelectorAll("line.row-line").forEach((line) => {
      line.setAttribute("stroke", "#f0f2f5");
    });
  }
}

function drawTodayLine() {
  const svg = document.querySelector(".gantt-container svg") as SVGSVGElement | null;
  if (!svg) return;

  svg.querySelectorAll("line.today-now-line").forEach((n) => n.remove());
  const todayRect = svg.querySelector("rect.today-highlight") as SVGRectElement | null;
  if (!todayRect) return;

  const x = (parseFloat(todayRect.getAttribute("x") ?? "0") + parseFloat(todayRect.getAttribute("width") ?? "0") / 2).toString();
  const y1 = "0";
  const y2 = (svg.viewBox?.baseVal?.height || svg.getBoundingClientRect().height || 0).toString();
  if (y2 === "0") return;

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("class", "today-now-line");
  line.setAttribute("x1", x);
  line.setAttribute("x2", x);
  line.setAttribute("y1", y1);
  line.setAttribute("y2", y2);
  line.setAttribute("stroke", "#5f88a3");
  line.setAttribute("stroke-width", "1.5");
  line.setAttribute("stroke-dasharray", "4 3");
  line.setAttribute("opacity", "0.95");
  line.setAttribute("pointer-events", "none");
  svg.appendChild(line);
}
