/**
 * 八字基础查表库（藏干表、十神表、十二长生表、五大神煞表、六十甲子表）
 *
 * 来源说明：
 * 1. 藏干表 (BRANCH_HIDDEN_STEMS)、十神表 (getTenGod)、十二长生表 (getDiShi)：
 *    对齐《渊海子平》《三命通会》及 lunar-javascript@1.7.3 (LunarUtil.ZHI_HIDE_GAN / SHI_SHEN / CHANG_SHENG_OFFSET)。
 *    由于四柱干支直接取自 ZiweiChart.lunarInfo（不重算 Solar/Lunar），此处提供纯干支查表函数。
 * 2. 神煞表（天乙贵人、文昌、驿马、桃花、羊刃）：
 *    lunar-javascript 的 EightChar 未提供此五项四柱神煞 API，按《三命通会》《渊海子平》权威口诀查表实现。
 */

import type { FiveElement } from './classical-tables';
import type {
  DiShiStage,
  EarthlyBranch,
  HeavenlyStem,
  HiddenStemDetail,
  HiddenStemRole,
  PillarKey,
  ShenShaName,
  TenGod,
} from './types';

export const HEAVENLY_STEMS: readonly HeavenlyStem[] = [
  '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸',
] as const;

export const EARTHLY_BRANCHES: readonly EarthlyBranch[] = [
  '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥',
] as const;

export const SIXTY_JIAZI: readonly string[] = [
  '甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉',
  '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未',
  '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳',
  '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯',
  '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑',
  '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥',
] as const;

export const STEM_ELEMENT: Readonly<Record<HeavenlyStem, FiveElement>> = {
  '甲': '木', '乙': '木',
  '丙': '火', '丁': '火',
  '戊': '土', '己': '土',
  '庚': '金', '辛': '金',
  '壬': '水', '癸': '水',
};

export const BRANCH_ELEMENT: Readonly<Record<EarthlyBranch, FiveElement>> = {
  '寅': '木', '卯': '木',
  '巳': '火', '午': '火',
  '辰': '土', '戌': '土', '丑': '土', '未': '土',
  '申': '金', '酉': '金',
  '亥': '水', '子': '水',
};

export const STEM_YIN_YANG: Readonly<Record<HeavenlyStem, '阳' | '阴'>> = {
  '甲': '阳', '乙': '阴',
  '丙': '阳', '丁': '阴',
  '戊': '阳', '己': '阴',
  '庚': '阳', '辛': '阴',
  '壬': '阳', '癸': '阴',
};

/**
 * 十二地支藏干表（顺序依次为：本气、中气、余气）
 * 来源：《渊海子平》地支藏干口诀 & lunar-javascript LunarUtil.ZHI_HIDE_GAN
 * 子藏癸水在其中，丑中己癸辛金同；寅藏甲木和丙戊，卯中乙木独相逢；
 * 辰藏戊乙及癸水，巳中丙火庚戊丛；午藏丁火并己土，未中己丁乙木宗；
 * 申藏庚金壬水戊，酉宫辛字独丰隆；戌藏戊土辛丁火，亥中壬甲是真踪。
 */
export const BRANCH_HIDDEN_STEMS: Readonly<Record<EarthlyBranch, readonly HeavenlyStem[]>> = {
  '子': ['癸'],
  '丑': ['己', '癸', '辛'],
  '寅': ['甲', '丙', '戊'],
  '卯': ['乙'],
  '辰': ['戊', '乙', '癸'],
  '巳': ['丙', '庚', '戊'],
  '午': ['丁', '己'],
  '未': ['己', '丁', '乙'],
  '申': ['庚', '壬', '戊'],
  '酉': ['辛'],
  '戌': ['戊', '辛', '丁'],
  '亥': ['壬', '甲'],
};

const HIDDEN_ROLE_ORDER: readonly { role: HiddenStemRole; label: '本气' | '中气' | '余气' }[] = [
  { role: 'primary', label: '本气' },
  { role: 'middle', label: '中气' },
  { role: 'residual', label: '余气' },
];

