import { mkdir } from "node:fs/promises";
import path from "node:path";

export function mediaStorageDirectory() {
  return process.env.MEDIA_STORAGE_DIR?.trim() || path.join(process.cwd(), "storage", "media");
}

export function mediaPublicBase() {
  return (process.env.MEDIA_PUBLIC_URL?.trim() || "/media").replace(/\/$/, "");
}

export function safeMediaKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 180) || "image";
}

export async function ensureMediaStorage() {
  await mkdir(mediaStorageDirectory(), { recursive: true });
}

export async function ensureMediaFileDirectory(key: string) {
  await mkdir(path.dirname(mediaFilePath(key)), { recursive: true });
}

export function mediaFilePath(key: string) {
  const normalized = key.split("/").filter(Boolean).join("/");
  const root = path.resolve(mediaStorageDirectory());
  const target = path.resolve(root, normalized);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("Invalid media path");
  return target;
}
