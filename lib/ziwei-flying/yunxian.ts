/**
 * 全維度運限實算引擎（大限 / 小限 / 流年 / 流月 / 流日）(yunxian.ts)
 *
 * 職責：
 * 1. 從用戶自然提問中自動識別所詢問的時間焦點（年份、月份、日期或「今天／明天／下個月／明年」等），
 *    未指定時預設以參考年／當下日期實算。
 * 2. 完整計算目標時點的「大限、小限、流年、流月、流日」落宮、宮干／天干四化飛入落點、
 *    祿隨忌走軌跡與多層疊宮共振摘要，確保後台「永遠實算」不遺漏任何一層。
 */

import { Solar } from 'lunar-javascript';
import { BRANCHES, STEMS } from '../ziwei/constants';
import {
  getLiuRiSiHua,
  getLiuYueSiHua,
  getSiHuaByStem,
  getYearBranchIndex,
  getYearStemIndex,
} from '../ziwei/sihua';
import type { Palace, SiHua, ZiweiChart } from '../ziwei/types';

export type YunxianFocus = 'overall' | 'daxian' | 'xiaoxian' | 'liunian' | 'liuyue' | 'liuri';

export interface SiHuaFlightItem {
  siHua: SiHua;
  siHuaTrad: '祿' | '權' | '科' | '忌';
  starName: string;
  targetPalace: string;
  targetBranchName: string;
}

export interface YunxianLayerSnapshot {
  label: string;
  periodDesc: string;
  palaceName: string;
  branch: number;
  branchName: string;
  stemIndex: number;
  stemName: string;
  flights: SiHuaFlightItem[];
  luFollowsJi: string;
}

export interface YunxianSnapshot {
  targetDateStr: string;
  targetLunarStr: string;
  targetLunarYear: number;
  targetLunarMonth: number;
  targetLunarDay: number;
  isLeapMonth: boolean;
  nominalAge: number;
  daXian: YunxianLayerSnapshot | null;
  xiaoXian: YunxianLayerSnapshot;
  liuNian: YunxianLayerSnapshot;
  liuYue: YunxianLayerSnapshot;
  liuRi: YunxianLayerSnapshot;
  /** 12 步大限簡明時序（供跨大限或未來年份提問推算） */
  daXianTimeline: string[];
  /** 多層疊宮與四化重複引動摘要 */
  resonanceHighlights: string[];
}

export interface ParsedQuestionTimeContext {
  targetDate: Date;
  focuses: YunxianFocus[];
  explicitTimeDetected: boolean;
  reason: string;
}

const SIHUA_KEYS: readonly SiHua[] = ['禄', '权', '科', '忌'] as const;
const SIHUA_TRAD: Record<SiHua, '祿' | '權' | '科' | '忌'> = {
  禄: '祿',
  权: '權',
  科: '科',
  忌: '忌',
};

function getPalaceByBranch(chart: ZiweiChart, branch: number): Palace {
  const norm = ((branch % 12) + 12) % 12;
  return (
    chart.palaces.find(p => p.branch === norm) ?? {
      branch: norm,
      stem: 0,
      name: BRANCHES[norm] ?? '',
      stars: [],
    }
  );
}

function buildFlightsForStem(chart: ZiweiChart, stemIndex: number): {
  flights: SiHuaFlightItem[];
  luFollowsJi: string;
} {
  const normStem = ((stemIndex % 10) + 10) % 10;
  const transforms = getSiHuaByStem(normStem);
  const flights: SiHuaFlightItem[] = SIHUA_KEYS.map(sh => {
    const starName = transforms[sh];
    const target = chart.palaces.find(p => p.stars.some(s => s.name === starName));
    return {
      siHua: sh,
      siHuaTrad: SIHUA_TRAD[sh],
      starName,
      targetPalace: target?.name ?? '未定位',
      targetBranchName: target ? (BRANCHES[target.branch] ?? '') : '',
    };
  });

  const lu = flights.find(f => f.siHua === '禄');
  const ji = flights.find(f => f.siHua === '忌');
  const luFollowsJi =
    lu && ji
      ? `${lu.starName}化祿→${lu.targetPalace}，祿隨忌走→${ji.starName}化忌入${ji.targetPalace}`
      : '無';

  return { flights, luFollowsJi };
}

