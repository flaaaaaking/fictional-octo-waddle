const DIMENSIONS = [
  { key: 'extraversion', name: '外向性', facets: [
    { key: 'sociability', name: '社交性' },
    { key: 'assertiveness', name: '果断性' },
    { key: 'energyLevel', name: '活力水平' }
  ]},
  { key: 'conscientiousness', name: '尽责性', facets: [
    { key: 'organization', name: '条理性' },
    { key: 'productiveness', name: '执行力' },
    { key: 'responsibility', name: '责任感' }
  ]},
  { key: 'openness', name: '开放性', facets: [
    { key: 'intellectualCuriosity', name: '求知好奇' },
    { key: 'aestheticSensitivity', name: '审美敏感' },
    { key: 'creativeImagination', name: '创造想象' }
  ]},
  { key: 'agreeableness', name: '宜人性', facets: [
    { key: 'compassion', name: '同情心' },
    { key: 'respectfulness', name: '尊重性' },
    { key: 'trust', name: '信任倾向' }
  ]},
  { key: 'emotionalSensitivity', name: '情绪敏感性', facets: [
    { key: 'anxietySensitivity', name: '焦虑敏感' },
    { key: 'emotionalVolatility', name: '情绪波动' },
    { key: 'lowMoodSensitivity', name: '低落敏感' }
  ]}
];

const FACETS = DIMENSIONS.flatMap(dimension => dimension.facets.map(facet => ({ ...facet, dimensionKey: dimension.key })));
const FACET_KEYS = new Set(FACETS.map(facet => facet.key));
const LENSES = new Set(['recentEvent', 'counterExample', 'crossContext', 'longitudinal', 'functionAndCost', 'recovery']);
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const cleanText = (value, max = 500) => String(value || '').trim().slice(0, max);

function normalizeAnalysisState(input = {}) {
  const facetCoverage = Object.fromEntries(FACETS.map(facet => [facet.key, Math.round(clamp(input.facetCoverage?.[facet.key], 0, 3))]));
  const evidence = (Array.isArray(input.evidence) ? input.evidence : [])
    .filter(item => FACET_KEYS.has(item?.facet))
    .map(item => ({
      facet: item.facet,
      direction: ['high', 'low', 'mixed'].includes(item.direction) ? item.direction : 'mixed',
      sourceTurn: Math.max(1, Math.round(Number(item.sourceTurn) || 0)),
      context: cleanText(item.context, 180),
      behavior: cleanText(item.behavior, 260),
      condition: cleanText(item.condition, 220),
      strength: Math.round(clamp(item.strength, 1, 3))
    }))
    .filter(item => item.context && item.behavior)
    .slice(-36);
  const contradictions = (Array.isArray(input.contradictions) ? input.contradictions : [])
    .map(item => typeof item === 'string'
      ? { pattern: cleanText(item, 240), status: 'unresolved', explanation: '', sourceTurns: [] }
      : {
          pattern: cleanText(item?.pattern, 240),
          status: item?.status === 'resolved' ? 'resolved' : 'unresolved',
          explanation: cleanText(item?.explanation, 320),
          sourceTurns: (Array.isArray(item?.sourceTurns) ? item.sourceTurns : []).map(Number).filter(Number.isFinite).map(Math.round).slice(0, 8)
        })
    .filter(item => item.pattern)
    .slice(-12);
  const openQuestions = (Array.isArray(input.openQuestions) ? input.openQuestions : []).map(item => cleanText(item, 220)).filter(Boolean).slice(0, 15);
  return {
    facetCoverage,
    evidence,
    contradictions,
    openQuestions,
    noNewInformationStreak: Math.round(clamp(input.noNewInformationStreak, 0, 10))
  };
}

function latestAnalysisState(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role !== 'assistant') continue;
    try {
      const parsed = JSON.parse(messages[index].content);
      if (parsed.analysisState) return normalizeAnalysisState(parsed.analysisState);
    } catch {}
  }
  return normalizeAnalysisState();
}

