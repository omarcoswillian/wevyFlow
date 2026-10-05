"use client";

import { useState } from "react";

export interface MetaProfile {
  name: string | null;
  picture: string | null;
  adAccountName: string | null;
}

/** Perfil do Facebook conectado, no canto direito do cabeçalho: foto, nome e
 * um ponto verde de "conectado". Sem foto (ou se a URL da CDN expirar), cai
 * pra inicial do nome. */
export function MetaProfileBadge({ profile }: { profile: MetaProfile }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (profile.name ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div
      className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20"
      title={profile.adAccountName ? `Conta de anúncios: ${profile.adAccountName}` : "Facebook conectado"}
    >
      <div className="relative shrink-0">
        {profile.picture && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.picture}
            alt={profile.name ?? "Perfil do Facebook"}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#1877F2]/30 text-[#7aa7ff] text-[12px] font-semibold flex items-center justify-center">{initial}</div>
        )}
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0e0e10]" />
      </div>
      <div className="leading-tight">
        <p className="text-[11px] font-medium text-white/85 max-w-[140px] truncate">{profile.name ?? "Facebook"}</p>
        <p className="text-[10px] text-emerald-300/90">Conectado ao Meta Ads</p>
      </div>
    </div>
  );
}
