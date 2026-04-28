import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAuth, toPublicUser } from "@/lib/auth";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  login: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  role: z.enum(["admin", "user"]).optional(),
  color: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const body = await req.json();
    const data = UpdateSchema.parse(body);
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, login: true, role: true, color: true },
    });
    return NextResponse.json(toPublicUser(user));
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(_req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    await prisma.user.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
