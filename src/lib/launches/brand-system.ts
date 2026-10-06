import { requireLaunch, resolveLaunchStyle, LaunchApiError, type RequiredLaunch } from "./server";

/** Brand System do lançamento, no formato que as gerações de imagem usam:
 * um bloco de regras obrigatórias pro prompt e, quando há logo, a imagem do
 * logo pra ir como referência de entrada (nunca redesenhada pelo modelo). */
export interface BrandSystem {
  block: string;
  logo: { mimeType: string; data: string } | null;
}

const FONT_LABELS: Record<string, string> = {
  sora: "Sora", inter: "Inter", poppins: "Poppins", montserrat: "Montserrat",
  playfair: "Playfair Display", "space-grotesk": "Space Grotesk",
};

const STYLE_LABELS: Record<string, string> = {
  "dark-premium": "escuro premium, alto contraste",
  "light-clean": "claro e limpo, muito respiro",
  glassmorphism: "vidro fosco translúcido",
  "neon-tech": "neon tecnológico",
  luxury: "luxo sofisticado",
  brutalist: "brutalista, tipografia pesada",
};

/** Quando a peça terá o texto aplicado depois em camada separada (headline e
 * CTA exatos), o modelo não deve desenhar texto nenhum e precisa deixar áreas
 * livres pra ele. */
export const TEXT_LAYER_RULE = [
  "O texto final desta peça será aplicado depois, em camada separada. NÃO renderize nenhuma palavra, letra, número, logotipo falso ou marca d'água na imagem.",
  "Componha deixando o terço superior com área limpa e de bom contraste (pra headline) e uma faixa livre no terço inferior (pra botão de CTA). O sujeito principal fica no centro.",
].join("\n");

const MAX_LOGO_BYTES = 2_000_000;

async function loadLogo(url: string): Promise<BrandSystem["logo"]> {
  try {
    if (url.startsWith("data:image/")) {
      const [meta, data] = url.split(",");
      const mimeType = /^data:(.*?);base64$/.exec(meta)?.[1];
      if (!mimeType || !data || data.length * 0.75 > MAX_LOGO_BYTES) return null;
      return { mimeType, data };
    }
    // Só o storage do próprio projeto: evita transformar o campo de logo em
    // um fetch de URL arbitrária feito pelo servidor.
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : null;
    const parsed = new URL(url);
    if (!supabaseHost || parsed.host !== supabaseHost || !parsed.pathname.includes("/storage/v1/object/public/")) return null;
    const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!mimeType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_LOGO_BYTES) return null;
    return { mimeType, data: buf.toString("base64") };
  } catch {
    return null;
  }
}

export function buildBrandBlock(launch: RequiredLaunch, hasLogo: boolean): string {
  const style = resolveLaunchStyle(launch);
  const b = launch.briefing;
  return [
    "BRAND SYSTEM DO LANÇAMENTO (regras obrigatórias, não são sugestões):",
    `Produto: ${b.productName}`,
    `Cor primária: ${style.primaryColor}. Cor secundária: ${style.secondaryColor}. Use só essas cores como base e neutros que combinem; não introduza outras cores de destaque.`,
    `Tipografia da marca: ${FONT_LABELS[style.fontChoice] ?? style.fontChoice}.`,
    `Estilo visual: ${STYLE_LABELS[style.stylePreset] ?? style.stylePreset}.`,
    b.referenceBrands ? `Marcas de referência de linguagem visual: ${b.referenceBrands}.` : "",
    b.brandRules?.trim() ? `Regras da marca: ${b.brandRules.trim()}` : "",
    style.identityBlock,
    hasLogo ? "O logo oficial vem como imagem de entrada: se o logo aparecer na peça, reproduza exatamente essa imagem, sem redesenhar, distorcer nem trocar as cores." : "Não invente nem desenhe um logo.",
  ].filter(Boolean).join("\n");
}

/** Carrega o Brand System de um lançamento do usuário. Retorna null (sem
 * quebrar a geração) quando não há projectId ou o lançamento não existe/não é
 * dele/ainda não está ativo: a geração segue sem regras de marca. */
export async function loadBrandSystem(projectId: unknown): Promise<BrandSystem | null> {
  if (typeof projectId !== "string" || !projectId) return null;
  try {
    const launch = await requireLaunch(projectId);
    const logo = launch.briefing.logoUrl ? await loadLogo(launch.briefing.logoUrl) : null;
    return { block: buildBrandBlock(launch, Boolean(logo)), logo };
  } catch (err) {
    if (err instanceof LaunchApiError) return null;
    throw err;
  }
}
