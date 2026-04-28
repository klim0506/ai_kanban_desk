import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

const UpdateTodoSchema = z.object({
  title: z.string().min(1).optional(),
  isCompleted: z.boolean().optional(),
  order: z.number().int().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = parseInt(params.id, 10);
    if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const existing = await prisma.todoItem.findUnique({ where: { id } });
    if (!existing || existing.userId !== auth.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const data = UpdateTodoSchema.parse(body);
    const todo = await prisma.todoItem.update({
      where: { id },
      data,
      include: { task: { select: { id: true, title: true, column: true } } },
    });

    return NextResponse.json(todo);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update todo" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = parseInt(params.id, 10);
    if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const existing = await prisma.todoItem.findUnique({ where: { id } });
    if (!existing || existing.userId !== auth.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.todoItem.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Failed to delete todo" }, { status: 500 });
  }
}
