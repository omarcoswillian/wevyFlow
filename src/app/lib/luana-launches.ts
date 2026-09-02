import { TEMPLATES } from "./templates";
import type { TemplateItem } from "./types";

export interface CreativeAsset {
  path: string;
  name: string;
}

export interface LuanaLaunch {
  id: string;
  code: string;
  name: string;
  color: string;
  pages: TemplateItem[];
  creatives: CreativeAsset[];
}

interface LuanaLaunchDef {
  id: string;
  code: string;
  name: string;
  color: string;
  pageIds: string[];
  creatives: CreativeAsset[];
}

const LUANA_CREATIVES_LIBRARY: CreativeAsset[] = [
  { path: "/library-seed/luana/6202-ED-IMG.png", name: "6202" },
  { path: "/library-seed/luana/6210-ED-IMG.png", name: "6210" },
  { path: "/library-seed/luana/6216-ED-IMG.png", name: "6216" },
  { path: "/library-seed/luana/6217-ED-IMG.png", name: "6217" },
  { path: "/library-seed/luana/AD02.png", name: "AD 02" },
  { path: "/library-seed/luana/AD05.png", name: "AD 05" },
  { path: "/library-seed/luana/AD07.png", name: "AD 07" },
  { path: "/library-seed/luana/faltam7dias-1.png", name: "Faltam 7 Dias v1" },
  { path: "/library-seed/luana/faltam7dias.png", name: "Faltam 7 Dias" },
  { path: "/library-seed/luana/hoje.png", name: "Hoje" },
];

const ED_CREATIVES: CreativeAsset[] = [
  { path: "/library-seed/ed/ED-dark-001.png", name: "ED Dark 01" },
  { path: "/library-seed/ed/ED-dark-002.png", name: "ED Dark 02" },
  { path: "/library-seed/ed/ED-white-001.png", name: "ED White 01" },
];

const RPE_CREATIVES: CreativeAsset[] = [
  { path: "/library-seed/rpe/RPE-white-001.png", name: "RPE White 01" },
  { path: "/library-seed/rpe/RPE-white-002.png", name: "RPE White 02" },
  { path: "/library-seed/rpe/RPE-white-003.png", name: "RPE White 03" },
];

const SPE_CREATIVES: CreativeAsset[] = [
  { path: "/library-seed/spe/AD01-feed.png", name: "AD 01 — Feed" },
  { path: "/library-seed/spe/AD01-story.jpg", name: "AD 01 — Story" },
  { path: "/library-seed/spe/AD03-feed.jpg", name: "AD 03 — Feed" },
  { path: "/library-seed/spe/AD03-story.jpg", name: "AD 03 — Story" },
  { path: "/library-seed/spe/AD04-feed.png", name: "AD 04 — Feed" },
  { path: "/library-seed/spe/AD04-story.jpg", name: "AD 04 — Story" },
  { path: "/library-seed/spe/9060-spe-psicologos.jpg", name: "Psicólogos 9060" },
  { path: "/library-seed/spe/9060-spe-psicologos-1.jpg", name: "Psicólogos 9060 v2" },
  { path: "/library-seed/spe/9061-spe-psicologos.jpg", name: "Psicólogos 9061" },
  { path: "/library-seed/spe/9061-spe-psicologos-1.jpg", name: "Psicólogos 9061 v2" },
  { path: "/library-seed/spe/9062-spe-psicologos.jpg", name: "Psicólogos 9062" },
  { path: "/library-seed/spe/9062-spe-psicologos-1.jpg", name: "Psicólogos 9062 v2" },
  { path: "/library-seed/spe/9063-spe-psicologos.jpg", name: "Psicólogos 9063" },
  { path: "/library-seed/spe/9063-spe-psicologos-1.jpg", name: "Psicólogos 9063 v2" },
  { path: "/library-seed/spe/9064-spe-psicologos.jpg", name: "Psicólogos 9064" },
  { path: "/library-seed/spe/9064-spe-psicologos-1.jpg", name: "Psicólogos 9064 v2" },
  { path: "/library-seed/spe/9065-spe-personal.jpg", name: "Personal 9065" },
  { path: "/library-seed/spe/9065-spe-personal-1.jpg", name: "Personal 9065 v2" },
];

const LUANA_LAUNCH_DEFS: LuanaLaunchDef[] = [
  {
    id: "execucao-digital",
    code: "ED",
    name: "Execução Digital",
    color: "#a78bfa",
    pageIds: [
      "ready-luana-carolina-ed-001",
      "ready-luana-carolina-ed-001-obrigado",
      "ready-luana-ed-t005",
      "ready-luana-ed-t006",
    ],
    creatives: [...LUANA_CREATIVES_LIBRARY, ...ED_CREATIVES],
  },
  {
    id: "execucao-maxima",
    code: "EM",
    name: "Execução Máxima",
    color: "#f97316",
    pageIds: ["ready-luana-em-t004"],
    creatives: [],
  },
  {
    id: "rpe",
    code: "RPE",
    name: "RPE",
    color: "#3b82f6",
    pageIds: ["ready-luana-rpe-t001"],
    creatives: RPE_CREATIVES,
  },
  {
    id: "ape",
    code: "APE",
    name: "APE",
    color: "#ec4899",
    pageIds: ["ready-luana-ape-t001"],
    creatives: [],
  },
  {
    id: "mcp",
    code: "MCP",
    name: "MCP",
    color: "#10b981",
    pageIds: ["ready-luana-mcp-t001"],
    creatives: [],
  },
  {
    id: "spe",
    code: "SPE",
    name: "SPE",
    color: "#eab308",
    pageIds: ["ready-luana-spe-t001", "ready-luana-spe-t002", "ready-luana-spe-esp-t002"],
    creatives: SPE_CREATIVES,
  },
  {
    id: "mtg",
    code: "MTG",
    name: "MTG",
    color: "#f43f5e",
    pageIds: ["ready-luana-mtg-t001"],
    creatives: [],
  },
];

const TEMPLATE_MAP = new Map(TEMPLATES.map((t) => [t.id, t]));

export const LUANA_LAUNCHES: LuanaLaunch[] = LUANA_LAUNCH_DEFS.map((def) => ({
  id: def.id,
  code: def.code,
  name: def.name,
  color: def.color,
  creatives: def.creatives,
  pages: def.pageIds.map((id) => TEMPLATE_MAP.get(id)).filter((t): t is TemplateItem => !!t),
}));

export function getLuanaLaunch(id: string): LuanaLaunch | undefined {
  return LUANA_LAUNCHES.find((l) => l.id === id);
}
