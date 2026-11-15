import assert from 'node:assert/strict';
import { generateChart } from '../ziwei/algorithm';
import { buildRawFlyingMatrix } from './matrix';

const chart1990 = generateChart({
  year: 1990,
  month: 1,
  day: 1,
  hour: 6, // 午时（命宫辛未）
  gender: 'male',
});

// 用例 1：1990-01-01 男 — 断言 rawMatrix.edges 里 layer='natal' 的边数为 48，且己巳宫的 4 条边分别是武曲禄→田宅、贪狼权→子女、天梁科→命宫、文曲忌→田宅
{
  const rawMatrix = buildRawFlyingMatrix(chart1990, { referenceYear: 2026 });
  const natalEdges = rawMatrix.edges.filter((e) => e.layer === 'natal');
  assert.equal(natalEdges.length, 48);

  const jiSiEdges = natalEdges.filter(
    (e) => e.stemName === '己' && e.fromBranchName === '巳',
  );
  assert.equal(jiSiEdges.length, 4);

  const luEdge = jiSiEdges.find((e) => e.siHua === '禄');
  const quanEdge = jiSiEdges.find((e) => e.siHua === '权');
  const keEdge = jiSiEdges.find((e) => e.siHua === '科');
  const jiEdge = jiSiEdges.find((e) => e.siHua === '忌');

  assert.ok(luEdge);
  assert.equal(luEdge.starName, '武曲');
  assert.equal(luEdge.toPalace, '田宅');

  assert.ok(quanEdge);
  assert.equal(quanEdge.starName, '贪狼');
  assert.equal(quanEdge.toPalace, '子女');

  assert.ok(keEdge);
  assert.equal(keEdge.starName, '天梁');
  assert.equal(keEdge.toPalace, '命宫');

  assert.ok(jiEdge);
  assert.equal(jiEdge.starName, '文曲');
  assert.equal(jiEdge.toPalace, '田宅');

  console.log(
    "✓ 用例 1：1990-01-01 男 — rawMatrix.edges 中 layer='natal' 边数为 48，且己巳宫 4 条边分别为武曲禄→田宅、贪狼权→子女、天梁科→命宫、文曲忌→田宅",
  );
}

// 用例 2：同一命盘切换 daXianIndex（0 和 1）— 断言 decadal 层 edge 变化，natal 层 edge 不变
{
  const matrixDx0 = buildRawFlyingMatrix(chart1990, {
    daXianIndex: 0,
    referenceYear: 2026,
  });
  const matrixDx1 = buildRawFlyingMatrix(chart1990, {
    daXianIndex: 1,
    referenceYear: 2026,
  });

  const natalDx0 = matrixDx0.edges.filter((e) => e.layer === 'natal');
  const natalDx1 = matrixDx1.edges.filter((e) => e.layer === 'natal');
  assert.deepEqual(natalDx0, natalDx1);

  const decadalDx0 = matrixDx0.edges.filter((e) => e.layer === 'decadal');
  const decadalDx1 = matrixDx1.edges.filter((e) => e.layer === 'decadal');
  assert.equal(decadalDx0.length, 4);
  assert.equal(decadalDx1.length, 4);
  assert.notDeepEqual(decadalDx0, decadalDx1);

  console.log(
    '✓ 用例 2：同一命盘切换 daXianIndex（0 和 1）— decadal 层 edge 变化，natal 层 edge 不变',
  );
}

// 用例 3：找 selfSihua 非空的宫 — 断言 rawMatrix.byPalace 对应宫的 selfSihua.lu >= 1（及田宅宫武曲离心自化非空）
{
  const rawMatrix = buildRawFlyingMatrix(chart1990, { referenceYear: 2026 });

  // 财帛宫（丁卯，太阴自化禄）与子女宫（戊辰，贪狼自化禄）均为 selfSihua.lu >= 1
  const selfLuPalace = rawMatrix.byPalace.find((p) => p.selfSihua.lu >= 1);
  assert.ok(selfLuPalace);
  assert.ok(selfLuPalace.selfSihua.lu >= 1);

  // 田宅宫（甲戌，武曲坐守，甲干廉破武阳触发武曲离心自化科）
  const tianZhaiPalace = rawMatrix.byPalace.find((p) => p.palaceName === '田宅');
  assert.ok(tianZhaiPalace);
  assert.ok(tianZhaiPalace.selfSihua.ke >= 1);

  console.log(
    `✓ 用例 3：selfSihua 非空宫位验证 — ${selfLuPalace.palaceName}宫(${selfLuPalace.stemName}${selfLuPalace.branchName}) selfSihua.lu=${selfLuPalace.selfSihua.lu} >= 1，田宅宫(${tianZhaiPalace.stemName}${tianZhaiPalace.branchName})武曲离心自化 selfSihua.ke=${tianZhaiPalace.selfSihua.ke} >= 1`,
  );
}

console.log('✓ ziwei-flying matrix unit tests passed');
