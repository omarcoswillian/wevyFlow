"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { AlertCircle, Library, Wand2, Image as ImageIcon, CheckCircle2, Loader2, RotateCcw, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { KvGerarCanvas } from "./BrandKit/KvGerarCanvas";
import type { BrandDNA } from "../api/generate-logo/shared";
import { KvExampleShowcase } from "./BrandKit/KvExampleShowcase";
import { resizeImageFromUrl, resizeImageFile } from "./BrandKit/reference-images";
import { Lightbox, type LightboxItem } from "./BrandKit/Lightbox";
import { KV_EXAMPLES } from "../lib/kv-examples";
import { useAppContext } from "../(app)/_context";
import type { LaunchAsset } from "../lib/types-kit";
import { BRIEFING_LIMITS } from "../lib/launch-briefing";

function getImageConfig(): { apiKey?: string; imageProvider: string; imageModel?: string } {
  try {
    return {
      apiKey: localStorage.getItem("wf_img_key") || undefined,
      imageProvider: localStorage.getItem("wf_img_provider") || "gemini",
      imageModel: localStorage.getItem("wf_img_model") || undefined,
    };
  } catch {
    return { imageProvider: "gemini" };
  }
}

const DIRECTION_LABELS: Record<string, string> = {
  tipografica: "Tipográfica",
  geometrica: "Geométrica",
  minimalista: "Minimalista",
  expressiva: "Expressiva",
};

const PIECE_LABELS: Record<string, string> = {
  palette_card: "Paleta",
  typography_card: "Tipografia",
  logo_aplicacao: "Aplicação",
  texture_primary: "Textura",
  capa: "Capa",
  mockup_aplicacao: "Mockup",
};

/** Agrupa as peças não-logo (paleta/tipografia/aplicação/textura/capa) de
 * uma lista de LaunchAsset por candidato — usado pra mostrar o kit
 * completo de cada card, não só o logo (achado do dono: "queria uma KV
 * completa, com Capa, paleta de cores, tipografia, logo, logo-aplicado,
 * texturas e ícone e mockup de aplicação"). */
function groupSiblingPiecesByCandidate(assets: LaunchAsset[]): Map<string, LaunchAsset[]> {
  const map = new Map<string, LaunchAsset[]>();
  for (const a of assets) {
    if (a.assetRole === "logo" || !a.candidateId || a.status !== "done") continue;
    map.set(a.candidateId, [...(map.get(a.candidateId) ?? []), a]);
  }
  return map;
}

type Tab = "biblioteca" | "gerar" | "gerados";

interface BrandIdentityPageProps {
  /** The launch this KV belongs to. Always present and already resolved
   * into activeLaunchKit by the parent route (src/app/(app)/marca/page.tsx)
   * — this component never renders without a ready, matching launch. */
  projectId: string;
}

