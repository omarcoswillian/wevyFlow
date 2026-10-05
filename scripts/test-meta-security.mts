// Roda com: node --experimental-strip-types scripts/test-meta-security.mts
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { encryptToken, decryptToken } from "../src/lib/meta-ads/crypto.ts";
import { parseSignedRequest } from "../src/lib/meta-ads/signed-request.ts";

process.env.META_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

// criptografia: ida e volta, aleatória, presa ao usuário, resistente a adulteração
const enc = encryptToken("EAAB-token", "user-1");
assert.ok(enc.startsWith("enc:v1:") && !enc.includes("EAAB"));
assert.equal(decryptToken(enc, "user-1"), "EAAB-token");
assert.notEqual(enc, encryptToken("EAAB-token", "user-1"));
assert.throws(() => decryptToken(enc, "user-2"));
const parts = enc.split(":");
parts[4] = Buffer.from("x").toString("base64url");
assert.throws(() => decryptToken(parts.join(":"), "user-1"));
assert.throws(() => decryptToken("legacy-plain", "user-1")); // fail closed
const shortTag = enc.split(":"); shortTag[3] = Buffer.from(shortTag[3], "base64url").subarray(0, 4).toString("base64url");
assert.throws(() => decryptToken(shortTag.join(":"), "user-1")); // tag truncada
assert.throws(() => decryptToken(enc.replace("enc:v1:", "enc:v1:!!!!"), "user-1"));
process.env.META_TOKEN_ENCRYPTION_KEY = randomBytes(16).toString("base64");
assert.throws(() => encryptToken("x", "u"));
delete process.env.META_TOKEN_ENCRYPTION_KEY;
assert.throws(() => encryptToken("x", "u"));

// signed_request
const secret = "app-secret";
const sign = (payload: object, key = secret) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${createHmac("sha256", key).update(body).digest("base64url")}.${body}`;
};
assert.equal(parseSignedRequest(sign({ algorithm: "HMAC-SHA256", user_id: "123" }), secret)?.user_id, "123");
assert.equal(parseSignedRequest(sign({ algorithm: "HMAC-SHA256", user_id: "123" }, "outro"), secret), null);
assert.equal(parseSignedRequest(sign({ algorithm: "HMAC-SHA1", user_id: "123" }), secret), null);
assert.equal(parseSignedRequest(sign({ algorithm: "HMAC-SHA256" }), secret), null);
assert.equal(parseSignedRequest(sign({ user_id: "123" }), secret), null); // sem algorithm
const okSig = sign({ algorithm: "HMAC-SHA256", user_id: "1" });
assert.equal(parseSignedRequest("!!!!" + okSig, secret), null); // base64url nao canonico
assert.equal(parseSignedRequest(okSig + "A".repeat(5000), secret), null); // grande demais
assert.equal(parseSignedRequest("lixo", secret), null);
assert.equal(parseSignedRequest("a.b.c", secret), null);
const [sig, body] = sign({ user_id: "1" }).split(".");
const forged = Buffer.from(JSON.stringify({ user_id: "2" })).toString("base64url");
assert.equal(parseSignedRequest(`${sig}.${forged}`, secret), null);
assert.ok(body);
console.log("ok: todos os testes passaram");
