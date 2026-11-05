import type { Env, ObjectStorage } from "./types";
import { bytesToHex, sha256 } from "./utils";

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function hmac(key: CryptoKey | BufferSource, value: string): Promise<ArrayBuffer> {
  const cryptoKey = key instanceof CryptoKey
    ? key
    : await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value));
}

export class B2Storage implements ObjectStorage {
  private readonly endpoint: URL;
  private readonly region: string;

  constructor(private readonly env: Env) {
    if (!env.B2_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET) throw new Error("Backblaze B2 is not configured");
    this.endpoint = new URL(env.B2_ENDPOINT);
    if (this.endpoint.protocol !== "https:" || this.endpoint.username || this.endpoint.password || this.endpoint.pathname !== "/") {
      throw new Error("B2_ENDPOINT must be an HTTPS origin without a path or credentials");
    }
    this.region = env.B2_REGION || this.endpoint.hostname.split(".")[1] || "us-east-005";
  }

  private async request(method: string, key: string | null, body?: ArrayBuffer, mimeType?: string, range?: string | null): Promise<Response> {
    const pathParts = [this.env.B2_BUCKET, ...(key ? key.split("/") : [])];
    const canonicalUri = `/${pathParts.map(awsEncode).join("/")}`;
    const url = new URL(this.endpoint.href);
    url.pathname = canonicalUri;
    const now = new Date();
    const date = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const shortDate = date.slice(0, 8);
    const payloadHash = body ? bytesToHex(await sha256(body)) : EMPTY_SHA256;
    const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${date}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${shortDate}/${this.region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${date}\n${scope}\n${bytesToHex(await sha256(canonicalRequest))}`;
    const dateKey = await hmac(new TextEncoder().encode(`AWS4${this.env.B2_APPLICATION_KEY}`), shortDate);
    const regionKey = await hmac(dateKey, this.region);
    const serviceKey = await hmac(regionKey, "s3");
    const signingKey = await hmac(serviceKey, "aws4_request");
    const signature = bytesToHex(new Uint8Array(await hmac(signingKey, stringToSign)));
    const headers: Record<string, string> = {
      "x-amz-date": date,
      "x-amz-content-sha256": payloadHash,
      Authorization: `AWS4-HMAC-SHA256 Credential=${this.env.B2_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
    if (mimeType) headers["Content-Type"] = mimeType;
    if (range) headers.Range = range;
    return fetch(url, {
      method,
      headers,
      body: method === "PUT" ? body : undefined,
      signal: AbortSignal.timeout(method === "PUT" ? 90000 : 30000),
    });
  }

  async check(): Promise<void> {
    const response = await this.request("HEAD", null);
    if (!response.ok) throw new Error(`B2 health check failed (${response.status})`);
  }

  async put(key: string, body: ArrayBuffer, mimeType: string): Promise<void> {
    const response = await this.request("PUT", key, body, mimeType);
    if (!response.ok) throw new Error(`B2 upload failed (${response.status})`);
  }

  async get(key: string, range: string | null): Promise<Response> {
    const response = await this.request("GET", key, undefined, undefined, range);
    if (!response.ok && response.status !== 206 && response.status !== 416) {
      throw new Error(`B2 stream failed (${response.status})`);
    }
    return response;
  }

  async delete(key: string): Promise<void> {
    const response = await this.request("DELETE", key);
    if (!response.ok && response.status !== 404) throw new Error(`B2 delete failed (${response.status})`);
  }
}
