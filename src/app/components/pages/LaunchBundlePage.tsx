"use client";

import { useRouter } from "next/navigation";
import { Download, ArrowRight, Layout, Image as ImageIcon } from "lucide-react";

interface LaunchBundlePageProps {
  onSelectTemplate: (prompt: string) => void;
}

const PAGES = [
  {
    templateId: "ready-luana-carolina-ed-001",
    label: "Página de captura",
    description: "Hero fullscreen com formulário — Nome, WhatsApp, E-mail",
    thumbnail: "/template-previews/luana-carolina-ed-001.png",
  },
  {
    templateId: "ready-luana-carolina-ed-001-obrigado",
    label: "Página de obrigado",
    description: "Confirmação com barra de progresso — fecha o funil de captura",
    thumbnail: "/template-previews/luana-carolina-ed-001-obrigado.png",
  },
];

// Same set the creative library shows under "Luana Carolina" in Criativos →
// Biblioteca (public/library-seed/manifest.json) — listed here directly so
// this page loads instantly with zero extra requests.
const CREATIVES = [
  { path: "/library-seed/luana/6202-ED-IMG.png", name: "6202" },
  { path: "/library-seed/luana/6210-ED-IMG.png", name: "6210" },
  { path: "/library-seed/luana/6216-ED-IMG.png", name: "6216" },
  { path: "/library-seed/luana/6217-ED-IMG.png", name: "6217" },
  { path: "/library-seed/luana/AD02.png", name: "AD 02" },
  { path: "/library-seed/luana/AD05.png", name: "AD 05" },
  { path: "/library-seed/luana/AD07.png", name: "AD 07" },
  { path: "/library-seed/luana/faltam7dias-1.png", name: "Faltam 7 Dias v1" },
  { path: "/library-seed/luana/faltam7dias.png", name: "Faltam 7 Dias" },
  { path: "/library-seed/luana/hoje.png", name: "Hoje" },
];

export function LaunchBundlePage({ onSelectTemplate }: LaunchBundlePageProps) {
  const router = useRouter();

  return (
    <div className="flex-1 flex flex-col overflow-y-auto h-full">
      {/* Header */}
      <div className="px-8 pt-8 pb-6">
        <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest mb-2">Lançamento pronto</p>
        <h1 className="text-2xl font-semibold text-white mb-2 tracking-tight">Luana Carolina · Execução Digital</h1>
        <p className="text-[13px] text-white/40 max-w-2xl leading-relaxed">
          Página de captura, página de obrigado e os criativos usados nesse lançamento real. Replique a estrutura —
          troque produto, marca e copy pelos seus — sem começar do zero.
        </p>
      </div>

      {/* Páginas */}
      <div className="px-8 pb-8">
        <div className="flex items-center gap-2 mb-3">
          <Layout className="w-3.5 h-3.5 text-white/30" />
          <h2 className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Páginas</h2>
        </div>
        <div className="grid grid-cols-2 gap-5 max-w-2xl">
          {PAGES.map((page) => (
            <div key={page.templateId} className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="relative h-[280px] overflow-hidden border-b border-white/[0.04] bg-white/[0.02]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={page.thumbnail} alt={page.label} className="w-full h-full object-cover object-top" />
              </div>
              <div className="p-3.5">
                <p className="text-[12px] font-semibold text-white/80">{page.label}</p>
                <p className="text-[11px] text-white/35 mt-0.5 mb-3">{page.description}</p>
                <button
                  onClick={() => onSelectTemplate(`READY:${page.templateId}`)}
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-purple-600/[0.12] border border-purple-500/20 text-purple-300 text-[11px] font-semibold cursor-pointer hover:bg-purple-600/20 hover:border-purple-500/35 transition-all"
                >
                  Replicar esta página <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Criativos */}
      <div className="px-8 pb-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-3.5 h-3.5 text-white/30" />
            <h2 className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Criativos usados</h2>
          </div>
          <button
            onClick={() => router.push("/criativos?tab=biblioteca")}
            className="flex items-center gap-1.5 text-[11px] font-medium text-purple-300/80 hover:text-purple-300 cursor-pointer"
          >
            Usar como referência nos Criativos <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {CREATIVES.map((c) => (
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
      </div>
    </div>
  );
}
