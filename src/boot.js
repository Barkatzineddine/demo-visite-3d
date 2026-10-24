// Runs before the first paint, inlined in the HTML at build and allowed by its CSP hash.
// index.html carries a pre-rendered tour page with the original finishes: what a first visit shows
// (build/prerender.ts). Any other visit (a shared link in the address, a language picked before)
// hides it rather than flash the wrong text or finishes until the app starts.
(function () {
  var show = !/^#\/./.test(location.hash);
  try {
    for (var i = 0; i < localStorage.length; i++) if ((localStorage.key(i) || '').indexOf('verlaine:') === 0) show = false;
  } catch { show = false; }
  document.documentElement.setAttribute('data-prerender', show ? 'shown' : 'skip');
})();
