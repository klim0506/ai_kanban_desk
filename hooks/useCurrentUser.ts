"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { UserPublic } from "@/types";

const STORAGE_KEY = "kanban.currentUserId";
const AUTH_TOKEN_KEY = "kanban.authToken";
const DEVICE_KEY = "kanban.deviceId";

export function useCurrentUser(users: UserPublic[]) {
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const n = parseInt(raw);
      if (!isNaN(n)) setCurrentUserId(n);
    }
  }, []);

  // Keep state in sync if current user id appears in storage later
  // (e.g. restored from /api/auth/me in auth bootstrap).
  useEffect(() => {
    if (currentUserId != null) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const n = parseInt(raw, 10);
    if (!isNaN(n)) setCurrentUserId(n);
  }, [currentUserId, users.length]);

  // Reset if user disappeared
  useEffect(() => {
    if (currentUserId != null && !users.find((u) => u.id === currentUserId)) {
      setCurrentUserId(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [users, currentUserId]);

  const setUser = useCallback((id: number | null) => {
    setCurrentUserId(id);
    if (id == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  }, []);

  const currentUser = users.find((u) => u.id === currentUserId) ?? null;
  const isAdmin = currentUser?.role === "admin";

  return { currentUser, currentUserId, setUser, isAdmin };
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;

  // Some embedded/webview contexts may not expose crypto.randomUUID.
  const randomUuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : null;
  const next =
    randomUuid ??
    `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  localStorage.setItem(DEVICE_KEY, next);
  return next;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) localStorage.removeItem(AUTH_TOKEN_KEY);
  else localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function useAuthSession() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  const checkAuth = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setAuthenticated(false);
      setReady(true);
      return false;
    }
    const res = await apiFetch("/api/auth/me");
    const ok = res.ok;
    if (ok) {
      try {
        const data = (await res.json()) as { user?: { id?: number } };
        const authUserId = data?.user?.id;
        const stored = localStorage.getItem(STORAGE_KEY);
        if (typeof authUserId === "number" && !stored) {
          localStorage.setItem(STORAGE_KEY, String(authUserId));
        }
      } catch {
        // Ignore parse issues: auth status is already known from HTTP status.
      }
    }
    setAuthenticated(ok);
    setReady(true);
    return ok;
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  return { ready, authenticated, checkAuth };
}

export function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, authenticated, checkAuth } = useAuthSession();

  useEffect(() => {
    if (ready && !authenticated) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [ready, authenticated, router, pathname]);

  return { ready, authenticated, checkAuth };
}

/** Global helper: attach x-actor-id header to fetch. */
export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  const token = typeof window !== "undefined" ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
  const headers = new Headers(init.headers);
  if (raw) headers.set("x-actor-id", raw);
  if (token) headers.set("x-auth-token", token);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(input, { ...init, headers });
}
