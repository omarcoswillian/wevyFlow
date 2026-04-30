import React from "react";

export interface FieldDef {
  id: string;
  label: string;
  type: "text" | "color" | "textarea";
  default: string;
  placeholder?: string;
  hint?: string;
}

export interface TemplateDef {
  id: string;
  name: string;
  client: string;
  referencePath: string;
  format: string;
  w: number;
  h: number;
  fields: FieldDef[];
  render: (v: Record<string, string>) => React.ReactElement;
}

/* ─── Shared helpers ──────────────────────────────────────── */
const hex2rgba = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

/* ══════════════════════════════════════════════════════════
   TEMPLATE 1 — Abertura de Turma (1080×1080)
   Estilo: fundo escuro, título grande, card de data
══════════════════════════════════════════════════════════ */
const AberturaTemplate: React.FC<{ v: Record<string, string> }> = ({ v }) => {
  const accent = v.cor || "#6c47ff";
  return (
    <div style={{
      width: 1080, height: 1080, position: "relative", overflow: "hidden",
      background: `linear-gradient(135deg, ${v.fundo || "#1a1208"} 0%, #0a0a0a 100%)`,
      fontFamily: "'Arial', sans-serif",
    }}>
      {/* Noise texture overlay */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 40%, rgba(255,255,255,0.04) 0%, transparent 60%)", pointerEvents: "none" }} />

      {/* Accent glow */}
      <div style={{ position: "absolute", bottom: -80, left: -80, width: 400, height: 400, borderRadius: "50%", background: hex2rgba(accent, 0.15), filter: "blur(100px)", pointerEvents: "none" }} />

      {/* Brand — top left */}
      <div style={{ position: "absolute", top: 64, left: 72 }}>
        <span style={{ fontSize: 28, color: "rgba(255,255,255,0.55)", fontStyle: "italic", fontFamily: "Georgia, serif", letterSpacing: 1 }}>
          {v.marca || "marca"}
        </span>
      </div>

      {/* Event title — center left */}
      <div style={{ position: "absolute", top: 340, left: 72, maxWidth: 560 }}>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.35)", letterSpacing: 4, textTransform: "uppercase", marginBottom: 12, fontWeight: 500 }}>
          {v.subtitulo || "nova turma"}
        </p>
        <p style={{
          fontSize: 136, fontWeight: 900, lineHeight: 0.92, margin: 0,
          color: "#ffffff", fontFamily: "'Arial Black', 'Arial', sans-serif",
          textTransform: "uppercase", letterSpacing: -4,
        }}>
          {(v.titulo || "novo\nlançamento").split("\n").map((line, i) => (
            <span key={i} style={{ display: "block" }}>{line}</span>
          ))}
        </p>
      </div>

      {/* Date card — bottom right */}
      <div style={{
        position: "absolute", bottom: 120, right: 72,
        background: "rgba(255,255,255,0.96)", borderRadius: 20,
        padding: "28px 32px", minWidth: 230,
      }}>
        <p style={{ fontSize: 11, color: "#999", letterSpacing: 3, textTransform: "uppercase", margin: 0, marginBottom: 6 }}>
          {v.dia_semana || "QUARTA"}
        </p>
        <p style={{ fontSize: 40, fontWeight: 900, color: "#111", margin: 0, lineHeight: 1, fontFamily: "'Arial Black', sans-serif" }}>
          {v.data || "29 de abril"}
        </p>
        <div style={{ width: 3, height: 3, borderRadius: "50%", background: "#ddd", margin: "14px 0" }} />
        <p style={{ fontSize: 13, color: "#555", margin: 0, marginBottom: 4, lineHeight: 1.5 }}>
          {v.canal || "Abertura | Live"}
        </p>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: 0 }}>
          {v.horario || "19h03"}
        </p>
      </div>

      {/* Availability — bottom center */}
      <div style={{ position: "absolute", bottom: 52, left: 0, right: 0, textAlign: "center" }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", letterSpacing: 3, textTransform: "uppercase" }}>
          {v.vagas || "VAGAS LIMITADAS"}
        </span>
      </div>

      {/* Accent left bar */}
      <div style={{ position: "absolute", left: 0, top: 280, bottom: 0, width: 4, background: `linear-gradient(to bottom, ${accent}, transparent)`, borderRadius: "0 2px 2px 0" }} />
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   TEMPLATE 2 — Contagem Regressiva Feed (1080×1080)
   Estilo: número grande, cor de marca, countdown
══════════════════════════════════════════════════════════ */
const ContagemFeedTemplate: React.FC<{ v: Record<string, string> }> = ({ v }) => {
  const accent = v.cor || "#ec4899";
  return (
    <div style={{
      width: 1080, height: 1080, position: "relative", overflow: "hidden",
      background: "#0a0a0a",
      fontFamily: "'Arial', sans-serif",
    }}>
      {/* Background gradient */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 40%, ${hex2rgba(accent, 0.18)} 0%, transparent 65%)`, pointerEvents: "none" }} />

      {/* Brand top */}
      <div style={{ position: "absolute", top: 60, left: 0, right: 0, textAlign: "center" }}>
        <span style={{ fontSize: 22, color: "rgba(255,255,255,0.4)", letterSpacing: 5, textTransform: "uppercase", fontWeight: 600 }}>
          {v.marca || "sua marca"}
        </span>
      </div>

      {/* "FALTAM" label */}
      <div style={{ position: "absolute", top: 260, left: 0, right: 0, textAlign: "center" }}>
        <span style={{ fontSize: 24, color: "rgba(255,255,255,0.35)", letterSpacing: 6, textTransform: "uppercase", fontWeight: 600 }}>
          faltam
        </span>
      </div>

      {/* Big number */}
      <div style={{ position: "absolute", top: 300, left: 0, right: 0, textAlign: "center" }}>
        <span style={{
          fontSize: 320, fontWeight: 900, color: accent, lineHeight: 1,
          fontFamily: "'Arial Black', 'Arial', sans-serif",
          textShadow: `0 0 120px ${hex2rgba(accent, 0.4)}`,
        }}>
          {v.numero || "7"}
        </span>
      </div>

      {/* "DIAS" label */}
      <div style={{ position: "absolute", top: 640, left: 0, right: 0, textAlign: "center" }}>
        <span style={{ fontSize: 52, color: "rgba(255,255,255,0.9)", letterSpacing: 12, textTransform: "uppercase", fontWeight: 700 }}>
          dias
        </span>
      </div>

      {/* Divider */}
      <div style={{ position: "absolute", top: 726, left: "50%", transform: "translateX(-50%)", width: 60, height: 2, background: hex2rgba(accent, 0.4) }} />

      {/* Event name */}
      <div style={{ position: "absolute", top: 748, left: 0, right: 0, textAlign: "center" }}>
        <p style={{ fontSize: 26, color: "rgba(255,255,255,0.7)", margin: 0, fontWeight: 600 }}>
          {v.evento || "nome do evento"}
        </p>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.3)", margin: "8px 0 0 0", letterSpacing: 2 }}>
          {v.data || "00 de mês"}
        </p>
      </div>

      {/* CTA bottom */}
      <div style={{ position: "absolute", bottom: 70, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ padding: "16px 40px", borderRadius: 100, background: accent, color: "#fff", fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>
          {v.cta || "Garanta sua vaga"}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   TEMPLATE 3 — Stories Contagem (1080×1920)
   Estilo: full-height, headline imponente, contagem
══════════════════════════════════════════════════════════ */
const ContagemStoriesTemplate: React.FC<{ v: Record<string, string> }> = ({ v }) => {
  const accent = v.cor || "#ec4899";
  return (
    <div style={{
      width: 1080, height: 1920, position: "relative", overflow: "hidden",
      background: "#080808",
      fontFamily: "'Arial', sans-serif",
    }}>
      {/* Background glow */}
      <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)", width: 700, height: 700, borderRadius: "50%", background: hex2rgba(accent, 0.2), filter: "blur(160px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 400, background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)", pointerEvents: "none" }} />

      {/* Brand — top */}
      <div style={{ position: "absolute", top: 100, left: 0, right: 0, textAlign: "center" }}>
        <span style={{ fontSize: 24, color: "rgba(255,255,255,0.4)", letterSpacing: 6, textTransform: "uppercase", fontWeight: 600 }}>
          {v.marca || "sua marca"}
        </span>
      </div>

      {/* "FALTAM" */}
      <div style={{ position: "absolute", top: 440, left: 0, right: 0, textAlign: "center" }}>
        <span style={{ fontSize: 32, color: "rgba(255,255,255,0.35)", letterSpacing: 8, textTransform: "uppercase" }}>
          faltam
        </span>
      </div>

      {/* Big number */}
      <div style={{ position: "absolute", top: 480, left: 0, right: 0, textAlign: "center" }}>
        <span style={{
          fontSize: 520, fontWeight: 900, color: accent, lineHeight: 0.85,
          fontFamily: "'Arial Black', 'Arial', sans-serif",
          textShadow: `0 0 200px ${hex2rgba(accent, 0.5)}`,
        }}>
          {v.numero || "7"}
        </span>
      </div>

      {/* "DIAS" */}
      <div style={{ position: "absolute", top: 1040, left: 0, right: 0, textAlign: "center" }}>
        <span style={{ fontSize: 80, color: "rgba(255,255,255,0.9)", letterSpacing: 20, textTransform: "uppercase", fontWeight: 700 }}>
          dias
        </span>
      </div>

      {/* Divider */}
      <div style={{ position: "absolute", top: 1160, left: "50%", transform: "translateX(-50%)", width: 80, height: 3, background: hex2rgba(accent, 0.5) }} />

      {/* Event info */}
      <div style={{ position: "absolute", top: 1200, left: 80, right: 80, textAlign: "center" }}>
        <p style={{ fontSize: 38, fontWeight: 700, color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.3 }}>
          {v.evento || "nome do evento"}
        </p>
        <p style={{ fontSize: 26, color: "rgba(255,255,255,0.35)", margin: "16px 0 0 0", letterSpacing: 3, textTransform: "uppercase" }}>
          {v.data || "00 de mês"}
        </p>
      </div>

      {/* CTA */}
      <div style={{ position: "absolute", bottom: 120, left: 80, right: 80, display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", padding: "28px 0", borderRadius: 20, background: accent, color: "#fff", fontSize: 26, fontWeight: 700, textAlign: "center", letterSpacing: 1 }}>
          {v.cta || "Garanta sua vaga"}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   TEMPLATE 4 — Anúncio Feed Bold (1080×1080)
   Estilo: headline grande, fundo colorido, CTA
══════════════════════════════════════════════════════════ */
const AnuncioFeedTemplate: React.FC<{ v: Record<string, string> }> = ({ v }) => {
  const accent = v.cor || "#6c47ff";
  return (
    <div style={{
      width: 1080, height: 1080, position: "relative", overflow: "hidden",
      background: "#ffffff",
      fontFamily: "'Arial', sans-serif",
    }}>
      {/* Color block top 60% */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 660, background: accent }} />

      {/* Brand */}
      <div style={{ position: "absolute", top: 64, left: 72 }}>
        <span style={{ fontSize: 20, color: "rgba(255,255,255,0.7)", letterSpacing: 4, textTransform: "uppercase", fontWeight: 600 }}>
          {v.marca || "sua marca"}
        </span>
      </div>

      {/* Main headline */}
      <div style={{ position: "absolute", top: 160, left: 72, right: 72 }}>
        <p style={{
          fontSize: 100, fontWeight: 900, color: "#ffffff", margin: 0, lineHeight: 0.95,
          fontFamily: "'Arial Black', 'Arial', sans-serif",
          textTransform: "uppercase",
        }}>
          {(v.headline || "sua\noferta\naqui").split("\n").map((line, i) => (
            <span key={i} style={{ display: "block" }}>{line}</span>
          ))}
        </p>
      </div>

      {/* Bottom section on white */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 420, background: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 72px" }}>
        <p style={{ fontSize: 26, color: "#333", margin: "0 0 24px 0", lineHeight: 1.5, maxWidth: 680 }}>
          {v.descricao || "Uma descrição curta e impactante que convence o cliente a agir agora mesmo."}
        </p>
        <div style={{ display: "inline-flex" }}>
          <div style={{ padding: "18px 44px", borderRadius: 100, background: accent, color: "#fff", fontSize: 20, fontWeight: 700 }}>
            {v.cta || "Quero participar →"}
          </div>
        </div>
      </div>

      {/* Badge top right */}
      <div style={{ position: "absolute", top: 64, right: 72, background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 100, padding: "8px 20px" }}>
        <span style={{ fontSize: 14, color: "#fff", fontWeight: 700, letterSpacing: 1 }}>
          {v.badge || "NOVO"}
        </span>
      </div>
    </div>
  );
};

/* ─── Template registry ────────────────────────────────── */
export const CREATIVE_TEMPLATES: TemplateDef[] = [
  {
    id: "abertura-turma",
    name: "Abertura de Turma",
    client: "Formagios",
    referencePath: "/library-seed/formagios/AD01V1-FEED.jpg",
    format: "feed-quadrado",
    w: 1080,
    h: 1080,
    fields: [
      { id: "marca",     label: "Marca / Brand",       type: "text",  default: "agathon",      placeholder: "Nome da marca" },
      { id: "subtitulo", label: "Subtítulo",            type: "text",  default: "nova turma",   placeholder: "nova turma, novo lançamento..." },
      { id: "titulo",    label: "Título principal",     type: "textarea", default: "nova\nturma", placeholder: "nova\nturma", hint: "Use quebra de linha para separar as linhas" },
      { id: "dia_semana",label: "Dia da semana",        type: "text",  default: "QUARTA",       placeholder: "QUARTA, SÁBADO..." },
      { id: "data",      label: "Data",                 type: "text",  default: "29 de abril",  placeholder: "29 de abril" },
      { id: "canal",     label: "Canal / Plataforma",   type: "text",  default: "Abertura | Agathon", placeholder: "Abertura | Agathon" },
      { id: "horario",   label: "Horário",              type: "text",  default: "19h03 no YouTube", placeholder: "19h03 no YouTube" },
      { id: "vagas",     label: "Disponibilidade",      type: "text",  default: "APENAS 100 VAGAS", placeholder: "APENAS 100 VAGAS" },
      { id: "cor",       label: "Cor de destaque",      type: "color", default: "#c2783c" },
      { id: "fundo",     label: "Cor do fundo",         type: "color", default: "#1a1208" },
    ],
    render: (v) => <AberturaTemplate v={v} />,
  },
  {
    id: "contagem-feed",
    name: "Contagem Regressiva",
    client: "Luana",
    referencePath: "/library-seed/luana/faltam7dias.png",
    format: "feed-quadrado",
    w: 1080,
    h: 1080,
    fields: [
      { id: "marca",   label: "Marca / Brand",  type: "text",  default: "luana",          placeholder: "Nome da marca" },
      { id: "numero",  label: "Número de dias", type: "text",  default: "7",              placeholder: "7" },
      { id: "evento",  label: "Nome do evento", type: "text",  default: "Método Essência", placeholder: "Nome do evento" },
      { id: "data",    label: "Data",            type: "text",  default: "29 de abril",    placeholder: "29 de abril" },
      { id: "cta",     label: "Call to Action",  type: "text",  default: "Garanta sua vaga", placeholder: "Garanta sua vaga" },
      { id: "cor",     label: "Cor de destaque", type: "color", default: "#ec4899" },
    ],
    render: (v) => <ContagemFeedTemplate v={v} />,
  },
  {
    id: "contagem-stories",
    name: "Contagem Stories",
    client: "Luana",
    referencePath: "/library-seed/luana/faltam7dias-1.png",
    format: "stories",
    w: 1080,
    h: 1920,
    fields: [
      { id: "marca",   label: "Marca / Brand",  type: "text",  default: "luana",          placeholder: "Nome da marca" },
      { id: "numero",  label: "Número de dias", type: "text",  default: "7",              placeholder: "7" },
      { id: "evento",  label: "Nome do evento", type: "text",  default: "Método Essência", placeholder: "Nome do evento" },
      { id: "data",    label: "Data",            type: "text",  default: "29 de abril",    placeholder: "29 de abril" },
      { id: "cta",     label: "Call to Action",  type: "text",  default: "Garanta sua vaga", placeholder: "Garanta sua vaga" },
      { id: "cor",     label: "Cor de destaque", type: "color", default: "#ec4899" },
    ],
    render: (v) => <ContagemStoriesTemplate v={v} />,
  },
  {
    id: "anuncio-bold",
    name: "Anúncio Bold",
    client: "Formagios",
    referencePath: "/library-seed/formagios/AD07.jpg",
    format: "feed-quadrado",
    w: 1080,
    h: 1080,
    fields: [
      { id: "marca",     label: "Marca / Brand",  type: "text",     default: "sua marca",        placeholder: "sua marca" },
      { id: "badge",     label: "Badge",           type: "text",     default: "NOVO",             placeholder: "NOVO, GRÁTIS..." },
      { id: "headline",  label: "Headline",        type: "textarea", default: "sua\noferta\naqui", hint: "Use quebra de linha para separar" },
      { id: "descricao", label: "Descrição curta", type: "textarea", default: "Uma descrição curta e impactante que convence o cliente a agir agora mesmo.", placeholder: "Descreva em 1-2 linhas" },
      { id: "cta",       label: "Call to Action",  type: "text",     default: "Quero participar →", placeholder: "Quero participar" },
      { id: "cor",       label: "Cor de destaque", type: "color",    default: "#6c47ff" },
    ],
    render: (v) => <AnuncioFeedTemplate v={v} />,
  },
];
