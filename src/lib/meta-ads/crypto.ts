import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Criptografia em repouso do access_token da Meta (AES-256-GCM).
 *
 * Formato guardado na coluna: `enc:v1:<iv>:<tag>:<ciphertext>` (base64url).
 * O user_id entra como AAD, então um token copiado pra linha de outro
 * usuário não decifra. O prefixo de versão deixa a rotação de chave futura
 * possível sem migração destrutiva.
 *
 * Fail closed: valor sem o prefixo NÃO é aceito como texto puro. Uma conexão
 * antiga em texto puro (se existir) simplesmente exige reconectar.
 *
 * Chave: META_TOKEN_ENCRYPTION_KEY = 32 bytes em base64
 *   (gerar com: openssl rand -base64 32). */

const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const B64URL = /^[A-Za-z0-9_-]+$/;

export function isMetaTokenKeyConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

function getKey(): Buffer {
  const raw = process.env.META_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("META_TOKEN_ENCRYPTION_KEY não configurada.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("META_TOKEN_ENCRYPTION_KEY deve ter 32 bytes em base64.");
  return key;
}

const aad = (userId: string) => Buffer.from(`meta_ads_connections:${userId}`, "utf8");

export function encryptToken(plain: string, userId: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad(userId));
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptToken(stored: string, userId: string): string {
  if (!stored.startsWith(PREFIX)) throw new Error("Token não criptografado: reconecte a conta Meta.");
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3 || !parts.every((p) => B64URL.test(p))) throw new Error("Token criptografado em formato inválido.");
  const [iv, tag, ciphertext] = parts.map((p) => Buffer.from(p, "base64url"));
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || ciphertext.length === 0) {
    throw new Error("Token criptografado em formato inválido.");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(aad(userId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
