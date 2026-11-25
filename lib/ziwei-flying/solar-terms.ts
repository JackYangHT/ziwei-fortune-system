/**
 * 二十四節氣（Solar Terms）與中醫「五運六氣」調候算法模組 (solar-terms.ts)
 *
 * 理念來源：倪海廈老師「天（八字／紫微）、地（節氣風水）、人（選擇）」三才思想，
 * 結合《黃帝內經・素問》五運六氣與四季五行調候，提供當下天地地氣能量場與養生調候依據。
 */

import { Solar } from 'lunar-javascript';

export interface SolarTermInfo {
  currentTerm: string;      // 當前所處的節氣（繁體中文，如：立秋）
  termStartDate: string;    // 該節氣開始的日期（YYYY-MM-DD）
  nextTerm: string;         // 下一個節氣（繁體中文）
  element: string;          // 當前節氣對應的五行（木、火、土、金、水）
  description: string;      // 節氣能量場簡述（如：金氣漸旺，萬物收斂）
  /** 下一節氣日期（YYYY-MM-DD） */
  nextTermDate?: string;
  /** 所屬季節（春、夏、長夏、秋、冬） */
  season?: string;
  /** 當年五運（歲運太過／不及） */
  wuYun?: string;
  /** 當年六氣司天 */
  liuQiSiTian?: string;
  /** 當年六氣在泉 */
  liuQiZaiQuan?: string;
  /** 當前六氣步位（初之氣～終之氣，含主氣與客氣） */
  liuQiStep?: string;
  /** 中醫調候與作息養生重點 */
  tiaoHouAdvice?: string;
}

interface TermMetadata {
  tradName: string;
  element: '木' | '火' | '土' | '金' | '水';
  season: string;
  description: string;
  liuQiStepIndex: number; // 0=初之氣 .. 5=終之氣
  tiaoHouAdvice: string;
}

