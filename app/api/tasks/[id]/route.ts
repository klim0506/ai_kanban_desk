import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { isNeuronBlockId } from "@/lib/neuronBlocks";
import { normalizeColumnId } from "@/lib/constants";
import { requireAuth } from "@/lib/auth";

const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1, "Название задачи обязательно").optional(),
  description: z.string().nullable().optional(),
  column: z.string().optional(),
  order: z.number().optional(),
  assigneeId: z.number().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  dependencies: z.string().nullable().optional(),
  priority: z.number().int().min(1).max(3).optional(),
  difficulty: z.number().int().min(1).max(4).optional(),
  isValidated: z.boolean().optional(),
  neuronBlock: z.string().optional(),
  artifacts: z.string().nullable().optional(),
});

function getActorId(req: NextRequest): number | null {
  const h = req.headers.get("x-actor-id");
  if (!h) return null;
  const n = parseInt(h);
  return isNaN(n) ? null : n;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json();
    const data = UpdateTaskSchema.parse(body);
    const actorId = getActorId(req);

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const normalizedExistingColumn = normalizeColumnId(existing.column);
    const normalizedInputColumn = data.column !== undefined ? normalizeColumnId(data.column) : undefined;
    if (
      normalizedInputColumn === "DONE_LONG_AGO" &&
      normalizedExistingColumn !== "DONE_LONG_AGO" &&
      auth.user.role !== "admin"
    ) {
      return NextResponse.json({ error: "Переносить задачи в архив может только администратор" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.column !== undefined) updateData.column = normalizeColumnId(data.column);
    if (data.order !== undefined) updateData.order = data.order;
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
    if (data.startDate !== undefined)
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined)
      updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.dependencies !== undefined) updateData.dependencies = data.dependencies;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
    if (data.isValidated !== undefined) updateData.isValidated = data.isValidated;
    if (data.neuronBlock !== undefined && isNeuronBlockId(data.neuronBlock))
      updateData.neuronBlock = data.neuronBlock;
    if (data.artifacts !== undefined) updateData.artifacts = data.artifacts;

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: { assignee: true },
    });

    // History logging
    const histEntries: { kind: string; fromValue: string | null; toValue: string | null }[] = [];
    if (normalizedInputColumn !== undefined && normalizedInputColumn !== normalizedExistingColumn) {
      histEntries.push({ kind: "column", fromValue: normalizedExistingColumn, toValue: normalizedInputColumn });
    }
    if (data.assigneeId !== undefined && data.assigneeId !== existing.assigneeId) {
      histEntries.push({
        kind: "assignee",
        fromValue: existing.assigneeId ? String(existing.assigneeId) : null,
        toValue: data.assigneeId ? String(data.assigneeId) : null,
      });
    }
    for (const h of histEntries) {
      await prisma.taskHistory.create({
        data: { taskId: id, actorId, ...h },
      });
    }

    return NextResponse.json({
      ...task,
      column: normalizeColumnId(task.column),
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const actorId = getActorId(req);
    if (actorId == null) {
      return NextResponse.json({ error: "Нужно выбрать пользователя (шапка)" }, { status: 403 });
    }
    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    if (!actor || actor.role !== "admin") {
      return NextResponse.json(
        { error: "Удалять задачи могут только администраторы" },
        { status: 403 }
      );
    }

    await prisma.task.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
