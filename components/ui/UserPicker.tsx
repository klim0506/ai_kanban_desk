"use client";

import { useEffect, useRef, useState } from "react";
import type { UserPublic } from "@/types";
import { useLocale } from "@/components/providers/LocaleProvider";
import { apiFetch, getDeviceId, setAuthToken } from "@/hooks/useCurrentUser";
import { useRouter } from "next/navigation";

interface Props {
  users: UserPublic[];
  currentUserId: number | null;
  onChange: (id: number | null) => void;
}

export default function UserPicker({ users, currentUserId, onChange }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = users.find((u) => u.id === currentUserId);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!login.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ login: login.trim(), password, deviceId: getDeviceId() }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 403) {
          setError(t("userPicker.deviceLinked"));
        } else if (typeof payload.error === "string" && payload.error.trim()) {
          setError(payload.error);
        } else {
          setError(t("userPicker.invalidCredentials"));
        }
        return;
      }
      const payload = (await res.json()) as { token: string; user: UserPublic };
      setAuthToken(payload.token);
      const user = payload.user;
      onChange(user.id);
      setLogin("");
      setPassword("");
      setOpen(false);
    } catch {
      setError(t("userPicker.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50"
      >
        {current ? (
          <>
            <span
              className="w-4 h-4 rounded-full border"
              style={{ background: current.color }}
            />
            <span>{current.name}</span>
            <span
              className={`text-[10px] px-1 rounded ${
                current.role === "admin"
                  ? "bg-sky-100 text-sky-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {current.role}
            </span>
          </>
        ) : <span className="text-slate-400">{t("userPicker.pickSelf")}</span>}
        <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-md shadow-lg py-1 min-w-[200px]">
          {currentUserId == null ? (
            <form onSubmit={handleLogin} className="px-3 py-2 flex flex-col gap-2">
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder={t("userPicker.login")}
                className="border border-slate-200 rounded px-2 py-1 text-xs"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("userPicker.password")}
                type="password"
                className="border border-slate-200 rounded px-2 py-1 text-xs"
              />
              {error && <div className="text-[11px] text-red-500">{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="bg-[#3A97D9] text-white text-xs rounded px-2 py-1 disabled:opacity-50"
              >
                {loading ? t("loading") : t("userPicker.loginBtn")}
              </button>
            </form>
          ) : (
            <>
              <div className="my-1 border-t" />
              <button
                type="button"
                onClick={() => {
                  setAuthToken(null);
                  onChange(null);
                  setOpen(false);
                  router.replace("/login");
                }}
                className="block w-full px-3 py-2 text-xs text-left text-slate-500 hover:bg-slate-50"
              >
                {t("userPicker.logout")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
