// Roda com: node --experimental-strip-types scripts/test-ai-routing.mts
import assert from "node:assert/strict";
import { textModelFor, imageRouteFor } from "../src/app/lib/ai-routing.ts";

for (const k of Object.keys(process.env)) if (k.startsWith("AI_MODEL_") || k.startsWith("AI_IMAGE_")) delete process.env[k];

// padroes: texto -> Claude, rosto -> Gemini, texto na imagem -> OpenAI
assert.equal(textModelFor("copy"), "claude-sonnet-4-6");
assert.equal(textModelFor("light"), "claude-haiku-4-5-20251001");
assert.deepEqual(imageRouteFor("face"), { provider: "openai", model: "gpt-image-2" });
assert.deepEqual(imageRouteFor("text_in_image"), { provider: "openai", model: "gpt-image-2" });

// override por env, sem mexer em codigo
process.env.AI_MODEL_COPY = "claude-sonnet-5-5";
assert.equal(textModelFor("copy"), "claude-sonnet-5-5");
assert.equal(textModelFor("html"), "claude-sonnet-4-6"); // outras tarefas intactas
process.env.AI_MODEL_COPY = "   ";
assert.equal(textModelFor("copy"), "claude-sonnet-4-6"); // vazio ignora

// trocar o provedor de rosto invalida o modelo padrao da rota anterior
process.env.AI_IMAGE_PROVIDER_FACE = "gemini";
assert.deepEqual(imageRouteFor("face"), { provider: "gemini", model: "" });
process.env.AI_IMAGE_MODEL_FACE = "gemini-3-pro-image-preview";
assert.deepEqual(imageRouteFor("face"), { provider: "gemini", model: "gemini-3-pro-image-preview" });
process.env.AI_IMAGE_PROVIDER_FACE = "provedor-invalido";
assert.equal(imageRouteFor("face").provider, "openai"); // valor invalido volta ao padrao
console.log("ok: roteamento");
