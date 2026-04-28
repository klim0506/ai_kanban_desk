import { NextRequest, NextResponse } from "next/server";
import { getYandex, yandexModel } from "@/lib/yandex";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { normalizeColumnId } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

const RequestSchema = z.object({ text: z.string().min(1) });
const CYRILLIC_RE = /[А-Яа-яЁё]/;
const LATIN_RE = /[A-Za-z]/;

function buildSystemPrompt(today: string): string {
  return `Ты — менеджер проекта. Разбиваешь любой текст на задачи и заполняешь ВСЕ поля. Отвечай ТОЛЬКО JSON-массивом без пояснений и без markdown.

## Разбивка текста на задачи
- Каждый пункт списка, каждое дело через "и" / запятую / "потом" / "после" / "затем" — отдельная задача.
- Если одна большая работа без перечисления — одна задача.
- "Разработать и протестировать" в одной фразе → ОДНА задача (DEV). Отдельный тикет тестирования — только если явно выделено ("написать автотесты", "QA-сессия", "регресс").
- Без ограничений по количеству задач — создавай столько, сколько реально в тексте.

## Поля (все обязательны, null ЗАПРЕЩЁН для column/neuronBlock/priority/difficulty)

**column** — всегда заполняй по смыслу:
- SPRINT_BACKLOG — задача ещё не взята в работу, планируется
- DEV — любая разработка: продуктовая и техническая (UI, бизнес-логика, рефакторинг, архитектура, API, БД)
- TESTING — тесты, QA, баг-проверка
- GLOBAL_BACKLOG — идея без срока, "когда-нибудь"
- Если неясно → SPRINT_BACKLOG

**neuronBlock** — к какой части продукта "Нейрон" относится задача. Выбирай всегда:
- CHAT — чат, диалог, сообщения, LLM-интерфейс
- AGENT_SYSTEM — агенты, оркестрация, цепочки задач, RAG
- FUNCTIONS — инструменты, функции, плагины, интеграции
- DOCUMENTS — документы, файлы, OCR, выгрузки
- SVC_SPEECHWRITING — спичрайтинг, тексты, копирайтинг
- SVC_TASK_GENERATOR — генератор поручений, задачи
- SVC_ORG_TASKS — организационные задачи, планерки, координация
- SVC_LEGAL_CONTROL — правовой контроль, юридические проверки
- SVC_PROCESS_ANALYSIS — анализ процессов, материалы дел
- SVC_REJUS_STRIP — Режус-триптикус
- Если не ясно к какому сервису → CHAT

**priority** — всегда заполняй:
- 1 — критичный баг или срочно/блокер
- 2 — важная доработка (дефолт)
- 3 — nice-to-have, улучшение
- 4 — сделаем потом, идея без срока

**difficulty** — всегда заполняй:
- 1 — fast-таска (минуты, мелкая правка)
- 2 — пара часов
- 3 — пара дней
- 4 — исследование, нужна декомпозиция

**title** — краткое название задачи (до 80 символов), ОБЯЗАТЕЛЬНО НА РУССКОМ. Не используй английские слова в title; если исходник на английском — переведи title на русский.
**description** — детали, контекст, что именно сделать (или null если нечего добавить)
**assigneeName** — имя исполнителя если упомянут, иначе null
**startDate / endDate** — YYYY-MM-DD или null. Сегодня: ${today}. Если задачи идут последовательно — endDate предыдущей = startDate следующей.

## Формат ответа
[{"title":"...","description":"..."|null,"assigneeName":"..."|null,"startDate":"YYYY-MM-DD"|null,"endDate":"YYYY-MM-DD"|null,"column":"...","priority":1|2|3|4,"difficulty":1|2|3|4,"neuronBlock":"..."}]

Ответ — ТОЛЬКО JSON-массив. Никакого текста вокруг.`;
}

function cleanupJsonFence(raw: string): string {
  return raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
}

function titleNeedsRuFix(title: unknown): boolean {
  if (typeof title !== "string") return false;
  return LATIN_RE.test(title) || !CYRILLIC_RE.test(title);
}

function normalizeParsedColumns(tasks: unknown[]): unknown[] {
  return tasks.map((task) => {
    if (!task || typeof task !== "object") return task;
    const next = { ...(task as Record<string, unknown>) };
    if (typeof next.column === "string") {
      next.column = normalizeColumnId(next.column);
    }
    return next;
  });
}

function normalizeAssigneeNames(
  tasks: unknown[],
  users: Array<{ name: string }>
): unknown[] {
  const userNames = users.map((u) => u.name);
  const lower = userNames.map((n) => n.toLowerCase());

  return tasks.map((task) => {
    if (!task || typeof task !== "object") return task;
    const next = { ...(task as Record<string, unknown>) };
    const rawAssignee = typeof next.assigneeName === "string" ? next.assigneeName.trim() : "";
    if (!rawAssignee) {
      next.assigneeName = null;
      return next;
    }

    const needle = rawAssignee.toLowerCase();
    const exactIdx = lower.findIndex((n) => n === needle);
    if (exactIdx >= 0) {
      next.assigneeName = userNames[exactIdx];
      return next;
    }

    const includesIdx = lower.findIndex((n) => n.includes(needle) || needle.includes(n));
    next.assigneeName = includesIdx >= 0 ? userNames[includesIdx] : null;
    return next;
  });
}

async function translateTitlesToRu(tasks: unknown[]) {
  const response = await getYandex().chat.completions.create({
    model: yandexModel(),
    max_tokens: 4096,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "Ты переводчик JSON задач. Получишь JSON-массив задач. Переведи только поле title на русский язык во всех элементах. Остальные поля и их значения не меняй. Верни только JSON-массив без markdown.",
      },
      { role: "user", content: JSON.stringify(tasks) },
    ],
  });

  const raw = (response.choices[0]?.message?.content ?? "").trim();
  const cleaned = cleanupJsonFence(raw);
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed : [parsed];
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const { text } = RequestSchema.parse(body);
    const users = await prisma.user.findMany({
      select: { name: true },
      orderBy: { createdAt: "asc" },
    });

    const response = await getYandex().chat.completions.create({
      model: yandexModel(),
      max_tokens: 8192,
      temperature: 0.1,
      messages: [
        { role: "system", content: buildSystemPrompt(new Date().toISOString().split("T")[0]) },
        { role: "user", content: text },
      ],
    });

    const raw = (response.choices[0]?.message?.content ?? "").trim();
    const cleaned = cleanupJsonFence(raw);

    if (!cleaned) {
      console.error("[ai/parse] empty content, finish_reason:", response.choices[0]?.finish_reason);
      return NextResponse.json({ error: "Модель не вернула ответ. Попробуйте ещё раз." }, { status: 422 });
    }

    const parsed = JSON.parse(cleaned);
    let tasks = Array.isArray(parsed) ? parsed : [parsed];
    tasks = normalizeParsedColumns(tasks);

    if (tasks.length === 0) {
      return NextResponse.json({ error: "AI не выделил ни одной задачи." }, { status: 422 });
    }

    const needsRuFix = tasks.some((task) =>
      !!task && typeof task === "object" && titleNeedsRuFix((task as { title?: unknown }).title)
    );
    if (needsRuFix) {
      tasks = await translateTitlesToRu(tasks);
      tasks = normalizeParsedColumns(tasks);
    }
    tasks = normalizeAssigneeNames(tasks, users);

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("[ai/parse] error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Поле text обязательно" }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "AI вернул некорректный JSON. Попробуйте переформулировать." }, { status: 422 });
    }
    return NextResponse.json({ error: "Ошибка разбора задач" }, { status: 500 });
  }
}
