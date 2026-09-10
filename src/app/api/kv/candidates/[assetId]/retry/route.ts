import { NextRequest, NextResponse } from "next/server";
import { requireLaunch, launchErrorResponse, requireAuthUser, isUuid } from "@/lib/launches/server";
import { resolveLogoApiKey, isLogoVariationDirection } from "@/app/api/generate-logo/shared";
import { actionCost, resolvePlanLimit } from "@/app/lib/credits";
import { createServiceClient } from "@/lib/supabase/service";
import { runKvCandidateAttempt, type KvStoredGenerationConfig } from "@/lib/launches/kv-worker";
import { listKvBatch } from "@/lib/launches/kv-assets";

// 90s dá margem real acima de ATTEMPT_TIMEOUT_MS (60s, kv-worker.ts) — essa
// rota processa só 1 candidato por chamada, sem concorrência.
export const maxDuration = 90;
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await params;
    if (!isUuid(assetId)) {
      return NextResponse.json({ error: "assetId inválido." }, { status: 400 });
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
    const { projectId, apiKey, clientAttemptId } = rawBody as { projectId?: unknown; apiKey?: string | null; clientAttemptId?: unknown };

    // Chave de idempotência obrigatória, gerada pelo cliente — uma segunda
    // chamada com a MESMA chave (ex: resposta de rede perdida, cliente
    // tentou de novo) devolve a tentativa já em andamento em vez de
    // reservar crédito uma segunda vez (achado de revisão do Codex).
    if (typeof clientAttemptId !== "string" || !isUuid(clientAttemptId)) {
      return NextResponse.json({ error: "clientAttemptId inválido (deve ser um UUID gerado pelo cliente)." }, { status: 400 });
    }

    let launch: Awaited<ReturnType<typeof requireLaunch>>;
    try {
      launch = await requireLaunch(projectId);
    } catch (err) {
      const { body, status } = launchErrorResponse(err);
      return NextResponse.json(body, { status });
    }

    const { supabase: sessionSupabase, user } = await requireAuthUser();
    const service = createServiceClient();

    // Service client bypasses RLS — ownership/launch-match must be checked
    // here in code before acting on this row (defense in depth; claim_kv_
    // candidate_retry re-validates both authoritatively too).
    const { data: row, error: rowError } = await service
      .from("launch_assets")
      .select("id, user_id, launch_kit_id, batch_id, asset_type, status, variation_key, generation_config, candidate_id, position")
      .eq("id", assetId)
      .maybeSingle();

    if (rowError) {
      console.error("[kv/candidates/retry] fetch failed:", rowError);
      return NextResponse.json({ error: "Falha ao buscar o candidato." }, { status: 500 });
    }
    if (!row || row.user_id !== user.id || row.launch_kit_id !== launch.launchKitId || row.asset_type !== "kv") {
      return NextResponse.json({ error: "Candidato não encontrado." }, { status: 404 });
    }

    const direction = isLogoVariationDirection(row.variation_key) ? row.variation_key : undefined;
    if (!direction) {
      return NextResponse.json({ error: "Candidato sem direção de variação registrada — não é possível reprocessar." }, { status: 409 });
    }
    const config = row.generation_config as unknown as KvStoredGenerationConfig | null;
    if (!config?.dna || !config.imageProvider) {
      return NextResponse.json({ error: "Candidato sem configuração de geração registrada — não é possível reprocessar." }, { status: 409 });
    }
    if (!row.candidate_id) {
      // Não deveria acontecer — launch_assets_kv_has_candidate exige
      // candidate_id pra todo asset_type='kv' — mas checar aqui em vez de
      // confiar num "!" evita um erro obscuro lá na frente se algum dia
      // deixar de ser verdade.
      return NextResponse.json({ error: "Candidato sem kit associado — não é possível reprocessar." }, { status: 409 });
    }

    // Mesma checagem "falha rápido antes de reservar" da criação do lote —
    // a rota de retry não fazia isso antes (achado de revisão do Codex).
    const key = resolveLogoApiKey(config.imageProvider, apiKey);
    if (!key) {
      const label = config.imageProvider === "gemini" ? "Google AI Studio" : config.imageProvider === "fal" ? "Fal.ai" : "OpenAI";
      return NextResponse.json({ error: `Chave ${label} não configurada. Adicione em Configurações > IA de Imagem.` }, { status: 400 });
    }

    const isDev = process.env.NODE_ENV === "development";
    const { limit } = isDev
      ? { limit: 1_000_000_000 } // fits in Postgres int4; only skip_credit_check actually matters in dev
      : await resolvePlanLimit(sessionSupabase, user.id);
    const cost = actionCost("kv_batch");
    // Reproduzido deterministicamente a partir do dna+direction já
    // congelados (não é uma escolha criativa nova) — só usado como prompt
    // de auditoria desta reserva de crédito.
    const prompt = row.variation_key ? `retry:${row.variation_key}:${config.dna.name}` : `retry:${config.dna.name}`;

    const { data: claim, error: claimError } = await service.rpc("claim_kv_candidate_retry", {
      p_user_id: user.id,
      p_launch_kit_id: launch.launchKitId,
      p_asset_id: assetId,
      p_client_attempt_id: clientAttemptId,
      p_gen_type: "kv_batch",
      p_cost: cost,
      p_limit: limit,
      p_prompt: prompt,
      p_skip_credit_check: isDev,
    });

    if (claimError) {
      const msg = claimError.message ?? "";
      if (msg.includes("not_found")) return NextResponse.json({ error: "Candidato não encontrado." }, { status: 404 });
      if (msg.includes("asset_belongs_to_other_launch")) return NextResponse.json({ error: "Este candidato pertence a outro lançamento." }, { status: 409 });
      if (msg.includes("not_retryable")) return NextResponse.json({ error: "Este candidato não está com falha — só é possível reprocessar candidatos com erro." }, { status: 409 });
      console.error("[kv/candidates/retry] claim_kv_candidate_retry failed:", claimError);
      return NextResponse.json({ error: "Falha ao reprocessar o candidato." }, { status: 500 });
    }

    if (claim?.allowed === false) {
      const available = Math.max(0, (claim.limit ?? limit) - (claim.used ?? 0));
      return NextResponse.json(
        {
          error: `Reprocessar este candidato exige ${claim.required ?? cost} créditos; você tem ${available} disponíveis neste mês.`,
          limitReached: true,
          used: claim.used,
          limit: claim.limit,
          required: claim.required,
        },
        { status: 429 }
      );
    }

    if (claim?.replay) {
      // Reenvio da MESMA chave de idempotência — uma tentativa já está em
      // andamento (ou já terminou) pra esse clientAttemptId. Não dispara
      // outra geração; só devolve o estado atual.
      const batch = await listKvBatch(launch.projectId, row.batch_id);
      return NextResponse.json({ batch, replay: true });
    }

    if (!claim?.attempt_id) {
      console.error("[kv/candidates/retry] claim_kv_candidate_retry allowed without an attempt_id:", assetId);
      return NextResponse.json({ error: "Falha ao reprocessar o candidato." }, { status: 500 });
    }

    await runKvCandidateAttempt(service, {
      userId: user.id,
      launchKitId: launch.launchKitId,
      batchId: row.batch_id,
      assetId,
      attemptId: claim.attempt_id,
      generationHistoryId: claim.generation_history_id ?? null,
      dna: config.dna,
      direction,
      imageProvider: config.imageProvider,
      imageModel: config.imageModel ?? undefined,
      apiKey,
      referenceImages: config.referenceImages ?? [],
      candidateId: row.candidate_id,
      candidatePosition: row.position,
      secondaryColor: launch.brandInfo.secondaryColor,
      fontChoice: launch.brandInfo.fontChoice,
      genType: "kv_batch",
      cost,
      limit,
      skipCreditCheck: isDev,
      applicationPhotos: config.applicationPhotos ?? [],
      mockupLayoutSpec: config.mockupLayoutSpec,
    });

    const batch = await listKvBatch(launch.projectId, row.batch_id);
    return NextResponse.json({ batch, replay: false });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido.";
    console.error("[kv/candidates/retry]", msg || e);
    return NextResponse.json({ error: `Erro ao reprocessar o candidato: ${msg}` }, { status: 500 });
  }
}
