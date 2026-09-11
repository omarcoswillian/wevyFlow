"use client";

import { HomeView } from "../../components/HomeView";
import { useAppContext } from "../_context";

/** KV (gerador de identidade visual/logotipo raster) foi tirado dos
 * entregáveis e desativado por completo — pedido do dono: a qualidade da IA
 * gerando logotipo/brand identity não estava boa o suficiente ("parecendo
 * logotipo gerado no freepik") e o retrabalho pra manter não valia a pena.
 * A rota continua existindo só pra não quebrar links antigos — mostra um
 * aviso em vez do gerador (BrandIdentityPage/KvGerarCanvas). O código do
 * gerador e o schema no Supabase (launch_assets, kv_candidates) permanecem
 * no repositório, só sem nenhum ponto de entrada na UI. */
function MarcaContent() {
  const { handleGenerate, isLoading, navigate, setCommandPaletteOpen } = useAppContext();

  return (
    <HomeView
      onGenerate={handleGenerate}
      isLoading={isLoading}
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="marca"
      contentOverride={
        <div className="flex-1 flex items-center justify-center px-6 py-24 text-center">
          <div className="max-w-sm">
            <h2 className="text-[16px] font-semibold text-white mb-2">Recurso desativado</h2>
            <p className="text-[12px] text-white/40 leading-relaxed mb-6">
              O gerador de KV (identidade visual/logotipo) foi desativado.
            </p>
            <button
              onClick={() => navigate("lancamentos")}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[12px] font-medium cursor-pointer transition-colors"
            >
              Voltar para Lançamentos
            </button>
          </div>
        </div>
      }
    />
  );
}

export default function Page() {
  return <MarcaContent />;
}
