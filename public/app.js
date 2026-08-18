const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const API_BASE_URL=String(window.__APP_CONFIG__?.API_BASE_URL||'').replace(/\/$/,'');
const traits={
  extraversion:{name:'外向性',guide:'連結推動者',tagline:'在連結與獨處之間找到能量節奏',color:'#E99A45',image:'./characters/extraversion.png'},
  conscientiousness:{name:'盡責性',guide:'秩序建設者',tagline:'讓重要的事從想法走向完成',color:'#3B6FCB',image:'./characters/conscientiousness.png'},
  openness:{name:'開放性',guide:'世界探索者',tagline:'為觀念、審美與可能性保留空間',color:'#7667E8',image:'./characters/openness.png'},
  agreeableness:{name:'宜人性',guide:'關係協調者',tagline:'理解他人，也守住彼此的邊界',color:'#45A58A',image:'./characters/agreeableness.png'},
  emotionalSensitivity:{name:'情緒敏感性',guide:'內在感知者',tagline:'辨認壓力、風險與恢復的訊號',color:'#D96C7D',image:'./characters/emotional-sensitivity.png'}
};
let turn=0;
const toast=m=>{const x=$('#toast');x.textContent=m;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2800)};
async function api(url,options={}){const accessCode=sessionStorage.getItem('bigfive_access_code')||'';const r=await fetch(`${API_BASE_URL}${url}`,{...options,credentials:'include',headers:{'content-type':'application/json',...(accessCode?{'x-access-code':accessCode}:{}),...(options.headers||{})}});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||'服務暫時無法回應');return d}
function show(id){['gate','codeReveal','interview','report'].forEach(x=>$(`#${x}`).classList.toggle('hidden',x!==id));$('.group-intro').classList.toggle('hidden',id!=='gate')}
async function refreshSlots(){try{const a=await api('/api/access/availability');$('#slots').textContent=`今日剩餘 ${a.remaining} / ${a.limit} 個名額`;$('#claim').disabled=a.remaining===0}catch{$('#slots').textContent='名額讀取失敗'}}
function coverage(v={}){$('#dims').innerHTML=Object.entries(traits).map(([k,t])=>`<div class="dim"><label><span>${t.name}</span><span>${Math.round(v[k]||0)}%</span></label><div class="bar"><i style="width:${v[k]||0}%;background:${t.color}"></i></div></div>`).join('')}
async function next(answer=''){try{$('#send').disabled=true;const d=await api('/api/interview',{method:'POST',body:JSON.stringify({answer})});if(d.type==='report')return renderReport(d.report);turn++;$('#turn').textContent=turn;$('#question').textContent=d.question;$('#observation').textContent=d.observation;$('#answer').value='';coverage(d.coverageStatus||d.dimensionStatus)}catch(e){toast(e.message)}finally{$('#send').disabled=false}}
const chips=items=>(items||[]).map(x=>`<span>${esc(typeof x==='string'?x:x.name||x.level)}</span>`).join('');
function renderDimension(d,i){const t=traits[d.key]||{guide:d.name,tagline:'',color:'#607080',image:''};return `<article class="dimension-card" style="--dimension-color:${t.color}">
  <div class="dimension-character"><img src="${t.image}" alt="${esc(t.guide)}角色立繪"><span>0${i+1}</span></div>
  <div class="dimension-heading"><small>${esc(d.name)} · ${esc(d.level)}</small><h3>${esc(t.guide)}</h3><p>${esc(t.tagline)}</p><div class="range"><b>${esc(d.range||`${d.score??'—'}`)}</b><span>傾向區間 · 非百分位</span></div></div>
  <div class="dimension-body"><p class="dimension-intro">${esc(d.introduction)}</p><p>${esc(d.judgment)}</p>
    <div class="facet-grid">${(d.facets||[]).map(f=>`<div><b>${esc(f.name)}</b><em>${esc(f.level)}</em><p>${esc(f.explanation)}</p></div>`).join('')}</div>
    <h4>判斷依據</h4><div class="evidence-list">${(d.evidence||[]).map(e=>`<div><b>${esc(e.context)}</b><p>${esc(e.behavior)}</p><small>${esc(e.meaning)}${e.condition?` · 條件：${esc(e.condition)}`:''}</small></div>`).join('')||'<p>目前證據仍不足。</p>'}</div>
    ${(d.counterEvidence||[]).length?`<p class="counter"><b>反向證據／限制：</b>${esc(d.counterEvidence.join('；'))}</p>`:''}
    <div class="two-note"><p><b>可能發揮的功能</b>${esc(d.strengthExpression)}</p><p><b>需要留意的代價</b>${esc(d.watchout)}</p></div>
    <small class="confidence"><b>${esc(d.confidence)} / 100</b> 證據可信度</small>
  </div></article>`}
