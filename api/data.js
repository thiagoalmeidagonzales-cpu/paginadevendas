// Dados do painel /acesso-dev (somente logado)
const { redis, verify, dayKey } = require('./_lib');
const PAGES = { links: p => p.startsWith('/links'), personalizado: p => p.startsWith('/treinamento-personalizado'), index: p => p === '/' || p === '/index.html', gym: p => p.startsWith('/gym'), home: p => p.startsWith('/home'), hibrido: p => p.startsWith('/hibrido') };
let names; try { names = new Intl.DisplayNames(['pt-BR'], { type: 'region' }); } catch (e) {}
const country = (c) => { try { return c ? names.of(c) : '(desconhecido)'; } catch (e) { return c; } };
const isCheckout = (e) => /stripe\.com|checkout|^\/(gym|home|hibrido)\/?$/i.test(e.target) || /^(GYM|HOME|HIBRIDO)$|tp_comprar/i.test(e.label);
const count = (arr, f) => { const m = new Map(); arr.forEach(x => { const k = f(x); if (k) m.set(k, (m.get(k) || 0) + 1); }); return [...m].sort((a, b) => b[1] - a[1]).map(([label, c]) => ({ label, count: c })); };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!verify(req)) return res.status(401).json({ error: 'auth' });
  try {
    const range = Math.min(400, Math.max(1, parseInt(req.query.range, 10) || 30));
    const page = String(req.query.page || 'all');
    const now = Date.now();
    const days = []; for (let i = range - 1; i >= 0; i--) days.push(dayKey(now - i * 86400e3));
    const out = await redis([...days.map(d => ['LRANGE', 'ev:' + d, '0', '-1']), ['ZREMRANGEBYSCORE', 'live', '0', String(now - 300000)], ['ZCARD', 'live']]);
    const liveNow = +out[out.length - 1] || 0;
    let evs = [];
    out.slice(0, days.length).forEach(list => (list || []).forEach(s => { try { evs.push(JSON.parse(s)); } catch (e) {} }));
    const pf = PAGES[page];
    if (pf) evs = evs.filter(e => pf(e.path));

    const S = new Map();
    for (const e of evs) {
      let s = S.get(e.sid);
      if (!s) { s = { sid: e.sid, vid: e.vid, t: e.ts, pv: 0, ev: [], dur: 0, sc: 0, clicks: 0, wa: 0, co: 0, buy: 0, src: e.src, dev: e.dev, country: e.country, city: e.city, day: dayKey(e.ts) }; S.set(e.sid, s); }
      if (e.ts < s.t) { s.t = e.ts; s.src = e.src; s.day = dayKey(e.ts); }
      if (e.type === 'pageview') s.pv++;
      if (e.type === 'leave') { s.dur += e.value; s.sc = Math.max(s.sc, e.scroll); }
      if (e.type === 'click' || e.type === 'whatsapp') { s.clicks++; if (e.type === 'whatsapp') s.wa++; if (isCheckout(e)) s.co++; }
      if (e.type === 'purchase') s.buy++;
      if (e.type !== 'leave') s.ev.push(e);
    }
    const sess = [...S.values()].filter(s => s.pv > 0);
    const clickEvs = evs.filter(e => e.type === 'click' || e.type === 'whatsapp');
    const visits = sess.length;
    const unique = new Set(sess.map(s => s.vid)).size;
    const withClick = sess.filter(s => s.clicks > 0).length;
    const co = sess.filter(s => s.co > 0).length;
    const buys = evs.filter(e => e.type === 'purchase').length;
    const timed = sess.filter(s => s.dur > 0);

    const byDay = Object.fromEntries(days.map(d => [d, { visits: 0, clicks: 0 }]));
    sess.forEach(s => { if (byDay[s.day]) byDay[s.day].visits++; });
    clickEvs.forEach(e => { const d = dayKey(e.ts); if (byDay[d]) byDay[d].clicks++; });

    const has = (s, re) => s.ev.some(e => re.test(e.label || ''));
    const funnel = page === 'links'
      ? [{ label: 'Abriram o /links', count: visits }, { label: 'Clicaram em algo', count: withClick }, { label: 'Foram para a plataforma', count: sess.filter(s => has(s, /servico_plataforma/)).length }, { label: 'Viram o Personalizado', count: sess.filter(s => has(s, /servico_personalizado/)).length }, { label: 'Usaram um cupom', count: sess.filter(s => has(s, /^cupom_/)).length }, { label: 'Chamaram no WhatsApp', count: sess.filter(s => s.wa > 0).length }]
      : [{ label: 'Visitas', count: visits }, { label: 'Clicaram em algo', count: withClick }, { label: 'Iniciaram compra', count: co }, { label: 'Compraram', count: buys }];

    const clicks = count(clickEvs, e => (e.label || e.target || '(sem nome)') + '§' + e.path).slice(0, 25).map(x => { const [name, area] = x.label.split('§'); return { name, area, count: x.count }; });
    const reach = (p) => timed.length ? Math.round(timed.filter(s => s.sc >= p).length / timed.length * 100) : 0;
    const fmtTime = (ts) => new Date(ts - 3 * 3600e3).toISOString().slice(11, 16);
    const journeys = sess.sort((a, b) => b.t - a.t).slice(0, 25).map(s => {
      const steps = [];
      s.ev.sort((a, b) => a.ts - b.ts).forEach(e => {
        const t = e.type === 'pageview' ? e.path : e.type === 'purchase' ? 'Compra ✓' : e.type === 'whatsapp' ? 'WhatsApp ↗' : (e.label || 'clique');
        if (steps[steps.length - 1] !== t) steps.push(t);
      });
      return { time: new Date(s.t - 3 * 3600e3).toISOString().slice(8, 10) + '/' + new Date(s.t - 3 * 3600e3).toISOString().slice(5, 7) + ' ' + fmtTime(s.t), id: '#' + s.sid.slice(0, 5), source: s.src, device: s.dev, city: s.city, country: s.country, steps: steps.slice(0, 12) };
    });

    res.status(200).json({
      kpis: { visits, unique, clicks: clickEvs.length, checkouts: co, purchases: buys, avgTime: timed.length ? Math.round(timed.reduce((a, s) => a + s.dur, 0) / timed.length) : 0 },
      daily: days.map(d => ({ date: d, ...byDay[d] })),
      funnel, clicks,
      sources: count(sess, s => s.src).slice(0, 10),
      countries: count(sess, s => country(s.country)).slice(0, 10),
      cities: count(sess, s => s.city ? s.city + (s.country ? ', ' + s.country : '') : '').slice(0, 12),
      devices: { mobile: sess.filter(s => s.dev !== 'Computador').length, desktop: sess.filter(s => s.dev === 'Computador').length },
      scroll: [reach(25), reach(50), reach(75), reach(95)],
      journeys, liveNow,
    });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
