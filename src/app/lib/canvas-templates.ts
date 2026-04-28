export interface ObjDef {
  type: "rect" | "textbox" | "line";
  id: string;
  label: string;
  left: number;
  top: number;
  width?: number;
  height?: number;
  rx?: number;
  ry?: number;
  /* fill — solid string or linear gradient descriptor */
  fill?: string;
  gradient?: { angle: number; stops: { offset: number; color: string }[] };
  /* text */
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  charSpacing?: number;
  lineHeight?: number;
  textAlign?: string;
  /* fabric flags */
  selectable?: boolean;
  lockScalingX?: boolean;
  lockScalingY?: boolean;
  lockMovementX?: boolean;
  lockMovementY?: boolean;
  opacity?: number;
  /* stroke */
  stroke?: string;
  strokeWidth?: number;
  x1?: number; y1?: number; x2?: number; y2?: number;
}

export interface CanvasTemplate {
  id: string;
  name: string;
  client: string;
  format: string;
  w: number;
  h: number;
  bgColor: string;
  referencePath: string;
  objects: ObjDef[];
  /** Fabric.js canvas JSON exported by the WevyFlow Figma plugin. When set,
   *  CanvasEditor loads this via canvas.loadFromJSON() instead of building objects. */
  fabricJson?: {
    version: string;
    background: string;
    objects: unknown[];
  };
}

/* ══════════════════════════════════════════════════════════
   1 — ABERTURA DE TURMA  (Formagios style — 1080×1080)
══════════════════════════════════════════════════════════ */
const aberturaObjects: ObjDef[] = [
  /* ── background gradient overlay ── */
  {
    type: "rect", id: "bg-overlay", label: "Fundo",
    left: 0, top: 0, width: 1080, height: 1080,
    gradient: { angle: 135, stops: [{ offset: 0, color: "#1e1208" }, { offset: 1, color: "#0a0808" }] },
    selectable: false, lockMovementX: true, lockMovementY: true,
  },
  /* ── glow ── */
  {
    type: "rect", id: "glow", label: "Glow (decorativo)",
    left: -80, top: 620, width: 420, height: 420, rx: 210,
    fill: "rgba(194,120,60,0.18)", opacity: 1,
    selectable: false, lockMovementX: true, lockMovementY: true,
  },
  /* ── left accent bar ── */
  {
    type: "rect", id: "accent-bar", label: "Barra de destaque",
    left: 0, top: 260, width: 5, height: 820, rx: 2,
    gradient: { angle: 90, stops: [{ offset: 0, color: "#c2783c" }, { offset: 1, color: "rgba(194,120,60,0)" }] },
    selectable: true, lockMovementX: true, lockScalingX: true,
  },
  /* ── brand name ── */
  {
    type: "textbox", id: "brand", label: "Marca",
    left: 72, top: 110, width: 400,
    text: "agathon",
    fontSize: 36, fontFamily: "Cormorant Garamond", fontWeight: "300", fontStyle: "italic",
    fill: "rgba(255,255,255,0.55)", charSpacing: 60,
  },
  /* ── subtitle ── */
  {
    type: "textbox", id: "subtitle", label: "Subtítulo",
    left: 72, top: 318, width: 480,
    text: "nova turma",
    fontSize: 20, fontFamily: "Montserrat", fontWeight: "600",
    fill: "rgba(255,255,255,0.30)", charSpacing: 280, textAlign: "left",
  },
  /* ── main title ── */
  {
    type: "textbox", id: "title", label: "Título principal",
    left: 62, top: 365, width: 590,
    text: "NOVA\nTURMA",
    fontSize: 186, fontFamily: "Montserrat", fontWeight: "900",
    fill: "#ffffff", lineHeight: 0.88, charSpacing: -30,
  },
  /* ── date card background ── */
  {
    type: "rect", id: "card-bg", label: "Card de data — fundo",
    left: 580, top: 688, width: 428, height: 290, rx: 20,
    fill: "rgba(255,255,255,0.96)",
    selectable: true,
  },
  /* ── card: dia semana ── */
  {
    type: "textbox", id: "card-dia", label: "Dia da semana",
    left: 608, top: 712, width: 380,
    text: "QUARTA",
    fontSize: 13, fontFamily: "Montserrat", fontWeight: "600",
    fill: "#999999", charSpacing: 220,
  },
  /* ── card: data ── */
  {
    type: "textbox", id: "card-data", label: "Data",
    left: 608, top: 738, width: 380,
    text: "29 de abril",
    fontSize: 44, fontFamily: "Montserrat", fontWeight: "900",
    fill: "#111111", lineHeight: 1.1,
  },
  /* ── card divider ── */
  {
    type: "line", id: "card-divider", label: "Divisor",
    x1: 608, y1: 806, x2: 990, y2: 806,
    stroke: "rgba(0,0,0,0.10)", strokeWidth: 1.5,
    left: 608, top: 806,
    selectable: false,
  },
  /* ── card: canal ── */
  {
    type: "textbox", id: "card-canal", label: "Canal / Plataforma",
    left: 608, top: 818, width: 380,
    text: "Abertura | Agathon",
    fontSize: 14, fontFamily: "Montserrat", fontWeight: "400",
    fill: "#666666", lineHeight: 1.5,
  },
  /* ── card: horario ── */
  {
    type: "textbox", id: "card-horario", label: "Horário",
    left: 608, top: 848, width: 380,
    text: "19h03 no YouTube",
    fontSize: 14, fontFamily: "Montserrat", fontWeight: "700",
    fill: "#111111",
  },
  /* ── vagas ── */
  {
    type: "textbox", id: "vagas", label: "Vagas / CTA",
    left: 0, top: 1022, width: 1080,
    text: "APENAS 100 VAGAS",
    fontSize: 14, fontFamily: "Montserrat", fontWeight: "600",
    fill: "rgba(255,255,255,0.25)", charSpacing: 240, textAlign: "center",
  },
];

