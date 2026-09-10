import { NextRequest, NextResponse } from "next/server";
import { checkAndDeductCredit, isCreditError, limitReachedResponse, finalizeGeneration } from "../../lib/credits";
import { requireLaunch, launchErrorResponse } from "@/lib/launches/server";
import { generateLogoCandidate, validateGenerateLogoInput, LogoGenerationError } from "./shared";

export async function POST(req: NextRequest) {
  let generationId: string | undefined;
  try {
    const { dna, apiKey, imageProvider, imageModel, projectId, direction, referenceImages } = await req.json();

    // projectId agora é opcional (pedido do dono: geração avulsa não deve
    // exigir lançamento) — quando ausente, não há briefing pra proteger, e
    // os dados vêm direto do corpo. Quando presente, mantém a garantia de
    // integridade original (launches review item F): não deixar um
    // lançamento do produto A renderizar logo pro produto B só trocando
    // dna.name na requisição.
    let launch: Awaited<ReturnType<typeof requireLaunch>> | null = null;
    if (projectId) {
      try {
        launch = await requireLaunch(projectId);
      } catch (err) {
        const { body, status } = launchErrorResponse(err);
        return NextResponse.json(body, { status });
      }
    }

    // Validated BEFORE spending a credit — a malformed dna/provider/direction
    // or an invalid reference image must never charge (and then have to
    // refund) a credit for a request that could never have succeeded (achado
    // de revisão do Codex).
    let validated: ReturnType<typeof validateGenerateLogoInput>;
    try {
      validated = validateGenerateLogoInput({
        dna,
        imageProvider,
        direction,
        referenceImages: launch ? launch.brandInfo.referenceImages : referenceImages,
      });
    } catch (err) {
      if (err instanceof LogoGenerationError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    // Brand identity (name/niche) comes from the persisted launch briefing,
    // not whatever the client sent — otherwise a launch for product A could
    // be used to render a logo for product B just by changing `dna.name` in
    // the request (see launches review item F). Tagline, personality,
    // voice, visual style, color, logo type and variant stay client-driven
    // — those are this specific logo attempt's creative choices, not
    // identity facts owned by the briefing. Skipped entirely without a
    // launch — dna.name/niche are then the only source, same as pre-P0.
    if (launch) {
      validated.dna.name = launch.brandInfo.productName || validated.dna.name;
      validated.dna.niche = launch.brandInfo.niche || validated.dna.niche;
    }

    // Every logo call — including BYOK — consumes a plan credit, same
    // policy as generate-criativo. This route previously had no auth or
    // quota check: anyone who found the URL could call it for free, and
    // the Gemini branch falls back to WevyFlow's own server-side key.
    const creditResult = await checkAndDeductCredit("logo", validated.dna.name);
    if (isCreditError(creditResult)) {
      return NextResponse.json({ error: creditResult.error }, { status: creditResult.status });
    }
    if (!creditResult.allowed) {
      return limitReachedResponse(creditResult) as NextResponse;
    }
    generationId = creditResult.generationId;

    try {
      const result = await generateLogoCandidate({
        dna: validated.dna,
        direction: validated.direction,
        apiKey,
        imageProvider: validated.imageProvider,
        imageModel,
        referenceImages: validated.referenceImages,
      });
      await finalizeGeneration(generationId, true);
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof LogoGenerationError) {
        await finalizeGeneration(generationId, false, err.message);
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? "");
    if (generationId) await finalizeGeneration(generationId, false, msg);
    console.error("[generate-logo]", msg || e);
    return NextResponse.json({ error: `Erro ao gerar logo: ${msg || "erro desconhecido"}` }, { status: 500 });
  }
}
