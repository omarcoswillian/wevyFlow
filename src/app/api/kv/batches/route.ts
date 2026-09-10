import { NextRequest, NextResponse } from "next/server";
import { requireLaunch, launchErrorResponse, requireAuthUser, isUuid } from "@/lib/launches/server";
import {
  validateGenerateLogoInput,
  buildLogoPrompt,
  resolveLogoApiKey,
  resolveLogoImageModel,
  analyzeMockupLayoutForReference,
  LOGO_PROMPT_VERSION,
  LogoGenerationError,
  type LogoVariationDirection,
} from "@/app/api/generate-logo/shared";
import { actionCost, resolvePlanLimit } from "@/app/lib/credits";
import { createServiceClient } from "@/lib/supabase/service";
import { listKvBatch } from "@/lib/launches/kv-assets";

// Rodada C: esta rota só RESERVA o lote (créditos + linhas 'pending') e
// devolve na hora — não roda mais nenhuma GERAÇÃO DE IMAGEM aqui dentro.
// Quem processa as peças é POST /api/kv/batches/[batchId]/step, chamada em
// loop pelo cliente até `done: true` (spec do Codex, seção 4.1 — "não
// colocar tudo no mesmo POST e apenas aumentar maxDuration"). Única exceção
// deliberada: analyzeMockupLayoutForReference, uma chamada de TEXTO barata
// (gemini-2.5-flash, sem imagem) que mede a referência do mockup uma vez só
// pro lote inteiro — ver comentário no ponto onde é chamada. 20s ainda dá
// folga de sobra pra essa única chamada extra.
export const maxDuration = 20;

const DIRECTIONS: LogoVariationDirection[] = ["tipografica", "geometrica", "minimalista", "expressiva"];

