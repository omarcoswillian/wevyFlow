import { TemplateItem } from "./types";

export const TEMPLATE_CATEGORIES = [
  { id: "vendas" as const, label: "Página de Vendas" },
  { id: "captura" as const, label: "Captura de Leads" },
  { id: "evento" as const, label: "Evento / Workshop" },
  { id: "servico" as const, label: "Serviço / Consultoria" },
  { id: "blog" as const, label: "Blog / Conteúdo" },
];

export const TEMPLATES: TemplateItem[] = [
  {
    id: "ready-luana-carolina-ed-001",
    label: "Luana Carolina · Execução Digital (Pronto)",
    description: "Página de captura hero fullscreen para infoproduto. Fundo fotográfico com logo, headline de alto impacto, subtítulo persuasivo e formulário com Nome, WhatsApp, E-mail + botão verde gradiente. Responsiva desktop e mobile. Fonte Montserrat.",
    category: "captura",
    tags: ["pronto", "captura", "luana carolina", "execução digital", "hero", "foto", "formulário", "montserrat", "infoproduto", "lançamento"],
    prompt: "READY:ready-luana-carolina-ed-001",
    thumbnail: "/template-previews/luana-carolina-ed-001.png",
  },
  {
    id: "ready-luana-carolina-ed-001-obrigado",
    label: "Luana Carolina · Execução Digital — Obrigado (Pronto)",
    description: "Página de obrigado com barra de progresso animada, fundo desfocado e card de confirmação. Parte do funil Execução Digital.",
    category: "captura",
    tags: ["pronto", "obrigado", "luana carolina", "execução digital", "funil", "montserrat"],
    prompt: "READY:ready-luana-carolina-ed-001-obrigado",
    thumbnail: "/template-previews/luana-carolina-ed-001-obrigado.png",
  },
];
