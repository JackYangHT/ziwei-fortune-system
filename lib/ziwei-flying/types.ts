/**
 * 紫微三飞四化与磁场化（体 / 用 / 方向 / 双轨权重）核心类型定义
 */

import type { ZiweiChart, SiHua } from '../ziwei/types';
import type { Pattern } from '../ziwei/patterns';

export type FlyingLayer = 'natal' | 'decadal' | 'yearly';

/**
 * 纯四化原始计数（matrix.ts 仅输出此原始计数，不含任何加权）
 */
export interface RawSiHuaCounts {
  lu: number;
  quan: number;
  ke: number;
  ji: number;
}

/**
 * 单条四化飞星有向边（fromPalace --[禄/权/科/忌: starName]--> toPalace）
 */
export interface FlyingEdge {
  layer: FlyingLayer;
  fromBranch: number;
  fromBranchName: string;
  fromPalace: string;
  stemIndex: number;
  stemName: string;
  siHua: SiHua;
  starName: string;
  toBranch: number;
  toBranchName: string;
  toPalace: string;
  /** 是否本宫离心自化（toBranch === fromBranch） */
  isSelf: boolean;
  /** 是否向心自化/对宫直入（toBranch === (fromBranch + 6) % 12） */
  isCentripetal: boolean;
}

/**
 * 单个宫位的原始飞化统计（不含权重）
 */
export interface RawPalaceMatrixStats {
  branch: number;
  branchName: string;
  palaceName: string;
  stemIndex: number;
  stemName: string;
  /** 三层飞入本宫的原始四化计数（含分层的 natal / decadal / yearly 及合计 total） */
  incoming: {
    natal: RawSiHuaCounts;
    decadal: RawSiHuaCounts;
    yearly: RawSiHuaCounts;
    total: RawSiHuaCounts;
  };
  /** 本宫宫干飞出的原始四化计数 */
  outgoing: RawSiHuaCounts;
  /** 本宫离心自化（化星落本宫）原始计数 */
  selfSihua: RawSiHuaCounts;
  /** 向心自化（对宫宫干化入本宫）原始计数 */
  centripetalSihua: RawSiHuaCounts;
}

/**
 * 三层飞化原始矩阵（matrix.ts 输出，纯 raw counts）
 */
export interface RawFlyingMatrix {
  /** 全部有向飞星边 */
  edges: FlyingEdge[];
  /** 12×12 宫对宫原始飞化计数矩阵：grid[fromBranch][toBranch] */
  grid: RawSiHuaCounts[][];
  /** 按地支 0..11 排列的 12 宫原始统计 */
  byPalace: RawPalaceMatrixStats[];
  /** 当前参与大限飞化的宫位信息 */
  activeDecadalPalace: {
    daXianIndex: number;
    branch: number;
    branchName: string;
    palaceName: string;
    stemIndex: number;
    stemName: string;
    ageRange: [number, number];
  } | null;
  /** 当前参与流年飞化的宫位信息 */
  activeYearlyPalace: {
    year: number;
    branch: number;
    branchName: string;
    palaceName: string;
    stemIndex: number;
    stemName: string;
  };
}

export interface PalaceRef {
  branch: number;
  branchName: string;
  palaceName: string;
}

/**
 * 来因宫使命群组（体）
 */
export interface LaiYinMissionGroup {
  branch: number;
  branchName: string;
  palaceName: string;
  stemIndex: number;
  stemName: string;
  /** 六内宫（自立/体）或六外宫（他立/用） */
  domainType: 'inner' | 'outer';
  /** 来因宫三合使命群组（本宫 + 三合两宫） */
  sanHePalaces: PalaceRef[];
  /** 来因宫对宫（体用投射端） */
  oppositePalace: PalaceRef;
}

/**
 * 生年四化单星落点（体）
 */
export interface NatalSiHuaLanding {
  siHua: SiHua;
  starName: string;
  branch: number;
  branchName: string;
  palaceName: string;
  domainType: 'inner' | 'outer';
  /** 所落宫位是否同时发生同星离心自化 */
  hasSelfSihua: boolean;
}

/**
 * 磁场之「体」：生年四化落点 + 来因宫使命群组
 */
export interface MagneticBody {
  birthYearStemIndex: number;
  birthYearStemName: string;
  natalSihua: Record<SiHua, NatalSiHuaLanding>;
  laiYin: LaiYinMissionGroup;
}

