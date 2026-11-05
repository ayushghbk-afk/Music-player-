export type SqlValue = string | number | null;

export interface QueryResult {
  rows: Record<string, SqlValue>[];
  affected: number;
}

export interface Database {
  query(sql: string, args?: SqlValue[]): Promise<QueryResult>;
}

export interface ObjectStorage {
  check(): Promise<void>;
  put(key: string, body: ArrayBuffer, mimeType: string): Promise<void>;
  get(key: string, range: string | null): Promise<Response>;
  delete(key: string): Promise<void>;
}

export interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  B2_ENDPOINT: string;
  B2_BUCKET: string;
  B2_REGION?: string;
  B2_KEY_ID: string;
  B2_APPLICATION_KEY: string;
  AUTH_SECRET: string;
  CORS_ORIGINS?: string;
  MAX_UPLOAD_BYTES?: string;
  ACCESS_TOKEN_SECONDS?: string;
  REFRESH_TOKEN_SECONDS?: string;
  STREAM_TICKET_SECONDS?: string;
}

export interface WorkerDependencies {
  database?: Database;
  storage?: ObjectStorage;
}

export interface UserRow {
  id: string;
  username: string;
  email: string;
  created_at: number;
  role: "user" | "admin";
}

export interface AuthContext {
  user: UserRow;
  sessionId: string;
  /** Existing external HS256 tokens have no server-side refresh session. */
  legacy?: boolean;
}

export interface SongRow {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration: number | null;
  cover_url: string | null;
  added_at: number | null;
  b2_key: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}
