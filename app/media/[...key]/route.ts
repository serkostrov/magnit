import { readFile } from "node:fs/promises";
import path from "node:path";
import { mediaFilePath } from "@/lib/media/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contentTypes: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif" };

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    const { key } = await params;
    const filename = key.join("/");
    const data = await readFile(mediaFilePath(filename));
    return new Response(data, { headers: { "content-type": contentTypes[path.extname(filename).toLowerCase()] || "application/octet-stream", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff", "cross-origin-resource-policy": "same-origin" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
