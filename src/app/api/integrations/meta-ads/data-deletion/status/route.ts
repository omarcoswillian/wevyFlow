import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/** Página de status que a Meta mostra ao usuário (campo `url` da resposta do
 * callback de exclusão). Pública, só leitura, indexada pelo código aleatório
 * de 128 bits — não expõe nenhum dado pessoal. */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(title: string, message: string, status = 200) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>body{font-family:Montserrat,system-ui,sans-serif;max-width:520px;margin:12vh auto;padding:0 24px;color:#111}h1{font-size:22px}p{line-height:1.6;color:#444}</style></head><body><h1>${esc(title)}</h1><p>${message}</p></body></html>`;
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex, noarchive",
    },
  });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!/^[a-f0-9]{32}$/.test(code)) return page("Código inválido", "O código de confirmação informado não é válido.", 400);

  const { data, error } = await createServiceClient()
    .from("meta_data_deletion_requests")
    .select("status, created_at")
    .eq("confirmation_code", code)
    .maybeSingle();

  if (error) return page("Indisponível", "Não foi possível consultar o pedido agora. Tente novamente em instantes.", 503);
  if (!data) return page("Pedido não encontrado", "Não encontramos um pedido de exclusão com esse código.", 404);

  const when = new Date(data.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  if (data.status === "completed") {
    return page("Dados excluídos", `Os dados da sua conta do Meta Ads armazenados na WevyFlow foram excluídos em ${esc(when)}. Código: ${esc(code)}.`);
  }
  return page("Exclusão pendente", `Houve uma falha ao concluir a exclusão. Escreva para o suporte informando o código ${esc(code)}.`);
}
