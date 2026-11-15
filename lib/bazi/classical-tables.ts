/**
 * 六十甲子纳音、八字纳音飞财格判定与穷通宝鉴四时调候查表纯函数
 * 逻辑来源：
 * 1. 纳音与八字飞财格判定：ziwei-fortune/webapp/app.js:7109-7190 (NAYIN_MAP, isKe, scoreLetou 八字飛財判斷)
 * 2. 四时调候与五行生扶克泄查表：ziwei-fortune/webapp/app.js:9151-9228 (resolveElementsBalance)
 */

export type FiveElement = '木' | '火' | '土' | '金' | '水';

export interface NayinInfo {
  name: string;
  el: FiveElement;
}

/**
 * 六十甲子纳音五行表
 * 逻辑来源：ziwei-fortune/webapp/app.js:7110-7141 (NAYIN_MAP)
 */
export const NAYIN_MAP: Readonly<Record<string, NayinInfo>> = {
  '甲子': { name: '海中金', el: '金' }, '乙丑': { name: '海中金', el: '金' },
  '丙寅': { name: '爐中火', el: '火' }, '丁卯': { name: '爐中火', el: '火' },
  '戊辰': { name: '大林木', el: '木' }, '己巳': { name: '大林木', el: '木' },
  '庚午': { name: '路旁土', el: '土' }, '辛未': { name: '路旁土', el: '土' },
  '壬申': { name: '劍鋒金', el: '金' }, '癸酉': { name: '劍鋒金', el: '金' },
  '甲戌': { name: '山頭火', el: '火' }, '乙亥': { name: '山頭火', el: '火' },
  '丙子': { name: '澗下水', el: '水' }, '丁丑': { name: '澗下水', el: '水' },
  '戊寅': { name: '城頭土', el: '土' }, '己卯': { name: '城頭土', el: '土' },
  '庚辰': { name: '白蠟金', el: '金' }, '辛巳': { name: '白蠟金', el: '金' },
  '壬午': { name: '楊柳木', el: '木' }, '癸未': { name: '楊柳木', el: '木' },
  '甲申': { name: '泉中水', el: '水' }, '乙酉': { name: '泉中水', el: '水' },
  '丙戌': { name: '屋上土', el: '土' }, '丁亥': { name: '屋上土', el: '土' },
  '戊子': { name: '霹靂火', el: '火' }, '己丑': { name: '霹靂火', el: '火' },
  '庚寅': { name: '松柏木', el: '木' }, '辛卯': { name: '松柏木', el: '木' },
  '壬辰': { name: '長流水', el: '水' }, '癸巳': { name: '長流水', el: '水' },
  '甲午': { name: '砂中金', el: '金' }, '乙未': { name: '砂中金', el: '金' },
  '丙申': { name: '山下火', el: '火' }, '丁酉': { name: '山下火', el: '火' },
  '戊戌': { name: '平地木', el: '木' }, '己亥': { name: '平地木', el: '木' },
  '庚子': { name: '壁上土', el: '土' }, '辛丑': { name: '壁上土', el: '土' },
  '壬寅': { name: '金箔金', el: '金' }, '癸卯': { name: '金箔金', el: '金' },
  '甲辰': { name: '覆燈火', el: '火' }, '乙巳': { name: '覆燈火', el: '火' },
  '丙午': { name: '天河水', el: '水' }, '丁未': { name: '天河水', el: '水' },
  '戊申': { name: '大驛土', el: '土' }, '己酉': { name: '大驛土', el: '土' },
  '庚戌': { name: '釵釧金', el: '金' }, '辛亥': { name: '釵釧金', el: '金' },
  '壬子': { name: '桑柘木', el: '木' }, '癸丑': { name: '桑柘木', el: '木' },
  '甲寅': { name: '大溪水', el: '水' }, '乙卯': { name: '大溪水', el: '水' },
  '丙辰': { name: '沙中土', el: '土' }, '丁巳': { name: '沙中土', el: '土' },
  '戊午': { name: '天上火', el: '火' }, '己未': { name: '天上火', el: '火' },
  '庚申': { name: '石榴木', el: '木' }, '辛酉': { name: '石榴木', el: '木' },
  '壬戌': { name: '大海水', el: '水' }, '癸亥': { name: '大海水', el: '水' },
};

