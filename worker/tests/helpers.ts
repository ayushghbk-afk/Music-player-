import { DatabaseSync } from "node:sqlite";
import type { Database, Env, ObjectStorage, QueryResult, SqlValue } from "../src/types";
import { createHandler } from "../src/index";

export class SqliteDatabase implements Database {
  readonly raw: DatabaseSync;
  constructor() {
    this.raw = new DatabaseSync(":memory:");
  }
  async query(sql: string, args: SqlValue[] = []): Promise<QueryResult> {
    const statement = this.raw.prepare(sql);
    if (/^\s*(SELECT|PRAGMA|WITH)/i.test(sql) || /RETURNING/i.test(sql)) {
      return { rows: statement.all(...args) as Record<string, SqlValue>[], affected: 0 };
    }
    const result = statement.run(...args);
    return { rows: [], affected: Number(result.changes) };
  }
}

interface StoredObject {
  bytes: Uint8Array;
  mime: string;
}

export class MemoryStorage implements ObjectStorage {
  readonly objects = new Map<string, StoredObject>();
  async check(): Promise<void> {}
  async put(key: string, body: ArrayBuffer, mimeType: string): Promise<void> {
    this.objects.set(key, { bytes: new Uint8Array(body.slice(0)), mime: mimeType });
  }
  async get(key: string, range: string | null): Promise<Response> {
    const object = this.objects.get(key);
    if (!object) return new Response("missing", { status: 404 });
    const size = object.bytes.length;
    let start = 0;
    let end = size - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416 });
      if (!match[1]) {
        const suffix = Number(match[2]);
        start = Math.max(0, size - suffix);
      } else {
        start = Number(match[1]);
        end = match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
      }
      if (start >= size || end < start) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      const body = object.bytes.slice(start, end + 1);
      return new Response(body, {
        status: 206,
        headers: {
          "Content-Type": object.mime,
          "Content-Length": String(body.length),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          ETag: "test-etag",
        },
      });
    }
    return new Response(object.bytes.slice(0), {
      status: 200,
      headers: {
        "Content-Type": object.mime,
        "Content-Length": String(size),
        "Accept-Ranges": "bytes",
        ETag: "test-etag",
      },
    });
  }
  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

export const env: Env = {
  TURSO_DATABASE_URL: "libsql://not-used.test",
  TURSO_AUTH_TOKEN: "not-used",
  B2_ENDPOINT: "https://s3.us-east-005.backblazeb2.com",
  B2_BUCKET: "music-player-storage",
  B2_KEY_ID: "not-used",
  B2_APPLICATION_KEY: "not-used",
  AUTH_SECRET: "integration-test-secret-with-at-least-32-characters",
  CORS_ORIGINS: "https://ayushghbk-afk.github.io",
  ACCESS_TOKEN_SECONDS: "900",
  REFRESH_TOKEN_SECONDS: "2592000",
  STREAM_TICKET_SECONDS: "43200",
};

export function fixture(setup?: (database: SqliteDatabase) => void) {
  const database = new SqliteDatabase();
  setup?.(database);
  const storage = new MemoryStorage();
  const handler = createHandler({ database, storage });
  return { database, storage, handler };
}

export interface RequestOptions {
  method?: string;
  token?: string;
  cookie?: string;
  body?: BodyInit;
  headers?: Record<string, string>;
  origin?: string | null;
}

export async function call(
  handler: (request: Request, env: Env) => Promise<Response>,
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.cookie) headers.set("Cookie", options.cookie);
  if (options.origin !== null) headers.set("Origin", options.origin || "https://ayushghbk-afk.github.io");
  return handler(new Request(`https://worker.test${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body,
  }), env);
}

export async function json(response: Response): Promise<any> {
  const payload = await response.json();
  if (!payload || typeof payload !== "object") throw new Error("Expected JSON object");
  return payload;
}

export function cookie(response: Response): string {
  return (response.headers.get("set-cookie") || "").split(";")[0]!;
}

export function jsonBody(value: unknown): RequestOptions {
  return {
    method: "POST",
    body: JSON.stringify(value),
    headers: { "Content-Type": "application/json" },
  };
}

export function wavFile(name = "test.wav"): File {
  // Valid RIFF/WAVE header plus a short mono PCM payload.
  const bytes = new Uint8Array(44 + 32);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) bytes[offset + index] = value.charCodeAt(index);
  };
  write(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, 32, true);
  return new File([bytes], name, { type: "audio/wav" });
}
