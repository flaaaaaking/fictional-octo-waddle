const { SYSTEM_PROMPT } = require('./prompt');
const dims = ['extraversion','conscientiousness','openness','agreeableness','emotionalSensitivity'];
const dimNames = ['外向性','尽责性','开放性','宜人性','情绪敏感性'];
const intros = ['反映你从外部互动、表达与行动中获得能量的倾向。','反映你组织目标、兑现承诺和持续推进事情的方式。','反映你接触新观念、想象可能性和调整认知的倾向。','反映你建立信任、理解他人并处理合作与边界的方式。','反映你觉察风险、体验情绪以及从压力中恢复的方式。'];
const questions = ['你结束了忙碌的一周，周末突然完全空下来。你通常会怎样安排，为什么？','一个重要任务没有明确截止日期，也没人监督。你会怎么推进它？','朋友提出一个与你原有观念冲突、但论证很完整的看法。你第一反应和之后的做法分别是什么？','团队里有人犯了会拖累大家的错误，但他正处于低谷。你会如何处理？','当你发现自己可能把一件小事搞砸时，接下来几个小时通常会发生什么？','聚会中大多数人彼此不认识，你认识其中两个人。你通常会处于什么位置？','计划执行到一半出现了更有吸引力的新方向，你会怎样决定是否改变路线？','请讲一次你明知会引起冲突，仍然坚持表达不同意见的经历。','面对一个没有实用价值、但很吸引你的复杂问题，你通常会投入到什么程度？','连续承受压力时，你会如何察觉自己快到极限，又如何恢复？'];
function mock(messages, turns) {
  const mockScores = [68,82,76,71,59];
  if (turns >= 10) return { type:'report', shouldStop:true, report:{ persona:{title:'静水探路者',tagline:'温和地观察，坚定地向前。',introduction:'你不急着用一个标签定义自己。面对变化，你习惯先看清情境和代价，再决定投入多少热情、秩序与信任。你既保留独立判断，也愿意在值得的关系中合作；真正推动你的，往往不是外界催促，而是对事情意义的确认。'}, summary:'你展现出兼顾独立判断与情境适应的倾向。当前为 mock 演示报告，接入模型后会依据全部回答生成个性化结论。', dimensions:dims.map((key,i)=>({key,name:dimNames[i],score:mockScores[i],level:mockScores[i]>=70?'偏高':'中等',confidence:55,introduction:intros[i],judgment:'目前证据显示该维度较为稳定，同时仍会受到具体情境影响。',facets:['情境适应','自我觉察']})), stablePatterns:['回答中会主动补充条件，而非简单二选一。'], apparentContradictions:[{pattern:'独立与合作并存',explanation:'你会根据关系和任务成本调整策略。'}], strengths:['能看到情境差异','有反思意识'], blindSpots:['可能低估长期压力对选择的影响'], confidence:{level:'中',score:55,basis:'mock 模式仅用于演示流程，未调用真实模型。'}, disclaimer:'这是基于 Big Five 理论框架的半结构化开放式访谈，不是标准化心理量表，不能提供正式百分位、常模分数或临床诊断。' } };
  return { type:'question', observation: turns ? '我已记录你回答中的条件和取舍，后续会用不同情境交叉验证。' : '先从一个贴近日常的情境开始，不需要刻意组织成标准答案。', question:questions[turns % questions.length], dimensionStatus:Object.fromEntries(dims.map((d,i)=>[d, Math.min(100, Math.max(8, turns*9 + (i*7)%15))])), shouldStop:false };
}
async function complete(messages, turns) {
  if ((process.env.AI_PROVIDER || 'mock') === 'mock') return mock(messages, turns);
  const base = process.env.DEEPSEEK_API_BASE_URL?.replace(/\/$/, '');
  if (!base || !process.env.DEEPSEEK_API_KEY || !process.env.DEEPSEEK_MODEL) throw new Error('DeepSeek 配置不完整');
  const response = await fetch(`${base}/chat/completions`, { method:'POST', headers:{'content-type':'application/json','authorization':`Bearer ${process.env.DEEPSEEK_API_KEY}`}, body:JSON.stringify({model:process.env.DEEPSEEK_MODEL,temperature:0.45,response_format:{type:'json_object'},messages:[{role:'system',content:SYSTEM_PROMPT+'\n最终报告必须包含 persona.title、persona.tagline、persona.introduction。每个 dimensions 项必须包含 score（0-100倾向指数）与 introduction，并保证五维都出现。'},...messages]}) });
  if (!response.ok) throw new Error(`模型接口返回 ${response.status}`);
  const data = await response.json(); return JSON.parse(data.choices[0].message.content);
}
module.exports = { complete };