/* ══════════════════════════════════════════════════════════
   2 — CONTAGEM REGRESSIVA FEED  (Luana style — 1080×1080)
══════════════════════════════════════════════════════════ */
const contagemFeedObjects: ObjDef[] = [
  {
    type: "rect", id: "bg", label: "Fundo",
    left: 0, top: 0, width: 1080, height: 1080,
    fill: "#080808", selectable: false,
  },
  {
    type: "rect", id: "glow", label: "Glow (decorativo)",
    left: 190, top: 130, width: 700, height: 700, rx: 350,
    fill: "rgba(236,72,153,0.20)", selectable: false,
  },
  {
    type: "textbox", id: "brand", label: "Marca",
    left: 0, top: 64, width: 1080,
    text: "luana",
    fontSize: 22, fontFamily: "Montserrat", fontWeight: "600",
    fill: "rgba(255,255,255,0.35)", charSpacing: 400, textAlign: "center",
  },
  {
    type: "textbox", id: "label-faltam", label: 'Label "faltam"',
    left: 0, top: 282, width: 1080,
    text: "faltam",
    fontSize: 26, fontFamily: "Montserrat", fontWeight: "600",
    fill: "rgba(255,255,255,0.30)", charSpacing: 500, textAlign: "center",
  },
  {
    type: "textbox", id: "numero", label: "Número de dias",
    left: 0, top: 314, width: 1080,
    text: "7",
    fontSize: 580, fontFamily: "Bebas Neue", fontWeight: "400",
    fill: "#ec4899", lineHeight: 0.82, textAlign: "center",
  },
  {
    type: "textbox", id: "label-dias", label: 'Label "dias"',
    left: 0, top: 810, width: 1080,
    text: "DIAS",
    fontSize: 56, fontFamily: "Montserrat", fontWeight: "900",
    fill: "rgba(255,255,255,0.90)", charSpacing: 900, textAlign: "center",
  },
  {
    type: "rect", id: "divider", label: "Divisor",
    left: 460, top: 892, width: 160, height: 3, rx: 2,
    fill: "rgba(236,72,153,0.50)", selectable: false,
  },
  {
    type: "textbox", id: "evento", label: "Nome do evento",
    left: 80, top: 910, width: 920,
    text: "Método Essência",
    fontSize: 30, fontFamily: "Montserrat", fontWeight: "700",
    fill: "rgba(255,255,255,0.75)", textAlign: "center",
  },
  {
    type: "textbox", id: "data", label: "Data",
    left: 0, top: 956, width: 1080,
    text: "29 de abril",
    fontSize: 20, fontFamily: "Montserrat", fontWeight: "400",
    fill: "rgba(255,255,255,0.30)", charSpacing: 200, textAlign: "center",
  },
  /* CTA button */
  {
    type: "rect", id: "cta-bg", label: "Botão CTA — fundo",
    left: 240, top: 992, width: 600, height: 72, rx: 36,
    fill: "#ec4899",
  },
  {
    type: "textbox", id: "cta-text", label: "Botão CTA — texto",
    left: 240, top: 1009, width: 600,
    text: "Garanta sua vaga",
    fontSize: 22, fontFamily: "Montserrat", fontWeight: "700",
    fill: "#ffffff", textAlign: "center",
  },
];

