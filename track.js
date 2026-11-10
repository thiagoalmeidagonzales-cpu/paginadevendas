/* Intensive Performance — coletor de acessos (envia para /api/track) */
(function () {
  var E = '/api/track', isNew = 0;
  function id(k, st, nw) { try { var v = st.getItem(k); if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); st.setItem(k, v); if (nw) isNew = 1; } return v; } catch (e) { return 'x' + Date.now(); } }
  var vid = id('ip_vid', localStorage, 1), sid = id('ip_sid', sessionStorage);
  var q = new URLSearchParams(location.search);
  var base = { vid: vid, sid: sid, path: location.pathname, ref: document.referrer, us: q.get('utm_source') || '', um: q.get('utm_medium') || '', uc: q.get('utm_campaign') || '', fbclid: q.has('fbclid') ? 1 : 0, gclid: q.has('gclid') ? 1 : 0, scr: screen.width + 'x' + screen.height, lang: navigator.language || '', nv: isNew };
  function send(type, extra) {
    var o = {}, k; for (k in base) o[k] = base[k]; o.type = type; if (extra) for (k in extra) o[k] = extra[k];
    var b = JSON.stringify(o);
    try { if (navigator.sendBeacon && navigator.sendBeacon(E, new Blob([b], { type: 'text/plain' }))) return; } catch (e) {}
    try { fetch(E, { method: 'POST', body: b, keepalive: true, headers: { 'Content-Type': 'text/plain' } }); } catch (e) {}
  }
  send('pageview');
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-track],a,button'); if (!el) return;
    var href = el.getAttribute('href') || '';
    var label = el.getAttribute('data-track') || el.getAttribute('data-plan') || (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    send(/wa\.me|whatsapp/i.test(href) ? 'whatsapp' : 'click', { label: label, target: href.slice(0, 200) });
  }, true);
  var maxS = 0, t0 = Date.now(), done = false;
  addEventListener('scroll', function () { var h = document.documentElement, p = Math.round((scrollY + innerHeight) / h.scrollHeight * 100); if (p > maxS) maxS = Math.min(100, p); }, { passive: true });
  function bye() { if (done) return; done = true; send('leave', { value: Math.round((Date.now() - t0) / 1000), scroll: maxS }); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') bye(); else { done = false; t0 = Date.now(); } });
  addEventListener('pagehide', bye);
  window.ipTrack = send;
})();
