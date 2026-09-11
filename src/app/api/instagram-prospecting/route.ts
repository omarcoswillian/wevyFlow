import { createClient } from "@/lib/supabase/server";
import {
  searchInstagramProfiles,
  ApifyProspectingError,
  isApifyConfigured,
} from "@/lib/apify/server";

export const maxDuration = 300;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "não autenticado" }, { status: 401 });

  if (!isApifyConfigured()) {
    return Response.json(
      { error: "Busca de perfis não configurada — falta APIFY_API_TOKEN no ambiente." },
      { status: 503 }
    );
  }

  const { keyword, city, maxResults } = await req.json().catch(() => ({}));
  if (!keyword || typeof keyword !== "string" || !keyword.trim()) {
    return Response.json({ error: "Informe um nicho ou palavra-chave." }, { status: 400 });
  }

  const limit = Math.min(Math.max(parseInt(maxResults) || 30, 1), 100);
  const cityTerm = typeof city === "string" && city.trim() ? city.trim() : null;

  try {
    const profiles = await searchInstagramProfiles(keyword.trim(), cityTerm, limit);
    return Response.json({ profiles });
  } catch (err) {
    if (err instanceof ApifyProspectingError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