/* ══════════════════════════════════════════════════════════
   3 — STORIES CONTAGEM  (Luana style — 1080×1920)
══════════════════════════════════════════════════════════ */
const contagemStoriesObjects: ObjDef[] = [
  {
    type: "rect", id: "bg", label: "Fundo",
    left: 0, top: 0, width: 1080, height: 1920,
    fill: "#080808", selectable: false,
  },
  {
    type: "rect", id: "glow", label: "Glow (decorativo)",
    left: 140, top: 580, width: 800, height: 800, rx: 400,
    fill: "rgba(236,72,153,0.20)", selectable: false,
  },
  {
    type: "textbox", id: "brand", label: "Marca",
    left: 0, top: 120, width: 1080,
    text: "luana",
    fontSize: 28, fontFamily: "Montserrat", fontWeight: "600",
    fill: "rgba(255,255,255,0.35)", charSpacing: 400, textAlign: "center",
  },
  {
    type: "textbox", id: "label-faltam", label: 'Label "faltam"',
    left: 0, top: 490, width: 1080,
    text: "faltam",
    fontSize: 34, fontFamily: "Montserrat", fontWeight: "600",
    fill: "rgba(255,255,255,0.30)", charSpacing: 500, textAlign: "center",
  },
  {
    type: "textbox", id: "numero", label: "Número de dias",
    left: 0, top: 540, width: 1080,
    text: "7",
    fontSize: 980, fontFamily: "Bebas Neue", fontWeight: "400",
    fill: "#ec4899", lineHeight: 0.85, textAlign: "center",
  },
  {
    type: "textbox", id: "label-dias", label: 'Label "dias"',
    left: 0, top: 1380, width: 1080,
    text: "DIAS",
    fontSize: 90, fontFamily: "Montserrat", fontWeight: "900",
    fill: "rgba(255,255,255,0.90)", charSpacing: 900, textAlign: "center",
  },
  {
    type: "rect", id: "divider", label: "Divisor",
    left: 440, top: 1510, width: 200, height: 4, rx: 2,
    fill: "rgba(236,72,153,0.50)", selectable: false,
  },
  {
    type: "textbox", id: "evento", label: "Nome do evento",
    left: 80, top: 1538, width: 920,
    text: "Método Essência",
    fontSize: 44, fontFamily: "Montserrat", fontWeight: "700",
    fill: "rgba(255,255,255,0.80)", textAlign: "center",
  },
  {
    type: "textbox", id: "data", label: "Data",
    left: 0, top: 1600, width: 1080,
    text: "29 de abril",
    fontSize: 28, fontFamily: "Montserrat", fontWeight: "400",
    fill: "rgba(255,255,255,0.30)", charSpacing: 200, textAlign: "center",
  },
  {
    type: "rect", id: "cta-bg", label: "Botão CTA — fundo",
    left: 80, top: 1700, width: 920, height: 110, rx: 22,
    fill: "#ec4899",
  },
  {
    type: "textbox", id: "cta-text", label: "Botão CTA — texto",
    left: 80, top: 1728, width: 920,
    text: "Garanta sua vaga",
    fontSize: 30, fontFamily: "Montserrat", fontWeight: "700",
    fill: "#ffffff", textAlign: "center",
  },
];

