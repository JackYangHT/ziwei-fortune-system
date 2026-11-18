'use client';
import { useCallback, useState } from 'react';
import BirthForm, { type BirthFormState } from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import ChartSidePanel from '@/components/ChartSidePanel';
import InsightPanel from '@/components/InsightPanel';
import TimeNav, { type TimeView } from '@/components/TimeNav';
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart, Palace } from '@/lib/ziwei/types';

/**
 * 命盘页 —— 开源版「排盘引擎 Demo」
 *
 * 这是一个最小可运行示例：用本仓库的排盘引擎 generateChart() 配合基础 UI
 * 组件，渲染一张完整紫微命盘 + 右侧深度面板（八字盘 / 磁场化 / 40条规则命中 + AI解读），
 * 并支持本命 / 大限 / 流年切换。
 */
export default function ChartPage() {
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [savedForm, setSavedForm] = useState<BirthFormState | undefined>(undefined);
  const [showRechartForm, setShowRechartForm] = useState(false);
  const [chartKey, setChartKey] = useState(0);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [view, setView] = useState<TimeView>('mingpan');
  const [liunianYear, setLiunianYear] = useState(() => new Date().getFullYear());
  const [rightMode, setRightMode] = useState<'sidePanel' | 'ai' | 'both'>('sidePanel');

  const handlePalaceSelect = useCallback((palace: Palace) => {
    setSelectedPalace(palace);
  }, []);

  const handleGenerateChart = useCallback((info: BirthInfo) => {
    const nextChart = generateChart(info);
    setChart(nextChart);
    setSelectedPalace(null);
    setView('mingpan');
    setShowRechartForm(false);
    setChartKey(k => k + 1);
  }, []);

  // ── 未起盘：展示出生信息表单 ──
  if (!chart) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>紫微斗数排盘</h1>
        <p style={{ color: '#888', marginBottom: 32, fontSize: 14, lineHeight: 1.7 }}>
          输入出生年月日时，开源排盘引擎即时生成命盘。
          <br />
          （本页为引擎 Demo，完整商业版界面不在开源范围；排盘内核完全开放。）
        </p>
        <BirthForm
          initialData={savedForm}
          onFormSave={setSavedForm}
          onSubmit={handleGenerateChart}
        />
      </main>
    );
  }

  // ── 已起盘：命盘 + 右侧面板（八字盘 / 磁场化 / 命中规则 / AI解读） ──
  return (
    <main style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 16px' }}>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setChart(null);
            setSelectedPalace(null);
            setView('mingpan');
            setShowRechartForm(false);
          }}
          style={{
            padding: '6px 14px', cursor: 'pointer',
            border: '1px solid var(--bdr-med, #ccc)', borderRadius: 8, background: 'transparent',
            color: 'var(--tx-1, inherit)', fontSize: 13,
          }}
        >
          ← 重新起盘
        </button>
        <button
          type="button"
          onClick={() => setShowRechartForm(prev => !prev)}
          style={{
            padding: '6px 14px', cursor: 'pointer',
            border: '1px solid rgba(212,168,67,0.4)', borderRadius: 8,
            background: showRechartForm ? 'rgba(212,168,67,0.18)' : 'rgba(212,168,67,0.08)',
            color: 'var(--ac, #d4a843)', fontSize: 13, fontWeight: 500,
          }}
        >
          {showRechartForm ? '✕ 收起生辰表单' : '✎ 修改生辰 / 重新排盘'}
        </button>
      </div>

      {showRechartForm && (
        <div style={{ maxWidth: 640, marginBottom: 20 }}>
          <BirthForm
            initialData={savedForm}
            onFormSave={setSavedForm}
            onSubmit={handleGenerateChart}
          />
        </div>
      )}

      <TimeNav
        chart={chart}
        view={view}
        liunianYear={liunianYear}
        onViewChange={setView}
        onYearChange={setLiunianYear}
      />

      <div
        className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]"
        style={{
          gap: 20, marginTop: 16, alignItems: 'start',
        }}
      >
        {/* 左侧：紫微命盘（受控同步顶层 TimeNav 的 view / liunianYear，并通过 key 确保换盘彻底刷新） */}
        <ChartBoard
          key={`board-${chartKey}`}
          chart={chart}
          view={view}
          liunianYear={liunianYear}
          onViewChange={setView}
          onYearChange={setLiunianYear}
          onPalaceSelect={handlePalaceSelect}
        />

        {/* 右侧：宽度 400px（桌面端），移动端折叠到底部 */}
        <div className="w-full lg:w-[400px] space-y-3">
          {/* 顶层切换栏：保留 InsightPanel，通过顶层 Tab / 折叠切换 */}
          <div
            className="flex items-center rounded-xl p-1 gap-1"
            style={{
              background: 'var(--bg-1)',
              border: '1px solid var(--bdr-med)',
            }}
          >
            <button
              type="button"
              onClick={() => setRightMode('sidePanel')}
              className="flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background:
                  rightMode === 'sidePanel' ? 'rgba(212,168,67,0.15)' : 'transparent',
                border:
                  rightMode === 'sidePanel'
                    ? '1px solid rgba(212,168,67,0.35)'
                    : '1px solid transparent',
                color: rightMode === 'sidePanel' ? 'var(--ac)' : 'var(--tx-2)',
              }}
            >
              命盘推演（八字/磁场/规则）
            </button>
            <button
              type="button"
              onClick={() => setRightMode('ai')}
              className="py-1.5 px-2.5 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background:
                  rightMode === 'ai' ? 'rgba(212,168,67,0.15)' : 'transparent',
                border:
                  rightMode === 'ai'
                    ? '1px solid rgba(212,168,67,0.35)'
                    : '1px solid transparent',
                color: rightMode === 'ai' ? 'var(--ac)' : 'var(--tx-2)',
              }}
            >
              AI 解读
            </button>
            <button
              type="button"
              onClick={() => setRightMode('both')}
              className="py-1.5 px-2 rounded-lg text-[10px] font-medium transition-all"
              style={{
                background:
                  rightMode === 'both' ? 'rgba(212,168,67,0.15)' : 'transparent',
                border:
                  rightMode === 'both'
                    ? '1px solid rgba(212,168,67,0.35)'
                    : '1px solid transparent',
                color: rightMode === 'both' ? 'var(--ac)' : 'var(--tx-3)',
              }}
              title="同时展开推演面板与 AI 解读"
            >
              同屏展开
            </button>
          </div>

          {/* 八字盘 + 磁场化 + 命中规则面板 */}
          <div className={rightMode === 'ai' ? 'hidden' : 'block'}>
            <ChartSidePanel
              key={`side-${chartKey}`}
              chart={chart}
              referenceYear={liunianYear}
            />
          </div>

          {/* 原有 AI 解读面板（保持挂载，内部维护 streaming 状态，不上提至 page.tsx） */}
          <div
            className={rightMode === 'sidePanel' ? 'hidden' : 'block'}
            style={{ height: 520 }}
          >
            <InsightPanel
              key={`insight-${chartKey}`}
              chart={chart}
              selectedPalace={selectedPalace}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