export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Corpo da requisição inválido (JSON malformado)." }, { status: 400 });
    }
    if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
      return NextResponse.json({ error: "Corpo da requisição deve ser um objeto." }, { status: 400 });
    }

    const { projectId, clientBatchId, dna, apiKey, imageProvider, imageModel } = rawBody as {
      projectId?: unknown;
      clientBatchId?: unknown;
      dna?: unknown;
      apiKey?: string | null;
      imageProvider?: unknown;
      imageModel?: string;
    };

    if (typeof clientBatchId !== "string" || !isUuid(clientBatchId)) {
      return NextResponse.json({ error: "clientBatchId inválido (deve ser um UUID gerado pelo cliente)." }, { status: 400 });
    }

    let launch: Awaited<ReturnType<typeof requireLaunch>>;
    try {
      launch = await requireLaunch(projectId);
    } catch (err) {
      const { body, status } = launchErrorResponse(err);
      return NextResponse.json(body, { status });
    }

    let validated: ReturnType<typeof validateGenerateLogoInput>;
    try {
      validated = validateGenerateLogoInput({ dna, imageProvider, referenceImages: launch.brandInfo.referenceImages });
    } catch (err) {
      if (err instanceof LogoGenerationError) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }
    validated.dna.name = launch.brandInfo.productName || validated.dna.name;
    validated.dna.niche = launch.brandInfo.niche || validated.dna.niche;

    // Fail fast on a missing key BEFORE reserving credit for 4 candidates
    // that would all fail on this exact same error (achado de revisão do
    // Codex — validar provider/key antes de reservar).
    const key = resolveLogoApiKey(validated.imageProvider, apiKey);
    if (!key) {
      const label = validated.imageProvider === "gemini" ? "Google AI Studio" : validated.imageProvider === "fal" ? "Fal.ai" : "OpenAI";
      return NextResponse.json({ error: `Chave ${label} não configurada. Adicione em Configurações > IA de Imagem.` }, { status: 400 });
    }

    const { supabase: sessionSupabase, user } = await requireAuthUser();
    const isDev = process.env.NODE_ENV === "development";
    const { limit } = isDev
      ? { limit: 1_000_000_000 } // fits in Postgres int4; only skip_credit_check actually matters in dev
      : await resolvePlanLimit(sessionSupabase, user.id);
    const costPerItem = actionCost("kv_batch");

    // Resolved (never null) so a later retry always replays the same model
    // this batch actually used, even if the default changes after a deploy
    // (achado de revisão do Codex).
    const resolvedModel = resolveLogoImageModel(validated.imageProvider, imageModel);
    const prompts = DIRECTIONS.map((direction) => buildLogoPrompt(validated.dna, direction));
    const applicationPhotos = launch.briefing.applicationPhotos ?? [];

    // Única chamada de IA nesta rota, de propósito — e só quando o mockup
    // vai mesmo ser gerado (tem foto + referência). É uma chamada de TEXTO
    // barata (gemini-2.5-flash, sem geração de imagem), não a exceção que o
    // comentário do topo do arquivo estava evitando. Roda AQUI (uma vez por
    // lote) e não dentro de generateMockupCandidate (uma vez por candidato)
    // de propósito: os 4 candidatos compartilham a MESMA referência, então
    // analisá-la 4 vezes deixava cada mockup do mesmo kit "escolhendo" um
    // recorte diferente de uma referência ambígua tipo colagem — achado de
    // teste real depois do pedido do dono "quero que seja tão bom quanto o
    // de criativos". Falha aqui nunca bloqueia o lote — generateMockupCandidate
    // cai de volta pro texto qualitativo se isto vier `null`.
    const mockupLayoutSpec = applicationPhotos[0] && validated.referenceImages[0]
      ? await analyzeMockupLayoutForReference(validated.referenceImages[0], apiKey).catch((err) => {
          console.error("[kv/batches] analyzeMockupLayoutForReference failed (non-fatal):", err);
          return null;
        })
      : null;

    const generationConfig = {
      dna: validated.dna,
      imageProvider: validated.imageProvider,
      imageModel: resolvedModel,
      promptVersion: LOGO_PROMPT_VERSION,
      referenceImages: validated.referenceImages,
      // Congelado junto com o resto — só a PRIMEIRA foto é usada no mockup
      // (generateMockupCandidate em generate-logo/shared.ts, chamada pelo
      // kv-worker), mas guarda todas aqui pra uma extensão futura poder
      // escolher entre elas sem precisar reler o briefing (que pode já ter
      // mudado até a peça ser gerada).
      applicationPhotos,
      mockupLayoutSpec,
    };

    const service = createServiceClient();
    const { data: claim, error: claimError } = await service.rpc("claim_kv_batch", {
      p_user_id: user.id,
      p_launch_kit_id: launch.launchKitId,
      p_client_batch_id: clientBatchId,
      p_asset_type: "kv",
      p_gen_type: "kv_batch",
      p_directions: DIRECTIONS,
      p_prompts: prompts,
      p_generation_config: generationConfig,
      p_cost_per_item: costPerItem,
      p_limit: limit,
      p_skip_credit_check: isDev,
    });

    if (claimError) {
      const msg = claimError.message ?? "";
      if (msg.includes("batch_conflict")) {
        return NextResponse.json({ error: "Já existe um lote com esse identificador, mas com uma configuração diferente." }, { status: 409 });
      }
      if (msg.includes("not_found")) {
        return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
      }
      console.error("[kv/batches] claim_kv_batch failed:", claimError);
      return NextResponse.json({ error: "Falha ao reservar o lote de KV." }, { status: 500 });
    }

    if (claim?.allowed === false) {
      const required = claim.required ?? costPerItem * DIRECTIONS.length;
      const available = Math.max(0, (claim.limit ?? limit) - (claim.used ?? 0));
      return NextResponse.json(
        {
          error: `Este lote exige ${required} créditos; você tem ${available} disponíveis neste mês.`,
          limitReached: true,
          used: claim.used,
          limit: claim.limit,
          required,
        },
        { status: 429 }
      );
    }

    if (!claim?.created) {
      // Lost the creation race (idempotent replay / concurrent duplicate
      // request) — only whoever created it runs generation. Return the
      // batch as it currently stands.
      const batch = await listKvBatch(launch.projectId, clientBatchId);
      return NextResponse.json({ batch, created: false });
    }

    // Só reserva e persiste — nenhuma peça é processada aqui. O cliente
    // chama POST .../[batchId]/step em loop logo em seguida pra executar
    // (ver comentário de topo do arquivo).
    const batch = await listKvBatch(launch.projectId, clientBatchId);
    return NextResponse.json({ batch, created: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido.";
    console.error("[kv/batches]", msg || e);
    return NextResponse.json({ error: `Erro ao criar o lote de KV: ${msg}` }, { status: 500 });
  }
}
