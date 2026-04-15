const S = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;overflow:hidden}`;

function card(bg: string, accent: string, title: string, sub: string, type: "light" | "dark" = "light") {
  const text = type === "dark" ? "#fff" : "#111";
  const muted = type === "dark" ? "rgba(255,255,255,0.5)" : "#888";
  const border = type === "dark" ? "rgba(255,255,255,0.06)" : "#eee";
  return `<style>${S}body{background:${bg};padding:10px}</style>
<div style="padding:4px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <div style="font-weight:700;font-size:6px;color:${text}">Brand</div>
    <div style="background:${accent};color:#fff;padding:2px 6px;border-radius:10px;font-size:3.5px">Começar</div>
  </div>
  <div style="display:flex;gap:8px;align-items:center">
    <div style="flex:1">
      <div style="background:${accent}22;color:${accent};padding:1px 4px;border-radius:6px;font-size:3px;display:inline-block;margin-bottom:3px">Novo</div>
      <div style="font-size:10px;font-weight:800;color:${text};line-height:1.05;margin-bottom:3px;letter-spacing:-0.03em">${title}</div>
      <div style="font-size:3.5px;color:${muted};margin-bottom:5px;line-height:1.4">${sub}</div>
      <div style="display:flex;gap:3px"><div style="background:${accent};color:#fff;padding:2px 7px;border-radius:7px;font-size:3.5px">Começar →</div></div>
    </div>
    <div style="flex:0.7;background:${type==='dark'?'rgba(255,255,255,0.03)':'#fff'};border-radius:5px;padding:5px;border:1px solid ${border};box-shadow:0 2px 8px rgba(0,0,0,${type==='dark'?'0.3':'0.05'})">
      <div style="display:flex;gap:1.5px;margin-bottom:3px"><div style="width:2.5px;height:2.5px;border-radius:50%;background:#ff5f57"></div><div style="width:2.5px;height:2.5px;border-radius:50%;background:#ffbd2e"></div><div style="width:2.5px;height:2.5px;border-radius:50%;background:#28ca42"></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px"><div style="background:${accent}15;border-radius:2px;padding:2px;text-align:center"><div style="font-size:5px;font-weight:800;color:${accent}">47</div><div style="font-size:2px;color:${muted}">ativos</div></div><div style="background:${accent}15;border-radius:2px;padding:2px;text-align:center"><div style="font-size:5px;font-weight:800;color:${accent}">R$284k</div><div style="font-size:2px;color:${muted}">valor</div></div></div>
    </div>
  </div>
</div>`;
}

export const TEMPLATE_PREVIEWS: Record<string, string> = {
  "captura-premium-foto": `<style>${S}body{background:linear-gradient(135deg,#0a0a0f 0%,#1a1a2e 50%,#0f1525 100%);padding:0;height:100%;position:relative;overflow:hidden}</style>
<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,0.8) 0%,rgba(0,0,0,0.2) 100%)"></div>
<div style="position:relative;z-index:1;padding:12px;height:100%;display:flex;flex-direction:column;justify-content:center">
  <div style="font-size:4px;color:rgba(255,255,255,0.4);font-style:italic;margin-bottom:6px;letter-spacing:0.1em">Execução Máxima</div>
  <div style="font-size:9px;font-weight:700;color:#fff;line-height:1.15;margin-bottom:4px;max-width:65%">Desbloqueie sua melhor versão em 25 dias</div>
  <div style="font-size:3.5px;color:rgba(255,255,255,0.45);margin-bottom:6px;max-width:55%;line-height:1.5">Melhore o desempenho em todas as áreas através do desenvolvimento pessoal.</div>
  <div style="max-width:50%">
    <div style="border-bottom:1px solid rgba(255,255,255,0.15);padding:2px 0;margin-bottom:3px;font-size:3px;color:rgba(255,255,255,0.25)">Seu nome</div>
    <div style="border-bottom:1px solid rgba(255,255,255,0.15);padding:2px 0;margin-bottom:3px;font-size:3px;color:rgba(255,255,255,0.25)">Seu e-mail</div>
    <div style="background:linear-gradient(135deg,#0bda51,#05a83a);color:#fff;padding:3px 0;border-radius:3px;font-size:3.5px;text-align:center;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;margin-top:4px">Quero me inscrever</div>
  </div>
