import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export type PublicUser = {
  id: number;
  name: string;
  login: string;
  role: string;
  color: string;
};

export function toPublicUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    login: user.login,
    role: user.role,
    color: user.color,
  };
}

export async function requireAuth(req: NextRequest) {
  const token = req.headers.get("x-auth-token");
  if (!token) return null;
  const auth = await prisma.authToken.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!auth) return null;
  return { user: auth.user, token: auth.token, deviceId: auth.deviceId };
}