/** 簡體節氣名 → 繁體與中醫五行調候對照表（24 節氣完整覆蓋） */
const SOLAR_TERM_META: Record<string, TermMetadata> = {
  立春: {
    tradName: '立春',
    element: '木',
    season: '春',
    description: '東風解凍，陽氣初生，木氣漸旺、萬物萌發',
    liuQiStepIndex: 0,
    tiaoHouAdvice: '宜疏肝升陽、早起伸展、少怒少鬱，飲食清淡微辛以助陽氣生發。',
  },
  雨水: {
    tradName: '雨水',
    element: '木',
    season: '春',
    description: '春雨潤物，木氣漸舒而濕氣漸增',
    liuQiStepIndex: 0,
    tiaoHouAdvice: '宜養脾護肝、防春寒與濕困，少食生冷黏膩，保持下肢溫暖。',
  },
  惊蛰: {
    tradName: '驚蟄',
    element: '木',
    season: '春',
    description: '春雷始動，肝木升發加速，生機湧動',
    liuQiStepIndex: 0,
    tiaoHouAdvice: '宜順暢情志、避免熬夜動肝火，多走動舒展筋骨以宣洩鬱氣。',
  },
  春分: {
    tradName: '春分',
    element: '木',
    season: '春',
    description: '陰陽相半，晝夜均平，木氣中和舒暢',
    liuQiStepIndex: 1,
    tiaoHouAdvice: '宜調和平陰陽、作息規律，忌大喜大悲或過勞耗散肝血。',
  },
  清明: {
    tradName: '清明',
    element: '木',
    season: '春',
    description: '氣清景明，木氣旺盛，陽升陰退',
    liuQiStepIndex: 1,
    tiaoHouAdvice: '宜踏青吐故納新、柔肝養血，留意過敏、頭痛與血壓波動。',
  },
  谷雨: {
    tradName: '穀雨',
    element: '土',
    season: '春末（土旺）',
    description: '春末土氣用事，雨生百穀，濕熱初萌',
    liuQiStepIndex: 1,
    tiaoHouAdvice: '春末脾土當令，宜健脾祛濕、防春困與關節痠沉，飲食忌過甜油膩。',
  },
  立夏: {
    tradName: '立夏',
    element: '火',
    season: '夏',
    description: '萬物繁茂，火氣初旺，心陽漸盛',
    liuQiStepIndex: 1,
    tiaoHouAdvice: '宜養心安神、適當午憩，避免急躁上火與深夜過度耗神。',
  },
  小满: {
    tradName: '小滿',
    element: '火',
    season: '夏',
    description: '陽氣漸滿，火勢上升，暑濕漸起',
    liuQiStepIndex: 2,
    tiaoHouAdvice: '宜清心健脾、防濕熱鬱積，少熬夜與冰飲，保持情緒清涼不躁。',
  },
  芒种: {
    tradName: '芒種',
    element: '火',
    season: '夏',
    description: '仲夏火旺，濕熱交蒸，氣機外浮',
    liuQiStepIndex: 2,
    tiaoHouAdvice: '宜晚睡早起順應陽長、補水不貪冰冷，適度微汗以散暑濕。',
  },
  夏至: {
    tradName: '夏至',
    element: '火',
    season: '夏',
    description: '陽氣極盛而一陰初生，外熱內虛',
    liuQiStepIndex: 2,
    tiaoHouAdvice: '陽極生陰，外熱而脾胃偏寒，忌過食生冷瓜果，宜靜心降火、溫護中焦。',
  },
  小暑: {
    tradName: '小暑',
    element: '火',
    season: '夏',
    description: '暑氣漸烈，火盛灼津，心氣易耗',
    liuQiStepIndex: 2,
    tiaoHouAdvice: '宜清暑益氣、穩住心神防心煩失眠，多補溫水與淡湯以護津液。',
  },
  大暑: {
    tradName: '大暑',
    element: '土',
    season: '長夏（土旺）',
    description: '長夏土旺，濕熱交迫，一年暑濕最盛',
    liuQiStepIndex: 3,
    tiaoHouAdvice: '長夏歸脾土，宜健脾化濕、清熱防中暑，切忌冷氣直吹與過飲冰水傷陽。',
  },
  立秋: {
    tradName: '立秋',
    element: '金',
    season: '秋',
    description: '金氣漸旺，萬物由盛轉收，暑退涼生',
    liuQiStepIndex: 3,
    tiaoHouAdvice: '宜收斂心神、潤肺養陰，逐漸早睡早起，減少外耗與情緒拉扯。',
  },
  处暑: {
    tradName: '處暑',
    element: '金',
    season: '秋',
    description: '出暑入涼，金氣漸清，秋燥初起',
    liuQiStepIndex: 3,
    tiaoHouAdvice: '宜滋陰潤燥、護肺養胃，留意早晚溫差與秋乏嗜睡。',
  },
  白露: {
    tradName: '白露',
    element: '金',
    season: '秋',
    description: '陰氣漸重，露凝而白，燥金之氣漸顯',
    liuQiStepIndex: 3,
    tiaoHouAdvice: '宜溫潤養肺、早晚添衣護腰腹與雙足，少食寒涼辛燥之物。',
  },
  秋分: {
    tradName: '秋分',
    element: '金',
    season: '秋',
    description: '陰陽平分，金氣肅降，天高氣爽',
    liuQiStepIndex: 4,
    tiaoHouAdvice: '宜收攝心志、潤燥安神，多做深呼吸吐納以養肺氣、防悲秋低落。',
  },
  寒露: {
    tradName: '寒露',
    element: '金',
    season: '秋',
    description: '露氣寒冷，涼燥轉深，萬物歸藏',
    liuQiStepIndex: 4,
    tiaoHouAdvice: '宜溫潤防寒燥、睡前溫水泡腳引火歸元，保護呼吸道與關節。',
  },
  霜降: {
    tradName: '霜降',
    element: '土',
    season: '秋末（土旺）',
    description: '秋末土氣用事，氣肅露結，由秋入冬的過渡關口',
    liuQiStepIndex: 4,
    tiaoHouAdvice: '秋末脾胃易受寒，宜溫脾養胃、進補先平補不燥膩，早睡蓄養陰精。',
  },
  立冬: {
    tradName: '立冬',
    element: '水',
    season: '冬',
    description: '水氣漸旺，萬物收藏，陽氣潛伏於內',
    liuQiStepIndex: 4,
    tiaoHouAdvice: '宜早臥晚起、養腎藏精、減少無謂奔波與透支，飲食溫熱滋養。',
  },
  小雪: {
    tradName: '小雪',
    element: '水',
    season: '冬',
    description: '寒水漸深，天寒地閉，陽氣內斂',
    liuQiStepIndex: 5,
    tiaoHouAdvice: '宜溫陽散寒、多曬背補陽氣，保持心情舒展以防冬季抑鬱內耗。',
  },
  大雪: {
    tradName: '大雪',
    element: '水',
    season: '冬',
    description: '陰盛寒重，水氣充盈，萬物靜謐蟄伏',
    liuQiStepIndex: 5,
    tiaoHouAdvice: '宜避寒就溫、護頭頸與腰腎，宜靜養蓄積力量，忌大汗亡陽。',
  },
  冬至: {
    tradName: '冬至',
    element: '水',
    season: '冬',
    description: '陰極而一陽初生，氣機由藏轉萌的關鍵樞紐',
    liuQiStepIndex: 5,
    tiaoHouAdvice: '一陽來復極為珍貴，宜早睡養陽、溫補腎氣、靜心省思，忌熬夜耗損初生之陽。',
  },
  小寒: {
    tradName: '小寒',
    element: '水',
    season: '冬',
    description: '寒氣凜冽，水旺寒深，陽氣深藏待發',
    liuQiStepIndex: 5,
    tiaoHouAdvice: '宜溫中散寒、顧護心腎與末梢循環，以溫熱食物暖胃生陽。',
  },
  大寒: {
    tradName: '大寒',
    element: '土',
    season: '冬末（土旺）',
    description: '冬末土旺承轉，寒極將盡、春氣暗動',
    liuQiStepIndex: 0,
    tiaoHouAdvice: '歲末轉春之際宜健脾固本、整理身心減法斷捨離，為來年生發蓄能。',
  },
};

