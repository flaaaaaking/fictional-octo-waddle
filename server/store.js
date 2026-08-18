const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const file = path.join(__dirname, '..', 'data', 'store.json');
const empty = () => ({ days: {}, sessions: {}, access: {} });
function load() { try { return { ...empty(), ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch { return empty(); } }
function save(db) { const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, file); }
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date());
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const randomCode = () => Array.from(crypto.randomBytes(10), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('').match(/.{1,5}/g).join('-');

function createSession(db, ttlHours) {
  const id = crypto.randomBytes(24).toString('base64url');
  db.sessions[id] = { createdAt: Date.now(), expiresAt: Date.now() + ttlHours * 3600000, turns: 0, messages: [] };
  return id;
}
function claimDailySlot(dailyLimit, ttlHours) {
  const db = load(), day = today();
  db.days[day] ||= { participants: [] };
  // 兼容旧数据，但只按新制 participant 计数。
  db.days[day].participants ||= [];
  if (db.days[day].participants.length >= dailyLimit) throw new Error('今天的 10 个访谈名额已经领完，请明天再来。');
  let code; do { code = randomCode(); } while (db.access[hash(code)]);
  const sessionId = createSession(db, ttlHours);
  db.access[hash(code)] = { sessionId, createdAt: Date.now() };
  db.days[day].participants.push({ sessionId, createdAt: Date.now() });
  save(db);
  return { code, sessionId, remaining: dailyLimit - db.days[day].participants.length };
}
function loginWithCode(code, ttlHours) {
  const db = load(), access = db.access[hash(String(code).trim().toUpperCase())];
  if (!access || !db.sessions[access.sessionId]) return null;
  // 每次凭访问码回来都续期；访谈和报告仍是原来的同一个会话。
  db.sessions[access.sessionId].expiresAt = Date.now() + ttlHours * 3600000;
  save(db); return access.sessionId;
}
function getSession(id) { const db = load(), s = db.sessions[id]; return s && s.expiresAt > Date.now() ? s : null; }
function updateSession(id, fn) { const db = load(); if (!db.sessions[id]) return null; fn(db.sessions[id]); save(db); return db.sessions[id]; }
function availability(dailyLimit) { const db = load(), used = db.days[today()]?.participants?.length || 0; return { used, remaining: Math.max(0, dailyLimit - used), limit: dailyLimit }; }
module.exports = { claimDailySlot, loginWithCode, getSession, updateSession, availability };
