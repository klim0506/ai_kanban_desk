"use client";

import type { ReactNode } from "react";

interface Props {
  content: ReactNode;
  children: ReactNode;
}

export default function Tooltip({ content, children }: Props) {
  return (
    <span className="relative inline-flex group/tt">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-lg opacity-0 translate-y-1 transition-all duration-150 group-hover/tt:opacity-100 group-hover/tt:translate-y-0 group-focus-within/tt:opacity-100 group-focus-within/tt:translate-y-0"
      >
        {content}
      </span>
    </span>
  );
}
