// Componentes específicos para páginas de lançamento digital brasileiro
// Estilo: Mentoria Mentoria Impacto 360, Modo Foco Total, Marina Costa

export const LANCAMENTO = {
  "urgency-bar": `<!-- BARRA DE URGÊNCIA com countdown -->
<div class="w-full bg-red-600 py-2.5 px-4 text-center relative overflow-hidden">
  <div class="absolute inset-0 bg-gradient-to-r from-red-700 via-red-600 to-red-700"></div>
  <div class="relative flex items-center justify-center gap-3 flex-wrap">
    <span class="text-white text-xs md:text-sm font-semibold uppercase tracking-wide">[[URGENCY_TEXT]]</span>
    <div class="flex items-center gap-2">
      <div class="bg-white/20 backdrop-blur rounded-lg px-2.5 py-1 text-center min-w-[40px]">
        <div class="text-white text-sm md:text-base font-bold leading-none">01</div>
        <div class="text-white/60 text-[8px] uppercase mt-0.5">dias</div>
      </div>
      <span class="text-white/40 text-xs">:</span>
      <div class="bg-white/20 backdrop-blur rounded-lg px-2.5 py-1 text-center min-w-[40px]">
        <div class="text-white text-sm md:text-base font-bold leading-none">14</div>
        <div class="text-white/60 text-[8px] uppercase mt-0.5">hrs</div>
      </div>
      <span class="text-white/40 text-xs">:</span>
      <div class="bg-white/20 backdrop-blur rounded-lg px-2.5 py-1 text-center min-w-[40px]">
        <div class="text-white text-sm md:text-base font-bold leading-none">42</div>
        <div class="text-white/60 text-[8px] uppercase mt-0.5">min</div>
      </div>
      <span class="text-white/40 text-xs">:</span>
      <div class="bg-white/20 backdrop-blur rounded-lg px-2.5 py-1 text-center min-w-[40px]">
        <div class="text-white text-sm md:text-base font-bold leading-none">08</div>
        <div class="text-white/60 text-[8px] uppercase mt-0.5">seg</div>
      </div>
    </div>
  </div>
</div>`,

  "hero-mentor-form": `<!-- HERO: Mentor com foto + formulário (estilo Mentoria Impacto 360) -->
<section class="relative min-h-screen bg-white overflow-hidden">
  <!-- Foto do mentor como background (lado direito) -->
  <div class="absolute right-0 top-0 bottom-0 w-full md:w-[55%]">
    <!-- Se o usuário enviou foto, use <img src="data:..." class="w-full h-full object-cover"> aqui -->
    <!-- Fallback: gradiente que simula profundidade -->
    <div class="w-full h-full bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400"></div>
    <!-- Overlay gradiente da esquerda -->
    <div class="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent"></div>
  </div>

  <div class="relative z-10 max-w-7xl mx-auto px-6 py-16 md:py-24 min-h-screen flex items-center">
    <div class="max-w-xl">
      <!-- Logo/Brand -->
      <div class="reveal mb-8">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <div>
            <div class="font-heading text-sm font-bold text-gray-900 leading-tight">[[BRAND_LINE1]]</div>
            <div class="font-heading text-sm font-bold text-emerald-600 leading-tight">[[BRAND_LINE2]]</div>
          </div>
        </div>
      </div>

      <!-- Headline -->
      <h1 class="reveal font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-[1.2] mb-4">
        <span class="text-emerald-600">[[HEADLINE_HIGHLIGHT]]</span> [[HEADLINE_REST]]
      </h1>
      <p class="reveal reveal-d1 text-sm md:text-base text-gray-500 leading-relaxed mb-8 max-w-md">
        [[SUBTITLE]]
      </p>

      <!-- Formulário -->
      <div class="reveal reveal-d2 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-100 p-6 md:p-8 max-w-md">
        <form class="space-y-4">
          <div>
            <label class="text-xs font-semibold text-gray-700 mb-1.5 block">E-mail *</label>
            <input type="email" placeholder="Seu melhor e-mail" class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all">
          </div>
          <div>
            <label class="text-xs font-semibold text-gray-700 mb-1.5 block">[[FIELD_LABEL]] *</label>
            <select class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M1%201L5%205L9%201%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22/%3E%3C/svg%3E')] bg-no-repeat bg-[center_right_1rem]">
              <option>Selecione</option>
              <option>[[OPTION_1]]</option>
              <option>[[OPTION_2]]</option>
              <option>[[OPTION_3]]</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-semibold text-gray-700 mb-1.5 block">WhatsApp com DDD *</label>
            <input type="tel" placeholder="Ex: 11 99000-0000" class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all">
          </div>
          <button type="submit" class="btn w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-4 rounded-xl text-sm font-bold uppercase tracking-wider hover:from-emerald-400 hover:to-emerald-500 hover:shadow-xl hover:shadow-emerald-500/25 transition-all mt-2">
            [[CTA_TEXT]]
          </button>
        </form>
      </div>
    </div>
  </div>
</section>`,

  "hero-dark-photo": `<!-- HERO: Fundo escuro com foto (estilo Modo Foco Total) -->
<section class="relative min-h-screen flex items-center overflow-hidden">
  <!-- Background foto -->
  <div class="absolute inset-0">
    <!-- Se o usuário enviou foto, use <img src="data:..." class="w-full h-full object-cover object-center"> aqui -->
    <div class="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"></div>
  </div>
  <!-- Overlay escuro com gradiente lateral -->
  <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/30"></div>
  <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20"></div>

  <div class="relative z-10 max-w-7xl mx-auto px-6 py-24 md:py-32">
    <div class="max-w-2xl">
      <!-- Logo decorativo -->
      <div class="reveal mb-10">
        <div class="font-heading text-xl md:text-2xl font-bold text-white/90 italic leading-tight">
          [[BRAND_NAME]]
        </div>
      </div>

      <!-- Headline -->
      <h1 class="reveal font-heading text-3xl md:text-4xl lg:text-[2.8rem] font-bold text-white leading-[1.25] mb-6">
        [[HEADLINE]]
      </h1>
      <p class="reveal reveal-d1 text-base md:text-lg text-white/50 leading-relaxed mb-10 max-w-lg">
        [[SUBTITLE]]
      </p>

      <!-- CTA -->
      <div class="reveal reveal-d2">
        <a href="#form" class="btn inline-flex bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-10 py-5 rounded-xl text-sm font-bold uppercase tracking-[0.08em] hover:from-emerald-400 hover:to-emerald-500 hover:shadow-2xl hover:shadow-emerald-500/30 transition-all">
          [[CTA_TEXT]]
        </a>
      </div>
    </div>
  </div>
</section>`,

  "social-proof-logos": `<!-- SOCIAL PROOF: Logos de parceiros/mídia -->
<section class="py-12 md:py-16 bg-gray-50 border-y border-gray-100">
  <div class="max-w-7xl mx-auto px-6">
    <p class="text-center text-xs text-gray-400 uppercase tracking-widest mb-8 font-medium">Visto em</p>
    <div class="flex flex-wrap items-center justify-center gap-10 md:gap-16 opacity-40 grayscale">
      <span class="font-heading text-xl font-bold text-gray-900">Forbes</span>
      <span class="font-heading text-xl font-bold text-gray-900">Exame</span>
      <span class="font-heading text-xl font-bold text-gray-900">Estadão</span>
      <span class="font-heading text-xl font-bold text-gray-900">Valor</span>
      <span class="font-heading text-xl font-bold text-gray-900">InfoMoney</span>
      <span class="font-heading text-xl font-bold text-gray-900">StartSe</span>
    </div>
  </div>
</section>`,

  "benefits-icons": `<!-- BENEFÍCIOS: Grid com ícones e descrições -->
<section class="py-24 md:py-32 bg-white">
  <div class="max-w-7xl mx-auto px-6">
    <div class="text-center mb-16 reveal">
      <span class="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3 block">Método</span>
      <h2 class="font-heading text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-4">[[HEADLINE]]</h2>
      <p class="text-gray-500 max-w-2xl mx-auto">[[SUBTITLE]]</p>
    </div>
    <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
      <div class="reveal reveal-d1 text-center group">
        <div class="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5 group-hover:bg-emerald-100 group-hover:scale-110 transition-all">
          <svg class="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5"/></svg>
        </div>
        <h3 class="font-heading text-base font-semibold text-gray-900 mb-2">[[B1_TITLE]]</h3>
        <p class="text-sm text-gray-500 leading-relaxed">[[B1_DESC]]</p>
      </div>
      <div class="reveal reveal-d2 text-center group">
        <div class="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-5 group-hover:bg-blue-100 group-hover:scale-110 transition-all">
          <svg class="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/></svg>
        </div>
        <h3 class="font-heading text-base font-semibold text-gray-900 mb-2">[[B2_TITLE]]</h3>
        <p class="text-sm text-gray-500 leading-relaxed">[[B2_DESC]]</p>
      </div>
      <div class="reveal reveal-d3 text-center group">
        <div class="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-5 group-hover:bg-purple-100 group-hover:scale-110 transition-all">
          <svg class="w-7 h-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"/></svg>
        </div>
        <h3 class="font-heading text-base font-semibold text-gray-900 mb-2">[[B3_TITLE]]</h3>
        <p class="text-sm text-gray-500 leading-relaxed">[[B3_DESC]]</p>
      </div>
      <div class="reveal reveal-d4 text-center group">
        <div class="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-5 group-hover:bg-amber-100 group-hover:scale-110 transition-all">
          <svg class="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.02 6.02 0 0 1-7.54 0"/></svg>
        </div>
        <h3 class="font-heading text-base font-semibold text-gray-900 mb-2">[[B4_TITLE]]</h3>
        <p class="text-sm text-gray-500 leading-relaxed">[[B4_DESC]]</p>
      </div>
    </div>
  </div>
</section>`,

  "guarantee-section": `<!-- GARANTIA -->
<section class="py-16 md:py-20 bg-gray-50">
  <div class="max-w-3xl mx-auto px-6 text-center reveal">
    <div class="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6 border-2 border-emerald-100">
      <svg class="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"/></svg>
    </div>
    <h3 class="font-heading text-2xl md:text-3xl font-bold text-gray-900 mb-4">[[GUARANTEE_HEADLINE]]</h3>
    <p class="text-gray-500 leading-relaxed max-w-xl mx-auto">[[GUARANTEE_TEXT]]</p>
  </div>
</section>`,
};
