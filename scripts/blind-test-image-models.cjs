// Teste cego Gemini x OpenAI para criativos com rosto de referência.
// Roda com: node scripts/blind-test-image-models.cjs
// Gasta crédito real: 2 imagens por caso (Gemini + OpenAI), ~16 imagens no total.
// A ordem A/B é sorteada por caso; a chave (quem é A/B) fica só em key.json e
// dentro do index.html, e só é revelada ao clicar em "Revelar".
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { loadEnvConfig } = require("@next/env");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
loadEnvConfig(root, true);
const { GoogleGenAI } = require("@google/genai");
const OpenAI = require("openai");
const { toFile } = OpenAI;

const GEMINI_MODEL = "gemini-3-pro-image-preview";
const OPENAI_MODEL = "gpt-image-2";
const OPENAI_QUALITY = "high"; // mesmo padrão do generate-criativo

const IDENTITY_NOTE =
  " Use the attached image as the visual reference: keep the person's face, identity, skin tone and hairstyle exactly the same as in the reference. Do not alter or invent facial features.";
const QUALITY_NOTE =
  " High quality, production-ready marketing creative. Text must be clearly legible. No blurry or distorted text. Professional graphic design quality.";

// ref: caminho em public/library-seed. fmt: "sq" (1:1) ou "story" (9:16).
const CASES = [
  { ref: "luana/6202-ED-IMG.png", fmt: "sq", produto: "mentoria de vendas para infoprodutores", headline: "Venda mais sem aparecer todo dia", cta: "Quero entrar", cor: "dourado", estilo: "elegante e escuro" },
  { ref: "luana/faltam7dias-1.png", fmt: "story", produto: "curso de estratégia de lançamento", headline: "Faltam 7 dias", cta: "Garantir minha vaga", cor: "verde oliva", estilo: "minimalista" },
  { ref: "luana/faltam7dias.png", fmt: "sq", produto: "método de organização de rotina", headline: "Sua rotina em ordem em 10 passos", cta: "Acessar o método", cor: "terracota", estilo: "editorial clean" },
  { ref: "formagios/AD07.jpg", fmt: "sq", produto: "nova turma de um curso online", headline: "Nova turma aberta", cta: "Saiba mais", cor: "vinho", estilo: "bold e contrastante" },
  { ref: "formagios/AD08.jpg", fmt: "story", produto: "consultoria de posicionamento", headline: "Seu serviço vale mais do que você cobra", cta: "Falar com a equipe", cor: "azul marinho", estilo: "corporativo moderno" },
  { ref: "formagios/AD16.jpg", fmt: "sq", produto: "treinamento de captação de clientes", headline: "Pare de depender de indicação", cta: "Quero clientes", cor: "vermelho", estilo: "direto e impactante" },
  { ref: "formagios/AD37.jpg", fmt: "sq", produto: "aula ao vivo gratuita", headline: "A aula é amanhã", cta: "Reservar minha vaga", cor: "bege e preto", estilo: "premium" },
  { ref: "formagios/V3.jpg", fmt: "sq", produto: "mentoria em dupla para especialistas", headline: "Dois especialistas, um método", cta: "Conhecer a mentoria", cor: "grafite", estilo: "sofisticado" },
];

const ASPECT = { sq: "1:1", story: "9:16" };
const OPENAI_SIZE = { sq: "1024x1024", story: "1024x1536" };

function buildPrompt(c) {
  return (
    `Professional marketing creative for ${c.produto}. ` +
    `Main headline in Portuguese (Brazil), rendered exactly with correct accents: "${c.headline}". ` +
    `Call-to-action button text: "${c.cta}". ` +
    `Visual style: ${c.estilo}, dominant color ${c.cor}.` +
    QUALITY_NOTE
  );
}

async function withRetry(fn, tries = 2) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 2500)); }
  }
  throw last;
}

const clean = (e) => String(e && e.message || e).replace(/(AIza|sk-)[\w-]+/g, "[REDACTED]").slice(0, 240);

async function genGemini(c, refBuf, refMime) {
  const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
  const t0 = Date.now();
  const r = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [
      { text: `${buildPrompt(c)} Aspect ratio: ${ASPECT[c.fmt]}.${IDENTITY_NOTE}` },
      { inlineData: { mimeType: refMime, data: refBuf.toString("base64") } },
    ] }],
    config: { responseModalities: ["IMAGE"] },
  });
  for (const cand of r.candidates ?? []) for (const p of cand.content?.parts ?? []) {
    if (p.inlineData?.data) return { buf: Buffer.from(p.inlineData.data, "base64"), ms: Date.now() - t0 };
  }
  throw new Error("Gemini não devolveu imagem (" + (r.candidates?.[0]?.finishReason ?? "sem motivo") + ")");
}

