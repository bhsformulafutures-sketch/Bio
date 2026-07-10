import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** POST /api/booth/[id]/cancel — abandon a pending/live booth. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  const store = getStore();
  const booth = await store.getBooth(id);
  if (!booth || booth.roomId !== session.room.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await store.cancelBooth(booth.id);
  return NextResponse.json({ ok: true });
}