/**
 * 十神对照表（key = `${日干}${目标天干}`）
 * 来源：《渊海子平》生克十神定义 & lunar-javascript LunarUtil.SHI_SHEN
 */
export const TEN_GOD_MAP: Readonly<Record<string, TenGod>> = {
  '甲甲': '比肩', '甲乙': '劫财', '甲丙': '食神', '甲丁': '伤官', '甲戊': '偏财', '甲己': '正财', '甲庚': '七杀', '甲辛': '正官', '甲壬': '偏印', '甲癸': '正印',
  '乙乙': '比肩', '乙甲': '劫财', '乙丁': '食神', '乙丙': '伤官', '乙己': '偏财', '乙戊': '正财', '乙辛': '七杀', '乙庚': '正官', '乙癸': '偏印', '乙壬': '正印',
  '丙丙': '比肩', '丙丁': '劫财', '丙戊': '食神', '丙己': '伤官', '丙庚': '偏财', '丙辛': '正财', '丙壬': '七杀', '丙癸': '正官', '丙甲': '偏印', '丙乙': '正印',
  '丁丁': '比肩', '丁丙': '劫财', '丁己': '食神', '丁戊': '伤官', '丁辛': '偏财', '丁庚': '正财', '丁癸': '七杀', '丁壬': '正官', '丁乙': '偏印', '丁甲': '正印',
  '戊戊': '比肩', '戊己': '劫财', '戊庚': '食神', '戊辛': '伤官', '戊壬': '偏财', '戊癸': '正财', '戊甲': '七杀', '戊乙': '正官', '戊丙': '偏印', '戊丁': '正印',
  '己己': '比肩', '己戊': '劫财', '己辛': '食神', '己庚': '伤官', '己癸': '偏财', '己壬': '正财', '己乙': '七杀', '己甲': '正官', '己丁': '偏印', '己丙': '正印',
  '庚庚': '比肩', '庚辛': '劫财', '庚壬': '食神', '庚癸': '伤官', '庚甲': '偏财', '庚乙': '正财', '庚丙': '七杀', '庚丁': '正官', '庚戊': '偏印', '庚己': '正印',
  '辛辛': '比肩', '辛庚': '劫财', '辛癸': '食神', '辛壬': '伤官', '辛乙': '偏财', '辛甲': '正财', '辛丁': '七杀', '辛丙': '正官', '辛己': '偏印', '辛戊': '正印',
  '壬壬': '比肩', '壬癸': '劫财', '壬甲': '食神', '壬乙': '伤官', '壬丙': '偏财', '壬丁': '正财', '壬戊': '七杀', '壬己': '正官', '壬庚': '偏印', '壬辛': '正印',
  '癸癸': '比肩', '癸壬': '劫财', '癸乙': '食神', '癸甲': '伤官', '癸丁': '偏财', '癸丙': '正财', '癸己': '七杀', '癸戊': '正官', '癸辛': '偏印', '癸庚': '正印',
};

/**
 * 以日干为参照，计算目标天干的十神
 */
export function getTenGod(dayMaster: HeavenlyStem, targetStem: HeavenlyStem): TenGod {
  return TEN_GOD_MAP[`${dayMaster}${targetStem}`] || '比肩';
}

/**
 * 获取某地支的藏干及十神明细
 */
export function getBranchHiddenStems(
  dayMaster: HeavenlyStem,
  branch: EarthlyBranch,
): HiddenStemDetail[] {
  const stems = BRANCH_HIDDEN_STEMS[branch] || [];
  return stems.map((stem, idx) => {
    const roleMeta = HIDDEN_ROLE_ORDER[idx] || HIDDEN_ROLE_ORDER[2];
    return {
      stem,
      role: roleMeta.role,
      roleLabel: roleMeta.label,
      element: STEM_ELEMENT[stem],
      tenGod: getTenGod(dayMaster, stem),
    };
  });
}

