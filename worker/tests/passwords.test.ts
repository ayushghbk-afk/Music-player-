import test from "node:test";
import assert from "node:assert/strict";
import { argon2id } from "@noble/hashes/argon2.js";
import { hashPassword, passwordProblem, verifyPassword } from "../src/passwords";
import { bytesToBase64Url } from "../src/utils";

test("new accounts use salted scrypt and reject incorrect passwords", async () => {
  const password = "A-long-unique-password-55!";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.match(first, /^scrypt\$N=32768,r=8,p=1\$/);
  assert.notEqual(first, second, "salts must be random");
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong-password", first), false);
  assert.equal(passwordProblem("short"), "Password must be 12–128 characters");
  assert.equal(passwordProblem(password), null);
});

test("existing Argon2id records can still authenticate without rehashing", async () => {
  const password = "Existing-Argon2-User-9!";
  const salt = new TextEncoder().encode("existing-salt-16");
  const hash = argon2id(password, salt, { t: 1, m: 8192, p: 1, dkLen: 32, maxmem: 16 * 1024 * 1024 });
  const encoded = `$argon2id$v=19$m=8192,t=1,p=1$${bytesToBase64Url(salt)}$${bytesToBase64Url(hash)}`;
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword("Incorrect-password-9!", encoded), false);
});
