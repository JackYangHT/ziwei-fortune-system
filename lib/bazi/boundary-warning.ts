/**
 * 交节边界与时辰交界预警纯函数
 * 逻辑来源：ziwei-fortune/webapp/app.js:863-1153 (SOLAR_TERMS_CONFIG, checkSolarTermCrossing, calculateSolarTimeCorrection)
 */

export interface FourPillarsInput {
  year: string;
  month: string;
  day: string;
  hour: string;
}

export interface BirthMomentInput {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute?: number; // 0-59
  /** 时区（小时），默认 8 (UTC+8) */
  tz?: number;
  /** 真太阳时与钟表时总修正分钟数（可选，若传入则同时检测钟表时辰与真太阳时辰是否跨界） */
  solarOffsetMinutes?: number;
}

export interface BoundaryWarningResult {
  yearPending: boolean;
  monthPending: boolean;
  hourPending: boolean;
  /** 若处于交节 ±6 小时内，返回对应节气名 */
  solarTermName: string | null;
  /** 距离最近节气交节时刻的分钟差（绝对值） */
  diffMinutesToTerm: number | null;
  /** 距离最近时辰交界点（奇数整点）的分钟数 */
  distToHourBoundaryMinutes: number;
  /** 若提供了 solarOffsetMinutes，指示钟表时辰与真太阳时辰是否不同 */
  clockShichenMismatch: boolean;
  /** 标注待确认后的四柱干支 */
  adjustedPillars: FourPillarsInput;
}

export interface SolarTermConfigItem {
  name: string;
  angle: number;
  month: number;
  day: number;
  isMajorJie?: boolean;
}

export const SOLAR_TERMS_CONFIG: readonly SolarTermConfigItem[] = [
  { name: '小寒', angle: 285, month: 1, day: 6, isMajorJie: true },
  { name: '大寒', angle: 300, month: 1, day: 20 },
  { name: '立春', angle: 315, month: 2, day: 4, isMajorJie: true },
  { name: '雨水', angle: 330, month: 2, day: 19 },
  { name: '驚蟄', angle: 345, month: 3, day: 6, isMajorJie: true },
  { name: '春分', angle: 0, month: 3, day: 21 },
  { name: '清明', angle: 15, month: 4, day: 5, isMajorJie: true },
  { name: '穀雨', angle: 30, month: 4, day: 20 },
  { name: '立夏', angle: 45, month: 5, day: 6, isMajorJie: true },
  { name: '小滿', angle: 60, month: 5, day: 21 },
  { name: '芒種', angle: 75, month: 6, day: 6, isMajorJie: true },
  { name: '夏至', angle: 90, month: 6, day: 21 },
  { name: '小暑', angle: 105, month: 7, day: 7, isMajorJie: true },
  { name: '大暑', angle: 120, month: 7, day: 23 },
  { name: '立秋', angle: 135, month: 8, day: 8, isMajorJie: true },
  { name: '處暑', angle: 150, month: 8, day: 23 },
  { name: '白露', angle: 165, month: 9, day: 8, isMajorJie: true },
  { name: '秋分', angle: 180, month: 9, day: 23 },
  { name: '寒露', angle: 195, month: 10, day: 8, isMajorJie: true },
  { name: '霜降', angle: 210, month: 10, day: 23 },
  { name: '立冬', angle: 225, month: 11, day: 7, isMajorJie: true },
  { name: '小雪', angle: 240, month: 11, day: 22 },
  { name: '大雪', angle: 255, month: 12, day: 7, isMajorJie: true },
  { name: '冬至', angle: 270, month: 12, day: 22 },
];

const SHICHEN_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

/**
 * 儒略日换算 (UTC)
 */
export function dateToJD(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const dayFraction = (hour + minute / 60 + second / 3600) / 24;
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    dayFraction +
    B -
    1524.5
  );
}

/**
 * 儒略日转公历日期对象 (加指定时区偏移)
 */
