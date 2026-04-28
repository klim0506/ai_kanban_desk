"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, getDeviceId, setAuthToken, getAuthToken } from "@/hooks/useCurrentUser";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("from") ?? "/board";

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Already logged in → redirect
  useEffect(() => {
    const token = getAuthToken();
    if (!token) { setLoading(false); return; }
    apiFetch("/api/auth/me").then((res) => {
      if (res.ok) router.replace(returnTo);
      else setLoading(false);
    });
  }, [router, returnTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!login.trim() || !password.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ login: login.trim(), password, deviceId: getDeviceId() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(res.status === 403 ? "Устройство привязано к другому аккаунту" : (data.error ?? "Неверный логин или пароль"));
        setLoading(false);
        return;
      }
      const { token, user } = await res.json() as { token: string; user: { id: number } };
      setAuthToken(token);
      localStorage.setItem("kanban.currentUserId", String(user.id));
      router.replace(returnTo);
    } catch {
      setError("Ошибка сети");
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f6f9fc]">
        <span className="text-slate-400 text-sm">Загрузка...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-[#f6f9fc]">
      <div className="bg-white border border-slate-100 rounded-2xl shadow-lg px-8 py-10 w-full max-w-sm">
        <h1 className="text-xl font-semibold text-slate-800 mb-1">Канбан Нейрона</h1>
        <p className="text-sm text-slate-400 mb-6">Войдите, чтобы продолжить</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            autoFocus
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Логин"
            className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/30"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/30"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 bg-[#3A97D9] text-white rounded-xl py-2.5 text-sm font-medium hover:bg-[#2d87c4] disabled:opacity-50"
          >
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}
