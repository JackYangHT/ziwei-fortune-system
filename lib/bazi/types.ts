/**
 * 八字完整盘（四柱藏干、十神、十二长生、神煞、大运、流年）类型定义
 */

import type { ZiweiChart } from '../ziwei/types';
import type { FiveElement, NayinInfo } from './classical-tables';

export type HeavenlyStem =
  | '甲'
  | '乙'
  | '丙'
  | '丁'
  | '戊'
  | '己'
  | '庚'
  | '辛'
  | '壬'
  | '癸';

export type EarthlyBranch =
  | '子'
  | '丑'
  | '寅'
  | '卯'
  | '辰'
  | '巳'
  | '午'
  | '未'
  | '申'
  | '酉'
  | '戌'
  | '亥';

export type TenGod =
  | '比肩'
  | '劫财'
  | '食神'
  | '伤官'
  | '偏财'
  | '正财'
  | '七杀'
  | '正官'
  | '偏印'
  | '正印';

export type StemTenGodOrDayMaster = TenGod | '日主';

export type DiShiStage =
  | '长生'
  | '沐浴'
  | '冠带'
  | '临官'
  | '帝旺'
  | '衰'
  | '病'
  | '死'
  | '墓'
  | '绝'
  | '胎'
  | '养';

export type HiddenStemRole = 'primary' | 'middle' | 'residual'; // 本气 / 中气 / 余气

export interface HiddenStemDetail {
  stem: HeavenlyStem;
  role: HiddenStemRole;
  roleLabel: '本气' | '中气' | '余气';
  element: FiveElement;
  tenGod: TenGod;
}

export type PillarKey = 'year' | 'month' | 'day' | 'hour';

export type ShenShaName = '天乙贵人' | '文昌' | '驿马' | '桃花' | '羊刃';

export interface BaziPillar {
  key: PillarKey;
  label: '年柱' | '月柱' | '日柱' | '时柱';
  ganZhi: string;
  stem: HeavenlyStem;
  branch: EarthlyBranch;
  stemElement: FiveElement;
  branchElement: FiveElement;
  /** 天干十神（日柱为 '日主'，其余三柱以日干为参照） */
  stemTenGod: StemTenGodOrDayMaster;
  /** 地支藏干明细（本气 / 中气 / 余气 + 各自十神） */
  hiddenStems: HiddenStemDetail[];
  /** 地支藏干（纯天干字符列表，顺序：本气、中气、余气） */
  hideGan: HeavenlyStem[];
  /** 地支藏干十神列表（与 hideGan 一一对应） */
  hideGanTenGods: TenGod[];
  /** 十二长生（日干在此柱地支的星运） */
  diShi: DiShiStage;
  /** 纳音五行 */
  nayin: NayinInfo | null;
  /** 该柱地支命中的神煞列表 */
  shenSha: ShenShaName[];
}

export interface ShenShaHitItem {
  name: ShenShaName;
  /** 查法得出的目标地支列表 */
  targetBranches: EarthlyBranch[];
  /** 在本命四柱中实际命中的柱位 */
  hitPillars: PillarKey[];
}

export interface BaziShenShaSummary {
  tianYiGuiRen: ShenShaHitItem;
  wenChang: ShenShaHitItem;
  yiMa: ShenShaHitItem;
  taoHua: ShenShaHitItem;
  yangRen: ShenShaHitItem;
  /** 按柱汇总的神煞表 */
  byPillar: Record<PillarKey, ShenShaName[]>;
}

export interface BaziDaYunStep {
  /** 第几步大运 (1..10) */
  index: number;
  ganZhi: string;
  stem: HeavenlyStem;
  branch: EarthlyBranch;
  stemTenGod: TenGod;
  hiddenStems: HiddenStemDetail[];
  diShi: DiShiStage;
  nayin: NayinInfo | null;
  /** 起运虚岁 */
  startAge: number;
  /** 结束虚岁 */
  endAge: number;
  /** 起始公历年 */
  startYear: number;
  /** 结束公历年 */
  endYear: number;
}

export interface BaziDaYunInfo {
  /** 是否顺排（阳男阴女为 true，阴男阳女为 false） */
  isForward: boolean;
  /** 阴阳性别标签（阳男 / 阴男 / 阳女 / 阴女） */
  yinYangGender: '阳男' | '阴男' | '阳女' | '阴女';
  /** 起运虚岁 */
  startAge: number;
  /** 起运公历年份 */
  startYear: number;
  /** 交运折算明细（出生距节气折合几岁几月几天） */
  startDetail: {
    years: number;
    months: number;
    days: number;
  };
  /** 十步大运 */
  steps: BaziDaYunStep[];
}

export interface BaziLiuNianItem {
  /** 公历年份 */
  year: number;
  /** 虚岁年龄 */
  age: number;
  ganZhi: string;
  stem: HeavenlyStem;
  branch: EarthlyBranch;
  stemTenGod: TenGod;
  hiddenStems: HiddenStemDetail[];
  diShi: DiShiStage;
  nayin: NayinInfo | null;
  /** 是否为基准流年 */
  isReferenceYear: boolean;
}

export interface BaziInput {
  chart: ZiweiChart; // 四柱从这里取
  gender: 'M' | 'F';
  referenceYear?: number; // 流年基准，默认当前年
}

export interface BaziChart {
  /** 四柱原始干支元组 [年柱, 月柱, 日柱, 时柱]，直接取自 ZiweiChart.lunarInfo */
  rawFourPillars: [string, string, string, string];
  /** 日主（日干） */
  dayMaster: HeavenlyStem;
  /** 日主五行 */
  dayMasterElement: FiveElement;
  /** 四柱详情 */
  pillars: {
    year: BaziPillar;
    month: BaziPillar;
    day: BaziPillar;
    hour: BaziPillar;
  };
  /** 神煞汇总（天乙贵人、文昌、驿马、桃花、羊刃） */
  shenSha: BaziShenShaSummary;
  /** 大运（起运岁数 + 十步大运） */
  daYun: BaziDaYunInfo;
  /** 流年（基准年前后各 5 年，共 11 年） */
  liuNian: BaziLiuNianItem[];
  /** 流年基准年份 */
  referenceYear: number;
}
