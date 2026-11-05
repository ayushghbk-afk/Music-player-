import type { Database, Env, QueryResult, SqlValue } from "./types";

interface TursoValue {
  type: string;
  value?: string | null;
}

interface TursoResult {
  cols?: { name: string }[];
  rows?: TursoValue[][];
  affected_row_count?: number;
}

interface TursoResponse {
  results?: {
    type: string;
    response?: { type: string; result?: TursoResult };
    error?: { message?: string };
  }[];
}

function endpoint(rawUrl: string): string {
  const normalized = rawUrl.trim().replace(/^libsql:\/\//i, "https://");
  const url = new URL(normalized);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("TURSO_DATABASE_URL must be an HTTPS/libsql origin without credentials");
  }
  url.pathname = "/v2/pipeline";
  url.search = "";
  url.hash = "";
  return url.href;
}

function argument(value: SqlValue): Record<string, string> {
  if (value === null) return { type: "null" };
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("SQL numbers must be safe integers");
    return { type: "integer", value: String(value) };
  }
  return { type: "text", value };
}

function decodeValue(value: TursoValue | undefined): SqlValue {
  if (!value || value.type === "null" || value.value == null) return null;
  if (value.type === "integer") return Number(value.value);
  if (value.type === "float") return Number(value.value);
  return String(value.value);
}

/** Minimal Turso HTTP v2 client. All values are sent as typed positional args. */
export class TursoDatabase implements Database {
  private readonly url: string;
  private readonly token: string;

  constructor(env: Env) {
    if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
      throw new Error("Turso is not configured");
    }
    this.url = endpoint(env.TURSO_DATABASE_URL);
    this.token = env.TURSO_AUTH_TOKEN;
  }

  async query(sql: string, args: SqlValue[] = []): Promise<QueryResult> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql, args: args.map(argument) } },
          { type: "close" },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Turso request failed (${response.status})`);
    const payload = (await response.json()) as TursoResponse;
    const first = payload.results?.[0];
    if (!first || first.type !== "ok" || first.error) {
      throw new Error(first?.error?.message || "Turso rejected the query");
    }
    const result = first.response?.result;
    const columns = result?.cols?.map((column) => column.name) || [];
    const rows = (result?.rows || []).map((row) =>
      Object.fromEntries(columns.map((name, index) => [name, decodeValue(row[index])])),
    );
    return { rows, affected: Number(result?.affected_row_count || 0) };
  }
}
