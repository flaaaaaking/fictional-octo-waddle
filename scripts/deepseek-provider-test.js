const { complete } = require('../server/provider');

const initial = {role:'assistant', content:JSON.stringify({type:'question',observation:'从日常情境开始。',question:'最近一次和朋友一起度过时间时，你做了什么？',coverageStatus:{extraversion:10,conscientiousness:0,openness:0,agreeableness:5,emotionalSensitivity:0},analysisState:{facetCoverage:{sociability:1},evidence:[],contradictions:[],openQuestions:['社交主动性与独处恢复'],noNewInformationStreak:0},shouldStop:false})};

const profiles = [
  [
    '陌生聚会里我会先观察，遇到真正感兴趣的话题才主动加入；聊得再开心，两三个小时后也会想独处恢复。',
    '没人监督的长期任务，我会先定交付节点，每周复盘；如果目标失去意义，我会先验证新路线再调整。',
    '朋友犯错时我会先控制影响，再私下谈事实和责任；我会照顾感受，但不会替对方承担修复。',
    '别人挑战我的看法时我会先不舒服，但会请他给证据；理由更好时我会改观点，并说明自己为何改变。',
    '我会因为配色、空间和音乐的氛围停下来，也喜欢把不同领域的概念连成新方案。',
    '压力上来时我会先反复检查，之后列清单行动；睡眠不足会让我更易烦躁，休息和散步能恢复。',
    '冲突里我通常把人与问题分开，先说明共同目标，再讲边界；如果对方持续推卸，我会减少合作。',
    '连续失败时我会短暂低落并减少社交，但仍能维持最低任务；通常一两天后靠运动和拆步骤回来。',
    '在团队需要方向而没人说话时我会提出方案；有人更适合带领时，我也愿意支持而不是争主导。',
    '面对抽象问题，即使没有直接收益我也会读很久；但真要执行时，我会先做小实验控制成本。',
    '承诺一旦说出口我会尽量兑现，若确实做不到会提前说明并提出替代，而不是等到最后消失。',
    '我对陌生人先保留信任，对方连续兑现小承诺后会逐步开放；一次重大欺骗会让我长期提高门槛。',
    '计划被打断时我会烦，但通常能很快重新排序；只有连续失控又睡不好时，情绪才会明显放大。',
    '我能主动认识人，却不依赖大量社交获得满足；一对一深聊比热闹场合更让我觉得有连接。',
    '创作时我常先想很多可能性，再用限制条件筛选；截止期临近时，我反而能快速收束并完成。'
  ]
];

function transcript(answers) {
  return answers.flatMap((answer, index) => [
    {role:'assistant', content:JSON.stringify({type:'question',question:`证据核对问题 ${index + 1}`,analysisState:{facetCoverage:{},evidence:[],contradictions:[],openQuestions:[],noNewInformationStreak:0}})},
    {role:'user', content:answer}
  ]);
}

(async () => {
  const reportOnly = process.argv.includes('--report-only');
  const reserved = reportOnly ? null : await complete([initial,{role:'user',content:'我通常只和熟悉的一两个人聊，聚会结束后想马上独处；除非有明确任务，否则不会主动认识新人。'}],1);
  const outgoing = reportOnly ? null : await complete([initial,{role:'user',content:'我会主动招呼大家、介绍彼此，常常自然地推动活动继续；结束后通常还很兴奋，想再约下一场。'}],1);
  const final = await complete(transcript(profiles[0]),66);
  const report = final.report || {};
  const facets = report.facetRanking || [];
  console.log(JSON.stringify({
    provider: process.env.AI_PROVIDER,
    model: process.env.DEEPSEEK_MODEL,
    dynamicQuestions: reportOnly ? '本次跳过，已由上一轮验证' : {reserved: reserved.question, outgoing: outgoing.question, different: reserved.question !== outgoing.question},
    report: {type: final.type, dimensions: report.dimensions?.length, facets: facets.length, ranked: facets.every((x,i)=>i===0||facets[i-1].score>=x.score), growthPlans: report.growthPlan?.length, summaryChars: report.summary?.length, confidence: report.confidence?.score, hasMissingInfoList: Boolean(report.confidence?.gaps), title: report.persona?.title}
  }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
