// Live integration test: node scripts/test-openai-image.cjs
// Generates one paid image using the application's helper and server API key.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { loadEnvConfig } = require("@next/env");
const { createJiti } = require("jiti");
const sharp = require("sharp");

async function main() {
  const root = path.resolve(__dirname, "..");
  loadEnvConfig(root, true);
  assert(process.env.OPENAI_API_KEY, "OPENAI_API_KEY não configurada.");
  const jiti = createJiti(__filename);
  const { generateOpenAIImage, resolveOpenAIImageModel } = await jiti.import("../src/app/lib/openai-image.ts");
  const model = resolveOpenAIImageModel();
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    assert.equal(url.origin, "https://api.openai.com", "Provedor inesperado.");
    assert.equal(url.pathname, "/v1/images/generations");
    const body = JSON.parse(init.body);
    assert.equal(body.model, model);
    const response = await originalFetch(input, init);
    requests.push({ endpoint: url.href, model: body.model, status: response.status, requestId: response.headers.get("x-request-id") });
    return response;
  };
  const started = Date.now();
  try {
    const result = await generateOpenAIImage({
      prompt: "A small friendly purple robot on a clean pale lavender background, simple polished 3D illustration, centered composition, no text.",
      aspect: 1,
      quality: "low",
    });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].status, 200);
    const buffer = Buffer.from(result.b64, "base64");
    const meta = await sharp(buffer).metadata();
    assert.equal(meta.format, "png");
    assert.equal(meta.width, 1024);
    assert.equal(meta.height, 1024);
    await sharp(buffer).raw().toBuffer();
    const output = path.join(root, "out", "openai-image-test", new Date().toISOString().replace(/[:.]/g, "-"));
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, "image.png"), buffer);
    const report = { passed: true, ...requests[0], width: meta.width, height: meta.height, bytes: buffer.length, durationMs: Date.now() - started, image: path.join(output, "image.png") };
    await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error) => {
  // Do not print API response bodies, headers, or credentials.
  const message = String(error.message).replace(/sk-[\w-]+/g, "[REDACTED]").slice(0, 400);
  console.error(JSON.stringify({ passed: false, error: error.name, message, status: error.status, code: error.code, cause: error.cause?.code, requestId: error.request_id }));
  process.exitCode = 1;
});
