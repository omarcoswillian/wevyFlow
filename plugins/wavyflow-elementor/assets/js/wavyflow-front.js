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

  // Reveal on scroll — supports .wf-rv, .rv, .rv-stagger AND .reveal (template class).
  // Adds every "visible" class variant used across templates so CSS targeting any of them works.
  var rvObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('wf-vis');
        e.target.classList.add('vis');
        e.target.classList.add('is-visible');
        rvObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.wf-rv, .rv, .rv-stagger, .reveal').forEach(function (el) { rvObs.observe(el); });

  // Safety net: if the observer never fires (edge browsers), reveal everything after 1.5s.
  setTimeout(function () {
    document.querySelectorAll('.wf-rv:not(.wf-vis), .rv:not(.vis), .rv-stagger:not(.vis), .reveal:not(.is-visible)').forEach(function (el) {
      el.classList.add('wf-vis'); el.classList.add('vis'); el.classList.add('is-visible');
    });
  }, 1500);

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
