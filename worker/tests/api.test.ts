import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { createHmac } from "node:crypto";
import { call, cookie, env, fixture, json, jsonBody, wavFile } from "./helpers";

function externalToken(subject: string, role: "admin" | "user" = "admin", exp = Math.floor(Date.now() / 1000) + 300): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const input = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: subject, role, exp })}`;
  const signature = createHmac("sha256", env.AUTH_SECRET).update(input).digest("base64url");
  return `${input}.${signature}`;
}

const registration = {
  username: "listener_one",
  email: "one@example.com",
  password: "Correct-Horse-42!",
  confirmPassword: "Correct-Horse-42!",
};

async function register(handler: any, value = registration) {
  const response = await call(handler, "/auth/register", jsonBody(value));
  const body = await json(response);
  assert.equal(response.status, 200, JSON.stringify(body));
  return { response, body, cookie: cookie(response) };
}

test("complete cloud music and authorization flow", async () => {
  const { handler, database, storage } = fixture();

  const preflight = await call(handler, "/upload", { method: "OPTIONS" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://ayushghbk-afk.github.io");
  assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");

  const foreign = await call(handler, "/songs", { origin: "https://attacker.example" });
  assert.equal(foreign.status, 403);

  const health = await call(handler, "/health");
  assert.equal(health.status, 200);
  assert.equal((await json(health)).storage, "Backblaze B2 connected");

  const weak = await call(handler, "/auth/register", jsonBody({ ...registration, password: "password", confirmPassword: "password" }));
  assert.equal(weak.status, 400);
  assert.equal((await json(weak)).code, "WEAK_PASSWORD");

  const first = await register(handler);
  assert.equal(first.body.user.role, "user", "browser-supplied roles must never grant admin");
  assert.equal(first.body.user.email, registration.email);
  assert.ok(first.body.accessToken);
  assert.ok(first.cookie.includes("aether_refresh="));
  assert(!JSON.stringify(first.body).includes("password_hash"));

  const duplicate = await call(handler, "/auth/register", jsonBody({ ...registration, username: "different" }));
  assert.equal(duplicate.status, 409);

  const wrong = await call(handler, "/auth/login", jsonBody({ email: registration.email, password: "Wrong-password-42!" }));
  const unknown = await call(handler, "/auth/login", jsonBody({ email: "nobody@example.com", password: "Wrong-password-42!" }));
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal((await json(wrong)).error, (await json(unknown)).error);

  const login = await call(handler, "/auth/login", jsonBody({ email: registration.email.toUpperCase(), password: registration.password }));
  assert.equal(login.status, 200);
  const session = await json(login);
  const refreshCookie = cookie(login);
  const token = session.accessToken as string;

  const me = await call(handler, "/auth/me", { token });
  const meBody = await json(me);
  assert.equal(meBody.user.id, first.body.user.id);
  assert(!JSON.stringify(meBody).includes("password_hash"));

  const second = await register(handler, {
    username: "listener_two",
    email: "two@example.com",
    password: "Another-Strong-99!",
    confirmPassword: "Another-Strong-99!",
  });

  const form = new FormData();
  form.set("file", wavFile());
  form.set("title", "Cloud test tone");
  form.set("artist", "Aether tests");
  form.set("album", "Integration");
  form.set("duration", "2");
  form.set("uploaded_by", second.body.user.id); // Must be ignored; owner comes from JWT + DB.
  const upload = await call(handler, "/upload", { method: "POST", token, body: form });
  const uploaded = await json(upload);
  assert.equal(upload.status, 201, JSON.stringify(uploaded));
  assert.equal(uploaded.song.uploaded_by, first.body.user.id);
  assert.equal(uploaded.song.file_size, wavFile().size);
  assert(!("b2_key" in uploaded.song), "private object keys must not be returned");
  assert.equal(storage.objects.size, 1);
  const storedUpload = database.raw.prepare("SELECT b2_key,added_at FROM songs WHERE id=?").get(uploaded.song.id) as any;
  assert.match(String(storedUpload.b2_key), /^songs\/.+\.wav$/, "new uploads use the supplied Worker's key layout");
  assert.ok(Number(storedUpload.added_at) < 1e12, "song timestamps retain the existing Unix-seconds convention");

  const publicSongs = await json(await call(handler, "/songs"));
  assert.equal(publicSongs.songs.length, 1);
  assert(!publicSongs.songs[0].stream_url);
  assert(!("b2_key" in publicSongs.songs[0]));

  const privateSongs = await json(await call(handler, "/songs", { token }));
  const streamUrl = new URL(privateSongs.songs[0].stream_url);
  assert(streamUrl.searchParams.get("ticket"));
  const songId = privateSongs.songs[0].id;

  const unauthenticatedStream = await call(handler, `/stream/${songId}`);
  assert.equal(unauthenticatedStream.status, 401);
  const range = await call(handler, `${streamUrl.pathname}${streamUrl.search}`, {
    headers: { Range: "bytes=4-13" },
  });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get("content-range"), `bytes 4-13/${wavFile().size}`);
  assert.equal((await range.arrayBuffer()).byteLength, 10);
  assert.equal(range.headers.get("accept-ranges"), "bytes");

  const forbiddenDelete = await call(handler, `/songs/${songId}`, { method: "DELETE", token: second.body.accessToken });
  assert.equal(forbiddenDelete.status, 403);
  assert.equal(storage.objects.size, 1);

  // Owner-only promotion: this is a direct DB operation, never a public endpoint.
  await database.query("UPDATE users SET role='admin' WHERE id=?", [first.body.user.id]);
  const adminUsers = await call(handler, "/admin/users", { token });
  assert.equal(adminUsers.status, 200);
  const adminBody = await json(adminUsers);
  assert.equal(adminBody.users.length, 2);
  assert(!JSON.stringify(adminBody).includes("password_hash"));

  const userAdminAttempt = await call(handler, "/admin/users", { token: second.body.accessToken });
  assert.equal(userAdminAttempt.status, 403);
  const selfRole = await call(handler, `/admin/users/${first.body.user.id}/role`, {
    ...jsonBody({ role: "user" }), token,
  });
  assert.equal(selfRole.status, 409);
  const promote = await call(handler, `/admin/users/${second.body.user.id}/role`, {
    ...jsonBody({ role: "admin" }), token,
  });
  assert.equal(promote.status, 200);
  assert.equal((await json(promote)).user.role, "admin");

  const deleted = await call(handler, `/songs/${songId}`, { method: "DELETE", token });
  assert.equal(deleted.status, 200);
  assert.equal(storage.objects.size, 0);
  assert.equal((await json(await call(handler, "/songs"))).songs.length, 0);

  const refreshed = await call(handler, "/auth/refresh", { method: "POST", cookie: refreshCookie });
  assert.equal(refreshed.status, 200);
  const refreshedBody = await json(refreshed);
  const rotatedCookie = cookie(refreshed);
  assert.ok(refreshedBody.accessToken);
  assert.notEqual(rotatedCookie, refreshCookie);

  const replay = await call(handler, "/auth/refresh", { method: "POST", cookie: refreshCookie });
  assert.equal(replay.status, 401);
  assert.equal((await json(replay)).code, "SESSION_REPLAY");
  const revokedAccess = await call(handler, "/auth/me", { token: refreshedBody.accessToken });
  assert.equal(revokedAccess.status, 401);
});

test("existing external HS256 tokens retain private streaming and use current Turso roles", async () => {
  const { handler, database, storage } = fixture();
  const health = await call(handler, "/health");
  assert.equal(health.status, 200);
  await database.query(
    "INSERT INTO users(id,username,email,password_hash,created_at,role) VALUES(?,?,?,?,?,?)",
    ["external-user", "external", "external@example.com", "not-used-for-token-auth", Math.floor(Date.now() / 1000), "user"],
  );
  const audio = wavFile();
  storage.objects.set("songs/existing-song.wav", {
    bytes: new Uint8Array(await audio.arrayBuffer()),
    mime: "audio/wav",
  });
  await database.query(
    `INSERT INTO songs(id,title,artist,album,duration,cover_url,added_at,b2_key,mime_type,file_size,uploaded_by)
     VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    ["existing-song", "Existing upload", "Legacy", null, 2, null, Math.floor(Date.now() / 1000), "songs/existing-song.wav", "audio/wav", audio.size, "external-user"],
  );

  // The token claims admin, but Turso says user. The database must win.
  const token = externalToken("external-user", "admin");
  const me = await call(handler, "/auth/me", { token });
  assert.equal(me.status, 200);
  assert.equal((await json(me)).user.role, "user");
  assert.equal((await call(handler, "/admin/users", { token })).status, 403);

  const songs = await json(await call(handler, "/songs", { token }));
  const stream = new URL(songs.songs[0].stream_url);
  assert.equal((await call(handler, "/stream/existing-song")).status, 401);
  const playback = await call(handler, `${stream.pathname}${stream.search}`, {
    headers: { Range: "bytes=0-9" },
  });
  assert.equal(playback.status, 206);
  assert.equal((await playback.arrayBuffer()).byteLength, 10);

  await database.query("UPDATE users SET role='admin' WHERE id=?", ["external-user"]);
  assert.equal((await call(handler, "/admin/users", { token })).status, 200, "role changes take effect without minting a new external token");
  const expired = externalToken("external-user", "admin", Math.floor(Date.now() / 1000) - 1);
  assert.equal((await call(handler, "/auth/me", { token: expired })).status, 401);
});

