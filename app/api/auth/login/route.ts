import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { toPublicUser } from "@/lib/auth";

const AUTH_ERRORS = {
  INVALID_CREDENTIALS: "Invalid credentials",
  DEVICE_ALREADY_LINKED: "Device already linked to another account",
  LOGIN_FAILED: "Login failed",
} as const;

const LoginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  deviceId: z.string().min(1),
});

function hasValidPassword(actual: string, expected: string): boolean {
  return actual === expected;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = LoginSchema.parse(body);

    const existingDeviceToken = await prisma.authToken.findUnique({
      where: { deviceId: data.deviceId },
      include: { user: true },
    });
    if (existingDeviceToken) {
      if (existingDeviceToken.user.login !== data.login) {
        return NextResponse.json({ error: AUTH_ERRORS.DEVICE_ALREADY_LINKED }, { status: 403 });
      }
      if (!hasValidPassword(existingDeviceToken.user.password, data.password)) {
        return NextResponse.json({ error: AUTH_ERRORS.INVALID_CREDENTIALS }, { status: 401 });
      }
      return NextResponse.json({
        token: existingDeviceToken.token,
        user: toPublicUser(existingDeviceToken.user),
      });
    }

    const user = await prisma.user.findUnique({ where: { login: data.login } });

    if (!user || !hasValidPassword(user.password, data.password)) {
      return NextResponse.json({ error: AUTH_ERRORS.INVALID_CREDENTIALS }, { status: 401 });
    }

    const authToken = await prisma.authToken.create({
      data: {
        token: randomUUID(),
        deviceId: data.deviceId,
        userId: user.id,
      },
    });

    return NextResponse.json({
      token: authToken.token,
      user: toPublicUser(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: AUTH_ERRORS.LOGIN_FAILED }, { status: 500 });
  }
}
