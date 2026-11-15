import assert from 'node:assert/strict';
import { Solar } from 'lunar-javascript';
import { generateChart } from '../ziwei/algorithm';
import { computeBazi } from './chart';

function describe(title: string, fn: () => void) {
  console.log(`describe: ${title}`);
  fn();
}

function it(title: string, fn: () => void) {
  fn();
  console.log(`  ✓ it: ${title}`);
}

describe('computeBazi 八字完整盘单元测试', () => {
  it('1. 1990-06-15 午时阳男：四柱直取自 ZiweiChart.lunarInfo.fourPillars，十神/藏干/十二长生/神煞/流年全部准确', () => {
    const ziweiChart = generateChart({
      year: 1990,
      month: 6,
      day: 15,
      hour: 6, // 午时
      gender: 'male',
    });

    assert.deepEqual(ziweiChart.lunarInfo.fourPillars, ['庚午', '壬午', '辛亥', '甲午']);

    const bazi = computeBazi({
      chart: ziweiChart,
      gender: 'M',
      referenceYear: 2026,
    });

    assert.deepEqual(bazi.rawFourPillars, ['庚午', '壬午', '辛亥', '甲午']);
    assert.equal(bazi.dayMaster, '辛');
    assert.equal(bazi.dayMasterElement, '金');

    assert.equal(bazi.pillars.year.stemTenGod, '劫财');
    assert.equal(bazi.pillars.month.stemTenGod, '伤官');
    assert.equal(bazi.pillars.day.stemTenGod, '日主');
    assert.equal(bazi.pillars.hour.stemTenGod, '正财');

    assert.deepEqual(bazi.pillars.year.hideGan, ['丁', '己']);
    assert.deepEqual(bazi.pillars.year.hideGanTenGods, ['七杀', '偏印']);
    assert.equal(bazi.pillars.year.hiddenStems[0].roleLabel, '本气');
    assert.equal(bazi.pillars.year.hiddenStems[1].roleLabel, '中气');

    assert.deepEqual(bazi.pillars.day.hideGan, ['壬', '甲']);
    assert.deepEqual(bazi.pillars.day.hideGanTenGods, ['伤官', '正财']);

    assert.equal(bazi.pillars.year.diShi, '病');
    assert.equal(bazi.pillars.month.diShi, '病');
    assert.equal(bazi.pillars.day.diShi, '沐浴');
    assert.equal(bazi.pillars.hour.diShi, '病');

    assert.ok(bazi.shenSha.tianYiGuiRen.targetBranches.includes('午'));
    assert.deepEqual(bazi.shenSha.tianYiGuiRen.hitPillars, ['year', 'month', 'hour']);
    assert.deepEqual(bazi.shenSha.taoHua.hitPillars, []);

    assert.equal(bazi.liuNian.length, 11);
    assert.equal(bazi.liuNian[0].year, 2021);
    assert.equal(bazi.liuNian[0].ganZhi, '辛丑');
    assert.equal(bazi.liuNian[5].year, 2026);
    assert.equal(bazi.liuNian[5].ganZhi, '丙午');
    assert.equal(bazi.liuNian[5].isReferenceYear, true);
    assert.equal(bazi.liuNian[10].year, 2031);
    assert.equal(bazi.liuNian[10].ganZhi, '辛亥');
  });

  it('2. 大运对照样本 1（1990-06-15 午时阳男顺排）：起运岁数与第一步大运干支与 EightChar.getYun(1, 2) 完全一致', () => {
    const ziweiChart = generateChart({
      year: 1990,
      month: 6,
      day: 15,
      hour: 6,
      gender: 'male',
    });
    const bazi = computeBazi({ chart: ziweiChart, gender: 'M', referenceYear: 2026 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yun = (Solar as any).fromYmdHms(1990, 6, 15, 12, 0, 0).getLunar().getEightChar().getYun(1, 2);
    const dy1 = yun.getDaYun()[1];

    assert.equal(bazi.daYun.isForward, true);
    assert.equal(bazi.daYun.yinYangGender, '阳男');
    assert.equal(bazi.daYun.startAge, dy1.getStartAge()); // 8 岁
    assert.equal(bazi.daYun.startYear, dy1.getStartYear()); // 1997 年
    assert.equal(bazi.daYun.steps[0].ganZhi, dy1.getGanZhi()); // 癸未
  });

  it('3. 大运对照样本 2（1990-06-15 午时阴男逆排）：断言逆数上一节（芒种）起运岁数与第一步大运干支与 getYun 逆排完全一致', () => {
    const baseChart = generateChart({
      year: 1990,
      month: 6,
      day: 15,
      hour: 6,
      gender: 'male',
    });
    // 1990-06-15 午时构造阴年天干（己巳年、壬午月、辛亥日、甲午时）以触发 1990-06-15 午时「阴男逆排」
    const yinMaleChart = {
      ...baseChart,
      lunarInfo: {
        ...baseChart.lunarInfo,
        fourPillars: ['己巳', '壬午', '辛亥', '甲午'] as [string, string, string, string],
      },
    };
    const bazi = computeBazi({ chart: yinMaleChart, gender: 'M', referenceYear: 2026 });

    // 对照 lunar-javascript 在 1990-06-15 12:00 逆排（getYun(0, 2) 同为逆数至上一节芒种）的起运岁数与第一步大运
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yunRev = (Solar as any).fromYmdHms(1990, 6, 15, 12, 0, 0).getLunar().getEightChar().getYun(0, 2);
    const dy1Rev = yunRev.getDaYun()[1];

    assert.equal(bazi.daYun.isForward, false);
    assert.equal(bazi.daYun.yinYangGender, '阴男');
    assert.equal(bazi.daYun.startAge, dy1Rev.getStartAge()); // 4 岁
    assert.equal(bazi.daYun.startYear, dy1Rev.getStartYear()); // 1993 年
    assert.equal(bazi.daYun.steps[0].ganZhi, dy1Rev.getGanZhi()); // 辛巳
  });

  it('4. 大运对照样本 3（1990-01-25 午时出生，立春前属己巳年丁丑月）：阴男逆数小寒、阴女顺数立春，起运岁数与第一步大运干支均与 getYun 一致', () => {
    const chartBeforeLichun = generateChart({
      year: 1990,
      month: 1,
      day: 25,
      hour: 6, // 午时
      gender: 'male',
    });

    // 立春前，节气四柱年柱属己巳、月柱属丁丑
    assert.equal(chartBeforeLichun.lunarInfo.fourPillars?.[0], '己巳');
    assert.equal(chartBeforeLichun.lunarInfo.fourPillars?.[1], '丁丑');

    // (a) 1990-01-25 己巳年男 = 阴男逆排（逆数至上一节：小寒）
    const baziMale = computeBazi({ chart: chartBeforeLichun, gender: 'M', referenceYear: 2026 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yunMale = (Solar as any).fromYmdHms(1990, 1, 25, 12, 0, 0).getLunar().getEightChar().getYun(1, 2);
    const dy1Male = yunMale.getDaYun()[1];

    assert.equal(baziMale.daYun.isForward, false);
    assert.equal(baziMale.daYun.yinYangGender, '阴男');
    assert.equal(baziMale.daYun.startAge, dy1Male.getStartAge()); // 7 岁
    assert.equal(baziMale.daYun.startYear, dy1Male.getStartYear()); // 1996 年
    assert.equal(baziMale.daYun.steps[0].ganZhi, dy1Male.getGanZhi()); // 丙子

    // (b) 1990-01-25 己巳年女 = 阴女顺排（顺数至下一节：立春）
    const baziFemale = computeBazi({ chart: chartBeforeLichun, gender: 'F', referenceYear: 2026 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yunFemale = (Solar as any).fromYmdHms(1990, 1, 25, 12, 0, 0).getLunar().getEightChar().getYun(0, 2);
    const dy1Female = yunFemale.getDaYun()[1];

    assert.equal(baziFemale.daYun.isForward, true);
    assert.equal(baziFemale.daYun.yinYangGender, '阴女');
    assert.equal(baziFemale.daYun.startAge, dy1Female.getStartAge()); // 4 岁
    assert.equal(baziFemale.daYun.startYear, dy1Female.getStartYear()); // 1993 年
    assert.equal(baziFemale.daYun.steps[0].ganZhi, dy1Female.getGanZhi()); // 戊寅
  });

  it('5. 四柱不重算硬约束验证：注入自定义 fourPillars 时，computeBazi 100% 沿用传入四柱而不调用 Solar/Lunar 覆写', () => {
    const baseChart = generateChart({
      year: 1990,
      month: 6,
      day: 15,
      hour: 6,
      gender: 'female',
    });

    const customChart = {
      ...baseChart,
      lunarInfo: {
        ...baseChart.lunarInfo,
        fourPillars: ['乙丑', '戊寅', '甲子', '丙寅'] as [string, string, string, string],
      },
    };

    const bazi = computeBazi({
      chart: customChart,
      gender: 'F',
      referenceYear: 2025,
    });

    assert.deepEqual(bazi.rawFourPillars, ['乙丑', '戊寅', '甲子', '丙寅']);
    assert.equal(bazi.dayMaster, '甲');
    assert.equal(bazi.daYun.isForward, true);
    assert.equal(bazi.daYun.yinYangGender, '阴女');
    assert.equal(bazi.daYun.steps[0].ganZhi, '己卯');

    assert.deepEqual(bazi.shenSha.tianYiGuiRen.hitPillars, ['year', 'day']);
    assert.deepEqual(bazi.shenSha.yiMa.hitPillars, ['month', 'hour']);
    assert.deepEqual(bazi.shenSha.taoHua.hitPillars, []);
  });
});

console.log('✓ bazi chart unit tests passed');
