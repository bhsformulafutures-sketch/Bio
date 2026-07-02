import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getUser } from "@/lib/session";
import { userToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const MAX_NAME = 30;
/** A small, safe set of emoji avatars — no arbitrary strings stored. */
const AVATARS = [
  "🦊", "🐨", "🐧", "🦋", "🌻", "🌙", "⭐", "🍓", "🐝", "🐙",
  "🦉", "🐳", "🌸", "🍄", "🐢", "🦔", "🌵", "🍯", "🪺", "🫧",
];

/** POST /api/profile { name, avatar } — create or update your profile. */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let name = "";
  let avatar: string | null = null;
  try {
    const body = await request.json();
    name = String(body?.name ?? "").trim().slice(0, MAX_NAME);
    const raw = body?.avatar;
    avatar = typeof raw === "string" && AVATARS.includes(raw) ? raw : null;
  } catch {
    /* fall through to validation */
  }
  if (!name) {
    return NextResponse.json({ error: "What should we call you?" }, { status: 400 });
  }

  try {
    const updated = await getStore().updateUser(user.id, { name, avatar });
    return NextResponse.json({ user: userToDTO(updated) });
  } catch (error) {
    console.error("updateProfile failed:", error);
    return NextResponse.json({ error: "Couldn't save your profile. Try again." }, { status: 500 });
  }
}

/** GET /api/profile — the list of avatars to choose from. */
export async function GET() {
  return NextResponse.json({ avatars: AVATARS });
}