</div>`,

  "captura-vagas-abertas": `<style>${S}body{background:linear-gradient(135deg,#0a0a12,#151528,#0d0d1a);padding:0;height:100%;position:relative}</style>
<div style="position:absolute;right:0;top:0;bottom:0;width:45%;background:linear-gradient(135deg,rgba(60,50,80,0.3),rgba(40,35,60,0.5));border-radius:0"></div>
<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.1) 70%)"></div>
<div style="position:relative;z-index:1;padding:10px;height:100%;display:flex;flex-direction:column;justify-content:center">
  <div style="display:flex;gap:2px;margin-bottom:4px"><div style="width:4px;height:4px;border-radius:50%;background:#0bda51"></div><div style="width:4px;height:4px;border-radius:50%;background:#0bda51;opacity:0.6"></div><div style="width:4px;height:4px;border-radius:50%;background:#0bda51;opacity:0.3"></div></div>
  <div style="font-size:9px;font-weight:700;color:#fff;line-height:1.12;margin-bottom:4px;max-width:60%">Como criar um infoproduto <span style="color:#0bda51">irresistível</span></div>
  <div style="font-size:3px;color:rgba(255,255,255,0.4);margin-bottom:5px;max-width:50%;line-height:1.5">Replique o método para transformar seu conhecimento em vendas.</div>
  <div style="max-width:45%;display:flex;flex-direction:column;gap:2px">
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:2.5px 4px;font-size:2.5px;color:rgba(255,255,255,0.25)">Seu nome</div>
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:2.5px 4px;font-size:2.5px;color:rgba(255,255,255,0.25)">Seu WhatsApp</div>
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:2.5px 4px;font-size:2.5px;color:rgba(255,255,255,0.25)">Seu e-mail</div>
    <div style="background:linear-gradient(135deg,#0bda51,#05a83a);color:#fff;padding:3px 0;border-radius:3px;font-size:3px;text-align:center;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">Quero garantir meu lugar</div>
  </div>
