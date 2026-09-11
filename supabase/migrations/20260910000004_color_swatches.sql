-- Paleta de cores customizadas salvas no ColorPicker do editor só existia em
-- localStorage ("wevyflow-color-swatches"), perdida ao trocar de navegador.
-- Uma lista simples por usuário não justifica tabela própria — vira uma
-- coluna em user_profiles, como o restante do perfil do usuário.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS color_swatches text[] NOT NULL DEFAULT '{}';
