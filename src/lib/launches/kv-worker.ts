import { randomUUID } from "crypto";
import type { createServiceClient } from "@/lib/supabase/service";
import {
  generateLogoCandidate, generateTextureCandidate, generateMockupCandidate, buildTexturePrompt, LogoGenerationError,
  type BrandDNA, type LogoVariationDirection, type MockupLayoutSpec,
} from "@/app/api/generate-logo/shared";
import {
  resolveBrandPalette, resolveBrandTypography, renderPaletteCard, renderTypographyCard,
  renderLogoApplicationCard, renderCoverCard, dataUrlToBuffer,
} from "./kv-identity";
import type { BrandColor, BrandFont } from "@/app/lib/types-kit";

// gemini-3-pro-image-preview (o modelo padrão — LOGO_DEFAULT_MODELS em
// generate-logo/shared.ts) é bem mais lento que flash: medido nesta sessão
// com chamadas reais (prompt completo + 2 imagens de referência), variou
// entre 19s e 37s. 25s cortava uma fração real dessas chamadas no meio —
// era isso que causava os "Tempo esgotado" que apareciam gerando com o
// modelo padrão (a Rodada C só processa 1 peça por vez em cada "onda" de
// STEP_CONCURRENCY, então subir esse número não empilha tempo, só dá
// margem pra essa variância real do modelo).
const ATTEMPT_TIMEOUT_MS = 60_000;

const ALLOWED_IMAGE_FORMATS: Record<string, { mimeType: string; ext: string }> = {
  png: { mimeType: "image/png", ext: "png" },
  jpeg: { mimeType: "image/jpeg", ext: "jpg" },
  webp: { mimeType: "image/webp", ext: "webp" },
};

export interface KvCandidateAttemptInput {
  userId: string;
  launchKitId: string;
  batchId: string;
  assetId: string;
  /** Fencing token — the current attempt_id on the launch_assets row
   * (minted by acquire_kv_attempt or claim_kv_candidate_retry). Independent
   * of generation_history_id, which can go null (user clears their credit
   * history, or dev/skip-credit mode never creates one) and would then be
   * useless as a fencing key. */
  attemptId: string;
  /** This attempt's OWN credit reservation, as returned by
   * acquire_kv_attempt/claim_kv_candidate_retry at acquisition time — never
   * looked up from the row inside finalize_kv_candidate, because by the
   * time a stale/late response arrives the row's CURRENT generation_history_id
   * belongs to whichever newer attempt superseded this one. Passing it
   * explicitly is what lets a stale finalize refund the right reservation
   * instead of the new attempt's (achado de revisão do Codex). Null in
   * dev/skip-credit mode. */
  generationHistoryId: string | null;
  dna: BrandDNA;
  direction: LogoVariationDirection;
  imageProvider: "openai" | "gemini" | "fal";
  imageModel?: string;
  apiKey?: string | null;
  referenceImages: string[];
  /** Candidato (kit) que este logo pertence e sua posição no lote — usadas
   * pra enriquecer o candidato (paleta/tipografia, Rodada B) só depois de um
   * logo bem-sucedido, e pra dar um `position` determinístico e sem colisão
   * às peças compostas (ver KV_COMPOSED_PIECE_POSITION_OFFSET abaixo). */
  candidateId: string;
  candidatePosition: number;
  /** launch.brandInfo.secondaryColor / .fontChoice — restrições explícitas
   * do briefing, prioridade mais alta que qualquer valor curado/extraído na
   * resolução de paleta/tipografia (kv-identity.ts). */
  secondaryColor?: string;
  fontChoice?: string;
  /** Repassados só pra reservar a peça de textura, se o logo for bem
   * sucedido — ver EnrichCandidateIdentityInput. */
  genType: string;
  cost: number;
  limit: number;
  skipCreditCheck: boolean;
  /** Fotos reais (briefing.applicationPhotos) pro mockup de aplicação — só
   * compõe essa peça se existir pelo menos uma. */
  applicationPhotos: string[];
  mockupLayoutSpec?: MockupLayoutSpec | null;
}

/** Shape frozen into launch_assets.generation_config at batch-creation time
 * (claim_kv_batch) — every subsequent step/retry against that row rebuilds
 * its call from THIS stored config, never from whatever the client resends,
 * so every piece of a batch keeps generating with the exact dna/provider it
 * was created with (client only ever resupplies apiKey, which is never
 * persisted). Shared by the retry route and the batch-step route. */
export interface KvStoredGenerationConfig {
  dna: BrandDNA;
  imageProvider: "openai" | "gemini" | "fal";
  imageModel: string | null;
  referenceImages: string[];
  applicationPhotos?: string[];
  /** Medidas da referência de estilo pro mockup, analisadas UMA VEZ na
   * criação do lote (POST /api/kv/batches) e reaproveitadas pelos 4
   * candidatos — ver analyzeMockupLayoutForReference. */
  mockupLayoutSpec?: MockupLayoutSpec | null;
}

