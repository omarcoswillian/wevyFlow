import { NextRequest, NextResponse } from "next/server";
import { resolveAppOrigin } from "@/lib/meta-ads/server";
import { readMetaSignedRequest } from "@/lib/meta-ads/callback-request";
import { deleteMetaUserData } from "@/lib/meta-ads/data-deletion";

export const runtime = "nodejs";

/** "Data Deletion Request URL" do app na Meta. A Meta faz POST
 * (application/x-www-form-urlencoded) com `signed_request` quando o usuário
 * pede a exclusão dos dados. Rota pública (/api é público no proxy) — a
 * autenticidade vem da assinatura HMAC com o App Secret. */
export async function POST(request: NextRequest) {
  const payload = await readMetaSignedRequest(request);
  if (payload instanceof NextResponse) return payload;

  try {
    const { confirmationCode } = await deleteMetaUserData(payload.user_id, "deletion");
    const origin = resolveAppOrigin(request.url);
    return NextResponse.json({
      url: `${origin}/api/integrations/meta-ads/data-deletion/status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (err) {
    console.error("[meta-ads] falha na exclusão de dados:", err instanceof Error ? err.message : "erro");
    return NextResponse.json({ error: "Falha ao processar a exclusão." }, { status: 500 });
  }
}
