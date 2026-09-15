import { createClient } from "@/lib/supabase/server";
import { requireLaunch, launchErrorResponse } from "@/lib/launches/server";
import { parseApiError } from "../../../lib/ai-client";
import { generateAdCopy, type AdCopyFacts } from "../../../lib/copy/generate-ads";

export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Faça login para continuar." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { type = "ads", projectId, productName, niche, targetAudience, transformation, price, provas, tone, apiKey, aiProvider, aiModel } = body;

  if (type !== "ads") {
    return Response.json({ error: `Tipo de copy "${type}" ainda não implementado.` }, { status: 400 });
  }

  // Launch mode: canonical facts come from the persisted briefing, never from
  // client-supplied fields — same reasoning as /api/generate (a launch for
  // product A must not be usable to generate copy for product B).
  let facts: AdCopyFacts = { productName, niche, targetAudience, transformation, price, provas, tone };
  if (projectId) {
    try {
      const launch = await requireLaunch(projectId);
      facts = {
        productName: launch.brandInfo.productName,
        niche: launch.brandInfo.niche,
        targetAudience: launch.brandInfo.targetAudience,
        transformation: launch.brandInfo.transformation,
        price: launch.brandInfo.preco,
        provas: launch.brandInfo.provas,
        tone,
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
    const { options, model } = await generateAdCopy(facts, { apiKey, aiProvider, aiModel });
    return Response.json({ options, model, context: facts });
  } catch (e: unknown) {
    console.error("[copy/generate] error:", e);
    const { status, message } = parseApiError(e, aiProvider || "anthropic");
    return Response.json({ error: message }, { status: e instanceof Error && /não retornou opções/.test(e.message) ? 502 : status });
  }
}
