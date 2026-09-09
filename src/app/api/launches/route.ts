import { NextRequest, NextResponse } from "next/server";
import { listLaunches, saveLaunch, launchErrorResponse } from "@/lib/launches/server";
import { emptyBriefing, mergeBriefing, validateBriefing, isValidStrategyId, BRIEFING_LIMITS, type LaunchBriefing } from "@/app/lib/launch-briefing";
import type { StrategyId } from "@/app/lib/types-kit";

export async function GET() {
  try {
    const launches = await listLaunches();
    return NextResponse.json({ launches });
  } catch (err) {
    const { body, status } = launchErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Reject an oversized body by its declared Content-Length before
    // `req.json()` buffers the whole thing into memory — the size check
    // further below only runs after parsing, so on its own a large-enough
    // payload gets fully parsed before being rejected (see review pendency 8).
    // Not a substitute for that check (Content-Length can be absent or
    // wrong), just an early exit for the common case.
    const declaredLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > BRIEFING_LIMITS.maxTotalRequestBytes) {
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
    if (bodyBytes > BRIEFING_LIMITS.maxTotalRequestBytes) {
      return NextResponse.json({ error: "Requisição excede o tamanho máximo permitido." }, { status: 400 });
    }

    const body = rawBody as {
      clientToken?: string;
      briefing?: Partial<LaunchBriefing>;
      strategyId?: StrategyId | null;
      status?: "draft" | "active";
      brandKitId?: string | null;
    };

    if (typeof body.clientToken !== "string" || !body.clientToken.trim()) {
      return NextResponse.json({ error: "clientToken obrigatório (texto)." }, { status: 400 });
    }

    if (body.strategyId != null && !isValidStrategyId(body.strategyId)) {
      return NextResponse.json({ error: "Estratégia de lançamento inválida." }, { status: 400 });
    }

    const briefing = mergeBriefing(emptyBriefing(), body.briefing ?? {});
    const validationErrors = validateBriefing(briefing);
    if (validationErrors.length) {
      return NextResponse.json({ error: "Briefing inválido.", details: validationErrors }, { status: 400 });
    }

    const launch = await saveLaunch({
      projectId: null,
      clientToken: body.clientToken,
      briefing,
      strategyId: body.strategyId ?? null,
      status: body.status === "active" ? "active" : "draft",
      brandKitId: body.brandKitId ?? null,
    });

    return NextResponse.json({ launch });
  } catch (err) {
    const { body: errBody, status } = launchErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
