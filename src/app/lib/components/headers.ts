export const HEADERS = {
  "header-clean": `<!-- HEADER: Clean White -->
<header class="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/80 transition-all">
  <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
    <a href="#" class="font-heading text-xl font-bold tracking-tight text-gray-900">[[BRAND]]</a>
    <nav class="hidden md:flex items-center gap-8">
      <a href="#features" class="text-sm text-gray-500 hover:text-gray-900 transition-colors">Recursos</a>
      <a href="#testimonials" class="text-sm text-gray-500 hover:text-gray-900 transition-colors">Depoimentos</a>
      <a href="#pricing" class="text-sm text-gray-500 hover:text-gray-900 transition-colors">Preços</a>
      <a href="#faq" class="text-sm text-gray-500 hover:text-gray-900 transition-colors">FAQ</a>
    </nav>
    <a href="#cta" class="btn bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-gray-800 hover:shadow-lg hover:shadow-gray-900/10 transition-all">
      [[CTA_TEXT]] <span class="ml-1">→</span>
    </a>
  </div>
</header>`,

  "header-dark": `<!-- HEADER: Dark Premium -->
<header class="fixed top-0 w-full z-50 bg-gray-950/80 backdrop-blur-xl border-b border-white/[0.06] transition-all">
  <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
    <a href="#" class="font-heading text-xl font-bold tracking-tight text-white">[[BRAND]]</a>
    <nav class="hidden md:flex items-center gap-8">
      <a href="#features" class="text-sm text-gray-400 hover:text-white transition-colors">Recursos</a>
      <a href="#testimonials" class="text-sm text-gray-400 hover:text-white transition-colors">Depoimentos</a>
      <a href="#pricing" class="text-sm text-gray-400 hover:text-white transition-colors">Preços</a>
    </nav>
    <a href="#cta" class="btn bg-white text-gray-900 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-gray-100 transition-all">
      [[CTA_TEXT]] →
    </a>
  </div>
</header>`,

  "header-transparent": `<!-- HEADER: Transparent (for hero with bg image) -->
<header class="absolute top-0 w-full z-50">
  <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
    <a href="#" class="font-heading text-xl font-bold tracking-tight text-white">[[BRAND]]</a>
    <nav class="hidden md:flex items-center gap-8">
      <a href="#" class="text-sm text-white/70 hover:text-white transition-colors">Sobre</a>
      <a href="#" class="text-sm text-white/70 hover:text-white transition-colors">Método</a>
      <a href="#" class="text-sm text-white/70 hover:text-white transition-colors">Contato</a>
    </nav>
    <a href="#cta" class="btn border border-white/30 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-white hover:text-gray-900 transition-all">
      [[CTA_TEXT]]
    </a>
  </div>
</header>`,
};
