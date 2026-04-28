"use client";

import { useState } from "react";
import Modal from "./Modal";
import { TEAM_COLORS } from "@/lib/constants";
import type { UserPublic } from "@/types";
import { apiFetch } from "@/hooks/useCurrentUser";
import { useLocale } from "@/components/providers/LocaleProvider";
import { readApiError } from "@/lib/apiError";
import Tooltip from "@/components/ui/Tooltip";

interface Props {
  users: UserPublic[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ManageUsersModal({ users, onClose, onSaved }: Props) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [color, setColor] = useState<string>(
    TEAM_COLORS.find((c) => !users.some((u) => u.color === c)) ?? TEAM_COLORS[0]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          login: login.trim(),
          password,
          role,
          color,
        }),
      });
      if (!res.ok) {
        setError(await readApiError(res, t("errors.saveFailed")));
        return;
      }
      setName("");
      setLogin("");
      setPassword("");
      setRole("user");
      setShowAdd(false);
      onSaved();
    } catch {
      setError(t("errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: number, patch: Partial<UserPublic>) {
    const res = await apiFetch(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (res.ok) onSaved();
    else setError(await readApiError(res, t("errors.saveFailed")));
  }

  async function handleDelete(id: number) {
    if (!confirm(t("teamModal.deleteConfirm"))) return;
    const res = await apiFetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) onSaved();
    else setError(await readApiError(res, t("errors.saveFailed")));
  }

  return (
    <Modal title={t("team")} onClose={onClose}>
      <div className="mb-4">
        <p className="text-xs text-slate-500 mb-2">{t("teamModal.members")}</p>
        {users.length === 0 ? (
          <p className="text-sm text-slate-400">{t("teamModal.noMembers")}</p>
        ) : (
          <ul className="divide-y text-sm border border-slate-100 rounded-lg px-2">
            {users.map((u) => (
              <li key={u.id} className="py-2 flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-full border shrink-0"
                  style={{ background: u.color }}
                />
                <span className="flex-1">
                  <span className="block">{u.name}</span>
                  <span className="block text-[11px] text-slate-400">{u.login}</span>
                </span>
                <Tooltip content={t("teamModal.role")}>
                  <select
                    value={u.role}
                    onChange={(e) => handleUpdate(u.id, { role: e.target.value as "admin" | "user" })}
                    className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-white"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </Tooltip>
                <ColorPicker
                  value={u.color}
                  onChange={(c) => handleUpdate(u.id, { color: c })}
                />
                <Tooltip content={t("teamModal.remove")}>
                  <button
                    type="button"
                    onClick={() => handleDelete(u.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </Tooltip>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t pt-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-600">{t("teamModal.addMember")}</p>
          <Tooltip content={t("teamModal.showAdd")}>
            <button
              type="button"
              onClick={() => setShowAdd((prev) => !prev)}
              className="w-7 h-7 rounded-full bg-[#3A97D9] text-white text-lg leading-none"
            >
              +
            </button>
          </Tooltip>
        </div>
        {showAdd && (
          <form onSubmit={handleAdd} className="mt-3 flex flex-col gap-2">
            <input
              className="border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/40"
              placeholder={t("teamModal.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/40"
              placeholder={t("teamModal.login")}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
            <input
              className="border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/40"
              placeholder={t("teamModal.password")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600">{t("teamModal.role")}:</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "user")}
                className="text-sm border border-slate-200 rounded px-2 py-1"
              >
                <option value="user">{t("teamModal.roleUser")}</option>
                <option value="admin">{t("teamModal.roleAdmin")}</option>
              </select>
              <span className="text-xs text-slate-400">{t("teamModal.adminHint")}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600">{t("teamModal.color")}:</label>
              <div className="flex gap-1 flex-wrap">
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full border-2 ${
                      color === c ? "border-slate-700" : "border-transparent"
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="bg-[#3A97D9] text-white text-sm rounded py-1.5 hover:bg-[#2d87c4] disabled:opacity-50 mt-1"
            >
              {saving ? t("teamModal.adding") : t("teamModal.add")}
            </button>
          </form>
        )}
        {!showAdd && error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    </Modal>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const { t } = useLocale();
  return (
    <div className="relative">
      <Tooltip content={t("teamModal.color")}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-6 h-6 rounded-full border border-slate-200"
          style={{ background: value }}
        />
      </Tooltip>
      {open && (
        <div className="absolute right-0 mt-1 z-10 bg-white rounded-md shadow-lg border p-2 flex flex-wrap gap-1 w-40">
          {TEAM_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={`w-5 h-5 rounded-full border-2 ${
                value === c ? "border-gray-700" : "border-gray-200"
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