test("migrations preserve an existing bcrypt user and add only missing columns", async () => {
  const password = "Legacy-Password-7!";
  const originalHash = bcrypt.hashSync(password, 4);
  const { handler, database } = fixture((db) => {
    db.raw.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT NOT NULL,email TEXT NOT NULL,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE songs(id TEXT PRIMARY KEY,title TEXT NOT NULL,artist TEXT,album TEXT,duration INTEGER,cover_url TEXT,added_at INTEGER);`);
    db.raw.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run("legacy-user", "legacy", "legacy@example.com", originalHash, Date.now());
  });
  const login = await call(handler, "/auth/login", jsonBody({ email: "legacy@example.com", password }));
  assert.equal(login.status, 200, JSON.stringify(await json(login)));
  const stored = database.raw.prepare("SELECT password_hash,role FROM users WHERE id='legacy-user'").get() as any;
  assert.equal(stored.password_hash, originalHash, "login must not silently rewrite legacy hashes");
  assert.equal(stored.role, "user");
  const songColumns = database.raw.prepare("PRAGMA table_info(songs)").all().map((row: any) => row.name);
  for (const column of ["b2_key", "mime_type", "file_size", "uploaded_by"]) assert(songColumns.includes(column));
});

test("login rate limit is persistent and returns Retry-After", async () => {
  const { handler } = fixture();
  let last: Response | null = null;
  for (let attempt = 0; attempt < 9; attempt++) {
    last = await call(handler, "/auth/login", jsonBody({ email: "missing@example.com", password: "Wrong-password-42!" }));
  }
  assert.equal(last!.status, 429);
  assert.equal((await json(last!)).code, "RATE_LIMITED");
  assert.ok(Number(last!.headers.get("retry-after")) > 0);
});

test("CORS and method errors are consistent JSON", async () => {
  const { handler } = fixture();
  const response = await call(handler, "/does-not-exist");
  assert.equal(response.status, 404);
  const body = await json(response);
  assert.equal(body.success, false);
  assert.equal(body.code, "NOT_FOUND");
  assert.equal(response.headers.get("access-control-allow-origin"), env.CORS_ORIGINS);
});
