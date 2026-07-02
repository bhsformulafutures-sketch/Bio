import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { FILES_DIR } from "@/lib/store/local";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * Serves uploaded images when running on the local file store.
 * (In production, images come straight from Supabase Storage URLs
 * and this route is never used.)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const relative = segments.join("/");
  const full = path.resolve(FILES_DIR, relative);
  if (!full.startsWith(path.resolve(FILES_DIR) + path.sep)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const data = await fs.readFile(full);
    const type = CONTENT_TYPES[path.extname(full).toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
