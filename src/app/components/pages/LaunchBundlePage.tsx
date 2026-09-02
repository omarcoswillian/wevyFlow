"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Download, ArrowRight, ArrowLeft, Layout, Image as ImageIcon, Mail, Sparkles, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppContext } from "../../(app)/_context";
import { LUANA_LAUNCHES, getLuanaLaunch, type LuanaLaunch } from "../../lib/luana-launches";

interface LaunchBundlePageProps {
  onSelectTemplate: (prompt: string) => void;
}

export function LaunchBundlePage({ onSelectTemplate }: LaunchBundlePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const launchId = searchParams.get("launch");
  const launch = launchId ? getLuanaLaunch(launchId) : null;

  if (launch) {
    return <LaunchFolder launch={launch} onSelectTemplate={onSelectTemplate} onBack={() => router.push("/lancamento-pronto")} />;
  }
  return <LaunchGallery onOpen={(id) => router.push(`/lancamento-pronto?launch=${id}`)} />;
}

/* ── Gallery: uma pasta por lançamento ──────────────────────── */
function LaunchGallery({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Header — fora do scroll, sempre visível por inteiro */}
      <div className="px-8 pt-8 pb-6 shrink-0">
        <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest mb-2">Lançamento pronto</p>
        <h1 className="text-2xl font-semibold text-white mb-2 tracking-tight">Luana Carolina</h1>
        <p className="text-[13px] text-white/40 max-w-2xl leading-relaxed">
          Cada pasta é um lançamento real: páginas, criativos e emails usados de verdade. Abra uma pasta e replique a
          estrutura — troque produto, marca e copy pelos seus, sem começar do zero.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8 grid grid-cols-2 md:grid-cols-3 gap-4 content-start">
        {LUANA_LAUNCHES.map((l) => (
          <LaunchFolderCard key={l.id} launch={l} onClick={() => onOpen(l.id)} />
        ))}
      </div>
    </div>
  );
}

function LaunchFolderCard({ launch, onClick }: { launch: LuanaLaunch; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden text-left cursor-pointer hover:border-white/[0.12] transition-all"
    >
      {/* Banner */}
      <div
        className="relative h-24 flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${launch.color}33 0%, ${launch.color}0d 100%)` }}
      >
        <span
          className="text-3xl font-bold tracking-tight opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all"
          style={{ color: launch.color }}
        >
          {launch.code}
        </span>
      </div>
      <div className="p-3.5">
        <p className="text-[13px] font-semibold text-white/85">{launch.name}</p>
        <p className="text-[11px] text-white/35 mt-0.5">
          {launch.pages.length} páginas · {launch.creatives.length} criativos
        </p>
      </div>
    </button>
  );
}

/* ── Pasta de um lançamento ─────────────────────────────────── */
function LaunchFolder({ launch, onSelectTemplate, onBack }: { launch: LuanaLaunch; onSelectTemplate: (prompt: string) => void; onBack: () => void }) {
  const router = useRouter();
  const { openLaunchWizardWithPrefill } = useAppContext();

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Banner header — fora do scroll, sempre visível por inteiro */}
      <div
        className="relative px-8 pt-8 pb-8 shrink-0"
        style={{ background: `linear-gradient(135deg, ${launch.color}26 0%, transparent 70%)` }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] font-medium text-white/40 hover:text-white/70 transition-colors cursor-pointer mb-4"
        >
          <ArrowLeft className="w-3 h-3" /> Todos os lançamentos
        </button>
        <div className="flex items-center gap-3">
          <span
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-[13px] font-bold shrink-0"
            style={{ background: `${launch.color}25`, color: launch.color }}
          >
            {launch.code}
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: launch.color }}>Lançamento pronto</p>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Luana Carolina · {launch.name}</h1>
          </div>
        </div>
      </div>

      {/* Corpo — com scroll próprio, header nunca é espremido */}
      <div className="flex-1 overflow-y-auto pt-2">

      {/* Páginas */}
      <div className="px-8 pb-8">
        <div className="flex items-center gap-2 mb-3">
          <Layout className="w-3.5 h-3.5 text-white/30" />
          <h2 className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Páginas</h2>
        </div>
        {launch.pages.length === 0 ? (
          <EmptyRow text="Nenhuma página cadastrada ainda para este lançamento." />
        ) : (
          <div className="grid grid-cols-2 gap-5 max-w-3xl">
            {launch.pages.map((page) => (
              <div key={page.id} className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="relative h-[220px] overflow-hidden border-b border-white/[0.04] bg-white/[0.02]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={page.thumbnail} alt={page.label} className="w-full h-full object-cover object-top" />
                </div>
                <div className="p-3.5">
                  <p className="text-[12px] font-semibold text-white/80">{page.label}</p>
                  <p className="text-[11px] text-white/35 mt-0.5 mb-3 line-clamp-2">{page.description}</p>
                  <button
                    onClick={() => onSelectTemplate(page.prompt)}
                    className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-purple-600/[0.12] border border-purple-500/20 text-purple-300 text-[11px] font-semibold cursor-pointer hover:bg-purple-600/20 hover:border-purple-500/35 transition-all"
                  >
                    Replicar esta página <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Criativos */}
      <div className="px-8 pb-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-3.5 h-3.5 text-white/30" />
            <h2 className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Criativos usados</h2>
          </div>
          {launch.creatives.length > 0 && (
            <button
              onClick={() => router.push("/criativos?tab=biblioteca")}
              className="flex items-center gap-1.5 text-[11px] font-medium text-purple-300/80 hover:text-purple-300 cursor-pointer"
            >
              Usar como referência nos Criativos <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
        {launch.creatives.length === 0 ? (
          <EmptyRow text="Nenhum criativo cadastrado ainda para este lançamento." />
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {launch.creatives.map((c) => (
              <div key={c.path} className="group relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] aspect-[4/5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.path} alt={c.name} className="w-full h-full object-cover" />
                <a
                  href={c.path}
                  download
                  className="absolute inset-0 flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity"
                  title={`Baixar ${c.name}`}
                >
                  <span className="w-7 h-7 rounded-lg bg-white/90 flex items-center justify-center">
                    <Download className="w-3.5 h-3.5 text-black/70" />
                  </span>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emails */}
      <div className="px-8 pb-10">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-3.5 h-3.5 text-white/30" />
          <h2 className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Emails</h2>
        </div>
        <div className="flex items-center justify-between gap-4 max-w-3xl rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-5 py-4">
          <div>
            <p className="text-[12px] font-medium text-white/60">Nenhum email cadastrado ainda para este lançamento</p>
            <p className="text-[11px] text-white/30 mt-0.5">Gere uma sequência com IA a partir do briefing de {launch.name} e edite antes de usar.</p>
          </div>
          <button
            onClick={() =>
              openLaunchWizardWithPrefill({
                productName: `Luana Carolina · ${launch.name}`,
                niche: "Infoprodutos",
              })
            }
            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600/[0.12] border border-purple-500/20 text-purple-300 text-[11px] font-semibold cursor-pointer hover:bg-purple-600/20 hover:border-purple-500/35 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" /> Gerar sequência com IA
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 max-w-3xl rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-5 py-4">
      <Rocket className={cn("w-3.5 h-3.5 text-white/20 shrink-0")} />
      <p className="text-[12px] text-white/30">{text}</p>
    </div>
  );
}
