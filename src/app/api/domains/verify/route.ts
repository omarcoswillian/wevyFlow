import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import dns from "dns/promises";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = { from: (table: string) => any };

const CNAME_TARGET = "cname.wevyflow.com";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "nao autenticado" }, { status: 401 });

    const { domain } = await req.json() as { domain: string };
    if (!domain) return Response.json({ error: "dominio ausente" }, { status: 400 });

    const host = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase().trim();

    let verified = false;
    let dnsError: string | null = null;

    try {
      const cnames = await dns.resolveCname(host);
      verified = cnames.some((c) => c.toLowerCase().includes("wevyflow.com"));
    } catch {
      try {
        const addresses = await dns.resolve4(host);
        // fallback: if resolves at all, mark as pending (can't verify A record target)
        dnsError = addresses.length > 0
          ? "CNAME nao encontrado — configure o CNAME corretamente"
          : "dominio nao resolve";
      } catch {
        dnsError = "dominio nao encontrado no DNS";
      }
    }

    const status = verified ? "verified" : "pending";
    const now = new Date().toISOString();

    const db = supabase as unknown as AnyDB;
    const { error: upsertError } = await db
      .from("custom_domains")
      .upsert(
        {
          user_id: user.id,
          domain: host,
          status,
          verified_at: verified ? now : null,
          updated_at: now,
        },
        { onConflict: "user_id" }
      );

    if (upsertError) throw upsertError;

    return Response.json({ verified, status, domain: host, dnsError, cnameTarget: CNAME_TARGET });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
