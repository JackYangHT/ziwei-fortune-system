'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { computeBazi } from '@/lib/bazi/chart';
import type { FiveElement } from '@/lib/bazi/classical-tables';
import type {
  BaziChart,
  BaziPillar,
  PillarKey,
  ShenShaHitItem,
} from '@/lib/bazi/types';
import { computeMagneticField } from '@/lib/ziwei-flying/magnetic-field';
import { VECTOR_STRENGTH } from '@/lib/ziwei-flying/config';
import type {
  FlyingRuleHit,
  LuFollowsJiVector,
  MagneticField,
} from '@/lib/ziwei-flying/types';

export interface ChartSidePanelProps {
  chart: ZiweiChart;
  /** 可选外部受控或初始流年年份 */
  referenceYear?: number;
}

type SideTab = 'bazi' | 'magnetic' | 'rules';

const ELEMENT_COLORS: Record<
  FiveElement,
  { text: string; bg: string; border: string; bar: string }
> = {
  木: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    bar: '#10b981',
  },
  火: {
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    bar: '#f43f5e',
  },
  土: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    bar: '#f59e0b',
  },
  金: {
    text: 'text-yellow-300',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    bar: '#eab308',
  },
  水: {
    text: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    bar: '#38bdf8',
  },
};

const PILLAR_LABELS: Record<PillarKey, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

const RELATION_ORDER: Record<LuFollowsJiVector['relation'], number> = {
  'same-palace': 0,
  clamp: 1,
  'opposite-palace': 2,
  'sanhe-palace': 3,
  'other-palace': 4,
};

const RELATION_META: Record<
  LuFollowsJiVector['relation'],
  { label: string; badgeClass: string }
> = {
  'same-palace': {
    label: '同宫共振',
    badgeClass: 'text-amber-400 bg-amber-500/15 border-amber-500/35',
  },
  clamp: {
    label: '邻宫夹制',
    badgeClass: 'text-purple-400 bg-purple-500/15 border-purple-500/35',
  },
  'opposite-palace': {
    label: '对宫激荡',
    badgeClass: 'text-sky-400 bg-sky-500/15 border-sky-500/35',
  },
  'sanhe-palace': {
    label: '三合传导',
    badgeClass: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/35',
  },
  'other-palace': {
    label: '异宫流转',
    badgeClass: 'text-slate-400 bg-slate-500/10 border-slate-500/25',
  },
};

const VECTOR_LEVEL_LABELS: Record<LuFollowsJiVector['level'], string> = {
  natal: '生年',
  laiYin: '来因',
  mingGong: '命宫',
  decadal: '大限',
  yearly: '流年',
  palace: '宫干',
};

const RULE_DOMAIN_GROUPS: {
  key: string;
  prefix: string;
  label: string;
  icon: string;
}[] = [
  { key: 'career', prefix: 'career-', label: '事业与职涯', icon: '◈' },
  { key: 'wealth', prefix: 'wealth-', label: '财富与房产', icon: '◈' },
  { key: 'relationship', prefix: 'relationship-', label: '感情婚姻与桃花', icon: '◈' },
  { key: 'academic', prefix: 'academic-', label: '学业与考运', icon: '◈' },
  { key: 'health', prefix: 'health-', label: '身体健康', icon: '◈' },
  { key: 'family', prefix: 'family-', label: '六亲与家族', icon: '◈' },
  { key: 'social', prefix: 'social-', label: '职场与人际', icon: '◈' },
  { key: 'timing', prefix: 'timing-', label: '时间应期与叠宫', icon: '◈' },
];

const RULE_LEVEL_STYLE: Record<
  FlyingRuleHit['level'],
  { label: string; badge: string; border: string }
> = {
  auspicious: {
    label: '吉象',
    badge: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/35',
    border: 'rgba(16,185,129,0.22)',
  },
  inauspicious: {
    label: '警示',
    badge: 'text-rose-400 bg-rose-500/15 border-rose-500/35',
    border: 'rgba(244,63,94,0.22)',
  },
  neutral: {
    label: '中性',
    badge: 'text-sky-400 bg-sky-500/15 border-sky-500/35',
    border: 'rgba(56,189,248,0.22)',
  },
};

