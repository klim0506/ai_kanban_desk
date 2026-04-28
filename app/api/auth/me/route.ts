import { NextRequest, NextResponse } from "next/server";
import { requireAuth, toPublicUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ user: toPublicUser(auth.user), token: auth.token });
}
