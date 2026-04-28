import type { Metadata } from "next";
import "./globals.css";
import { LocaleProvider } from "@/components/providers/LocaleProvider";

export const metadata: Metadata = {
  title: "Neuron Kanban",
  description: "Neuron Kanban — board, Gantt, AI, Telegram",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="bg-[#f4f7fb] text-slate-900 antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
