"use client";

export function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full text-wf-text-muted">
      <div className="text-center max-w-md relative">
        {/* Animated gradient blob */}
        <div className="absolute inset-0 -z-10 flex items-center justify-center">
          <div className="w-64 h-64 rounded-full bg-gradient-to-br from-wf-primary/10 via-wf-accent/5 to-wf-primary/10 blur-3xl animate-spin-slow" />
        </div>

        {/* Logo mark */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-wf-primary to-wf-accent flex items-center justify-center text-3xl font-bold text-white mb-6 shadow-2xl shadow-wf-primary/20">
          W
        </div>

        <h2 className="text-xl font-semibold text-wf-text mb-2">
          Crie layouts incríveis com IA
        </h2>
        <p className="text-sm text-wf-text-muted mb-6 leading-relaxed">
          Descreva o que você precisa ou escolha um template pronto.
          <br />O código sai pronto para colar na sua plataforma.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {["Hero Sections", "Seções de Preço", "Captação de Leads", "E-commerce", "Landing Pages"].map(
            (feature) => (
              <span
                key={feature}
                className="px-3 py-1.5 rounded-full bg-wf-surface border border-wf-border text-xs text-wf-text-muted"
              >
                {feature}
              </span>
            )
          )}
        </div>

        {/* Arrow pointing to sidebar */}
        <div className="flex items-center justify-center gap-2 text-xs text-wf-primary animate-fade-in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-180">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
          Comece pelo painel ao lado
        </div>
      </div>
    </div>
  );
}