/**
 * 五行相克判定（el1 是否克 el2）
 * 逻辑来源：ziwei-fortune/webapp/app.js:7143-7146 (isKe)
 */
export function isKe(el1: FiveElement | string, el2: FiveElement | string): boolean {
  const keMap: Record<string, string> = {
    '木': '土',
    '土': '水',
    '水': '火',
    '火': '金',
    '金': '木',
  };
  return keMap[el1] === el2;
}

/**
 * 查取干支对应的纳音信息
 * 逻辑来源：ziwei-fortune/webapp/app.js:7110-7141
 */
export function getNayin(ganZhi: string): NayinInfo | null {
  return NAYIN_MAP[ganZhi] ?? null;
}

export interface BaziFeiCaiResult {
  isBaziFeiCai: boolean;
  /** 触发类型：'year_nayin_ke_day' (年命纳音克流日纳音) | 'day_nayin_ke_flow' (日柱纳音克流日纳音) | 'day_stem_ke_flow_stem' (日干克流日天干) | null */
  matchType: 'year_nayin_ke_day' | 'day_nayin_ke_flow' | 'day_stem_ke_flow_stem' | null;
  natalYearNayin: NayinInfo | null;
  natalDayNayin: NayinInfo | null;
  dailyNayin: NayinInfo | null;
  scoreBonus: number;
}

const STEM_ELEMENT_MAP: Readonly<Record<string, FiveElement>> = {
  '甲': '木', '乙': '木',
  '丙': '火', '丁': '火',
  '戊': '土', '己': '土',
  '庚': '金', '辛': '金',
  '壬': '水', '癸': '水',
};

/**
 * 纳音飞财格与日干克流日天干偏财判定纯函数
 * 逻辑来源：ziwei-fortune/webapp/app.js:7155-7190 (scoreLetou 八字飛財判斷)
 */
export function evaluateBaziFeiCai(
  natalYearGanZhi: string,
  natalDayGanZhi: string,
  dailyGanZhi: string,
): BaziFeiCaiResult {
  const natalYearNayin = getNayin(natalYearGanZhi);
  const natalDayNayin = getNayin(natalDayGanZhi);
  const dailyNayin = getNayin(dailyGanZhi);

  if (natalYearNayin && dailyNayin && isKe(natalYearNayin.el, dailyNayin.el)) {
    return {
      isBaziFeiCai: true,
      matchType: 'year_nayin_ke_day',
      natalYearNayin,
      natalDayNayin,
      dailyNayin,
      scoreBonus: 18,
    };
  }

  if (natalDayNayin && dailyNayin && isKe(natalDayNayin.el, dailyNayin.el)) {
    return {
      isBaziFeiCai: true,
      matchType: 'day_nayin_ke_flow',
      natalYearNayin,
      natalDayNayin,
      dailyNayin,
      scoreBonus: 18,
    };
  }

  const natalDayStem = natalDayGanZhi ? natalDayGanZhi[0] : '';
  const dailyStem = dailyGanZhi ? dailyGanZhi[0] : '';
  const natalDayStemEl = STEM_ELEMENT_MAP[natalDayStem];
  const dailyStemEl = STEM_ELEMENT_MAP[dailyStem];

  if (natalDayStemEl && dailyStemEl && isKe(natalDayStemEl, dailyStemEl)) {
    return {
      isBaziFeiCai: true,
      matchType: 'day_stem_ke_flow_stem',
      natalYearNayin,
      natalDayNayin,
      dailyNayin,
      scoreBonus: 18,
    };
  }

  return {
    isBaziFeiCai: false,
    matchType: null,
    natalYearNayin,
    natalDayNayin,
    dailyNayin,
    scoreBonus: 0,
  };
}

