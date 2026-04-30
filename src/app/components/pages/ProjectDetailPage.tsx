"use client";

import { Project, ProjectPage, timeAgo } from "../../lib/projects";
import {
  ChevronLeft,
  Plus,
  FileText,
  Trash2,
  MoreHorizontal,
  Globe,
  Search,
  Download,
  Check,
  Type,
  Settings,
  Info,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";

interface ProjectDetailPageProps {
  project: Project;
  onBack: () => void;
  onOpenPage: (page: ProjectPage) => void;
  onCreatePage: () => void;
  onDeletePage: (pageId: string) => void;
}

type ActiveTab = "pages" | "settings" | "seo" | "publish";

interface ProjectSettings {
  domain: string;
  description: string;
  favicon: string;
}

interface ProjectSEO {
  title: string;
  description: string;
  ogImage: string;
  noIndex: boolean;
}

const inputClass =
  "w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/30";
const textareaClass = `${inputClass} resize-none`;

function SavedIndicator({ visible }: { visible: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] text-green-400 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <Check className="w-3 h-3" /> Salvo
    </span>
  );
}

export function ProjectDetailPage({
  project,
  onBack,
  onOpenPage,
  onCreatePage,
  onDeletePage,
}: ProjectDetailPageProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("pages");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const settingsKey = `wf-proj-${project.id}`;
  const seoKey = `wf-proj-seo-${project.id}`;

  const [settings, setSettings] = useState<ProjectSettings>({
    domain: "",
    description: "",
    favicon: "",
  });
  const [seo, setSeo] = useState<ProjectSEO>({
    title: "",
    description: "",
    ogImage: "",
    noIndex: false,
  });

  const [savedSettings, setSavedSettings] = useState<Partial<Record<keyof ProjectSettings, boolean>>>({});
  const [savedSeo, setSavedSeo] = useState<Partial<Record<keyof ProjectSEO, boolean>>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(settingsKey);
      if (raw) setSettings(JSON.parse(raw));
    } catch {}
    try {
      const raw = localStorage.getItem(seoKey);
      if (raw) setSeo(JSON.parse(raw));
    } catch {}
  }, [settingsKey, seoKey]);

  function saveSettings(next: ProjectSettings) {
    localStorage.setItem(settingsKey, JSON.stringify(next));
  }

  function saveSeo(next: ProjectSEO) {
    localStorage.setItem(seoKey, JSON.stringify(next));
  }

  function flashSettings(field: keyof ProjectSettings) {
    setSavedSettings((prev) => ({ ...prev, [field]: true }));
    setTimeout(() => setSavedSettings((prev) => ({ ...prev, [field]: false })), 2000);
  }

  function flashSeo(field: keyof ProjectSEO) {
    setSavedSeo((prev) => ({ ...prev, [field]: true }));
    setTimeout(() => setSavedSeo((prev) => ({ ...prev, [field]: false })), 2000);
  }

  function handleSettingsBlur(field: keyof ProjectSettings) {
    saveSettings(settings);
    flashSettings(field);
  }

  function handleSeoBlur(field: keyof ProjectSEO) {
    saveSeo(seo);
    flashSeo(field);
  }

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: "pages", label: "Paginas" },
    { id: "settings", label: "Configuracoes" },
    { id: "seo", label: "SEO" },
    { id: "publish", label: "Publicar" },
  ];

  function handleExportHTML() {
    const code = project.pages[0]?.code || "";
    const blob = new Blob([code], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="p-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {project.coverImage && (
          <img
            src={project.coverImage}
            alt={project.name}
            className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
          />
        )}

        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-white truncate">{project.name}</h1>
          <p className="text-xs text-white/30">
            {project.client} &middot; {project.pages.length} pagina
            {project.pages.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="flex gap-0 border-b border-white/[0.06] mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-[12px] font-medium border-b-2 transition-all cursor-pointer -mb-px ${
              activeTab === tab.id
                ? "border-purple-500 text-white"
                : "border-transparent text-white/35 hover:text-white/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Paginas */}
      {activeTab === "pages" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={onCreatePage}
            className="h-44 rounded-2xl border-2 border-dashed border-white/[0.08] flex flex-col items-center justify-center text-white/20 hover:border-purple-500/30 hover:text-purple-400 transition-all cursor-pointer group"
          >
            <Plus className="w-7 h-7 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">Nova pagina</span>
          </button>

          {project.pages.map((page) => (
            <div key={page.id} className="relative group">
              <button
                onClick={() => onOpenPage(page)}
                className="w-full text-left rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all cursor-pointer"
              >
                <div className="h-32 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-2 overflow-hidden">
                  {page.code ? (
                    <div
                      className="w-full h-full bg-white rounded-lg overflow-hidden opacity-80"
                      dangerouslySetInnerHTML={{
                        __html: `<div style="transform:scale(0.25);transform-origin:top left;width:400%;pointer-events:none">${page.code.slice(0, 500)}</div>`,
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText className="w-6 h-6 text-white/10" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium text-white/80 truncate">{page.name}</h3>
                  <p className="text-[10px] text-white/25 mt-0.5">
                    {page.platform.toUpperCase()} &middot; {timeAgo(page.updatedAt)}
                  </p>
                </div>
              </button>

              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(menuOpen === page.id ? null : page.id);
                  }}
                  className="p-1.5 rounded-lg bg-black/40 text-white/50 hover:text-white backdrop-blur-sm cursor-pointer"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
                {menuOpen === page.id && (
                  <div className="absolute top-full right-0 mt-1 w-32 bg-[#1a1a1e] border border-white/[0.08] rounded-xl shadow-2xl z-50 py-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePage(page.id);
                        setMenuOpen(null);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Configuracoes */}
      {activeTab === "settings" && (
        <div className="max-w-[560px] space-y-8">
          <section>
            <p className="text-[10px] uppercase tracking-widest text-white/35 font-medium mb-4">
              Informacoes do projeto
            </p>
            <div className="space-y-4">
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  <Type className="w-3 h-3" /> Nome do projeto
                </Label>
                <div className={`${inputClass} text-white/40 cursor-default`}>{project.name}</div>
              </div>
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  <Type className="w-3 h-3" /> Cliente
                </Label>
                <div className={`${inputClass} text-white/40 cursor-default`}>{project.client}</div>
              </div>
            </div>
          </section>

          <div className="border-t border-white/[0.06]" />

          <section>
            <p className="text-[10px] uppercase tracking-widest text-white/35 font-medium mb-4">
              Detalhes
            </p>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="flex items-center gap-1.5 mb-0">
                    <Settings className="w-3 h-3" /> Descricao
                  </Label>
                  <SavedIndicator visible={!!savedSettings.description} />
                </div>
                <textarea
                  rows={3}
                  className={textareaClass}
                  placeholder="Descreva o projeto..."
                  value={settings.description}
                  onChange={(e) => setSettings((s) => ({ ...s, description: e.target.value }))}
                  onBlur={() => handleSettingsBlur("description")}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="flex items-center gap-1.5 mb-0">
                    <Globe className="w-3 h-3" /> Dominio personalizado
                  </Label>
                  <SavedIndicator visible={!!savedSettings.domain} />
                </div>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="meusite.com"
                  value={settings.domain}
                  onChange={(e) => setSettings((s) => ({ ...s, domain: e.target.value }))}
                  onBlur={() => handleSettingsBlur("domain")}
                />
                <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Info className="w-3 h-3 text-blue-400 flex-shrink-0" />
                  <span className="text-[10px] text-blue-400/80">
                    Em breve — integracao com DNS em desenvolvimento
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="flex items-center gap-1.5 mb-0">
                    <Globe className="w-3 h-3" /> Favicon URL
                  </Label>
                  <SavedIndicator visible={!!savedSettings.favicon} />
                </div>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="https://..."
                  value={settings.favicon}
                  onChange={(e) => setSettings((s) => ({ ...s, favicon: e.target.value }))}
                  onBlur={() => handleSettingsBlur("favicon")}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Tab: SEO */}
      {activeTab === "seo" && (
        <div className="max-w-[560px] space-y-8">
          <section>
            <p className="text-[10px] uppercase tracking-widest text-white/35 font-medium mb-4">
              Metadados
            </p>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="flex items-center gap-1.5 mb-0">
                    <Search className="w-3 h-3" /> Meta Title
                  </Label>
                  <SavedIndicator visible={!!savedSeo.title} />
                </div>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Titulo da pagina (60 caracteres)"
                  value={seo.title}
                  maxLength={60}
                  onChange={(e) => setSeo((s) => ({ ...s, title: e.target.value }))}
                  onBlur={() => handleSeoBlur("title")}
                />
                <p className="text-[10px] text-white/25 mt-1">{seo.title.length}/60</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="flex items-center gap-1.5 mb-0">
                    <Search className="w-3 h-3" /> Meta Description
                  </Label>
                  <SavedIndicator visible={!!savedSeo.description} />
                </div>
                <textarea
                  rows={3}
                  className={textareaClass}
                  placeholder="Descricao para buscadores (160 caracteres)"
                  value={seo.description}
                  maxLength={160}
                  onChange={(e) => setSeo((s) => ({ ...s, description: e.target.value }))}
                  onBlur={() => handleSeoBlur("description")}
                />
                <p className="text-[10px] text-white/25 mt-1">{seo.description.length}/160</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="flex items-center gap-1.5 mb-0">
                    <Globe className="w-3 h-3" /> OG Image URL
                  </Label>
                  <SavedIndicator visible={!!savedSeo.ogImage} />
                </div>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="https://..."
                  value={seo.ogImage}
                  onChange={(e) => setSeo((s) => ({ ...s, ogImage: e.target.value }))}
                  onBlur={() => handleSeoBlur("ogImage")}
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="noindex"
                  type="checkbox"
                  checked={seo.noIndex}
                  onChange={(e) => {
                    const next = { ...seo, noIndex: e.target.checked };
                    setSeo(next);
                    saveSeo(next);
                    flashSeo("noIndex");
                  }}
                  className="w-4 h-4 rounded accent-purple-500 cursor-pointer"
                />
                <label htmlFor="noindex" className="text-[12px] text-white/60 cursor-pointer select-none">
                  Nao indexar esta pagina (noindex)
                </label>
                <SavedIndicator visible={!!savedSeo.noIndex} />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Tab: Publicar */}
      {activeTab === "publish" && (
        <div className="max-w-[560px] space-y-8">
          <section>
            <p className="text-[10px] uppercase tracking-widest text-white/35 font-medium mb-4">
              Plataforma
            </p>
            <div className={`${inputClass} text-white/50 cursor-default`}>
              {project.pages[0]?.platform.toUpperCase() ?? "HTML"}
            </div>
          </section>

          <div className="border-t border-white/[0.06]" />

          <section>
            <p className="text-[10px] uppercase tracking-widest text-white/35 font-medium mb-4">
              Exportar
            </p>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
              <div className="flex items-start gap-3">
                <Download className="w-4 h-4 text-white/30 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[12px] text-white/70 font-medium">Download HTML</p>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    Baixe seu projeto como HTML puro
                  </p>
                </div>
              </div>
              <button
                onClick={handleExportHTML}
                disabled={project.pages.length === 0}
                className="w-full py-2 rounded-xl bg-purple-500/15 border border-purple-500/25 text-[12px] text-purple-300 font-medium hover:bg-purple-500/25 hover:border-purple-500/40 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Exportar HTML
              </button>
            </div>
          </section>

          <div className="border-t border-white/[0.06]" />

          <section>
            <p className="text-[10px] uppercase tracking-widest text-white/35 font-medium mb-4">
              Status
            </p>
            <div className="flex items-center gap-2">
              {project.pages.length > 0 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-[12px] text-green-400 font-medium">
                    Ativo ({project.pages.length} pagina{project.pages.length !== 1 ? "s" : ""})
                  </span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 text-white/25" />
                  <span className="text-[12px] text-white/35">Sem conteudo</span>
                </>
              )}
            </div>
          </section>

          <div className="border-t border-white/[0.06]" />

          <section>
            <p className="text-[10px] uppercase tracking-widest text-white/35 font-medium mb-4">
              Ultima atualizacao
            </p>
            <div className="flex items-center gap-2 text-[12px] text-white/40">
              <Clock className="w-3.5 h-3.5" />
              {timeAgo(project.updatedAt)}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
