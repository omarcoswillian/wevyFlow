import { NextRequest, NextResponse } from "next/server";
import { requireLaunch, launchErrorResponse, requireAuthUser, isUuid } from "@/lib/launches/server";
import { resolveLogoApiKey, isLogoVariationDirection, type LogoVariationDirection, type MockupLayoutSpec } from "@/app/api/generate-logo/shared";
import { actionCost, resolvePlanLimit } from "@/app/lib/credits";
import { createServiceClient } from "@/lib/supabase/service";
import {
  runKvCandidateAttempt, runKvTextureAttempt, runKvMockupAttempt, runWithConcurrency, KV_COMPOSED_PIECE_POSITION_OFFSET,
  type KvStoredGenerationConfig,
} from "@/lib/launches/kv-worker";
import { listKvBatch } from "@/lib/launches/kv-assets";
import type { BrandColor, BrandFont } from "@/app/lib/types-kit";

interface KvStoredTextureConfig {
  colors: BrandColor[];
  direction: LogoVariationDirection;
  imageProvider: "openai" | "gemini" | "fal";
  imageModel: string | null;
  fonts: BrandFont[];
  productName: string;
  subtitle: string | null;
  applicationPhotos: string[];
}

interface KvStoredMockupConfig {
  photoDataUrl: string;
  styleReferenceImages: string[];
  colors: BrandColor[];
  fonts: BrandFont[];
  mockupLayoutSpec?: MockupLayoutSpec | null;
  productName: string;
  subtitle: string | null;
  imageProvider: "openai" | "gemini" | "fal";
  imageModel: string | null;
}

// Rodada C do redesenho de KV (spec do Codex, gpt-5.6-sol, seção 4.1): uma
// "etapa" processa só UMA leva de peças pendentes (STEP_CONCURRENCY), nunca
// o lote inteiro — é isso que corrige o problema real encontrado testando a
// Rodada B (um lote com 4 candidatos, concorrência 2, podia levar 2 ondas
// sequenciais dentro da MESMA requisição HTTP). O cliente chama esta rota
// em loop até `done: true` — cada chamada individual fica bem abaixo de
// qualquer limite de plataforma, e o progresso fica visível/retomável entre
// chamadas (fechar a aba no meio só deixa peças 'pending' esperando a
// próxima etapa, sem perder nada).
//
// 90s dá margem real acima de ATTEMPT_TIMEOUT_MS (60s, kv-worker.ts) mesmo
// no pior caso — os STEP_CONCURRENCY itens de uma leva rodam em paralelo de
// verdade (runWithConcurrency), então o tempo da rota é ~o item mais lento
// da leva, não a soma deles.
export const maxDuration = 90;
export const runtime = "nodejs";

const STEP_CONCURRENCY = 2;

