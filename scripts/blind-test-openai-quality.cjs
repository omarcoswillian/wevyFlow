// Teste cego: OpenAI gpt-image-2 em qualidade MEDIUM x HIGH (rosto de referência).
// Roda com: node scripts/blind-test-openai-quality.cjs
// Reaproveita as imagens HIGH do último teste (out/blind-test/<data>/) — mesmos
// briefs e fotos — e gera só as MEDIUM (8 imagens pagas). A ordem A/B é sorteada.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { loadEnvConfig } = require("@next/env");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
loadEnvConfig(root, true);
const OpenAI = require("openai");
const { toFile } = OpenAI;

const OPENAI_MODEL = "gpt-image-2";
const OPENAI_SIZE = { sq: "1024x1024", story: "1024x1536" };
const IDENTITY_NOTE =
  " Use the attached image as the visual reference: keep the person's face, identity, skin tone and hairstyle exactly the same as in the reference. Do not alter or invent facial features.";
const QUALITY_NOTE =
  " High quality, production-ready marketing creative. Text must be clearly legible. No blurry or distorted text. Professional graphic design quality.";

// Mesmo prompt do teste anterior (blind-test-image-models.cjs) — não alterar.
function buildPrompt(c) {
  return (
    `Professional marketing creative for ${c.produto}. ` +
    `Main headline in Portuguese (Brazil), rendered exactly with correct accents: "${c.headline}". ` +
    `Call-to-action button text: "${c.cta}". ` +
    `Visual style: ${c.estilo}, dominant color ${c.cor}.` +
    QUALITY_NOTE
  );
}

const clean = (e) => String((e && e.message) || e).replace(/sk-[\w-]+/g, "[REDACTED]").slice(0, 240);
async function withRetry(fn, tries = 2) {
  let last;
  for (let i = 0; i < tries; i++) { try { return await fn(); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 2500)); } }
  throw last;
}

async function genMedium(c, refBuf, refMime) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 180000 });
  const file = await toFile(refBuf, `reference.${refMime.split("/")[1] || "png"}`, { type: refMime });
  const t0 = Date.now();
  const r = await client.images.edit({
    model: OPENAI_MODEL, image: file, prompt: buildPrompt(c) + IDENTITY_NOTE,
    size: OPENAI_SIZE[c.fmt], quality: "medium", n: 1,
  });
  const b64 = r.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI não devolveu imagem.");
  return { buf: Buffer.from(b64, "base64"), ms: Date.now() - t0 };
}

