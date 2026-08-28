import { createHash } from "crypto";

const WEBFLOW_API = "https://api.webflow.com/v2";

export class WebflowApiError extends Error {}

export async function listWebflowSites(token: string): Promise<Array<{ id: string; displayName: string }>> {
  const res = await fetch(`${WEBFLOW_API}/sites`, {
    headers: { Authorization: `Bearer ${token}`, "Accept-Version": "2.0.0" },
  });
  if (!res.ok) {
    throw new WebflowApiError(`Token inválido ou sem acesso a sites (status ${res.status})`);
  }
  const data = await res.json();
  const sites = (data.sites ?? []) as Array<{ id: string; displayName: string }>;
  return sites.map((s) => ({ id: s.id, displayName: s.displayName }));
}

interface CreateAssetResponse {
  uploadUrl: string;
  uploadDetails: Record<string, string>;
  hostedUrl: string;
}

// Two-step upload required by Webflow's v2 Assets API: register the file
// (get an MD5-keyed slot + a presigned S3 POST), then actually upload the
// bytes to that presigned URL. The resulting hostedUrl lives on Webflow's
// own CDN, owned by the user's site — not on WevyFlow's infrastructure.
export async function uploadImageToWebflow(
  token: string,
  siteId: string,
  buffer: Buffer,
  fileName: string,
  mime: string
): Promise<string> {
  const fileHash = createHash("md5").update(buffer).digest("hex");

  const createRes = await fetch(`${WEBFLOW_API}/sites/${siteId}/assets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileName, fileHash }),
  });

  if (!createRes.ok) {
    const detail = await createRes.text().catch(() => "");
    throw new WebflowApiError(`Falha ao registrar "${fileName}" no Webflow (${createRes.status}): ${detail.slice(0, 200)}`);
  }

  const { uploadUrl, uploadDetails, hostedUrl } = (await createRes.json()) as CreateAssetResponse;

  // S3 presigned POST: every uploadDetails field must be present, and the
  // actual file content must be appended LAST — S3 ignores any form field
  // that comes after "file".
  const form = new FormData();
  for (const [key, value] of Object.entries(uploadDetails)) {
    form.append(key, value);
  }
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mime }), fileName);

  const uploadRes = await fetch(uploadUrl, { method: "POST", body: form });
  if (!uploadRes.ok) {
    throw new WebflowApiError(`Falha ao enviar "${fileName}" para o storage do Webflow (${uploadRes.status})`);
  }

  return hostedUrl;
}
