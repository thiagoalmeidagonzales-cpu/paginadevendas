// Login do painel (verificado no servidor). Trava após N erros por IP até mudar "destravar" no _config.js
const { cfg, redis, sha256, ipHash, sign, setCookie, body } = require('./_lib');
const crypto = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const key = 'fail:' + cfg.destravar + ':' + ipHash(req);
  try {
    const [n0] = await redis([['GET', key]]);
    const n = +n0 || 0;
    if (n >= cfg.max_tentativas) return res.status(429).json({ error: 'bloqueado', left: 0 });
    const b = body(req);
    const u = String(b.user || '').trim(), p = String(b.pass || '');
    const eq = (a, c) => a.length === c.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(c));
    await new Promise(r => setTimeout(r, 600));
    if (eq(u, cfg.usuario) && eq(sha256(p), cfg.senha_sha256)) {
      await redis([['DEL', key]]);
      const h = cfg.sessao_horas || 12;
      setCookie(res, sign({ exp: Date.now() + h * 3600e3 }), h * 3600);
      return res.status(200).json({ ok: true });
    }
    const [nn] = await redis([['INCR', key], ['EXPIRE', key, String(365 * 86400)]]);
    const left = Math.max(0, cfg.max_tentativas - nn);
    return res.status(left ? 401 : 429).json({ error: left ? 'incorreto' : 'bloqueado', left });
  } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
};