/* ══════════════════════════════════════════════════════════
   4 — ANÚNCIO BOLD  (Formagios AD style — 1080×1080)
══════════════════════════════════════════════════════════ */
const anuncioObjects: ObjDef[] = [
  {
    type: "rect", id: "bg-white", label: "Fundo branco",
    left: 0, top: 0, width: 1080, height: 1080, fill: "#ffffff", selectable: false,
  },
  {
    type: "rect", id: "color-block", label: "Bloco colorido",
    left: 0, top: 0, width: 1080, height: 680,
    fill: "#6c47ff", selectable: true, lockMovementY: true,
  },
  {
    type: "rect", id: "badge-bg", label: "Badge — fundo",
    left: 890, top: 60, width: 130, height: 42, rx: 21,
    fill: "rgba(255,255,255,0.15)",
  },
  {
    type: "textbox", id: "badge-text", label: "Badge",
    left: 890, top: 71, width: 130,
    text: "NOVO",
    fontSize: 14, fontFamily: "Montserrat", fontWeight: "700",
    fill: "#ffffff", textAlign: "center", charSpacing: 150,
  },
  {
    type: "textbox", id: "brand", label: "Marca",
    left: 72, top: 68, width: 500,
    text: "sua marca",
    fontSize: 20, fontFamily: "Montserrat", fontWeight: "600",
    fill: "rgba(255,255,255,0.70)", charSpacing: 350,
  },
  {
    type: "textbox", id: "headline", label: "Headline",
    left: 72, top: 165, width: 740,
    text: "SUA\nOFERTA\nAQUI",
    fontSize: 175, fontFamily: "Montserrat", fontWeight: "900",
    fill: "#ffffff", lineHeight: 0.88, charSpacing: -20,
  },
  {
    type: "textbox", id: "descricao", label: "Descrição",
    left: 72, top: 720, width: 760,
    text: "Uma descrição curta e impactante que convence o cliente a agir agora mesmo.",
    fontSize: 28, fontFamily: "Montserrat", fontWeight: "400",
    fill: "#333333", lineHeight: 1.5,
  },
  {
    type: "rect", id: "cta-bg", label: "Botão CTA — fundo",
    left: 72, top: 886, width: 480, height: 80, rx: 40,
    fill: "#6c47ff",
  },
  {
    type: "textbox", id: "cta-text", label: "Botão CTA — texto",
    left: 72, top: 904, width: 480,
    text: "Quero participar →",
    fontSize: 22, fontFamily: "Montserrat", fontWeight: "700",
    fill: "#ffffff", textAlign: "center",
  },
];

/* ─── Registry ─────────────────────────────────────────── */
export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: "abertura-turma",
    name: "Abertura de Turma",
    client: "Formagios",
    format: "feed-quadrado",
    w: 1080, h: 1080,
    bgColor: "#1a1208",
    referencePath: "/library-seed/formagios/AD01V1-FEED.jpg",
    objects: aberturaObjects,
  },
  {
    id: "contagem-feed",
    name: "Contagem Regressiva",
    client: "Luana",
    format: "feed-quadrado",
    w: 1080, h: 1080,
    bgColor: "#080808",
    referencePath: "/library-seed/luana/faltam7dias.png",
    objects: contagemFeedObjects,
  },
  {
    id: "contagem-stories",
    name: "Contagem Stories",
    client: "Luana",
    format: "stories",
    w: 1080, h: 1920,
    bgColor: "#080808",
    referencePath: "/library-seed/luana/faltam7dias-1.png",
    objects: contagemStoriesObjects,
  },
  {
    id: "anuncio-bold",
    name: "Anúncio Bold",
    client: "Formagios",
    format: "feed-quadrado",
    w: 1080, h: 1080,
    bgColor: "#ffffff",
    referencePath: "/library-seed/formagios/AD07.jpg",
    objects: anuncioObjects,
  },
];