function latestPrevRun() {
  const base = path.join(root, "out", "blind-test");
  const dirs = fs.readdirSync(base).filter((d) => fs.existsSync(path.join(base, d, "key.json")) && !fs.existsSync(path.join(base, d, "quality.flag"))).sort();
  if (!dirs.length) throw new Error("Nenhum teste anterior encontrado em out/blind-test.");
  return path.join(base, dirs[dirs.length - 1]);
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY.");
  const prev = latestPrevRun();
  const prevKey = JSON.parse(fs.readFileSync(path.join(prev, "key.json"), "utf8"));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = path.join(root, "out", "blind-test", `${stamp}-medium-vs-high`);
  const imgDir = path.join(out, "img");
  fs.mkdirSync(imgDir, { recursive: true });
  fs.writeFileSync(path.join(out, "quality.flag"), "medium-vs-high");

  const results = [];
  let next = 0;
  async function worker() {
    while (next < prevKey.length) {
      const c = prevKey[next++];
      const refPath = path.join(root, "public", "library-seed", c.ref);
      const refBuf = fs.readFileSync(refPath);
      const refMime = /\.jpe?g$/i.test(c.ref) ? "image/jpeg" : "image/png";
      const openaiLetter = c.slot.A === "openai" ? "A" : "B";
      const highFull = path.join(prev, "img", `case${c.n}_${openaiLetter}_full.png`);
      const swap = crypto.randomInt(0, 2) === 1; // true => A = medium
      const slot = { A: swap ? "medium" : "high", B: swap ? "high" : "medium" };
      const res = { n: c.n, ref: c.ref, fmt: c.fmt, produto: c.produto, headline: c.headline, slot, high: { ms: c.openai?.ms }, medium: {} };

      try {
        const m = await withRetry(() => genMedium(c, refBuf, refMime));
        const mLetter = slot.A === "medium" ? "A" : "B";
        const hLetter = mLetter === "A" ? "B" : "A";
        await sharp(m.buf).resize({ width: 1100, withoutEnlargement: true }).jpeg({ quality: 86 }).toFile(path.join(imgDir, `case${c.n}_${mLetter}.jpg`));
        fs.writeFileSync(path.join(imgDir, `case${c.n}_${mLetter}_full.png`), m.buf);
        await sharp(highFull).resize({ width: 1100, withoutEnlargement: true }).jpeg({ quality: 86 }).toFile(path.join(imgDir, `case${c.n}_${hLetter}.jpg`));
        fs.copyFileSync(highFull, path.join(imgDir, `case${c.n}_${hLetter}_full.png`));
        res.medium = { ok: true, ms: m.ms };
        res.high.ok = true;
      } catch (e) {
        res.medium = { ok: false, error: clean(e) };
      }
      await sharp(refBuf).resize({ width: 500, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(path.join(imgDir, `ref${c.n}.jpg`));
      results.push(res);
      console.log(`caso ${c.n}/${prevKey.length}: medium=${res.medium.ok ? res.medium.ms + "ms" : "ERRO " + res.medium.error} | high(anterior)=${res.high.ms ?? "?"}ms`);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  results.sort((a, b) => a.n - b.n);
  fs.writeFileSync(path.join(out, "key.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(out, "index.html"), buildHtml(results));
  const ok = results.filter((r) => r.medium.ok);
  const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length / 1000) : null);
  console.log(`MEDIA: medium ${avg(ok.map((r) => r.medium.ms))}s | high ${avg(results.map((r) => r.high.ms).filter(Boolean))}s`);
  console.log("PRONTO:", path.join(out, "index.html"));
}

function buildHtml(results) {
  const data = JSON.stringify(results.map((r) => ({
    n: r.n, headline: r.headline, produto: r.produto, fmt: r.fmt, slot: r.slot, ok: !!r.medium.ok, err: r.medium.error || "",
    ms: { medium: r.medium.ms || null, high: r.high.ms || null },
  })));
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Teste cego: qualidade medium x high</title><style>
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
<h1>Teste cego: qual imagem ficou melhor?</h1><p class="s">Mesmo modelo, duas configurações. Compare A e B em 3 critérios, sem saber qual é qual. Clique na imagem para ampliar.</p>
<div id="cases"></div><button id="rev">Revelar resultado</button><div id="res"></div>
<dialog id="dlg"><img id="big"></dialog></div><script>
const D=${data};const KEY="bt_quality_votes";const V=JSON.parse(localStorage.getItem(KEY)||"{}");
const crit=[["rosto","Rosto fiel à referência"],["texto","Texto legível em português"],["geral","Qualidade geral"]];
const box=document.getElementById("cases");
for(const c of D){const el=document.createElement("div");el.className="case";
const fig=L=>c.ok?'<figure><span class="tag">'+L+'</span><img src="img/case'+c.n+'_'+L+'.jpg" onclick="zoom(this.src)"></figure>':'<figure><span class="tag">'+L+'</span><div class="err">Sem imagem: '+c.err+'</div></figure>';
el.innerHTML='<div class="hd"><img src="img/ref'+c.n+'.jpg"><div><b>Caso '+c.n+' - '+c.headline+'</b><span>'+c.produto+' ('+(c.fmt==="story"?"2:3":"1:1")+')</span></div></div><div class="pair">'+fig("A")+fig("B")+'</div><div class="votes">'+crit.map(([k,t])=>'<div class="v"><b>'+t+'</b><div>'+["A","B","="].map(o=>'<input type="radio" name="'+c.n+k+'" id="'+c.n+k+o+'" '+(V[c.n+k]===o?"checked":"")+'><label for="'+c.n+k+o+'">'+(o==="="?"Empate":"Melhor "+o)+'</label>').join("")+'</div></div>').join("")+'</div>';
box.appendChild(el)}
box.addEventListener("change",e=>{V[e.target.name]=e.target.id.slice(-1);localStorage.setItem(KEY,JSON.stringify(V))});
function zoom(s){big.src=s.replace(".jpg","_full.png");big.onerror=()=>{big.src=s};dlg.showModal()}dlg.onclick=()=>dlg.close();
rev.onclick=()=>{const t={medium:{rosto:0,texto:0,geral:0},high:{rosto:0,texto:0,geral:0}},emp={rosto:0,texto:0,geral:0};const miss=[];
for(const c of D)for(const [k] of crit){const v=V[c.n+k];if(!v){miss.push(c.n+k);continue}if(v==="=")emp[k]++;else t[c.slot[v]][k]++}
const ok=D.filter(c=>c.ok);const avg=k=>{const xs=ok.map(c=>c.ms[k]).filter(Boolean);return xs.length?Math.round(xs.reduce((a,b)=>a+b,0)/xs.length/1000):"?"};
const out=[];out.push("RESULTADO (votos por configuracao)");for(const [k,n] of crit)out.push(n+": medium "+t.medium[k]+" x high "+t.high[k]+" (empates: "+emp[k]+")");
out.push("");out.push("Tempo medio: medium "+avg("medium")+"s | high "+avg("high")+"s");out.push("Votos faltando: "+miss.length+" de "+D.length*3);out.push("");
out.push("Chave: "+D.map(c=>"caso"+c.n+" A="+c.slot.A+" B="+c.slot.B).join(" | "));out.push("");out.push("JSON para colar no chat:");out.push(JSON.stringify({votos:V,chave:D.map(c=>({n:c.n,slot:c.slot}))}));
res.style.display="block";res.textContent=out.join("\\n")};
</script></body></html>`;
}

main().catch((e) => { console.error("ERRO:", clean(e)); process.exitCode = 1; });