export function BrandIdentityPage({ projectId }: BrandIdentityPageProps) {
  const { navigate, activeLaunchKit, openLaunchByProjectId } = useAppContext();
  const [tab, setTab] = useState<Tab>("gerar");

  const [batchState, setBatchState] = useState<"idle" | "generating" | "done">("idle");
  const [candidates, setCandidates] = useState<LaunchAsset[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const [gerados, setGerados] = useState<LaunchAsset[]>([]);
  const [loadingGerados, setLoadingGerados] = useState(false);

  const [addingReferenceKey, setAddingReferenceKey] = useState<string | null>(null);
  const [referenceNotice, setReferenceNotice] = useState<string | null>(null);
  // "Está adicionada?" é sempre derivado de briefing.referenceImageSources
  // (o que está REALMENTE persistido), nunca de um array local separado —
  // um array local que só é ATUALIZADO otimisticamente, sem nunca ser lido
  // de volta da fonte de verdade, é exatamente o que causou o bug relatado
  // (Biblioteca mostrando "todas adicionadas" com o banco tendo zero
  // referências salvas: o limite de 4 truncou o array persistido, mas o
  // estado local otimista continuava marcando as 7 como adicionadas).
  const referenceSources = useMemo(
    () => activeLaunchKit?.briefing.referenceImageSources ?? [],
    [activeLaunchKit]
  );
  // Trava síncrona (não é useState — precisa valer ANTES do próximo render)
  // contra duas mutações de referência se sobrepondo: cada uma faz um PATCH
  // que SUBSTITUI o array inteiro a partir do `activeLaunchKit` que já tinha
  // na hora em que foi chamada — dois cliques rápidos (dois thumbnails, ou
  // "Usar todas" clicado 2x antes do primeiro render desabilitar o botão)
  // podiam disparar dois PATCHes concorrentes, cada um ignorando a escrita
  // do outro. Mesmo padrão de guarda síncrona já usado em LaunchHub.tsx
  // (localGeneratingRef) pro mesmo tipo de corrida.
  const referenceMutationInFlightRef = useRef(false);

  /** Persists a data URL onto the launch's own briefing.referenceImages —
   * the ONLY field /api/kv/batches actually reads server-side
   * (launch.brandInfo.referenceImages) — plus its parallel `key` onto
   * referenceImageSources, always together, always the same length. Every
   * place that adds a reference (Biblioteca, Gerados, or a raw upload in
   * the Gerar wizard) funnels through this one function, so there's a
   * single source of truth instead of the wizard's old local-only state
   * that never reached the server (achado do dono: "não consigo escolher
   * minha referência de biblioteca" — o Step 0 do wizard mandava um array
   * próprio dentro de `dna`, que a rota de geração sempre ignorava). */
  const addReferenceImage = useCallback(async (dataUrl: string, key: string) => {
    if (!activeLaunchKit || referenceMutationInFlightRef.current) return;
    referenceMutationInFlightRef.current = true;
    setAddingReferenceKey(key);
    setReferenceNotice(null);
    try {
      const currentImages = activeLaunchKit.briefing.referenceImages ?? [];
      const currentSources = activeLaunchKit.briefing.referenceImageSources ?? [];
      // Shallow-merge PATCH replaces the whole array — send the full
      // desired list, not just the new item. Keeps the most recent N when
      // already at the cap instead of silently rejecting the add. The two
      // arrays are truncated together so index N always still means "the
      // same reference" in both.
      const nextImages = [...currentImages, dataUrl].slice(-BRIEFING_LIMITS.maxReferenceImages);
      const nextSources = [...currentSources, key].slice(-BRIEFING_LIMITS.maxReferenceImages);
      const res = await fetch(`/api/launches/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing: { referenceImages: nextImages, referenceImageSources: nextSources } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao adicionar referência.");
      await openLaunchByProjectId(projectId);
      setReferenceNotice("Adicionado como referência para a próxima geração.");
    } catch (e) {
      setReferenceNotice(String((e as Error).message));
    } finally {
      setAddingReferenceKey(null);
      referenceMutationInFlightRef.current = false;
    }
  }, [activeLaunchKit, projectId, openLaunchByProjectId]);

  const handleUseAsReference = useCallback(async (key: string) => {
    if (!activeLaunchKit || referenceMutationInFlightRef.current) return;
    try {
      const dataUrl = await resizeImageFromUrl(key);
      await addReferenceImage(dataUrl, key);
    } catch (e) {
      setReferenceNotice(String((e as Error).message));
    }
  }, [activeLaunchKit, addReferenceImage]);

  const handleUploadReferenceFile = useCallback(async (file: File) => {
    if (!activeLaunchKit || referenceMutationInFlightRef.current) return;
    const key = `upload:${file.name}:${file.size}:${file.lastModified}`;
    try {
      const dataUrl = await resizeImageFile(file);
      await addReferenceImage(dataUrl, key);
    } catch (e) {
      setReferenceNotice(String((e as Error).message));
    }
  }, [activeLaunchKit, addReferenceImage]);

  const handleRemoveReferenceImage = useCallback(async (index: number) => {
    if (!activeLaunchKit || referenceMutationInFlightRef.current) return;
    referenceMutationInFlightRef.current = true;
    const nextImages = (activeLaunchKit.briefing.referenceImages ?? []).filter((_, i) => i !== index);
    const nextSources = (activeLaunchKit.briefing.referenceImageSources ?? []).filter((_, i) => i !== index);
    setReferenceNotice(null);
    try {
      const res = await fetch(`/api/launches/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing: { referenceImages: nextImages, referenceImageSources: nextSources } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao remover referência.");
      await openLaunchByProjectId(projectId);
    } catch (e) {
      setReferenceNotice(String((e as Error).message));
    } finally {
      referenceMutationInFlightRef.current = false;
    }
  }, [activeLaunchKit, projectId, openLaunchByProjectId]);

  /** Remove vários índices de uma vez (um PATCH só) — usado pelo card de
   * referência agrupada do canvas (KvGerarCanvas): apagar o card inteiro
   * apaga todas as imagens daquele grupo juntas. Chamar
   * handleRemoveReferenceImage em loop teria a mesma corrida já documentada
   * em handleUseAllAsReference (cada chamada parte do activeLaunchKit ainda
   * desatualizado da iteração anterior). */
  const handleRemoveReferenceImages = useCallback(async (indices: number[]) => {
    if (!activeLaunchKit || referenceMutationInFlightRef.current || indices.length === 0) return;
    referenceMutationInFlightRef.current = true;
    const indexSet = new Set(indices);
    const nextImages = (activeLaunchKit.briefing.referenceImages ?? []).filter((_, i) => !indexSet.has(i));
    const nextSources = (activeLaunchKit.briefing.referenceImageSources ?? []).filter((_, i) => !indexSet.has(i));
    setReferenceNotice(null);
    try {
      const res = await fetch(`/api/launches/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing: { referenceImages: nextImages, referenceImageSources: nextSources } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao remover referências.");
      await openLaunchByProjectId(projectId);
    } catch (e) {
      setReferenceNotice(String((e as Error).message));
    } finally {
      referenceMutationInFlightRef.current = false;
    }
  }, [activeLaunchKit, projectId, openLaunchByProjectId]);

  // Fotos de aplicação (mockup) — campo separado de referenceImages de
  // propósito: são enviadas ao Nano Banana no mockup (generateMockupCandidate,
  // generate-logo/shared.ts) como a pessoa/produto real a preservar
  // exatamente como fotografado, nunca reinterpretadas como "inspiração de
  // estilo" (pedido do dono: "afinal é bom pra fazermos os criativos,
  // mockups de aplicação" — só funciona se for a pessoa/produto de verdade,
  // não uma releitura da IA).
  const applicationPhotoMutationInFlightRef = useRef(false);
  const [addingApplicationPhoto, setAddingApplicationPhoto] = useState(false);
  const applicationPhotoInputRef = useRef<HTMLInputElement>(null);

  const handleUploadApplicationPhoto = useCallback(async (file: File) => {
    if (!activeLaunchKit || applicationPhotoMutationInFlightRef.current) return;
    applicationPhotoMutationInFlightRef.current = true;
    setAddingApplicationPhoto(true);
    setReferenceNotice(null);
    try {
      const dataUrl = await resizeImageFile(file);
      const current = activeLaunchKit.briefing.applicationPhotos ?? [];
      const next = [...current, dataUrl].slice(-BRIEFING_LIMITS.maxApplicationPhotos);
      const res = await fetch(`/api/launches/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing: { applicationPhotos: next } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao adicionar foto.");
      await openLaunchByProjectId(projectId);
      setReferenceNotice("Foto adicionada — vai aparecer no mockup dos próximos lotes gerados.");
    } catch (e) {
      setReferenceNotice(String((e as Error).message));
    } finally {
      setAddingApplicationPhoto(false);
      applicationPhotoMutationInFlightRef.current = false;
    }
  }, [activeLaunchKit, projectId, openLaunchByProjectId]);

  const handleRemoveApplicationPhoto = useCallback(async (index: number) => {
    if (!activeLaunchKit || applicationPhotoMutationInFlightRef.current) return;
    applicationPhotoMutationInFlightRef.current = true;
    const next = (activeLaunchKit.briefing.applicationPhotos ?? []).filter((_, i) => i !== index);
    setReferenceNotice(null);
    try {
      const res = await fetch(`/api/launches/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing: { applicationPhotos: next } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao remover foto.");
      await openLaunchByProjectId(projectId);
    } catch (e) {
      setReferenceNotice(String((e as Error).message));
    } finally {
      applicationPhotoMutationInFlightRef.current = false;
    }
  }, [activeLaunchKit, projectId, openLaunchByProjectId]);

  const [addingAllExampleId, setAddingAllExampleId] = useState<string | null>(null);

  // Popup pra ver uma peça gerada em tamanho grande, com navegação entre o
  // logo e as demais peças do mesmo kit — nunca abre página/aba nova
  // (pedido do dono).
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const openPieceLightbox = useCallback((items: LightboxItem[], index: number) => {
    if (items.length === 0) return;
    setLightbox({ items, index });
  }, []);

  /** "Usar todas (N)" — adiciona TODAS as imagens de um exemplo de uma vez,
   * em vez de clicar imagem por imagem (pedido do dono: "se eu selecionar
   * Exemplo real — A Carreira de Ouro quero selecionar todas imagens que ali
   * estão"). Calcula a lista final e faz UM PATCH só — chamar
   * addReferenceImage em loop teria uma corrida real (cada chamada parte do
   * `activeLaunchKit` ainda desatualizado da iteração anterior, então só a
   * última imagem sobreviveria). Continua respeitando
   * BRIEFING_LIMITS.maxReferenceImages: se não couberem todas, mantém as
   * mais recentes e avisa quantas ficaram de fora — nunca falha em silêncio,
   * e nunca marca como "adicionada" uma imagem que o corte descartou (era
   * exatamente esse o bug relatado: o array local marcava as 7 como
   * adicionadas mesmo quando só 4 sobreviviam no banco). */
  const handleUseAllAsReference = useCallback(async (slides: { path: string }[], exampleId: string) => {
    if (!activeLaunchKit || referenceMutationInFlightRef.current) return;
    const toAdd = slides.filter((s) => !referenceSources.includes(s.path));
    if (toAdd.length === 0) {
      setReferenceNotice("Essas imagens já foram adicionadas como referência.");
      return;
    }
    referenceMutationInFlightRef.current = true;
    setAddingAllExampleId(exampleId);
    setReferenceNotice(null);
    try {
      const dataUrls = await Promise.all(toAdd.map((s) => resizeImageFromUrl(s.path)));
      const currentImages = activeLaunchKit.briefing.referenceImages ?? [];
      const currentSources = activeLaunchKit.briefing.referenceImageSources ?? [];
      const combinedImages = [...currentImages, ...dataUrls];
      const combinedSources = [...currentSources, ...toAdd.map((s) => s.path)];
      const nextImages = combinedImages.slice(-BRIEFING_LIMITS.maxReferenceImages);
      const nextSources = combinedSources.slice(-BRIEFING_LIMITS.maxReferenceImages);
      const droppedCount = combinedImages.length - nextImages.length;

      const res = await fetch(`/api/launches/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing: { referenceImages: nextImages, referenceImageSources: nextSources } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao adicionar referências.");
      await openLaunchByProjectId(projectId);
      setReferenceNotice(
        droppedCount > 0
          ? `Adicionadas ${nextImages.length} de ${combinedImages.length} imagens — limite de ${BRIEFING_LIMITS.maxReferenceImages} referências atingido (as mais recentes venceram).`
          : `${toAdd.length} imagem${toAdd.length > 1 ? "ns" : ""} adicionada${toAdd.length > 1 ? "s" : ""} como referência.`
      );
    } catch (e) {
      setReferenceNotice(String((e as Error).message));
    } finally {
      setAddingAllExampleId(null);
      referenceMutationInFlightRef.current = false;
    }
  }, [activeLaunchKit, referenceSources, projectId, openLaunchByProjectId]);

  const loadGerados = useCallback(async () => {
    setLoadingGerados(true);
    try {
      const res = await fetch(`/api/kv/assets?projectId=${projectId}`);
      const json = await res.json();
      if (res.ok) setGerados(json.assets ?? []);
    } finally {
      setLoadingGerados(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (tab === "gerados") loadGerados();
  }, [tab, loadGerados]);

  /** Roda uma etapa por vez (POST .../[batchId]/step) até o lote não ter mais
   * nenhuma peça pending/generating (Rodada C) — nunca um único request que
   * gera tudo de uma vez. Cada resposta já atualiza `candidates` com o que
   * está pronto até agora, então a grade preenche progressivamente em vez de
   * aparecer tudo de repente no fim. */
  const stepBatch = useCallback(async (batchId: string, apiKey?: string) => {
    for (;;) {
      const res = await fetch(`/api/kv/batches/${batchId}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, apiKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao processar o lote de KV.");
      setCandidates(json.batch.candidates);
      if (json.done) break;
    }
  }, [projectId]);

  const handleGenerateBatch = useCallback(async (dna: BrandDNA) => {
    setBatchState("generating");
    setBatchError(null);
    setCandidates([]);
    try {
      const config = getImageConfig();
      const clientBatchId = crypto.randomUUID();
      const res = await fetch("/api/kv/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, clientBatchId, dna, ...config }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao gerar o lote de KV.");
      setCandidates(json.batch.candidates);
      await stepBatch(json.batch.batchId, config.apiKey);
      setBatchState("done");
    } catch (e) {
      setBatchError(String((e as Error).message));
      setBatchState("idle");
    }
  }, [projectId, stepBatch]);

  // Retomada: se a página é aberta (ou reaberta) com um lote que ficou pra
  // trás no meio da geração — aba fechada, navegador travou — a próxima
  // visita continua de onde parou em vez de deixar o lote preso em
  // 'pending' pra sempre (spec do Codex, seção 4.1 — "ao reabrir, consulta
  // o estado e permite continuar"). Só considera o lote mais recente; um
  // lote antigo abandonado só é limpo pelo reap (3min) na próxima vez que
  // QUALQUER rota de KV rodar pra este usuário — não precisa de ação daqui.
  const [resumeChecked, setResumeChecked] = useState(false);
  useEffect(() => {
    if (resumeChecked || !activeLaunchKit) return;
    setResumeChecked(true);
    (async () => {
      try {
        const res = await fetch(`/api/kv/assets?projectId=${projectId}`);
        const json = await res.json();
        if (!res.ok) return;
        const all: LaunchAsset[] = json.assets ?? [];
        setGerados(all);
        if (all.length === 0) return;

        const byBatch = new Map<string, LaunchAsset[]>();
        for (const a of all) byBatch.set(a.batchId, [...(byBatch.get(a.batchId) ?? []), a]);
        let latestBatchId: string | null = null;
        let latestCreatedAt = "";
        for (const [batchId, items] of byBatch) {
          const createdAt = items[0]?.createdAt ?? "";
          if (createdAt > latestCreatedAt) {
            latestCreatedAt = createdAt;
            latestBatchId = batchId;
          }
        }
        if (!latestBatchId) return;
        const latestItems = byBatch.get(latestBatchId)!;
        if (!latestItems.some((a) => a.status === "pending" || a.status === "generating")) return;

        setCandidates(latestItems);
        setBatchState("generating");
        const config = getImageConfig();
        await stepBatch(latestBatchId, config.apiKey);
        setBatchState("done");
      } catch {
        // Retomada é um bônus — se falhar, o usuário ainda pode gerar um
        // lote novo normalmente pela wizard.
      }
    })();
  }, [resumeChecked, activeLaunchKit, projectId, stepBatch]);

  const handleRetry = useCallback(async (assetId: string) => {
    setRetryingId(assetId);
    setBatchError(null);
    try {
      const config = getImageConfig();
      const clientAttemptId = crypto.randomUUID();
      const res = await fetch(`/api/kv/candidates/${assetId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, clientAttemptId, apiKey: config.apiKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao reprocessar.");
      setCandidates(json.batch.candidates);
    } catch (e) {
      setBatchError(String((e as Error).message));
    } finally {
      setRetryingId(null);
    }
  }, [projectId]);

  const handleSelect = useCallback(async (assetId: string) => {
    setSelectingId(assetId);
    setBatchError(null);
    try {
      const res = await fetch("/api/kv/selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, assetId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao escolher o KV.");
      await openLaunchByProjectId(projectId);
    } catch (e) {
      setBatchError(String((e as Error).message));
    } finally {
      setSelectingId(null);
    }
  }, [projectId, openLaunchByProjectId]);

  const handleNewBatch = useCallback(() => {
    setBatchState("idle");
    setCandidates([]);
    setBatchError(null);
  }, []);

  const productName = activeLaunchKit?.brandInfo?.productName || "Identidade Visual";
  const selectedKvAssetId = activeLaunchKit?.selectedKvAssetId ?? null;
  // A partir da Rodada B, um candidato pode ter mais de uma peça (logo +
  // cartela de paleta, por enquanto) — cada peça é uma linha própria de
  // launch_assets, então sem esse filtro a grade mostraria 8 cards pra um
  // lote de 4 candidatos. Até a Rodada E (seleção de kit agrupado na UI),
  // a grade mostra só a peça-logo de cada candidato; as demais peças
  // continuam persistidas, só não aparecem aqui ainda.
  const isPrimaryCard = (a: LaunchAsset) => a.assetRole === "logo" || !a.assetRole;
  const logoCandidates = candidates.filter(isPrimaryCard);
  const doneGerados = gerados.filter((g) => g.status === "done" && isPrimaryCard(g));
  const gerarSiblingsByCandidate = useMemo(() => groupSiblingPiecesByCandidate(candidates), [candidates]);
  const geradosSiblingsByCandidate = useMemo(() => groupSiblingPiecesByCandidate(gerados), [gerados]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 pt-6 pb-4 shrink-0 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-white/20 font-semibold mb-0.5">Sistema de Identidade Visual</p>
          <h2 className="text-[15px] font-semibold text-white/70 tracking-tight">{productName} — KV</h2>
        </div>
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
          {([
            { id: "biblioteca" as const, label: "Biblioteca", icon: <Library className="w-3 h-3" />, badge: 0 },
            { id: "gerar" as const, label: "Gerar", icon: <Wand2 className="w-3 h-3" />, badge: 0 },
            { id: "gerados" as const, label: "Gerados", icon: <ImageIcon className="w-3 h-3" />, badge: doneGerados.length },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer",
                tab === t.id ? "bg-purple-600/20 text-purple-300" : "text-white/35 hover:text-white/60"
              )}
            >
              {t.icon}
              {t.label}
              {t.badge > 0 && (
                <span className="ml-0.5 px-1.5 rounded-full bg-white/[0.08] text-white/50 text-[9px]">{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 pb-10">
        {batchError && (
          <div className="mb-5 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 max-w-[820px]">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-medium text-red-300">{batchError}</p>
              {batchError.includes("configurada") && (
                <p className="text-[11px] text-white/30 mt-0.5">Configure sua chave em Configurações &gt; IA de Imagem na Home.</p>
              )}
            </div>
          </div>
        )}

        {tab === "biblioteca" && (
          <div className="max-w-[900px]">
            <div className="flex items-center justify-between mb-5">
              <p className="text-[13px] text-white/30">Referências reais pra te inspirar — passe o mouse numa imagem e clique no ícone pra usá-la como referência na sua próxima geração.</p>
              {(activeLaunchKit?.briefing.referenceImages?.length ?? 0) > 0 && (
                <span className="shrink-0 ml-3 px-2 py-1 rounded-full bg-purple-500/10 text-purple-300 text-[10px] font-semibold whitespace-nowrap">
                  {activeLaunchKit?.briefing.referenceImages?.length} referência{(activeLaunchKit?.briefing.referenceImages?.length ?? 0) > 1 ? "s" : ""} ativa{(activeLaunchKit?.briefing.referenceImages?.length ?? 0) > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {referenceNotice && (
              <p className="text-[11px] text-white/40 mb-4">{referenceNotice}</p>
            )}

            <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[13px] font-semibold text-white/70">Suas fotos</p>
                <span className="text-[10px] text-white/25">
                  {(activeLaunchKit?.briefing.applicationPhotos?.length ?? 0)}/{BRIEFING_LIMITS.maxApplicationPhotos}
                </span>
              </div>
              <p className="text-[11px] text-white/30 mb-3">
                Fotos suas ou do produto — nunca geradas por IA, viram o mockup de aplicação da KV e depois dá pra reaproveitar nos criativos.
              </p>
              <div className="flex flex-wrap gap-2">
                {(activeLaunchKit?.briefing.applicationPhotos ?? []).map((src, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/[0.08] group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Sua foto ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemoveApplicationPhoto(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <span className="text-white text-[10px] leading-none">✕</span>
                    </button>
                  </div>
                ))}
                {(activeLaunchKit?.briefing.applicationPhotos?.length ?? 0) < BRIEFING_LIMITS.maxApplicationPhotos && (
                  <button
                    onClick={() => applicationPhotoInputRef.current?.click()}
                    disabled={addingApplicationPhoto}
                    className="w-20 h-20 rounded-lg border border-dashed border-white/[0.1] hover:border-purple-500/40 flex items-center justify-center transition-colors text-white/25 hover:text-white/60 cursor-pointer disabled:cursor-default"
                  >
                    {addingApplicationPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  </button>
                )}
                <input
                  ref={applicationPhotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadApplicationPhoto(file);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            {KV_EXAMPLES.map((example) => (
              <KvExampleShowcase
                key={example.id}
                example={example}
                onUseAsReference={(slide) => handleUseAsReference(slide.path)}
                addingPath={addingReferenceKey}
                addedPaths={referenceSources}
                onUseAllAsReference={(slides) => handleUseAllAsReference(slides, example.id)}
                isAddingAll={addingAllExampleId === example.id}
              />
            ))}
          </div>
        )}

        {tab === "gerar" && (
          <div className="flex flex-col items-center">
            {batchState === "idle" && (
              <KvGerarCanvas
                brandName={activeLaunchKit?.brandInfo?.productName || "Marca"}
                onComplete={handleGenerateBatch}
                isGenerating={false}
                referenceImages={activeLaunchKit?.briefing.referenceImages ?? []}
                referenceImageSources={activeLaunchKit?.briefing.referenceImageSources ?? []}
                onUploadReference={handleUploadReferenceFile}
                onRemoveReference={handleRemoveReferenceImage}
                onRemoveReferences={handleRemoveReferenceImages}
                isUploadingReference={!!addingReferenceKey}
                onGoToLibrary={() => setTab("biblioteca")}
                applicationPhotos={activeLaunchKit?.briefing.applicationPhotos ?? []}
                onUploadApplicationPhoto={handleUploadApplicationPhoto}
                onRemoveApplicationPhoto={handleRemoveApplicationPhoto}
                isUploadingApplicationPhoto={addingApplicationPhoto}
              />
            )}
            {batchState === "generating" && logoCandidates.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-24">
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                <p className="text-[13px] text-white/40">Preparando o lote...</p>
              </div>
            )}
            {(batchState === "done" || (batchState === "generating" && logoCandidates.length > 0)) && (
              <div className="w-full max-w-[820px]">
                {referenceNotice && (
                  <p className="text-[11px] text-white/40 mb-3">{referenceNotice}</p>
                )}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[13px] text-white/50">
                    {batchState === "generating"
                      ? "Gerando sua KV — as variações aparecem aqui conforme ficam prontas."
                      : "Escolha a variação que mais representa a sua marca."}
                  </p>
                  {batchState === "done" && (
                    <button
                      onClick={handleNewBatch}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white/80 text-[11px] font-medium cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" /> Gerar novo lote
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {logoCandidates.map((c) => (
                    <KvCandidateCard
                      key={c.id}
                      candidate={c}
                      isSelected={selectedKvAssetId === c.id}
                      isSelecting={selectingId === c.id}
                      isRetrying={retryingId === c.id}
                      onSelect={() => handleSelect(c.id)}
                      onRetry={() => handleRetry(c.id)}
                      onUseAsReference={c.url ? () => handleUseAsReference(c.url!) : undefined}
                      isAddingReference={!!c.url && addingReferenceKey === c.url}
                      isReferenceAdded={!!c.url && referenceSources.includes(c.url)}
                      siblingPieces={gerarSiblingsByCandidate.get(c.candidateId ?? "")}
                      onOpenPiece={openPieceLightbox}
                    />
                  ))}
                </div>
                {batchState === "done" && selectedKvAssetId && candidates.some((c) => c.id === selectedKvAssetId) && (
                  <div className="mt-6 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-[12px] text-emerald-300">KV escolhido para este lançamento.</p>
                    <button
                      onClick={() => navigate("lancamentos", projectId)}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium cursor-pointer transition-colors"
                    >
                      Continuar lançamento
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "gerados" && (
          <div className="max-w-[900px]">
            {referenceNotice && (
              <p className="text-[11px] text-white/40 mb-4">{referenceNotice}</p>
            )}
            {loadingGerados ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
              </div>
            ) : doneGerados.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-20 text-center">
                <ImageIcon className="w-8 h-8 text-white/15" />
                <p className="text-[13px] text-white/30">Nenhum KV gerado ainda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {doneGerados.map((c) => (
                  <KvCandidateCard
                    key={c.id}
                    candidate={c}
                    compact
                    isSelected={selectedKvAssetId === c.id}
                    isSelecting={selectingId === c.id}
                    isRetrying={false}
                    onSelect={() => handleSelect(c.id)}
                    onRetry={() => {}}
                    onUseAsReference={c.url ? () => handleUseAsReference(c.url!) : undefined}
                    isAddingReference={!!c.url && addingReferenceKey === c.url}
                    isReferenceAdded={!!c.url && referenceSources.includes(c.url)}
                    siblingPieces={geradosSiblingsByCandidate.get(c.candidateId ?? "")}
                    onOpenPiece={openPieceLightbox}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {lightbox && (
        <Lightbox
          items={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(i) => setLightbox((prev) => (prev ? { ...prev, index: i } : prev))}
        />
      )}
    </div>
  );
}

function KvCandidateCard({
  candidate, isSelected, isSelecting, isRetrying, onSelect, onRetry, compact,
  onUseAsReference, isAddingReference, isReferenceAdded, siblingPieces, onOpenPiece,
}: {
  candidate: LaunchAsset;
  isSelected: boolean;
  isSelecting: boolean;
  isRetrying: boolean;
  onSelect: () => void;
  onRetry: () => void;
  compact?: boolean;
  onUseAsReference?: () => void;
  isAddingReference?: boolean;
  isReferenceAdded?: boolean;
  /** Demais peças já concluídas deste mesmo candidato (paleta, tipografia,
   * aplicação, textura, capa) — mostradas como uma tira de miniaturas
   * abaixo do logo principal, pra deixar o kit inteiro visível, não só a
   * peça-logo (a grade só mostra um card por candidato). */
  siblingPieces?: LaunchAsset[];
  /** Abre o popup (Lightbox) em vez de navegar pra outra página/aba — pedido
   * do dono: "não quero abrir uma página diferente, quero que abra um
   * popup... igual temos na biblioteca da KV". */
  onOpenPiece: (items: LightboxItem[], index: number) => void;
}) {
  const label = candidate.variationKey ? (DIRECTION_LABELS[candidate.variationKey] ?? candidate.variationKey) : null;
  const kitItems: LightboxItem[] = candidate.url
    ? [
        { path: candidate.url, label: label ?? "Logo" },
        ...(siblingPieces ?? [])
          .filter((p) => p.url)
          .map((p) => ({ path: p.url!, label: PIECE_LABELS[p.pieceKey ?? ""] ?? "Peça" })),
      ]
    : [];

  return (
    <div className={cn(
      "group rounded-2xl border overflow-hidden bg-white/[0.02] transition-colors",
      isSelected ? "border-emerald-500/40" : "border-white/[0.06]"
    )}>
      <div className={cn("relative bg-black/40 flex items-center justify-center", compact ? "aspect-square" : "aspect-[4/3]")}>
        {candidate.status === "done" && candidate.url && (
          <button
            onClick={() => onOpenPiece(kitItems, 0)}
            className="w-full h-full cursor-pointer"
            title="Ver em tamanho grande"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={candidate.url} alt={label ?? "KV"} className="w-full h-full object-contain" />
          </button>
        )}
        {candidate.status === "error" && (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <AlertCircle className="w-5 h-5 text-red-400/70" />
            <p className="text-[10px] text-red-300/70">{candidate.errorMessage || "Falha ao gerar"}</p>
          </div>
        )}
        {(candidate.status === "pending" || candidate.status === "generating") && (
          <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
        )}
        {isSelected && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[9px] font-semibold">
            <CheckCircle2 className="w-3 h-3" /> KV atual
          </div>
        )}
        {onUseAsReference && candidate.status === "done" && (
          <button
            onClick={(e) => { e.stopPropagation(); onUseAsReference(); }}
            disabled={isAddingReference || isReferenceAdded}
            title={isReferenceAdded ? "Já usado como referência" : "Usar como referência"}
            className={cn(
              "absolute top-2 left-2 w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer disabled:cursor-default",
              isReferenceAdded ? "bg-emerald-500/90 text-white opacity-100" : "bg-black/60 text-white/80 opacity-0 group-hover:opacity-100 hover:bg-purple-600/90"
            )}
          >
            {isAddingReference ? <Loader2 className="w-3 h-3 animate-spin" /> : isReferenceAdded ? <CheckCircle2 className="w-3 h-3" /> : <ImagePlus className="w-3 h-3" />}
          </button>
        )}
      </div>
      {siblingPieces && siblingPieces.length > 0 && (
        <div className="flex gap-1.5 px-3 pt-2.5 overflow-x-auto scrollbar-none">
          {siblingPieces.map((piece, i) => (
            <button
              key={piece.id}
              onClick={(e) => { e.stopPropagation(); onOpenPiece(kitItems, i + 1); }}
              title={PIECE_LABELS[piece.pieceKey ?? ""] ?? piece.pieceKey ?? ""}
              className="shrink-0 flex flex-col items-center gap-1 group/piece cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/[0.08] bg-black/30 group-hover/piece:border-purple-500/40 transition-colors">
                {piece.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={piece.url} alt={PIECE_LABELS[piece.pieceKey ?? ""] ?? ""} className="w-full h-full object-cover" />
                )}
              </div>
              <span className="text-[8px] text-white/30 group-hover/piece:text-white/60 uppercase tracking-wide truncate max-w-[44px] transition-colors">
                {PIECE_LABELS[piece.pieceKey ?? ""] ?? "Peça"}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="px-3 py-2.5 flex items-center gap-2">
        {label && <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold truncate">{label}</p>}
        {candidate.status === "done" && !isSelected && (
          <button
            onClick={onSelect}
            disabled={isSelecting}
            className="ml-auto px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-[10px] font-semibold cursor-pointer transition-colors disabled:opacity-50"
          >
            {isSelecting ? "Escolhendo..." : "Usar este KV"}
          </button>
        )}
        {candidate.status === "error" && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="ml-auto px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white/80 text-[10px] font-semibold cursor-pointer transition-colors disabled:opacity-50"
          >
            {isRetrying ? "Tentando..." : "Tentar novamente"}
          </button>
        )}
      </div>
    </div>
  );
}
