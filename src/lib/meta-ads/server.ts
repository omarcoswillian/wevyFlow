import { createClient } from "@/lib/supabase/server";
import { isMetaTokenKeyConfigured } from "@/lib/meta-ads/crypto";

/** Bumped roughly twice a year by Meta — v26.0 is current as of 2026-07-29.
 * Old versions keep working for ~2 years after release, so this doesn't
 * need to be bumped on every call, just kept reasonably fresh. */
export const META_GRAPH_VERSION = "v26.0";
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
export const META_OAUTH_DIALOG_URL = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;

/** ads_read is the only scope this integration needs — read-only access to
 * ad performance data, never ads_management (which would let WevyFlow
 * create/edit/pause the client's actual ads). */
export const META_OAUTH_SCOPE = "ads_read";

export const META_STATE_COOKIE = "wf_meta_oauth_state";

export function isMetaAdsConfigured(): boolean {
  return !!process.env.META_APP_ID && !!process.env.META_APP_SECRET && isMetaTokenKeyConfigured();
}

export function getMetaAppCredentials(): { appId: string; appSecret: string } {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new MetaAdsApiError("Integração com Meta Ads não configurada — faltam META_APP_ID/META_APP_SECRET.", 503);
  }
  return { appId, appSecret };
}

/** Absolute app origin for building the OAuth redirect_uri — prefers the
 * configured production URL, falls back to the current request's own host
 * (works in any environment, including local dev and preview deploys).
 * Same fallback pattern used by export-webflow/publish routes. */
export function resolveAppOrigin(requestUrl: string): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  return new URL(requestUrl).origin;
}

export class MetaAdsApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new MetaAdsApiError("Faça login para continuar.", 401);
  return { supabase, user };
}

export function metaAdsErrorResponse(err: unknown): { body: { error: string }; status: number } {
  if (err instanceof MetaAdsApiError) return { body: { error: err.message }, status: err.status };
  return { body: { error: err instanceof Error ? err.message : "Erro desconhecido" }, status: 500 };
}
