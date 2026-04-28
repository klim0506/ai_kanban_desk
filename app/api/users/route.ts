import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { TEAM_COLORS } from "@/lib/constants";
import { requireAuth, toPublicUser } from "@/lib/auth";

const CreateUserSchema = z.object({
  name: z.string().min(1),
  login: z.string().min(1),
  password: z.string().min(1),
  role: z.enum(["admin", "user"]).optional().default("user"),
  color: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, login: true, role: true, color: true },
    });
    return NextResponse.json(users.map(toPublicUser));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const data = CreateUserSchema.parse(body);

    // Auto-pick next free color if not provided
    let color = data.color;
    if (!color) {
      const existing = await prisma.user.findMany({ select: { color: true } });
      const used = new Set(existing.map((u) => u.color));
      color = TEAM_COLORS.find((c) => !used.has(c)) ?? TEAM_COLORS[existing.length % TEAM_COLORS.length];
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        login: data.login.trim(),
        password: data.password,
        role: data.role,
        color,
      },
      select: { id: true, name: true, login: true, role: true, color: true },
    });

    return NextResponse.json(toPublicUser(user), { status: 201 });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
