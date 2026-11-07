// Runs before first paint (external file: the CSP allows only same-origin scripts).
// - js-reveal: lets CSS hide [data-reveal] blocks until they scroll into view (no JS → nothing hidden)
// - show-loader: the intro screen, once per visit, only on public pages and never on booking/staff pages
(function () {
  var d = document.documentElement;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) return;
  d.classList.add('js-reveal');
  var p = location.pathname;
  if (/^\/(admin|book|booking|b)(\/|$)/.test(p)) return;
  try {
    if (sessionStorage.getItem('roha-intro')) return;
    sessionStorage.setItem('roha-intro', '1');
    d.classList.add('show-loader', 'hero-intro');
  } catch (e) { /* storage blocked: skip the intro */ }
})();