/** 繁體名稱兜底（避免未來版本返回繁體 key 時查不到） */
const TRAD_TO_SIMP_MAP: Record<string, string> = {
  驚蟄: '惊蛰',
  穀雨: '谷雨',
  小滿: '小满',
  芒種: '芒种',
  處暑: '处暑',
};

/** 五運（歲運）：依年干定中運太過與不及 */
const WUYUN_BY_STEM: Record<string, string> = {
  甲: '甲年土運太過（雨濕流行，脾土偏旺而腎水易受制）',
  己: '己年土運不及（風木易乘，脾胃消化與思慮需溫護）',
  乙: '乙年金運不及（火氣易炎，肺系與咽喉燥熱宜潤養）',
  庚: '庚年金運太過（燥氣流行，肝木受制、筋骨與情緒宜舒展）',
  丙: '丙年水運太過（寒氣流行，心陽易受壓、宜溫陽護心脾）',
  辛: '辛年水運不及（濕土易乘，腎氣與下焦宜溫補固本）',
  丁: '丁年木運不及（燥金易乘，肝氣易鬱滯、宜柔肝安神）',
  壬: '壬年木運太過（風氣流行，脾胃易受克、宜靜心少急躁）',
  戊: '戊年火運太過（暑熱流行，肺金受制、宜清心降火潤燥）',
  癸: '癸年火運不及（寒水易勝，心陽偏弱、宜溫養陽氣少生冷）',
};

/** 六氣循環次序（三陰三陽） */
const SIX_QI_CYCLE = [
  '厥陰風木',
  '少陰君火',
  '少陽相火',
  '太陰濕土',
  '陽明燥金',
  '太陽寒水',
] as const;

/** 六氣司天索引（對應 SIX_QI_CYCLE） */
const SITIAN_INDEX_BY_BRANCH: Record<string, number> = {
  子: 1, 午: 1, // 少陰君火司天，陽明燥金在泉
  丑: 3, 未: 3, // 太陰濕土司天，太陽寒水在泉
  寅: 2, 申: 2, // 少陽相火司天，厥陰風木在泉
  卯: 4, 酉: 4, // 陽明燥金司天，少陰君火在泉
  辰: 5, 戌: 5, // 太陽寒水司天，太陰濕土在泉
  巳: 0, 亥: 0, // 厥陰風木司天，少陽相火在泉
};

const LIUQI_STEP_NAMES = ['初之氣', '二之氣', '三之氣', '四之氣', '五之氣', '終之氣'] as const;

function lookupMeta(rawName: string): TermMetadata {
  const normalized = TRAD_TO_SIMP_MAP[rawName] ?? rawName;
  return (
    SOLAR_TERM_META[normalized] ?? {
      tradName: rawName || '立春',
      element: '土',
      season: '四季',
      description: '節氣交替，陰陽流轉，宜順時調養',
      liuQiStepIndex: 0,
      tiaoHouAdvice: '宜順應自然節律，規律作息、穩住心神。',
    }
  );
}