export function jdToDate(
  jd: number,
  tzOffsetHours = 8,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const localJD = jd + tzOffsetHours / 24 + 0.5;
  const Z = Math.floor(localJD);
  const F = localJD - Z;
  let A = Z;
  if (Z >= 2299161) {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);

  const dayWithFrac = B - D - Math.floor(30.6001 * E) + F;
  const day = Math.floor(dayWithFrac);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;

  const totalHours = (dayWithFrac - day) * 24;
  let hour = Math.floor(totalHours);
  let minute = Math.round((totalHours - hour) * 60);
  if (minute >= 60) {
    minute -= 60;
    hour = (hour + 1) % 24;
  }
  return { year, month, day, hour, minute };
}

/**
 * 太阳视黄经计算 (精度约 0.01 度，对应交节时刻精度约 15 分钟内)
 */
export function getSunEclipticLongitude(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  let L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  L0 = ((L0 % 360) + 360) % 360;
  let M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  M = ((M % 360) + 360) % 360;
  const Mrad = (M * Math.PI) / 180;

  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
    0.000289 * Math.sin(3 * Mrad);

  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda =
    trueLong - 0.00569 - 0.00478 * Math.sin((omega * Math.PI) / 180);
  return ((lambda % 360) + 360) % 360;
}

/**
 * 牛顿迭代求指定年份某节气精确交节 JD (UTC)
 */
export function findSolarTermJD(
  year: number,
  termConfig: SolarTermConfigItem,
): number {
  let jd = dateToJD(year, termConfig.month, termConfig.day, 4, 0, 0);
  for (let i = 0; i < 10; i++) {
    const curLon = getSunEclipticLongitude(jd);
    let diff = termConfig.angle - curLon;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    if (Math.abs(diff) < 0.00001) break;
    jd += (diff / 360) * 365.2422;
  }
  return jd;
}

export interface SolarTermCrossingResult {
  isNearSolarTerm: boolean;
  termName?: string;
  isMajorJie?: boolean;
  diffHours?: number;
  diffMinutes?: number;
  termTimeFormatted?: string;
  isBeforeTerm?: boolean;
}

/**
 * 检查出生时刻是否处于 24 节气交节前后 6 小时内
 */
export function checkSolarTermCrossing(
  year: number,
  month: number,
  day: number,
  trueHoursFloat: number,
  tz = 8,
): SolarTermCrossingResult {
  const birthJD_UTC =
    dateToJD(year, month, day, 0, 0, 0) + (trueHoursFloat - tz) / 24;

  for (const term of SOLAR_TERMS_CONFIG) {
    if (
      Math.abs(term.month - month) <= 1 ||
      (term.month === 1 && month === 12) ||
      (term.month === 12 && month === 1)
    ) {
      const termJD = findSolarTermJD(year, term);
      const diffHours = (birthJD_UTC - termJD) * 24;
      const absDiffHours = Math.abs(diffHours);
      if (absDiffHours <= 6.0) {
        const termDate = jdToDate(termJD, tz);
        const termTimeStr = `${termDate.year}-${String(termDate.month).padStart(2, '0')}-${String(termDate.day).padStart(2, '0')} ${String(termDate.hour).padStart(2, '0')}:${String(termDate.minute).padStart(2, '0')}`;
        return {
          isNearSolarTerm: true,
          termName: term.name,
          isMajorJie: Boolean(term.isMajorJie),
          diffHours: Math.round(absDiffHours * 10) / 10,
          diffMinutes: Math.round(absDiffHours * 60),
          termTimeFormatted: termTimeStr,
          isBeforeTerm: diffHours < 0,
        };
      }
    }
  }
  return { isNearSolarTerm: false };
}

