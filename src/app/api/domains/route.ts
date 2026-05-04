import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = { from: (table: string) => any };

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "nao autenticado" }, { status: 401 });

    const db = supabase as unknown as AnyDB;
    const { data, error } = await db
      .from("custom_domains")
      .select("id, domain, status, verified_at, created_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    return Response.json({ domain: data });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "nao autenticado" }, { status: 401 });

    const { domain } = await req.json() as { domain: string };
    if (!domain?.trim()) return Response.json({ error: "dominio ausente" }, { status: 400 });

    const host = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase().trim();

    const db = supabase as unknown as AnyDB;
    const { data, error } = await db
      .from("custom_domains")
      .upsert(
        { user_id: user.id, domain: host, status: "pending", verified_at: null, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) throw error;
    return Response.json({ domain: data });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "nao autenticado" }, { status: 401 });

    const db = supabase as unknown as AnyDB;
    const { error } = await db
      .from("custom_domains")
      .delete()
      .eq("user_id", user.id);

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
