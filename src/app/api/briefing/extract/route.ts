import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { extractBriefing } from "@/app/lib/briefing-extract";

export const maxDuration = 45;

// Extração do briefing não consome crédito (é a porta de entrada do produto e o
// plano Free tem poucos), mas tem teto por hora pra não virar uso livre da chave do servidor.
const MAX_PER_HOUR = 12;
const MAX_TEXT = 6000;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { text?: unknown; document?: unknown };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const document = typeof body.document === "string" ? body.document : "";
  if (!text && !document.trim()) return NextResponse.json({ error: "Escreva algo sobre o seu lançamento." }, { status: 400 });
  if (text.length > MAX_TEXT) return NextResponse.json({ error: `O texto passou de ${MAX_TEXT} caracteres. Resuma um pouco.` }, { status: 400 });

  const service = createServiceClient();
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await service.from("generation_history").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("gen_type", "briefing_extract").gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_HOUR) {
    return NextResponse.json({ error: "Muitas tentativas seguidas. Aguarde um pouco e tente de novo." }, { status: 429 });
  }
  // Registro de custo zero: serve só pra contar as tentativas da última hora.
  await service.from("generation_history").insert({
    user_id: user.id, prompt: text.slice(0, 200), platform: "html", gen_type: "briefing_extract", code: "", status: "success", cost: 0,
  });

  try {
    const briefing = await extractBriefing({ text: text || "(sem texto; use o documento)", document });
    return NextResponse.json({ briefing });
  } catch (e) {
    console.error("[briefing/extract]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível ler o briefing agora." }, { status: 502 });
  }
}
