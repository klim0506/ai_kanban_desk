import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACTIVE_SPRINT_COLUMNS = ["SPRINT_BACKLOG", "DEV", "TESTING"] as const;
const DONE_COLUMNS = ["DONE_SPRINT", "DONE_LONG_AGO"] as const;

function buildStatusText(doneYesterday: string[], nextWeek: string[]): string {
  const doneLines =
    doneYesterday.length > 0
      ? doneYesterday.map((title, i) => `${i + 1}. ${title}`).join("\n")
      : "1. —";
  const nextLines =
    nextWeek.length > 0
      ? nextWeek.map((title, i) => `${i + 1}. ${title}`).join("\n")
      : "1. —";

  return `Сделал вчера:
${doneLines}

Сделаю далее на этой неделе:
${nextLines}`;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userIdParam = req.nextUrl.searchParams.get("userId");
    let targetUserId = auth.user.id;
    if (userIdParam) {
      const parsed = parseInt(userIdParam, 10);
      if (Number.isNaN(parsed)) return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
      if (auth.user.role !== "admin" && parsed !== auth.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      targetUserId = parsed;
    }

    const from = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentDoneHistory = await prisma.taskHistory.findMany({
      where: {
        kind: "column",
        createdAt: { gte: from },
        toValue: { in: DONE_COLUMNS as unknown as string[] },
        task: { assigneeId: targetUserId },
      },
      include: { task: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    });

    const doneMap = new Map<number, string>();
    for (const h of recentDoneHistory) {
      if (!doneMap.has(h.taskId)) doneMap.set(h.taskId, h.task.title);
    }
    const doneYesterday = Array.from(doneMap.values());

    const nextWeekTasks = await prisma.task.findMany({
      where: {
        assigneeId: targetUserId,
        column: { in: ACTIVE_SPRINT_COLUMNS as unknown as string[] },
      },
      orderBy: [{ priority: "asc" }, { order: "asc" }, { createdAt: "asc" }],
      select: { title: true },
    });
    const nextWeek = nextWeekTasks.map((x) => x.title);

    return NextResponse.json({
      text: buildStatusText(doneYesterday, nextWeek),
      doneYesterday,
      nextWeek,
    });
  } catch (error) {
    console.error("[todos/status]", error);
    return NextResponse.json({ error: "Failed to build status report" }, { status: 500 });
  }
}
