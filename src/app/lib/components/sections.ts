export const SECTIONS = {
  "features-grid": `<!-- FEATURES: Grid com ícones -->
<section id="features" class="py-24 md:py-32 bg-gray-50">
  <div class="max-w-7xl mx-auto px-6">
    <div class="text-center mb-16 reveal">
      <span class="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3 block">Recursos</span>
      <h2 class="font-heading text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">[[HEADLINE]]</h2>
      <p class="text-gray-500 mt-4 max-w-2xl mx-auto">[[SUBTITLE]]</p>
    </div>
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div class="reveal reveal-d1 hover-lift bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl group transition-all">
        <div class="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-5 group-hover:bg-emerald-100 transition-colors">
          <svg class="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
        </div>
        <h3 class="font-heading text-lg font-semibold text-gray-900 mb-2">[[F1_TITLE]]</h3>
        <p class="text-sm text-gray-500 leading-relaxed">[[F1_DESC]]</p>
      </div>
      <div class="reveal reveal-d2 hover-lift bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl group transition-all">
        <div class="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5 group-hover:bg-blue-100 transition-colors">
          <svg class="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
        </div>
        <h3 class="font-heading text-lg font-semibold text-gray-900 mb-2">[[F2_TITLE]]</h3>
        <p class="text-sm text-gray-500 leading-relaxed">[[F2_DESC]]</p>
      </div>
      <div class="reveal reveal-d3 hover-lift bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl group transition-all">
        <div class="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mb-5 group-hover:bg-purple-100 transition-colors">
          <svg class="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
        </div>
        <h3 class="font-heading text-lg font-semibold text-gray-900 mb-2">[[F3_TITLE]]</h3>
        <p class="text-sm text-gray-500 leading-relaxed">[[F3_DESC]]</p>
      </div>
    </div>
  </div>
</section>`,

  "testimonials-cards": `<!-- TESTIMONIALS: Cards Premium -->
<section id="testimonials" class="py-24 md:py-32 bg-white">
  <div class="max-w-7xl mx-auto px-6">
    <div class="text-center mb-16 reveal">
      <span class="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-3 block">Depoimentos</span>
      <h2 class="font-heading text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">[[HEADLINE]]</h2>
    </div>
    <div class="grid md:grid-cols-3 gap-6">
      <div class="reveal reveal-d1 hover-lift p-8 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all">
        <div class="flex gap-1 mb-5 text-amber-400 text-sm">★★★★★</div>
        <p class="text-gray-600 leading-relaxed mb-6">"[[T1_TEXT]]"</p>
        <div class="flex items-center gap-3 pt-5 border-t border-gray-100">
          <div class="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-white font-bold text-sm">[[T1_INITIALS]]</div>
          <div><div class="text-sm font-semibold text-gray-900">[[T1_NAME]]</div><div class="text-xs text-gray-400">[[T1_ROLE]]</div></div>
        </div>
      </div>
      <div class="reveal reveal-d2 hover-lift p-8 rounded-2xl bg-white border-2 border-gray-900 shadow-xl transition-all -translate-y-2">
        <div class="flex gap-1 mb-5 text-amber-400 text-sm">★★★★★</div>
        <p class="text-gray-600 leading-relaxed mb-6">"[[T2_TEXT]]"</p>
        <div class="flex items-center gap-3 pt-5 border-t border-gray-100">
          <div class="w-11 h-11 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm">[[T2_INITIALS]]</div>
          <div><div class="text-sm font-semibold text-gray-900">[[T2_NAME]]</div><div class="text-xs text-gray-400">[[T2_ROLE]]</div></div>
        </div>
      </div>
      <div class="reveal reveal-d3 hover-lift p-8 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all">
        <div class="flex gap-1 mb-5 text-amber-400 text-sm">★★★★★</div>
        <p class="text-gray-600 leading-relaxed mb-6">"[[T3_TEXT]]"</p>
        <div class="flex items-center gap-3 pt-5 border-t border-gray-100">
          <div class="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-indigo-400 flex items-center justify-center text-white font-bold text-sm">[[T3_INITIALS]]</div>
          <div><div class="text-sm font-semibold text-gray-900">[[T3_NAME]]</div><div class="text-xs text-gray-400">[[T3_ROLE]]</div></div>
        </div>
      </div>
    </div>
  </div>
</section>`,

  "pricing-3col": `<!-- PRICING: 3 Planos -->
<section id="pricing" class="py-24 md:py-32 bg-gray-50">
  <div class="max-w-7xl mx-auto px-6">
    <div class="text-center mb-16 reveal">
      <span class="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3 block">Preços</span>
      <h2 class="font-heading text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">[[HEADLINE]]</h2>
      <p class="text-gray-500 mt-4">[[SUBTITLE]]</p>
    </div>
    <div class="grid md:grid-cols-3 gap-6 items-start max-w-5xl mx-auto">
      <div class="reveal reveal-d1 hover-lift bg-white rounded-2xl border border-gray-200 p-8 transition-all">
        <div class="text-sm font-semibold text-gray-400 mb-4">[[P1_NAME]]</div>
        <div class="flex items-baseline gap-1 mb-2"><span class="font-heading text-4xl font-bold text-gray-900">R$[[P1_PRICE]]</span><span class="text-gray-400 text-sm">/mês</span></div>
        <p class="text-sm text-gray-500 mb-8">[[P1_DESC]]</p>
        <ul class="space-y-3 mb-8">
          <li class="flex items-center gap-3 text-sm text-gray-600"><svg class="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>[[P1_F1]]</li>
          <li class="flex items-center gap-3 text-sm text-gray-600"><svg class="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>[[P1_F2]]</li>
          <li class="flex items-center gap-3 text-sm text-gray-600"><svg class="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>[[P1_F3]]</li>
        </ul>
        <a href="#" class="btn w-full bg-gray-100 text-gray-900 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">Começar</a>
      </div>
      <div class="reveal reveal-d2 hover-lift bg-gray-900 rounded-2xl p-8 shadow-2xl shadow-gray-900/20 -translate-y-4 transition-all relative">
        <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold">Mais popular</div>
        <div class="text-sm font-semibold text-gray-400 mb-4">[[P2_NAME]]</div>
        <div class="flex items-baseline gap-1 mb-2"><span class="font-heading text-4xl font-bold text-white">R$[[P2_PRICE]]</span><span class="text-gray-400 text-sm">/mês</span></div>
        <p class="text-sm text-gray-400 mb-8">[[P2_DESC]]</p>
        <ul class="space-y-3 mb-8">
          <li class="flex items-center gap-3 text-sm text-gray-300"><svg class="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>[[P2_F1]]</li>
          <li class="flex items-center gap-3 text-sm text-gray-300"><svg class="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>[[P2_F2]]</li>
          <li class="flex items-center gap-3 text-sm text-gray-300"><svg class="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>[[P2_F3]]</li>
          <li class="flex items-center gap-3 text-sm text-gray-300"><svg class="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>[[P2_F4]]</li>
        </ul>
        <a href="#" class="btn w-full bg-emerald-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20 transition-all">Assinar agora</a>
      </div>
      <div class="reveal reveal-d3 hover-lift bg-white rounded-2xl border border-gray-200 p-8 transition-all">
        <div class="text-sm font-semibold text-gray-400 mb-4">[[P3_NAME]]</div>
        <div class="flex items-baseline gap-1 mb-2"><span class="font-heading text-4xl font-bold text-gray-900">R$[[P3_PRICE]]</span><span class="text-gray-400 text-sm">/mês</span></div>
        <p class="text-sm text-gray-500 mb-8">[[P3_DESC]]</p>
        <ul class="space-y-3 mb-8">
          <li class="flex items-center gap-3 text-sm text-gray-600"><svg class="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>[[P3_F1]]</li>
          <li class="flex items-center gap-3 text-sm text-gray-600"><svg class="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>[[P3_F2]]</li>
          <li class="flex items-center gap-3 text-sm text-gray-600"><svg class="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>[[P3_F3]]</li>
          <li class="flex items-center gap-3 text-sm text-gray-600"><svg class="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>[[P3_F4]]</li>
          <li class="flex items-center gap-3 text-sm text-gray-600"><svg class="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>[[P3_F5]]</li>
        </ul>
        <a href="#" class="btn w-full bg-gray-100 text-gray-900 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">Começar</a>
      </div>
    </div>
  </div>
</section>`,

  "stats-bar": `<!-- STATS: Social Proof Bar -->
<section class="py-16 md:py-20 bg-white border-y border-gray-100">
  <div class="max-w-7xl mx-auto px-6">
    <div class="flex flex-wrap justify-center gap-12 md:gap-20 lg:gap-28">
      <div class="reveal text-center"><div class="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-1">[[S1_NUM]]</div><div class="text-sm text-gray-400">[[S1_LABEL]]</div></div>
      <div class="reveal reveal-d1 text-center"><div class="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-1">[[S2_NUM]]</div><div class="text-sm text-gray-400">[[S2_LABEL]]</div></div>
      <div class="reveal reveal-d2 text-center"><div class="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-1">[[S3_NUM]]</div><div class="text-sm text-gray-400">[[S3_LABEL]]</div></div>
      <div class="reveal reveal-d3 text-center"><div class="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-1">[[S4_NUM]]</div><div class="text-sm text-gray-400">[[S4_LABEL]]</div></div>
    </div>
  </div>
</section>`,

  "cta-dark": `<!-- CTA: Dark with urgency -->
<section id="cta" class="py-24 md:py-32 bg-gray-900 relative overflow-hidden">
  <div class="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(99,102,241,0.08),transparent_70%)]"></div>
  <div class="max-w-3xl mx-auto px-6 text-center relative">
    <h2 class="reveal font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-6">[[HEADLINE]]</h2>
    <p class="reveal reveal-d1 text-lg text-gray-400 mb-10 max-w-xl mx-auto">[[SUBTITLE]]</p>
    <a href="#" class="reveal reveal-d2 btn bg-white text-gray-900 px-10 py-4 rounded-full text-base font-semibold hover:shadow-xl hover:shadow-white/10 hover:-translate-y-0.5 transition-all inline-flex">
      [[CTA_TEXT]] →
    </a>
    <p class="reveal reveal-d3 text-sm text-gray-500 mt-6">[[GUARANTEE]]</p>
  </div>
</section>`,

  "footer-full": `<!-- FOOTER: Full -->
<footer class="bg-gray-950 pt-16 pb-8">
  <div class="max-w-7xl mx-auto px-6">
    <div class="grid md:grid-cols-4 gap-12 mb-12">
      <div>
        <span class="font-heading text-lg font-bold text-white mb-4 block">[[BRAND]]</span>
        <p class="text-sm text-gray-500 leading-relaxed mb-6">[[BRAND_DESC]]</p>
        <div class="flex gap-4 text-gray-500">
          <a href="#" class="hover:text-white transition-colors"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg></a>
          <a href="#" class="hover:text-white transition-colors"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg></a>
        </div>
      </div>
      <div><h4 class="text-sm font-semibold text-white mb-4">Produto</h4><ul class="space-y-3 text-sm text-gray-500"><li><a href="#" class="hover:text-white transition-colors">Features</a></li><li><a href="#" class="hover:text-white transition-colors">Preços</a></li><li><a href="#" class="hover:text-white transition-colors">API</a></li><li><a href="#" class="hover:text-white transition-colors">Changelog</a></li></ul></div>
      <div><h4 class="text-sm font-semibold text-white mb-4">Empresa</h4><ul class="space-y-3 text-sm text-gray-500"><li><a href="#" class="hover:text-white transition-colors">Sobre</a></li><li><a href="#" class="hover:text-white transition-colors">Blog</a></li><li><a href="#" class="hover:text-white transition-colors">Carreiras</a></li><li><a href="#" class="hover:text-white transition-colors">Contato</a></li></ul></div>
      <div><h4 class="text-sm font-semibold text-white mb-4">Legal</h4><ul class="space-y-3 text-sm text-gray-500"><li><a href="#" class="hover:text-white transition-colors">Termos de Uso</a></li><li><a href="#" class="hover:text-white transition-colors">Privacidade</a></li><li><a href="#" class="hover:text-white transition-colors">Cookies</a></li></ul></div>
    </div>
    <div class="border-t border-gray-800 pt-8 text-center text-xs text-gray-600">
      © 2026 [[BRAND]]. Todos os direitos reservados.
    </div>
  </div>
</footer>`,
};
