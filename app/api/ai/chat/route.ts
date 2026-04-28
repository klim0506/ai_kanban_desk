import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getYandex, yandexModel } from "@/lib/yandex";
import { z } from "zod";
import { translate } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/dictionaries";
import { requireAuth } from "@/lib/auth";

const BodySchema = z.object({
  text: z.string().min(1),
  locale: z.enum(["ru", "en", "es", "de", "fr", "zh", "pt"]).optional().default("ru"),
});

function summarizeTasksForPrompt(
  tasks: Awaited<ReturnType<typeof prisma.task.findMany>>,
  locale: Locale
): string {
  const byCol: Record<string, typeof tasks> = {};
  for (const t of tasks) {
    byCol[t.column] ??= [];
    byCol[t.column].push(t);
  }
  const lines: string[] = [];
  const L = (id: string) => translate(locale, `columns.${id}`) || id;
  for (const col of Object.keys(byCol)) {
    lines.push(`## ${L(col)}`);
    for (const t of byCol[col]) {
      const sd = t.startDate ? t.startDate.toISOString().slice(0, 10) : "—";
      const ed = t.endDate ? t.endDate.toISOString().slice(0, 10) : "—";
      const nb = (t as { neuronBlock?: string }).neuronBlock ?? "";
      lines.push(
        `- #${t.id} ${t.title} (${locale === "ru" ? "исполнитель" : "assignee"}: ${t.assigneeId ?? "—"}, ${locale === "ru" ? "сроки" : "dates"}: ${sd}…${ed}, neuron: ${nb})`
      );
    }
  }
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const { text, locale } = BodySchema.parse(body);

    const tasks = await prisma.task.findMany({
      include: { assignee: true },
      orderBy: [{ column: "asc" }, { order: "asc" }],
    });

    const summary = summarizeTasksForPrompt(tasks, locale);

    const system =
      locale === "ru"
        ? `Ты ассистент по проекту «Канбан Нейрона». У тебя есть снимок задач (колонки канбана, исполнители, даты, блок Нейрона). Отвечай кратко и по делу на русском. Не предлагай создавать задачи, если пользователь явно не просит. Не выдумывай задач, которых нет в списке.

Данные:
${summary}`
        : `You are an assistant for the "Neuron Kanban" project. You have a snapshot of tasks (columns, assignees, dates, neuron block). Answer concisely in English. Do not invent tasks that are not in the list.

Data:
${summary}`;

    const response = await getYandex().chat.completions.create({
      model: yandexModel(),
      max_tokens: 2048,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
    });

    const reply = (response.choices[0]?.message?.content ?? "").trim();
    if (!reply) {
      return NextResponse.json({ error: "Empty model response" }, { status: 422 });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[ai/chat]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}
