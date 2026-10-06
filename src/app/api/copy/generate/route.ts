import { createClient } from "@/lib/supabase/server";
import { requireLaunch, launchErrorResponse } from "@/lib/launches/server";
import type { BrandIdentity } from "../../../lib/types-kit";
import { parseApiError } from "../../../lib/ai-client";
import { generateAdCopy, type AdCopyFacts } from "../../../lib/copy/generate-ads";
import { generateKindCopy } from "../../../lib/copy/generate-copy";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Faça login para continuar." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { type = "ads", projectId, productName, niche, targetAudience, transformation, price, provas, tone, apiKey, aiProvider, aiModel } = body;

  if (type !== "ads" && type !== "carrossel" && type !== "thumb") {
    return Response.json({ error: `Tipo de copy "${type}" ainda não implementado.` }, { status: 400 });
  }

  // Launch mode: canonical facts come from the persisted briefing, never from
  // client-supplied fields — same reasoning as /api/generate (a launch for
  // product A must not be usable to generate copy for product B).
  let facts: AdCopyFacts = { productName, niche, targetAudience, transformation, price, provas, tone };
  if (projectId) {
    try {
      const launch = await requireLaunch(projectId);
      // Approved brand identity carries the brand's voice (concept + personality
      // words) — used as the tone default only when the caller didn't ask for a
      // specific one, same "launch is source of truth, client can still steer
      // per-generation" precedent as the style resolution in generate/route.ts.
      const identity: BrandIdentity | undefined =
        launch.brandIdentity?.status === "approved" ? launch.brandIdentity : undefined;
      const identityTone = identity
        ? [identity.concept, identity.words.join(", ")].filter(Boolean).join(" — ")
        : undefined;
      facts = {
        productName: launch.brandInfo.productName,
        niche: launch.brandInfo.niche,
        targetAudience: launch.brandInfo.targetAudience,
        transformation: launch.brandInfo.transformation,
        price: launch.brandInfo.preco,
        provas: launch.brandInfo.provas,
        tone: tone || identityTone,
      };
    } catch (err) {
      const { body: errBody, status } = launchErrorResponse(err);
      return Response.json(errBody, { status });
    }
  }

  if (!facts.productName?.trim() && !facts.niche?.trim()) {
    return Response.json({ error: "Informe ao menos o produto ou o nicho." }, { status: 400 });
  }

  try {
    const auth = { apiKey, aiProvider, aiModel };
    const { options, model } = type === "ads" ? await generateAdCopy(facts, auth) : await generateKindCopy(type, facts, auth);
    return Response.json({ options, model, context: facts });
  } catch (e: unknown) {
    console.error("[copy/generate] error:", e);
    const { status, message } = parseApiError(e, aiProvider || "anthropic");
    return Response.json({ error: message }, { status: e instanceof Error && /não retornou opções/.test(e.message) ? 502 : status });
  }
}
