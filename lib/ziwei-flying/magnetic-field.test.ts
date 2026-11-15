import assert from 'node:assert/strict';
import { generateChart } from '../ziwei/algorithm';
import { FLYING_RULES } from './patterns';
import { buildRawFlyingMatrix } from './matrix';
import { computeMagneticField } from './magnetic-field';

// 1. 验证 FLYING_RULES 初始为空数组
assert.equal(Array.isArray(FLYING_RULES), true);
assert.equal(FLYING_RULES.length, 0);

// 2. 生成 1990-01-01 男命盘并计算 MagneticField
const chart1990 = generateChart({
  year: 1990,
  month: 1,
  day: 1,
  hour: 0, // 子时
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

// 权重：双轨制
assert.equal(mf.dualTrack.mode, 'dual-track');
assert.equal(mf.dualTrack.trackWeights.flyingMatrixPriority, 0.7);
assert.equal(mf.dualTrack.trackWeights.sanheBackground, 0.3);
assert.equal(mf.dualTrack.flyingRuleHits.length, 0);

console.log('✓ ziwei-flying magnetic-field unit tests passed');
