import { createHmac, timingSafeEqual } from "node:crypto";

/** Verifica o `signed_request` que a Meta envia nos callbacks de
 * desautorização e de exclusão de dados.
 * Formato: `<assinatura base64url>.<payload base64url>`; a assinatura é o
 * HMAC-SHA256 da parte do payload (ainda codificada) com o App Secret. */

export interface MetaSignedPayload {
  user_id: string;
  algorithm: string;
  issued_at?: number;
}

const B64URL = /^[A-Za-z0-9_-]+$/;
const MAX_LENGTH = 4096;

export function parseSignedRequest(signedRequest: string, appSecret: string): MetaSignedPayload | null {
  if (signedRequest.length > MAX_LENGTH) return null;
  const parts = signedRequest.split(".");
  if (parts.length !== 2 || !B64URL.test(parts[0]) || !B64URL.test(parts[1])) return null;
  const [encodedSig, encodedPayload] = parts;

  const received = Buffer.from(encodedSig, "base64url");
  const expected = createHmac("sha256", appSecret).update(encodedPayload).digest();
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as MetaSignedPayload;
    if (!payload || typeof payload !== "object") return null;
    if (typeof payload.algorithm !== "string" || payload.algorithm.toUpperCase() !== "HMAC-SHA256") return null;
    if (typeof payload.user_id !== "string" || !payload.user_id) return null;
    return payload;
  } catch {
    return null;
  }
}
