export const BASE_CSS = `
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
<style>
:root{--bg-primary:#0C0C0C;--bg-surface:#161616;--bg-card:#1E1E1E;--text-primary:#F5F5F5;--text-secondary:#999;--text-muted:#666;--accent:#FF5C00;--accent-hover:#E04E00;--accent-glow:rgba(255,92,0,0.35);--highlight:#FFCC00;--success:#22C55E;--border:rgba(255,255,255,0.08);--border-hover:rgba(255,92,0,0.3);--font-display:'Montserrat',sans-serif;--font-body:'DM Sans',sans-serif;--text-hero:clamp(26px,3.5vw,45px);--text-h2:clamp(22px,3vw,32px);--text-h3:18px;--text-body:16px;--text-small:13px;--text-cta:16px;--section-y:clamp(56px,8vw,96px);--container:1100px;--card-pad:28px;--gap-cards:20px;--radius-card:12px;--radius-btn:6px;--radius-badge:20px;--shadow-cta:0 0 32px rgba(255,92,0,0.4);--transition:all 0.2s ease}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--font-body);background:var(--bg-primary);color:var(--text-primary);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;line-height:1.6;overflow-x:hidden}
.container{max-width:var(--container);margin:0 auto;padding:0 80px}
@media(max-width:768px){.container{padding:0 20px}}
.section{padding:var(--section-y) 0}
.section-alt{background:var(--bg-surface)}
h1,.h1{font-family:var(--font-display);font-size:var(--text-hero);font-weight:700;line-height:1.1;letter-spacing:-0.02em;color:var(--text-primary)}
h2,.h2{font-family:var(--font-display);font-size:var(--text-h2);font-weight:600;line-height:1.2;color:var(--text-primary)}
h3,.h3{font-family:var(--font-body);font-size:var(--text-h3);font-weight:600;line-height:1.35;color:var(--text-primary)}
@media(max-width:768px){h1,.h1{font-size:32px}h2,.h2{font-size:22px}}
p{font-size:var(--text-body);line-height:1.7;color:var(--text-secondary)}
.badge{display:inline-flex;align-items:center;gap:8px;padding:4px 12px;border-radius:var(--radius-badge);background:rgba(255,92,0,0.12);border:1px solid rgba(255,92,0,0.2);font-size:12px;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:0.06em}
.badge-highlight{background:rgba(255,204,0,0.12);border-color:rgba(255,204,0,0.2);color:var(--highlight)}
.btn-cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--accent);color:#fff;font-family:var(--font-body);font-size:var(--text-cta);font-weight:700;text-transform:uppercase;letter-spacing:0.06em;text-decoration:none;padding:16px 36px;border-radius:var(--radius-btn);border:none;min-height:52px;cursor:pointer;transition:var(--transition)}
.btn-cta:hover{background:var(--accent-hover);box-shadow:var(--shadow-cta);transform:translateY(-2px)}
@media(max-width:768px){.btn-cta{width:100%}}
.btn-sec{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid rgba(255,255,255,0.2);background:transparent;color:var(--text-primary);font-family:var(--font-body);font-size:14px;font-weight:500;text-decoration:none;padding:12px 28px;border-radius:var(--radius-btn);cursor:pointer;transition:var(--transition)}
.btn-sec:hover{background:rgba(255,255,255,0.05)}
.card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-card);padding:var(--card-pad);transition:var(--transition)}
.card:hover{border-color:var(--border-hover);transform:translateY(-2px)}
.check{width:20px;height:20px;border-radius:50%;background:rgba(34,197,94,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.check svg{width:12px;height:12px;color:var(--success)}
.reveal{opacity:0;transform:translateY(24px);transition:opacity 0.6s cubic-bezier(0.16,1,0.3,1),transform 0.6s cubic-bezier(0.16,1,0.3,1)}
.reveal.is-visible{opacity:1;transform:translateY(0)}
.rd1{transition-delay:.08s}.rd2{transition-delay:.16s}.rd3{transition-delay:.24s}.rd4{transition-delay:.32s}.rd5{transition-delay:.4s}
</style>`;

export const BASE_SCRIPT = `
<script id="__wf_base_script">
(function(){
  if(window.__wfBaseScriptLoaded)return;window.__wfBaseScriptLoaded=true;
  const o=new IntersectionObserver(e=>{e.forEach(e=>{e.isIntersecting&&(e.target.classList.add('is-visible'),o.unobserve(e.target))})},{threshold:0.08,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.reveal').forEach(e=>o.observe(e));
})();
</script>`;
