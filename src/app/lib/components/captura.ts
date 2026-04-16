// Componentes de captura para infoprodutores brasileiros — v2
// Benchmark: Conversao Extrema (Tiago Tessmann) / Luana Carolina
// Cada componente funciona standalone e compoe uma LP completa
// Design tokens: Montserrat, #1DB954 green, #CC0000 urgency, #F8F8F8 bg

export const CAPTURA = {
  "urgency-bar-countdown": `<!-- BARRA URGENCIA: Countdown vermelho fixo no topo -->
<div style="position:fixed;top:0;left:0;width:100%;height:48px;background:#CC0000;display:flex;align-items:center;justify-content:center;gap:24px;z-index:9999;font-family:'Montserrat',sans-serif;overflow:hidden;">
  <span style="color:#fff;font-size:14px;font-weight:700;text-transform:uppercase;white-space:nowrap;">[[URGENCY_TEXT]]</span>
  <div style="display:flex;align-items:center;gap:6px;">
    <div style="display:flex;flex-direction:column;align-items:center;background:rgba(0,0,0,0.25);border-radius:6px;padding:3px 8px;min-width:42px;">
      <span style="color:#fff;font-size:18px;font-weight:800;line-height:1.2;" id="cd-days">02</span>
      <span style="color:rgba(255,255,255,0.7);font-size:9px;font-weight:600;text-transform:uppercase;">Dias</span>
    </div>
    <span style="color:rgba(255,255,255,0.4);font-size:16px;font-weight:700;">&middot;</span>
    <div style="display:flex;flex-direction:column;align-items:center;background:rgba(0,0,0,0.25);border-radius:6px;padding:3px 8px;min-width:42px;">
      <span style="color:#fff;font-size:18px;font-weight:800;line-height:1.2;" id="cd-hours">14</span>
      <span style="color:rgba(255,255,255,0.7);font-size:9px;font-weight:600;text-transform:uppercase;">Hrs</span>
    </div>
    <span style="color:rgba(255,255,255,0.4);font-size:16px;font-weight:700;">&middot;</span>
    <div style="display:flex;flex-direction:column;align-items:center;background:rgba(0,0,0,0.25);border-radius:6px;padding:3px 8px;min-width:42px;">
      <span style="color:#fff;font-size:18px;font-weight:800;line-height:1.2;" id="cd-mins">42</span>
      <span style="color:rgba(255,255,255,0.7);font-size:9px;font-weight:600;text-transform:uppercase;">Min</span>
    </div>
    <span style="color:rgba(255,255,255,0.4);font-size:16px;font-weight:700;">&middot;</span>
    <div style="display:flex;flex-direction:column;align-items:center;background:rgba(0,0,0,0.25);border-radius:6px;padding:3px 8px;min-width:42px;">
      <span style="color:#fff;font-size:18px;font-weight:800;line-height:1.2;" id="cd-secs">08</span>
      <span style="color:rgba(255,255,255,0.7);font-size:9px;font-weight:600;text-transform:uppercase;">Seg</span>
    </div>
  </div>
</div>
<script>
(function(){var e=new Date().getTime()+3*24*60*60*1e3,s=localStorage.getItem('wf_cd');if(s&&parseInt(s)>Date.now())e=parseInt(s);else localStorage.setItem('wf_cd',e);function p(n){return n<10?'0'+n:n}function t(){var d=e-Date.now();if(d<=0)return;var D=Math.floor(d/864e5),H=Math.floor(d%864e5/36e5),M=Math.floor(d%36e5/6e4),S=Math.floor(d%6e4/1e3);document.getElementById('cd-days').textContent=p(D);document.getElementById('cd-hours').textContent=p(H);document.getElementById('cd-mins').textContent=p(M);document.getElementById('cd-secs').textContent=p(S)}t();setInterval(t,1e3)})();
</script>`,

  "header-captura-clean": `<!-- HEADER: Clean para captura (sem nav, logo + brand) -->
<header style="background:#F8F8F8;padding:18px 40px;border-bottom:1px solid #E0E0E0;font-family:'Montserrat',sans-serif;">
  <div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:14px;">
    <div style="width:44px;height:44px;border-radius:10px;background:#1DB954;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    </div>
    <div style="display:flex;flex-direction:column;line-height:1.3;">
      <span style="font-size:15px;font-weight:700;color:#111;">[[BRAND_NAME]]</span>
      <span style="font-size:12px;font-weight:500;color:#555;">[[BRAND_TAGLINE]]</span>
    </div>
  </div>
</header>`,

  "hero-captura-split": `<!-- HERO CAPTURA: Split 50/50 com form card + foto + cards flutuantes -->
<section style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;min-height:calc(100vh - 128px);font-family:'Montserrat',sans-serif;letter-spacing:-0.02em;">
  <!-- Coluna esquerda -->
  <div style="padding:56px 40px;display:flex;flex-direction:column;justify-content:center;">
    <h1 style="font-size:clamp(28px,3.5vw,42px);font-weight:700;line-height:1.2;color:#111;margin-bottom:16px;">
      [[HEADLINE_PART1]] <span style="color:#1DB954;">[[HEADLINE_HIGHLIGHT]]</span> [[HEADLINE_PART2]]
    </h1>
    <p style="font-size:15px;font-weight:400;line-height:1.65;color:#555;max-width:480px;margin-bottom:32px;">
      [[SUBTITLE_TEXT]]
    </p>
    <!-- Form card -->
    <div style="background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);padding:28px;border:1px solid rgba(0,0,0,0.04);">
      <div style="font-size:16px;font-weight:700;color:#111;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #f0f0f0;">[[FORM_TITLE]]</div>
      <form>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:500;color:#333;margin-bottom:6px;">Nome completo <span style="color:#CC0000;">*</span></label>
          <input type="text" placeholder="[[PLACEHOLDER_NOME]]" required style="width:100%;padding:12px 16px;border:1px solid #E0E0E0;border-radius:8px;font-family:'Montserrat',sans-serif;font-size:15px;color:#111;outline:none;">
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:500;color:#333;margin-bottom:6px;">E-mail <span style="color:#CC0000;">*</span></label>
          <input type="email" placeholder="[[PLACEHOLDER_EMAIL]]" required style="width:100%;padding:12px 16px;border:1px solid #E0E0E0;border-radius:8px;font-family:'Montserrat',sans-serif;font-size:15px;color:#111;outline:none;">
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:500;color:#333;margin-bottom:6px;">WhatsApp <span style="color:#CC0000;">*</span></label>
          <input type="tel" placeholder="[[PLACEHOLDER_WHATSAPP]]" required style="width:100%;padding:12px 16px;border:1px solid #E0E0E0;border-radius:8px;font-family:'Montserrat',sans-serif;font-size:15px;color:#111;outline:none;">
        </div>
        <div style="margin-bottom:16px;">
          <button type="submit" style="display:block;width:100%;padding:16px 24px;border:none;border-radius:100px;font-family:'Montserrat',sans-serif;font-size:15px;font-weight:700;text-transform:uppercase;color:#fff;cursor:pointer;background-image:linear-gradient(45deg,#158f3f,#1DB954,#158f3f,#1DB954);background-size:400% 200%;animation:brilho 3.4s infinite linear;">
            [[CTA_TEXT]]
          </button>
        </div>
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <input type="checkbox" required style="width:16px;height:16px;margin-top:1px;accent-color:#1DB954;">
          <label style="font-size:12px;color:#555;line-height:1.5;">[[PRIVACY_TEXT]]</label>
        </div>
      </form>
    </div>
  </div>
  <!-- Coluna direita -->
  <div style="position:relative;display:flex;align-items:flex-end;justify-content:center;background:linear-gradient(135deg,rgba(29,185,84,0.06) 0%,rgba(29,185,84,0.02) 40%,#fff 100%);overflow:hidden;">
    <!-- Substituir por <img src="foto.jpg" style="width:100%;height:100%;object-fit:cover;"> -->
    <div style="width:100%;height:100%;min-height:500px;background:linear-gradient(180deg,rgba(29,185,84,0.08) 0%,transparent 100%);display:flex;align-items:center;justify-content:center;">
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#ddd" stroke-width="1"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    </div>
    <!-- Cards flutuantes -->
    <div style="position:absolute;bottom:80px;left:20px;background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border-radius:10px;padding:12px 18px;box-shadow:0 8px 32px rgba(0,0,0,0.12);border:1px solid rgba(0,0,0,0.06);z-index:10;">
      <div style="font-size:22px;font-weight:800;color:#1DB954;line-height:1.1;">[[FLOAT_VALUE_1]]</div>
      <div style="font-size:11px;font-weight:500;color:#555;margin-top:2px;">[[FLOAT_LABEL_1]]</div>
    </div>
    <div style="position:absolute;top:100px;right:24px;background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border-radius:10px;padding:12px 18px;box-shadow:0 8px 32px rgba(0,0,0,0.12);border:1px solid rgba(0,0,0,0.06);z-index:10;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:8px;height:8px;border-radius:50%;background:#1DB954;animation:pulse-dot 2s infinite;"></div>
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#1DB954,#0f7a35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;">[[FLOAT_AVATAR]]</div>
        <div style="display:flex;flex-direction:column;">
          <span style="font-size:13px;font-weight:600;color:#111;">[[FLOAT_NAME]]</span>
          <span style="font-size:11px;color:#1DB954;font-weight:500;">[[FLOAT_ACTION]]</span>
        </div>
      </div>
    </div>
  </div>
  <style>@keyframes brilho{0%{background-position:0 0}100%{background-position:100% 0}}@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.7)}}</style>
</section>`,

  "form-card-captura": `<!-- FORMULARIO: Card branco com labels, asterisco, inputs estilizados -->
<div style="background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);padding:28px;border:1px solid rgba(0,0,0,0.04);max-width:480px;font-family:'Montserrat',sans-serif;">
  <div style="font-size:16px;font-weight:700;color:#111;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #f0f0f0;">[[FORM_TITLE]]</div>
  <form>
    <div style="margin-bottom:16px;">
      <label style="display:block;font-size:13px;font-weight:500;color:#333;margin-bottom:6px;">[[LABEL_1]] <span style="color:#CC0000;">*</span></label>
      <input type="text" placeholder="[[PLACEHOLDER_1]]" required style="width:100%;padding:12px 16px;border:1px solid #E0E0E0;border-radius:8px;font-family:inherit;font-size:15px;color:#111;outline:none;">
    </div>
    <div style="margin-bottom:16px;">
      <label style="display:block;font-size:13px;font-weight:500;color:#333;margin-bottom:6px;">[[LABEL_2]] <span style="color:#CC0000;">*</span></label>
      <input type="email" placeholder="[[PLACEHOLDER_2]]" required style="width:100%;padding:12px 16px;border:1px solid #E0E0E0;border-radius:8px;font-family:inherit;font-size:15px;color:#111;outline:none;">
    </div>
    <div style="margin-bottom:16px;">
      <label style="display:block;font-size:13px;font-weight:500;color:#333;margin-bottom:6px;">[[LABEL_3]] <span style="color:#CC0000;">*</span></label>
      <input type="tel" placeholder="[[PLACEHOLDER_3]]" required style="width:100%;padding:12px 16px;border:1px solid #E0E0E0;border-radius:8px;font-family:inherit;font-size:15px;color:#111;outline:none;">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      <div>
        <label style="display:block;font-size:13px;font-weight:500;color:#333;margin-bottom:6px;">[[LABEL_4]] <span style="color:#CC0000;">*</span></label>
        <input type="date" required style="width:100%;padding:12px 16px;border:1px solid #E0E0E0;border-radius:8px;font-family:inherit;font-size:15px;color:#111;outline:none;">
      </div>
      <div>
        <label style="display:block;font-size:13px;font-weight:500;color:#333;margin-bottom:6px;">[[LABEL_5]] <span style="color:#CC0000;">*</span></label>
        <select required style="width:100%;padding:12px 16px;border:1px solid #E0E0E0;border-radius:8px;font-family:inherit;font-size:15px;color:#111;outline:none;appearance:none;background-image:url('data:image/svg+xml,%3Csvg width=%2712%27 height=%277%27 viewBox=%270 0 12 7%27 fill=%27none%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cpath d=%27M1 1L6 6L11 1%27 stroke=%27%23999%27 stroke-width=%271.5%27 stroke-linecap=%27round%27/%3E%3C/svg%3E');background-repeat:no-repeat;background-position:right 16px center;cursor:pointer;">
          <option value="" disabled selected>Selecione</option>
          <option>[[OPTION_1]]</option>
          <option>[[OPTION_2]]</option>
          <option>[[OPTION_3]]</option>
        </select>
      </div>
    </div>
    <div style="margin-bottom:8px;">
      <button type="submit" style="display:block;width:100%;padding:16px 24px;border:none;border-radius:100px;font-family:inherit;font-size:15px;font-weight:700;text-transform:uppercase;color:#fff;cursor:pointer;background-image:linear-gradient(45deg,#158f3f,#1DB954,#158f3f,#1DB954);background-size:400% 200%;animation:brilho 3.4s infinite linear;transition:box-shadow 0.3s,transform 0.3s;">
        [[CTA_TEXT]]
      </button>
    </div>
    <div style="display:flex;align-items:flex-start;gap:8px;margin-top:6px;">
      <input type="checkbox" required style="width:16px;height:16px;margin-top:1px;accent-color:#1DB954;">
      <label style="font-size:12px;color:#555;line-height:1.5;">[[PRIVACY_TEXT]]</label>
    </div>
  </form>
  <style>@keyframes brilho{0%{background-position:0 0}100%{background-position:100% 0}}</style>
</div>`,

  "btn-cta-green-pulse": `<!-- BOTAO: CTA Verde com gradiente animado (estilo Conversao Extrema) -->
<button type="submit" style="display:block;width:100%;max-width:440px;padding:16px 24px;border:none;border-radius:100px;font-family:'Montserrat',sans-serif;font-size:15px;font-weight:700;text-transform:uppercase;color:#fff;cursor:pointer;background-image:linear-gradient(45deg,#158f3f,#1DB954,#158f3f,#1DB954);background-size:400% 200%;animation:brilho 3.4s infinite linear;transition:box-shadow 0.3s,transform 0.3s;position:relative;overflow:hidden;">
  [[CTA_TEXT]]
</button>
<style>
@keyframes brilho{0%{background-position:0 0}100%{background-position:100% 0}}
button:hover{box-shadow:0 0 24px rgba(29,185,84,0.5);transform:scale(1.02);}
</style>`,

  "float-cards-social-proof": `<!-- CARDS FLUTUANTES: Resultado + prova social (position absolute sobre foto) -->
<!-- Card 1 — Resultado financeiro -->
<div style="position:absolute;bottom:80px;left:20px;background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border-radius:10px;padding:12px 18px;box-shadow:0 8px 32px rgba(0,0,0,0.12);border:1px solid rgba(0,0,0,0.06);z-index:10;font-family:'Montserrat',sans-serif;">
  <div style="font-size:22px;font-weight:800;color:#1DB954;line-height:1.1;">[[VALUE]]</div>
  <div style="font-size:11px;font-weight:500;color:#555;margin-top:2px;">[[VALUE_LABEL]]</div>
</div>
<!-- Card 2 — Inscricao recente -->
<div style="position:absolute;top:100px;right:24px;background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border-radius:10px;padding:12px 18px;box-shadow:0 8px 32px rgba(0,0,0,0.12);border:1px solid rgba(0,0,0,0.06);z-index:10;font-family:'Montserrat',sans-serif;">
  <div style="display:flex;align-items:center;gap:10px;">
    <div style="width:8px;height:8px;border-radius:50%;background:#1DB954;animation:pulse-dot 2s infinite;"></div>
    <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#1DB954,#0f7a35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;">[[AVATAR]]</div>
    <div style="display:flex;flex-direction:column;">
      <span style="font-size:13px;font-weight:600;color:#111;">[[NAME]]</span>
      <span style="font-size:11px;color:#1DB954;font-weight:500;">[[ACTION]]</span>
    </div>
  </div>
</div>
<!-- Card 3 — Total alunos -->
<div style="position:absolute;bottom:180px;right:20px;background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border-radius:10px;padding:12px 18px;box-shadow:0 8px 32px rgba(0,0,0,0.12);border:1px solid rgba(0,0,0,0.06);z-index:10;font-family:'Montserrat',sans-serif;">
  <div style="display:flex;align-items:center;gap:10px;">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1DB954" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    <div style="display:flex;flex-direction:column;">
      <span style="font-size:13px;font-weight:600;color:#111;">[[TOTAL_LABEL]]</span>
      <span style="font-size:11px;color:#1DB954;font-weight:500;">[[TOTAL_SUB]]</span>
    </div>
  </div>
</div>
<style>@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.7)}}</style>`,

  "thanks-page-dark": `<!-- PAGINA OBRIGADO: Dark com progresso e CTA WhatsApp -->
<div style="position:fixed;inset:0;z-index:99999;background:#0D0D0D;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;letter-spacing:-0.02em;">
  <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(29,185,84,0.08) 0%,transparent 50%);"></div>
  <div style="position:relative;z-index:1;max-width:560px;width:100%;padding:40px 24px;text-align:center;">
    <!-- Badge -->
    <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(29,185,84,0.12);border:1px solid rgba(29,185,84,0.2);border-radius:100px;padding:8px 20px;margin-bottom:32px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1DB954" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      <span style="font-size:13px;font-weight:600;color:#1DB954;text-transform:uppercase;letter-spacing:0.04em;">[[BADGE_TEXT]]</span>
    </div>
    <!-- Headline -->
    <h1 style="font-size:clamp(26px,4vw,36px);font-weight:700;color:#fff;line-height:1.25;margin-bottom:12px;">
      [[THANKS_HEADLINE_PRE]] <span style="color:#1DB954;">[[THANKS_HIGHLIGHT]]</span> [[THANKS_HEADLINE_POST]]
    </h1>
    <p style="font-size:15px;color:rgba(255,255,255,0.5);line-height:1.6;margin-bottom:40px;">[[THANKS_SUBTITLE]]</p>
    <!-- Progress -->
    <div style="margin-bottom:40px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-size:13px;font-weight:500;color:rgba(255,255,255,0.4);">[[PROGRESS_LABEL]]</span>
        <span style="font-size:14px;font-weight:700;color:#1DB954;">[[PROGRESS_PCT]]</span>
      </div>
      <div style="width:100%;height:12px;background:#333;border-radius:100px;overflow:hidden;">
        <div style="height:100%;width:33%;background:linear-gradient(90deg,#158f3f,#1DB954);border-radius:100px;"></div>
      </div>
    </div>
    <!-- Card step -->
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:36px 32px;text-align:center;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#1DB954;color:#fff;font-size:16px;font-weight:800;margin-bottom:16px;">[[STEP_NUMBER]]</div>
      <h3 style="font-size:18px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.02em;margin-bottom:12px;">[[STEP_TITLE]]</h3>
      <p style="font-size:14px;color:rgba(255,255,255,0.5);line-height:1.65;margin-bottom:24px;max-width:400px;margin-left:auto;margin-right:auto;">[[STEP_DESCRIPTION]]</p>
      <a href="#" style="display:inline-flex;align-items:center;gap:8px;padding:14px 32px;background:#1DB954;color:#fff;font-family:inherit;font-size:14px;font-weight:700;text-transform:uppercase;border:none;border-radius:100px;cursor:pointer;text-decoration:none;transition:background 0.2s,box-shadow 0.2s;">
        [[STEP_CTA_TEXT]]
      </a>
    </div>
  </div>
</div>`,

  "footer-legal-minimal": `<!-- FOOTER: Legal minimalista para captura -->
<footer style="text-align:center;padding:24px 20px;border-top:1px solid #f0f0f0;font-family:'Montserrat',sans-serif;">
  <p style="font-size:12px;color:#999;line-height:1.6;">Ao clicar, voce concorda com os <a href="#" style="color:#555;text-decoration:underline;">Termos de Uso</a> e <a href="#" style="color:#555;text-decoration:underline;">Politica de Privacidade</a>.<br>[[COMPANY_NAME]] &mdash; CNPJ: [[CNPJ]]</p>
</footer>`,
};
