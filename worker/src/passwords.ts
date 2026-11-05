import { argon2i, argon2id } from "@noble/hashes/argon2.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import bcrypt from "bcryptjs";
import { base64ToBytes, base64UrlToBytes, bytesToBase64Url, equalBytes, hexToBytes } from "./utils";

const encoder = new TextEncoder();
const DEFAULT_N = 32768;
const DEFAULT_R = 8;
const DEFAULT_P = 1;
const KEY_LENGTH = 32;

export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string") return "Password is required";
  if (password.length < 12 || password.length > 128) return "Password must be 12–128 characters";
  if (/^(password|qwerty|letmein|welcome|admin|iloveyou)/i.test(password)) {
    return "Choose a less common password";
  }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (classes < 3) return "Use at least three of: lowercase, uppercase, numbers, symbols";
  return null;
}

function scryptOptions(N: number, r: number, p: number, dkLen = KEY_LENGTH) {
  if (!Number.isSafeInteger(N) || N < 1024 || N > 131072 || (N & (N - 1)) !== 0 || r < 1 || r > 16 || p < 1 || p > 8) {
    throw new Error("Unsafe scrypt parameters");
  }
  return { N, r, p, dkLen, maxmem: Math.max(2 * 1024 * 1024, 128 * r * (N + p + 2)) };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await scryptAsync(password, salt, scryptOptions(DEFAULT_N, DEFAULT_R, DEFAULT_P));
  return `scrypt$N=${DEFAULT_N},r=${DEFAULT_R},p=${DEFAULT_P}$${bytesToBase64Url(salt)}$${bytesToBase64Url(hash)}`;
}

async function verifyScrypt(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  let N = 16384;
  let r = 8;
  let p = 1;
  let saltText: string;
  let hashText: string;
  if (parts.length === 4 && parts[0] === "scrypt") {
    for (const option of parts[1]!.split(",")) {
      const [key, value] = option.split("=");
      if (key === "N") N = Number(value);
      if (key === "r") r = Number(value);
      if (key === "p") p = Number(value);
    }
    saltText = parts[2]!;
    hashText = parts[3]!;
  } else if (parts.length === 5 && parts[0] === "" && parts[1] === "scrypt") {
    for (const option of parts[2]!.split(",")) {
      const [key, value] = option.split("=");
      if (key === "ln") N = 2 ** Number(value);
      if (key === "r") r = Number(value);
      if (key === "p") p = Number(value);
    }
    saltText = parts[3]!;
    hashText = parts[4]!;
  } else if (parts.length === 3 && parts[0] === "scrypt") {
    // Compatibility with the common salt$hash Node scrypt representation.
    saltText = parts[1]!;
    hashText = parts[2]!;
  } else {
    return false;
  }
  const salt = base64ToBytes(saltText);
  const expected = base64ToBytes(hashText);
  if (salt.length < 8 || salt.length > 64 || expected.length < 16 || expected.length > 64) return false;
  const actual = await scryptAsync(password, salt, scryptOptions(N, r, p, expected.length));
  return equalBytes(actual, expected);
}

async function derivePbkdf2(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
  algorithm: "SHA-256" | "SHA-512",
  length: number,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(iterations) || iterations < 1000 || iterations > 5_000_000 || length < 16 || length > 64) {
    throw new Error("Unsafe PBKDF2 parameters");
  }
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: algorithm, salt, iterations }, key, length * 8));
}

async function verifyPbkdf2(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  let algorithm: "SHA-256" | "SHA-512";
  let iterations: number;
  let salt: Uint8Array<ArrayBuffer>;
  let expected: Uint8Array;
  if (parts.length === 5 && parts[0] === "pbkdf2") {
    algorithm = parts[1] === "sha512" ? "SHA-512" : "SHA-256";
    iterations = Number(parts[2]);
    salt = base64ToBytes(parts[3]!);
    expected = base64ToBytes(parts[4]!);
  } else if (parts.length === 4 && /^pbkdf2_sha(256|512)$/.test(parts[0]!)) {
    // Django-compatible verification; existing records remain unchanged.
    algorithm = parts[0] === "pbkdf2_sha512" ? "SHA-512" : "SHA-256";
    iterations = Number(parts[1]);
    salt = encoder.encode(parts[2]);
    expected = base64ToBytes(parts[3]!);
  } else {
    return false;
  }
  const actual = await derivePbkdf2(password, salt, iterations, algorithm, expected.length);
  return equalBytes(actual, expected);
}

async function verifyArgon2(password: string, encoded: string): Promise<boolean> {
  const match = /^\$(argon2id|argon2i)\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(encoded);
  if (!match) return false;
  const memory = Number(match[2]);
  const iterations = Number(match[3]);
  const parallelism = Number(match[4]);
  if (memory < 8192 || memory > 131072 || iterations < 1 || iterations > 10 || parallelism < 1 || parallelism > 8) return false;
  const salt = base64ToBytes(match[5]!);
  const expected = base64ToBytes(match[6]!);
  if (salt.length < 8 || expected.length < 16 || expected.length > 64) return false;
  const options = { t: iterations, m: memory, p: parallelism, dkLen: expected.length, maxmem: 132 * 1024 * 1024 };
  const actual = match[1] === "argon2id"
    ? argon2id(password, salt, options)
    : argon2i(password, salt, options);
  return equalBytes(actual, expected);
}

/** Verify new scrypt records and common existing formats without modifying them. */
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    if (!encoded || encoded.length > 4096) return false;
    // Legacy scrypt representations sometimes use hex rather than base64.
    const hexMatch = /^scrypt\$([A-Fa-f0-9]{16,128})\$([A-Fa-f0-9]{32,128})$/.exec(encoded);
    if (hexMatch) {
      const salt = hexToBytes(hexMatch[1]!);
      const expected = hexToBytes(hexMatch[2]!);
      const actual = await scryptAsync(password, salt, scryptOptions(16384, 8, 1, expected.length));
      return equalBytes(actual, expected);
    }
    if (encoded.startsWith("scrypt$") || encoded.startsWith("$scrypt$")) return await verifyScrypt(password, encoded);
    if (encoded.startsWith("$argon2")) return await verifyArgon2(password, encoded);
    if (/^\$2[aby]\$\d\d\$/.test(encoded)) {
      // bcryptjs accepts 2a/2b; 2y has equivalent password verification semantics.
      return await bcrypt.compare(password, encoded.replace(/^\$2y\$/, "$2b$"));
    }
    if (encoded.startsWith("pbkdf2")) return await verifyPbkdf2(password, encoded);
    return false;
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;
export async function verifyDummyPassword(password: string): Promise<void> {
  if (!dummyHash) dummyHash = hashPassword("Dummy-password-not-an-account-7F!");
  await verifyPassword(password, await dummyHash);
}
