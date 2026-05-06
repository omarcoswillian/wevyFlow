export interface EnsaioStyle {
  id: string;
  label: string;
  category: string;
  categoryLabel: string;
  accentColor: string;
  tags: string[];
  shot: string;
  description: string;
  examplePhoto: string;
  prompt: string;
}

export const ENSAIO_CATEGORIES = [
  { id: "todos",      label: "Todos"          },
  { id: "autoridade", label: "Autoridade"     },
  { id: "editorial",  label: "Editorial P&B"  },
  { id: "lifestyle",  label: "Lifestyle Luxo" },
  { id: "cinematico", label: "Cinematico"     },
  { id: "street",     label: "Street/Urbano"  },
  { id: "feminino",   label: "Feminino"       },
];

const UP = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=480&h=640&q=85`;

const PX = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=480&h=640&fit=crop`;

export const ENSAIO_STYLES: EnsaioStyle[] = [
  /* ─── AUTORIDADE ─── */
  {
    id: "editorial-premium",
    label: "Retrato Editorial Premium",
    category: "autoridade",
    categoryLabel: "Autoridade",
    accentColor: "#4a90d9",
    tags: ["Poltrona", "Terno", "Luz lateral"],
    shot: "Busto",
    description: "Studio com poltrona bege, blazer escuro, iluminacao lateral dramatica",
    examplePhoto: PX(2379004),
    prompt: `Studio portrait of the person in the attached photo — preserve their exact face, features, skin tone, hair, and expression without any alteration. The person sits on a modern beige armchair with wooden legs, leaning slightly forward with hands together. They wear a dark tailored blazer over a white dress shirt, dark pants. Background is a clean, slightly warm neutral studio backdrop. Dramatic side lighting sculpts the face. Sharp, high-resolution, editorial magazine quality. Photorealistic, 4K.`,
  },
  {
    id: "corporativo-pb",
    label: "Corporativo Magazine",
    category: "autoridade",
    categoryLabel: "Autoridade",
    accentColor: "#c0c0c0",
    tags: ["Preto & Branco", "Sofa", "Alto contraste"],
    shot: "Busto",
    description: "Preto e branco editorial, sofa moderno, expressao imponente",
    examplePhoto: PX(1681010),
    prompt: `Black and white editorial portrait of the person in the attached photo — maintain their exact real face, all facial features identical. The person sits on a modern sofa with a confident, composed expression. They wear a sharp dark suit. Dramatic studio lighting with strong contrast. Magazine cover quality. Ultra-realistic, high-contrast monochrome, professional editorial photography.`,
  },
  {
    id: "work-profile",
    label: "Perfil Profissional",
    category: "autoridade",
    categoryLabel: "Autoridade",
    accentColor: "#5aabff",
    tags: ["Escritorio", "Laptop", "Natural"],
    shot: "Corpo",
    description: "Mesa de escritorio moderno, look business casual, luz quente",
    examplePhoto: PX(1043474),
    prompt: `Realistic professional portrait of the person in the attached photo — use this exact face unchanged. The person sits at a modern office desk with a laptop and documents. Wearing a clean professional outfit, business casual. Confident, approachable expression. Warm office lighting, shallow depth of field blurring the background. 4K photorealistic quality.`,
  },

  /* ─── EDITORIAL P&B ─── */
  {
    id: "urban-reflection",
    label: "Urban Reflection",
    category: "editorial",
    categoryLabel: "Editorial P&B",
    accentColor: "#e0e0e0",
    tags: ["P&B", "Close", "Luz lateral"],
    shot: "Close",
    description: "Close dramatico em preto e branco, luz esculpindo o rosto",
    examplePhoto: PX(1516680),
    prompt: `Dramatic ultra-realistic close-up in black and white with high-contrast cinematic lighting from the side, highlighting the contours of the face and neck. Subject is the person from the attached photo — do not alter face, features, or identity in any way. Background fades to deep black. Sharp focus on eyes and facial structure. Intense, artistic, editorial quality. Studio photography.`,
  },
  {
    id: "monochrome-editorial",
    label: "Editorial Minimalista",
    category: "editorial",
    categoryLabel: "Editorial P&B",
    accentColor: "#b0b0b0",
    tags: ["P&B", "Loft moderno", "Geometrico"],
    shot: "Busto",
    description: "Bloco de madeira, loft moderno, gola preta, sombras precisas",
    examplePhoto: PX(1680172),
    prompt: `Black-and-white editorial portrait of the person in the attached photo — keep their face 100% identical. The person sits on a minimalist wooden block inside a modern loft apartment. Wearing a fitted black turtleneck. Side rim lighting creating precise shadows. Clean, geometric composition. Magazine-quality monochrome photography, ultra-sharp.`,
  },
  {
    id: "perfil-pb",
    label: "Perfil Cinematografico",
    category: "editorial",
    categoryLabel: "Editorial P&B",
    accentColor: "#d4d4d4",
    tags: ["P&B", "Perfil", "Rim light"],
    shot: "Perfil",
    description: "Vista de perfil encostado na parede, luz de borda no rosto",
    examplePhoto: PX(1300402),
    prompt: `Cinematic black-and-white portrait of the person in the attached photo — exact face, unchanged. The person is shown in side profile, leaning against a smooth wall with a confident, composed posture. The lighting creates a rim effect along the profile. Clean, minimal composition with deep blacks and bright highlights. Editorial, dramatic, artistic photography.`,
  },

  /* ─── LIFESTYLE LUXO ─── */
  {
    id: "luxury-car",
    label: "Empresario de Luxo",
    category: "lifestyle",
    categoryLabel: "Lifestyle Luxo",
    accentColor: "#f0a030",
    tags: ["Carro de luxo", "Por do sol", "Terno"],
    shot: "Corpo",
    description: "Carro preto de luxo, por do sol dourado, terno impecavel",
    examplePhoto: PX(1438081),
    prompt: `Hyper-realistic editorial portrait of the person in the attached photo — preserve every facial feature exactly. The person stands confidently outside a luxury black car at golden hour sunset. Wearing a perfectly fitted dark suit. Warm cinematic lighting with long shadows. Bokeh background with city lights or sunset. Luxury fashion editorial, 4K photorealistic.`,
  },
  {
    id: "empresario-reflexo",
    label: "Reflexo no Vidro",
    category: "lifestyle",
    categoryLabel: "Lifestyle Luxo",
    accentColor: "#60c060",
    tags: ["Janela", "Reflexo", "Casaco"],
    shot: "Busto",
    description: "Grande janela de vidro, reflexo na cidade, casaco elegante",
    examplePhoto: PX(1040880),
    prompt: `Cinematic close-up portrait of the person from the attached photo — maintain exact face and identity. The person stands by a large floor-to-ceiling glass window, gazing thoughtfully at their reflection. Wearing a stylish dark coat over a suit. Moody indoor lighting with city bokeh visible through the glass. Cinematic color grade, editorial quality.`,
  },
  {
    id: "dark-studio-luxo",
    label: "Dark Studio",
    category: "lifestyle",
    categoryLabel: "Lifestyle Luxo",
    accentColor: "#8080ff",
    tags: ["Fundo escuro", "Spotlight", "All black"],
    shot: "Corpo",
    description: "Studio totalmente escuro, spotlight frontal, roupa all black",
    examplePhoto: PX(1587009),
    prompt: `Cinematic portrait of the person from the attached photo — use this face as-is, no changes. The person sits confidently on a round black beanbag chair against a completely dark studio background. Wearing all-black stylish outfit. Single dramatic spotlight from above-front illuminates the face. Deep blacks, high contrast, luxury fashion editorial. Ultra-realistic, 4K.`,
  },

  /* ─── CINEMATICO ─── */
  {
    id: "urban-noir",
    label: "Urban Noir",
    category: "cinematico",
    categoryLabel: "Cinematico",
    accentColor: "#c060ff",
    tags: ["Noir", "Chuva", "Neon"],
    shot: "Corpo",
    description: "Beco urbano chuvoso, neons coloridos, casaco escuro, sombras dramaticas",
    examplePhoto: PX(1382734),
    prompt: `Cinematic noir portrait of the person in the attached photo — keep facial features completely unchanged. The person stands in a moody urban alley at night, dramatic contrast lighting — one strong side light, rest in shadow. Rain-wet pavement reflecting neon colors in the background. Dark coat, intense expression. Film noir aesthetic, deep cinematic color grade, ultra-realistic.`,
  },
  {
    id: "john-wick-style",
    label: "Cinematico Dramatico",
    category: "cinematico",
    categoryLabel: "Cinematico",
    accentColor: "#ff4080",
    tags: ["Terno preto", "Luz fria", "Cinematico 8K"],
    shot: "Busto",
    description: "Cenario escuro, terno preto impecavel, luz azul lateral, cinema",
    examplePhoto: PX(1722198),
    prompt: `Cinematic film still, neo-noir aesthetic, hyper-detailed 8K. A hyperrealistic portrait of the person from the attached photo — face identity locked, no alteration. The person stands in a dark dramatic setting wearing a sharp black suit, illuminated by a single cold-blue side light. High-contrast shadows, dramatic tension, photorealistic, 16:9 cinematic framing.`,
  },
  {
    id: "moody-studio",
    label: "Moody Spotlight",
    category: "cinematico",
    categoryLabel: "Cinematico",
    accentColor: "#ff8020",
    tags: ["Spotlight laranja", "Fundo escuro", "Teatro"],
    shot: "Busto",
    description: "Spotlight laranja-dourado circular, contrastando com sombras profundas",
    examplePhoto: PX(1183266),
    prompt: `Moody studio portrait of the person from the attached photo — exact face preserved. The person is bathed in a golden-orange spotlight that creates a glowing circular halo of light, contrasting dramatically with the surrounding deep shadows. Wearing a simple dark outfit. Artistic, theatrical, editorial quality photography. Ultra-realistic.`,
  },

  /* ─── STREET / URBANO ─── */
  {
    id: "urban-perch",
    label: "Street Style Urbano",
    category: "street",
    categoryLabel: "Street/Urbano",
    accentColor: "#30d0e0",
    tags: ["Streetwear", "Gradeado", "Oversize"],
    shot: "Corpo",
    description: "Gradeado de ferro urbano, streetwear oversized, cidade ao fundo",
    examplePhoto: PX(2269872),
    prompt: `Digital photo of the person from the attached photo — preserve their exact real face unchanged. The person sits casually on a steel wire fence or urban wall in a city setting. Wearing stylish streetwear: black oversized jacket, cargo pants, clean sneakers. Natural city lighting, slightly overcast sky. Street photography style, candid feel, urban backdrop with bokeh.`,
  },
  {
    id: "street-photographer",
    label: "Street Photographer",
    category: "street",
    categoryLabel: "Street/Urbano",
    accentColor: "#40c0b0",
    tags: ["Poste", "Europa", "Casual"],
    shot: "Corpo",
    description: "Encostado em poste, rua europeia, look minimal branco e jeans",
    examplePhoto: PX(1851164),
    prompt: `High-end street-photography portrait of the person from the attached photo — do not change any facial features. The person leans casually on a lamp post in front of a European urban street. Wearing a stylish minimal outfit — white shirt, dark jeans, clean shoes. Overcast natural light, street life in the background blurred. Editorial travel/lifestyle photography.`,
  },
  {
    id: "city-staircase",
    label: "City Staircase",
    category: "street",
    categoryLabel: "Street/Urbano",
    accentColor: "#6090d0",
    tags: ["Escadaria", "Fachada", "Relaxado"],
    shot: "Corpo",
    description: "Escadaria de pedra, postura relaxada, fachada de predio, casual",
    examplePhoto: PX(1040881),
    prompt: `Cinematic outdoor portrait of the person from the attached photo — exact face, all features identical. The person sits casually on outdoor stone steps in front of a building entrance, leaning back with one arm resting on the steps. Relaxed, confident posture. Natural urban lighting. Stylish casual outfit. High-end lifestyle photography, bokeh background.`,
  },

  /* ─── FEMININO ─── */
  {
    id: "mulher-negocios",
    label: "Mulher de Negocios",
    category: "feminino",
    categoryLabel: "Feminino",
    accentColor: "#e060c0",
    tags: ["Blazer", "Escritorio luxo", "Empoderada"],
    shot: "Corpo",
    description: "Escritorio luxuoso, blazer elegante, postura de lideranca",
    examplePhoto: PX(1181686),
    prompt: `Recreate this scene using the face and body from the attached photo as reference — same face, same identity. A confident businesswoman sitting on a luxury chair in a modern upscale office. She wears a tailored blazer over a silk blouse. Professional yet elegant. Dramatic side lighting, editorial quality. Ultra-realistic 4K photography.`,
  },
  {
    id: "mulher-elegante",
    label: "Elegante e Sofisticada",
    category: "feminino",
    categoryLabel: "Feminino",
    accentColor: "#ff70a0",
    tags: ["Marmore", "Fashion", "Sofisticada"],
    shot: "Corpo",
    description: "Interior luxuoso com paredes de marmore, look high fashion",
    examplePhoto: PX(3765177),
    prompt: `Recreate an elegant scene using the face and appearance from the attached photo — maintain exact identity. A sophisticated woman in a high-fashion setting: standing in a luxurious interior with marble walls, wearing an elegant outfit. Soft dramatic lighting highlighting the face. Fashion editorial quality, ultra-realistic.`,
  },
  {
    id: "estudio-feminino",
    label: "Studio Portrait",
    category: "feminino",
    categoryLabel: "Feminino",
    accentColor: "#a060e0",
    tags: ["P&B", "Close artistico", "Introspectivo"],
    shot: "Close",
    description: "Close em preto e branco, arte fotografica, expressao contemplativa",
    examplePhoto: PX(1382731),
    prompt: `A high-impact black and white studio portrait of the person from the attached photo — face preserved exactly. The female figure is photographed in an intimate close-up with a pensive, introspective expression. Single dramatic studio light from the side creates strong shadows. Clean studio backdrop. Fine art photography quality, ultra-sharp.`,
  },
];
