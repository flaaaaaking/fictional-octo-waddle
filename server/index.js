const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { claimDailySlot, loginWithCode, getSession, updateSession, availability } = require('./store');
const { complete, normalizeResult } = require('./provider');

function loadEnv() { try { for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) { const m = line.match(/^([^#=]+)=(.*)$/); if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim(); } } catch {} }
loadEnv();
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';
const limit = Number(process.env.DAILY_CODE_LIMIT || 10);
const maxTurns = Number(process.env.MAX_TURNS_PER_SESSION || 66);
const ttl = Number(process.env.SESSION_TTL_HOURS || 87600);
const allowedOrigins = new Set(String(process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean));
const production = process.env.NODE_ENV === 'production';
const publicDir = path.join(__dirname, '..', 'public');
const buckets = new Map();

const json = (res, status, data) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); };
function requestIp(req) { return String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim(); }
function allowedOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (!allowedOrigins.has(origin)) { json(res, 403, { error: '來源未獲允許' }); return false; }
  res.setHeader('access-control-allow-origin', origin);
  res.setHeader('access-control-allow-credentials', 'true');
  res.setHeader('vary', 'Origin');
  return true;
}
function rateLimit(req, res, group, max, windowMs) {
  const now = Date.now(), key = `${group}:${requestIp(req)}`, current = buckets.get(key);
  const bucket = !current || current.reset <= now ? { count: 0, reset: now + windowMs } : current;
  bucket.count += 1; buckets.set(key, bucket);
  if (bucket.count <= max) return true;
  res.setHeader('retry-after', Math.ceil((bucket.reset - now) / 1000));
  json(res, 429, { error: '請稍後再試' }); return false;
}
const body = req => new Promise((resolve, reject) => { let s = ''; req.on('data', c => { s += c; if (Buffer.byteLength(s, 'utf8') > 12000) { reject(new Error('too-large')); req.destroy(); } }); req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { reject(new Error('invalid-json')); } }); });
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(x => x.trim().split('=').map(decodeURIComponent)));
const sign = id => `${id}.${crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev-only-change-me').update(id).digest('base64url')}`;
function sessionId(req) { const code = String(req.headers['x-access-code'] || '').trim(); if (code) return loginWithCode(code, ttl); const token = cookies(req).bf_session || '', [id, sig] = token.split('.'); if (!id || !sig) return null; const expected = sign(id).split('.')[1]; try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? id : null; } catch { return null; } }
function setSession(res, id) { res.setHeader('set-cookie', `bf_session=${encodeURIComponent(sign(id))}; HttpOnly; SameSite=None; Path=/; Max-Age=${ttl * 3600}${production ? '; Secure' : ''}`); }

const server = http.createServer(async (req, res) => {
  try {
    if (!allowedOrigin(req, res)) return;
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,x-access-code', 'access-control-max-age': '86400' }); return res.end(); }
    if (req.url.startsWith('/api/') && !rateLimit(req, res, 'api', 120, 15 * 60 * 1000)) return;
    if (req.method === 'GET' && req.url === '/api/access/availability') return json(res, 200, availability(limit));
    if (req.method === 'POST' && req.url === '/api/access/claim') { if (!rateLimit(req, res, 'claim', 8, 24 * 60 * 60 * 1000)) return; const issued = claimDailySlot(limit, ttl); setSession(res, issued.sessionId); return json(res, 200, { code: issued.code, remaining: issued.remaining }); }
    if (req.method === 'POST' && req.url === '/api/access/login') { const b = await body(req), id = loginWithCode(String(b.code || ''), ttl); if (!id) return json(res, 401, { error: '訪問碼無效' }); setSession(res, id); return json(res, 200, { ok: true }); }
    if (req.method === 'GET' && req.url === '/api/session') { const s = getSession(sessionId(req)); if (!s) return json(res, 401, { error: '需要訪問碼' }); let current = null; const last = [...s.messages].reverse().find(m => m.role === 'assistant'); try { current = last ? normalizeResult(JSON.parse(last.content)) : null; } catch {} return json(res, 200, { turns: s.turns, maxTurns, current }); }
    if (req.method === 'POST' && req.url === '/api/interview') { if (!rateLimit(req, res, 'interview', 80, 60 * 60 * 1000)) return; const id = sessionId(req), s = getSession(id); if (!s) return json(res, 401, { error: '會話已失效' }); const b = await body(req), answer = String(b.answer || '').trim(); if (answer.length > 6000) return json(res, 400, { error: '回答內容過長，請濃縮後再送出' }); if (s.messages.length && answer.length < 2) return json(res, 400, { error: '請寫下你的真實想法後再繼續' }); const messages = [...s.messages]; if (answer) messages.push({ role: 'user', content: answer }); const result = await complete(messages.slice(-40), s.turns); if (s.turns >= maxTurns && result.type !== 'report') throw new Error('达到最大题数时模型未能生成报告'); updateSession(id, x => { if (answer) x.messages.push({ role: 'user', content: answer }); x.messages.push({ role: 'assistant', content: JSON.stringify(result) }); x.turns += result.type === 'question' ? 1 : 0; }); return json(res, 200, result); }
    if (req.method === 'GET' && (req.url === '/' || !req.url.startsWith('/api/'))) { const pathname = req.url.split('?')[0], rel = pathname === '/' ? 'index.html' : pathname.slice(1), file = path.join(publicDir, rel); if (!file.startsWith(publicDir) || !fs.existsSync(file)) return json(res, 404, { error: 'Not found' }); const ext = path.extname(file), types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png' }; res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' }); return fs.createReadStream(file).pipe(res); }
    json(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error('[api-error]', error.message);
    json(res, error.message === 'too-large' ? 413 : 500, { error: error.message === 'too-large' ? '請求內容過大' : '服務暫時無法回應，請稍後再試' });
  }
});
server.listen(port, host, () => console.log(`五大人格反饋計畫 API：http://${host}:${port}`));
