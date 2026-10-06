import { isMetaTokenKeyConfigured } from "@/lib/meta-ads/crypto";

/** Integração YouTube (só leitura). OAuth do Google com refresh token: o access
 * token dura ~1h, então toda leitura troca o refresh token por um novo. */

export const YT_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
].join(" ");
export const YT_STATE_COOKIE = "wf_yt_oauth_state";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const YT_DATA_BASE = "https://www.googleapis.com/youtube/v3";
export const YT_ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2";

export class YouTubeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getGoogleCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new YouTubeApiError("Integração com o YouTube não configurada: faltam GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET.", 503);
  }
  return { clientId, clientSecret };
}

/** A chave de criptografia é a mesma dos tokens da Meta (AES-256-GCM). */
export function isYouTubeConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()) && isMetaTokenKeyConfigured();
}

export function youtubeErrorResponse(err: unknown): { body: { error: string }; status: number } {
  if (err instanceof YouTubeApiError) return { body: { error: err.message }, status: err.status };
  return { body: { error: err instanceof Error ? err.message : "Erro desconhecido" }, status: 500 };
}

interface GoogleErrorBody { error?: string | { message?: string; errors?: { reason?: string }[]; code?: number }; error_description?: string }

/** Troca o refresh token por um access token novo. Refresh revogado ou expirado
 * (invalid_grant) vira um pedido pra reconectar. */
export async function getAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = getGoogleCredentials();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string } & GoogleErrorBody;
  if (!res.ok || !json.access_token) {
    if (json.error === "invalid_grant") throw new YouTubeApiError("A conexão com o YouTube expirou ou foi revogada: reconecte o canal.", 401);
    throw new YouTubeApiError("Não foi possível autenticar no YouTube agora.", 502);
  }
  return json.access_token;
}

/** GET autenticado na API do YouTube/Analytics. Erros viram mensagens em português. */
export async function ytGet<T>(base: string, path: string, params: Record<string, string>, accessToken: string): Promise<T> {
  const url = new URL(`${base}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30_000) });
  const json = (await res.json().catch(() => ({}))) as T & GoogleErrorBody;
  if (res.ok) return json;
  const reason = typeof json.error === "object" ? json.error?.errors?.[0]?.reason : undefined;
  if (res.status === 401) throw new YouTubeApiError("A conexão com o YouTube expirou: reconecte o canal.", 401);
  if (reason === "quotaExceeded" || reason === "rateLimitExceeded") throw new YouTubeApiError("A cota diária da API do YouTube acabou. Tente de novo amanhã.", 429);
  // 400/403 de métrica não suportada é tratado por quem chama (ex.: CTR da thumb).
  throw new YouTubeApiError(typeof json.error === "object" ? json.error?.message ?? "Erro na API do YouTube." : "Erro na API do YouTube.", res.status);
}
