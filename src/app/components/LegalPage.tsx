import Link from "next/link";
import { LEGAL } from "../lib/legal";

/** Estrutura das páginas legais públicas: leitura simples, sem a casca do app. */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0e] text-white/80" style={{ fontFamily: "var(--font-sora), system-ui, sans-serif" }}>
      <header className="border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <Link href="/" className="text-[15px] font-semibold text-white tracking-tight">{LEGAL.product}</Link>
          <nav className="flex items-center gap-4 text-[12px] text-white/45">
            <Link href="/privacidade" className="hover:text-white/80 transition-colors">Privacidade</Link>
            <Link href="/termos" className="hover:text-white/80 transition-colors">Termos</Link>
            <Link href="/exclusao-de-dados" className="hover:text-white/80 transition-colors">Exclusão de dados</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-[28px] font-semibold text-white tracking-tight">{title}</h1>
        <p className="mt-2 text-[12px] text-white/35">Última atualização: {LEGAL.updatedAt}</p>
        <p className="mt-6 text-[14px] leading-relaxed text-white/65">{intro}</p>
        <div className="mt-8 space-y-8 text-[14px] leading-relaxed text-white/65 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_a]:text-purple-300 [&_a:hover]:text-purple-200 [&_strong]:text-white/85">
          {children}
        </div>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 py-6 text-[12px] text-white/30">
          {LEGAL.product} · {LEGAL.site.replace("https://", "")} · Contato: <a href={`mailto:${LEGAL.contactEmail}`} className="text-white/50 hover:text-white/80">{LEGAL.contactEmail}</a>
        </div>
      </footer>
    </div>
  );
}