function getShichenIndexFromMinutes(totalMinutesInDay: number): number {
  const normalized = ((Math.round(totalMinutesInDay) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  if (h === 23 || h === 0) return 0; // 子时 (23:00 - 00:59)
  return Math.floor((h + 1) / 2);
}

/**
 * 计算距离最近时辰交界点（奇数整点：01:00, 03:00, ..., 23:00）的分钟差
 */
export function getMinutesToNearestHourBoundary(totalMinutesInDay: number): number {
  const normalized = ((totalMinutesInDay % 1440) + 1440) % 1440;
  // 奇数整点对应分钟数为 60, 180, 300, ..., 1380 (即 60 + 120 * k)
  const mod = (((normalized - 60) % 120) + 120) % 120;
  return Math.min(mod, 120 - mod);
}

function normalizeBirthMoment(input: BirthMomentInput | Date | string): BirthMomentInput {
  if (input instanceof Date) {
    return {
      year: input.getFullYear(),
      month: input.getMonth() + 1,
      day: input.getDate(),
      hour: input.getHours(),
      minute: input.getMinutes(),
      tz: 8,
    };
  }
  if (typeof input === 'string') {
    // 支持 "YYYY-MM-DD HH:mm" 或 ISO 格式
    const m = input
      .trim()
      .match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2}))?/);
    if (m) {
      return {
        year: Number(m[1]),
        month: Number(m[2]),
        day: Number(m[3]),
        hour: m[4] !== undefined ? Number(m[4]) : 12,
        minute: m[5] !== undefined ? Number(m[5]) : 0,
        tz: 8,
      };
    }
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      return normalizeBirthMoment(parsed);
    }
    throw new Error(`Invalid birth time string: ${input}`);
  }
  return input;
}

/**
 * 交节与交时边界预警主函数
 * 输入四柱干支 + 出生时刻，输出 { yearPending, monthPending, hourPending } 及修正明细。
 */
export function checkBoundaryWarning(
  fourPillars: FourPillarsInput,
  birthMoment: BirthMomentInput | Date | string,
): BoundaryWarningResult {
  const moment = normalizeBirthMoment(birthMoment);
  const tz = moment.tz ?? 8;
  const minute = moment.minute ?? 0;
  const solarOffsetMinutes = moment.solarOffsetMinutes ?? 0;

  const clockTotalMins = moment.hour * 60 + minute;
  const trueTotalMinsRaw = clockTotalMins + solarOffsetMinutes;
  const trueTotalMins = ((Math.round(trueTotalMinsRaw) % 1440) + 1440) % 1440;

  // 1. 节气交节边界检测（±6 小时内触发）
  const stCheck = checkSolarTermCrossing(
    moment.year,
    moment.month,
    moment.day,
    trueTotalMinsRaw / 60,
    tz,
  );

  const isPendingText = (val: string) =>
    val.includes('待確認') || val.includes('待确认');

  let yearPending = isPendingText(fourPillars.year);
  let monthPending = isPendingText(fourPillars.month);

  if (stCheck.isNearSolarTerm) {
    if (stCheck.termName === '立春') {
      yearPending = true;
      monthPending = true;
    } else {
      monthPending = true;
    }
  }

  // 2. 时辰交界检测：
  //    (a) 距离奇数整点（时辰切换边界）<= 10 分钟；或
  //    (b) 提供了真太阳时偏移且钟表时辰与真太阳时辰不一致；或
  //    (c) 传入时柱本身已标记待确认。
  const distToHourBoundaryMinutes = getMinutesToNearestHourBoundary(trueTotalMins);
  const clockBranch = SHICHEN_BRANCHES[getShichenIndexFromMinutes(clockTotalMins)];
  const trueBranch = SHICHEN_BRANCHES[getShichenIndexFromMinutes(trueTotalMins)];
  const clockShichenMismatch =
    solarOffsetMinutes !== 0 && clockBranch !== trueBranch;

  const hourPending =
    isPendingText(fourPillars.hour) ||
    distToHourBoundaryMinutes <= 10 ||
    clockShichenMismatch;

  const adjustedPillars: FourPillarsInput = {
    year: yearPending ? '待確認' : fourPillars.year,
    month: monthPending ? '待確認' : fourPillars.month,
    day: fourPillars.day,
    hour: hourPending ? '待確認' : fourPillars.hour,
  };

  return {
    yearPending,
    monthPending,
    hourPending,
    solarTermName: stCheck.isNearSolarTerm ? (stCheck.termName ?? null) : null,
    diffMinutesToTerm: stCheck.isNearSolarTerm
      ? (stCheck.diffMinutes ?? null)
      : null,
    distToHourBoundaryMinutes,
    clockShichenMismatch,
    adjustedPillars,
  };
}
