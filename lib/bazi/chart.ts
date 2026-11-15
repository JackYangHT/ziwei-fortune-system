/**
 * 八字完整盘主计算模块 (computeBazi)
 *
 * 关键约束：
 * 1. 四柱干支一律从 ZiweiChart.lunarInfo.fourPillars（若缺失则回退 fourPillarsLunar）直接读取，
 *    绝不调用 lunar-javascript 的 Solar / Lunar 重新计算四柱。
 * 2. 补充四柱藏干（本气/中气/余气）、天干十神、藏干十神、十二长生、神煞（天乙贵人/文昌/驿马/桃花/羊刃）、
 *    大运（阳男阴女顺排、阴男阳女逆排，起运岁数 + 十步大运）及流年（基准年前后各 5 年）。
 */

import { dateToJD, findSolarTermJD, SOLAR_TERMS_CONFIG } from './boundary-warning';
import { getNayin } from './classical-tables';
import {
  BRANCH_ELEMENT,
  EARTHLY_BRANCHES,
  evaluateShenSha,
  getBranchHiddenStems,
  getDiShi,
  getTenGod,
  getYearGanZhi,
  HEAVENLY_STEMS,
  SIXTY_JIAZI,
  STEM_ELEMENT,
  STEM_YIN_YANG,
} from './tables';
import type {
  BaziChart,
  BaziDaYunInfo,
  BaziDaYunStep,
  BaziInput,
  BaziLiuNianItem,
  BaziPillar,
  EarthlyBranch,
  HeavenlyStem,
  PillarKey,
} from './types';

function parseGanZhi(gz: string): { stem: HeavenlyStem; branch: EarthlyBranch; ganZhi: string } {
  const clean = String(gz || '').trim();
  const s = clean[0] as HeavenlyStem;
  const b = clean[1] as EarthlyBranch;
  const stem = HEAVENLY_STEMS.includes(s) ? s : '甲';
  const branch = EARTHLY_BRANCHES.includes(b) ? b : '子';
  return { stem, branch, ganZhi: `${stem}${branch}` };
}

/**
 * 计算出生时刻距最近上一「节」或下一「节」的天数，折算大运起运岁数
 * 规则：阳男阴女顺数至下一节，阴男阳女逆数至上一节；
 *       3 天 = 1 岁，1 天 = 4 个月，1 时辰（2 小时）= 10 天（即 4320 分钟 = 1 年，360 分钟 = 1 月，12 分钟 = 1 日）。
 */
function computeDaYunStart(
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  birthHourBranchIdx: number,
  origClockHour: number | undefined,
  origClockMinute: number | undefined,
  isForward: boolean,
): {
  startAge: number;
  startYear: number;
  startDetail: { years: number; months: number; days: number };
} {
  // 若有原始钟表时分则用精确时分，否则用时辰中点（子时=0:00, 丑时=2:00, ..., 亥时=22:00）
  const hh =
    origClockHour !== undefined
      ? origClockHour
      : birthHourBranchIdx >= 0 && birthHourBranchIdx <= 11
        ? birthHourBranchIdx * 2
        : 12;
  const mm = origClockMinute !== undefined ? origClockMinute : 0;

  // 出生时刻对应的 UTC 儒略日（以东八区为基准）
  const birthJD_UTC = dateToJD(birthYear, birthMonth, birthDay, hh, mm, 0) - 8 / 24;

  // 收集生年前后三年的全部 12 节（isMajorJie: true）的精确交节 JD
  const majorJieConfigs = SOLAR_TERMS_CONFIG.filter((t) => t.isMajorJie);
  const jieJDs: number[] = [];
  for (const y of [birthYear - 1, birthYear, birthYear + 1]) {
    for (const term of majorJieConfigs) {
      jieJDs.push(findSolarTermJD(y, term));
    }
  }
  jieJDs.sort((a, b) => a - b);

  let prevJieJD = jieJDs[0];
  let nextJieJD = jieJDs[jieJDs.length - 1];
  for (const jd of jieJDs) {
    if (jd <= birthJD_UTC) {
      prevJieJD = jd;
    } else if (jd > birthJD_UTC) {
      nextJieJD = jd;
      break;
    }
  }

  const diffDays = isForward
    ? Math.max(0, nextJieJD - birthJD_UTC)
    : Math.max(0, birthJD_UTC - prevJieJD);

  const totalMinutes = Math.round(diffDays * 1440);
  const years = Math.floor(totalMinutes / 4320);
  const remAfterYears = totalMinutes % 4320;
  const months = Math.floor(remAfterYears / 360);
  const remAfterMonths = remAfterYears % 360;
  const days = Math.floor(remAfterMonths / 12);

  // 计算起运所在的公历年与虚岁（出生当年为 1 岁）
  // 出生日期加上 (years 年 + months 月 + days 天) 后的公历年份：
  const approxStartDate = new Date(
    Date.UTC(birthYear + years, birthMonth - 1 + months, birthDay + days),
  );
  const startYear = Math.max(birthYear, approxStartDate.getUTCFullYear());
  const startAge = Math.max(1, startYear - birthYear + 1);

  return {
    startAge,
    startYear,
    startDetail: { years, months, days },
  };
}