async function genOpenAI(c, refBuf, refMime) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 180000 });
  const ext = refMime.split("/")[1] || "png";
  const file = await toFile(refBuf, `reference.${ext}`, { type: refMime });
  const t0 = Date.now();
  const r = await client.images.edit({
    model: OPENAI_MODEL,
    image: file,
    prompt: buildPrompt(c) + IDENTITY_NOTE,
    size: OPENAI_SIZE[c.fmt],
    quality: OPENAI_QUALITY,
    n: 1,
  });
  const b64 = r.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI não devolveu imagem.");
  return { buf: Buffer.from(b64, "base64"), ms: Date.now() - t0 };
}

async function main() {
  if (!process.env.GOOGLE_AI_API_KEY || !process.env.OPENAI_API_KEY) throw new Error("Faltam GOOGLE_AI_API_KEY e/ou OPENAI_API_KEY.");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = path.join(root, "out", "blind-test", stamp);
  const imgDir = path.join(out, "img");
  fs.mkdirSync(imgDir, { recursive: true });

  const results = [];
  let next = 0;
  async function worker() {
    while (next < CASES.length) {
      const i = next++;
      const c = CASES[i];
      const refPath = path.join(root, "public", "library-seed", c.ref);
      const refBuf = fs.readFileSync(refPath);
      const refMime = /\.jpe?g$/i.test(c.ref) ? "image/jpeg" : "image/png";
      const swap = crypto.randomInt(0, 2) === 1; // true => A = OpenAI
      const [g, o] = await Promise.allSettled([
        withRetry(() => genGemini(c, refBuf, refMime)),
        withRetry(() => genOpenAI(c, refBuf, refMime)),
      ]);
      const slot = { A: swap ? "openai" : "gemini", B: swap ? "gemini" : "openai" };
      const res = { n: i + 1, ...c, slot, gemini: {}, openai: {} };
      for (const [name, r] of [["gemini", g], ["openai", o]]) {
        if (r.status === "fulfilled") {
          const letter = slot.A === name ? "A" : "B";
          const f = `case${i + 1}_${letter}.jpg`;
          await sharp(r.value.buf).resize({ width: 1100, withoutEnlargement: true }).jpeg({ quality: 86 }).toFile(path.join(imgDir, f));
          fs.writeFileSync(path.join(imgDir, `case${i + 1}_${letter}_full.png`), r.value.buf);
          res[name] = { ok: true, file: f, ms: r.value.ms };
        } else {
          res[name] = { ok: false, error: clean(r.reason) };
        }
      }
      await sharp(refBuf).resize({ width: 500, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(path.join(imgDir, `ref${i + 1}.jpg`));
      results.push(res);
      console.log(`caso ${i + 1}/${CASES.length}: gemini=${res.gemini.ok ? res.gemini.ms + "ms" : "ERRO " + res.gemini.error} | openai=${res.openai.ok ? res.openai.ms + "ms" : "ERRO " + res.openai.error}`);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  results.sort((a, b) => a.n - b.n);
  fs.writeFileSync(path.join(out, "key.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(out, "index.html"), buildHtml(results));
  console.log("PRONTO:", path.join(out, "index.html"));
}

function buildHtml(results) {
  const data = JSON.stringify(results.map((r) => ({
    n: r.n, headline: r.headline, produto: r.produto, fmt: r.fmt, slot: r.slot,
    okA: (r.slot.A === "gemini" ? r.gemini : r.openai).ok, okB: (r.slot.B === "gemini" ? r.gemini : r.openai).ok,
    errA: (r.slot.A === "gemini" ? r.gemini : r.openai).error || "", errB: (r.slot.B === "gemini" ? r.gemini : r.openai).error || "",
  })));
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Teste cego de imagem</title><style>
:root{--bg:#0e0e10;--card:#17171a;--line:#2a2a30;--tx:#ececf1;--mu:#8b8b96;--ac:#8b5cf6}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:14px/1.5 Montserrat,system-ui,sans-serif;padding:24px 16px 80px}
.w{max-width:1180px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}p.s{color:var(--mu);margin:0 0 20px}
.case{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:18px}
.hd{display:flex;gap:14px;align-items:center;margin-bottom:12px}.hd img{height:84px;border-radius:8px}.hd b{display:block}.hd span{color:var(--mu);font-size:12px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pair figure{margin:0;position:relative}.pair img{width:100%;border-radius:10px;display:block;cursor:zoom-in}
.tag{position:absolute;top:8px;left:8px;background:#000a;padding:2px 10px;border-radius:99px;font-weight:600}
.err{padding:30px 12px;border:1px dashed var(--line);border-radius:10px;color:#f2a;font-size:12px}
.votes{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
.v b{display:block;font-size:12px;color:var(--mu);margin-bottom:4px}.v div{display:flex;gap:6px}
.v label{flex:1;text-align:center;padding:7px 4px;border:1px solid var(--line);border-radius:8px;cursor:pointer;font-size:12px}
.v input{display:none}.v input:checked+label{background:var(--ac);border-color:var(--ac);color:#fff}
button{background:var(--ac);color:#fff;border:0;border-radius:10px;padding:11px 18px;font-weight:600;cursor:pointer;font-family:inherit}
#res{white-space:pre-wrap;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:16px;display:none}
dialog{background:#000;border:0;padding:0;max-width:96vw}dialog img{max-width:96vw;max-height:94vh}dialog::backdrop{background:#000d}
@media(max-width:700px){.pair,.votes{grid-template-columns:1fr}}</style></head><body><div class="w">
<h1>Teste cego: qual imagem ficou melhor?</h1><p class="s">Compare A e B de cada caso em 3 critérios. Você não sabe qual modelo gerou cada uma. Clique na imagem para ampliar.</p>
<div id="cases"></div><button id="rev">Revelar resultado</button><div id="res"></div>
<dialog id="dlg"><img id="big"></dialog></div><script>
const D=${data};const V=JSON.parse(localStorage.getItem("bt_votes")||"{}");
const crit=[["rosto","Rosto fiel à referência"],["texto","Texto legível em português"],["geral","Qualidade geral"]];
const box=document.getElementById("cases");
for(const c of D){const el=document.createElement("div");el.className="case";
const fig=(L,ok,err)=>ok?'<figure><span class="tag">'+L+'</span><img src="img/case'+c.n+'_'+L+'.jpg" onclick="zoom(this.src)"></figure>':'<figure><span class="tag">'+L+'</span><div class="err">Sem imagem: '+err+'</div></figure>';
el.innerHTML='<div class="hd"><img src="img/ref'+c.n+'.jpg"><div><b>Caso '+c.n+' - '+c.headline+'</b><span>'+c.produto+' ('+(c.fmt==="story"?"9:16":"1:1")+')</span></div></div><div class="pair">'+fig("A",c.okA,c.errA)+fig("B",c.okB,c.errB)+'</div><div class="votes">'+crit.map(([k,t])=>'<div class="v"><b>'+t+'</b><div>'+["A","B","="].map(o=>'<input type="radio" name="'+c.n+k+'" id="'+c.n+k+o+'" '+(V[c.n+k]===o?"checked":"")+'><label for="'+c.n+k+o+'">'+(o==="="?"Empate":"Melhor "+o)+'</label>').join("")+'</div></div>').join("")+'</div>';
box.appendChild(el)}
box.addEventListener("change",e=>{V[e.target.name]=e.target.id.slice(-1);localStorage.setItem("bt_votes",JSON.stringify(V))});
function zoom(s){big.src=s.replace(".jpg","_full.png").replace("img/","img/");big.onerror=()=>{big.src=s};dlg.showModal()}dlg.onclick=()=>dlg.close();
rev.onclick=()=>{const t={gemini:{rosto:0,texto:0,geral:0},openai:{rosto:0,texto:0,geral:0}},emp={rosto:0,texto:0,geral:0};const miss=[];
for(const c of D)for(const [k] of crit){const v=V[c.n+k];if(!v){miss.push(c.n+k);continue}if(v==="=")emp[k]++;else t[c.slot[v]][k]++}
const out=[];out.push("RESULTADO (votos por modelo)");for(const [k,n] of crit)out.push(n+": Gemini "+t.gemini[k]+" x OpenAI "+t.openai[k]+" (empates: "+emp[k]+")");
out.push("");out.push("Votos faltando: "+miss.length+" de "+D.length*3);out.push("");out.push("Chave: "+D.map(c=>"caso"+c.n+" A="+c.slot.A+" B="+c.slot.B).join(" | "));
out.push("");out.push("JSON para colar no chat:");out.push(JSON.stringify({votos:V,chave:D.map(c=>({n:c.n,slot:c.slot}))}));
res.style.display="block";res.textContent=out.join("\\n")};
</script></body></html>`;
}

main().catch((e) => { console.error("ERRO:", clean(e)); process.exitCode = 1; });
