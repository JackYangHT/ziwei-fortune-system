/**
 * 流时/流分四化飞星与来因宫纯计算模块（仅含计算，不含 UI 与文案）
 * 逻辑来源：
 * 1. 五鼠遁推天干、十干四化与流时/流分计算：ziwei-fortune/webapp/app.js:1635-1701 (getStemByWuShuDun, SIHUA_PER_STEM, calculateFlowMinute)
 * 2. 来因宫（生年天干对应宫位与地支）定位计算：ziwei-fortune/webapp/app.js:1789-1821 (calculateThreeSchools)
 */

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

export type HeavenlyStem = (typeof STEMS)[number];
export type EarthlyBranch = (typeof BRANCHES)[number];

export interface SihuaTuple {
  lu: string;
  quan: string;
  ke: string;
  ji: string;
}

/**
 * 十天干四化表（甲廉破武阳，乙机梁紫阴，丙同机昌廉，丁阴同机巨，戊贪阴右机，
 * 己武贪梁曲，庚阳武阴同，辛巨阳曲昌，壬梁紫左武，癸破巨阴贪）
 * 逻辑来源：ziwei-fortune/webapp/app.js:1645-1656 (SIHUA_PER_STEM)
 */
export const SIHUA_PER_STEM: Readonly<Record<string, SihuaTuple>> = {
  '甲': { lu: '廉貞', quan: '破軍', ke: '武曲', ji: '太陽' },
  '乙': { lu: '天機', quan: '天梁', ke: '紫微', ji: '太陰' },
  '丙': { lu: '天同', quan: '天機', ke: '文昌', ji: '廉貞' },
  '丁': { lu: '太陰', quan: '天同', ke: '天機', ji: '巨門' },
  '戊': { lu: '貪狼', quan: '太陰', ke: '右弼', ji: '天機' },
  '己': { lu: '武曲', quan: '貪狼', ke: '天梁', ji: '文曲' },
  '庚': { lu: '太陽', quan: '武曲', ke: '太陰', ji: '天同' },
  '辛': { lu: '巨門', quan: '太陽', ke: '文曲', ji: '文昌' },
  '壬': { lu: '天梁', quan: '紫微', ke: '左輔', ji: '武曲' },
  '癸': { lu: '破軍', quan: '巨門', ke: '太陰', ji: '貪狼' },
};

/**
 * 五鼠遁：由上一级天干（日干或时干）与当前地支序号(0-11)推算当前天干
 * 甲己还加甲(0)，乙庚丙作初(2)，丙辛从戊起(4)，丁壬庚子居(6)，戊癸何方发，壬子是真途(8)
 * 逻辑来源：ziwei-fortune/webapp/app.js:1636-1643 (getStemByWuShuDun)
 */
export function getStemByWuShuDun(parentStem: string, branchIdx: number): HeavenlyStem {
  const pIdx = STEMS.indexOf(parentStem as HeavenlyStem);
  if (pIdx < 0) return '甲';
  const startStemIdx = (pIdx % 5) * 2;
  const normalizedBranchIdx = ((branchIdx % 12) + 12) % 12;
  return STEMS[(startStemIdx + normalizedBranchIdx) % 10];
}

export interface FlowMinuteCalculation {
  timeStr: string;
  hourBranchIndex: number;
  hourBranch: EarthlyBranch;
  hourStem: HeavenlyStem;
  hourGanZhi: string;
  hourSihua: SihuaTuple;
  minuteSlotIndex: number;
  minuteBranch: EarthlyBranch;
  minuteStem: HeavenlyStem;
  minuteGanZhi: string;
  minuteRange: string;
  minuteSihua: SihuaTuple;
}

/**
 * 流时与流分干支及四化飞星纯计算函数（不含文案）
 * - 将 1 个时辰（120 分钟）均分为 12 个流分刻段（每 10 分钟对应一地支：子分~亥分）
 * - 用五鼠遁由日干起流时干支，再由流时天干起流分干支
 * 逻辑来源：ziwei-fortune/webapp/app.js:1658-1701 (calculateFlowMinute)
 */