/**
 * 十二长生阶段序列
 * 来源：《三命通会》 & lunar-javascript LunarUtil.CHANG_SHENG
 */
export const DI_SHI_STAGES: readonly DiShiStage[] = [
  '长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养',
] as const;

/**
 * 十天干「长生」起始地支索引（0=子, 1=丑, ..., 11=亥）
 * 阳干顺行：甲长生在亥(11)，丙戊长生在寅(2)，庚长生在巳(5)，壬长生在申(8)
 * 阴干逆行：乙长生在午(6)，丁己长生在酉(9)，辛长生在子(0)，癸长生在卯(3)
 * 与 lunar-javascript EightChar._getDiShi (CHANG_SHENG_OFFSET) 完全一致。
 */
export const CHANG_SHENG_START_BRANCH_INDEX: Readonly<Record<HeavenlyStem, number>> = {
  '甲': 11, // 亥
  '丙': 2,  // 寅
  '戊': 2,  // 寅
  '庚': 5,  // 巳
  '壬': 8,  // 申
  '乙': 6,  // 午
  '丁': 9,  // 酉
  '己': 9,  // 酉
  '辛': 0,  // 子
  '癸': 3,  // 卯
};

/**
 * 计算日干在指定地支上的十二长生星运
 */
export function getDiShi(dayMaster: HeavenlyStem, branch: EarthlyBranch): DiShiStage {
  const stemIdx = HEAVENLY_STEMS.indexOf(dayMaster);
  const branchIdx = EARTHLY_BRANCHES.indexOf(branch);
  if (stemIdx < 0 || branchIdx < 0) return '长生';
  const startBranchIdx = CHANG_SHENG_START_BRANCH_INDEX[dayMaster];
  const isYang = stemIdx % 2 === 0;
  const offset = isYang
    ? (branchIdx - startBranchIdx + 12) % 12
    : (startBranchIdx - branchIdx + 12) % 12;
  return DI_SHI_STAGES[offset];
}

// ─── 五大神煞查表（《三命通会》《渊海子平》权威口诀）──────────────────────────

/**
 * 1. 天乙贵人
 * - 口诀原文：「甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢马虎，此是贵人方。」
 * - 典籍出处：《三命通会·卷三·论天乙贵人》、《渊海子平·卷一·论天乙贵人》
 * - 流派说明：古法存在两派——
 *   (1) 《三命通会》《渊海子平》通行派：「甲戊庚牛羊……六辛逢马虎」（甲、戊、庚同取丑未，辛取午寅）；
 *   (2) 《考原》/部分派别：「甲戊兼牛羊……庚辛逢马虎」（庚改取午寅）。
 *   本表采用第 (1) 派（《三命通会》《渊海子平》主流通行派），并以日干、年干同参查四柱地支。
 */
export const TIAN_YI_GUI_REN_TABLE: Readonly<Record<HeavenlyStem, readonly EarthlyBranch[]>> = {
  '甲': ['丑', '未'],
  '戊': ['丑', '未'],
  '庚': ['丑', '未'],
  '乙': ['子', '申'],
  '己': ['子', '申'],
  '丙': ['亥', '酉'],
  '丁': ['亥', '酉'],
  '壬': ['卯', '巳'],
  '癸': ['卯', '巳'],
  '辛': ['午', '寅'],
};

/**
 * 2. 文昌贵人
 * - 口诀原文：「甲乙巳午报君知，丙戊申宫丁己鸡，庚猪辛鼠壬逢虎，癸人见卯入云梯。」
 * - 典籍出处：《三命通会·卷三·论文昌》、《渊海子平》
 * - 流派说明：按十干食神临官之位起文昌（丙、戊同寄申宫，丁、己同寄酉宫），各派无分歧；以日干、年干同参查四柱地支。
 */
