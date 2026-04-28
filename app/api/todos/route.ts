import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

const CreateTodoSchema = z.object({
  title: z.string().min(1),
  taskId: z.number().int().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userIdParam = req.nextUrl.searchParams.get("userId");
    let targetUserId = auth.user.id;

    if (userIdParam) {
      const parsed = parseInt(userIdParam, 10);
      if (Number.isNaN(parsed)) {
        return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
      }
      if (auth.user.role !== "admin" && parsed !== auth.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      targetUserId = parsed;
    }

    const todos = await prisma.todoItem.findMany({
      where: { userId: targetUserId },
      include: { task: { select: { id: true, title: true, column: true } } },
      orderBy: [{ isCompleted: "asc" }, { order: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(todos);
  } catch {
    return NextResponse.json({ error: "Failed to fetch todos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const data = CreateTodoSchema.parse(body);

    const maxOrder = await prisma.todoItem.aggregate({
      where: { userId: auth.user.id, isCompleted: false },
      _max: { order: true },
    });

    const todo = await prisma.todoItem.create({
      data: {
        title: data.title.trim(),
        order: (maxOrder._max.order ?? -1) + 1,
        userId: auth.user.id,
        taskId: data.taskId ?? null,
      },
      include: { task: { select: { id: true, title: true, column: true } } },
    });

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create todo" }, { status: 500 });
  }
}