function confidenceParts(state, facetKeys, answerCount) {
  const keys = facetKeys || FACETS.map(facet => facet.key);
  const coverageValues = keys.map(key => state.facetCoverage[key] || 0);
  const relevantEvidence = state.evidence.filter(item => keys.includes(item.facet));
  const relevantContradictions = state.contradictions.filter(item => {
    const text = `${item.pattern} ${item.explanation}`;
    return keys.some(key => text.includes(key)) || facetKeys == null;
  });
  const coverage = coverageValues.reduce((sum, value) => sum + value, 0) / (keys.length * 3) * 100;
  const concrete = coverageValues.filter(value => value >= 2).length / keys.length * 100;
  const crossContext = coverageValues.filter(value => value >= 3).length / keys.length * 100;
  const traceability = relevantEvidence.length ? relevantEvidence.filter(item => item.sourceTurn > 0).length / relevantEvidence.length * 100 : 0;
  const conditions = relevantEvidence.length ? relevantEvidence.filter(item => item.condition.length >= 3).length / relevantEvidence.length * 100 : 0;
  const unresolved = relevantContradictions.filter(item => item.status !== 'resolved').length;
  const contradictionResolution = relevantContradictions.length ? (relevantContradictions.length - unresolved) / relevantContradictions.length * 100 : 75;
  const volume = Math.min(100, Math.max(0, Number(answerCount) || 0) / 30 * 100);
  const score = Math.round(
    coverage * 0.30 + concrete * 0.20 + crossContext * 0.15 + traceability * 0.10 +
    conditions * 0.10 + contradictionResolution * 0.05 + volume * 0.10
  );
  return { score, coverage: Math.round(coverage), concrete: Math.round(concrete), crossContext: Math.round(crossContext), traceability: Math.round(traceability), conditions: Math.round(conditions), contradictionResolution: Math.round(contradictionResolution), volume: Math.round(volume), evidenceCount: relevantEvidence.length, unresolved };
}

function confidenceLabel(score) {
  if (score >= 80) return '较高';
  if (score >= 60) return '中等';
  return '较低';
}

function confidenceBasis(parts, facetCount) {
  const concreteCount = Math.round(parts.concrete / 100 * facetCount);
  const crossCount = Math.round(parts.crossContext / 100 * facetCount);
  return `${facetCount} 项子特质中，${concreteCount} 项已有具体行为依据，${crossCount} 项完成跨情境、条件或反例核对；保留 ${parts.evidenceCount} 条可追溯证据，尚有 ${parts.unresolved} 个未解释矛盾。该数值表示本次访谈的证据充分度，不是标准化测量信度、人格强度或诚实度评分。`;
}

function computeConfidence(state, answerCount) {
  const normalized = normalizeAnalysisState(state);
  const overallParts = confidenceParts(normalized, null, answerCount);
  const dimensions = Object.fromEntries(DIMENSIONS.map(dimension => {
    const parts = confidenceParts(normalized, dimension.facets.map(facet => facet.key), answerCount);
    return [dimension.key, { ...parts, level: confidenceLabel(parts.score), basis: confidenceBasis(parts, 3) }];
  }));
  return {
    overall: { ...overallParts, level: confidenceLabel(overallParts.score), basis: confidenceBasis(overallParts, 15) },
    dimensions
  };
}

function tendencyRange(score, confidence) {
  const center = Math.max(0, Math.min(100, Math.round(Number(score) || 50)));
  const halfWidth = confidence >= 80 ? 5 : confidence >= 65 ? 8 : confidence >= 50 ? 11 : 14;
  return `${Math.max(0, center - halfWidth)}–${Math.min(100, center + halfWidth)}`;
}

function coverageStatus(state) {
  const normalized = normalizeAnalysisState(state);
  return Object.fromEntries(DIMENSIONS.map(dimension => {
    const total = dimension.facets.reduce((sum, facet) => sum + normalized.facetCoverage[facet.key], 0);
    return [dimension.key, Math.round(total / 9 * 100)];
  }));
}

function normalizeQuestionPlan(plan, state) {
  const normalized = normalizeAnalysisState(state);
  const weakest = [...FACETS].sort((a, b) => normalized.facetCoverage[a.key] - normalized.facetCoverage[b.key])[0];
  return {
    targetFacet: FACET_KEYS.has(plan?.targetFacet) ? plan.targetFacet : weakest.key,
    lens: LENSES.has(plan?.lens) ? plan.lens : 'recentEvent',
    reason: cleanText(plan?.reason, 240) || '补充当前证据覆盖最薄弱的子特质',
    expectedEvidence: cleanText(plan?.expectedEvidence, 240) || '具体情境、实际行为、条件与例外'
  };
}

module.exports = { DIMENSIONS, FACETS, FACET_KEYS, normalizeAnalysisState, latestAnalysisState, computeConfidence, tendencyRange, coverageStatus, normalizeQuestionPlan };
