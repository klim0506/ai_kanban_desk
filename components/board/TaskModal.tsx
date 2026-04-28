"use client";

import { useRef, useState } from "react";
import type { TaskWithUser, TaskDependency, DependencyType, TaskArtifact } from "@/types";
import { parseDependencies, stringifyDependencies, parseArtifactsJson, stringifyArtifactsJson } from "@/types";
import { COLUMNS } from "@/lib/constants";
import { NEURON_BLOCKS, DEFAULT_NEURON_BLOCK, type NeuronBlockId } from "@/lib/neuronBlocks";
import Modal from "@/components/ui/Modal";
import { apiFetch } from "@/hooks/useCurrentUser";
import { useLocale } from "@/components/providers/LocaleProvider";
import { readApiError } from "@/lib/apiError";

const MAX_ARTIFACTS = 3;
const MAX_ARTIFACT_BYTES = 500 * 1024 * 1024;

interface Props {
  mode: "create" | "edit";
  task?: TaskWithUser;
  defaultColumn?: string;
  users: { id: number; name: string }[];
  allTasks?: TaskWithUser[];
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type SectionKey = "core" | "plan" | "links";

function randomId() {
  return `a_${Math.random().toString(36).slice(2, 10)}`;
}

export default function TaskModal({
  mode,
  task,
  defaultColumn,
  users,
  allTasks,
  isAdmin,
  onClose,
  onSaved,
}: Props) {
  const { t } = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [column, setColumn] = useState(task?.column ?? defaultColumn ?? "SPRINT_BACKLOG");
  const [neuronBlock, setNeuronBlock] = useState<NeuronBlockId>(
    (task?.neuronBlock as NeuronBlockId) ?? DEFAULT_NEURON_BLOCK
  );
  const [artifacts, setArtifacts] = useState<TaskArtifact[]>(() =>
    parseArtifactsJson((task as { artifacts?: string | null })?.artifacts ?? null)
  );
  const [assigneeId, setAssigneeId] = useState<string>(task?.assigneeId?.toString() ?? "");
  const [startDate, setStartDate] = useState(
    task?.startDate ? new Date(task.startDate).toISOString().split("T")[0] : ""
  );
  const [endDate, setEndDate] = useState(
    task?.endDate ? new Date(task.endDate).toISOString().split("T")[0] : ""
  );
  const [noDeadline, setNoDeadline] = useState(!task?.startDate && !task?.endDate);
  const [priority, setPriority] = useState<number>(task?.priority ?? 2);
  const [difficulty, setDifficulty] = useState<number>(task?.difficulty ?? 2);
  const [deps, setDeps] = useState<TaskDependency[]>(
    parseDependencies(task?.dependencies ?? null)
  );
  const [addingDep, setAddingDep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    core: true,
    plan: mode === "create",
    links: false,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dependencyOptions = (allTasks ?? []).filter(
    (x) => x.id !== task?.id && !deps.some((d) => d.id === String(x.id))
  );

  function addDependency(id: string, type: DependencyType) {
    setDeps((prev) => [...prev, { id, type }]);
    setAddingDep(false);
  }
  function removeDep(id: string) {
    setDeps((prev) => prev.filter((d) => d.id !== id));
  }
  function updateDepType(id: string, type: DependencyType) {
    setDeps((prev) => prev.map((d) => (d.id === id ? { ...d, type } : d)));
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const next = [...artifacts];
    for (let i = 0; i < files.length && next.length < MAX_ARTIFACTS; i++) {
      const f = files[i];
      if (f.size > MAX_ARTIFACT_BYTES) {
        setError(`${f.name}: слишком большой файл`);
        continue;
      }
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(new Error("read"));
        r.readAsDataURL(f);
      });
      next.push({
        id: randomId(),
        name: f.name,
        mimeType: f.type || "application/octet-stream",
        dataUrl,
      });
    }
    setArtifacts(next.slice(0, MAX_ARTIFACTS));
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeArtifact(id: string) {
    setArtifacts((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      column,
      neuronBlock,
      artifacts: stringifyArtifactsJson(artifacts),
      assigneeId: assigneeId ? parseInt(assigneeId) : null,
      dependencies: stringifyDependencies(deps),
      priority,
      difficulty,
    };
    if (isAdmin || mode === "create") {
      body.startDate = startDate || null;
      body.endDate = endDate || null;
    }

    try {
      const res =
        mode === "create"
          ? await apiFetch("/api/tasks", { method: "POST", body: JSON.stringify(body) })
          : await apiFetch(`/api/tasks/${task!.id}`, {
              method: "PATCH",
              body: JSON.stringify(body),
            });
      if (!res.ok) {
        setError(await readApiError(res, t("errors.saveFailed")));
        setSaving(false);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError(t("ai.errorNetwork"));
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    const del = await apiFetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (!del.ok) {
      setError(await readApiError(del, t("errors.adminDelete")));
      setConfirmDelete(false);
      return;
    }
    onSaved();
    onClose();
  }

  const dateLocked = !isAdmin && mode === "edit";
  const datesDisabled = dateLocked || noDeadline;

  const coreBlocks = NEURON_BLOCKS.filter((b) => b.group === "core");
  const svcBlocks = NEURON_BLOCKS.filter((b) => b.group === "services");
  const sectionLabel: Record<SectionKey, string> = {
    core: t("task.sectionCore"),
    plan: t("task.sectionPlan"),
    links: t("task.sectionLinks"),
  };

  function toggleSection(section: SectionKey) {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  return (
    <Modal
      onClose={onClose}
      title={mode === "create" ? t("task.new") : t("task.edit")}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <section className="rounded-xl border border-slate-200/80 overflow-hidden">
          <button
            type="button"
            className="w-full px-3 py-2 flex items-center justify-between bg-slate-50/80 text-left"
            onClick={() => toggleSection("core")}
          >
            <span className="text-xs font-semibold text-slate-700">{sectionLabel.core}</span>
            <span className="text-xs text-slate-400">{openSections.core ? "▲" : "▼"}</span>
          </button>
          {openSections.core && (
            <div className="p-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t("task.title")} *</label>
                <input
                  autoFocus
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/40 bg-white"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("task.titlePh")}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t("task.description")}</label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/40 resize-none bg-white"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("task.descriptionPh")}
                />
                <div className="mt-1.5">
                  <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-xs text-[#3A97D9] hover:underline"
                  >
                    {t("task.artifactsAdd")}
                  </button>
                  <span className="text-[10px] text-slate-400 ml-2">{t("task.artifactsHint")}</span>
                  {artifacts.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {artifacts.map((a) => (
                        <li key={a.id} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-2 py-1">
                          {a.mimeType.startsWith("image/") && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.dataUrl} alt="" className="h-7 w-7 object-cover rounded border shrink-0" />
                          )}
                          <a
                            href={a.dataUrl}
                            download={a.name}
                            className="truncate flex-1 hover:underline hover:text-[#3A97D9]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {a.name}
                          </a>
                          <button type="button" onClick={() => removeArtifact(a.id)} className="text-red-400 hover:text-red-600 shrink-0">
                            {t("task.artifactsRemove")}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t("task.neuronBlock")}</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/40 bg-white"
                  value={neuronBlock}
                  onChange={(e) => setNeuronBlock(e.target.value as NeuronBlockId)}
                >
                  <optgroup label={t("neuron.groupCore")}>
                    {coreBlocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {t(`neuron.${b.id}`)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t("neuron.groupServices")}>
                    {svcBlocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {t(`neuron.${b.id}`)}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t("task.column")}</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/40 bg-white"
                    value={column}
                    onChange={(e) => setColumn(e.target.value)}
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {t(`columns.${c.id}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t("task.assignee")}</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/40 bg-white"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                  >
                    <option value="">{t("task.assigneeNone")}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200/80 overflow-hidden">
          <button
            type="button"
            className="w-full px-3 py-2 flex items-center justify-between bg-slate-50/80 text-left"
            onClick={() => toggleSection("plan")}
          >
            <span className="text-xs font-semibold text-slate-700">{sectionLabel.plan}</span>
            <span className="text-xs text-slate-400">{openSections.plan ? "▲" : "▼"}</span>
          </button>
          {openSections.plan && (
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t("task.priority")}</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/40 bg-white"
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value))}
                  >
                    {[1, 2, 3, 4].map((p) => (
                      <option key={p} value={p}>
                        P{p} — {t(`priorities.${p}` as "priorities.1")}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t("task.difficulty")}</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/40 bg-white"
                    value={difficulty}
                    onChange={(e) => setDifficulty(parseInt(e.target.value))}
                  >
                    {[1, 2, 3, 4].map((d) => (
                      <option key={d} value={d}>
                        D{d} — {t(`difficulties.${d}` as "difficulties.1")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noDeadline}
                  disabled={dateLocked}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setNoDeadline(checked);
                    if (checked) {
                      setStartDate("");
                      setEndDate("");
                    }
                  }}
                />
                {t("task.noDeadline")}
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    {t("task.start")} {dateLocked && <span className="text-slate-400">{t("task.adminOnly")}</span>}
                  </label>
                  <input
                    type="date"
                    disabled={datesDisabled}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/40 disabled:bg-slate-50"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (e.target.value) setNoDeadline(false);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    {t("task.end")} {dateLocked && <span className="text-slate-400">{t("task.adminOnly")}</span>}
                  </label>
                  <input
                    type="date"
                    disabled={datesDisabled}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/40 disabled:bg-slate-50"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      if (e.target.value) setNoDeadline(false);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200/80 overflow-hidden">
          <button
            type="button"
            className="w-full px-3 py-2 flex items-center justify-between bg-slate-50/80 text-left"
            onClick={() => toggleSection("links")}
          >
            <span className="text-xs font-semibold text-slate-700">{sectionLabel.links}</span>
            <span className="text-xs text-slate-400">{openSections.links ? "▲" : "▼"}</span>
          </button>
          {openSections.links && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-500">{t("task.deps")}</label>
                {dependencyOptions.length > 0 && !addingDep && (
                  <button
                    type="button"
                    onClick={() => setAddingDep(true)}
                    className="text-xs text-[#3A97D9] hover:underline"
                  >
                    {t("task.depsAdd")}
                  </button>
                )}
              </div>
              {deps.length === 0 && !addingDep && (
                <p className="text-xs text-slate-400">{t("task.depsNone")}</p>
              )}
              {deps.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm">
                  {deps.map((d) => {
                    const depTask = (allTasks ?? []).find((x) => String(x.id) === d.id);
                    return (
                      <li key={d.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1">
                        <select
                          value={d.type}
                          onChange={(e) => updateDepType(d.id, e.target.value as DependencyType)}
                          className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-white"
                        >
                          <option value="after">{t("task.depAfter")}</option>
                          <option value="same">{t("task.depSame")}</option>
                        </select>
                        <span className="flex-1 truncate text-xs">{depTask?.title ?? `#${d.id}`}</span>
                        <button
                          type="button"
                          onClick={() => removeDep(d.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {addingDep && (
                <div className="mt-2 flex gap-2 items-center">
                  <select
                    className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) addDependency(e.target.value, "after");
                    }}
                  >
                    <option value="" disabled>
                      {t("task.depPick")}
                    </option>
                    {dependencyOptions.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.title}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setAddingDep(false)} className="text-xs text-slate-500">
                    {t("task.cancel")}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>


        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-between pt-1">
          {mode === "edit" ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{t("task.delete")}?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  {t("task.delete")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs px-2 py-1 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  {t("task.cancel")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                {t("task.delete")}
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              {t("task.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-sm bg-[#3A97D9] text-white rounded-lg hover:bg-[#2d87c4] disabled:opacity-50"
            >
              {saving ? t("task.saving") : mode === "create" ? t("task.create") : t("task.save")}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