function insightCards(title,items,render){return `<section class="insight-section"><div class="section-title"><span></span><h2>${title}</h2></div><div class="insight-grid">${(items||[]).map(render).join('')||'<p>目前沒有足夠資訊。</p>'}</div></section>`}
function renderReport(r){show('report');const rank=x=>Number.isFinite(Number(x.score))?Number(x.score):parseInt(x.range||0);const sorted=[...(r.dimensions||[])].sort((a,b)=>rank(b)-rank(a));const p=r.persona||{};const experimentCode=sessionStorage.getItem('bigfive_access_code')||'';$('#reportExperimentCode').textContent=experimentCode?`實驗代碼 ${experimentCode}`:'';$('#personaTitle').textContent=p.title||'你的五維輪廓';$('#personaTagline').textContent=p.tagline||'五個維度，共同寫成一個人。';$('#personaIntro').textContent=p.introduction||r.summary;$('#personaCharacter').src=(traits[sorted[0]?.key]||traits.openness).image;$('#summary').textContent=r.summary;$('#dimensionCards').innerHTML=sorted.map(renderDimension).join('');
  const stable=insightCards('穩定模式',r.stablePatterns,x=>`<article><h3>${esc(x.pattern||x)}</h3><p>${esc(x.evidence)}</p><small>${esc(x.when)}</small></article>`);
  const contradictions=insightCards('表面矛盾',r.apparentContradictions,x=>`<article><h3>${esc(x.pattern)}</h3><p>${esc(x.explanation)}</p><small>切換條件：${esc(x.trigger)}</small></article>`);
  const strengths=insightCards('優勢與代價',r.strengths,x=>`<article><h3>${esc(x.strength||x)}</h3><p>${esc(x.bestContext)}</p><small>過度使用：${esc(x.cost)}</small></article>`);
  const blind=insightCards('潛在盲區',r.blindSpots,x=>`<article><h3>${esc(x.blindSpot||x)}</h3><p>預警：${esc(x.signal)}</p><small>可嘗試：${esc(x.suggestion)}</small></article>`);
  const values=insightCards('回答中反覆出現的價值主題',r.valueThemes,x=>`<article><h3>${esc(x.value)}</h3><p>${esc(x.evidence)}</p><small>可能的張力：${esc(x.tension)}</small></article>`);
  const interpersonal=r.interpersonalStyle||{};
  $('#reportDetails').innerHTML=stable+contradictions+`<section class="insight-section"><div class="section-title"><span></span><h2>人際互動風格</h2></div><div class="interpersonal"><p><b>能動性</b>${esc(interpersonal.agency)}</p><p><b>共同性</b>${esc(interpersonal.communion)}</p><p><b>二者如何互動</b>${esc(interpersonal.interaction)}</p></div></section>`+values+strengths+blind+insightCards('較可能隨環境改變的部分',r.changeablePatterns,x=>`<article><p>${esc(x)}</p></article>`)+`<section class="confidence-panel"><h2>這份報告有多可信？</h2><div><b>${esc(r.confidence?.score)} / 100</b><p><strong>${esc(r.confidence?.level)}可信度</strong><br>${esc(r.confidence?.basis)}</p></div><h3>仍缺少的資訊</h3><div class="facet-row">${chips(r.confidence?.gaps)}</div><p class="fine">${esc(r.disclaimer)}</p></section>`}
function restore(d){if(d?.type==='report')return renderReport(d.report);if(!d)return next();$('#question').textContent=d.question;$('#observation').textContent=d.observation;coverage(d.coverageStatus||d.dimensionStatus)}
$('#claim').onclick=async()=>{try{$('#claim').disabled=true;const d=await api('/api/access/claim',{method:'POST',body:'{}'});sessionStorage.setItem('bigfive_access_code',d.code);$('#issuedCode').textContent=d.code;show('codeReveal');$('#slots').textContent=`今日剩餘 ${d.remaining} / 10 個名額`}catch(e){toast(e.message);refreshSlots()}};
$('#enterInterview').onclick=()=>{show('interview');coverage();next()};
$('#login').onclick=async()=>{try{const code=$('#code').value.trim().toUpperCase();sessionStorage.setItem('bigfive_access_code',code);await api('/api/access/login',{method:'POST',body:JSON.stringify({code})});const s=await api('/api/session');show('interview');turn=s.turns;$('#turn').textContent=turn;restore(s.current)}catch(e){sessionStorage.removeItem('bigfive_access_code');toast(e.message)}};
$('#send').onclick=()=>next($('#answer').value);$('#answer').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')$('#send').click()});
(async()=>{const sharedCode=new URLSearchParams(location.search).get('code');if(sharedCode){sessionStorage.setItem('bigfive_access_code',sharedCode.toUpperCase());history.replaceState({},'',location.pathname)}refreshSlots();try{const s=await api('/api/session');show('interview');turn=s.turns;$('#turn').textContent=turn;restore(s.current)}catch{show('gate')}})();
