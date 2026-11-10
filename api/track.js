// Coletor de eventos: recebe visitas e cliques das páginas (track.js)
const { redis, dayKey, body, ua, source } = require('./_lib');
const TYPES = ['pageview', 'click', 'whatsapp', 'leave', 'purchase'];
const s = (v, n) => String(v == null ? '' : v).slice(0, n);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const ag = String(req.headers['user-agent'] || '');
  if (/bot|crawl|spider|preview|headless|lighthouse/i.test(ag)) return res.status(204).end();
  const b = body(req);
  if (!TYPES.includes(b.type) || !b.sid) return res.status(400).end();
  const h = req.headers;
  const [dev, br, os] = ua(ag);
  let rh = ''; try { rh = b.ref ? new URL(b.ref).hostname.replace(/^www\./, '') : ''; } catch (e) {}
  if (rh && String(h.host || '').replace(/^www\./, '') === rh) rh = '';
  const [src, med] = source({ us: b.us, um: b.um, rh, fbclid: b.fbclid, gclid: b.gclid });
  let city = ''; try { city = decodeURIComponent(s(h['x-vercel-ip-city'], 120)); } catch (e) {}
  const ev = {
    ts: Date.now(), type: b.type, vid: s(b.vid, 40), sid: s(b.sid, 40), path: s(b.path, 120) || '/',
    label: s(b.label, 80), target: s(b.target, 200), value: Math.min(+b.value || 0, 14400), scroll: Math.min(+b.scroll || 0, 100),
    src, med, camp: s(b.uc, 60), ref: rh, dev, br, os, scr: s(b.scr, 15), lang: s(b.lang, 12), nv: b.nv ? 1 : 0,
    country: s(h['x-vercel-ip-country'], 4), region: s(h['x-vercel-ip-country-region'], 10), city,
  };
  try {
    const key = 'ev:' + dayKey(ev.ts);
    await redis([['RPUSH', key, JSON.stringify(ev)], ['EXPIRE', key, String(400 * 86400)], ['ZADD', 'live', String(ev.ts), ev.sid]]);
  } catch (e) { return res.status(500).end(); }
  res.status(204).end();
};
