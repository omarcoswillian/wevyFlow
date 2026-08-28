import { NextRequest } from "next/server";
import { listWebflowSites, WebflowApiError } from "../../../lib/webflow-api";

export const maxDuration = 15;

// Pure passthrough to the Webflow API — the token never touches our
// database, it's only used for this one request.
export async function POST(req: NextRequest) {
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token) return Response.json({ error: "token obrigatório" }, { status: 400 });

  try {
    const sites = await listWebflowSites(token);
    return Response.json({ sites });
  } catch (e) {
    const message = e instanceof WebflowApiError ? e.message : "erro ao consultar sites do Webflow";
    return Response.json({ error: message }, { status: 400 });
  }
}
