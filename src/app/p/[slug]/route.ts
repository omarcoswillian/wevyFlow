import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const LEAD_CAPTURE_SCRIPT = `
<script>
(function(){
  var slug = document.currentScript ? document.currentScript.getAttribute('data-slug') : '';
  var utmParams = {};
  try {
    var sp = new URLSearchParams(location.search);
    ['utm_source','utm_medium','utm_campaign'].forEach(function(k){ if(sp.get(k)) utmParams[k]=sp.get(k); });
  } catch(e){}

  function getFieldValue(form, names){
    for(var i=0;i<names.length;i++){
      var el = form.querySelector('[name="'+names[i]+'"], [id="'+names[i]+'"], [placeholder*="'+names[i]+'"]');
      if(el && el.value) return el.value;
    }
    return null;
  }

  function collectExtra(form, skipNames){
    var extra={};
    form.querySelectorAll('input,select,textarea').forEach(function(el){
      var n=el.name||el.id; if(!n||skipNames.indexOf(n)>-1) return;
      if(el.value) extra[n]=el.value;
    });
    return Object.keys(extra).length ? extra : null;
  }

  document.querySelectorAll('form').forEach(function(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var email=getFieldValue(form,['email','e-mail','seu-email','melhor-email']);
      var phone=getFieldValue(form,['phone','telefone','whatsapp','celular','tel']);
      var name=getFieldValue(form,['name','nome','first_name','seu-nome']);
      if(!email && !phone) { form.submit(); return; }
      var skip=['email','e-mail','phone','telefone','whatsapp','celular','tel','name','nome','first_name','seu-nome','seu-email','melhor-email','seu-nome'];
      var payload=Object.assign({
        page_slug:slug,
        page_title:document.title,
        name:name||null,
        email:email||null,
        phone:phone||null,
        extra:collectExtra(form,skip)||null
      }, utmParams);
      fetch('/api/public/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
        .catch(function(){});
      var btn=form.querySelector('[type="submit"]');
      if(btn){ btn.disabled=true; btn.textContent='Enviado!'; }
      var thanks=document.getElementById('wf-thanks');
      if(thanks){ thanks.style.display='block'; form.style.display='none'; }
    });
  });
})();
</script>`;

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const supabase = await createClient();

  const { data: page, error: qErr } = await supabase
    .from("published_pages")
    .select("html, title, slug")
    .eq("slug", slug)
    .maybeSingle();

  console.log("[/p/slug] slug:", slug, "| found:", !!page, "| error:", qErr?.message);

  if (!page) {
    return new Response(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:80px;color:#6b7280"><h2>Página não encontrada</h2></body></html>`,
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Increment views (fire and forget)
  supabase.from("published_pages").update({ views: 0 }).eq("slug", slug).then(() => {});

  // Inject lead capture script with slug embedded directly in the script tag
  const scriptTag = LEAD_CAPTURE_SCRIPT.replace("<script>", `<script data-slug="${slug}">`);
  const html = page.html.includes("</body>")
    ? page.html.replace("</body>", `${scriptTag}\n</body>`)
    : page.html + scriptTag;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
