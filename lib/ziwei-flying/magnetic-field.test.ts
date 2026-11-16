import assert from 'node:assert/strict';
import { generateChart } from '../ziwei/algorithm';
import { VECTOR_STRENGTH } from './config';
import { FLYING_RULES } from './patterns';
import { buildRawFlyingMatrix } from './matrix';
import { computeMagneticField } from './magnetic-field';

// 1. 验证 FLYING_RULES 包含全部 8 大领域（43 条）规则
assert.equal(Array.isArray(FLYING_RULES), true);
assert.equal(FLYING_RULES.length, 43);
assert.equal(FLYING_RULES.filter((r) => r.id.startsWith('career-')).length, 6);
assert.equal(FLYING_RULES.filter((r) => r.id.startsWith('wealth-')).length, 6);
assert.equal(FLYING_RULES.filter((r) => r.id.startsWith('relationship-')).length, 6);
assert.equal(FLYING_RULES.filter((r) => r.id.startsWith('academic-')).length, 5);
assert.equal(FLYING_RULES.filter((r) => r.id.startsWith('health-')).length, 5);
assert.equal(FLYING_RULES.filter((r) => r.id.startsWith('family-')).length, 5);
assert.equal(FLYING_RULES.filter((r) => r.id.startsWith('social-')).length, 5);
assert.equal(FLYING_RULES.filter((r) => r.id.startsWith('timing-')).length, 5);

// 2. 生成 1990-01-01 男命盘并计算 MagneticField
const chart1990 = generateChart({
  year: 1990,
  month: 1,
  day: 1,
  hour: 6, // 午时（命宫辛未）
  gender: 'male',
});

// 验证 matrix.ts 只出 raw counts（全部为非负整数）
const rawMatrix = buildRawFlyingMatrix(chart1990, { referenceYear: 2026 });
assert.equal(rawMatrix.byPalace.length, 12);
assert.equal(rawMatrix.grid.length, 12);
for (const p of rawMatrix.byPalace) {
  for (const k of ['lu', 'quan', 'ke', 'ji'] as const) {
    assert.equal(Number.isInteger(p.incoming.total[k]), true);
    assert.equal(p.incoming.total[k] >= 0, true);
    assert.equal(
      p.incoming.total[k],
      p.incoming.natal[k] + p.incoming.decadal[k] + p.incoming.yearly[k],
    );
  }
  // 每个本命宫干必飞出 1 禄、1 权、1 科、1 忌（再加上若该宫被选作大限宫或流年宫则叠加）
  assert.ok(p.outgoing.lu >= 1);
  assert.ok(p.outgoing.quan >= 1);
  assert.ok(p.outgoing.ke >= 1);
  assert.ok(p.outgoing.ji >= 1);
}

// 3. 验证 computeMagneticField 四大模块（体 / 用 / 方向 / 双轨权重）完整性
const mf = computeMagneticField({
  chart: chart1990,
  referenceYear: 2026,
});

// 体：1990-01-01 为农历己巳年腊月初五，生年天干为己（武贪梁曲），来因宫天干必为「己」
assert.equal(mf.body.birthYearStemName, '己');
assert.equal(mf.body.laiYin.stemName, '己');
assert.equal(mf.body.natalSihua['禄'].starName, '武曲');
assert.equal(mf.body.natalSihua['权'].starName, '貪狼' in mf.body.natalSihua ? '貪狼' : '贪狼');
assert.equal(mf.body.natalSihua['科'].starName, '天梁');
assert.equal(mf.body.natalSihua['忌'].starName, '文曲');

// 用：12 宫净权重场
assert.equal(mf.weightedField.length, 12);

// 方向：禄随忌走轨迹（含来因宫、命宫、大限、流年及 12 宫）
assert.ok(mf.vectors.length >= 15);
const laiYinVec = mf.vectors.find((v) => v.level === 'laiYin');
assert.ok(laiYinVec);
assert.equal(laiYinVec.luStar, '武曲');
assert.equal(laiYinVec.jiStar, '文曲');
assert.equal(laiYinVec.luTargetPalace, mf.body.natalSihua['禄'].palaceName);
assert.equal(laiYinVec.jiTargetPalace, mf.body.natalSihua['忌'].palaceName);

// 验证 1990-01-01 男命宫辛未 vector 的 relation 为 clamp（且 VECTOR_STRENGTH.clamp === 0.6）
assert.equal(VECTOR_STRENGTH.clamp, 0.6);
const mingVec = mf.vectors.find((v) => v.level === 'mingGong');
assert.ok(mingVec);
assert.equal(mingVec.stemName, '辛');
assert.equal(mingVec.sourceBranchName, '未');
assert.equal(mingVec.relation, 'clamp');
const palaceWeiVec = mf.vectors.find((v) => v.id === 'palace-7');
assert.ok(palaceWeiVec);
assert.equal(palaceWeiVec.relation, 'clamp');

// 权重：双轨制与飞星规则命中
assert.equal(mf.dualTrack.mode, 'dual-track');
assert.equal(mf.dualTrack.trackWeights.flyingMatrixPriority, 0.7);
assert.equal(mf.dualTrack.trackWeights.sanheBackground, 0.3);
assert.ok(mf.dualTrack.flyingRuleHits.length >= 1);
assert.ok(mf.dualTrack.flyingRuleHits.some((h) => h.id === 'wealth-03'));

console.log('✓ ziwei-flying magnetic-field unit tests passed');