export function calculateFlowMinute(
  dailyStem: string,
  timeStr = '12:00',
): FlowMinuteCalculation {
  const parts = String(timeStr || '12:00').split(':');
  const hh = parseInt(parts[0], 10) || 0;
  const mm = parseInt(parts[1], 10) || 0;

  // 1. 流时地支 index (0=子: 23:00-00:59, 1=丑: 01:00-02:59, ...)
  let hourBranchIdx = 0;
  let elapsedMinsInShichen = 0;
  if (hh === 23) {
    hourBranchIdx = 0;
    elapsedMinsInShichen = mm;
  } else if (hh === 0) {
    hourBranchIdx = 0;
    elapsedMinsInShichen = 60 + mm;
  } else {
    hourBranchIdx = Math.floor((hh + 1) / 2);
    const startHour = hourBranchIdx * 2 - 1;
    elapsedMinsInShichen = (hh - startHour) * 60 + mm;
  }

  const hourBranch = BRANCHES[hourBranchIdx];
  const hourStem = getStemByWuShuDun(dailyStem, hourBranchIdx);
  const hourGanZhi = `${hourStem}${hourBranch}`;
  const hourSihua = SIHUA_PER_STEM[hourStem] || SIHUA_PER_STEM['甲'];

  // 2. 流分地支：120 分钟分 12 个刻段，每 10 分钟一宫 (0..11 -> 子..亥)
  const minBranchIdx = Math.min(11, Math.max(0, Math.floor(elapsedMinsInShichen / 10)));
  const minBranch = BRANCHES[minBranchIdx];
  const minStem = getStemByWuShuDun(hourStem, minBranchIdx);
  const minGanZhi = `${minStem}${minBranch}`;
  const minSihua = SIHUA_PER_STEM[minStem] || SIHUA_PER_STEM['甲'];

  // 3. 计算该 10 分钟流分区间的起止时间字符串
  const shichenStartTotalMins = hourBranchIdx === 0 ? 23 * 60 : (hourBranchIdx * 2 - 1) * 60;
  const slotStartTotal = (shichenStartTotalMins + minBranchIdx * 10) % 1440;
  const slotEndTotal = (slotStartTotal + 9) % 1440;
  const fmt = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const minuteRange = `${fmt(slotStartTotal)}–${fmt(slotEndTotal)}`;

  return {
    timeStr: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
    hourBranchIndex: hourBranchIdx,
    hourBranch,
    hourStem,
    hourGanZhi,
    hourSihua,
    minuteSlotIndex: minBranchIdx,
    minuteBranch: minBranch,
    minuteStem: minStem,
    minuteGanZhi: minGanZhi,
    minuteRange,
    minuteSihua: minSihua,
  };
}

export interface PalaceStemBranchItem {
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
}

export interface LaiYinPalaceResult {
  birthYearStem: string;
  laiYinPalaceName: string;
  laiYinBranch: string;
  natalSihua: SihuaTuple;
}

/**
 * 钦天四化派「来因宫」计算纯函数（不含流派评语文案）
 * - 来因宫即命盘十二宫中，宫干与生年天干相同的宫位（排除子、丑两宫天干重复时按寅宫起五虎遁常规宫位匹配）
 * 逻辑来源：ziwei-fortune/webapp/app.js:1789-1821 (calculateThreeSchools)
 */
export function calculateLaiYinPalace(
  birthYearStem: string,
  palaces: readonly PalaceStemBranchItem[],
): LaiYinPalaceResult {
  const stem = birthYearStem ? birthYearStem[0] : '甲';
  // 钦天派来因宫通常取寅卯辰巳午未申酉戌亥（或匹配到的宫位）
  const matched =
    palaces.find(
      (p) =>
        p.heavenlyStem === stem &&
        p.earthlyBranch !== '子' &&
        p.earthlyBranch !== '丑',
    ) || palaces.find((p) => p.heavenlyStem === stem);

  return {
    birthYearStem: stem,
    laiYinPalaceName: matched ? matched.name : '命宮',
    laiYinBranch: matched ? matched.earthlyBranch : '寅',
    natalSihua: SIHUA_PER_STEM[stem] || SIHUA_PER_STEM['甲'],
  };
}
