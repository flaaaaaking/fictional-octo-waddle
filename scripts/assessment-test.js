const assert = require('node:assert/strict');
const { DIMENSIONS, FACETS, normalizeAnalysisState, computeConfidence, tendencyRange, coverageStatus, normalizeQuestionPlan } = require('../server/assessment');
const { normalizeResult } = require('../server/provider');

function ledger(level, answerCount = 30) {
  const facetCoverage = Object.fromEntries(FACETS.map(facet => [facet.key, level]));
  const evidence = FACETS.map((facet, index) => ({
    facet: facet.key,
    direction: index % 3 === 0 ? 'high' : index % 3 === 1 ? 'low' : 'mixed',
    sourceTurn: index + 1,
    context: `情境 ${index + 1}`,
    behavior: `可观察行为 ${index + 1}`,
    condition: level >= 3 ? `切换条件 ${index + 1}` : '',
    strength: Math.max(1, level)
  }));
  return { state: normalizeAnalysisState({ facetCoverage, evidence, contradictions: [], openQuestions: [], noNewInformationStreak: 0 }), answerCount };
}

function validReport() {
  return {
    type: 'report', shouldStop: true, report: {
      persona: { title: '测试画像', tagline: '测试', introduction: '测试' }, summary: '测试摘要',
      dimensions: DIMENSIONS.map((dimension, dimensionIndex) => ({
        key: dimension.key, name: dimension.name, score: 58 + dimensionIndex * 4, confidence: 99,
        facets: dimension.facets.map((facet, facetIndex) => ({ key: facet.key, name: facet.name, score: 55 + dimensionIndex * 4 + facetIndex, explanation: '测试解释' })),
        evidence: [], counterEvidence: [], strengthExpression: '功能', watchout: '代价'
      })),
      facetRanking: [], stablePatterns: [], apparentContradictions: [], interpersonalStyle: {}, valueThemes: [], strengths: [], blindSpots: [], growthPlan: [], changeablePatterns: [],
      confidence: { level: '高', score: 99, basis: '模型自报' }, disclaimer: '测试'
    }
  };
}

const low = ledger(1, 10), medium = ledger(2, 24), high = ledger(3, 36);
const lowConfidence = computeConfidence(low.state, low.answerCount).overall.score;
const mediumConfidence = computeConfidence(medium.state, medium.answerCount).overall.score;
const highConfidence = computeConfidence(high.state, high.answerCount).overall.score;
assert.ok(lowConfidence < mediumConfidence && mediumConfidence < highConfidence, '证据增强时可信度应单调提高');
assert.ok(tendencyRange(70, lowConfidence).split('–').map(Number)[1] - tendencyRange(70, lowConfidence).split('–').map(Number)[0] > tendencyRange(70, highConfidence).split('–').map(Number)[1] - tendencyRange(70, highConfidence).split('–').map(Number)[0], '低可信度区间应更宽');
assert.equal(coverageStatus(high.state).extraversion, 100);
assert.ok(FACETS.some(facet => facet.key === normalizeQuestionPlan({}, low.state).targetFacet));

const normalized = normalizeResult(validReport(), { analysisState: high.state, answerCount: high.answerCount, turns: high.answerCount });
assert.equal(normalized.report.dimensions.length, 5);
assert.equal(normalized.report.facetRanking.length, 15);
assert.equal(normalized.report.evidenceAppendix.length, 15);
assert.equal(normalized.report.confidence.score, highConfidence, '可信度必须等于服务器证据公式结果');
assert.equal(normalized.report.methodology.version, 'behavioral-evidence-v1');
assert.ok(normalized.report.dimensions.every(dimension => dimension.facets.length === 3));
assert.ok(normalized.report.facetRanking.every((facet, index, all) => index === 0 || all[index - 1].score >= facet.score));

const broken = validReport();
broken.report.dimensions[0].facets.pop();
assert.throws(() => normalizeResult(broken, { analysisState: high.state, answerCount: 36 }), /报告缺少子特质/);

console.log(JSON.stringify({ ok: true, confidence: { low: lowConfidence, medium: mediumConfidence, high: highConfidence }, dimensions: normalized.report.dimensions.length, facets: normalized.report.facetRanking.length, evidence: normalized.report.evidenceAppendix.length }, null, 2));
