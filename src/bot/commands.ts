import type { Bot, Context } from "grammy";
import { prisma } from "@/lib/prisma";
import { parseTaskText } from "./aiParser";
import { COLUMNS, COLUMN_LABELS, normalizeColumnId } from "@/lib/constants";
import { DEFAULT_NEURON_BLOCK, isNeuronBlockId } from "@/lib/neuronBlocks";

export function registerCommands(bot: Bot<Context>) {
  bot.command("start", (ctx) => {
    ctx.reply(
      `Привет! Я помогу управлять задачами на Канбан-доске.\n\n` +
      `Команды:\n` +
      `/list — все задачи\n` +
      `/list <колонка> — задачи в колонке\n` +
      `/move <id> <колонка> — переместить задачу\n` +
      `/create <текст> — создать задачу через AI\n\n` +
      `Или просто напишите описание задачи — AI создаст её автоматически.\n\n` +
      `Колонки: GLOBAL_BACKLOG, SPRINT_BACKLOG, DEV, TESTING, DONE_SPRINT, DONE_LONG_AGO`
    );
  });

  bot.command("list", async (ctx) => {
    const arg = ctx.match?.trim().toUpperCase().replace(/\s+/g, "_");
    const validCol = arg && COLUMNS.some((c) => c.id === arg) ? arg : null;

    const tasks = await prisma.task.findMany({
      where: validCol ? { column: validCol } : undefined,
      include: { assignee: true },
      orderBy: [{ column: "asc" }, { order: "asc" }],
      take: 30,
    });

    if (tasks.length === 0) {
      return ctx.reply("Задач не найдено.");
    }

    const lines = tasks.map((t) => {
      const col = COLUMN_LABELS[t.column] ?? t.column;
      const assignee = t.assignee ? ` [@${t.assignee.name}]` : "";
      const ai = t.isAiGenerated && !t.isValidated ? " [AI]" : "";
      return `#${t.id} ${t.title}${assignee}${ai}\n  → ${col}`;
    });

    ctx.reply(lines.join("\n\n"), { parse_mode: undefined });
  });

  bot.command("move", async (ctx) => {
    const parts = ctx.match?.trim().split(/\s+/);
    if (!parts || parts.length < 2) {
      return ctx.reply("Использование: /move <id> <колонка>\nПример: /move 5 TESTING");
    }

    const id = parseInt(parts[0]);
    const colRaw = normalizeColumnId(parts[1].toUpperCase());
    const col = COLUMNS.find((c) => c.id === colRaw);

    if (isNaN(id)) return ctx.reply("Неверный ID задачи.");
    if (!col) {
      return ctx.reply(`Неверная колонка. Доступные:\n${COLUMNS.map((c) => c.id).join("\n")}`);
    }

    try {
      const task = await prisma.task.update({
        where: { id },
        data: { column: col.id },
      });
      ctx.reply(`Задача #${task.id} "${task.title}" перемещена в "${COLUMN_LABELS[col.id]}".`);
    } catch {
      ctx.reply(`Задача #${id} не найдена.`);
    }
  });

  bot.command("create", async (ctx) => {
    const text = ctx.match?.trim();
    if (!text) return ctx.reply("Напишите описание после /create");
    await createTaskFromText(ctx, text);
  });

  // Free text → AI create
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return;
    await createTaskFromText(ctx, text);
  });
}

async function createTaskFromText(ctx: Context, text: string) {
  const thinking = await ctx.reply("Разбираю задачу...");

  try {
    const parsedList = await parseTaskText(text);
    if (!parsedList || parsedList.length === 0) {
      throw new Error("AI не выделил задач");
    }

    const createdLines: string[] = [];

    for (const parsed of parsedList) {
      const column = normalizeColumnId(parsed.column ?? "GLOBAL_BACKLOG");

      let assigneeId: number | null = null;
      if (parsed.assigneeName) {
        const user = await prisma.user.findFirst({
          where: { name: { contains: parsed.assigneeName } },
        });
        if (user) assigneeId = user.id;
      }

      const maxOrder = await prisma.task.aggregate({
        where:
          column === "DEV"
            ? { column: { in: ["DEV", "PRODUCT_DEV", "TECH_DEV"] } }
            : { column },
        _max: { order: true },
      });

      const neuronBlock =
        parsed.neuronBlock && isNeuronBlockId(parsed.neuronBlock)
          ? parsed.neuronBlock
          : DEFAULT_NEURON_BLOCK;

      const task = await prisma.task.create({
        data: {
          title: parsed.title,
          description: parsed.description ?? null,
          column,
          order: (maxOrder._max.order ?? -1) + 1,
          assigneeId,
          startDate: parsed.startDate ? new Date(parsed.startDate) : null,
          endDate: parsed.endDate ? new Date(parsed.endDate) : null,
          isAiGenerated: true,
          isValidated: false,
          neuronBlock,
        },
        include: { assignee: true },
      });

      const colLabel = COLUMN_LABELS[task.column] ?? task.column;
      const assigneeInfo = task.assignee ? ` • ${task.assignee.name}` : "";
      const dates =
        task.startDate && task.endDate
          ? ` • ${new Date(task.startDate).toLocaleDateString("ru-RU")}–${new Date(task.endDate).toLocaleDateString("ru-RU")}`
          : "";
      createdLines.push(`#${task.id} *${task.title}* — ${colLabel}${assigneeInfo}${dates}`);
    }

    const header =
      parsedList.length === 1
        ? "Задача создана"
        : `Создано задач: ${parsedList.length}`;

    await ctx.api.editMessageText(
      ctx.chat!.id,
      thinking.message_id,
      `${header}\n\n${createdLines.join("\n")}\n\n⚠️ Требуют валидации на доске.`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error(err);
    await ctx.api.editMessageText(
      ctx.chat!.id,
      thinking.message_id,
      "Не удалось разобрать задачу. Попробуйте переформулировать."
    );
  }
}
