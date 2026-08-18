const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { claimDailySlot, loginWithCode, getSession, updateSession, availability } = require('./store');
const { complete } = require('./provider');

function loadEnv() { try { for (const line of fs.readFileSync(path.join(__dirname,'..','.env'),'utf8').split(/\r?\n/)) { const m=line.match(/^([^#=]+)=(.*)$/); if(m&&!process.env[m[1].trim()]) process.env[m[1].trim()]=m[2].trim(); } } catch {} }
loadEnv();
const port = Number(process.env.PORT || 3000), limit = Number(process.env.DAILY_CODE_LIMIT || 10), maxTurns = Number(process.env.MAX_TURNS_PER_SESSION || 66), ttl = Number(process.env.SESSION_TTL_HOURS || 87600);
const publicDir = path.join(__dirname, '..', 'public');
const json = (res,status,data) => { res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}); res.end(JSON.stringify(data)); };
const body = req => new Promise((resolve,reject)=>{ let s=''; req.on('data',c=>{s+=c;if(s.length>50000)req.destroy();}); req.on('end',()=>{try{resolve(JSON.parse(s||'{}'))}catch(e){reject(e)}}); });
const cookies = req => Object.fromEntries((req.headers.cookie||'').split(';').filter(Boolean).map(x=>x.trim().split('=').map(decodeURIComponent)));
const sign = id => `${id}.${crypto.createHmac('sha256',process.env.SESSION_SECRET||'dev-only-change-me').update(id).digest('base64url')}`;
function sessionId(req) { const token=cookies(req).bf_session||'', [id,sig]=token.split('.'); if(!id||!sig)return null; const expected=sign(id).split('.')[1]; try{return crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))?id:null}catch{return null} }

const server = http.createServer(async(req,res)=>{ try {
  if(req.method==='GET'&&req.url==='/api/access/availability') return json(res,200,availability(limit));
  if(req.method==='POST'&&req.url==='/api/access/claim'){ const issued=claimDailySlot(limit,ttl); res.setHeader('set-cookie',`bf_session=${encodeURIComponent(sign(issued.sessionId))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ttl*3600}`); return json(res,200,{code:issued.code,remaining:issued.remaining}); }
  if(req.method==='POST'&&req.url==='/api/access/login'){ const b=await body(req), id=loginWithCode(String(b.code||''),ttl); if(!id)return json(res,401,{error:'访问码无效'}); res.setHeader('set-cookie',`bf_session=${encodeURIComponent(sign(id))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ttl*3600}`); return json(res,200,{ok:true}); }
  if(req.method==='GET'&&req.url==='/api/session'){ const s=getSession(sessionId(req)); if(!s)return json(res,401,{error:'需要访问码'}); let current=null; const last=[...s.messages].reverse().find(m=>m.role==='assistant'); try{current=last?JSON.parse(last.content):null}catch{} return json(res,200,{turns:s.turns,maxTurns,current}); }
  if(req.method==='POST'&&req.url==='/api/interview'){ const id=sessionId(req), s=getSession(id); if(!s)return json(res,401,{error:'会话已失效'}); if(s.turns>=maxTurns)return json(res,429,{error:'本次访谈已达到最大题数'}); const b=await body(req), answer=String(b.answer||'').trim(); if(s.messages.length&&answer.length<2)return json(res,400,{error:'请写下你的真实想法后再继续'}); const messages=[...s.messages]; if(answer)messages.push({role:'user',content:answer}); const result=await complete(messages,s.turns); updateSession(id,x=>{if(answer)x.messages.push({role:'user',content:answer}); x.messages.push({role:'assistant',content:JSON.stringify(result)}); x.turns+=result.type==='question'?1:0;}); return json(res,200,result); }
  if(req.method==='GET'&&(req.url==='/'||!req.url.startsWith('/api/'))){ const rel=req.url==='/'?'index.html':req.url.slice(1), file=path.join(publicDir,rel); if(!file.startsWith(publicDir)||!fs.existsSync(file))return json(res,404,{error:'Not found'}); const ext=path.extname(file), types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png'}; res.writeHead(200,{'content-type':types[ext]||'application/octet-stream'}); return fs.createReadStream(file).pipe(res); }
  json(res,404,{error:'Not found'});
 } catch(e){ json(res,500,{error:e.message||'服务器错误'}); } });
server.listen(port,()=>console.log(`五大人格反饋計畫：http://localhost:${port}`));