/**
 * 构建十步大运
 */
function buildDaYun(
  yearStem: HeavenlyStem,
  monthGanZhi: string,
  dayMaster: HeavenlyStem,
  gender: 'M' | 'F',
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  birthHourBranchIdx: number,
  origClockHour?: number,
  origClockMinute?: number,
): BaziDaYunInfo {
  const isYangYear = STEM_YIN_YANG[yearStem] === '阳';
  const isMale = gender === 'M';
  // 阳男阴女顺排，阴男阳女逆排
  const isForward = (isYangYear && isMale) || (!isYangYear && !isMale);
  const yinYangGender: BaziDaYunInfo['yinYangGender'] = isYangYear
    ? isMale
      ? '阳男'
      : '阳女'
    : isMale
      ? '阴男'
      : '阴女';

  const { startAge, startYear, startDetail } = computeDaYunStart(
    birthYear,
    birthMonth,
    birthDay,
    birthHourBranchIdx,
    origClockHour,
    origClockMinute,
    isForward,
  );

  const monthIdxInJiaZi = Math.max(0, SIXTY_JIAZI.indexOf(monthGanZhi));
  const steps: BaziDaYunStep[] = [];

  for (let i = 1; i <= 10; i++) {
    const stepOffset = isForward ? i : -i;
    const jiaZiIdx = (((monthIdxInJiaZi + stepOffset) % 60) + 60) % 60;
    const ganZhi = SIXTY_JIAZI[jiaZiIdx];
    const stem = ganZhi[0] as HeavenlyStem;
    const branch = ganZhi[1] as EarthlyBranch;
    const stepStartAge = startAge + (i - 1) * 10;
    const stepEndAge = stepStartAge + 9;
    const stepStartYear = startYear + (i - 1) * 10;
    const stepEndYear = stepStartYear + 9;

    steps.push({
      index: i,
      ganZhi,
      stem,
      branch,
      stemTenGod: getTenGod(dayMaster, stem),
      hiddenStems: getBranchHiddenStems(dayMaster, branch),
      diShi: getDiShi(dayMaster, branch),
      nayin: getNayin(ganZhi),
      startAge: stepStartAge,
      endAge: stepEndAge,
      startYear: stepStartYear,
      endYear: stepEndYear,
    });
  }

  return {
    isForward,
    yinYangGender,
    startAge,
    startYear,
    startDetail,
    steps,
  };
}

/**
 * 构建基准年前后各 5 年（共 11 年）的流年列表
 */
