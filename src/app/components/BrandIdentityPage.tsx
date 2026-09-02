"use client";

import { useState, useCallback } from "react";
import { AlertCircle } from "lucide-react";
import { BrandWizard, type BrandDNA } from "./BrandKit/BrandWizard";
import { BrandKitDisplay, type GeneratedLogo } from "./BrandKit/BrandKitDisplay";
import { KvExampleShowcase } from "./BrandKit/KvExampleShowcase";
import { KV_EXAMPLES } from "../lib/kv-examples";
import { useAppContext } from "../(app)/_context";

function getImageConfig(): { apiKey?: string; imageProvider: string; imageModel?: string } {
  try {
    return {
      apiKey: localStorage.getItem("wf_img_key") || undefined,
      imageProvider: localStorage.getItem("wf_img_provider") || "openai",
      imageModel: localStorage.getItem("wf_img_model") || undefined,
    };
  } catch {
    return { imageProvider: "openai" };
  }
}

async function callGenerateLogo(dna: BrandDNA, variant: "dark" | "light"): Promise<GeneratedLogo> {
  const config = getImageConfig();
  const res = await fetch("/api/generate-logo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dna: { ...dna, variant }, ...config }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erro ao gerar identidade visual");
  return { b64: json.b64, mimeType: json.mimeType, variant };
}

export function BrandIdentityPage() {
  const { navigate, setShowLaunchWizard } = useAppContext();
  const [mode, setMode] = useState<"wizard" | "display">("wizard");
  const [dna, setDna] = useState<BrandDNA | null>(null);
  const [logos, setLogos] = useState<GeneratedLogo[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingVariant, setIsGeneratingVariant] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = useCallback(async (brandDNA: BrandDNA) => {
    setIsGenerating(true);
    setError(null);
    setDna(brandDNA);
    try {
      const logo = await callGenerateLogo(brandDNA, brandDNA.variant);
      setLogos([logo]);
      setMode("display");
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleGenerateVariant = useCallback(async (variant: "dark" | "light") => {
    if (!dna || isGeneratingVariant) return;
    setIsGeneratingVariant(true);
    try {
      const logo = await callGenerateLogo(dna, variant);
      setLogos((prev) => [...prev.filter((l) => l.variant !== variant), logo]);
    } catch {
      // variant failure is non-blocking
    } finally {
      setIsGeneratingVariant(false);
    }
  }, [dna, isGeneratingVariant]);

  const handleSave = useCallback(async () => {
    if (!dna || logos.length === 0) return;
    setIsSaving(true);
    try {
      const primary = logos[0];
      const link = document.createElement("a");
      link.href = `data:${primary.mimeType};base64,${primary.b64}`;
      link.download = `${dna.name.toLowerCase().replace(/\s+/g, "-")}-logo.png`;
      link.click();
    } finally {
      setIsSaving(false);
    }
  }, [dna, logos]);

  const handleReset = useCallback(() => {
    setMode("wizard");
    setLogos([]);
    setDna(null);
    setError(null);
  }, []);

  const handleApply = useCallback(() => {
    navigate("lancamentos");
    setShowLaunchWizard(true);
  }, [navigate, setShowLaunchWizard]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col items-center px-6 py-10 min-h-full">
        <div className="w-full max-w-[760px] mb-8">
          <p className="text-[9px] uppercase tracking-widest text-white/20 font-semibold mb-1">
            Sistema de Identidade Visual
          </p>
          <h1 className="text-[1.6rem] font-semibold text-white tracking-tight">
            {mode === "wizard" ? "Construir Identidade de Marca" : (dna?.name ?? "Identidade Visual")}
          </h1>
          {mode === "wizard" && (
            <p className="text-[13px] text-white/30 mt-1 leading-relaxed">
              Responda o briefing estrategico. A IA constroi sua identidade com nivel de agencia.
            </p>
          )}
        </div>

        {error && (
          <div className="w-full max-w-[580px] mb-5 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-medium text-red-300">{error}</p>
              {error.includes("configurada") && (
                <p className="text-[11px] text-white/30 mt-0.5">
                  Configure sua chave em Configuracoes &gt; IA de Imagem na Home.
                </p>
              )}
            </div>
          </div>
        )}

        {mode === "wizard" ? (
          <>
            <KvExampleShowcase example={KV_EXAMPLES[0]} />
            <BrandWizard onComplete={handleComplete} isGenerating={isGenerating} />
          </>
        ) : (
          dna && (
            <BrandKitDisplay
              dna={dna}
              logos={logos}
              isGeneratingVariant={isGeneratingVariant}
              onGenerateVariant={handleGenerateVariant}
              onReset={handleReset}
              onSave={handleSave}
              isSaving={isSaving}
              onApply={handleApply}
            />
          )
        )}
      </div>
    </div>
  );
}
