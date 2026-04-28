import type { ParsedTask } from "@/types";
import { getYandex, yandexModel } from "@/lib/yandex";

function buildSystemPrompt(today: Date): string {
  const todayStr = today.toISOString().split("T")[0];
  return `Ты извлекаешь задачи из текста. Отвечай ТОЛЬКО JSON-массивом без пояснений и без markdown.

Пользователь может описать от 1 до 10 задач в одном сообщении. Разбей текст на отдельные задачи:
- Если перечислены несколько дел (список / через запятую / "и" / "потом") — это отдельные задачи.
- Если одна — массив из одного элемента.
- ВАЖНО: "разработать и протестировать" — ОДНА задача (не отдельный тест-тикет). Отдельный тест-тикет только если явно "написать тесты", "QA", "регресс".
- Максимум 10 задач.

Формат каждой задачи (незаполненные = null):
{"title":"string","description":"string|null","assigneeName":"string|null","startDate":"YYYY-MM-DD|null","endDate":"YYYY-MM-DD|null","column":"GLOBAL_BACKLOG|SPRINT_BACKLOG|DEV|TESTING|DONE_SPRINT|DONE_LONG_AGO|null","priority":"1|2|3|null","difficulty":"1|2|3|4|null","neuronBlock":"CHAT|AGENT_SYSTEM|FUNCTIONS|DOCUMENTS|SVC_SPEECHWRITING|SVC_TASK_GENERATOR|SVC_ORG_TASKS|SVC_LEGAL_CONTROL|SVC_PROCESS_ANALYSIS|SVC_REJUS_STRIP|null"}
priority: 1=критбаг, 2=важно, 3=nice. difficulty: 1=минуты, 2=часы, 3=дни, 4=исследование.

Ответ — ТОЛЬКО JSON-массив: [{...}, {...}]

Правила: спринт→SPRINT_BACKLOG, любая разработка (продуктовая/техническая)→DEV, тест→TESTING. Не указана→null.
Сегодня: ${todayStr}.`;
}

export async function parseTaskText(text: string): Promise<ParsedTask[]> {
  const response = await getYandex().chat.completions.create({
    model: yandexModel(),
    max_tokens: 4096,
    temperature: 0.1,
    messages: [
      { role: "system", content: buildSystemPrompt(new Date()) },
      { role: "user", content: text },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "";
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const parsed = JSON.parse(cleaned);
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr.slice(0, 10) as ParsedTask[];
}