export type KvCandidateAttemptOutcome = "applied" | "already_applied" | "stale" | "conflict" | "unknown" | "error";

export interface KvCandidateAttemptResult {
  assetId: string;
  success: boolean;
  outcome: KvCandidateAttemptOutcome;
  errorMessage?: string;
}

/** launch_assets.position é único por batch_id (não por candidato) — cada
 * peça composta ganha um bloco de posições próprio, deslocado da posição do
 * candidato (0..3), pra nunca colidir com a peça 'logo_primary' nem exigir
 * nenhuma coordenação/lock entre candidatos rodando em paralelo (achado
 * desta rodada: um `select max(position)+1` teria corrida real, já que até
 * 2 candidatos podem terminar seu logo ao mesmo tempo — CONCURRENCY=2). */
export const KV_COMPOSED_PIECE_POSITION_OFFSET = {
  // Bloco 1xxx: peças "renderer" — nascem prontas ('done') na mesma
  // chamada que processa o logo, sem custo, sem fencing.
  palette_card: 1000,
  typography_card: 1100,
  logo_aplicacao: 1200,
  capa: 1300,
  // Bloco 3xxx: peças pagas — nascem 'pending' e passam pelo mesmo ciclo
  // de acquire/generating/finalize do logo, numa etapa futura (spec do
  // Codex, "reserva por etapa elegível"). mockup_aplicacao virou paga
  // quando passou a ser gerada pelo Nano Banana (pedido do dono: "quero
  // que o nano banana mude a pessoa e mude o título... quero que replique
  // a referência") em vez de composta por código.
  texture_primary: 3000,
  mockup_aplicacao: 3500,
} as const;

/** Sobe um PNG já renderizado (sem IA, sem custo) como uma peça pronta —
 * nasce direto 'done', nunca passa por pending/generating (não tem
 * reserva de crédito, não tem fencing de tentativa). Usado por toda peça
 * "renderer": palette_card, typography_card, logo_aplicacao, capa. Idempotente
 * por (candidate_id, piece_key) — se a peça já existe, não faz nada (evita
 * subir/duplicar em cima de um replay de finalize do logo ou da textura). */
async function uploadRenderedPiece(
  supabase: ReturnType<typeof createServiceClient>,
  input: {
    userId: string;
    launchKitId: string;
    batchId: string;
    candidateId: string;
    candidatePosition: number;
    pieceKey: keyof typeof KV_COMPOSED_PIECE_POSITION_OFFSET;
    assetRole: string;
    pngBuffer: Buffer;
  }
): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from("launch_assets")
    .select("id")
    .eq("candidate_id", input.candidateId)
    .eq("piece_key", input.pieceKey)
    .maybeSingle();
  if (existingError) {
    console.error(`[kv-worker] failed to check existing ${input.pieceKey} (non-fatal):`, existingError, input.candidateId);
    return;
  }
  if (existing) return;

  let path: string | undefined;
  try {
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(input.pngBuffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error(`${input.pieceKey} renderizada sem dimensões válidas.`);
    }

    path = `${input.userId}/launches/${input.launchKitId}/kv/${input.batchId}/${input.candidateId}/${input.pieceKey}.png`;
    const { error: uploadError } = await supabase.storage.from("ai-images").upload(path, input.pngBuffer, {
      contentType: "image/png",
      upsert: false,
    });
    if (uploadError) throw new Error(`Falha ao salvar ${input.pieceKey}: ${uploadError.message}`);

    const { error: insertError } = await supabase.from("launch_assets").insert({
      id: randomUUID(),
      user_id: input.userId,
      launch_kit_id: input.launchKitId,
      asset_type: "kv",
      batch_id: input.batchId,
      position: KV_COMPOSED_PIECE_POSITION_OFFSET[input.pieceKey] + input.candidatePosition,
      status: "done",
      storage_bucket: "ai-images",
      storage_path: path,
      mime_type: "image/png",
      width: metadata.width,
      height: metadata.height,
      candidate_id: input.candidateId,
      piece_key: input.pieceKey,
      asset_role: input.assetRole,
      producer: "renderer",
    });
    if (insertError) throw new Error(`Falha ao registrar ${input.pieceKey}: ${insertError.message}`);
  } catch (err) {
    console.error(`[kv-worker] ${input.pieceKey} composition failed (non-fatal):`, err, input.candidateId);
    if (path) {
      const { error: removeError } = await supabase.storage.from("ai-images").remove([path]);
      if (removeError) console.error(`[kv-worker] failed to clean up orphaned ${input.pieceKey} upload:`, removeError, path);
    }
  }
}

/** Baixa uma peça já persistida como 'done' de volta pra um Buffer — usado
 * quando um passo posterior (ex: montar a capa depois que a textura
 * termina) precisa reconstituir uma imagem que já existe no Storage, sem
 * ter ficado em memória entre uma etapa e outra (o candidato pode ter
 * concluído o logo numa chamada HTTP e a textura em outra, bem depois). */
