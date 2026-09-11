/** Busca de perfis de Instagram por nicho via Apify — protótipo.
 *
 * `vulnv/instagram-keyword-profile-scraper` (primeira escolha) testado em
 * 2026-09-10 e descartado: roda com sucesso mas devolve 0 perfis pra
 * qualquer termo (inclusive "dentist" em inglês) — actor quebrado/stub.
 * Trocado por `apify/instagram-search-scraper` (oficial Apify, maior
 * volume de uso), que devolve perfis reais e inclui `businessCategoryName`
 * (categoria que o próprio perfil comercial declara no Instagram) — o
 * sinal mais confiável disponível pra bater com um nicho sem depender de
 * hashtag logada. */
const APIFY_ACTOR = "apify~instagram-search-scraper";
const APIFY_BASE_URL = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`;

export class ApifyProspectingError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function isApifyConfigured(): boolean {
  return !!process.env.APIFY_API_TOKEN;
}

function requireApifyToken(): string {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new ApifyProspectingError(
      "Busca de perfis não configurada — falta APIFY_API_TOKEN.",
      503
    );
  }
  return token;
}

export interface InstagramProspect {
  username: string;
  profileUrl: string;
  profilePicUrl: string | null;
  fullName: string | null;
  biography: string | null;
  followers: number | null;
  following: number | null;
  postsCount: number | null;
  externalUrl: string | null;
  isBusinessAccount: boolean;
  businessCategory: string | null;
  /** true se a bio/nome menciona a cidade/região buscada — o actor não tem
   * filtro geográfico nativo, então isso é o único sinal de proximidade
   * disponível. null quando nenhuma cidade foi informada na busca. */
  matchesLocation: boolean | null;
}

/** Remove acentos e normaliza pra comparação de texto insensível a caixa. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

interface ApifyRawItem {
  username?: string;
  url?: string;
  profilePicUrl?: string;
  fullName?: string;
  biography?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  externalUrl?: string;
  isBusinessAccount?: boolean;
  businessCategoryName?: string;
}

export async function searchInstagramProfiles(
  keyword: string,
  city: string | null,
  maxResults: number
): Promise<InstagramProspect[]> {
  const token = requireApifyToken();
  const url = `${APIFY_BASE_URL}?token=${encodeURIComponent(token)}`;

  /** O actor não tem filtro geográfico — a única alavanca é embutir a
   * cidade/região no próprio termo de busca, o que ajuda a busca do
   * Instagram/Facebook Ads priorizar contas com esse local na bio/nome. */
  const search = city ? `${keyword} ${city}` : keyword;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      search,
      searchType: "user",
      searchLimit: maxResults,
    }),
    signal: AbortSignal.timeout(280_000),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (json && typeof json === "object" && "error" in json
        ? String((json as { error?: { message?: string } }).error?.message)
        : null) || `Apify respondeu ${res.status}`;
    throw new ApifyProspectingError(message, res.status === 401 ? 401 : 502);
  }

  const items: ApifyRawItem[] = Array.isArray(json) ? json : [];

  /** Alguns itens do actor vêm com "None" (string literal, herdada do lado
   * Python) em vez de omitir o campo — trata como ausente. */
  const cleanCategory = (v?: string) => (v && v !== "None" ? v : null);

  const normalizedCity = city ? normalize(city) : null;

  const profiles = items
    .filter((item) => !!item.username)
    .map((item) => {
      const haystack = normalize(`${item.fullName ?? ""} ${item.biography ?? ""}`);
      return {
        username: item.username!,
        profileUrl: item.url ?? `https://www.instagram.com/${item.username}`,
        profilePicUrl: item.profilePicUrl ?? null,
        fullName: item.fullName ?? null,
        biography: item.biography ?? null,
        followers: typeof item.followersCount === "number" ? item.followersCount : null,
        following: typeof item.followsCount === "number" ? item.followsCount : null,
        postsCount: typeof item.postsCount === "number" ? item.postsCount : null,
        externalUrl: item.externalUrl ?? null,
        isBusinessAccount: !!item.isBusinessAccount,
        businessCategory: cleanCategory(item.businessCategoryName),
        matchesLocation: normalizedCity ? haystack.includes(normalizedCity) : null,
      };
    });

  // com cidade informada, perfis que citam o local vêm primeiro
  if (normalizedCity) {
    profiles.sort((a, b) => Number(b.matchesLocation) - Number(a.matchesLocation));
  }

  return profiles;
}
