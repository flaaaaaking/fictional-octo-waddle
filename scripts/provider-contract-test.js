const assert = require('node:assert/strict');
const { DIMENSIONS, FACETS } = require('../server/assessment');

process.env.AI_PROVIDER = 'deepseek';
process.env.DEEPSEEK_API_BASE_URL = 'https://contract.test';
process.env.DEEPSEEK_API_KEY = 'test-only';
process.env.DEEPSEEK_MODEL = 'test-model';
process.env.MAX_TURNS_PER_SESSION = '66';

function report(analysisState) {
  const value = {
    type: 'report', shouldStop: true,
    report: {
      persona: { title: '契约测试画像', tagline: '测试', introduction: '测试' }, summary: '这是用于校验结构的模拟摘要，不代表真实人格结论。',
      dimensions: DIMENSIONS.map((dimension, index) => ({ key: dimension.key, name: dimension.name, score: 52 + index * 5, facets: dimension.facets.map((facet, facetIndex) => ({ key: facet.key, name: facet.name, score: 50 + index * 5 + facetIndex, explanation: '模拟解释' })), evidence: [], counterEvidence: [], strengthExpression: '功能', watchout: '代价' })),
      facetRanking: [], stablePatterns: [], apparentContradictions: [], interpersonalStyle: {}, valueThemes: [], strengths: [], blindSpots: [], growthPlan: [], changeablePatterns: [], confidence: {}, disclaimer: '测试'
    }
  };
  if (analysisState) value.analysisState = analysisState;
  return value;
}

const fullState = {
  facetCoverage: Object.fromEntries(FACETS.map(facet => [facet.key, 2])),
  evidence: FACETS.map((facet, index) => ({ facet: facet.key, direction: 'mixed', sourceTurn: index + 1, context: `情境 ${index + 1}`, behavior: `行为 ${index + 1}`, condition: '存在明确条件', strength: 2 })),
  contradictions: [], openQuestions: [], noNewInformationStreak: 0
};

const response = content => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }) });

(async () => {
  const { complete } = require('../server/provider');

  const queue = [response(report()), response({ analysisState: fullState })];
  global.fetch = async () => queue.shift();
  const transcript = Array.from({ length: 15 }, (_, index) => ({ role: 'user', content: `第 ${index + 1} 个模拟行为回答` }));
  const final = await complete(transcript, 66);
  assert.equal(final.report.evidenceAppendix.length, 15, '空账本必须触发独立提取并生成证据索引');
  assert.ok(final.report.confidence.score >= 50, '具体证据不得被计算成空白可信度');

  const earlyQueue = [response(report(fullState)), response({ type: 'question', question: '请再讲一个最近真实发生的例子。', observation: '现有资料尚需交叉核对。', analysisState: fullState, shouldStop: false })];
  global.fetch = async () => earlyQueue.shift();
  const early = await complete([{ role: 'user', content: '我通常会看情况。' }], 1);
  assert.equal(early.type, 'question', '未达最小轮次时必须修正为继续提问');
  assert.ok(early.questionPlan.targetFacet, '修正后的问题必须有可审计问题计划');

  console.log(JSON.stringify({ ok: true, extractedEvidence: final.report.evidenceAppendix.length, confidence: final.report.confidence.score, earlyReportBlocked: early.type === 'question' }, null, 2));
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