export const WEN_CHANG_TABLE: Readonly<Record<HeavenlyStem, EarthlyBranch>> = {
  '甲': '巳',
  '乙': '午',
  '丙': '申',
  '丁': '酉',
  '戊': '申',
  '己': '酉',
  '庚': '亥',
  '辛': '子',
  '壬': '寅',
  '癸': '卯',
};

/**
 * 3. 驿马
 * - 口诀原文：「申子辰马在寅，寅午戌马在申，巳酉丑马在亥，亥卯未马在巳。」
 * - 典籍出处：《三命通会·卷三·论驿马》、《渊海子平·论驿马》
 * - 流派说明：以三合局孟位之对冲地支为驿马；取法有「专以年支查」与「年支、日支并查」两派，本实现采用主流「年支、日支并查」派。
 */
export const YI_MA_TABLE: Readonly<Record<EarthlyBranch, EarthlyBranch>> = {
  '申': '寅', '子': '寅', '辰': '寅',
  '寅': '申', '午': '申', '戌': '申',
  '巳': '亥', '酉': '亥', '丑': '亥',
  '亥': '巳', '卯': '巳', '未': '巳',
};

/**
 * 4. 桃花（咸池）
 * - 口诀原文：「申子辰在酉，寅午戌在卯，巳酉丑在午，亥卯未在子。」
 * - 典籍出处：《三命通会·卷三·论咸池》、《渊海子平·论咸池》
 * - 流派说明：以三合局五行沐浴败地为咸池桃花；取法有「专以年支查」与「年支、日支并查」两派，本实现采用主流「年支、日支并查」派。
 */
export const TAO_HUA_TABLE: Readonly<Record<EarthlyBranch, EarthlyBranch>> = {
  '申': '酉', '子': '酉', '辰': '酉',
  '寅': '卯', '午': '卯', '戌': '卯',
  '巳': '午', '酉': '午', '丑': '午',
  '亥': '子', '卯': '子', '未': '子',
};

/**
 * 5. 羊刃
 * - 口诀原文：「甲羊刃在卯，乙羊刃在辰，丙戊羊刃在午，丁己羊刃在未，庚羊刃在酉，辛羊刃在戌，壬羊刃在子，癸羊刃在丑。」
 * - 典籍出处：《三命通会·卷三·论羊刃》、《渊海子平·论羊刃》
 * - 流派说明：羊刃（专以日干查四柱地支）在古籍中有三派——
 *   (1) 《三命通会》《渊海子平》十干顺查派：阴阳十干皆有刃，均取「禄前一位」（甲卯、乙辰、丙戊午、丁己未、庚酉、辛戌、壬子、癸丑）；
 *   (2) 阴干逆查帝旺派：阳干顺取禄前一位（卯午酉子），阴干逆取冠带/临官前一位（乙寅、丁己巳、辛申、癸亥）；
 *   (3) 五阳干专刃派（《子平真诠》）：唯甲丙戊庚壬五阳干有羊刃，五阴干不取羊刃。
 *   本表采用第 (1) 派（《三命通会》《渊海子平》十干禄前一位通行派）。
 */
export const YANG_REN_TABLE: Readonly<Record<HeavenlyStem, EarthlyBranch>> = {
  '甲': '卯',
  '乙': '辰',
  '丙': '午',
  '丁': '未',
  '戊': '午',
  '己': '未',
  '庚': '酉',
  '辛': '戌',
  '壬': '子',
  '癸': '丑',
};

function uniqueBranches(list: EarthlyBranch[]): EarthlyBranch[] {
  return Array.from(new Set(list));
}

/**
 * 根据四柱干支计算五大神煞（天乙贵人、文昌、驿马、桃花、羊刃）的目标地支与命中柱位
 */
