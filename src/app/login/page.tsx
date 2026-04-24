"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password.length >= 6;
  const canSubmit = emailValid && passwordValid && !isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setAuthError(null);
    startTransition(async () => {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setAuthError(error.message); return; }
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) { setAuthError(error.message); return; }
      }
      router.push("/");
      router.refresh();
    });
  };

  const handleGoogle = () => {
    setAuthError(null);
    startTransition(async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setAuthError(error.message);
    });
  };

  return (
    <>
      <style>{css}</style>

      <main className="wf-login">
        {/* ─── aurora background (same gradient as post-login home) ─── */}
        <div className="wf-aurora" aria-hidden="true" />
        <div className="wf-vignette" aria-hidden="true" />

        {/* ═════════════════ LEFT — HERO ═════════════════ */}
        <section className="wf-hero">
          <div className="wf-hero-inner">
            <BrandMark />

            <h1 className="wf-hero-title">
              Bem-vindo de <span className="wf-accent-word">volta</span>
            </h1>

            <p className="wf-hero-sub">
              A plataforma de geração de landing pages com IA para
              infoprodutores, agências e criadores.
            </p>

            <div className="wf-dots" aria-hidden="true">
              <span className="wf-dot-line" />
              <span className="wf-dot" />
              <span className="wf-dot-line" />
            </div>
          </div>
        </section>

        {/* ═════════════════ RIGHT — FORM ═════════════════ */}
        <section className="wf-form-wrap">
          <div className="wf-form">
            <div className="wf-mobile-brand">
              <BrandMark small />
            </div>

            <div className="wf-head">
              <h2 className="wf-title">{mode === "login" ? "Acessar plataforma" : "Criar sua conta"}</h2>
              <p className="wf-sub">{mode === "login" ? "Entre com sua conta para continuar" : "Crie sua conta gratuitamente"}</p>
            </div>

            <button type="button" className="wf-btn-oauth" onClick={handleGoogle} disabled={isPending}>
              <GoogleIcon />
              <span>Continuar com Google</span>
            </button>

            <div className="wf-divider">
              <span className="wf-divider-line" />
              <span className="wf-divider-text">OU</span>
              <span className="wf-divider-line" />
            </div>

            <form onSubmit={handleSubmit} noValidate className="wf-fields">
              <div className="wf-field">
                <label htmlFor="email" className="wf-label">
                  EMAIL
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="wf-input"
                />
              </div>

              <div className="wf-field">
                <div className="wf-label-row">
                  <label htmlFor="password" className="wf-label">
                    SENHA
                  </label>
                  <a href="#" className="wf-link wf-link-sm">
                    Esqueci minha senha
                  </a>
                </div>
                <div className="wf-input-wrap">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="wf-input wf-input-pad"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="wf-eye"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {authError && (
                <p className="wf-auth-error">{authError}</p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className={`wf-btn-submit ${canSubmit ? "" : "is-disabled"}`}
              >
                {isPending ? (
                  <span className="wf-spinner" />
                ) : (
                  <>
                    <span>{mode === "login" ? "ENTRAR" : "CRIAR CONTA"}</span>
                    <ArrowRight size={16} strokeWidth={2.75} />
                  </>
                )}
              </button>
            </form>

            <p className="wf-meta">
              {mode === "login" ? "Não tem conta?" : "Já tem conta?"}{" "}
              <button
                type="button"
                className="wf-link wf-link-strong"
                onClick={() => { setMode(mode === "login" ? "signup" : "login"); setAuthError(null); }}
              >
                {mode === "login" ? "Criar conta grátis" : "Fazer login"}
              </button>
            </p>

            <div className="wf-safe">
              <span className="wf-safe-dot" />
              <span className="wf-safe-text">Conexão segura e criptografada</span>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function BrandMark({ small = false }: { small?: boolean }) {
  const height = small ? 20 : 28;
  return (
    <img
      src="/logowevy.svg"
      alt="WevyFlow"
      className="wf-brand"
      style={{ height, width: "auto", display: "block" }}
    />
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Scoped CSS — bypasses Tailwind generation + dark-form autofill
   ═══════════════════════════════════════════════════════════════ */
const css = `
  :root { color-scheme: dark; }

  .wf-login {
    position: relative;
    display: grid;
    grid-template-columns: 1fr;
    min-height: 100dvh;
    background: #09090b;
    color: #fafafa;
    font-family: var(--font-sora), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: -0.015em;
    overflow: hidden;
  }

  /* aurora — same gradient used on post-login home view */
  .wf-aurora {
    position: absolute;
    width: 140%;
    height: 140%;
    top: -20%;
    left: -20%;
    pointer-events: none;
    z-index: 0;
    background:
      radial-gradient(ellipse 60% 50% at 30% 60%, rgba(236, 72, 153, 0.45) 0%, transparent 70%),
      radial-gradient(ellipse 50% 60% at 70% 50%, rgba(139, 92, 246, 0.40) 0%, transparent 70%),
      radial-gradient(ellipse 60% 40% at 50% 40%, rgba(59, 130, 246, 0.35) 0%, transparent 70%),
      radial-gradient(ellipse 40% 50% at 20% 30%, rgba(249, 115, 22, 0.20) 0%, transparent 60%);
    filter: blur(60px) saturate(1.5);
    animation: wf-aurora-drift 15s ease-in-out infinite alternate;
  }
  .wf-vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background:
      radial-gradient(ellipse 80% 60% at 50% 100%, #09090b 0%, transparent 60%),
      radial-gradient(ellipse 80% 40% at 50% 0%, #09090b 0%, transparent 50%);
  }
  @keyframes wf-aurora-drift {
    0%   { transform: translate(0, 0) scale(1); }
    33%  { transform: translate(-3%, 2%) scale(1.02); }
    66%  { transform: translate(2%, -1%) scale(0.98); }
    100% { transform: translate(-1%, 3%) scale(1.01); }
  }

  @media (min-width: 1024px) {
    .wf-login { grid-template-columns: 1fr 1fr; }
    .wf-hero { display: flex !important; }
    .wf-mobile-brand { display: none !important; }
  }

  /* ─── HERO ─── */
  .wf-hero {
    display: none;
    position: relative;
    z-index: 1;
    align-items: center;
    justify-content: center;
    padding: 64px;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
  }
  .wf-hero-inner {
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 22px;
  }
  .wf-hero-title {
    margin: 0;
    font-size: clamp(28px, 2.8vw, 38px);
    line-height: 1.08;
    font-weight: 600;
    letter-spacing: -0.03em;
    color: #fafafa;
  }
  .wf-accent-word {
    background: linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font-weight: 600;
  }
  .wf-hero-sub {
    margin: 0;
    max-width: 320px;
    font-size: 13px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.6);
    font-weight: 400;
  }
  .wf-dots {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding-top: 12px;
  }
  .wf-dot-line {
    display: block;
    height: 2px;
    width: 34px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
  }
  .wf-dot {
    display: block;
    height: 8px;
    width: 8px;
    border-radius: 999px;
    background: #a78bfa;
    box-shadow: 0 0 14px rgba(167, 139, 250, 0.55);
  }

  /* ─── BRAND ─── */
  .wf-brand {
    user-select: none;
    -webkit-user-drag: none;
  }

  /* ─── FORM ─── */
  .wf-form-wrap {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 56px 24px;
  }
  .wf-form {
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .wf-mobile-brand {
    display: flex;
    justify-content: center;
    margin-bottom: 4px;
  }
  .wf-head { display: flex; flex-direction: column; gap: 6px; }
  .wf-title {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.2;
    color: #fafafa;
  }
  .wf-sub {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.55);
  }

  /* ─── Google button ─── */
  .wf-btn-oauth {
    width: 100%;
    height: 52px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 0 16px;
    border-radius: 14px;
    background: #141416;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #fafafa;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s, transform 0.2s;
  }
  .wf-btn-oauth:hover {
    background: #1b1b1e;
    border-color: rgba(255, 255, 255, 0.16);
  }
  .wf-btn-oauth:active { transform: scale(0.99); }

  /* ─── OU divider ─── */
  .wf-divider {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 2px 0;
  }
  .wf-divider-line {
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
  }
  .wf-divider-text {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.24em;
    color: rgba(255, 255, 255, 0.35);
  }

  /* ─── Fields ─── */
  .wf-fields { display: flex; flex-direction: column; gap: 18px; }
  .wf-field { display: flex; flex-direction: column; }
  .wf-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .wf-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.24em;
    color: rgba(255, 255, 255, 0.38);
    margin-bottom: 8px;
  }
  .wf-label-row .wf-label { margin-bottom: 0; }

  .wf-input-wrap { position: relative; }

  .wf-input {
    width: 100%;
    height: 52px;
    padding: 0 16px;
    border-radius: 14px;
    background: #141416;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #fafafa;
    font-size: 14px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
    appearance: none;
    -webkit-appearance: none;
  }
  .wf-input-pad { padding-right: 48px; }
  .wf-input::placeholder { color: rgba(255, 255, 255, 0.32); }
  .wf-input:hover:not(:focus) {
    border-color: rgba(255, 255, 255, 0.14);
    background: #1b1b1e;
  }
  .wf-input:focus {
    border-color: #a78bfa;
    background: #1b1b1e;
    box-shadow: 0 0 0 4px rgba(167, 139, 250, 0.14);
  }

  /* Kill Chrome autofill white */
  .wf-input:-webkit-autofill,
  .wf-input:-webkit-autofill:hover,
  .wf-input:-webkit-autofill:focus,
  .wf-input:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 1000px #0e0e12 inset !important;
    -webkit-text-fill-color: #fafafa !important;
    caret-color: #fafafa !important;
    transition: background-color 5000s ease-in-out 0s;
  }

  .wf-eye {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: 0;
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.42);
    cursor: pointer;
    transition: color 0.2s, background 0.2s;
  }
  .wf-eye:hover {
    color: #fafafa;
    background: rgba(255, 255, 255, 0.06);
  }

  /* ─── Submit ─── */
  .wf-btn-submit {
    position: relative;
    width: 100%;
    height: 56px;
    margin-top: 8px;
    padding: 0 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border-radius: 16px;
    border: 0;
    background: linear-gradient(to right, #a855f7 0%, #ec4899 100%);
    color: #ffffff;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    letter-spacing: 0.12em;
    cursor: pointer;
    overflow: hidden;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.18);
    transition: transform 0.2s, box-shadow 0.2s, filter 0.2s;
  }
  .wf-btn-submit:hover:not(.is-disabled) {
    filter: brightness(1.05);
    transform: translateY(-1px);
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.3),
      0 10px 28px rgba(168, 85, 247, 0.22),
      inset 0 1px 0 rgba(255, 255, 255, 0.22);
  }
  .wf-btn-submit:active:not(.is-disabled) {
    transform: translateY(0);
    filter: brightness(1);
  }
  .wf-btn-submit.is-disabled {
    cursor: not-allowed;
  }

  .wf-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border-radius: 999px;
    border: 2px solid #ffffff;
    border-top-color: transparent;
    animation: wf-spin 0.7s linear infinite;
  }
  @keyframes wf-spin { to { transform: rotate(360deg); } }

  /* ─── Links ─── */
  .wf-link {
    color: #a78bfa;
    text-decoration: none;
    font-weight: 600;
    transition: color 0.2s;
  }
  .wf-link:hover { color: #c4b5fd; }
  .wf-link-sm { font-size: 12px; }
  .wf-link-strong { font-weight: 600; }

  .wf-meta {
    margin: 4px 0 0;
    text-align: center;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.55);
  }

  .wf-safe {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .wf-safe-dot {
    display: block;
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: #a78bfa;
    box-shadow: 0 0 10px rgba(167, 139, 250, 0.55);
  }
  .wf-safe-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.42);
  }

  .wf-auth-error {
    margin: 0;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.25);
    font-size: 13px;
    color: #fca5a5;
    line-height: 1.5;
  }

  .wf-link[type="button"] {
    background: none;
    border: none;
    padding: 0;
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
  }
`;
