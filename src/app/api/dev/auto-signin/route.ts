import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  // Usar senha temporária para dev — sem magic link (evita cookies enormes)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // Garantir que o usuário tem senha dev configurada
  await admin.auth.admin.updateUserById("e8acece4-d7bb-40f6-8f7d-61d0c781e8e3", {
    password: "dev-local-2024",
  });

  // Fazer login com email/senha e pegar o token de acesso
  const { data, error } = await admin.auth.signInWithPassword({
    email: "marcoswill180@gmail.com",
    password: "dev-local-2024",
  });

  if (error || !data.session) {
    return NextResponse.json({ error: error?.message ?? "Falhou" }, { status: 500 });
  }

  // Setar cookies de sessão via Supabase server client e redirecionar
  const supabase = await createServerClient();
  await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL!));
}
