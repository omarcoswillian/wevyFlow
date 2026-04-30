import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return Response.json({ error: "nao autenticado" }, { status: 401 });

    // Read body as text first to get better error messages on parse failure
    let rawBody: string;
    try {
      rawBody = await req.text();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[figma-import] falha ao ler body:", msg);
      return Response.json({ error: "falha ao ler body: " + msg }, { status: 400 });
    }

    const bodySizeMB = (Buffer.byteLength(rawBody, "utf8") / 1024 / 1024).toFixed(1);
    console.log(`[figma-import] body size: ${bodySizeMB}MB`);

    let body: { name: string; refWidth: number; html: string };
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[figma-import] JSON invalido:", msg, "| primeiros 200 chars:", rawBody.slice(0, 200));
      return Response.json({ error: "JSON invalido: " + msg }, { status: 400 });
    }

    const { name, html } = body;
    if (!html)
      return Response.json({ error: "html ausente" }, { status: 400 });

    const slug = buildSlug(name) + "-" + Date.now().toString(36);
    const fullHtml = buildPageDocument(html, name);

    const htmlSizeMB = (Buffer.byteLength(fullHtml, "utf8") / 1024 / 1024).toFixed(1);
    console.log(`[figma-import] html size before insert: ${htmlSizeMB}MB`);

    const { data, error } = await supabase
      .from("published_pages")
      .insert({
        user_id: user.id,
        slug,
        title: name || "Pagina importada",
        html: fullHtml,
        page_type: "figma",
      })
      .select("id, slug")
      .single();

    if (error) {
      console.error("[figma-import] supabase error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ id: data.id, slug: data.slug });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[figma-import] erro inesperado:", msg);
    return Response.json({ error: "erro interno: " + msg }, { status: 500 });
  }
}

function buildSlug(s: string) {
  return (
    (s || "pagina")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "pagina"
  );
}

function buildPageDocument(bodyHtml: string, title: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title || "Pagina"}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{margin:0;padding:0;overflow-x:hidden}
body{background:#fff}
img{max-width:none;display:block}
p{margin:0}
.wf-page{transform-origin:top left}
.wf-carousel{position:relative}
.wf-carousel .swiper-slide{height:100%;flex-shrink:0}
.wf-carousel .swiper-button-prev,
.wf-carousel .swiper-button-next{color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.5)}
.wf-carousel .swiper-pagination-bullet-active{background:#fff}
</style>
</head>
<body>
${bodyHtml}
<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
<script>
(function(){
  /* Scale the page to fit the viewport proportionally */
  var page = document.querySelector('.wf-page');
  if (page) {
    var refW = parseInt(page.getAttribute('data-ref-width') || '1440', 10);
    function applyScale() {
      var vw = window.innerWidth;
      if (vw < refW) {
        var scale = vw / refW;
        page.style.transform = 'scale(' + scale + ')';
        page.style.width = refW + 'px';
        document.body.style.height = Math.round(page.offsetHeight * scale) + 'px';
      } else {
        page.style.transform = '';
        page.style.width = '';
        document.body.style.height = '';
      }
    }
    applyScale();
    window.addEventListener('resize', applyScale);
  }

  /* Swiper carousels */
  document.querySelectorAll('.wf-carousel').forEach(function(el){
    new Swiper(el,{
      slidesPerView:'auto',
      centeredSlides:false,
      spaceBetween:0,
      loop:false,
      grabCursor:true,
      pagination:{el:el.querySelector('.swiper-pagination'),clickable:true},
      navigation:{nextEl:el.querySelector('.swiper-button-next'),prevEl:el.querySelector('.swiper-button-prev')}
    });
  });
})();
</script>
</body>
</html>`;
}