function ChartSidePanelInner({ chart, referenceYear }: ChartSidePanelProps) {
  const defaultYear = referenceYear ?? new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<SideTab>('bazi');
  const [daXianIndex, setDaXianIndex] = useState<number>(() =>
    chart.currentDaXianIndex >= 0 ? chart.currentDaXianIndex : 0,
  );
  const [activeYear, setActiveYear] = useState<number>(defaultYear);

  const [bazi, setBazi] = useState<BaziChart | null>(null);
  const [magneticField, setMagneticField] = useState<MagneticField | null>(null);

  // 当外部流年变化时同步
  useEffect(() => {
    if (typeof referenceYear === 'number') {
      setActiveYear(referenceYear);
    }
  }, [referenceYear]);

  // 当换盘时重置默认大限索引
  useEffect(() => {
    setDaXianIndex(chart.currentDaXianIndex >= 0 ? chart.currentDaXianIndex : 0);
  }, [chart]);

  // Tab 1 八字数据请求：只依赖 chart 与 activeYear，切换紫微大限 daXianIndex 时绝不重算八字
  useEffect(() => {
    let cancelled = false;
    fetch('/api/bazi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        birthInfo: chart.birthInfo,
        chart,
        referenceYear: activeYear,
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('bazi error'))))
      .then((data: BaziChart) => {
        if (!cancelled) setBazi(data);
      })
      .catch(() => {
        if (!cancelled) {
          setBazi(
            computeBazi({
              chart,
              gender: chart.birthInfo.gender === 'male' ? 'M' : 'F',
              referenceYear: activeYear,
            }),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chart, activeYear]);

  // Tab 2 & Tab 3 磁场化数据请求：依赖 chart、daXianIndex、activeYear
  useEffect(() => {
    let cancelled = false;
    fetch('/api/magnetic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        birthInfo: chart.birthInfo,
        chart,
        daXianIndex,
        referenceYear: activeYear,
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('magnetic error'))))
      .then((data: MagneticField) => {
        if (!cancelled) setMagneticField(data);
      })
      .catch(() => {
        if (!cancelled) {
          setMagneticField(
            computeMagneticField({
              chart,
              daXianIndex,
              referenceYear: activeYear,
            }),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chart, daXianIndex, activeYear]);

  // 统计八字五行分布（四柱天干4字 + 四柱地支本气4字 = 8字，以及含全量藏干权重）
  const fiveElementStats = useMemo(() => {
    const counts: Record<FiveElement, number> = {
      木: 0,
      火: 0,
      土: 0,
      金: 0,
      水: 0,
    };
    const hiddenCounts: Record<FiveElement, number> = {
      木: 0,
      火: 0,
      土: 0,
      金: 0,
      水: 0,
    };
    if (!bazi) return { counts, hiddenCounts };
    const pillarList: BaziPillar[] = [
      bazi.pillars.year,
      bazi.pillars.month,
      bazi.pillars.day,
      bazi.pillars.hour,
    ];
    for (const p of pillarList) {
      counts[p.stemElement] += 1;
      counts[p.branchElement] += 1;
      for (const hs of p.hiddenStems) {
        hiddenCounts[hs.element] += 1;
      }
    }
    return { counts, hiddenCounts };
  }, [bazi]);

  // 排序后的 vectors（按 relation 优先级：same-palace 最上）
  const sortedVectors = useMemo(() => {
    if (!magneticField) return [];
    return [...magneticField.vectors].sort((a, b) => {
      const orderDiff = RELATION_ORDER[a.relation] - RELATION_ORDER[b.relation];
      if (orderDiff !== 0) return orderDiff;
      return VECTOR_STRENGTH[b.relation] - VECTOR_STRENGTH[a.relation];
    });
  }, [magneticField]);

  // 12宫净权重最大值（用于归一化进度条宽度）
  const maxAbsNetWeight = useMemo(() => {
    if (!magneticField) return 1;
    return Math.max(
      ...magneticField.weightedField.map((w) => Math.abs(w.totalNetWeight)),
      1,
    );
  }, [magneticField]);

  // 规则按7大领域分组
  const groupedRules = useMemo(() => {
    const hits = magneticField?.dualTrack.flyingRuleHits ?? [];
    return RULE_DOMAIN_GROUPS.map((group) => ({
      ...group,
      hits: hits.filter((h) => h.id.startsWith(group.prefix)),
    }));
  }, [magneticField]);

  const pillarList: BaziPillar[] = bazi
    ? [
        bazi.pillars.year,
        bazi.pillars.month,
        bazi.pillars.day,
        bazi.pillars.hour,
      ]
    : [];

  const shenShaItems: ShenShaHitItem[] = bazi
    ? [
        bazi.shenSha.tianYiGuiRen,
        bazi.shenSha.wenChang,
        bazi.shenSha.yiMa,
        bazi.shenSha.taoHua,
        bazi.shenSha.yangRen,
      ]
    : [];

  const combinedIdx = magneticField?.dualTrack.combinedIndex ?? 0;
  const hitCount = magneticField?.dualTrack.flyingRuleHits.length ?? 0;

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--bdr-med)',
        boxShadow: 'var(--sh-sm)',
      }}
    >
      {/* 顶部三 Tab 导航栏 */}
      <div
        className="grid grid-cols-3 gap-1 p-1.5"
        style={{
          background: 'var(--bg-1)',
          borderBottom: '1px solid var(--bdr)',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('bazi')}
          className="py-2 px-2 rounded-lg text-[11px] font-medium transition-all"
          style={{
            background:
              activeTab === 'bazi' ? 'rgba(212,168,67,0.14)' : 'transparent',
            border:
              activeTab === 'bazi'
                ? '1px solid rgba(212,168,67,0.35)'
                : '1px solid transparent',
            color: activeTab === 'bazi' ? 'var(--ac)' : 'var(--tx-2)',
          }}
        >
          四柱八字
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('magnetic')}
          className="py-2 px-2 rounded-lg text-[11px] font-medium transition-all"
          style={{
            background:
              activeTab === 'magnetic' ? 'rgba(212,168,67,0.14)' : 'transparent',
            border:
              activeTab === 'magnetic'
                ? '1px solid rgba(212,168,67,0.35)'
                : '1px solid transparent',
            color: activeTab === 'magnetic' ? 'var(--ac)' : 'var(--tx-2)',
          }}
        >
          磁场化 ({combinedIdx >= 0 ? '+' : ''}
          {combinedIdx})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className="py-2 px-2 rounded-lg text-[11px] font-medium transition-all"
          style={{
            background:
              activeTab === 'rules' ? 'rgba(212,168,67,0.14)' : 'transparent',
            border:
              activeTab === 'rules'
                ? '1px solid rgba(212,168,67,0.35)'
                : '1px solid transparent',
            color: activeTab === 'rules' ? 'var(--ac)' : 'var(--tx-2)',
          }}
        >
          命中规则 ({hitCount})
        </button>
      </div>

      {/* 内容滚动区 */}
      <div className="p-3.5 space-y-4 max-h-[780px] overflow-y-auto">
        {/* ==================== TAB 1: 八字盘 ==================== */}
        {activeTab === 'bazi' && (
          !bazi ? (
            <div className="py-12 text-center text-xs" style={{ color: 'var(--tx-3)' }}>
              八字排盘计算中…
            </div>
          ) : (
            <div className="space-y-4">
              {/* 日主与起运概览 */}
              <div
                className="rounded-lg p-3 flex items-center justify-between"
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--bdr)',
                }}
              >
                <div>
                  <div className="text-[10px]" style={{ color: 'var(--tx-3)' }}>
                    日主元神 · {bazi.daYun.yinYangGender}
                    {bazi.daYun.isForward ? '顺排' : '逆排'}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="text-base font-bold"
                      style={{ color: 'var(--ac)' }}
                    >
                      {bazi.dayMaster}
                      {bazi.dayMasterElement}命
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded border"
                      style={{
                        borderColor: 'var(--bdr-med)',
                        color: 'var(--tx-2)',
                      }}
                    >
                      {bazi.pillars.day.nayin?.name ?? ''}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px]" style={{ color: 'var(--tx-3)' }}>
                    起运信息
                  </div>
                  <div
                    className="text-[11px] font-medium"
                    style={{ color: 'var(--tx-1)' }}
                  >
                    {bazi.daYun.startAge}虚岁 ({bazi.daYun.startYear}年)
                  </div>
                  <div className="text-[9px]" style={{ color: 'var(--tx-3)' }}>
                    出生后{bazi.daYun.startDetail.years}年
                    {bazi.daYun.startDetail.months}月{bazi.daYun.startDetail.days}天交运
                  </div>
                </div>
              </div>

              {/* 四柱八字核心盘 */}
              <div>
                <div
                  className="text-[10px] font-medium tracking-wider mb-2 flex items-center justify-between"
                  style={{ color: 'var(--tx-3)' }}
                >
                  <span>✦ 四柱八字（天干 / 地支 / 藏干 / 十神 / 十二长生）</span>
                  <span className="font-mono">{bazi.rawFourPillars.join(' ')}</span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {pillarList.map((p) => {
                    const stemStyle = ELEMENT_COLORS[p.stemElement];
                    const branchStyle = ELEMENT_COLORS[p.branchElement];
                    return (
                      <div
                        key={p.key}
                        className="rounded-lg p-2 flex flex-col items-center text-center"
                        style={{
                          background: 'var(--bg-1)',
                          border:
                            p.key === 'day'
                              ? '1px solid rgba(212,168,67,0.4)'
                              : '1px solid var(--bdr)',
                        }}
                      >
                        <div
                          className="text-[9px] mb-1"
                          style={{ color: 'var(--tx-3)' }}
                        >
                          {p.label}
                        </div>

                        <div
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded mb-1.5"
                          style={{
                            background:
                              p.stemTenGod === '日主'
                                ? 'rgba(212,168,67,0.16)'
                                : 'rgba(255,255,255,0.04)',
                            color:
                              p.stemTenGod === '日主'
                                ? 'var(--ac)'
                                : 'var(--tx-2)',
                          }}
                        >
                          {p.stemTenGod}
                        </div>

                        <div
                          className={`w-full py-1.5 rounded-t-md border-x border-t flex flex-col items-center ${stemStyle.bg} ${stemStyle.border}`}
                        >
                          <span className={`text-base font-bold leading-none ${stemStyle.text}`}>
                            {p.stem}
                          </span>
                          <span className="text-[8px] opacity-75 mt-0.5">
                            {p.stemElement}
                          </span>
                        </div>

                        <div
                          className={`w-full py-1.5 rounded-b-md border flex flex-col items-center mb-2 ${branchStyle.bg} ${branchStyle.border}`}
                        >
                          <span className={`text-base font-bold leading-none ${branchStyle.text}`}>
                            {p.branch}
                          </span>
                          <span className="text-[8px] opacity-75 mt-0.5">
                            {p.branchElement}
                          </span>
                        </div>

                        <div className="w-full space-y-1 pt-1 border-t border-white/5">
                          <div
                            className="text-[8px]"
                            style={{ color: 'var(--tx-3)' }}
                          >
                            藏干·十神
                          </div>
                          {p.hiddenStems.map((hs) => (
                            <div
                              key={`${p.key}-${hs.stem}-${hs.role}`}
                              className="flex items-center justify-between text-[9px] px-1 rounded"
                              style={{ background: 'rgba(0,0,0,0.12)' }}
                            >
                              <span className={ELEMENT_COLORS[hs.element].text}>
                                {hs.stem}
                                <span className="opacity-60 text-[8px]">
                                  ({hs.roleLabel.slice(0, 1)})
                                </span>
                              </span>
                              <span style={{ color: 'var(--tx-2)' }}>
                                {hs.tenGod}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="w-full mt-2 pt-1.5 border-t border-white/5 flex flex-col gap-0.5">
                          <div className="flex items-center justify-between text-[9px]">
                            <span style={{ color: 'var(--tx-3)' }}>长生</span>
                            <span
                              className="font-medium"
                              style={{ color: 'var(--tx-1)' }}
                            >
                              {p.diShi}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[9px]">
                            <span style={{ color: 'var(--tx-3)' }}>纳音</span>
                            <span
                              className="truncate max-w-[48px]"
                              style={{ color: 'var(--ac)' }}
                            >
                              {p.nayin?.name ?? '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 五行分布 */}
              <div
                className="rounded-lg p-3 space-y-2"
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--bdr)',
                }}
              >
                <div
                  className="text-[10px] font-medium tracking-wider flex items-center justify-between"
                  style={{ color: 'var(--tx-3)' }}
                >
                  <span>✦ 五行分布（四柱八字 / 支藏干）</span>
                  <span>共 8 字</span>
                </div>
                <div className="space-y-1.5">
                  {(['木', '火', '土', '金', '水'] as FiveElement[]).map((el) => {
                    const count = fiveElementStats.counts[el];
                    const hiddenCount = fiveElementStats.hiddenCounts[el];
                    const pct = Math.round((count / 8) * 100);
                    const style = ELEMENT_COLORS[el];
                    return (
                      <div key={el} className="flex items-center gap-2 text-[10px]">
                        <span className={`w-5 font-bold ${style.text}`}>{el}</span>
                        <div
                          className="flex-1 h-2 rounded-full overflow-hidden"
                          style={{ background: 'rgba(128,128,128,0.15)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(pct, count > 0 ? 8 : 0)}%`,
                              background: style.bar,
                            }}
                          />
                        </div>
                        <span
                          className="w-24 text-right font-mono text-[9px]"
                          style={{ color: 'var(--tx-2)' }}
                        >
                          {count}字 (藏干{hiddenCount})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 神煞汇总 */}
              <div
                className="rounded-lg p-3 space-y-2"
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--bdr)',
                }}
              >
                <div
                  className="text-[10px] font-medium tracking-wider"
                  style={{ color: 'var(--tx-3)' }}
                >
                  ✦ 核心神煞（天乙贵人 / 文昌 / 驿马 / 桃花 / 羊刃）
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {shenShaItems.map((item) => {
                    const hasHit = item.hitPillars.length > 0;
                    return (
                      <div
                        key={item.name}
                        className="flex items-center justify-between text-[10px] px-2.5 py-1.5 rounded"
                        style={{
                          background: hasHit
                            ? 'rgba(212,168,67,0.08)'
                            : 'rgba(128,128,128,0.05)',
                          border: hasHit
                            ? '1px solid rgba(212,168,67,0.25)'
                            : '1px solid var(--bdr)',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="font-medium"
                            style={{
                              color: hasHit ? 'var(--ac)' : 'var(--tx-2)',
                            }}
                          >
                            {item.name}
                          </span>
                          <span
                            className="text-[9px]"
                            style={{ color: 'var(--tx-3)' }}
                          >
                            查见 [{item.targetBranches.join('、')}]
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {hasHit ? (
                            item.hitPillars.map((pk) => (
                              <span
                                key={pk}
                                className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                                style={{
                                  background: 'rgba(212,168,67,0.18)',
                                  color: 'var(--ac)',
                                }}
                              >
                                入{PILLAR_LABELS[pk]}
                              </span>
                            ))
                          ) : (
                            <span
                              className="text-[9px]"
                              style={{ color: 'var(--tx-3)' }}
                            >
                              原局未见
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 大运十步 */}
              <div
                className="rounded-lg p-3 space-y-2"
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--bdr)',
                }}
              >
                <div
                  className="text-[10px] font-medium tracking-wider flex items-center justify-between"
                  style={{ color: 'var(--tx-3)' }}
                >
                  <span>✦ 大运十步（每步十年）</span>
                  <span>基准年：{bazi.referenceYear}</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {bazi.daYun.steps.map((step) => {
                    const isCurrentStep =
                      bazi.referenceYear >= step.startYear &&
                      bazi.referenceYear <= step.endYear;
                    return (
                      <div
                        key={step.index}
                        className="rounded p-1.5 text-center transition-all"
                        style={{
                          background: isCurrentStep
                            ? 'rgba(212,168,67,0.14)'
                            : 'rgba(128,128,128,0.06)',
                          border: isCurrentStep
                            ? '1px solid rgba(212,168,67,0.45)'
                            : '1px solid var(--bdr)',
                        }}
                      >
                        <div
                          className="text-[8px] font-mono"
                          style={{ color: 'var(--tx-3)' }}
                        >
                          {step.startAge}–{step.endAge}岁
                        </div>
                        <div
                          className="text-xs font-bold my-0.5"
                          style={{
                            color: isCurrentStep ? 'var(--ac)' : 'var(--tx-1)',
                          }}
                        >
                          {step.ganZhi}
                        </div>
                        <div
                          className="text-[8px]"
                          style={{ color: 'var(--tx-2)' }}
                        >
                          {step.stemTenGod} · {step.diShi}
                        </div>
                        <div
                          className="text-[8px] font-mono opacity-70"
                          style={{ color: 'var(--tx-3)' }}
                        >
                          {step.startYear}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 流年前后 5 年（共 11 年） */}
              <div
                className="rounded-lg p-3 space-y-2"
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--bdr)',
                }}
              >
                <div
                  className="text-[10px] font-medium tracking-wider flex items-center justify-between"
                  style={{ color: 'var(--tx-3)' }}
                >
                  <span>✦ 流年序列（前后 5 年）</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveYear((y) => y - 1)}
                      className="px-1.5 py-0.5 rounded text-[9px] border"
                      style={{ borderColor: 'var(--bdr-med)', color: 'var(--tx-2)' }}
                    >
                      ‹ 上一年
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveYear((y) => y + 1)}
                      className="px-1.5 py-0.5 rounded text-[9px] border"
                      style={{ borderColor: 'var(--bdr-med)', color: 'var(--tx-2)' }}
                    >
                      下一年 ›
                    </button>
                  </div>
                </div>
                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                  {bazi.liuNian.map((ln) => (
                    <div
                      key={ln.year}
                      onClick={() => setActiveYear(ln.year)}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded text-[10px] cursor-pointer transition-all"
                      style={{
                        background: ln.isReferenceYear
                          ? 'rgba(212,168,67,0.15)'
                          : 'rgba(128,128,128,0.04)',
                        border: ln.isReferenceYear
                          ? '1px solid rgba(212,168,67,0.4)'
                          : '1px solid transparent',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono font-semibold"
                          style={{
                            color: ln.isReferenceYear ? 'var(--ac)' : 'var(--tx-1)',
                          }}
                        >
                          {ln.year}年
                        </span>
                        <span
                          className="text-[9px] font-mono"
                          style={{ color: 'var(--tx-3)' }}
                        >
                          ({ln.age}岁)
                        </span>
                        <span
                          className="font-bold"
                          style={{
                            color: ln.isReferenceYear ? 'var(--ac)' : 'var(--tx-1)',
                          }}
                        >
                          {ln.ganZhi}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px]">
                        <span style={{ color: 'var(--tx-2)' }}>{ln.stemTenGod}</span>
                        <span style={{ color: 'var(--tx-3)' }}>·</span>
                        <span style={{ color: 'var(--tx-2)' }}>长生:{ln.diShi}</span>
                        {ln.nayin && (
                          <span
                            className="px-1 rounded"
                            style={{
                              background: 'rgba(212,168,67,0.08)',
                              color: 'var(--ac)',
                            }}
                          >
                            {ln.nayin.name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}

        {/* ==================== TAB 2: 磁场化 ==================== */}
        {activeTab === 'magnetic' && (
          !magneticField ? (
            <div className="py-12 text-center text-xs" style={{ color: 'var(--tx-3)' }}>
              磁场化矩阵计算中…
            </div>
          ) : (
            <div className="space-y-4">
              {/* 大限与流年切换控制器 */}
              <div
                className="rounded-lg p-2.5 space-y-2"
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--bdr)',
                }}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span style={{ color: 'var(--tx-3)' }}>
                    ✦ 运限叠盘控制（切换大限实时更新净权重与轨迹）
                  </span>
                  <div className="flex items-center gap-1 font-mono">
                    <button
                      type="button"
                      onClick={() => setActiveYear((y) => y - 1)}
                      className="px-1.5 py-0.5 rounded border text-[9px]"
                      style={{ borderColor: 'var(--bdr-med)', color: 'var(--tx-2)' }}
                    >
                      ‹
                    </button>
                    <span style={{ color: 'var(--ac)' }}>{activeYear}年</span>
                    <button
                      type="button"
                      onClick={() => setActiveYear((y) => y + 1)}
                      className="px-1.5 py-0.5 rounded border text-[9px]"
                      style={{ borderColor: 'var(--bdr-med)', color: 'var(--tx-2)' }}
                    >
                      ›
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {chart.daXians.slice(0, 8).map((dx, idx) => {
                    const isSelected = daXianIndex === idx;
                    return (
                      <button
                        key={`${dx.palaceBranch}-${dx.startAge}`}
                        type="button"
                        onClick={() => setDaXianIndex(idx)}
                        className="py-1 px-1.5 rounded text-[9px] transition-all text-center truncate"
                        style={{
                          background: isSelected
                            ? 'rgba(147,51,234,0.18)'
                            : 'rgba(128,128,128,0.06)',
                          border: isSelected
                            ? '1px solid rgba(168,85,247,0.5)'
                            : '1px solid var(--bdr)',
                          color: isSelected ? '#c084fc' : 'var(--tx-2)',
                        }}
                      >
                        {dx.startAge}–{dx.endAge} {dx.palaceName.replace('宫', '')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 1. 来因宫 + 使命群组 */}
              <div
                className="rounded-lg p-3 space-y-2"
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--bdr)',
                }}
              >
                <div
                  className="text-[10px] font-medium tracking-wider flex items-center justify-between"
                  style={{ color: 'var(--tx-3)' }}
                >
                  <span>✦ 来因宫与使命群组（体）</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[9px] font-medium"
                    style={{
                      background:
                        magneticField.body.laiYin.domainType === 'inner'
                          ? 'rgba(16,185,129,0.14)'
                          : 'rgba(56,189,248,0.14)',
                      color:
                        magneticField.body.laiYin.domainType === 'inner'
                          ? '#34d399'
                          : '#38bdf8',
                    }}
                  >
                    {magneticField.body.laiYin.domainType === 'inner'
                      ? '内六宫 · 自立格（体）'
                      : '外六宫 · 他立格（用）'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className="text-base font-bold"
                      style={{ color: 'var(--ac)' }}
                    >
                      {magneticField.body.laiYin.palaceName}
                    </span>
                    <span
                      className="ml-2 text-xs font-mono"
                      style={{ color: 'var(--tx-2)' }}
                    >
                      [{magneticField.body.laiYin.stemName}
                      {magneticField.body.laiYin.branchName}]
                    </span>
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--tx-2)' }}>
                    对宫投射：
                    <span className="font-medium" style={{ color: 'var(--tx-1)' }}>
                      {magneticField.body.laiYin.oppositePalace.palaceName}(
                      {magneticField.body.laiYin.oppositePalace.branchName})
                    </span>
                  </div>
                </div>

                <div
                  className="text-[10px] pt-1.5 border-t flex items-center justify-between"
                  style={{ borderColor: 'var(--bdr)', color: 'var(--tx-2)' }}
                >
                  <span>三合使命群组：</span>
                  <div className="flex items-center gap-1">
                    {magneticField.body.laiYin.sanHePalaces.map((p) => (
                      <span
                        key={p.branch}
                        className="px-1.5 py-0.5 rounded text-[9px]"
                        style={{
                          background: 'rgba(212,168,67,0.1)',
                          color: 'var(--ac)',
                        }}
                      >
                        {p.palaceName}({p.branchName})
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. 生年四化四颗星落点 */}
              <div
                className="rounded-lg p-3 space-y-2"
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--bdr)',
                }}
              >
                <div
                  className="text-[10px] font-medium tracking-wider"
                  style={{ color: 'var(--tx-3)' }}
                >
                  ✦ 生年四化落点（{magneticField.body.birthYearStemName}干四化）
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['禄', '权', '科', '忌'] as const).map((sh) => {
                    const landing = magneticField.body.natalSihua[sh];
                    const badgeColors: Record<typeof sh, string> = {
                      禄: 'text-emerald-400 border-emerald-500/35 bg-emerald-500/10',
                      权: 'text-blue-400 border-blue-500/35 bg-blue-500/10',
                      科: 'text-yellow-400 border-yellow-500/35 bg-yellow-500/10',
                      忌: 'text-rose-400 border-rose-500/35 bg-rose-500/10',
                    };
                    return (
                      <div
                        key={sh}
                        className="rounded-lg p-2 border flex flex-col gap-1"
                        style={{
                          background: 'rgba(0,0,0,0.12)',
                          borderColor: 'var(--bdr)',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeColors[sh]}`}
                          >
                            生年化{sh}
                          </span>
                          <span
                            className="text-[9px] px-1 rounded"
                            style={{
                              background:
                                landing.domainType === 'inner'
                                  ? 'rgba(16,185,129,0.12)'
                                  : 'rgba(148,163,184,0.12)',
                              color:
                                landing.domainType === 'inner'
                                  ? '#34d399'
                                  : 'var(--tx-3)',
                            }}
                          >
                            {landing.domainType === 'inner' ? '内宫' : '外宫'}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span
                            className="text-xs font-bold"
                            style={{ color: 'var(--tx-1)' }}
                          >
                            {landing.starName}
                          </span>
                          <span
                            className="text-[11px] font-medium"
                            style={{ color: 'var(--ac)' }}
                          >
                            {landing.palaceName}({landing.branchName})
                          </span>
                        </div>
                        {landing.hasSelfSihua && (
                          <div className="text-[9px] text-rose-400 font-medium">
                            ⚠ 同星离心自化（能量耗散）
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. 12 宫净权重热力条（正绿负红） */}
              <div
                className="rounded-lg p-3 space-y-2.5"
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--bdr)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-medium tracking-wider"
                    style={{ color: 'var(--tx-3)' }}
                  >
                    ✦ 12 宫净权重热力条（正绿 / 负红）
                  </span>
                  <span
                    className="text-[9px] font-mono"
                    style={{ color: 'var(--ac)' }}
                  >
                    主轨:{magneticField.dualTrack.flyingMatrixScore} | 底盘:
                    {magneticField.dualTrack.sanheBackgroundScore}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px]" style={{ color: 'var(--tx-3)' }}>
                    焦点宫位 Top 3：
                  </span>
                  {magneticField.dualTrack.topResonancePalaces.map((tp, idx) => (
                    <span
                      key={tp.palaceName}
                      className="text-[9px] px-1.5 py-0.5 rounded font-medium border"
                      style={{
                        borderColor:
                          tp.totalNetWeight >= 0
                            ? 'rgba(16,185,129,0.35)'
                            : 'rgba(244,63,94,0.35)',
                        background:
                          tp.totalNetWeight >= 0
                            ? 'rgba(16,185,129,0.1)'
                            : 'rgba(244,63,94,0.1)',
                        color: tp.totalNetWeight >= 0 ? '#34d399' : '#fb7185',
                      }}
                    >
                      #{idx + 1} {tp.palaceName}{' '}
                      {tp.totalNetWeight >= 0 ? '+' : ''}
                      {tp.totalNetWeight}
                    </span>
                  ))}
                </div>

                <div className="space-y-1.5">
                  {magneticField.weightedField.map((wf) => {
                    const isPositive = wf.totalNetWeight >= 0;
                    const barWidthPct = Math.min(
                      100,
                      Math.round(
                        (Math.abs(wf.totalNetWeight) / maxAbsNetWeight) * 100,
                      ),
                    );
                    const isLaiYin =
                      wf.branch === magneticField.body.laiYin.branch;
                    const isCurrentDx =
                      magneticField.rawMatrix.activeDecadalPalace?.branch ===
                      wf.branch;

                    return (
                      <div
                        key={wf.branch}
                        className="px-2 py-1.5 rounded text-[10px]"
                        style={{
                          background: 'rgba(0,0,0,0.12)',
                          border: isCurrentDx
                            ? '1px solid rgba(168,85,247,0.4)'
                            : '1px solid transparent',
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-medium"
                              style={{ color: 'var(--tx-1)' }}
                            >
                              {wf.palaceName}
                            </span>
                            <span
                              className="text-[9px] font-mono"
                              style={{ color: 'var(--tx-3)' }}
                            >
                              ({wf.branchName})
                            </span>
                            <span
                              className="text-[8px] px-1 rounded"
                              style={{
                                background:
                                  wf.domainType === 'inner'
                                    ? 'rgba(16,185,129,0.1)'
                                    : 'rgba(148,163,184,0.1)',
                                color:
                                  wf.domainType === 'inner'
                                    ? '#34d399'
                                    : 'var(--tx-3)',
                              }}
                            >
                              {wf.domainType === 'inner' ? '内' : '外'}
                            </span>
                            {isLaiYin && (
                              <span
                                className="text-[8px] px-1 rounded"
                                style={{
                                  background: 'rgba(212,168,67,0.18)',
                                  color: 'var(--ac)',
                                }}
                              >
                                来因
                              </span>
                            )}
                            {isCurrentDx && (
                              <span className="text-[8px] px-1 rounded bg-purple-500/20 text-purple-300">
                                大限
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className="text-[8px] font-mono"
                              style={{ color: 'var(--tx-3)' }}
                            >
                              禄{wf.rawIncoming.lu} 权{wf.rawIncoming.quan} 科
                              {wf.rawIncoming.ke} 忌{wf.rawIncoming.ji}
                            </span>
                            <span
                              className={`font-mono font-bold min-w-[38px] text-right ${
                                wf.totalNetWeight > 0
                                  ? 'text-emerald-400'
                                  : wf.totalNetWeight < 0
                                    ? 'text-rose-400'
                                    : 'text-slate-400'
                              }`}
                            >
                              {wf.totalNetWeight > 0 ? '+' : ''}
                              {wf.totalNetWeight}
                            </span>
                          </div>
                        </div>

                        <div
                          className="w-full h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'rgba(128,128,128,0.15)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(
                                barWidthPct,
                                wf.totalNetWeight !== 0 ? 6 : 0,
                              )}%`,
                              background:
                                wf.totalNetWeight === 0
                                  ? '#64748b'
                                  : isPositive
                                    ? '#10b981'
                                    : '#ef4444',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Vectors 禄随忌走列表（按 relation 排序，same-palace 最上） */}
              <div
                className="rounded-lg p-3 space-y-2"
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--bdr)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-medium tracking-wider"
                    style={{ color: 'var(--tx-3)' }}
                  >
                    ✦ 禄随忌走轨迹（按 relation 强度排序，同宫最上）
                  </span>
                  <span
                    className="text-[9px] font-mono"
                    style={{ color: 'var(--tx-3)' }}
                  >
                    共 {sortedVectors.length} 条
                  </span>
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {sortedVectors.map((vec) => {
                    const relMeta = RELATION_META[vec.relation];
                    const strength = VECTOR_STRENGTH[vec.relation];
                    return (
                      <div
                        key={vec.id}
                        className="rounded-lg p-2 text-[10px] space-y-1"
                        style={{
                          background: 'rgba(0,0,0,0.14)',
                          border:
                            vec.relation === 'same-palace'
                              ? '1px solid rgba(245,158,11,0.35)'
                              : '1px solid var(--bdr)',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                              style={{
                                background: 'rgba(212,168,67,0.14)',
                                color: 'var(--ac)',
                              }}
                            >
                              {VECTOR_LEVEL_LABELS[vec.level]}
                            </span>
                            <span
                              className="font-semibold"
                              style={{ color: 'var(--tx-1)' }}
                            >
                              {vec.sourcePalace} ({vec.stemName}
                              {vec.sourceBranchName})
                            </span>
                          </div>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${relMeta.badgeClass}`}
                          >
                            {relMeta.label} · {strength}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] pt-0.5">
                          <span className="text-emerald-400 font-medium">
                            {vec.luStar}禄 → {vec.luTargetPalace}
                          </span>
                          <span style={{ color: 'var(--tx-3)' }}>➔</span>
                          <span className="text-rose-400 font-medium">
                            {vec.jiStar}忌 → {vec.jiTargetPalace}
                          </span>
                        </div>

                        <div
                          className="text-[9px] leading-relaxed"
                          style={{ color: 'var(--tx-3)' }}
                        >
                          {vec.trajectory}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )
        )}

        {/* ==================== TAB 3: 命中规则 ==================== */}
        {activeTab === 'rules' && (
          !magneticField ? (
            <div className="py-12 text-center text-xs" style={{ color: 'var(--tx-3)' }}>
              规则扫描计算中…
            </div>
          ) : (
            <div className="space-y-4">
              {/* 命中统计总览 */}
              <div
                className="rounded-lg p-3 flex items-center justify-between"
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--bdr)',
                }}
              >
                <div>
                  <div className="text-[10px]" style={{ color: 'var(--tx-3)' }}>
                    飞星规则引擎（8大人生领域 · 43条规则库）
                  </div>
                  <div className="text-xs font-bold mt-0.5" style={{ color: 'var(--ac)' }}>
                    当前命盘命中 {magneticField.dualTrack.flyingRuleHits.length} 条规则
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px]" style={{ color: 'var(--tx-3)' }}>
                    规则修正总权重
                  </div>
                  {(() => {
                    const totalDelta =
                      Math.round(
                        magneticField.dualTrack.flyingRuleHits.reduce(
                          (s, h) => s + h.weightDelta,
                          0,
                        ) * 100,
                      ) / 100;
                    return (
                      <div
                        className={`text-sm font-mono font-bold ${
                          totalDelta > 0
                            ? 'text-emerald-400'
                            : totalDelta < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                        }`}
                      >
                        {totalDelta > 0 ? '+' : ''}
                        {totalDelta}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 按 7 大领域分组显示 */}
              <div className="space-y-3">
                {groupedRules.map((group) => (
                  <div
                    key={group.key}
                    className="rounded-lg p-3 space-y-2"
                    style={{
                      background: 'var(--bg-1)',
                      border: '1px solid var(--bdr)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span style={{ color: 'var(--ac)' }}>{group.icon}</span>
                        <span
                          className="text-[11px] font-semibold"
                          style={{ color: 'var(--tx-1)' }}
                        >
                          {group.label}
                        </span>
                      </div>
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{
                          background:
                            group.hits.length > 0
                              ? 'rgba(212,168,67,0.14)'
                              : 'rgba(128,128,128,0.08)',
                          color:
                            group.hits.length > 0 ? 'var(--ac)' : 'var(--tx-3)',
                        }}
                      >
                        {group.hits.length} 条命中
                      </span>
                    </div>

                    {group.hits.length === 0 ? (
                      <div
                        className="text-[10px] py-1"
                        style={{ color: 'var(--tx-3)' }}
                      >
                        此领域未触发显著冲突或特殊飞化图案
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {group.hits.map((hit) => {
                          const lvStyle = RULE_LEVEL_STYLE[hit.level];
                          return (
                            <div
                              key={hit.id}
                              className="rounded-lg p-2.5 space-y-1.5"
                              style={{
                                background: 'rgba(0,0,0,0.14)',
                                border: `1px solid ${lvStyle.border}`,
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className={`text-[9px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${lvStyle.badge}`}
                                  >
                                    {lvStyle.label}
                                  </span>
                                  <span
                                    className="text-[11px] font-semibold truncate"
                                    style={{ color: 'var(--tx-1)' }}
                                  >
                                    {hit.name}
                                  </span>
                                </div>
                                <span
                                  className={`text-[10px] font-mono font-bold flex-shrink-0 ${
                                    hit.weightDelta > 0
                                      ? 'text-emerald-400'
                                      : hit.weightDelta < 0
                                        ? 'text-rose-400'
                                        : 'text-slate-400'
                                  }`}
                                >
                                  {hit.weightDelta > 0 ? '+' : ''}
                                  {hit.weightDelta}
                                </span>
                              </div>

                              {hit.palaces.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {hit.palaces.map((pName) => (
                                    <span
                                      key={`${hit.id}-${pName}`}
                                      className="text-[8px] px-1.5 py-0.5 rounded"
                                      style={{
                                        background: 'rgba(212,168,67,0.1)',
                                        color: 'var(--ac)',
                                      }}
                                    >
                                      {pName}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <p
                                className="text-[10px] leading-relaxed"
                                style={{ color: 'var(--tx-2)' }}
                              >
                                {hit.detail}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

const ChartSidePanel = React.memo(
  ChartSidePanelInner,
  (prev, next) =>
    prev.chart === next.chart && prev.referenceYear === next.referenceYear,
);

export default ChartSidePanel;
