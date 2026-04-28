export function extractApiError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const raw = (payload as { error?: unknown }).error;
  if (typeof raw === "string" && raw.trim()) return raw;
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0] as unknown;
    if (typeof first === "string" && first.trim()) return first;
    if (first && typeof first === "object") {
      const msg = (first as { message?: unknown }).message;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
  }
  if (raw && typeof raw === "object") {
    const msg = (raw as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

export async function readApiError(res: Response, fallback: string): Promise<string> {
  const payload = await res.json().catch(() => null);
  return extractApiError(payload, fallback);
}
