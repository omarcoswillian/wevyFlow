import { NextRequest, NextResponse } from "next/server";
import { getMetaAppCredentials } from "@/lib/meta-ads/server";
import { parseSignedRequest, type MetaSignedPayload } from "@/lib/meta-ads/signed-request";

const MAX_BODY_BYTES = 8 * 1024;

/** Lê e valida o signed_request de um callback público da Meta. Rejeita
 * antes de qualquer trabalho caro: tipo de conteúdo errado, corpo grande,
 * campo ausente ou assinatura inválida. Devolve o payload ou uma Response. */
export async function readMetaSignedRequest(request: NextRequest): Promise<MetaSignedPayload | NextResponse> {
  const bad = (status: number, error: string) => NextResponse.json({ error }, { status });

  if (!(request.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
    return bad(415, "Tipo de conteúdo não suportado.");
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return bad(413, "Corpo muito grande.");

  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) return bad(413, "Corpo muito grande.");

  const signed = new URLSearchParams(text).get("signed_request");
  if (!signed) return bad(400, "Requisição inválida.");

  let appSecret: string;
  try {
    appSecret = getMetaAppCredentials().appSecret;
  } catch {
    return bad(503, "Integração indisponível.");
  }
  const payload = parseSignedRequest(signed, appSecret);
  return payload ?? bad(400, "Requisição inválida.");
}