export function evaluateShenSha(pillars: {
  year: { stem: HeavenlyStem; branch: EarthlyBranch };
  month: { stem: HeavenlyStem; branch: EarthlyBranch };
  day: { stem: HeavenlyStem; branch: EarthlyBranch };
  hour: { stem: HeavenlyStem; branch: EarthlyBranch };
}) {
  const pillarEntries: [PillarKey, { stem: HeavenlyStem; branch: EarthlyBranch }][] = [
    ['year', pillars.year],
    ['month', pillars.month],
    ['day', pillars.day],
    ['hour', pillars.hour],
  ];

  // 天乙贵人：以日干或年干起贵人，查四柱地支
  const tianYiBranches = uniqueBranches([
    ...TIAN_YI_GUI_REN_TABLE[pillars.day.stem],
    ...TIAN_YI_GUI_REN_TABLE[pillars.year.stem],
  ]);

  // 文昌贵人：以日干或年干起文昌，查四柱地支
  const wenChangBranches = uniqueBranches([
    WEN_CHANG_TABLE[pillars.day.stem],
    WEN_CHANG_TABLE[pillars.year.stem],
  ]);

  // 驿马：以年支查月日时支 + 以日支查年月时支（汇总目标地支为年支驿马与日支驿马）
  const yiMaBranches = uniqueBranches([
    YI_MA_TABLE[pillars.year.branch],
    YI_MA_TABLE[pillars.day.branch],
  ]);

  // 桃花：以年支或日支起桃花，查四柱地支
  const taoHuaBranches = uniqueBranches([
    TAO_HUA_TABLE[pillars.year.branch],
    TAO_HUA_TABLE[pillars.day.branch],
  ]);

  // 羊刃：专以日干查四柱地支
  const yangRenBranches = uniqueBranches([YANG_REN_TABLE[pillars.day.stem]]);

  const findHits = (targets: EarthlyBranch[]): PillarKey[] =>
    pillarEntries
      .filter(([, p]) => targets.includes(p.branch))
      .map(([k]) => k);

  const tianYiHits = findHits(tianYiBranches);
  const wenChangHits = findHits(wenChangBranches);
  const yiMaHits = findHits(yiMaBranches);
  const taoHuaHits = findHits(taoHuaBranches);
  const yangRenHits = findHits(yangRenBranches);

  const byPillar: Record<PillarKey, ShenShaName[]> = {
    year: [],
    month: [],
    day: [],
    hour: [],
  };

  const recordHits = (name: ShenShaName, hits: PillarKey[]) => {
    for (const k of hits) {
      if (!byPillar[k].includes(name)) {
        byPillar[k].push(name);
      }
    }
  };

  recordHits('天乙贵人', tianYiHits);
  recordHits('文昌', wenChangHits);
  recordHits('驿马', yiMaHits);
  recordHits('桃花', taoHuaHits);
  recordHits('羊刃', yangRenHits);

  return {
    tianYiGuiRen: {
      name: '天乙贵人' as const,
      targetBranches: tianYiBranches,
      hitPillars: tianYiHits,
    },
    wenChang: {
      name: '文昌' as const,
      targetBranches: wenChangBranches,
      hitPillars: wenChangHits,
    },
    yiMa: {
      name: '驿马' as const,
      targetBranches: yiMaBranches,
      hitPillars: yiMaHits,
    },
    taoHua: {
      name: '桃花' as const,
      targetBranches: taoHuaBranches,
      hitPillars: taoHuaHits,
    },
    yangRen: {
      name: '羊刃' as const,
      targetBranches: yangRenBranches,
      hitPillars: yangRenHits,
    },
    byPillar,
  };
}

/**
 * 由公历年份推算流年干支（公元 4 年为甲子年）
 */
export function getYearGanZhi(year: number): {
  ganZhi: string;
  stem: HeavenlyStem;
  branch: EarthlyBranch;
} {
  const idx = (((year - 4) % 60) + 60) % 60;
  const ganZhi = SIXTY_JIAZI[idx];
  return {
    ganZhi,
    stem: ganZhi[0] as HeavenlyStem,
    branch: ganZhi[1] as EarthlyBranch,
  };
}
