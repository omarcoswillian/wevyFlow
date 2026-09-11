"use client";

import { useState } from "react";
import { Radar, Search, RefreshCw, ExternalLink, AlertCircle, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface InstagramProspect {
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
  matchesLocation: boolean | null;
}

export function InstagramProspectingDashboard() {
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [onlyLocationMatch, setOnlyLocationMatch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<InstagramProspect[]>([]);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const [searchedCity, setSearchedCity] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!keyword.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/instagram-prospecting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim(), city: city.trim() || undefined, maxResults: 30 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível buscar perfis.");
        setProfiles([]);
        return;
      }
      setProfiles(data.profiles ?? []);
      setSearchedFor(keyword.trim());
      setSearchedCity(city.trim() || null);
    } catch {
      setError("Falha de conexão ao buscar perfis.");
    } finally {
      setLoading(false);
    }
  };

  const visibleProfiles = onlyLocationMatch ? profiles.filter((p) => p.matchesLocation) : profiles;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-8">
        {/* header */}
        <div className="mb-6">
          <h1 className="text-[20px] font-bold text-white">Prospecção por Nicho</h1>
          <p className="text-[12px] text-white/40 mt-0.5">
            Protótipo — busca perfis de Instagram por palavra-chave/nicho via Apify
          </p>
        </div>

        {/* search bar */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Ex: dentista, personal trainer, advogado..."
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/30"
            />
          </div>
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Cidade ou região (opcional)"
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/30"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !keyword.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/[0.06] disabled:text-white/25 text-white text-[12px] font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>

        {searchedCity && (
          <label className="flex items-center gap-2 mb-6 text-[11px] text-white/40 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={onlyLocationMatch}
              onChange={(e) => setOnlyLocationMatch(e.target.checked)}
              className="accent-purple-500"
            />
            Mostrar só perfis que citam &quot;{searchedCity}&quot; na bio
          </label>
        )}

        {error && (
          <div className="flex items-start gap-2 mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[12px]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-5 h-5 text-white/20 animate-spin" />
          </div>
        )}

        {!loading && profiles.length === 0 && !error && (
          <EmptyProspecting searched={searchedFor} />
        )}

        {!loading && profiles.length > 0 && (
          <>
            <p className="text-[11px] text-white/30 mb-3">
              {visibleProfiles.length} perfis encontrados para &quot;{searchedFor}&quot;
              {searchedCity ? ` perto de "${searchedCity}"` : ""}
              {onlyLocationMatch && visibleProfiles.length !== profiles.length ? ` (de ${profiles.length} no total)` : ""}
            </p>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Perfil</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Categoria</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider hidden md:table-cell">Bio</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider hidden lg:table-cell">Seguidores</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {visibleProfiles.map((p, i) => (
                    <tr key={p.profileUrl || i} className={cn("border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors", i === visibleProfiles.length - 1 && "border-0")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ProspectAvatar url={p.profilePicUrl} label={p.fullName || p.username} />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-[12px] font-medium text-white/80">{p.fullName || "—"}</p>
                              {p.matchesLocation && (
                                <MapPin className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                              )}
                            </div>
                            <span className="text-[11px] text-white/45">@{p.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.businessCategory ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">{p.businessCategory}</span>
                        ) : (
                          <span className="text-[11px] text-white/20">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell max-w-xs">
                        <span className="text-[11px] text-white/40 line-clamp-2">{p.biography || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-white/40 hidden lg:table-cell">
                        {p.followers != null ? p.followers.toLocaleString("pt-BR") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {p.profileUrl && (
                          <a href={p.profileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/25 hover:text-purple-400 transition-colors inline-flex">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** As fotos de perfil vêm de um link assinado e temporário da CDN da Meta
 * (fbcdn.net) — expira ou é bloqueado por hotlink em vários navegadores.
 * Tenta carregar e cai pras iniciais se falhar, em vez de mostrar o ícone
 * de imagem quebrada. */
function ProspectAvatar({ url, label }: { url: string | null; label: string }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div className="w-7 h-7 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 text-[10px] font-bold">
        {(label || "?")[0]?.toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="w-7 h-7 rounded-full object-cover shrink-0 bg-white/[0.04]"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function EmptyProspecting({ searched }: { searched: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
        <Radar className="w-6 h-6 text-white/20" />
      </div>
      <h3 className="text-[14px] font-semibold text-white/60 mb-1">
        {searched ? "Nenhum perfil encontrado" : "Busque um nicho pra começar"}
      </h3>
      <p className="text-[11px] text-white/30 max-w-xs leading-relaxed">
        {searched
          ? `Nenhum resultado para "${searched}". Tente um termo mais genérico.`
          : "Digite uma profissão ou nicho (ex: dentista) e, se quiser, uma cidade ou região pra aproximar os resultados."}
      </p>
    </div>
  );
}
