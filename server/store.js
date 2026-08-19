const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const file = process.env.DATA_STORE_FILE || path.join(__dirname, '..', 'data', 'store.json');
const empty = () => ({ days: {}, sessions: {}, access: {} });
function load() { try { return { ...empty(), ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch { return empty(); } }
function save(db) { const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, file); }
const resetTimeZone = () => process.env.DAILY_RESET_TIMEZONE || 'Asia/Shanghai';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: resetTimeZone() }).format(new Date());
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const randomCode = () => Array.from(crypto.randomBytes(10), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('').match(/.{1,5}/g).join('-');

function createSession(db, ttlHours, researchConsent = false) {
  const id = crypto.randomBytes(24).toString('base64url');
  const now = Date.now();
  db.sessions[id] = {
    createdAt: now,
    expiresAt: now + ttlHours * 3600000,
    turns: 0,
    messages: [],
    consent: {
      service: true,
      research: Boolean(researchConsent),
      version: '2026-08-19',
      updatedAt: now
    }
  };
  return id;
}
function claimDailySlot(dailyLimit, ttlHours, researchConsent = false) {
  const db = load(), day = today();
  db.days[day] ||= { participants: [] };
  // 兼容旧数据，但只按新制 participant 计数。
  db.days[day].participants ||= [];
  if (db.days[day].participants.length >= dailyLimit) throw new Error(`今天的 ${dailyLimit} 个访谈名额已经领完，北京时间零点恢复。`);
  let code; do { code = randomCode(); } while (db.access[hash(code)]);
  const sessionId = createSession(db, ttlHours, researchConsent);
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
function updateConsent(id, researchConsent) {
  return updateSession(id, session => {
    session.consent = {
      service: true,
      research: Boolean(researchConsent),
      version: '2026-08-19',
      updatedAt: Date.now()
    };
  });
}
function consentOf(session) {
  return {
    service: true,
    research: Boolean(session?.consent?.research),
    version: session?.consent?.version || 'legacy',
    updatedAt: session?.consent?.updatedAt || null
  };
}
function availability(dailyLimit) { const db = load(), day = today(), used = db.days[day]?.participants?.length || 0; return { day, used, remaining: Math.max(0, dailyLimit - used), limit: dailyLimit, resetTimeZone: resetTimeZone(), resetHour: 0 }; }
module.exports = { claimDailySlot, loginWithCode, getSession, updateSession, updateConsent, consentOf, availability };
