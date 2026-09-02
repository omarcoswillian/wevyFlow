export interface KvExampleSlide {
  path: string;
  label: string;
}

export interface KvExample {
  id: string;
  clientName: string;
  projectName: string;
  slides: KvExampleSlide[];
}

export const KV_EXAMPLES: KvExample[] = [
  {
    id: "carreira-de-ouro",
    clientName: "Isabela Franceschini",
    projectName: "A Carreira de Ouro",
    slides: [
      { path: "/library-seed/kv-examples/carreira-de-ouro/01-capa.png", label: "Capa" },
      { path: "/library-seed/kv-examples/carreira-de-ouro/02-paleta.png", label: "Paleta de cores" },
      { path: "/library-seed/kv-examples/carreira-de-ouro/03-tipografia.png", label: "Tipografia" },
      { path: "/library-seed/kv-examples/carreira-de-ouro/04-logo-versoes.png", label: "Logo — versões" },
      { path: "/library-seed/kv-examples/carreira-de-ouro/05-logo-aplicacao.png", label: "Logo — aplicação" },
      { path: "/library-seed/kv-examples/carreira-de-ouro/06-texturas-icones.png", label: "Texturas e ícones" },
      { path: "/library-seed/kv-examples/carreira-de-ouro/07-mockups.png", label: "Mockups de aplicação" },
    ],
  },
];
