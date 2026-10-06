"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Trash2, CheckCircle2, Circle, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppContext } from "../(app)/_context";
import { BRIEFING_LIMITS, toBrandInfo, type LaunchBriefing } from "../lib/launch-briefing";
import { EmailSequencePanel } from "./EmailSequencePanel";
import { CopyView } from "./CopyView";
import { useCopyDocuments } from "../lib/copy/useCopyDocuments";
import { createClient } from "@/lib/supabase/client";

const FONT_OPTIONS = [
  { id: "sora", label: "Sora" }, { id: "inter", label: "Inter" },
  { id: "poppins", label: "Poppins" }, { id: "montserrat", label: "Montserrat" },
  { id: "playfair", label: "Playfair" }, { id: "space-grotesk", label: "Space Grotesk" },
];

const STYLE_OPTIONS = [
  { id: "dark-premium", label: "Escuro premium" }, { id: "light-clean", label: "Claro e limpo" },
  { id: "glassmorphism", label: "Vidro fosco" }, { id: "neon-tech", label: "Neon tech" },
  { id: "luxury", label: "Luxo" }, { id: "brutalist", label: "Brutalista" },
];

/* O Hub controla a narrativa do lançamento (quem é o público, a promessa, o
 * mecanismo, a oferta, as provas). Copy e Emails são frentes que consomem essa
 * narrativa; Design/criativos ficam fora daqui, em /criativos. */

type HubTab = "narrativa" | "marca" | "copy" | "pecas" | "emails";

const HUB_TABS: { id: HubTab; label: string }[] = [
  { id: "narrativa", label: "Narrativa" },
  { id: "marca", label: "Marca" },
  { id: "copy", label: "Copy" },
  { id: "pecas", label: "Peças" },
  { id: "emails", label: "Emails" },
];

const STRATEGY_LABEL: Record<string, string> = {
  classico: "Clássico", meteorico: "Meteórico", semente: "Semente",
  "pago-vsl": "Pago / VSL", perpetuo: "Perpétuo",
};

type NarrativeKey = "targetAudience" | "transformation" | "mecanismo" | "preco" | "provas";

const NARRATIVE_FIELDS: { key: NarrativeKey; label: string; hint: string; placeholder: string; rows: number }[] = [
  { key: "targetAudience", label: "Para quem", hint: "Quem é a pessoa e em que momento ela está.", placeholder: "Ex: mulheres de 30 a 45 anos que já tentaram várias dietas", rows: 2 },
  { key: "transformation", label: "Promessa", hint: "A transformação que o produto entrega e em quanto tempo.", placeholder: "Ex: perder 10kg em 60 dias sem cortar carboidrato", rows: 3 },
  { key: "mecanismo", label: "Mecanismo único", hint: "Por que isso funciona quando o resto falhou.", placeholder: "Ex: o protocolo que ajusta a insulina antes de reduzir calorias", rows: 3 },
  { key: "preco", label: "Oferta e preço", hint: "Preço, âncora, bônus e garantia.", placeholder: "Ex: R$ 997 (de R$ 2.997), 3 bônus, garantia de 7 dias", rows: 2 },
  { key: "provas", label: "Provas", hint: "Resultados, números e depoimentos que sustentam a promessa.", placeholder: "Ex: 1.200 alunas, média de 8kg, depoimentos da turma 3", rows: 4 },
];

interface Piece {
  id: string; url: string; format: string; status: string;
  copy_headline: string | null; copy_cta: string | null; text_layer: boolean; created_at: string;
}

/** Quadro de peças do lançamento: o Hub não gera design, mas controla o que
 * foi gerado pra ele e o que está aprovado. */
