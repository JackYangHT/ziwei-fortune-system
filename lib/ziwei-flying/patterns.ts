/**
 * 飞星规则库与匹配执行器 (patterns.ts)
 *
 * 硬约束：FLYING_RULES 初始保持空数组，预留结构化规则扩展接口。
 */

import type { ZiweiChart } from '../ziwei/types';
import type {
  FlyingRule,
  FlyingRuleHit,
  LuFollowsJiVector,
  MagneticBody,
  RawFlyingMatrix,
} from './types';

/**
 * 飞星规则表（按要求初始为空数组）
 */
export const FLYING_RULES: readonly FlyingRule[] = [];

/**
 * 执行飞星规则判定
 */
export function evaluateFlyingRules(
  ctx: {
    chart: ZiweiChart;
    body: MagneticBody;
    rawMatrix: RawFlyingMatrix;
    vectors: LuFollowsJiVector[];
  },
  rules: readonly FlyingRule[] = FLYING_RULES,
): FlyingRuleHit[] {
  const hits: FlyingRuleHit[] = [];
  for (const rule of rules) {
    const res = rule.match(ctx);
    if (res.matched) {
      hits.push({
        id: rule.id,
        name: rule.name,
        level: rule.level,
        palaces: res.palaces ?? [],
        weightDelta: rule.weightDelta,
        detail: res.detail ?? rule.description,
      });
    }
  }
  return hits;
}
