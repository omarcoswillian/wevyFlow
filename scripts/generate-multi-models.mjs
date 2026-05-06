/**
 * Gera fotos de exemplo distribuindo 3 modelos pelos 18 estilos:
 *   Wendell  → estilos de autoridade/cinematico masculinos
 *   Luana    → estilos lifestyle/street
 *   Vitória  → já gerado (mantém femininos/editoriais)
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nbnrwghtecsjejcpxkje.supabase.co";
const SUPABASE_KEY = "REMOVED_SUPABASE_SECRET_KEY";
const API_URL = "http://localhost:3000/api/generate-design";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Distribuição: qual modelo usa cada estilo
const ASSIGNMENTS = [
  // ─── WENDELL (autoridade/cinematico masculino) ───
  {
    model: "/Users/omarcoswillian/Downloads/wendell.png",
    name: "Wendell",
    styles: [
      { id: "editorial-premium", label: "Retrato Editorial Premium", prompt: `Studio portrait of the person in the attached photo — preserve their exact face, features, skin tone, hair, and expression without any alteration. The person sits on a modern beige armchair with wooden legs, leaning slightly forward with hands together. They wear a dark tailored blazer over a white dress shirt, dark pants. Background is a clean, slightly warm neutral studio backdrop. Dramatic side lighting sculpts the face. Sharp, high-resolution, editorial magazine quality. Photorealistic, 4K.` },
      { id: "corporativo-pb",    label: "Corporativo Magazine",       prompt: `Black and white editorial portrait of the person in the attached photo — maintain their exact real face, all facial features identical. The person sits on a modern sofa with a confident, composed expression. They wear a sharp dark suit. Dramatic studio lighting with strong contrast. Magazine cover quality. Ultra-realistic, high-contrast monochrome, professional editorial photography.` },
      { id: "luxury-car",        label: "Empresario de Luxo",         prompt: `Hyper-realistic editorial portrait of the person in the attached photo — preserve every facial feature exactly. The person stands confidently outside a luxury black car at golden hour sunset. Wearing a perfectly fitted dark suit. Warm cinematic lighting with long shadows. Bokeh background with city lights or sunset. Luxury fashion editorial, 4K photorealistic.` },
      { id: "urban-noir",        label: "Urban Noir",                  prompt: `Cinematic noir portrait of the person in the attached photo — keep facial features completely unchanged. The person stands in a moody urban alley at night, dramatic contrast lighting — one strong side light, rest in shadow. Rain-wet pavement reflecting neon colors in the background. Dark coat, intense expression. Film noir aesthetic, deep cinematic color grade, ultra-realistic.` },
      { id: "john-wick-style",   label: "Cinematico Dramatico",        prompt: `Cinematic film still, neo-noir aesthetic, hyper-detailed 8K. A hyperrealistic portrait of the person from the attached photo — face identity locked, no alteration. The person stands in a dark dramatic setting wearing a sharp black suit, illuminated by a single cold-blue side light. High-contrast shadows, dramatic tension, photorealistic, 16:9 cinematic framing.` },
      { id: "moody-studio",      label: "Moody Spotlight",             prompt: `Moody studio portrait of the person from the attached photo — exact face preserved. The person is bathed in a golden-orange spotlight that creates a glowing circular halo of light, contrasting dramatically with the surrounding deep shadows. Wearing a simple dark outfit. Artistic, theatrical, editorial quality photography. Ultra-realistic.` },
    ],
  },

  // ─── LUANA (lifestyle / street) ───
  {
    model: "/Users/omarcoswillian/Downloads/rop.jpg",
    name: "Luana",
    styles: [
      { id: "work-profile",        label: "Perfil Profissional",   prompt: `Realistic professional portrait of the person in the attached photo — use this exact face unchanged. The person sits at a modern office desk with a laptop and documents. Wearing a clean professional outfit, business casual. Confident, approachable expression. Warm office lighting, shallow depth of field blurring the background. 4K photorealistic quality.` },
      { id: "empresario-reflexo",  label: "Reflexo no Vidro",      prompt: `Cinematic close-up portrait of the person from the attached photo — maintain exact face and identity. The person stands by a large floor-to-ceiling glass window, gazing thoughtfully at their reflection. Wearing a stylish dark coat over a suit. Moody indoor lighting with city bokeh visible through the glass. Cinematic color grade, editorial quality.` },
      { id: "dark-studio-luxo",    label: "Dark Studio",           prompt: `Cinematic portrait of the person from the attached photo — use this face as-is, no changes. The person sits confidently on a round black beanbag chair against a completely dark studio background. Wearing all-black stylish outfit. Single dramatic spotlight from above-front illuminates the face. Deep blacks, high contrast, luxury fashion editorial. Ultra-realistic, 4K.` },
      { id: "urban-perch",         label: "Street Style Urbano",   prompt: `Digital photo of the person from the attached photo — preserve their exact real face unchanged. The person sits casually on a steel wire fence or urban wall in a city setting. Wearing stylish streetwear: black oversized jacket, cargo pants, clean sneakers. Natural city lighting, slightly overcast sky. Street photography style, candid feel, urban backdrop with bokeh.` },
      { id: "street-photographer", label: "Street Photographer",   prompt: `High-end street-photography portrait of the person from the attached photo — do not change any facial features. The person leans casually on a lamp post in front of a European urban street. Wearing a stylish minimal outfit — white shirt, dark jeans, clean shoes. Overcast natural light, street life in the background blurred. Editorial travel/lifestyle photography.` },
      { id: "city-staircase",      label: "City Staircase",        prompt: `Cinematic outdoor portrait of the person from the attached photo — exact face, all features identical. The person sits casually on outdoor stone steps in front of a building entrance, leaning back with one arm resting on the steps. Relaxed, confident posture. Natural urban lighting. Stylish casual outfit. High-end lifestyle photography, bokeh background.` },
    ],
  },
];

// Vitória já cobre os 6 restantes:
// urban-reflection, monochrome-editorial, perfil-pb, mulher-negocios, mulher-elegante, estudio-feminino

async function b64ToBuffer(b64) {
  const byteStr = atob(b64);
  const ab = new ArrayBuffer(byteStr.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
  return Buffer.from(ab);
}

async function generate(photoDataUrl, prompt) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, referenceImages: [], avatarImages: [photoDataUrl], format: "4:5" }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

async function uploadToSupabase(styleId, buffer, mimeType) {
  const path = `ensaio-styles/${styleId}.jpg`;
  const blob = new Blob([buffer], { type: mimeType });
  const { error } = await supabase.storage.from("ai-images").upload(path, blob, { upsert: true, contentType: mimeType });
  if (error) throw error;
  const { data } = supabase.storage.from("ai-images").getPublicUrl(path);
  return data.publicUrl;
}

async function main() {
  let totalDone = 0;
  let totalFailed = 0;
  const totalStyles = ASSIGNMENTS.reduce((acc, a) => acc + a.styles.length, 0);

  for (const assignment of ASSIGNMENTS) {
    const { model: modelPath, name, styles } = assignment;
    const ext = modelPath.split(".").pop()?.toLowerCase() ?? "jpg";
    const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
    const mime = mimeMap[ext] ?? "image/jpeg";
    const rawBytes = readFileSync(modelPath);
    const photoDataUrl = `data:${mime};base64,${rawBytes.toString("base64")}`;

    console.log(`\n=== ${name} (${(rawBytes.length / 1024).toFixed(0)} KB) — ${styles.length} estilos ===`);

    for (let i = 0; i < styles.length; i++) {
      const style = styles[i];
      process.stdout.write(`  [${i + 1}/${styles.length}] ${style.label}... `);
      try {
        const { b64, mimeType } = await generate(photoDataUrl, style.prompt);
        const buffer = await b64ToBuffer(b64);
        const url = await uploadToSupabase(style.id, buffer, mimeType);
        console.log(`OK → ${url.split("/").pop()}`);
        totalDone++;
      } catch (e) {
        console.log(`FALHOU: ${e.message}`);
        totalFailed++;
      }
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  console.log(`\n========================================`);
  console.log(`Total: ${totalDone}/${totalStyles} gerados, ${totalFailed} falharam.`);
  console.log(`Vitória mantida nos 6 estilos restantes (feminino/editorial).`);
}

main().catch(err => { console.error(err); process.exit(1); });
