import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export const maxDuration = 15;

// Creates a lead-capture routing token for a page that is about to be
// exported OUTSIDE WevyFlow (Webflow, WordPress, Elementor, raw HTML).
// The export flow embeds this token in a connector script so form
// submissions still reach the owner's leads dashboard no matter where the
// page ends up hosted — see src/app/lib/lead-capture-snippet.ts.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { title, platform } = body as { title?: string; platform?: string };

  const { data, error } = await supabase
    .from("lead_sources")
    .insert({
      user_id: user.id,
      title: title || "Página exportada",
      platform: platform || "export",
    })
    .select("token")
    .single();

  if (error) {
    console.error("[lead-source]", error.message);
    return Response.json({ error: "erro ao criar fonte de leads" }, { status: 500 });
  }

  return Response.json({ token: data.token });
}