async function downloadPieceBuffer(
  supabase: ReturnType<typeof createServiceClient>,
  candidateId: string,
  pieceKey: string
): Promise<Buffer | null> {
  const { data: row, error } = await supabase
    .from("launch_assets")
    .select("storage_bucket, storage_path, status")
    .eq("candidate_id", candidateId)
    .eq("piece_key", pieceKey)
    .maybeSingle();
  if (error || !row || row.status !== "done" || !row.storage_bucket || !row.storage_path) return null;

  const { data: blob, error: downloadError } = await supabase.storage.from(row.storage_bucket).download(row.storage_path);
  if (downloadError || !blob) return null;
  return Buffer.from(await blob.arrayBuffer());
}

/** Monta e sobe a Capa — a última peça de um candidato, só quando o logo E
 * a textura já estiverem prontos (as duas imagens que ela realmente
 * compõe; paleta/tipografia/logo-aplicação não entram como insumo, só
 * existem como peças à parte). Chamada depois de QUALQUER uma das duas
 * terminar (idempotente via uploadRenderedPiece), pra não depender de qual
 * delas termina por último. */
async function maybeComposeCoverCard(
  supabase: ReturnType<typeof createServiceClient>,
  input: {
    userId: string;
    launchKitId: string;
    batchId: string;
    candidateId: string;
    candidatePosition: number;
    colors: BrandColor[];
    fonts: BrandFont[];
    productName: string;
    subtitle?: string;
    applicationPhotos: string[];
  }
): Promise<void> {
  const [logoBuffer, textureBuffer] = await Promise.all([
    downloadPieceBuffer(supabase, input.candidateId, "logo_primary"),
    downloadPieceBuffer(supabase, input.candidateId, "texture_primary"),
  ]);
  if (!logoBuffer || !textureBuffer) return; // ainda não estão as duas prontas

  // A foto real (se existir) vira o elemento forte da capa — a textura
  // continua servindo de fallback pra quando ninguém subiu foto ainda.
  const photoBuffer = input.applicationPhotos[0] ? dataUrlToBuffer(input.applicationPhotos[0]) : null;

  try {
    const pngBuffer = await renderCoverCard(
      logoBuffer, input.colors, input.fonts, input.productName, input.subtitle, textureBuffer, photoBuffer
    );
    await uploadRenderedPiece(supabase, {
      userId: input.userId,
      launchKitId: input.launchKitId,
      batchId: input.batchId,
      candidateId: input.candidateId,
      candidatePosition: input.candidatePosition,
      pieceKey: "capa",
      assetRole: "cover",
      pngBuffer,
    });
  } catch (err) {
    console.error("[kv-worker] cover card composition failed (non-fatal):", err, input.candidateId);
  }
}

interface EnrichCandidateIdentityInput {
  userId: string;
  launchKitId: string;
  batchId: string;
  candidateId: string;
  candidatePosition: number;
  direction: LogoVariationDirection;
  logoBuffer: Buffer;
  primaryColor?: string;
  secondaryColor?: string;
  fontChoice?: string;
  imageProvider: "openai" | "gemini" | "fal";
  imageModel?: string;
  /** Necessários só pra reservar a peça de textura (paga) — o resto desta
   * função (paleta, tipografia, logo-aplicação) nunca toca crédito. */
  genType: string;
  cost: number;
  limit: number;
  skipCreditCheck: boolean;
  /** Se o logo foi gerado com referências anexadas, a extração de cor tem
   * prioridade sobre input.primaryColor — ver resolveBrandPalette. */
  hasReferenceImages: boolean;
  productName: string;
  subtitle?: string;
  applicationPhotos: string[];
  /** Repassadas pro mockup de aplicação (gerado pelo Nano Banana) como
   * referência de estilo/template — o mesmo campo já usado no logo. */
  referenceImages: string[];
  mockupLayoutSpec?: MockupLayoutSpec | null;
}

/** Roda uma vez por candidato, logo depois do PRIMEIRO logo bem-sucedido
 * (nunca de novo depois: um candidato só chega a 'done' uma única vez na
 * vida — a trigger de imutabilidade de launch_assets garante isso). Resolve
 * paleta+tipografia (dado estruturado, sem custo) e renderiza+persiste a
 * cartela de paleta (peça composta, producer='renderer', sem
 * generation_history_id — nunca passa por acquire/finalize, que são só pro
 * caminho pago/fenced). Toda falha aqui é logada e engolida pelo chamador —
 * essa peça é um bônus, nunca deve derrubar o logo que já foi pago e
 * concluído. */