/**
 * 小限起宮地支（通行紫微斗數標準口訣，與 iztro 一致）：
 * 寅午戌年生人 → 1 歲起辰(4)；
 * 申子辰年生人 → 1 歲起戌(10)；
 * 巳酉丑年生人 → 1 歲起未(7)；
 * 亥卯未年生人 → 1 歲起丑(1)；
 * 男順女逆行十二宮。
 */
export function computeXiaoXianBranch(
  birthYearBranch: number,
  gender: 'male' | 'female',
  nominalAge: number,
): number {
  const b = ((birthYearBranch % 12) + 12) % 12;
  let startBranch = 4;
  if (b === 2 || b === 6 || b === 10) startBranch = 4;       // 寅午戌 → 辰
  else if (b === 8 || b === 0 || b === 4) startBranch = 10;  // 申子辰 → 戌
  else if (b === 5 || b === 9 || b === 1) startBranch = 7;   // 巳酉丑 → 未
  else startBranch = 1;                                      // 亥卯未 → 丑

  const offset = Math.max(0, Math.trunc(nominalAge) - 1);
  return gender === 'male'
    ? ((startBranch + offset) % 12 + 12) % 12
    : ((startBranch - offset) % 12 + 12) % 12;
}

/**
 * 斗君（流年正月流月落宮）：
 * 自流年地支起，逆數至農曆生月，再順數至出生時辰。
 */
export function computeDouJunBranch(
  yearlyBranch: number,
  birthLunarMonth: number,
  birthHourBranch: number,
): number {
  const monthIdx = Math.max(1, Math.min(12, Math.abs(Math.trunc(birthLunarMonth))));
  const hourIdx = ((Math.trunc(birthHourBranch) % 12) + 12) % 12;
  return (((yearlyBranch - (monthIdx - 1) + hourIdx) % 12) + 12) % 12;
}

/**
 * 從用戶提問中解析所關注的目標日期與運限層級
 */
