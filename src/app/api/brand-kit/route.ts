import { createClient } from "@/lib/supabase/server";

export const maxDuration = 10;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "nao autenticado" }, { status: 401 });

    const { data, error } = await supabase
      .from("brand_kits")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return Response.json({ brandKit: data ?? null });
  } catch (e) {
    console.error("[brand-kit GET]", e);
    return Response.json({ error: "erro interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "nao autenticado" }, { status: 401 });

    const body = await request.json();
    const { name, logo_url, colors, fonts, voice_tone, photos } = body;

    const { data, error } = await supabase
      .from("brand_kits")
      .upsert(
        {
          user_id: user.id,
          name: name ?? "Minha Marca",
          logo_url: logo_url ?? "",
          colors: colors ?? { primary: "#a78bfa", secondary: "#6366f1", accent: "#ec4899", bg: "#09090b", text: "#fafafa" },
          fonts: fonts ?? { heading: "Sora", body: "Inter" },
          voice_tone: voice_tone ?? "",
          photos: photos ?? [],
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) throw error;
    return Response.json({ brandKit: data });
  } catch (e) {
    console.error("[brand-kit POST]", e);
    return Response.json({ error: "erro interno" }, { status: 500 });
  }
}
