import { HttpError, type SqlValue } from "./types";

export const DEFAULT_ORIGINS = [
  "https://ayushghbk-afk.github.io",
  "https://localhost",
  "capacitor://localhost",
];

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) throw new Error("Invalid base64");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(value: string): Uint8Array {
  if (!/^(?:[A-Fa-f0-9]{2})+$/.test(value)) throw new Error("Invalid hex");
  return Uint8Array.from(value.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
}

export function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index]! ^ right[index]!;
  return difference === 0;
}

export async function sha256(value: string | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const source = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", source));
}

export function integer(value: SqlValue | undefined, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return fallback;
}

export function text(value: SqlValue | undefined, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

export function requiredId(value: string): string {
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(value)) {
    throw new HttpError(400, "INVALID_ID", "Invalid resource identifier");
  }
  return value;
}

export function requestOrigin(request: Request, env: { CORS_ORIGINS?: string }): {
  origin: string | null;
  allowed: boolean;
  corsHeaders: Record<string, string>;
} {
  const origin = request.headers.get("Origin");
  const origins = (env.CORS_ORIGINS || DEFAULT_ORIGINS.join(","))
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const allowed = !origin || origins.includes(origin);
  const corsHeaders: Record<string, string> = {};
  if (origin && allowed) {
    corsHeaders["Access-Control-Allow-Origin"] = origin;
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
    corsHeaders.Vary = "Origin";
  }
  return { origin, allowed, corsHeaders };
}

export function jsonResponse(
  status: number,
  payload: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

export function success(
  payload: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  extraHeaders?: Record<string, string>,
): Response {
  return jsonResponse(200, { success: true, ...payload }, corsHeaders, extraHeaders);
}

export function failure(error: HttpError, corsHeaders: Record<string, string>): Response {
  return jsonResponse(
    error.status,
    { success: false, error: error.message, code: error.code },
    corsHeaders,
    error.headers,
  );
}

export function clientIp(request: Request): string {
  // Cloudflare overwrites this header. Do not trust spoofable X-Forwarded-For.
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

export function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies[name] = value;
  }
  return cookies;
}

export const REFRESH_COOKIE = "__Host-aether_refresh";

export function refreshCookie(token: string, maxAge: number): string {
  return `${REFRESH_COOKIE}=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAge}`;
}

export function clearRefreshCookie(): string {
  return `${REFRESH_COOKIE}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
}

export function boundedSeconds(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value || fallback);
  return Number.isSafeInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}
