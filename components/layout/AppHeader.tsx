"use client";

import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";
import UserPicker from "@/components/ui/UserPicker";
import type { UserPublic } from "@/types";
import type { Locale } from "@/lib/i18n/dictionaries";

type Nav = "board" | "gantt" | "todo";

interface Props {
  active: Nav;
  users: UserPublic[];
  currentUserId: number | null;
  onUserChange: (id: number | null) => void;
  extraRight?: React.ReactNode;
}

const LANGUAGE_OPTIONS = [
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "de", label: "DE" },
  { code: "fr", label: "FR" },
  { code: "zh", label: "ZH" },
  { code: "pt", label: "PT" },
] as const;

export default function AppHeader({
  active,
  users,
  currentUserId,
  onUserChange,
  extraRight,
}: Props) {
  const { locale, setLocale, t } = useLocale();

  return (
    <header className="flex items-center px-3 py-2 bg-white/95 border-b border-slate-100 shadow-sm shrink-0 gap-3">
      <h1 className="font-semibold text-base sm:text-lg tracking-tight text-slate-800 shrink-0">
        {t("appTitle")}
      </h1>
      <nav className="flex-1 min-w-0 flex justify-center gap-4 text-sm whitespace-nowrap">
        <Link
          href="/board"
          className={
            active === "board"
              ? "font-semibold text-[#3A97D9] border-b-2 border-[#3A97D9] pb-0.5"
              : "text-slate-500 hover:text-slate-800 pb-0.5"
          }
        >
          {t("nav.board")}
        </Link>
        <Link
          href="/gantt"
          className={
            active === "gantt"
              ? "font-semibold text-[#3A97D9] border-b-2 border-[#3A97D9] pb-0.5"
              : "text-slate-500 hover:text-slate-800 pb-0.5"
          }
        >
          {t("nav.gantt")}
        </Link>
        <Link
          href="/todo"
          className={
            active === "todo"
              ? "font-semibold text-[#3A97D9] border-b-2 border-[#3A97D9] pb-0.5"
              : "text-slate-500 hover:text-slate-800 pb-0.5"
          }
        >
          {t("nav.todo")}
        </Link>
      </nav>
      <div className="flex items-center gap-2 shrink-0">
        <label className="sr-only" htmlFor="app-lang-select">
          {t("lang.label")}
        </label>
        <select
          id="app-lang-select"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3A97D9]/30"
          aria-label={t("lang.label")}
        >
          {LANGUAGE_OPTIONS.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
        <UserPicker users={users} currentUserId={currentUserId} onChange={onUserChange} />
        {extraRight}
      </div>
    </header>
  );
}
