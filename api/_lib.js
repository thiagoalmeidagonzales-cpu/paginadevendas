const crypto = require('crypto');
const cfg = require('./_config');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.STORAGE_REST_API_URL || process.env.STORAGE_KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.STORAGE_REST_API_TOKEN || process.env.STORAGE_KV_REST_API_TOKEN;

async function redis(cmds) {
  if (!URL_ || !TOKEN) throw new Error('Banco não conectado: crie o Upstash Redis em Vercel > Storage e conecte ao projeto.');
  const r = await fetch(URL_ + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error('Redis: ' + JSON.stringify(j));
  return j.map(x => x.result);
}

const dayKey = (ts) => new Date(ts - 3 * 3600e3).toISOString().slice(0, 10); // horário de Brasília
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const ip = (req) => String(req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0] || '').trim();
const ipHash = (req) => sha256('ip:' + ip(req)).slice(0, 24);
const secret = () => process.env.SESSION_SECRET || sha256(cfg.senha_sha256 + cfg.destravar + cfg.usuario);

function sign(payload) {
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return p + '.' + crypto.createHmac('sha256', secret()).update(p).digest('base64url');
}
function verify(req) {
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)ipdev=([^;]+)/);
  if (!m) return false;
  const [p, s] = m[1].split('.');
  if (!p || !s) return false;
  const good = crypto.createHmac('sha256', secret()).update(p).digest('base64url');
  if (good.length !== s.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(s))) return false;
  try { const o = JSON.parse(Buffer.from(p, 'base64url').toString()); return o.exp > Date.now(); } catch (e) { return false; }
}
function setCookie(res, value, maxAge) {
  res.setHeader('Set-Cookie', `ipdev=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}
function body(req) { let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } } return b || {}; }

function ua(s) {
  const dev = /iPad|Tablet|Android(?!.*Mobile)/i.test(s) ? 'Tablet' : /Mobi|iPhone|iPod|Android/i.test(s) ? 'Celular' : 'Computador';
  const brs = [['Instagram', /Instagram/i], ['Facebook', /FBAN|FBAV|FB_IAB/i], ['Samsung Internet', /SamsungBrowser/i], ['Edge', /Edg(e|A|iOS)?\//i], ['Opera', /OPR\/|Opera/i], ['Chrome', /CriOS|Chrome\//i], ['Firefox', /FxiOS|Firefox\//i], ['Safari', /Safari\//i]];
  const oss = [['iOS', /iPhone|iPad|iPod/i], ['Android', /Android/i], ['Windows', /Windows/i], ['macOS', /Mac OS X|Macintosh/i], ['Linux', /Linux/i]];
  return [dev, (brs.find(b => b[1].test(s)) || ['Outro'])[0], (oss.find(o => o[1].test(s)) || ['Outro'])[0]];
}

function source(a) {
  const us = String(a.us || '').toLowerCase().trim(), um = String(a.um || '').toLowerCase().trim(), ref = String(a.rh || '').toLowerCase();
  const paid = /cpc|ppc|paid|pago|ads?$|cpm|display|anuncio/.test(um);
  if (a.gclid) return ['Google Ads', 'cpc'];
  if (us) {
    if (/^(facebook|fb|meta|instagram|ig)/.test(us)) { if (paid) return ['Meta Ads', um]; return [/^(ig|insta)/.test(us) ? 'Instagram' : 'Facebook', um || 'social']; }
    if (us.startsWith('google')) return [paid ? 'Google Ads' : 'Google', um || (paid ? 'cpc' : 'orgânico')];
    return [us.charAt(0).toUpperCase() + us.slice(1, 40), um || '(não definido)'];
  }
  if (a.fbclid) return [ref.includes('instagram') ? 'Instagram' : 'Facebook', 'social'];
  if (!ref) return ['Direto', 'nenhum'];
  const map = [[/(^|\.)google\./, 'Google', 'orgânico'], [/(^|\.)bing\.com/, 'Bing', 'orgânico'], [/instagram/, 'Instagram', 'social'], [/facebook|fb\.com|fb\.me/, 'Facebook', 'social'], [/whatsapp|wa\.me/, 'WhatsApp', 'social'], [/youtube|youtu\.be/, 'YouTube', 'social'], [/tiktok/, 'TikTok', 'social'], [/t\.co$|twitter|x\.com/, 'X / Twitter', 'social'], [/linktr\.ee/, 'Linktree', 'social'], [/chatgpt|openai/, 'ChatGPT', 'ia'], [/perplexity/, 'Perplexity', 'ia']];
  const m = map.find(x => x[0].test(ref));
  return m ? [m[1], m[2]] : [ref, 'referência'];
}

module.exports = { cfg, redis, dayKey, sha256, ipHash, sign, verify, setCookie, body, ua, source };