</div>`,
  "vendas-lancamento": card("#fafafa", "#10b981", "Domine e transforme", "Método exclusivo para resultados.", "light"),
  "vendas-produto-fisico": card("#f9f8f6", "#c5944e", "O produto que muda tudo", "Design premium para seu dia a dia.", "light"),
  "vendas-webinar": card("#0a0a0f", "#3b82f6", "Webinar Gratuito", "Evento ao vivo exclusivo.", "dark"),

  "captura-ebook": `<style>${S}body{background:#fff;padding:12px}</style>
<div style="display:flex;gap:8px;align-items:center">
  <div style="flex:0.6;background:linear-gradient(135deg,#8b5cf6,#6366f1);border-radius:5px;height:60px;display:flex;align-items:center;justify-content:center;box-shadow:4px 4px 12px rgba(99,102,241,0.2)">
    <div style="color:#fff;text-align:center"><div style="font-size:7px;font-weight:800">E-BOOK</div><div style="font-size:3px;opacity:0.7">Guia Completo</div></div>
  </div>
  <div style="flex:1">
    <div style="font-size:8px;font-weight:800;color:#111;margin-bottom:2px">Baixe grátis</div>
    <div style="font-size:3px;color:#888;margin-bottom:4px">15.000+ downloads</div>
    <div style="background:#f5f5f5;border-radius:3px;padding:2px 4px;margin-bottom:2px"><div style="font-size:2.5px;color:#aaa">Seu email</div></div>
    <div style="background:#10b981;color:#fff;padding:2px 0;border-radius:3px;font-size:3px;text-align:center;font-weight:600">Baixar E-book →</div>
  </div>
</div>`,

  "captura-lista-espera": `<style>${S}body{background:#09090b;padding:16px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%}</style>
<div style="position:absolute;top:50%;left:50%;width:80px;height:60px;background:radial-gradient(ellipse,rgba(139,92,246,0.15),transparent 70%);transform:translate(-50%,-50%);filter:blur(20px)"></div>
<div style="position:relative;z-index:1">
  <div style="font-size:12px;font-weight:800;color:#fff;margin-bottom:3px;letter-spacing:-0.03em">Algo incrível<br>está chegando</div>
  <div style="font-size:3.5px;color:rgba(255,255,255,0.4);margin-bottom:8px">Seja o primeiro a ter acesso.</div>
  <div style="display:flex;gap:2px;justify-content:center;max-width:80%;margin:0 auto"><div style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:2px 4px;font-size:2.5px;color:rgba(255,255,255,0.2)">seu@email.com</div><div style="background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;padding:2px 6px;border-radius:4px;font-size:3px;white-space:nowrap">Entrar →</div></div>
  <div style="font-size:3px;color:rgba(255,255,255,0.2);margin-top:4px">2.847 pessoas na fila</div>
</div>`,

  "captura-quiz": `<style>${S}body{background:#fff;padding:12px}</style>
<div><div style="background:#8b5cf6;height:2px;width:33%;border-radius:10px;margin-bottom:6px"></div>
<div style="font-size:3px;color:#8b5cf6;margin-bottom:2px">Etapa 1 de 3</div>
<div style="font-size:9px;font-weight:800;color:#111;margin-bottom:6px">Qual seu perfil?</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px">
  <div style="border:1.5px solid #eee;border-radius:5px;padding:5px;text-align:center;cursor:pointer"><div style="font-size:10px;margin-bottom:2px">🚀</div><div style="font-size:4px;font-weight:700;color:#111">Iniciante</div><div style="font-size:2.5px;color:#888">Começando agora</div></div>
  <div style="border:1.5px solid #8b5cf6;border-radius:5px;padding:5px;text-align:center;background:#f5f3ff"><div style="font-size:10px;margin-bottom:2px">💡</div><div style="font-size:4px;font-weight:700;color:#8b5cf6">Intermediário</div><div style="font-size:2.5px;color:#888">Alguma experiência</div></div>
  <div style="border:1.5px solid #eee;border-radius:5px;padding:5px;text-align:center"><div style="font-size:10px;margin-bottom:2px">⭐</div><div style="font-size:4px;font-weight:700;color:#111">Avançado</div><div style="font-size:2.5px;color:#888">Muita experiência</div></div>
  <div style="border:1.5px solid #eee;border-radius:5px;padding:5px;text-align:center"><div style="font-size:10px;margin-bottom:2px">🏆</div><div style="font-size:4px;font-weight:700;color:#111">Expert</div><div style="font-size:2.5px;color:#888">Profissional</div></div>
</div></div>`,

  "saas-dashboard": `<style>${S}body{background:#f5f5f0;padding:12px;text-align:center}</style>
<div style="font-size:6px;font-weight:700;color:#1a1a1a;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;text-align:left"><span>ProductName</span><span style="background:#1a1a1a;color:#fff;padding:1.5px 5px;border-radius:8px;font-size:3px;font-weight:500">Get Started</span></div>
<div style="font-size:12px;font-weight:800;color:#1a1a1a;line-height:1.05;margin-bottom:3px;letter-spacing:-0.04em">The only tracker<br><em style="font-style:italic">built for teams</em></div>
<div style="font-size:3.5px;color:#888;margin-bottom:6px">Simple, reliable equipment management.</div>
<div style="background:#1a1a1a;color:#fff;padding:2.5px 8px;border-radius:10px;font-size:3.5px;display:inline-block;margin-bottom:8px">Get started →</div>
<div style="background:#fff;border-radius:6px;border:1px solid #e5e5e0;padding:5px;box-shadow:0 2px 12px rgba(0,0,0,0.04);text-align:left">
  <div style="display:flex;gap:1.5px;margin-bottom:3px"><div style="width:2.5px;height:2.5px;border-radius:50%;background:#ff5f57"></div><div style="width:2.5px;height:2.5px;border-radius:50%;background:#ffbd2e"></div><div style="width:2.5px;height:2.5px;border-radius:50%;background:#28ca42"></div></div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px"><div style="background:#fafaf8;border-radius:2px;padding:2px"><div style="font-size:6px;font-weight:800;color:#1a1a1a">47</div><div style="font-size:2px;color:#999">Assets</div></div><div style="background:#fafaf8;border-radius:2px;padding:2px"><div style="font-size:6px;font-weight:800;color:#1a1a1a">$284k</div><div style="font-size:2px;color:#999">Value</div></div><div style="background:#fafaf8;border-radius:2px;padding:2px"><div style="font-size:6px;font-weight:800;color:#1a1a1a">$71k</div><div style="font-size:2px;color:#999">Depr.</div></div><div style="background:#fafaf8;border-radius:2px;padding:2px"><div style="font-size:6px;font-weight:800;color:#e53e3e">5</div><div style="font-size:2px;color:#999">Alert</div></div></div>
</div>`,

  "saas-ai": card("#0a0a0f", "#8b5cf6", "IA que entende seu negócio", "Powered by artificial intelligence.", "dark"),

  "blog-home": `<style>${S}body{background:#fff;padding:10px}</style>
<div style="font-size:5px;font-weight:700;color:#111;margin-bottom:8px;display:flex;justify-content:space-between"><span>The Blog</span><span style="font-weight:400;color:#888">Categorias Sobre</span></div>
<div style="background:linear-gradient(135deg,#f97316,#ec4899);border-radius:5px;height:30px;margin-bottom:4px;position:relative;overflow:hidden"><div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.6));padding:4px"><div style="font-size:6px;font-weight:800;color:#fff">Design trends for 2026</div><div style="font-size:2.5px;color:rgba(255,255,255,0.7)">5 min · Design</div></div></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">
  <div style="border-radius:4px;overflow:hidden;border:1px solid #eee"><div style="height:16px;background:linear-gradient(135deg,#3b82f6,#06b6d4)"></div><div style="padding:3px"><div style="font-size:3.5px;font-weight:700;color:#111">Artigo título</div><div style="font-size:2.5px;color:#888;margin-top:1px">2 min · Tech</div></div></div>
  <div style="border-radius:4px;overflow:hidden;border:1px solid #eee"><div style="height:16px;background:linear-gradient(135deg,#10b981,#14b8a6)"></div><div style="padding:3px"><div style="font-size:3.5px;font-weight:700;color:#111">Outro artigo</div><div style="font-size:2.5px;color:#888;margin-top:1px">4 min · UX</div></div></div>
  <div style="border-radius:4px;overflow:hidden;border:1px solid #eee"><div style="height:16px;background:linear-gradient(135deg,#8b5cf6,#ec4899)"></div><div style="padding:3px"><div style="font-size:3.5px;font-weight:700;color:#111">Mais um post</div><div style="font-size:2.5px;color:#888;margin-top:1px">3 min · AI</div></div></div>
</div>`,

  "blog-post": `<style>${S}body{background:#fff;padding:12px}</style>
<div style="max-width:85%;margin:0 auto">
  <div style="font-size:3px;color:#8b5cf6;font-weight:600;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.1em">Design</div>
  <div style="font-size:12px;font-weight:800;color:#111;line-height:1.05;margin-bottom:4px;letter-spacing:-0.03em">Como criar interfaces que encantam</div>
  <div style="display:flex;align-items:center;gap:3px;margin-bottom:6px"><div style="width:7px;height:7px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#ec4899)"></div><div style="font-size:3px;color:#888">João Silva · 8 min · 14 Abr</div></div>
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:5px;height:32px;margin-bottom:6px"></div>
  <div style="font-size:3.5px;color:#555;line-height:1.7">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam...</div>
</div>`,

  "portfolio-designer": `<style>${S}body{background:#fff;padding:12px}</style>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div style="font-size:6px;font-weight:700;color:#111">João Silva</div><div style="font-size:3.5px;color:#888">Work About Contact</div></div>
<div style="font-size:14px;font-weight:800;color:#111;line-height:1.0;margin-bottom:8px;letter-spacing:-0.04em">Design that<br>speaks.</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
  <div style="border-radius:5px;overflow:hidden;position:relative"><div style="height:34px;background:linear-gradient(135deg,#f97316,#ec4899)"></div><div style="padding:3px"><div style="font-size:4px;font-weight:700;color:#111">Brand Identity</div><div style="font-size:2.5px;color:#888">TechCorp · 2026</div></div></div>
  <div style="border-radius:5px;overflow:hidden"><div style="height:34px;background:linear-gradient(135deg,#3b82f6,#8b5cf6)"></div><div style="padding:3px"><div style="font-size:4px;font-weight:700;color:#111">App Redesign</div><div style="font-size:2.5px;color:#888">StartupX · 2025</div></div></div>
</div>`,

  "portfolio-dev": `<style>${S}body{background:#0a0a0f;padding:12px;color:#fff}</style>
<div style="margin-bottom:8px"><div style="font-size:5px;color:#10b981;font-family:monospace;margin-bottom:1px">$ whoami</div><div style="font-size:7px;font-weight:800;color:#fff;letter-spacing:-0.03em">dev.joao</div></div>
<div style="font-size:12px;font-weight:800;line-height:1.05;margin-bottom:6px">Full-stack<br><span style="color:#10b981">developer</span></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px">
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:4px;padding:4px"><div style="font-size:4px;font-weight:700;margin-bottom:1px">API Gateway</div><div style="font-size:2.5px;color:rgba(255,255,255,0.4);margin-bottom:2px">Microserviços escaláveis</div><div style="display:flex;gap:1.5px"><div style="background:rgba(59,130,246,0.15);color:#3b82f6;padding:0.5px 3px;border-radius:3px;font-size:2px">React</div><div style="background:rgba(16,185,129,0.15);color:#10b981;padding:0.5px 3px;border-radius:3px;font-size:2px">Node</div></div></div>
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:4px;padding:4px"><div style="font-size:4px;font-weight:700;margin-bottom:1px">Dashboard</div><div style="font-size:2.5px;color:rgba(255,255,255,0.4);margin-bottom:2px">Analytics em tempo real</div><div style="display:flex;gap:1.5px"><div style="background:rgba(139,92,246,0.15);color:#8b5cf6;padding:0.5px 3px;border-radius:3px;font-size:2px">Next.js</div><div style="background:rgba(236,72,153,0.15);color:#ec4899;padding:0.5px 3px;border-radius:3px;font-size:2px">Python</div></div></div>
</div>`,
};

// Fallbacks for sections without specific preview
export const CATEGORY_FALLBACKS: Record<string, string> = {
  sections: `<style>${S}body{background:#fafafa;padding:10px}</style>
<div style="text-align:center;margin-bottom:6px"><div style="font-size:8px;font-weight:800;color:#111">Seção pronta</div><div style="font-size:3px;color:#888;margin-top:1px">Copie e cole no seu projeto</div></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">
  <div style="background:#fff;border-radius:4px;padding:5px;border:1px solid #eee"><div style="font-size:5px;font-weight:700;color:#111;margin-bottom:1px">Feature</div><div style="font-size:2.5px;color:#888">Descrição curta</div></div>
  <div style="background:#fff;border-radius:4px;padding:5px;border:1px solid #eee"><div style="font-size:5px;font-weight:700;color:#111;margin-bottom:1px">Feature</div><div style="font-size:2.5px;color:#888">Descrição curta</div></div>
  <div style="background:#fff;border-radius:4px;padding:5px;border:1px solid #eee"><div style="font-size:5px;font-weight:700;color:#111;margin-bottom:1px">Feature</div><div style="font-size:2.5px;color:#888">Descrição curta</div></div>
</div>`,
};
