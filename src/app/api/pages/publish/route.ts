import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "não autenticado" }, { status: 401 });

    const body = await req.json();
    const { slug, title, html, kit_id, page_type } = body as {
      slug: string;
      title: string;
      html: string;
      kit_id?: string;
      page_type?: string;
    };

    if (!slug || !html) {
      return Response.json({ error: "slug e html são obrigatórios" }, { status: 400 });
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

    const { data, error } = await supabase
      .from("published_pages")
      .upsert(
        {
          user_id: user.id,
          slug: cleanSlug,
          title,
          html,
          kit_id: kit_id || null,
          page_type: page_type || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      )
      .select("id, slug")
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "slug já em uso, escolha outro" }, { status: 409 });
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    const url = `${process.env.NEXT_PUBLIC_APP_URL || "https://app.wevyflow.com"}/p/${cleanSlug}`;
    return Response.json({ id: data.id, slug: cleanSlug, url });
  } catch (e) {
    console.error("[publish]", e);
    return Response.json({ error: "erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "não autenticado" }, { status: 401 });

  const { slug } = await req.json();
  await supabase.from("published_pages").delete().eq("slug", slug).eq("user_id", user.id);
  return Response.json({ ok: true });
}
