/* WavyFlow Frontend Scripts — Performance Optimized */

document.addEventListener('DOMContentLoaded', function () {
  // FAQ Accordion
  document.querySelectorAll('.wf-faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.parentElement;
      var list = item.closest('.wf-faq-list');
      var wasOpen = item.classList.contains('open');
      if (list) list.querySelectorAll('.wf-faq-item').forEach(function (i) { i.classList.remove('open'); });
      if (!wasOpen) item.classList.add('open');
    });
  });

  // Also handle non-prefixed FAQ (from HTML templates)
  document.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.parentElement;
      var list = item.closest('.faq-list');
      var wasOpen = item.classList.contains('open');
      if (list) list.querySelectorAll('.faq-item').forEach(function (i) { i.classList.remove('open'); });
      if (!wasOpen) item.classList.add('open');
    });
  });

  // Reveal on scroll — throttled with rAF
  var rvObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('wf-vis'); e.target.classList.add('vis'); rvObs.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.wf-rv, .rv, .rv-stagger').forEach(function (el) { rvObs.observe(el); });

  // Scroll progress — throttled with rAF
  var spTick = false;
  var spEl = document.getElementById('scrollProgress');
  if (spEl) {
    window.addEventListener('scroll', function () {
      if (!spTick) {
        spTick = true;
        requestAnimationFrame(function () {
          var h = document.documentElement.scrollHeight - window.innerHeight;
          spEl.style.width = h > 0 ? (window.scrollY / h * 100) + '%' : '0';
          spTick = false;
        });
      }
    }, { passive: true });
  }
});
