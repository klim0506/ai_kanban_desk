import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const history = await prisma.taskHistory.findMany({
      where: { taskId: id },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const assigneeIds = new Set<number>();
    for (const h of history) {
      if (h.kind !== "assignee") continue;
      const fromId = h.fromValue ? parseInt(h.fromValue, 10) : NaN;
      const toId = h.toValue ? parseInt(h.toValue, 10) : NaN;
      if (!Number.isNaN(fromId)) assigneeIds.add(fromId);
      if (!Number.isNaN(toId)) assigneeIds.add(toId);
    }

    const users = assigneeIds.size
      ? await prisma.user.findMany({
          where: { id: { in: Array.from(assigneeIds) } },
          select: { id: true, name: true },
        })
      : [];
    const userNameById = new Map(users.map((u) => [u.id, u.name]));

    const normalized = history.map((h) => {
      if (h.kind !== "assignee") return h;
      const fromId = h.fromValue ? parseInt(h.fromValue, 10) : NaN;
      const toId = h.toValue ? parseInt(h.toValue, 10) : NaN;
      return {
        ...h,
        fromValue: !Number.isNaN(fromId) ? (userNameById.get(fromId) ?? h.fromValue) : h.fromValue,
        toValue: !Number.isNaN(toId) ? (userNameById.get(toId) ?? h.toValue) : h.toValue,
      };
    });

    return NextResponse.json(normalized);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
