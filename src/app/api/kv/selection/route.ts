import { NextRequest, NextResponse } from "next/server";
import { launchErrorResponse } from "@/lib/launches/server";
import { selectKvAsset } from "@/lib/launches/kv-assets";

// Este corpo só carrega dois UUIDs — bem menos que o limite genérico de
// briefing (BRIEFING_LIMITS), então usamos um teto pequeno próprio aqui.
const MAX_SELECTION_BODY_BYTES = 2_000;

export async function POST(req: NextRequest) {
  try {
    const declaredLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_SELECTION_BODY_BYTES) {
      return NextResponse.json({ error: "Requisição excede o tamanho máximo permitido." }, { status: 400 });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Corpo da requisição inválido (JSON malformado)." }, { status: 400 });
    }
    if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
      return NextResponse.json({ error: "Corpo da requisição deve ser um objeto." }, { status: 400 });
    }
    const bodyBytes = new TextEncoder().encode(JSON.stringify(rawBody)).length;
    if (bodyBytes > MAX_SELECTION_BODY_BYTES) {
      return NextResponse.json({ error: "Requisição excede o tamanho máximo permitido." }, { status: 400 });
    }

    const { projectId, assetId } = rawBody as { projectId?: unknown; assetId?: unknown };
    const result = await selectKvAsset(projectId, assetId);
    return NextResponse.json({ selection: result });
  } catch (err) {
    const { body, status } = launchErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