function toTradTermName(rawName: string): string {
  return lookupMeta(rawName).tradName;
}

interface RuntimeSolar {
  getLunar(): RuntimeLunar;
  toYmd(): string;
  next(days: number): RuntimeSolar;
}

interface RuntimeJieQi {
  getName(): string;
  getSolar(): RuntimeSolar;
}

interface RuntimeLunar {
  getPrevJieQi(wholeDay?: boolean): RuntimeJieQi | null;
  getNextJieQi(wholeDay?: boolean): RuntimeJieQi | null;
  getJieQiTable(): Record<string, RuntimeSolar>;
  getYearGanByLiChun(): string;
  getYearZhiByLiChun(): string;
}

interface RuntimeSolarStatic {
  fromYmd(year: number, month: number, day: number): RuntimeSolar;
  fromYmdHms(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
  ): RuntimeSolar;
}

const SolarApi = Solar as unknown as RuntimeSolarStatic;

/**
 * 計算指定日期的二十四節氣與中醫五運六氣調候資訊
 */
export function getSolarTermInfo(date: Date = new Date()): SolarTermInfo {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const solar = SolarApi.fromYmdHms(
    safeDate.getFullYear(),
    safeDate.getMonth() + 1,
    safeDate.getDate(),
    safeDate.getHours(),
    safeDate.getMinutes(),
    safeDate.getSeconds(),
  );
  const lunar = solar.getLunar();

  // 取當前已進入的最近一個節氣，以及下一個尚未到達的節氣
  // getPrevJieQi(true) 按日計（若當天交節即視為當下節氣），getNextJieQi(false) 確保必為下一個節氣
  const prevJieQi = lunar.getPrevJieQi(true);
  let nextJieQi = lunar.getNextJieQi(false);

  // 若剛好在節氣交接日且 prev 與 next 同名，再往後推進一日取下一個節氣
  if (prevJieQi && nextJieQi && prevJieQi.getName() === nextJieQi.getName()) {
    const tomorrow = SolarApi.fromYmd(
      safeDate.getFullYear(),
      safeDate.getMonth() + 1,
      safeDate.getDate(),
    ).next(1);
    nextJieQi = tomorrow.getLunar().getNextJieQi(false);
  }

  const rawCurName = prevJieQi?.getName() ?? '立春';
  const rawNextName = nextJieQi?.getName() ?? '雨水';
  const termStartDate = prevJieQi?.getSolar()?.toYmd() ?? solar.toYmd();
  const nextTermDate = nextJieQi?.getSolar()?.toYmd();

  const meta = lookupMeta(rawCurName);
  const nextTerm = toTradTermName(rawNextName);

  // 五運六氣以立春／大寒交運之干支年為準（以節氣年干支 getYearGanByLiChun / getYearZhiByLiChun 推算）
  const yearStem = lunar.getYearGanByLiChun();
  const yearBranch = lunar.getYearZhiByLiChun();
  const wuYun = WUYUN_BY_STEM[yearStem] ?? `${yearStem}年歲運流轉`;

  const siTianIdx = SITIAN_INDEX_BY_BRANCH[yearBranch] ?? 0;
  const zaiQuanIdx = (siTianIdx + 3) % 6;
  const liuQiSiTian = `${SIX_QI_CYCLE[siTianIdx]}司天`;
  const liuQiZaiQuan = `${SIX_QI_CYCLE[zaiQuanIdx]}在泉`;

  // 六氣步位：主氣固定依 SIX_QI_CYCLE[0..5]，客氣以司天落三之氣(index=2)前後順推
  const stepIdx = meta.liuQiStepIndex;
  const hostQi = SIX_QI_CYCLE[stepIdx];
  const guestQi = SIX_QI_CYCLE[(siTianIdx + (stepIdx - 2) + 6) % 6];
  const liuQiStep = `${LIUQI_STEP_NAMES[stepIdx]}（主氣：${hostQi}／客氣：${guestQi}）`;

  return {
    currentTerm: meta.tradName,
    termStartDate,
    nextTerm,
    element: meta.element,
    description: meta.description,
    nextTermDate,
    season: meta.season,
    wuYun,
    liuQiSiTian,
    liuQiZaiQuan,
    liuQiStep,
    tiaoHouAdvice: meta.tiaoHouAdvice,
  };
}