export async function POST(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    const { batchId } = await params;
    if (!isUuid(batchId)) {
      return NextResponse.json({ error: "batchId inválido." }, { status: 400 });
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
    const { projectId, apiKey } = rawBody as { projectId?: unknown; apiKey?: string | null };

    let launch: Awaited<ReturnType<typeof requireLaunch>>;
    try {
      launch = await requireLaunch(projectId);
    } catch (err) {
      const { body, status } = launchErrorResponse(err);
      return NextResponse.json(body, { status });
    }

    const { supabase: sessionSupabase, user } = await requireAuthUser();
    const service = createServiceClient();
    const isDev = process.env.NODE_ENV === "development";
    const { limit } = isDev
      ? { limit: 1_000_000_000 } // fits in Postgres int4; only skip_credit_check actually matters in dev
      : await resolvePlanLimit(sessionSupabase, user.id);
    const costPerItem = actionCost("kv_batch");

    // Limpa qualquer 'generating' abandonado (aba fechada, processo morto no
    // meio de uma etapa anterior) antes de escolher o que processar agora —
    // mesma ordem já usada por claim_kv_batch/claim_kv_candidate_retry.
    await service.rpc("reap_stale_kv_generations", { p_user_id: user.id });

    const { data: pendingRows, error: pendingError } = await service
      .from("launch_assets")
      .select("id, position, candidate_id, variation_key, piece_key, generation_config")
      .eq("user_id", user.id)
      .eq("launch_kit_id", launch.launchKitId)
      .eq("batch_id", batchId)
      .eq("asset_type", "kv")
      .eq("status", "pending")
      .order("position", { ascending: true })
      .limit(STEP_CONCURRENCY);

    if (pendingError) {
      console.error("[kv/batches/step] failed to list pending pieces:", pendingError);
      return NextResponse.json({ error: "Falha ao processar a etapa." }, { status: 500 });
    }

    if (pendingRows && pendingRows.length > 0) {
      // provider/model são congelados por lote/candidato (claim_kv_batch e
      // claim_kv_piece) — toda linha 'pending' deste batch_id, seja logo ou
      // textura, compartilha o mesmo imageProvider, então validar a chave
      // uma vez (com a config da primeira linha) já cobre a leva inteira.
      // Falha rápido, ANTES de acquire_kv_attempt travar alguma linha —
      // mesmo padrão de /api/kv/batches e do retry (achado de revisão do
      // Codex nas rodadas anteriores).
      const firstProvider = (pendingRows[0].generation_config as { imageProvider?: string } | null)?.imageProvider;
      if (!firstProvider) {
        return NextResponse.json({ error: "Lote sem configuração de geração registrada — não é possível continuar." }, { status: 409 });
      }
      const key = resolveLogoApiKey(firstProvider as "openai" | "gemini" | "fal", apiKey);
      if (!key) {
        const label = firstProvider === "gemini" ? "Google AI Studio" : firstProvider === "fal" ? "Fal.ai" : "OpenAI";
        return NextResponse.json({ error: `Chave ${label} não configurada. Adicione em Configurações > IA de Imagem.` }, { status: 400 });
      }

      await runWithConcurrency(pendingRows, STEP_CONCURRENCY, async (row) => {
        const { data: acquireData, error: acquireError } = await service.rpc("acquire_kv_attempt", {
          p_user_id: user.id,
          p_launch_kit_id: launch.launchKitId,
          p_asset_id: row.id,
        });
        if (acquireError || !acquireData?.attempt_id) {
          console.error("[kv/batches/step] acquire_kv_attempt failed:", acquireError, row.id);
          return;
        }

        if (row.piece_key === "texture_primary") {
          const config = row.generation_config as unknown as KvStoredTextureConfig | null;
          if (!config?.colors || !config.direction || !config.fonts || !config.productName || !row.candidate_id) {
            console.error("[kv/batches/step] pending texture piece missing config/candidate — skipping:", row.id);
            return;
          }
          await runKvTextureAttempt(service, {
            userId: user.id,
            launchKitId: launch.launchKitId,
            batchId,
            assetId: row.id,
            attemptId: acquireData.attempt_id,
            generationHistoryId: acquireData.generation_history_id ?? null,
            candidateId: row.candidate_id,
            candidatePosition: row.position - KV_COMPOSED_PIECE_POSITION_OFFSET.texture_primary,
            colors: config.colors,
            fonts: config.fonts,
            productName: config.productName,
            subtitle: config.subtitle ?? undefined,
            applicationPhotos: config.applicationPhotos ?? [],
            direction: config.direction,
            imageProvider: config.imageProvider,
            imageModel: config.imageModel ?? undefined,
            apiKey,
          });
          return;
        }

        if (row.piece_key === "mockup_aplicacao") {
          const config = row.generation_config as unknown as KvStoredMockupConfig | null;
          if (!config?.photoDataUrl || !config.productName || !config.imageProvider || !config.colors || !config.fonts || !row.candidate_id) {
            console.error("[kv/batches/step] pending mockup piece missing config/candidate — skipping:", row.id);
            return;
          }
          await runKvMockupAttempt(service, {
            userId: user.id,
            launchKitId: launch.launchKitId,
            batchId,
            assetId: row.id,
            attemptId: acquireData.attempt_id,
            generationHistoryId: acquireData.generation_history_id ?? null,
            candidateId: row.candidate_id,
            candidatePosition: row.position - KV_COMPOSED_PIECE_POSITION_OFFSET.mockup_aplicacao,
            photoDataUrl: config.photoDataUrl,
            styleReferenceImages: config.styleReferenceImages ?? [],
            colors: config.colors,
            fonts: config.fonts,
            layoutSpec: config.mockupLayoutSpec,
            productName: config.productName,
            subtitle: config.subtitle ?? undefined,
            imageProvider: config.imageProvider,
            imageModel: config.imageModel ?? undefined,
            apiKey,
          });
          return;
        }

        const direction = isLogoVariationDirection(row.variation_key) ? row.variation_key : undefined;
        const config = row.generation_config as unknown as KvStoredGenerationConfig | null;
        if (!direction || !config?.dna || !config.imageProvider || !row.candidate_id) {
          console.error("[kv/batches/step] pending logo piece missing direction/config/candidate — skipping:", row.id);
          return;
        }

        await runKvCandidateAttempt(service, {
          userId: user.id,
          launchKitId: launch.launchKitId,
          batchId,
          assetId: row.id,
          attemptId: acquireData.attempt_id,
          generationHistoryId: acquireData.generation_history_id ?? null,
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
          cost: costPerItem,
          limit,
          skipCreditCheck: isDev,
          applicationPhotos: config.applicationPhotos ?? [],
          mockupLayoutSpec: config.mockupLayoutSpec,
        });
      });
    }

    const batch = await listKvBatch(launch.projectId, batchId);
    const done = !batch.candidates.some((c) => c.status === "pending" || c.status === "generating");
    return NextResponse.json({ batch, done });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido.";
    console.error("[kv/batches/step]", msg || e);
    return NextResponse.json({ error: `Erro ao processar a etapa: ${msg}` }, { status: 500 });
  }
}