function buildLiuNian(
  dayMaster: HeavenlyStem,
  birthYear: number,
  referenceYear: number,
): BaziLiuNianItem[] {
  const list: BaziLiuNianItem[] = [];
  for (let y = referenceYear - 5; y <= referenceYear + 5; y++) {
    const { ganZhi, stem, branch } = getYearGanZhi(y);
    list.push({
      year: y,
      age: y - birthYear + 1,
      ganZhi,
      stem,
      branch,
      stemTenGod: getTenGod(dayMaster, stem),
      hiddenStems: getBranchHiddenStems(dayMaster, branch),
      diShi: getDiShi(dayMaster, branch),
      nayin: getNayin(ganZhi),
      isReferenceYear: y === referenceYear,
    });
  }
  return list;
}

/**
 * 八字完整盘计算入口
 * 四柱干支一律从 input.chart.lunarInfo.fourPillars（或 fourPillarsLunar）取，不重算四柱。
 */
export function computeBazi(input: BaziInput): BaziChart {
  const { chart, gender } = input;
  const referenceYear = input.referenceYear ?? new Date().getFullYear();

  const rawPillars =
    chart.lunarInfo?.fourPillars ?? chart.lunarInfo?.fourPillarsLunar;
  if (!rawPillars || rawPillars.length < 4) {
    throw new Error(
      'ZiweiChart.lunarInfo.fourPillars is required by computeBazi (four pillars must not be recalculated).',
    );
  }

  const parsedYear = parseGanZhi(rawPillars[0]);
  const parsedMonth = parseGanZhi(rawPillars[1]);
  const parsedDay = parseGanZhi(rawPillars[2]);
  const parsedHour = parseGanZhi(rawPillars[3]);

  const dayMaster = parsedDay.stem;
  const dayMasterElement = STEM_ELEMENT[dayMaster];

  // 1. 计算五大神煞
  const shenSha = evaluateShenSha({
    year: parsedYear,
    month: parsedMonth,
    day: parsedDay,
    hour: parsedHour,
  });

  // 2. 组装单柱结构
  const buildPillar = (
    key: PillarKey,
    label: BaziPillar['label'],
    parsed: { stem: HeavenlyStem; branch: EarthlyBranch; ganZhi: string },
    isDayPillar = false,
  ): BaziPillar => {
    const hiddenStems = getBranchHiddenStems(dayMaster, parsed.branch);
    return {
      key,
      label,
      ganZhi: parsed.ganZhi,
      stem: parsed.stem,
      branch: parsed.branch,
      stemElement: STEM_ELEMENT[parsed.stem],
      branchElement: BRANCH_ELEMENT[parsed.branch],
      stemTenGod: isDayPillar ? '日主' : getTenGod(dayMaster, parsed.stem),
      hiddenStems,
      hideGan: hiddenStems.map((h) => h.stem),
      hideGanTenGods: hiddenStems.map((h) => h.tenGod),
      diShi: getDiShi(dayMaster, parsed.branch),
      nayin: getNayin(parsed.ganZhi),
      shenSha: shenSha.byPillar[key],
    };
  };

  const pillars = {
    year: buildPillar('year', '年柱', parsedYear, false),
    month: buildPillar('month', '月柱', parsedMonth, false),
    day: buildPillar('day', '日柱', parsedDay, true),
    hour: buildPillar('hour', '时柱', parsedHour, false),
  };

  // 3. 大运（阳男阴女顺排、阴男阳女逆排 + 十步大运）
  const birthInfo = chart.birthInfo;
  const daYun = buildDaYun(
    parsedYear.stem,
    parsedMonth.ganZhi,
    dayMaster,
    gender,
    birthInfo.year,
    birthInfo.month,
    birthInfo.day,
    birthInfo.hour,
    birthInfo.origInput?.clockHour,
    birthInfo.origInput?.clockMinute,
  );

  // 4. 流年（基准年前后各 5 年，共 11 年）
  const liuNian = buildLiuNian(dayMaster, birthInfo.year, referenceYear);

  return {
    rawFourPillars: [
      parsedYear.ganZhi,
      parsedMonth.ganZhi,
      parsedDay.ganZhi,
      parsedHour.ganZhi,
    ],
    dayMaster,
    dayMasterElement,
    pillars,
    shenSha,
    daYun,
    liuNian,
    referenceYear,
  };
}
