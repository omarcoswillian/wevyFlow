import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page_slug = searchParams.get("page_slug") || undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

  let query = supabase
    .from("leads")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (page_slug) query = query.eq("page_slug", page_slug);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ leads: data ?? [] });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "não autenticado" }, { status: 401 });

  const { id } = await req.json();
  await supabase.from("leads").delete().eq("id", id).eq("user_id", user.id);
  return Response.json({ ok: true });
}
