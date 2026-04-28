"use client";

import { useEffect, useRef, useState } from "react";
import { useSpeechInput } from "@/hooks/useSpeechInput";
import AiTaskPreview from "./AiTaskPreview";
import type { ParsedTask } from "@/types";
import { useLocale } from "@/components/providers/LocaleProvider";
import Tooltip from "@/components/ui/Tooltip";

type AiMode = "board" | "chat";
type ChatMessageRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  text: string;
}

interface Props {
  users: { id: number; name: string }[];
  onTaskCreated: () => void;
  mode: AiMode;
}

export default function AiInput({ users, onTaskCreated, mode }: Props) {
  const { t, locale } = useLocale();
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedTask[] | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const { isSupported, isListening, transcript, startListening, stopListening, reset } =
    useSpeechInput();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const displayText = isListening ? text + (transcript ? " " + transcript : "") : text;

  useEffect(() => {
    if (mode === "chat") setPreview(null);
  }, [mode]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const styles = window.getComputedStyle(el);
    const lineHeight = parseFloat(styles.lineHeight) || 20;
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    const paddingBottom = parseFloat(styles.paddingBottom) || 0;
    const borderTop = parseFloat(styles.borderTopWidth) || 0;
    const borderBottom = parseFloat(styles.borderBottomWidth) || 0;

    const minHeight = 58; // keep same height as action button initially
    const maxHeight = lineHeight * 5 + paddingTop + paddingBottom + borderTop + borderBottom;

    el.style.height = "auto";
    const nextHeight = Math.max(minHeight, Math.min(el.scrollHeight, maxHeight));
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [displayText, mode]);

  function handleMic() {
    if (isListening) {
      stopListening();
      if (transcript) setText((prev) => (prev ? prev + " " + transcript : transcript));
      reset();
    } else {
      reset();
      startListening();
    }
  }

  async function handleParseBoard() {
    const input = displayText.trim();
    if (!input) return;
    setParsing(true);
    setError(null);

    try {
      const { apiFetch } = await import("@/hooks/useCurrentUser");
      const res = await apiFetch("/api/ai/parse", {
        method: "POST",
        body: JSON.stringify({ text: input, locale }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? t("ai.errorParse"));
        return;
      }

      const data: { tasks: ParsedTask[] } = await res.json();
      if (!data.tasks || data.tasks.length === 0) {
        setError(t("ai.noTasks"));
        return;
      }
      setPreview(data.tasks);
    } catch {
      setError(t("ai.errorNetwork"));
    } finally {
      setParsing(false);
    }
  }

  async function handleChatSend() {
    const input = displayText.trim();
    if (!input) return;
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: input,
    };
    setParsing(true);
    setError(null);
    setChatHistory((prev) => [...prev, userMessage]);
    try {
      const { apiFetch } = await import("@/hooks/useCurrentUser");
      const res = await apiFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ text: input, locale }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data.error as string) ?? t("ai.errorNetwork"));
        return;
      }
      const data: { reply: string } = await res.json();
      setChatHistory((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: data.reply,
        },
      ]);
      setText("");
      reset();
    } catch {
      setError(t("ai.errorNetwork"));
    } finally {
      setParsing(false);
    }
  }

  function handleConfirmed() {
    setPreview(null);
    setText("");
    reset();
    onTaskCreated();
  }

  function handleResetChat() {
    setChatHistory([]);
    setError(null);
  }

  return (
    <>
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/30 resize-none pr-10 bg-white shadow-sm"
            rows={1}
            placeholder={mode === "board" ? t("ai.placeholderBoard") : t("ai.placeholderChat")}
            value={displayText}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                if (mode === "board") handleParseBoard();
                else handleChatSend();
              }
            }}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            {mode === "chat" && (
              <Tooltip content={t("ai.chatRefresh")}>
                <button
                  type="button"
                  onClick={handleResetChat}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h5M20 20v-5h-5M5.64 18.36A9 9 0 102.34 9M18.36 5.64A9 9 0 0121.66 15"
                    />
                  </svg>
                </button>
              </Tooltip>
            )}
            {isSupported && (
              <Tooltip content={isListening ? t("ai.micStop") : t("ai.micStart")}>
                <button
                  type="button"
                  onClick={handleMic}
                  className={`p-1 rounded-full transition-colors ${
                    isListening
                      ? "bg-red-100 text-red-600 animate-pulse"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {mode === "board" ? (
          <button
            type="button"
            onClick={handleParseBoard}
            disabled={parsing || !displayText.trim()}
            className="w-[140px] px-4 py-2 bg-[#3A97D9] text-white text-sm rounded-xl hover:bg-[#2d87c4] disabled:opacity-40 whitespace-nowrap h-[58px] flex items-center justify-center gap-1.5 shadow-sm"
          >
            {parsing ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {t("ai.parsing")}
              </>
            ) : (
              t("ai.parse")
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleChatSend}
            disabled={parsing || !displayText.trim()}
            className="w-[140px] px-4 py-2 bg-[#3A97D9] text-white text-sm rounded-xl hover:bg-[#2d87c4] disabled:opacity-40 whitespace-nowrap h-[58px] flex items-center justify-center gap-1.5 shadow-sm"
          >
            {parsing ? t("ai.chatting") : t("ai.sendChat")}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      {mode === "chat" && chatHistory.length > 0 && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700 shadow-sm max-h-52 overflow-y-auto space-y-2">
          {chatHistory.map((message) => (
            <div key={message.id}>
              <span className="text-[10px] font-semibold text-[#3A97D9]">
                {message.role === "assistant" ? t("ai.chatAssistant") : t("ai.chatYou")}
              </span>
              <p className="mt-1 whitespace-pre-wrap">{message.text}</p>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <AiTaskPreview parsed={preview} users={users} onClose={() => setPreview(null)} onConfirmed={handleConfirmed} />
      )}
    </>
  );
}