function PiecesBoard({ projectId, onOpenDesign }: { projectId: string; onOpenDesign: () => void }) {
  const [pieces, setPieces] = useState<Piece[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await createClient()
      .from("criativos")
      .select("id,url,format,status,copy_headline,copy_cta,text_layer,created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (err) { setError(err.message); setPieces([]); return; }
    setError(null);
    setPieces((data ?? []) as Piece[]);
  }, [projectId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const toggle = async (piece: Piece) => {
    const next = piece.status === "approved" ? "draft" : "approved";
    const { error: err } = await createClient().from("criativos").update({ status: next }).eq("id", piece.id);
    if (err) { setError(err.message); return; }
    setPieces((prev) => prev?.map((p) => (p.id === piece.id ? { ...p, status: next } : p)) ?? prev);
  };

  const approved = pieces?.filter((p) => p.status === "approved").length ?? 0;

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold text-white">Peças do lançamento</h2>
          <p className="text-[11px] text-white/35 mt-0.5">
            {pieces && pieces.length > 0 ? `${approved} de ${pieces.length} aprovadas` : "As peças geradas em Criativos para este lançamento aparecem aqui."}
          </p>
        </div>
        <button
          onClick={onOpenDesign}
          className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/70 text-[11px] font-medium transition-colors cursor-pointer"
        >
          Abrir Criativos
        </button>
      </div>

      {error && <p className="text-[11px] text-red-400">Erro ao carregar peças: {error}</p>}

      {pieces === null ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 text-purple-400 animate-spin" /></div>
      ) : pieces.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-14 text-center">
          <p className="text-[13px] font-medium text-white/60">Nenhuma peça ainda</p>
          <p className="text-[11px] text-white/30 mt-1 max-w-sm mx-auto">
            Gere uma peça em Criativos com este lançamento aberto e clique em Usar: ela entra aqui para você aprovar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {pieces.map((piece) => (
            <div key={piece.id} className="rounded-xl bg-[#18181b] border border-white/[0.06] overflow-hidden">
              <div className="aspect-[4/5] bg-black/30 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={piece.url} alt={piece.copy_headline ?? "Peça"} className="w-full h-full object-cover" />
              </div>
              <div className="p-3 space-y-2">
                <p className="text-[11px] text-white/70 line-clamp-2 min-h-[28px]">{piece.copy_headline || "Sem headline vinculada"}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-white/30">{piece.format}{piece.text_layer ? " · texto exato" : ""}</span>
                  <button
                    onClick={() => toggle(piece)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors cursor-pointer",
                      piece.status === "approved"
                        ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                        : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]"
                    )}
                  >
                    {piece.status === "approved" ? "Aprovada" : "Aprovar"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NarrativeField({
  label, hint, placeholder, rows, value, maxLength, onCommit,
}: {
  label: string; hint: string; placeholder: string; rows: number;
  value: string; maxLength: number; onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const filled = draft.trim().length > 0;
  return (
    <div className="rounded-xl bg-[#18181b] border border-white/[0.06] focus-within:border-purple-500/40 transition-colors p-4">
      <div className="flex items-center gap-2 mb-1">
        {filled
          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          : <Circle className="w-3.5 h-3.5 text-white/20" />}
        <label className="text-[12px] font-semibold text-white">{label}</label>
      </div>
      <p className="text-[11px] text-white/35 mb-2.5">{hint}</p>
      <textarea
        value={draft}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== value) onCommit(draft); }}
        className="w-full resize-none bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] leading-relaxed text-white placeholder:text-white/20 focus:outline-none"
      />
    </div>
  );
}

export function LaunchHub() {
  const {
    activeLaunchKit, setActiveLaunchKit, saveLaunchKit, deleteLaunchKit, navigate,
  } = useAppContext();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // A aba vive na URL (?aba=) pra sobreviver a reload e poder ser linkada;
  // o projectId continua sendo a única fonte do lançamento ativo.
  const router = useRouter();
  const searchParams = useSearchParams();
  const abaParam = searchParams.get("aba");
  const tab: HubTab = HUB_TABS.some((t) => t.id === abaParam) ? (abaParam as HubTab) : "narrativa";
  const goTab = (next: HubTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "narrativa") params.delete("aba"); else params.set("aba", next);
    router.replace(`/lancamentos?${params.toString()}`);
  };
  const { documents: copyDocs } = useCopyDocuments(activeLaunchKit?.projectId);

  // LaunchHub só renderiza pra um kit ativado, e ativar exige estratégia
  // escolhida — strategyId é não-nulo aqui, mesmo que o tipo permita null.
  if (!activeLaunchKit || !activeLaunchKit.strategyId) return null;

  const kit = activeLaunchKit;
  const b = kit.briefing;
  const launchFacts = {
    productName: kit.brandInfo.productName,
    niche: kit.brandInfo.niche,
    targetAudience: kit.brandInfo.targetAudience,
    transformation: kit.brandInfo.transformation,
  };

  const emailSequences = kit.emailSequences ?? { cpl: [], vendas: [], recuperacao: [] };
  const emailsDone = Object.values(emailSequences).filter((seq) => seq.length > 0).length;
  const narrativeDone = NARRATIVE_FIELDS.filter((f) => b[f.key].trim().length > 0).length;
  const copyApproved = copyDocs.filter((d) => d.status === "approved").length;

  const totalSteps = NARRATIVE_FIELDS.length + 1 + 3;
  const doneSteps = narrativeDone + (copyApproved > 0 ? 1 : 0) + emailsDone;
  const progressPct = Math.round((doneSteps / totalSteps) * 100);

  const commitBriefing = (patch: Partial<LaunchBriefing>) => {
    const briefing: LaunchBriefing = { ...kit.briefing, ...patch };
    const updated = { ...kit, briefing, brandInfo: toBrandInfo(briefing), updatedAt: new Date().toISOString() };
    setActiveLaunchKit(updated);
    saveLaunchKit(updated).catch((e) => setPersistError(e instanceof Error ? e.message : "Erro ao salvar o lançamento."));
  };
  const commitNarrative = (key: NarrativeKey, value: string) => commitBriefing({ [key]: value });

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      if (!file.type.startsWith("image/") || file.size > 2_000_000) throw new Error("Use uma imagem de até 2 MB (PNG, SVG ou JPG).");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Faça login para enviar o logo.");
      const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${user.id}/logos/${kit.projectId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("ai-images").upload(path, file, { upsert: false });
      if (error) throw new Error(error.message);
      const { data: { publicUrl } } = supabase.storage.from("ai-images").getPublicUrl(path);
      commitBriefing({ logoUrl: publicUrl });
    } catch (e) {
      setPersistError(e instanceof Error ? e.message : "Erro ao enviar o logo.");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await deleteLaunchKit(kit.projectId);
      setActiveLaunchKit(null);
      navigate("lancamentos");
    } catch (e) {
      setPersistError(e instanceof Error ? e.message : "Erro ao excluir lançamento.");
    }
  };

  const handleBack = () => {
    setActiveLaunchKit(null);
    navigate("lancamentos");
  };

  const radius = 14;
  const circ = 2 * Math.PI * radius;
  const dash = circ * (progressPct / 100);

  const fronts: { id: HubTab; label: string; value: string; hint: string }[] = [
    { id: "narrativa", label: "Narrativa", value: `${narrativeDone}/${NARRATIVE_FIELDS.length}`, hint: "pontos definidos" },
    { id: "copy", label: "Copy", value: `${copyApproved}/${copyDocs.length}`, hint: copyDocs.length ? "aprovadas" : "nenhuma ainda" },
    { id: "emails", label: "Emails", value: `${emailsDone}/3`, hint: "sequências geradas" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0c0c10]">

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-5 py-3 bg-[#0c0c10]/95 backdrop-blur border-b border-white/[0.05] shrink-0">
        <button
          onClick={handleBack}
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <h1 className="text-[15px] font-semibold text-white truncate">{kit.brandInfo.productName}</h1>
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-medium">
            {STRATEGY_LABEL[activeLaunchKit.strategyId ?? ""]}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
              <circle cx="18" cy="18" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
              <circle
                cx="18" cy="18" r={radius} fill="none"
                stroke={progressPct === 100 ? "#34d399" : "#a78bfa"}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
                style={{ transition: "stroke-dasharray 0.4s ease" }}
              />
            </svg>
            <div className="text-right">
              <p className="text-[13px] font-semibold text-white leading-none">{doneSteps}/{totalSteps}</p>
              <p className="text-[9px] text-white/30 mt-0.5">etapas</p>
            </div>
          </div>

          <div className="w-px h-6 bg-white/[0.06]" />

          <button
            onClick={handleDelete}
            onBlur={() => setConfirmDelete(false)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer",
              confirmDelete
                ? "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25"
                : "bg-white/[0.04] border border-white/[0.06] text-white/30 hover:text-red-400 hover:border-red-500/20"
            )}
          >
            <Trash2 className="w-3 h-3" />
            {confirmDelete ? "Confirmar?" : "Excluir"}
          </button>
        </div>
      </div>

      {persistError && (
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-2 bg-red-500/10 border-b border-red-500/20 text-[11px] text-red-400">
          <span>Falha ao salvar: {persistError}</span>
          <button onClick={() => setPersistError(null)} className="shrink-0 text-red-400/60 hover:text-red-300 cursor-pointer font-medium">Fechar</button>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="shrink-0 flex items-center gap-1 px-5 border-b border-white/[0.05]">
        {HUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => goTab(t.id)}
            className={cn(
              "relative px-3.5 py-2.5 text-[12px] font-medium transition-colors cursor-pointer",
              tab === t.id ? "text-white" : "text-white/40 hover:text-white/70"
            )}
          >
            {t.label}
            {tab === t.id && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-purple-400" />}
          </button>
        ))}
      </div>

      {tab === "narrativa" && (
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <section className="grid grid-cols-3 gap-3">
            {fronts.map((f) => (
              <button
                key={f.id}
                onClick={() => goTab(f.id)}
                className="text-left rounded-xl bg-[#18181b] border border-white/[0.06] hover:border-white/15 px-4 py-3.5 transition-colors cursor-pointer"
              >
                <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">{f.label}</p>
                <p className="text-[20px] font-semibold text-white mt-1 leading-none">{f.value}</p>
                <p className="text-[11px] text-white/30 mt-1">{f.hint}</p>
              </button>
            ))}
          </section>

          <section>
            <div className="mb-3">
              <h2 className="text-[13px] font-semibold text-white">Narrativa do lançamento</h2>
              <p className="text-[11px] text-white/35 mt-0.5">
                Tudo que você definir aqui alimenta as copies e os emails deste lançamento. Salva ao sair do campo.
              </p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {NARRATIVE_FIELDS.map((f) => (
                <NarrativeField
                  key={`${kit.projectId}-${f.key}`}
                  label={f.label}
                  hint={f.hint}
                  placeholder={f.placeholder}
                  rows={f.rows}
                  value={b[f.key]}
                  maxLength={BRIEFING_LIMITS[f.key]}
                  onCommit={(v) => commitNarrative(f.key, v)}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "marca" && (
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <div>
            <h2 className="text-[13px] font-semibold text-white">Brand System</h2>
            <p className="text-[11px] text-white/35 mt-0.5">
              Estas regras valem para toda imagem gerada neste lançamento a partir do zero. Em adaptações de referência, a referência continua mandando no visual.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#18181b] border border-white/[0.06] p-4">
              <p className="text-[12px] font-semibold text-white mb-3">Cores</p>
              <div className="flex gap-4">
                {([["primaryColor", "Primária"], ["secondaryColor", "Secundária"]] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(b[key]) ? b[key] : "#a78bfa"}
                      onChange={(e) => commitBriefing({ [key]: e.target.value })}
                      className="w-10 h-10 rounded-lg bg-transparent border border-white/[0.1] cursor-pointer"
                    />
                    <span>
                      <span className="block text-[11px] text-white/60">{label}</span>
                      <span className="block text-[11px] text-white/30 tabular-nums">{b[key]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-[#18181b] border border-white/[0.06] p-4">
              <p className="text-[12px] font-semibold text-white mb-3">Logo</p>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center overflow-hidden shrink-0">
                  {b.logoUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={b.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                    : <span className="text-[10px] text-white/25">sem logo</span>}
                </div>
                <label className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/70 text-[11px] font-medium transition-colors", logoUploading ? "opacity-60" : "cursor-pointer")}>
                  {logoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {b.logoUrl ? "Trocar logo" : "Enviar logo"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    disabled={logoUploading}
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }}
                  />
                </label>
                {b.logoUrl && (
                  <button onClick={() => commitBriefing({ logoUrl: "" })} className="text-[11px] text-white/30 hover:text-red-400 cursor-pointer">Remover</button>
                )}
              </div>
              <p className="text-[11px] text-white/30 mt-3">O logo vai como imagem de entrada e é reproduzido sem ser redesenhado.</p>
            </div>

            <div className="rounded-xl bg-[#18181b] border border-white/[0.06] p-4">
              <p className="text-[12px] font-semibold text-white mb-3">Tipografia e estilo</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-white/30 mb-1">Fonte</span>
                  <select
                    value={b.fontChoice}
                    onChange={(e) => commitBriefing({ fontChoice: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none cursor-pointer"
                  >
                    {FONT_OPTIONS.map((f) => <option key={f.id} value={f.id} className="bg-[#18181b]">{f.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-white/30 mb-1">Estilo</span>
                  <select
                    value={b.stylePreset}
                    onChange={(e) => commitBriefing({ stylePreset: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none cursor-pointer"
                  >
                    {STYLE_OPTIONS.map((s) => <option key={s.id} value={s.id} className="bg-[#18181b]">{s.label}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <NarrativeField
              key={`${kit.projectId}-referenceBrands`}
              label="Marcas de referência"
              hint="Marcas cuja linguagem visual você admira."
              placeholder="Ex: Nike, Apple, Headspace"
              rows={2}
              value={b.referenceBrands ?? ""}
              maxLength={BRIEFING_LIMITS.referenceBrands}
              onCommit={(v) => commitBriefing({ referenceBrands: v })}
            />
          </div>

          <NarrativeField
            key={`${kit.projectId}-brandRules`}
            label="Regras da marca"
            hint="Estilo de foto, clima, o que sempre fazer e o que evitar nas peças."
            placeholder="Ex: fotos com luz natural, sem stock genérico; nunca usar vermelho; sempre muito respiro"
            rows={4}
            value={b.brandRules ?? ""}
            maxLength={BRIEFING_LIMITS.brandRules}
            onCommit={(v) => commitBriefing({ brandRules: v })}
          />
        </div>
      )}

      {tab === "copy" && (
        <div className="flex-1 min-h-0">
          <CopyView launch={{ projectId: kit.projectId, facts: launchFacts }} />
        </div>
      )}

      {tab === "pecas" && (
        <PiecesBoard projectId={kit.projectId} onOpenDesign={() => navigate("criativos")} />
      )}

      {tab === "emails" && (
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <EmailSequencePanel
            brandInfo={kit.brandInfo}
            projectId={kit.projectId}
            sequences={emailSequences}
            onChange={(next) => {
              const updated = { ...kit, emailSequences: next, updatedAt: new Date().toISOString() };
              setActiveLaunchKit(updated);
              saveLaunchKit(updated).catch((e) => setPersistError(e instanceof Error ? e.message : "Erro ao salvar sequência de emails."));
            }}
          />
        </div>
      )}
    </div>
  );
}