async function enrichCandidateIdentity(
  supabase: ReturnType<typeof createServiceClient>,
  input: EnrichCandidateIdentityInput
): Promise<void> {
  const colors = await resolveBrandPalette(input.logoBuffer, {
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    hasReferenceImages: input.hasReferenceImages,
  });
  const fonts = resolveBrandTypography(input.direction, { fontChoice: input.fontChoice });

  const { error: identityError } = await supabase
    .from("kv_candidates")
    .update({
      identity_spec: { colors, fonts },
      manifest: {
        legacy: false,
        pieces: [
          { pieceKey: "logo_primary", role: "logo", producer: "image_ai", required: true },
          { pieceKey: "palette_card", role: "palette", producer: "renderer", required: false },
          { pieceKey: "typography_card", role: "typography", producer: "renderer", required: false },
          { pieceKey: "logo_aplicacao", role: "application", producer: "renderer", required: false },
          { pieceKey: "texture_primary", role: "texture", producer: "image_ai", required: false },
          { pieceKey: "capa", role: "cover", producer: "renderer", required: false },
          ...(input.applicationPhotos.length > 0
            ? [{ pieceKey: "mockup_aplicacao", role: "mockup", producer: "image_ai", required: false }]
            : []),
        ],
      },
    })
    .eq("id", input.candidateId);
  if (identityError) {
    console.error("[kv-worker] failed to persist identity_spec (non-fatal):", identityError, input.candidateId);
  }

  const commonPieceInput = {
    userId: input.userId,
    launchKitId: input.launchKitId,
    batchId: input.batchId,
    candidateId: input.candidateId,
    candidatePosition: input.candidatePosition,
  };

  // As três peças "renderer" seguem em paralelo — nenhuma depende da outra,
  // cada uma é idempotente por conta própria (uploadRenderedPiece checa se
  // já existe antes de gerar). renderTypographyCard pode devolver null
  // (fonte não pôde ser baixada/registrada) — melhor-esforço de verdade,
  // essa peça simplesmente não nasce nessa rodada.
  await Promise.all([
    renderPaletteCard(colors)
      .then((png) => uploadRenderedPiece(supabase, { ...commonPieceInput, pieceKey: "palette_card", assetRole: "palette", pngBuffer: png }))
      .catch((err) => console.error("[kv-worker] palette card composition failed (non-fatal):", err, input.candidateId)),
    renderTypographyCard(fonts)
      .then((png) => png && uploadRenderedPiece(supabase, { ...commonPieceInput, pieceKey: "typography_card", assetRole: "typography", pngBuffer: png }))
      .catch((err) => console.error("[kv-worker] typography card composition failed (non-fatal):", err, input.candidateId)),
    renderLogoApplicationCard(input.logoBuffer, colors)
      .then((png) => uploadRenderedPiece(supabase, { ...commonPieceInput, pieceKey: "logo_aplicacao", assetRole: "application", pngBuffer: png }))
      .catch((err) => console.error("[kv-worker] logo application card composition failed (non-fatal):", err, input.candidateId)),
  ]);

  // Textura é a única peça desta função que custa crédito de verdade — só
  // RESERVA (cria a linha 'pending') aqui; quem gera de fato é a próxima
  // chamada de step()/retry, do jeito que toda peça paga já funciona (spec
  // do Codex, seção 4.3 — "reserva por etapa elegível", já que a textura só
  // fica elegível DEPOIS do logo, nunca junto com ele).
  const texturePrompt = buildTexturePrompt(colors, input.direction);
  const { data: pieceClaim, error: pieceClaimError } = await supabase.rpc("claim_kv_piece", {
    p_user_id: input.userId,
    p_launch_kit_id: input.launchKitId,
    p_candidate_id: input.candidateId,
    p_piece_key: "texture_primary",
    p_asset_role: "texture",
    p_producer: "image_ai",
    p_position: KV_COMPOSED_PIECE_POSITION_OFFSET.texture_primary + input.candidatePosition,
    p_gen_type: input.genType,
    p_prompt: texturePrompt,
    p_generation_config: {
      colors, direction: input.direction, imageProvider: input.imageProvider, imageModel: input.imageModel ?? null,
      // Congelados aqui pra a etapa que vai gerar a textura de verdade
      // (mais tarde, outra requisição) já ter tudo que precisa pra montar
      // a Capa em seguida, sem reler o candidato/briefing nesse meio tempo.
      fonts, productName: input.productName, subtitle: input.subtitle ?? null, applicationPhotos: input.applicationPhotos,
    },
    p_cost: input.cost,
    p_limit: input.limit,
    p_skip_credit_check: input.skipCreditCheck,
  });
  if (pieceClaimError) {
    console.error("[kv-worker] claim_kv_piece(texture) failed (non-fatal):", pieceClaimError, input.candidateId);
  } else if (pieceClaim?.allowed === false) {
    // Saldo insuficiente pra textura — o kit fica sem essa peça (e sem
    // capa, que depende dela); o logo continua valendo normalmente.
    console.warn("[kv-worker] texture piece not reserved (insufficient balance):", input.candidateId, pieceClaim);
  }

  // Mockup de aplicação — só reserva (igual textura) se o usuário já subiu
  // uma foto real. Virou peça PAGA (gerada pelo Nano Banana de verdade, com
  // a foto + as referências como entrada) — pedido do dono: "quero que o
  // nano banana mude a pessoa e mude o título com a mesma fonte... quero
  // que replique a referência, o que está sendo feito está muito longe".
  // A composição por código (renderApplicationMockup) não chegava perto do
  // nível da referência.
  const photoDataUrl = input.applicationPhotos[0];
  if (photoDataUrl) {
    const { data: mockupClaim, error: mockupClaimError } = await supabase.rpc("claim_kv_piece", {
      p_user_id: input.userId,
      p_launch_kit_id: input.launchKitId,
      p_candidate_id: input.candidateId,
      p_piece_key: "mockup_aplicacao",
      p_asset_role: "mockup",
      p_producer: "image_ai",
      p_position: KV_COMPOSED_PIECE_POSITION_OFFSET.mockup_aplicacao + input.candidatePosition,
      p_gen_type: input.genType,
      p_prompt: `mockup:${input.productName}`,
      p_generation_config: {
        photoDataUrl,
        styleReferenceImages: input.referenceImages,
        colors,
        fonts,
        mockupLayoutSpec: input.mockupLayoutSpec ?? null,
        productName: input.productName,
        subtitle: input.subtitle ?? null,
        imageProvider: input.imageProvider,
        imageModel: input.imageModel ?? null,
      },
      p_cost: input.cost,
      p_limit: input.limit,
      p_skip_credit_check: input.skipCreditCheck,
    });
    if (mockupClaimError) {
      console.error("[kv-worker] claim_kv_piece(mockup) failed (non-fatal):", mockupClaimError, input.candidateId);
    } else if (mockupClaim?.allowed === false) {
      console.warn("[kv-worker] mockup piece not reserved (insufficient balance):", input.candidateId, mockupClaim);
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new LogoGenerationError(timeoutMessage, 504)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

/** Runs one KV generation attempt end to end: call the provider, validate
 * the actual image bytes (never trust the provider's declared mimeType),
 * upload to Storage, and finalize the candidate + credit atomically via
 * finalize_kv_candidate. The row must already be 'generating' with
 * `input.attemptId` as its current attempt_id before this is called (via
 * acquire_kv_attempt for a fresh candidate, or claim_kv_candidate_retry for
 * a retry) — this function never does that transition itself.
 *
 * Known limitation: the timeout races the JS await, it does not actually
 * abort the underlying provider HTTP call — a very slow request may keep
 * running (and billing the provider) after this function has already
 * finalized the candidate as failed. Acceptable for now; wiring
 * AbortController through every provider SDK call is a larger change than
 * this round warrants. */
export async function runKvCandidateAttempt(
  supabase: ReturnType<typeof createServiceClient>,
  input: KvCandidateAttemptInput
): Promise<KvCandidateAttemptResult> {
  let path: string | undefined;

  try {
    const result = await withTimeout(
      generateLogoCandidate({
        dna: input.dna,
        direction: input.direction,
        apiKey: input.apiKey,
        imageProvider: input.imageProvider,
        imageModel: input.imageModel,
        referenceImages: input.referenceImages,
      }),
      ATTEMPT_TIMEOUT_MS,
      "Tempo esgotado ao gerar a imagem."
    );

    const buffer = Buffer.from(result.b64, "base64");
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(buffer, { failOn: "error" }).metadata();
    // The real format/dimensions come from decoding the bytes — never from
    // the provider's self-reported mimeType (achado de revisão do Codex).
    const format = metadata.format ? ALLOWED_IMAGE_FORMATS[metadata.format] : undefined;
    if (!format || !metadata.width || !metadata.height) {
      throw new LogoGenerationError("Formato de imagem retornado pelo provedor não é suportado.", 502);
    }

    // candidateId + attemptId in the path — a retry never collides with (or
    // accidentally deletes) a previous attempt's file at the same position.
    path = `${input.userId}/launches/${input.launchKitId}/kv/${input.batchId}/${input.assetId}/${input.attemptId}.${format.ext}`;
    const { error: uploadError } = await supabase.storage.from("ai-images").upload(path, buffer, {
      contentType: format.mimeType,
      upsert: false,
    });
    if (uploadError) {
      throw new LogoGenerationError(`Falha ao salvar a imagem gerada: ${uploadError.message}`, 500);
    }

    const { error: rpcError, data: finalizeData } = await supabase.rpc("finalize_kv_candidate", {
      p_user_id: input.userId,
      p_asset_id: input.assetId,
      p_attempt_id: input.attemptId,
      p_generation_history_id: input.generationHistoryId,
      p_success: true,
      p_storage_bucket: "ai-images",
      p_storage_path: path,
      p_mime_type: format.mimeType,
      p_width: metadata.width,
      p_height: metadata.height,
    });

    if (rpcError) {
      // Ambiguous outcome (e.g. network hiccup) — the write may have
      // committed anyway, or may still be running server-side. NEVER
      // delete on an unknown outcome: only a clean 'stale' response is
      // proof this upload is orphaned. A stray file here is a cheap,
      // recoverable cost; deleting a canonical file is not (achado de
      // revisão do Codex — a releitura anterior também podia apagar em
      // cima de uma leitura que falhasse).
      console.error("[kv-worker] finalize_kv_candidate call failed (ambiguous, file preserved):", rpcError, path);
      return { assetId: input.assetId, success: false, outcome: "unknown", errorMessage: rpcError.message };
    }

    const status = finalizeData?.status as string | undefined;
    if (status === "stale") {
      // Proven orphan — a newer attempt owns this candidate now.
      const { error: removeError } = await supabase.storage.from("ai-images").remove([path]);
      if (removeError) console.error("[kv-worker] failed to remove orphaned upload:", removeError, path);
      return { assetId: input.assetId, success: false, outcome: "stale" };
    }
    if (status === "applied" || status === "already_applied") {
      // Melhor-esforço, nunca derruba o candidato: se a paleta/tipografia
      // falhar em compor, o logo (o que já importa pra escolher o kit)
      // continua valendo — só não ganha a cartela extra desta rodada.
      await enrichCandidateIdentity(supabase, {
        userId: input.userId,
        launchKitId: input.launchKitId,
        batchId: input.batchId,
        candidateId: input.candidateId,
        candidatePosition: input.candidatePosition,
        direction: input.direction,
        logoBuffer: buffer,
        primaryColor: input.dna.primaryColor,
        secondaryColor: input.secondaryColor,
        fontChoice: input.fontChoice,
        imageProvider: input.imageProvider,
        imageModel: input.imageModel,
        genType: input.genType,
        cost: input.cost,
        limit: input.limit,
        skipCreditCheck: input.skipCreditCheck,
        hasReferenceImages: input.referenceImages.length > 0,
        productName: input.dna.name,
        subtitle: input.dna.niche,
        applicationPhotos: input.applicationPhotos,
        referenceImages: input.referenceImages,
        mockupLayoutSpec: input.mockupLayoutSpec,
      }).catch((err) => {
        console.error("[kv-worker] identity enrichment failed (non-fatal):", err, input.candidateId);
      });
      // Either way, our upload is (or already was) the canonical file.
      return { assetId: input.assetId, success: true, outcome: status };
    }
    // 'conflict', or an unexpected/empty status — never report success
    // unless the RPC explicitly confirmed the write (achado de revisão do
    // Codex: um status vazio/desconhecido não podia cair no caminho feliz).
    if (status !== "conflict") {
      console.error(`[kv-worker] finalize_kv_candidate returned an unexpected status for asset ${input.assetId}:`, status);
    }
    return { assetId: input.assetId, success: false, outcome: status === "conflict" ? "conflict" : "unknown" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    const errorCode = err instanceof LogoGenerationError ? String(err.status) : "unknown";
    const { error: rpcError, data: finalizeData } = await supabase.rpc("finalize_kv_candidate", {
      p_user_id: input.userId,
      p_asset_id: input.assetId,
      p_attempt_id: input.attemptId,
      p_generation_history_id: input.generationHistoryId,
      p_success: false,
      p_error_code: errorCode,
      p_error_message: message,
    });
    if (rpcError) {
      console.error("[kv-worker] finalize_kv_candidate(failure) call failed (ambiguous):", rpcError);
      return { assetId: input.assetId, success: false, outcome: "unknown", errorMessage: message };
    }
    // Reports whatever the RPC actually decided (e.g. 'conflict' if this
    // attempt somehow got here after already being finalized by a
    // duplicate call — doesn't happen in the normal flow, since nothing
    // calls this function twice with the same attemptId, but the label
    // should reflect reality if it ever does) instead of always claiming a
    // plain "error".
    const failStatus = finalizeData?.status as string | undefined;
    return {
      assetId: input.assetId,
      success: false,
      outcome: failStatus === "already_applied" || failStatus === "applied" || failStatus === "stale" || failStatus === "conflict"
        ? failStatus
        : "error",
      errorMessage: message,
    };
  }
}

export interface KvTextureAttemptInput {
  userId: string;
  launchKitId: string;
  batchId: string;
  assetId: string;
  attemptId: string;
  generationHistoryId: string | null;
  candidateId: string;
  candidatePosition: number;
  colors: BrandColor[];
  fonts: BrandFont[];
  productName: string;
  subtitle?: string;
  applicationPhotos: string[];
  direction: LogoVariationDirection;
  imageProvider: "openai" | "gemini" | "fal";
  imageModel?: string;
  apiKey?: string | null;
}

/** Mesmo ciclo pago de acquire/generating/finalize do logo (runKvCandidateAttempt
 * acima), só que gerando a peça de textura em vez do logo — duplica a
 * plumbing de upload+finalize em vez de generalizar runKvCandidateAttempt
 * pra aceitar um gerador arbitrário, deliberado: o caminho do logo já está
 * validado em produção há várias rodadas, prefiro não arriscar regressão
 * nele só pra eliminar essa duplicação. Ao suceder, tenta montar a Capa
 * (só monta de verdade se o logo também já estiver pronto). */
export async function runKvTextureAttempt(
  supabase: ReturnType<typeof createServiceClient>,
  input: KvTextureAttemptInput
): Promise<KvCandidateAttemptResult> {
  let path: string | undefined;

  try {
    const result = await withTimeout(
      generateTextureCandidate({
        colors: input.colors,
        direction: input.direction,
        apiKey: input.apiKey,
        imageProvider: input.imageProvider,
        imageModel: input.imageModel,
      }),
      ATTEMPT_TIMEOUT_MS,
      "Tempo esgotado ao gerar a textura."
    );

    const buffer = Buffer.from(result.b64, "base64");
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(buffer, { failOn: "error" }).metadata();
    const format = metadata.format ? ALLOWED_IMAGE_FORMATS[metadata.format] : undefined;
    if (!format || !metadata.width || !metadata.height) {
      throw new LogoGenerationError("Formato de imagem retornado pelo provedor não é suportado.", 502);
    }

    path = `${input.userId}/launches/${input.launchKitId}/kv/${input.batchId}/${input.assetId}/${input.attemptId}.${format.ext}`;
    const { error: uploadError } = await supabase.storage.from("ai-images").upload(path, buffer, {
      contentType: format.mimeType,
      upsert: false,
    });
    if (uploadError) {
      throw new LogoGenerationError(`Falha ao salvar a imagem gerada: ${uploadError.message}`, 500);
    }

    const { error: rpcError, data: finalizeData } = await supabase.rpc("finalize_kv_candidate", {
      p_user_id: input.userId,
      p_asset_id: input.assetId,
      p_attempt_id: input.attemptId,
      p_generation_history_id: input.generationHistoryId,
      p_success: true,
      p_storage_bucket: "ai-images",
      p_storage_path: path,
      p_mime_type: format.mimeType,
      p_width: metadata.width,
      p_height: metadata.height,
    });

    if (rpcError) {
      console.error("[kv-worker] finalize_kv_candidate(texture) call failed (ambiguous, file preserved):", rpcError, path);
      return { assetId: input.assetId, success: false, outcome: "unknown", errorMessage: rpcError.message };
    }

    const status = finalizeData?.status as string | undefined;
    if (status === "stale") {
      const { error: removeError } = await supabase.storage.from("ai-images").remove([path]);
      if (removeError) console.error("[kv-worker] failed to remove orphaned texture upload:", removeError, path);
      return { assetId: input.assetId, success: false, outcome: "stale" };
    }
    if (status === "applied" || status === "already_applied") {
      await maybeComposeCoverCard(supabase, {
        userId: input.userId,
        launchKitId: input.launchKitId,
        batchId: input.batchId,
        candidateId: input.candidateId,
        candidatePosition: input.candidatePosition,
        colors: input.colors,
        fonts: input.fonts,
        productName: input.productName,
        subtitle: input.subtitle,
        applicationPhotos: input.applicationPhotos,
      }).catch((err) => {
        console.error("[kv-worker] cover card composition failed (non-fatal):", err, input.candidateId);
      });
      return { assetId: input.assetId, success: true, outcome: status };
    }
    if (status !== "conflict") {
      console.error(`[kv-worker] finalize_kv_candidate(texture) returned an unexpected status for asset ${input.assetId}:`, status);
    }
    return { assetId: input.assetId, success: false, outcome: status === "conflict" ? "conflict" : "unknown" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    const errorCode = err instanceof LogoGenerationError ? String(err.status) : "unknown";
    const { error: rpcError, data: finalizeData } = await supabase.rpc("finalize_kv_candidate", {
      p_user_id: input.userId,
      p_asset_id: input.assetId,
      p_attempt_id: input.attemptId,
      p_generation_history_id: input.generationHistoryId,
      p_success: false,
      p_error_code: errorCode,
      p_error_message: message,
    });
    if (rpcError) {
      console.error("[kv-worker] finalize_kv_candidate(texture, failure) call failed (ambiguous):", rpcError);
      return { assetId: input.assetId, success: false, outcome: "unknown", errorMessage: message };
    }
    const failStatus = finalizeData?.status as string | undefined;
    return {
      assetId: input.assetId,
      success: false,
      outcome: failStatus === "already_applied" || failStatus === "applied" || failStatus === "stale" || failStatus === "conflict"
        ? failStatus
        : "error",
      errorMessage: message,
    };
  }
}

export interface KvMockupAttemptInput {
  userId: string;
  launchKitId: string;
  batchId: string;
  assetId: string;
  attemptId: string;
  generationHistoryId: string | null;
  candidateId: string;
  candidatePosition: number;
  photoDataUrl: string;
  styleReferenceImages: string[];
  colors: BrandColor[];
  fonts: BrandFont[];
  layoutSpec?: MockupLayoutSpec | null;
  productName: string;
  subtitle?: string;
  imageProvider: "openai" | "gemini" | "fal";
  imageModel?: string;
  apiKey?: string | null;
}

/** Mesmo ciclo pago de acquire/generating/finalize do logo/textura, gerando
 * o mockup de aplicação de verdade pelo Nano Banana (generateMockupCandidate)
 * em vez de compor por código — pedido do dono depois de ver o resultado da
 * versão renderizada ("o que está sendo feito está muito longe" da
 * referência). Não dispara nada depois de terminar (diferente da textura,
 * que aciona a Capa) — o mockup é uma peça independente, nada mais depende
 * dela. */
export async function runKvMockupAttempt(
  supabase: ReturnType<typeof createServiceClient>,
  input: KvMockupAttemptInput
): Promise<KvCandidateAttemptResult> {
  let path: string | undefined;

  try {
    const result = await withTimeout(
      generateMockupCandidate({
        photoDataUrl: input.photoDataUrl,
        styleReferenceImages: input.styleReferenceImages,
        colors: input.colors,
        fonts: input.fonts,
        layoutSpec: input.layoutSpec,
        productName: input.productName,
        subtitle: input.subtitle,
        apiKey: input.apiKey,
        imageProvider: input.imageProvider,
        imageModel: input.imageModel,
      }),
      ATTEMPT_TIMEOUT_MS,
      "Tempo esgotado ao gerar o mockup."
    );

    const buffer = Buffer.from(result.b64, "base64");
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(buffer, { failOn: "error" }).metadata();
    const format = metadata.format ? ALLOWED_IMAGE_FORMATS[metadata.format] : undefined;
    if (!format || !metadata.width || !metadata.height) {
      throw new LogoGenerationError("Formato de imagem retornado pelo provedor não é suportado.", 502);
    }

    path = `${input.userId}/launches/${input.launchKitId}/kv/${input.batchId}/${input.assetId}/${input.attemptId}.${format.ext}`;
    const { error: uploadError } = await supabase.storage.from("ai-images").upload(path, buffer, {
      contentType: format.mimeType,
      upsert: false,
    });
    if (uploadError) {
      throw new LogoGenerationError(`Falha ao salvar a imagem gerada: ${uploadError.message}`, 500);
    }

    const { error: rpcError, data: finalizeData } = await supabase.rpc("finalize_kv_candidate", {
      p_user_id: input.userId,
      p_asset_id: input.assetId,
      p_attempt_id: input.attemptId,
      p_generation_history_id: input.generationHistoryId,
      p_success: true,
      p_storage_bucket: "ai-images",
      p_storage_path: path,
      p_mime_type: format.mimeType,
      p_width: metadata.width,
      p_height: metadata.height,
    });

    if (rpcError) {
      console.error("[kv-worker] finalize_kv_candidate(mockup) call failed (ambiguous, file preserved):", rpcError, path);
      return { assetId: input.assetId, success: false, outcome: "unknown", errorMessage: rpcError.message };
    }

    const status = finalizeData?.status as string | undefined;
    if (status === "stale") {
      const { error: removeError } = await supabase.storage.from("ai-images").remove([path]);
      if (removeError) console.error("[kv-worker] failed to remove orphaned mockup upload:", removeError, path);
      return { assetId: input.assetId, success: false, outcome: "stale" };
    }
    if (status === "applied" || status === "already_applied") {
      return { assetId: input.assetId, success: true, outcome: status };
    }
    if (status !== "conflict") {
      console.error(`[kv-worker] finalize_kv_candidate(mockup) returned an unexpected status for asset ${input.assetId}:`, status);
    }
    return { assetId: input.assetId, success: false, outcome: status === "conflict" ? "conflict" : "unknown" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    const errorCode = err instanceof LogoGenerationError ? String(err.status) : "unknown";
    const { error: rpcError, data: finalizeData } = await supabase.rpc("finalize_kv_candidate", {
      p_user_id: input.userId,
      p_asset_id: input.assetId,
      p_attempt_id: input.attemptId,
      p_generation_history_id: input.generationHistoryId,
      p_success: false,
      p_error_code: errorCode,
      p_error_message: message,
    });
    if (rpcError) {
      console.error("[kv-worker] finalize_kv_candidate(mockup, failure) call failed (ambiguous):", rpcError);
      return { assetId: input.assetId, success: false, outcome: "unknown", errorMessage: message };
    }
    const failStatus = finalizeData?.status as string | undefined;
    return {
      assetId: input.assetId,
      success: false,
      outcome: failStatus === "already_applied" || failStatus === "applied" || failStatus === "stale" || failStatus === "conflict"
        ? failStatus
        : "error",
      errorMessage: message,
    };
  }
}

/** Runs a batch of attempts with bounded concurrency — a naive
 * Promise.all(items.map(...)) would fire all N generations at once, which
 * risks hitting per-provider rate limits and makes a serverless-function
 * timeout more likely under load. */
export async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  async function runNext(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
}
