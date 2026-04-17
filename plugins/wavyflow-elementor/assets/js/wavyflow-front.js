/* WavyFlow Frontend Scripts */

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

  // Reveal on scroll
  var rvObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('wf-vis'); rvObs.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.wf-rv').forEach(function (el) { rvObs.observe(el); });
});
