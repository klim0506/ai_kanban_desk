import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { DEFAULT_NEURON_BLOCK, isNeuronBlockId } from "@/lib/neuronBlocks";
import { normalizeColumnId } from "@/lib/constants";
import { requireAuth } from "@/lib/auth";

const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, "Название задачи обязательно"),
  description: z.string().optional().nullable(),
  column: z.string().optional().default("SPRINT_BACKLOG"),
  assigneeId: z.number().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  isAiGenerated: z.boolean().optional().default(false),
  isValidated: z.boolean().optional(),
  dependencies: z.string().optional().nullable(),
  priority: z.number().int().min(1).max(3).optional().default(2),
  difficulty: z.number().int().min(1).max(4).optional().default(2),
  neuronBlock: z.string().optional(),
  artifacts: z.string().optional().nullable(),
});

function getActorId(req: NextRequest): number | null {
  const h = req.headers.get("x-actor-id");
  if (!h) return null;
  const n = parseInt(h);
  return isNaN(n) ? null : n;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tasks = await prisma.task.findMany({
      include: { assignee: true },
      orderBy: [{ column: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(
      tasks.map((task) => ({
        ...task,
        column: normalizeColumnId(task.column),
      }))
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const data = CreateTaskSchema.parse(body);
    const actorId = getActorId(req);

    const normalizedColumn = normalizeColumnId(data.column);

    const maxOrder = await prisma.task.aggregate({
      where:
        normalizedColumn === "DEV"
          ? { column: { in: ["DEV", "PRODUCT_DEV", "TECH_DEV"] } }
          : { column: normalizedColumn },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const neuronBlock =
      data.neuronBlock && isNeuronBlockId(data.neuronBlock) ? data.neuronBlock : DEFAULT_NEURON_BLOCK;

    const task = await prisma.task.create({
      data: {
        title: data.title.trim(),
        description: data.description ?? null,
        column: normalizedColumn,
        order: nextOrder,
        assigneeId: data.assigneeId ?? null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        isAiGenerated: data.isAiGenerated,
        isValidated: data.isValidated ?? !data.isAiGenerated,
        dependencies: data.dependencies ?? null,
        priority: data.priority,
        difficulty: data.difficulty,
        neuronBlock,
        artifacts: data.artifacts ?? null,
      },
      include: { assignee: true },
    });

    // Initial history entry
    await prisma.taskHistory.create({
      data: {
        taskId: task.id,
        actorId,
        kind: "created",
        toValue: normalizedColumn,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