export function resolveTargetDateFromQuestion(
  question?: string,
  fallbackYear?: number,
  now: Date = new Date(),
): ParsedQuestionTimeContext {
  const text = (question ?? '').trim();
  const baseYear = typeof fallbackYear === 'number' && Number.isFinite(fallbackYear)
    ? Math.trunc(fallbackYear)
    : now.getFullYear();

  let year = baseYear;
  let month = now.getMonth() + 1;
  let day = now.getDate();
  let explicitTimeDetected = false;
  const reasons: string[] = [];
  const focuses = new Set<YunxianFocus>();

  if (text) {
    // 1. 偵測明確年份（例如 2027年 / 2025）
    const yearMatch = text.match(/(19\d{2}|20\d{2})\s*年?/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
      explicitTimeDetected = true;
      reasons.push(`指定年份${year}`);
      focuses.add('liunian');
    } else if (/明年|下一年|來年|来年/.test(text)) {
      year = now.getFullYear() + 1;
      explicitTimeDetected = true;
      reasons.push(`明年(${year})`);
      focuses.add('liunian');
    } else if (/後年|后年/.test(text)) {
      year = now.getFullYear() + 2;
      explicitTimeDetected = true;
      reasons.push(`後年(${year})`);
      focuses.add('liunian');
    } else if (/去年|上一年/.test(text)) {
      year = now.getFullYear() - 1;
      explicitTimeDetected = true;
      reasons.push(`去年(${year})`);
      focuses.add('liunian');
    } else if (/今年|本年|這一年|这一年/.test(text)) {
      year = now.getFullYear();
      explicitTimeDetected = true;
      reasons.push(`今年(${year})`);
      focuses.add('liunian');
    }

    // 2. 偵測明確月份或相對月份
    const mdMatch = text.match(/(\d{1,2})\s*[月\/\-]\s*(\d{1,2})\s*[日號号]?/);
    if (mdMatch) {
      const m = parseInt(mdMatch[1], 10);
      const d = parseInt(mdMatch[2], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        month = m;
        day = d;
        explicitTimeDetected = true;
        reasons.push(`指定日期${m}月${d}日`);
        focuses.add('liuyue');
        focuses.add('liuri');
      }
    } else {
      const monthMatch = text.match(/(?:^|[^\d])(1[0-2]|0?[1-9])\s*月/);
      if (monthMatch) {
        month = parseInt(monthMatch[1], 10);
        day = Math.min(day, 15);
        explicitTimeDetected = true;
        reasons.push(`指定月份${month}月`);
        focuses.add('liuyue');
      } else if (/下個?月|下月/.test(text)) {
        const nextM = new Date(year, now.getMonth() + 1, 15);
        year = nextM.getFullYear();
        month = nextM.getMonth() + 1;
        day = 15;
        explicitTimeDetected = true;
        reasons.push(`下個月(${year}/${month})`);
        focuses.add('liuyue');
      } else if (/上個?月|上月/.test(text)) {
        const prevM = new Date(year, now.getMonth() - 1, 15);
        year = prevM.getFullYear();
        month = prevM.getMonth() + 1;
        day = 15;
        explicitTimeDetected = true;
        reasons.push(`上個月(${year}/${month})`);
        focuses.add('liuyue');
      } else if (/這個?月|本月|當月|当月/.test(text)) {
        year = now.getFullYear();
        month = now.getMonth() + 1;
        explicitTimeDetected = true;
        reasons.push(`本月(${year}/${month})`);
        focuses.add('liuyue');
      }
    }

    // 3. 偵測相對日（今天 / 明天 / 後天 / 昨天 / 這幾天 / 流日）
    if (/明天|明日/.test(text)) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0, 0);
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
      explicitTimeDetected = true;
      reasons.push('明天');
      focuses.add('liuri');
      focuses.add('liuyue');
    } else if (/後天|后天/.test(text)) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 12, 0, 0);
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
      explicitTimeDetected = true;
      reasons.push('後天');
      focuses.add('liuri');
      focuses.add('liuyue');
    } else if (/昨天|昨日/.test(text)) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0);
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
      explicitTimeDetected = true;
      reasons.push('昨天');
      focuses.add('liuri');
      focuses.add('liuyue');
    } else if (/今天|今日|當天|当天|流日|這幾天|这几天|最近幾天|最近几天/.test(text)) {
      year = now.getFullYear();
      month = now.getMonth() + 1;
      day = now.getDate();
      explicitTimeDetected = true;
      reasons.push('今日／近期流日');
      focuses.add('liuri');
      focuses.add('liuyue');
    }

    // 4. 關鍵字運限層級識別
    if (/大限|大運|大运|這十年|这十年|未來十年|未来十年/.test(text)) focuses.add('daxian');
    if (/小限/.test(text)) focuses.add('xiaoxian');
    if (/流年|運勢|运势|今年|明年|年運|年运/.test(text)) focuses.add('liunian');
    if (/流月|幾月|几月|月份|這月|这月|下月|本月|最近|近期/.test(text)) focuses.add('liuyue');
    if (/流日|哪天|哪一天|幾號|几号|今天|明天|這週|这周|本週|本周/.test(text)) focuses.add('liuri');
  }

  if (focuses.size === 0) {
    focuses.add('overall');
  }

  // 安全修正日期避免溢出（例如 2/30）
  const maxDayInMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.max(1, Math.min(maxDayInMonth, day));
  const targetDate = new Date(year, month - 1, safeDay, 12, 0, 0);

  return {
    targetDate,
    focuses: Array.from(focuses),
    explicitTimeDetected,
    reason: reasons.length > 0 ? reasons.join('、') : `預設參考時間(${year}/${month}/${safeDay})`,
  };
}

/**
 * 計算指定命盤在指定公曆日期的完整五層運限（大限、小限、流年、流月、流日）
 */
