import { NextRequest, NextResponse } from "next/server";
import { readMetaSignedRequest } from "@/lib/meta-ads/callback-request";
import { deleteMetaUserData } from "@/lib/meta-ads/data-deletion";

export const runtime = "nodejs";

/** "Deauthorize Callback URL" do app na Meta: chamada quando o usuário remove
 * o app nas configurações do Facebook. Apaga a conexão (token incluído) e os
 * dados importados da Marketing API. */
export async function POST(request: NextRequest) {
  const payload = await readMetaSignedRequest(request);
  if (payload instanceof NextResponse) return payload;

  try {
    await deleteMetaUserData(payload.user_id, "deauthorize");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[meta-ads] falha na desautorização:", err instanceof Error ? err.message : "erro");
    return NextResponse.json({ error: "Falha ao processar a desautorização." }, { status: 500 });
  }
}
