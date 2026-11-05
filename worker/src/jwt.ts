import { HttpError } from "./types";
import { base64UrlToBytes, bytesToBase64Url, equalBytes } from "./utils";

const ISSUER = "aether-cloud";
const AUDIENCE = "aether-player";
export type TokenType = "access" | "refresh" | "stream";

export interface TokenClaims {
  sub: string;
  sid: string;
  typ: TokenType;
  exp: number;
  iat: number;
  jti: string;
  song?: string;
  legacy?: boolean;
  [key: string]: unknown;
}

export interface LegacyAccessClaims {
  sub: string;
  role: "admin" | "user";
  exp: number;
}

function secretBytes(secret: string): Uint8Array {
  const bytes = new TextEncoder().encode(secret || "");
  if (bytes.length < 32) throw new HttpError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured securely");
  return bytes;
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    secretBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signToken(
  secret: string,
  claims: Omit<TokenClaims, "iat" | "exp" | "jti" | "iss" | "aud"> & {
    expiresIn: number;
  },
): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + claims.expiresIn;
  const { expiresIn, ...subjectClaims } = claims;
  const payload = {
    ...subjectClaims,
    iss: ISSUER,
    aud: AUDIENCE,
    iat: now,
    exp: expiresAt,
    jti: crypto.randomUUID(),
  };
  const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const input = `${header}.${body}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    new TextEncoder().encode(input),
  );
  return { token: `${input}.${bytesToBase64Url(new Uint8Array(signature))}`, expiresAt: expiresAt * 1000 };
}

export async function verifyToken(
  secret: string,
  token: string,
  expectedType: TokenType,
): Promise<TokenClaims> {
  try {
    if (!token || token.length > 8192) throw new Error("Invalid token size");
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid token");
    const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
    const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerPart))) as { alg?: string; typ?: string };
    if (header.alg !== "HS256" || header.typ !== "JWT") throw new Error("Unsupported token");
    const input = `${headerPart}.${payloadPart}`;
    const suppliedSignature = base64UrlToBytes(signaturePart);
    const expectedSignature = new Uint8Array(
      await crypto.subtle.sign("HMAC", await signingKey(secret), new TextEncoder().encode(input)),
    );
    if (!equalBytes(suppliedSignature, expectedSignature)) throw new Error("Invalid signature");
    const claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart))) as TokenClaims & {
      iss?: string;
      aud?: string;
      nbf?: number;
    };
    const now = Math.floor(Date.now() / 1000);
    if (
      claims.iss !== ISSUER ||
      claims.aud !== AUDIENCE ||
      claims.typ !== expectedType ||
      typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 160 ||
      typeof claims.sid !== "string" || !/^[A-Za-z0-9-]{20,80}$/.test(claims.sid) ||
      typeof claims.jti !== "string" || !claims.jti ||
      !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) ||
      claims.exp <= now || claims.iat > now + 30 || claims.exp <= claims.iat ||
      (claims.legacy !== undefined && typeof claims.legacy !== "boolean") ||
      (claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || claims.nbf > now + 30))
    ) {
      throw new Error("Invalid or expired claims");
    }
    if (expectedType === "stream" && claims.song !== undefined && typeof claims.song !== "string") {
      throw new Error("Invalid stream claim");
    }
    return claims;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "INVALID_TOKEN", "Your session is invalid or has expired. Sign in again.");
  }
}

/**
 * Verify access tokens issued by the existing trusted HS256 login system.
 * These tokens predate rotating Aether sessions and contain only sub/role/exp.
 * The role claim is validated for compatibility but is never used for
 * authorization; callers must load the current role from Turso.
 */
export async function verifyLegacyAccessToken(secret: string, token: string): Promise<LegacyAccessClaims> {
  try {
    if (!token || token.length > 8192) throw new Error("Invalid token size");
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid token");
    const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
    const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerPart))) as { alg?: string; typ?: string };
    if (header.alg !== "HS256" || (header.typ !== undefined && header.typ !== "JWT")) {
      throw new Error("Unsupported token");
    }
    const suppliedSignature = base64UrlToBytes(signaturePart);
    const expectedSignature = new Uint8Array(await crypto.subtle.sign(
      "HMAC",
      await signingKey(secret),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    ));
    if (!equalBytes(suppliedSignature, expectedSignature)) throw new Error("Invalid signature");
    const claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart))) as Partial<LegacyAccessClaims>;
    if (
      typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 160 ||
      (claims.role !== "admin" && claims.role !== "user") ||
      !Number.isInteger(claims.exp) || (claims.exp as number) <= Math.floor(Date.now() / 1000)
    ) {
      throw new Error("Invalid or expired claims");
    }
    return claims as LegacyAccessClaims;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "INVALID_TOKEN", "Your session is invalid or has expired. Sign in again.");
  }
}
