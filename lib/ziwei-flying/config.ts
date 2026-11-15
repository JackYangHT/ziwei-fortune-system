/**
 * 紫微三飞四化与磁场化全局权重与规则配置 (config.ts)
 *
 * 约束：matrix.ts 仅输出 raw counts，所有权重参数、六内/六外宫定义及双轨制系数统一集中于本文件。
 */

import type { SiHua } from '../ziwei/types';
import type { Pattern } from '../ziwei/patterns';
import type { FlyingLayer } from './types';

/**
 * 六内宫（我宫/体：命宫、财帛、官禄、田宅、疾厄、福德）
 * 六外宫（他宫/用：兄弟、夫妻、子女、迁移、交友/仆役、父母）
 */
export const INNER_PALACE_NAMES: ReadonlySet<string> = new Set([
  '命宫',
  '命宮',
  '财帛',
  '财帛宫',
  '財帛',
  '官禄',
  '官禄宫',
  '官祿',
  '事业',
  '田宅',
  '田宅宫',
  '疾厄',
  '疾厄宫',
  '福德',
  '福德宫',
]);

/**
 * 判断宫名属于六内宫 ('inner') 还是六外宫 ('outer')
 */
export function getPalaceDomainType(palaceName: string): 'inner' | 'outer' {
  return INNER_PALACE_NAMES.has(palaceName) ? 'inner' : 'outer';
}

/**
 * 三层飞化层级权重（本命宫干 / 大限宫干 / 流年宫干）
 */
export const FLYING_LAYER_WEIGHTS: Readonly<Record<FlyingLayer, number>> = {
  natal: 1.0,
  decadal: 1.35,
  yearly: 1.6,
};

/**
 * 四化基础能量权重（化禄、化权、化科为正向聚能，化忌为收敛/冲击负向载荷）
 */
export const SIHUA_BASE_WEIGHTS: Readonly<Record<SiHua, number>> = {
  '禄': 3.0,
  '权': 2.2,
  '科': 1.5,
  '忌': -3.5,
};

/**
 * 生年四化坐落宫位的先天「体」基底加权
 */
export const NATAL_LANDING_WEIGHTS: Readonly<Record<SiHua, number>> = {
  '禄': 4.0,
  '权': 3.0,
  '科': 2.0,
  '忌': -4.5,
};

/**
 * 离心自化（本宫宫干化本宫星）与向心自化（对宫宫干化入本宫）修正权重
 */
export const SELF_SIHUA_WEIGHTS: Readonly<{
  centrifugal: Record<SiHua, number>;
  centripetal: Record<SiHua, number>;
}> = {
  // 离心自化：本宫力量外泄/消散（自化忌尤为耗散）
  centrifugal: {
    '禄': -1.0,
    '权': -0.8,
    '科': -0.5,
    '忌': -2.5,
  },
  // 向心自化：对宫力量直注本宫（向心禄权科增势，向心忌直冲）
  centripetal: {
    '禄': 1.8,
    '权': 1.4,
    '科': 1.0,
    '忌': -2.8,
  },
};

/**
 * 双轨制权重配比：飞星矩阵优先（主轨 0.7），三合格局做底盘背景（辅轨 0.3）
 */
export const DUAL_TRACK_CONFIG = {
  flyingMatrixPriority: 0.7,
  sanheBackground: 0.3,
} as const;

/**
 * 三合格局等级对应的底盘背景分值
 */
export const SANHE_PATTERN_LEVEL_SCORES: Readonly<Record<Pattern['level'], number>> = {
  excellent: 12,
  good: 7,
  neutral: 2,
  caution: -8,
};