export interface ElementsBalanceResult {
  mainEl: FiveElement;
  usefulEl: FiveElement;
  secondUsefulEl: FiveElement;
  avoidEl: FiveElement;
  seasonalNote: string;
}

/**
 * 结合紫微命局五行与出生月份（穷通宝鉴四时调候）推导喜用神、次喜用神与忌神
 * 逻辑来源：ziwei-fortune/webapp/app.js:9151-9228 (resolveElementsBalance)
 */
export function resolveElementsBalance(
  fiveElementsClass: string,
  birthMonth?: number,
): ElementsBalanceResult {
  const s = String(fiveElementsClass || '土五局');
  let mainEl: FiveElement = '土';
  if (s.includes('木')) mainEl = '木';
  else if (s.includes('火')) mainEl = '火';
  else if (s.includes('土')) mainEl = '土';
  else if (s.includes('金')) mainEl = '金';
  else if (s.includes('水')) mainEl = '水';

  // 五行生扶克泄对照表
  const shengWo: Record<FiveElement, FiveElement> = {
    '木': '水', '火': '木', '土': '火', '金': '土', '水': '金',
  };
  const woSheng: Record<FiveElement, FiveElement> = {
    '木': '火', '火': '土', '土': '金', '金': '水', '水': '木',
  };
  const keWo: Record<FiveElement, FiveElement> = {
    '木': '金', '火': '水', '土': '木', '金': '火', '水': '土',
  };

  let usefulEl: FiveElement = shengWo[mainEl];
  let secondUsefulEl: FiveElement = woSheng[mainEl];
  let avoidEl: FiveElement = keWo[mainEl];
  let seasonalNote = '';

  const m = birthMonth ?? 6;
  if (m === 11 || m === 12 || m === 1) {
    // 冬季（亥子丑月）：水冷金寒，首重火调候暖局，次取木助火生发，最忌水寒叠加
    usefulEl = '火';
    secondUsefulEl = '木';
    avoidEl = '水';
    seasonalNote = '生於冬令寒月（水冷天寒），《窮通寶鑑》調候首重「火」以溫煦暖局，次取「木」相生通明，最忌寒水再增。';
  } else if (m >= 5 && m <= 7) {
    // 夏季（巳午未月）：火炎土燥，首重水调候润局，次取金生水发源，最忌燥火叠加
    usefulEl = '水';
    secondUsefulEl = '金';
    avoidEl = '火';
    seasonalNote = '生於夏令炎月（火旺土燥），《窮通寶鑑》調候首重「水」以滋潤降燥，次取「金」發水源頭，最忌烈火再燥。';
  } else if (m >= 2 && m <= 4) {
    // 春季（寅卯辰月）：木旺气盛，宜火宣泄秀气、金疏劈裁抑，忌木塞过盛
    usefulEl = mainEl === '木' ? '火' : shengWo[mainEl];
    secondUsefulEl = mainEl === '木' ? '金' : '火';
    avoidEl = keWo[mainEl];
    seasonalNote = '生於春令木旺之月，生機勃發，宜順應木火通明之氣勢宣洩才華。';
  } else {
    // 秋季（申酉戌月）：金旺气肃，宜水泄金秀或火炼秋金，忌燥土晦金或寒金过肃
    usefulEl = mainEl === '金' ? '水' : shengWo[mainEl];
    secondUsefulEl = mainEl === '金' ? '火' : '水';
    avoidEl = keWo[mainEl];
    seasonalNote = '生於秋令金氣肅降之月，宜水吐秀氣、木火溫潤調和。';
  }

  return {
    mainEl,
    usefulEl,
    secondUsefulEl,
    avoidEl,
    seasonalNote,
  };
}
