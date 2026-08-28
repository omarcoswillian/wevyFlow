// Universal lead-capture connector — embedded in every export destination
// (Webflow, WordPress plugin, Elementor, raw HTML download) AND in pages
// served from WevyFlow's own /p/[slug]. Wherever the HTML ends up living,
// this is the one piece of JS that gets a form submission back into the
// owner's WevyFlow leads dashboard.
//
// Auth model: routing uses an opaque `token` (published_pages.public_token
// or lead_sources.token), never the human-readable slug/user id — a token
// leak only exposes lead-routing for that one page, and isn't guessable.
//
// Anti-spam without a captcha: a honeypot field the script injects itself
// (real visitors never see or fill it) plus a minimum fill time computed
// from the moment the script executes. Both are enforced server-side in
// /api/public/leads — this client code just collects the signals.
export function buildLeadCaptureSnippet(token: string, appUrl: string): string {
  const endpoint = `${appUrl.replace(/\/$/, "")}/api/public/leads`;
  return `
<script>
(function(){
  var TOKEN=${JSON.stringify(token)};
  var ENDPOINT=${JSON.stringify(endpoint)};
  var renderedAt=Date.now();
  var utmParams={};
  try {
    var sp=new URLSearchParams(location.search);
    ['utm_source','utm_medium','utm_campaign'].forEach(function(k){ if(sp.get(k)) utmParams[k]=sp.get(k); });
  } catch(e){}

  function getFieldValue(form, names){
    for(var i=0;i<names.length;i++){
      var el=form.querySelector('[name="'+names[i]+'"], [id="'+names[i]+'"], [placeholder*="'+names[i]+'"]');
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

  function ensureHoneypot(form){
    var hp=form.querySelector('.wf-hp-field');
    if(hp) return hp;
    hp=document.createElement('input');
    hp.type='text';
    hp.name='wf_hp_'+Math.random().toString(36).slice(2,7);
    hp.className='wf-hp-field';
    hp.tabIndex=-1;
    hp.autocomplete='off';
    hp.setAttribute('aria-hidden','true');
    hp.style.cssText='position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
    form.appendChild(hp);
    return hp;
  }

  document.querySelectorAll('form').forEach(function(form){
    var honeypot=ensureHoneypot(form);
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var email=getFieldValue(form,['email','e-mail','seu-email','melhor-email']);
      var phone=getFieldValue(form,['phone','telefone','whatsapp','celular','tel']);
      var name=getFieldValue(form,['name','nome','first_name','seu-nome']);
      if(!email && !phone) { form.submit(); return; }
      var skip=['email','e-mail','phone','telefone','whatsapp','celular','tel','name','nome','first_name','seu-nome','seu-email',honeypot.name];
      var payload=Object.assign({
        token:TOKEN,
        page_title:document.title,
        page_url:location.href,
        name:name||null,
        email:email||null,
        phone:phone||null,
        extra:collectExtra(form,skip)||null,
        hp:honeypot.value||'',
        elapsed_ms:Date.now()-renderedAt
      }, utmParams);

      var btn=form.querySelector('[type="submit"]');
      var originalBtnText=btn?btn.textContent:'';
      if(btn){ btn.disabled=true; btn.textContent='Enviando…'; }

      fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
        .then(function(res){
          if(!res.ok) throw new Error('capture failed');
          var thanks=document.getElementById('wf-thanks');
          if(thanks){ thanks.style.display='block'; form.style.display='none'; }
          else if(btn){ btn.textContent='Enviado!'; }
        })
        .catch(function(){
          if(btn){ btn.disabled=false; btn.textContent=originalBtnText||'Tentar novamente'; }
          window.alert('Não foi possível enviar seus dados agora. Tente novamente em instantes.');
        });
    });
  });
})();
</script>`;
}