export function computeYunxianSnapshot(
  chart: ZiweiChart,
  targetDate: Date = new Date(),
): YunxianSnapshot {
  const safeDate = Number.isNaN(targetDate.getTime()) ? new Date() : targetDate;
  const solar = Solar.fromYmd(
    safeDate.getFullYear(),
    safeDate.getMonth() + 1,
    safeDate.getDate(),
  );
  const lunar = solar.getLunar();

  const rawLunarMonth = Number(lunar.getMonth());
  const isLeapMonth = rawLunarMonth < 0;
  const targetLunarMonth = Math.abs(rawLunarMonth);
  const targetLunarYear = Number(lunar.getYear());
  const targetLunarDay = Number(lunar.getDay());

  // 虛歲（農曆年差 + 1，與 yunxian-context.ts 一致）
  const nominalAge = Math.max(1, targetLunarYear - chart.lunarInfo.lunarYear + 1);

  // 1. 大限
  let daXian: YunxianLayerSnapshot | null = null;
  const matchedDx =
    chart.daXians.find(d => nominalAge >= d.startAge && nominalAge <= d.endAge) ??
    chart.daXians[chart.currentDaXianIndex] ??
    chart.daXians[0];

  if (matchedDx) {
    const dxPalace = getPalaceByBranch(chart, matchedDx.palaceBranch);
    const dxStem = matchedDx.stemIndex !== undefined ? matchedDx.stemIndex : dxPalace.stem;
    const { flights, luFollowsJi } = buildFlightsForStem(chart, dxStem);
    daXian = {
      label: '大限',
      periodDesc: `${matchedDx.startAge}–${matchedDx.endAge}歲`,
      palaceName: dxPalace.name,
      branch: dxPalace.branch,
      branchName: BRANCHES[dxPalace.branch] ?? '',
      stemIndex: dxStem,
      stemName: STEMS[dxStem] ?? '',
      flights,
      luFollowsJi,
    };
  }

  // 2. 小限
  const xiaoXianBranch = computeXiaoXianBranch(
    chart.lunarInfo.yearBranch,
    chart.birthInfo.gender,
    nominalAge,
  );
  const xiaoXianPalace = getPalaceByBranch(chart, xiaoXianBranch);
  const xxFlight = buildFlightsForStem(chart, xiaoXianPalace.stem);
  const xiaoXian: YunxianLayerSnapshot = {
    label: '小限',
    periodDesc: `虛歲${nominalAge}歲`,
    palaceName: xiaoXianPalace.name,
    branch: xiaoXianPalace.branch,
    branchName: BRANCHES[xiaoXianPalace.branch] ?? '',
    stemIndex: xiaoXianPalace.stem,
    stemName: STEMS[xiaoXianPalace.stem] ?? '',
    flights: xxFlight.flights,
    luFollowsJi: xxFlight.luFollowsJi,
  };

  // 3. 流年
  const yearlyStem = getYearStemIndex(targetLunarYear);
  const yearlyBranch = getYearBranchIndex(targetLunarYear);
  const yearlyPalace = getPalaceByBranch(chart, yearlyBranch);
  const lnFlight = buildFlightsForStem(chart, yearlyStem);
  const liuNian: YunxianLayerSnapshot = {
    label: '流年',
    periodDesc: `${targetLunarYear}年(${STEMS[yearlyStem] ?? ''}${BRANCHES[yearlyBranch] ?? ''})`,
    palaceName: yearlyPalace.name,
    branch: yearlyPalace.branch,
    branchName: BRANCHES[yearlyPalace.branch] ?? '',
    stemIndex: yearlyStem,
    stemName: STEMS[yearlyStem] ?? '',
    flights: lnFlight.flights,
    luFollowsJi: lnFlight.luFollowsJi,
  };

  // 4. 流月（斗君起正月順行至農曆月 + 五虎遁流月天干四化）
  const douJunBranch = computeDouJunBranch(
    yearlyBranch,
    chart.lunarInfo.lunarMonth,
    chart.birthInfo.hour,
  );
  const nextYearStem = getYearStemIndex(targetLunarYear + 1);
  const lySiHua = getLiuYueSiHua(yearlyStem, targetLunarMonth, {
    isLeapMonth,
    liuriDay: targetLunarDay,
    nextYearStem,
  });
  const liuYueBranch = (douJunBranch + (lySiHua.month - 1)) % 12;
  const liuYuePalace = getPalaceByBranch(chart, liuYueBranch);
  const lyFlight = buildFlightsForStem(chart, lySiHua.stemIndex);
  const monthZhi = BRANCHES[(lySiHua.month + 1) % 12] ?? '';
  const liuYue: YunxianLayerSnapshot = {
    label: '流月',
    periodDesc: `農曆${isLeapMonth ? '閏' : ''}${targetLunarMonth}月(${lySiHua.stemName}${monthZhi}月)`,
    palaceName: liuYuePalace.name,
    branch: liuYuePalace.branch,
    branchName: BRANCHES[liuYuePalace.branch] ?? '',
    stemIndex: lySiHua.stemIndex,
    stemName: lySiHua.stemName,
    flights: lyFlight.flights,
    luFollowsJi: lyFlight.luFollowsJi,
  };

  // 5. 流日（自流月落宮起初一順行至農曆日 + 日柱天干四化）
  const liuRiBranch = (liuYueBranch + (targetLunarDay - 1)) % 12;
  const liuRiPalace = getPalaceByBranch(chart, liuRiBranch);
  const lrSiHua = getLiuRiSiHua(targetLunarYear, targetLunarMonth, targetLunarDay, isLeapMonth);
  const dayStemIndex = lrSiHua?.stemIndex ?? Math.max(0, STEMS.indexOf(lunar.getDayGan()));
  const dayGanZhi = `${lunar.getDayGan()}${lunar.getDayZhi()}`;
  const lrFlight = buildFlightsForStem(chart, dayStemIndex);
  const liuRi: YunxianLayerSnapshot = {
    label: '流日',
    periodDesc: `農曆${targetLunarMonth}月${targetLunarDay}日(${dayGanZhi}日)`,
    palaceName: liuRiPalace.name,
    branch: liuRiPalace.branch,
    branchName: BRANCHES[liuRiPalace.branch] ?? '',
    stemIndex: dayStemIndex,
    stemName: STEMS[dayStemIndex] ?? '',
    flights: lrFlight.flights,
    luFollowsJi: lrFlight.luFollowsJi,
  };

  // 6. 大限完整時序（供跨十年或特定年齡提問）
  const daXianTimeline = chart.daXians.slice(0, 8).map(d => {
    const p = getPalaceByBranch(chart, d.palaceBranch);
    return `${d.startAge}–${d.endAge}歲:${p.name}(${STEMS[p.stem] ?? ''}${BRANCHES[p.branch] ?? ''})`;
  });

  // 7. 多層疊宮與祿／忌集中共振點自動計算
  const layerList: YunxianLayerSnapshot[] = [
    ...(daXian ? [daXian] : []),
    xiaoXian,
    liuNian,
    liuYue,
    liuRi,
  ];
  const palaceHits = new Map<string, string[]>();
  const addHit = (palaceName: string, tag: string) => {
    const arr = palaceHits.get(palaceName) ?? [];
    arr.push(tag);
    palaceHits.set(palaceName, arr);
  };

  for (const layer of layerList) {
    addHit(layer.palaceName, `${layer.label}命宮疊入`);
    for (const f of layer.flights) {
      if (f.siHua === '禄' || f.siHua === '忌') {
        addHit(f.targetPalace, `${layer.label}${f.starName}化${f.siHuaTrad}`);
      }
    }
  }

  const resonanceHighlights = Array.from(palaceHits.entries())
    .filter(([, tags]) => tags.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([palace, tags]) => `${palace}【${tags.join(' + ')}】`);

  const targetDateStr = `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, '0')}-${String(safeDate.getDate()).padStart(2, '0')}`;
  const targetLunarStr = `${STEMS[yearlyStem] ?? ''}${BRANCHES[yearlyBranch] ?? ''}年 農曆${isLeapMonth ? '閏' : ''}${targetLunarMonth}月${targetLunarDay}日 ${dayGanZhi}日`;

  return {
    targetDateStr,
    targetLunarStr,
    targetLunarYear,
    targetLunarMonth,
    targetLunarDay,
    isLeapMonth,
    nominalAge,
    daXian,
    xiaoXian,
    liuNian,
    liuYue,
    liuRi,
    daXianTimeline,
    resonanceHighlights,
  };
}

/** 單行格式化某一層運限供 AI Prompt 注入（精簡高密度，保留全部算術結果） */
export function formatYunxianLayerLine(layer: YunxianLayerSnapshot): string {
  const flightStr = layer.flights
    .map(f => `${f.starName}化${f.siHuaTrad}→${f.targetPalace}`)
    .join('、');
  return `- ${layer.label}(${layer.periodDesc})：落本命【${layer.palaceName}】(${layer.stemName}${layer.branchName}) | 四化飛入：${flightStr}`;
}
