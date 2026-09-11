import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { assertSafeMonitorUrl, checkPageWithRetry, checkSsl, recordUptimeCheck } from "@/lib/page-monitor/server";

export const maxDuration = 60;

/** Cron diário (ver vercel.json, plano Hobby → 1x/dia) — só uptime + SSL,
 * de propósito sem PageSpeed: um audit de Lighthouse sozinho pode levar
 * até 45s, e rodando pra várias páginas de uma vez estouraria o limite de
 * execução do Hobby. PageSpeed continua só sob demanda (botão "Verificar
 * agora", que passa por esse mesmo recordUptimeCheck + grava pagespeed
 * separadamente — ver /api/page-monitors/[id]/check).
 *
 * Protegida por CRON_SECRET: o Vercel Cron manda esse header sozinho
 * quando a env var está configurada (ver docs do Vercel); sem a env var
 * configurada aqui, a rota recusa qualquer chamada (fail-closed) — nunca
 * roda "aberta". */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: monitors, error } = await supabase.from("page_monitors").select("id, user_id, url");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let skipped = 0;
  const results = await Promise.allSettled(
    (monitors ?? []).map(async (m) => {
      try {
        assertSafeMonitorUrl(m.url);
      } catch {
        skipped += 1;
        return;
      }
      const [page, ssl] = await Promise.all([
        checkPageWithRetry(m.url),
        checkSsl(m.url).catch(() => ({ status: "error" as const, expiresAt: null, daysRemaining: null, issuer: null })),
      ]);
      return recordUptimeCheck(supabase, m.id, m.user_id, page, ssl);
    })
  );

  // Retenção de 7 dias no histórico — mesma janela usada no repo de referência.
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  await supabase.from("page_monitor_history").delete().lt("checked_at", cutoff);

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ total: monitors?.length ?? 0, succeeded, failed, skipped });
}