/**
 * 磁场之「用」：经 config.ts 权重加权后的单宫净权重场
 */
export interface WeightedPalaceField {
  branch: number;
  branchName: string;
  palaceName: string;
  domainType: 'inner' | 'outer';
  rawIncoming: RawSiHuaCounts;
  /** 按三层权重与四化基础权重折算后的各化分值 */
  weightedIncoming: {
    lu: number;
    quan: number;
    ke: number;
    ji: number;
    net: number;
  };
  /** 生年四化落入本宫的基底权重加成 */
  natalBaseScore: number;
  /** 本宫离心自化与对宫向心自化的修正分 */
  selfAndCentripetalDelta: number;
  /** 该宫最终净磁场权重 */
  totalNetWeight: number;
}

/**
 * 磁场之「方向」：禄随忌走的能量传导轨迹矢量
 */
export interface LuFollowsJiVector {
  id: string;
  level: 'natal' | 'laiYin' | 'mingGong' | 'decadal' | 'yearly' | 'palace';
  /** 起化源宫名称（生年四化时为来因宫） */
  sourcePalace: string;
  sourceBranch: number;
  sourceBranchName: string;
  stemName: string;
  /** 化禄星名与落宫（因/缘起） */
  luStar: string;
  luTargetPalace: string;
  luTargetBranch: number;
  luTargetBranchName: string;
  /** 化忌星名与落宫（果/归宿） */
  jiStar: string;
  jiTargetPalace: string;
  jiTargetBranch: number;
  jiTargetBranchName: string;
  /** 禄落宫与忌落宫的空间关系 */
  relation: 'same-palace' | 'opposite-palace' | 'sanhe-palace' | 'other-palace';
  /** 轨迹简述（如：来因[夫妻宫·己干] 武曲化禄入财帛 → 随文曲化忌归入福德） */
  trajectory: string;
}

/**
 * 飞星规则接口（patterns.ts 使用，FLYING_RULES 初始为空数组）
 */
export interface FlyingRule {
  id: string;
  name: string;
  level: 'auspicious' | 'inauspicious' | 'neutral';
  description: string;
  weightDelta: number;
  match: (ctx: {
    chart: ZiweiChart;
    body: MagneticBody;
    rawMatrix: RawFlyingMatrix;
    vectors: LuFollowsJiVector[];
  }) => { matched: boolean; palaces?: string[]; detail?: string };
}

export interface FlyingRuleHit {
  id: string;
  name: string;
  level: 'auspicious' | 'inauspicious' | 'neutral';
  palaces: string[];
  weightDelta: number;
  detail: string;
}

/**
 * 磁场之「权重」：双轨制（飞星矩阵优先，三合格局做背景）
 */
export interface DualTrackWeightSummary {
  mode: 'dual-track';
  /** 双轨权重配比（来自 config.ts） */
  trackWeights: {
    flyingMatrixPriority: number;
    sanheBackground: number;
  };
  /** 飞星矩阵净权重绝对值最高的核心共振宫位 Top 3 */
  topResonancePalaces: {
    palaceName: string;
    branchName: string;
    totalNetWeight: number;
  }[];
  /** 三合格局背景列表（底盘容量） */
  sanhePatterns: {
    name: string;
    level: Pattern['level'];
    palaces: string[];
    backgroundScore: number;
  }[];
  /** 三合格局底盘背景总分 */
  sanheBackgroundScore: number;
  /** 飞星矩阵主轨综合能量分 */
  flyingMatrixScore: number;
  /** 双轨合成总指数 */
  combinedIndex: number;
  /** 命中的飞星规则（patterns.ts FLYING_RULES） */
  flyingRuleHits: FlyingRuleHit[];
}

export interface MagneticFieldInput {
  chart: ZiweiChart;
  /** 指定大限索引（默认取 chart.currentDaXianIndex） */
  daXianIndex?: number;
  /** 指定流年公历年份（默认取当前年份） */
  referenceYear?: number;
}

/**
 * 磁场化完整输出结构：
 * 磁场化 = 体（body）+ 用（rawMatrix + weightedField）+ 方向（vectors）+ 权重（dualTrack）
 */
export interface MagneticField {
  body: MagneticBody;
  rawMatrix: RawFlyingMatrix;
  weightedField: WeightedPalaceField[];
  vectors: LuFollowsJiVector[];
  dualTrack: DualTrackWeightSummary;
}
