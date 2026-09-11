import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSafeMonitorUrl, checkPageWithRetry, checkSsl, checkPageSpeed, recordUptimeCheck } from "@/lib/page-monitor/server";

/** Faz a checagem sob demanda (status rico + SSL + PageSpeed) de uma URL já
 * cadastrada pelo usuário. Uptime/SSL passam por recordUptimeCheck — o
 * mesmo caminho usado pelo cron diário — então tanto uma checagem manual
 * quanto uma automática alimentam o mesmo histórico e os mesmos
 * incidentes. PageSpeed fica de fora do cron (ver rota do cron) e só é
 * gravado aqui. RLS da tabela já garante que só o dono da linha consegue
 * ler/atualizar. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  }

  const { data: monitor, error: fetchErr } = await supabase
    .from("page_monitors")
    .select("id, url")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr || !monitor) {
    return NextResponse.json({ error: "Página monitorada não encontrada." }, { status: 404 });
  }

  try {
    assertSafeMonitorUrl(monitor.url);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "URL inválida." }, { status: 400 });
  }

  const [page, ssl, pagespeed] = await Promise.all([
    checkPageWithRetry(monitor.url),
    // SSL não deve derrubar a checagem inteira se falhar (rede lenta, TLS
    // exótico) — mesma postura "fire-and-forget não-bloqueante" da referência.
    checkSsl(monitor.url).catch(() => ({ status: "error" as const, expiresAt: null, daysRemaining: null, issuer: null })),
    checkPageSpeed(monitor.url),
  ]);

  await recordUptimeCheck(supabase, id, user.id, page, ssl);

  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from("page_monitors")
    .update({
      pagespeed_checked_at: now,
      pagespeed_performance: pagespeed.performance,
      pagespeed_seo: pagespeed.seo,
      pagespeed_accessibility: pagespeed.accessibility,
      pagespeed_best_practices: pagespeed.bestPractices,
      pagespeed_fcp: pagespeed.fcp,
      pagespeed_lcp: pagespeed.lcp,
      pagespeed_tbt: pagespeed.tbt,
      pagespeed_cls: pagespeed.cls,
      pagespeed_speed_index: pagespeed.speedIndex,
      pagespeed_error: pagespeed.error,
    })
    .eq("id", id)
    .select()
    .single();

  if (updErr || !updated) {
    return NextResponse.json({ error: updErr?.message || "Erro ao salvar resultado da checagem." }, { status: 500 });
  }

  return NextResponse.json({ monitor: updated });
}
