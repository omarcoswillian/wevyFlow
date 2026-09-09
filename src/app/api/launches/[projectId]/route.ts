import { NextRequest, NextResponse } from "next/server";
import {
  getLaunchByProjectId,
  saveLaunch,
  deleteLaunch,
  launchErrorResponse,
} from "@/lib/launches/server";
import { mergeBriefing, validateBriefing, isValidStrategyId, BRIEFING_LIMITS, type LaunchBriefing } from "@/app/lib/launch-briefing";
import type { KitAssetInstance, BrandIdentity, EmailSequences, LaunchStatus, StrategyId } from "@/app/lib/types-kit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const launch = await getLaunchByProjectId(projectId);
    return NextResponse.json({ launch });
  } catch (err) {
    const { body, status } = launchErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;

    // See POST /api/launches for why this runs before `req.json()` (review
    // pendency 8) — an early exit for the common case, not a substitute for
    // the post-parse byte check further below.
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
      briefing?: Partial<LaunchBriefing>;
      strategyId?: StrategyId | null;
      status?: LaunchStatus;
      brandKitId?: string | null;
      // Existing LaunchHub behavior — allow-listed fields only, never
      // arbitrary client state (spec: explicit allow-list, no owner/ID override).
      assets?: KitAssetInstance[];
      brandIdentity?: BrandIdentity | null;
      emailSequences?: EmailSequences;
    };

    if (body.strategyId !== undefined && body.strategyId !== null && !isValidStrategyId(body.strategyId)) {
      return NextResponse.json({ error: "Estratégia de lançamento inválida." }, { status: 400 });
    }

    // Known residual limitation (see launches review item 7): this reads
    // the current row, merges in JS, then writes the merged briefing back —
    // not a single atomic read-modify-write. Two concurrent PATCHes to the
    // same launch (e.g. two open tabs, or two LaunchHub saves that aren't
    // already serialized by the client — see saveLaunchKit's queue in
    // _context.tsx, which covers the common single-tab case) can still both
    // read the same version and the later write wins on the fields it
    // didn't itself change. Full optimistic-locking in save_launch would
    // close this but was judged out of scope for this fix pass.
    const current = await getLaunchByProjectId(projectId);

    const briefing = body.briefing
      ? mergeBriefing(current.briefing, body.briefing)
      : current.briefing;

    if (body.briefing) {
      const validationErrors = validateBriefing(briefing);
      if (validationErrors.length) {
        return NextResponse.json({ error: "Briefing inválido.", details: validationErrors }, { status: 400 });
      }
    }

    // Distinguish "field omitted" (don't touch it) from "field explicitly
    // sent as null" (clear it) for strategyId/brandIdentity — a plain
    // `?? current.value` collapses both to the same coalesce-preserves-old
    // behavior in the RPC, so an explicit clear was silently ignored (see
    // launches review item 9).
    const strategyProvided = "strategyId" in body && body.strategyId !== undefined;
    const clearStrategy = strategyProvided && body.strategyId === null;
    const brandIdentityProvided = "brandIdentity" in body && body.brandIdentity !== undefined;
    const clearBrandIdentity = brandIdentityProvided && body.brandIdentity === null;
    // Same omitted-vs-explicit-null distinction as strategyId/brandIdentity
    // above, extended to brandKitId (see launches review item J) — a plain
    // `?? current` collapses "clear it" into "leave unchanged".
    const brandKitIdProvided = "brandKitId" in body && body.brandKitId !== undefined;
    const clearBrandKitId = brandKitIdProvided && body.brandKitId === null;

    const launch = await saveLaunch({
      projectId,
      briefing,
      strategyId: strategyProvided ? body.strategyId : current.strategyId,
      clearStrategy,
      // Omitted status now means "leave unchanged" (preserves e.g.
      // 'archived' instead of silently downgrading to 'draft' — see
      // launches review item 9), not "downgrade to draft unless active".
      status: body.status,
      brandKitId: brandKitIdProvided ? body.brandKitId : null,
      clearBrandKitId,
      assets: body.assets ?? null,
      brandIdentity: brandIdentityProvided ? body.brandIdentity : null,
      clearBrandIdentity,
      emailSequences: body.emailSequences ?? null,
    });

    return NextResponse.json({ launch });
  } catch (err) {
    const { body: errBody, status } = launchErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    await deleteLaunch(projectId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { body, status } = launchErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
