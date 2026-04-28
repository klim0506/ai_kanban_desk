import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { normalizeColumnId } from "@/lib/constants";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const task = await prisma.task.update({
      where: { id },
      data: { isValidated: true },
      include: { assignee: true },
    });

    return NextResponse.json({
      ...task,
      column: normalizeColumnId(task.column),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to validate task" }, { status: 500 });
  }
}
