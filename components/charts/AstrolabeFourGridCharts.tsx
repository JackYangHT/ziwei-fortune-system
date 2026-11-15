'use client';

/**
 * Chart.js 四宫格命盘与流年运势可视化组件（暂未挂载页面）
 * 逻辑来源：ziwei-fortune/webapp/app.js:21233-21558
 * - 1. 十二宫圆盘能量图 (renderZodiacWheelChart)
 * - 2. 五行能量雷达图 (renderFiveElementsChart)
 * - 3. 12个月运势曲线图 (renderMonthlyTrendChart)
 * - 4. 全年365天流日热力图 (renderYearHeatmap)
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface ChartPalaceInput {
  name: string;
  earthlyBranch: string;
  majorStars?: { name: string }[];
  minorStars?: { name: string }[];
  changsheng12?: string;
}

export interface ChartAstrolabeInput {
  fiveElementsClass?: string;
  palaces: ChartPalaceInput[];
}

export interface DailyScoreCategory {
  score: number;
}

export interface DailyFortuneRecord {
  date: string;
  dailyGanZhi?: string;
  scores?: {
    letou?: DailyScoreCategory;
    piancai?: DailyScoreCategory;
    shangji?: DailyScoreCategory;
    taohua?: DailyScoreCategory;
    guiren?: DailyScoreCategory;
  };
}

export interface QizhengPlanetItem {
  chinese: string;
  branch: string;
  degreeFormatted: string;
}

export interface AstrolabeFourGridChartsProps {
  clientName?: string;
  birthday?: string;
  astrolabe: ChartAstrolabeInput;
  allDays?: DailyFortuneRecord[];
  planets?: QizhengPlanetItem[];
  onSelectDate?: (date: string) => void;
}

type ChartJsConstructor = new (
  ctx: CanvasRenderingContext2D,
  config: Record<string, unknown>,
) => { destroy: () => void };

declare global {
  interface Window {
    Chart?: ChartJsConstructor;
  }
}

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

const WHEEL_COLORS = [
  '#38bdf8', '#818cf8', '#a78bfa', '#c084fc',
  '#e879f9', '#f472b6', '#fb7185', '#f87171',
  '#fb923c', '#fbbf24', '#facc15', '#a3e635',
];

const ELEMENT_DETAILS = [
  { name: '木 (Wood)', organ: '肝膽', emotion: '怒/志', herb: '柴胡、薄荷、降真香', advice: '宜疏肝理氣，保持作息規律，忌抑鬱憋悶。' },
  { name: '火 (Fire)', organ: '心、小腸', emotion: '喜/躁', herb: '遠志、酸棗仁、鬱金', advice: '宜清心安神，水火既濟，午間宜靜坐閉目。' },
  { name: '土 (Earth)', organ: '脾胃', emotion: '思/憂', herb: '蒼朮、白芷、砂仁', advice: '宜溫中醒脾，避免冰冷生冷，養中焦氣血化生之源。' },
  { name: '金 (Metal)', organ: '肺、大腸', emotion: '悲/魄', herb: '白芷、辛夷、檀香', advice: '宜宣肅肺氣，深呼吸或晨起行氣，提升決策魄力。' },
  { name: '水 (Water)', organ: '腎、膀胱', emotion: '恐/智', herb: '沉香（虛熱）或公丁香（水寒）', advice: '宜固本培元，藏精納氣，養生長壽與深層智慧之源。' },
] as const;

export function computeFiveElementsRadarScores(astrolabe: ChartAstrolabeInput) {
  const fiveClass = astrolabe.fiveElementsClass || '土五局';
  const scores = { 木: 50, 火: 50, 土: 50, 金: 50, 水: 50 };

  if (fiveClass.includes('木')) scores.木 += 35;
  if (fiveClass.includes('火')) scores.火 += 35;
  if (fiveClass.includes('土')) scores.土 += 35;
  if (fiveClass.includes('金')) scores.金 += 35;
  if (fiveClass.includes('水')) scores.水 += 35;

  astrolabe.palaces.forEach((p) => {
    (p.majorStars || []).forEach((s) => {
      if (['貪狼', '天機', '贪狼', '天机'].includes(s.name)) scores.木 += 10;
      if (['太陽', '廉貞', '太阳', '廉贞'].includes(s.name)) scores.火 += 10;
      if (['紫微', '天府', '天梁', '祿存', '禄存'].includes(s.name)) scores.土 += 10;
      if (['武曲', '七殺', '七杀'].includes(s.name)) scores.金 += 10;
      if (['太陰', '天同', '破軍', '太阴', '破军'].includes(s.name)) scores.水 += 10;
    });
  });

  return scores;
}

export function computeMonthlyTrendSeries(allDays: DailyFortuneRecord[] = []) {
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const compositeScores = new Array<number>(12).fill(0);
  const piancaiScores = new Array<number>(12).fill(0);
  const taohuaScores = new Array<number>(12).fill(0);
  const shangjiScores = new Array<number>(12).fill(0);
  const dayCounts = new Array<number>(12).fill(0);

  allDays.forEach((d) => {
    const m = parseInt(d.date.split('-')[1], 10) - 1;
    if (m >= 0 && m < 12) {
      dayCounts[m]++;
      const sc = d.scores || {};
      const pc = sc.piancai ? sc.piancai.score : 0;
      const th = sc.taohua ? sc.taohua.score : 0;
      const sj = sc.shangji ? sc.shangji.score : 0;
      const lt = sc.letou ? sc.letou.score : 0;
      piancaiScores[m] += pc;
      taohuaScores[m] += th;
      shangjiScores[m] += sj;
      compositeScores[m] += (pc + th + sj + lt) / 4;
    }
  });

  for (let i = 0; i < 12; i++) {
    const cnt = dayCounts[i] || 1;
    compositeScores[i] = Math.round((compositeScores[i] / cnt) * 10) / 10;
    piancaiScores[i] = Math.round((piancaiScores[i] / cnt) * 10) / 10;
    taohuaScores[i] = Math.round((taohuaScores[i] / cnt) * 10) / 10;
    shangjiScores[i] = Math.round((shangjiScores[i] / cnt) * 10) / 10;
  }

  return { months, compositeScores, piancaiScores, taohuaScores, shangjiScores };
}

export default function AstrolabeFourGridCharts({
  clientName = '客戶',
  birthday = '1900-01-01',
  astrolabe,
  allDays = [],
  planets = [],
  onSelectDate,
}: AstrolabeFourGridChartsProps) {
  const zodiacCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const monthlyCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [selectedPalaceIdx, setSelectedPalaceIdx] = useState<number | null>(null);
  const [selectedElementIdx, setSelectedElementIdx] = useState<number | null>(null);

  const palaceDetails = useMemo(() => {
    return BRANCHES.map((b) => {
      const p = astrolabe.palaces.find((item) => item.earthlyBranch === b);
      const pName = p ? p.name : '宮位';
      const majors = p ? (p.majorStars || []).map((s) => s.name).join(' ') : '';
      const minors = p ? (p.minorStars || []).map((s) => s.name).join(' ') : '';
      const inPlanets = planets.filter((pl) => pl.branch === b);
      const planetText = inPlanets.map((pl) => `${pl.chinese} (${pl.degreeFormatted})`).join(', ');
      return {
        branch: b,
        palaceName: pName,
        label: `${b}宮 · ${pName}`,
        majors: majors || '無主星',
        minors: minors || '無吉凶星',
        changsheng: p?.changsheng12 || '—',
        planets: planetText || '無主要天體',
      };
    });
  }, [astrolabe, planets]);

  useEffect(() => {
    const ChartCtor = typeof window !== 'undefined' ? window.Chart : undefined;
    if (!ChartCtor) return;

    const instances: { destroy: () => void }[] = [];

    if (zodiacCanvasRef.current) {
      const ctx = zodiacCanvasRef.current.getContext('2d');
      if (ctx) {
        const labels = palaceDetails.map((d) => d.label);
        instances.push(
          new ChartCtor(ctx, {
            type: 'doughnut',
            data: {
              labels,
              datasets: [
                {
                  data: new Array(12).fill(1),
                  backgroundColor: WHEEL_COLORS,
                  borderColor: '#0f172a',
                  borderWidth: 2,
                  hoverOffset: 12,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              cutout: '45%',
              plugins: {
                legend: { display: false },
              },
              onClick: (_event: unknown, elements: { index: number }[]) => {
                if (elements && elements.length > 0) {
                  setSelectedPalaceIdx(elements[0].index);
                }
              },
            },
          }),
        );
      }
    }

    if (radarCanvasRef.current) {
      const ctx = radarCanvasRef.current.getContext('2d');
      if (ctx) {
        const scores = computeFiveElementsRadarScores(astrolabe);
        instances.push(
          new ChartCtor(ctx, {
            type: 'radar',
            data: {
              labels: ['木 (Wood)', '火 (Fire)', '土 (Earth)', '金 (Metal)', '水 (Water)'],
              datasets: [
                {
                  label: '五行能量指數',
                  data: [scores.木, scores.火, scores.土, scores.金, scores.水],
                  backgroundColor: 'rgba(56, 189, 248, 0.25)',
                  borderColor: '#38bdf8',
                  borderWidth: 2,
                  pointBackgroundColor: '#facc15',
                  pointBorderColor: '#fff',
                  pointHoverRadius: 6,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              onClick: (_event: unknown, elements: { index: number }[]) => {
                if (elements && elements.length > 0) {
                  setSelectedElementIdx(elements[0].index);
                }
              },
            },
          }),
        );
      }
    }

    if (monthlyCanvasRef.current) {
      const ctx = monthlyCanvasRef.current.getContext('2d');
      if (ctx) {
        const series = computeMonthlyTrendSeries(allDays);
        instances.push(
          new ChartCtor(ctx, {
            type: 'line',
            data: {
              labels: series.months,
              datasets: [
                {
                  label: '綜合運勢 (Composite)',
                  data: series.compositeScores,
                  borderColor: '#f59e0b',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  tension: 0.35,
                  fill: true,
                },
                {
                  label: '偏財運勢 (Piancai)',
                  data: series.piancaiScores,
                  borderColor: '#10b981',
                  tension: 0.35,
                },
                {
                  label: '桃花運勢 (Taohua)',
                  data: series.taohuaScores,
                  borderColor: '#f43f5e',
                  tension: 0.35,
                },
                {
                  label: '商機運勢 (Shangji)',
                  data: series.shangjiScores,
                  borderColor: '#6366f1',
                  tension: 0.35,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
            },
          }),
        );
      }
    }

    return () => {
      instances.forEach((inst) => inst.destroy());
    };
  }, [astrolabe, allDays, palaceDetails]);

  const selectedPalace =
    selectedPalaceIdx !== null ? palaceDetails[selectedPalaceIdx] : null;
  const selectedElement =
    selectedElementIdx !== null ? ELEMENT_DETAILS[selectedElementIdx] : null;

  return (
    <div className="space-y-6">
      <div className="text-sm font-medium text-slate-300">
        當前客戶：{clientName} ({birthday}) · 七政四餘 × 十二宮能量 × 全年 365 天走勢
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 1. 十二宫圆盘图 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="mb-3 text-base font-semibold text-sky-400">十二宮圓盤與七政四餘</h3>
          <div className="relative h-64">
            <canvas ref={zodiacCanvasRef} id="chartZodiacWheel" />
          </div>
          {selectedPalace && (
            <div className="mt-3 rounded-md border border-sky-400 bg-slate-900/90 p-2.5 text-xs text-slate-300">
              <h4 className="mb-1 font-semibold text-yellow-400">
                🪐 {selectedPalace.branch}宮 · {selectedPalace.palaceName} 【主星：{selectedPalace.majors}】
              </h4>
              <p>
                <strong>吉星/凶煞：</strong>
                {selectedPalace.minors} · <strong>長生十二神：</strong>
                {selectedPalace.changsheng}
              </p>
              <p className="text-sky-400">
                <strong>七政四餘天體坐落：</strong>
                {selectedPalace.planets}
              </p>
            </div>
          )}
        </div>

        {/* 2. 五行能量雷达图 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="mb-3 text-base font-semibold text-purple-400">本命五行能量雷達圖</h3>
          <div className="relative h-64">
            <canvas ref={radarCanvasRef} id="chartFiveElements" />
          </div>
          {selectedElement && (
            <div className="mt-3 rounded-md border border-purple-500 bg-slate-900/90 p-2.5 text-xs text-slate-300">
              <h4 className="mb-1 font-semibold text-yellow-400">
                ☯️ {selectedElement.name} · 臟腑：{selectedElement.organ}（對應情緒：{selectedElement.emotion}）
              </h4>
              <p>
                <strong>調養配方：</strong>
                {selectedElement.herb}
              </p>
              <p className="text-purple-400">
                <strong>能量指引：</strong>
                {selectedElement.advice}
              </p>
            </div>
          )}
        </div>

        {/* 3. 12个月运势折线图 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="mb-3 text-base font-semibold text-amber-400">全年 12 個月運勢曲線</h3>
          <div className="relative h-64">
            <canvas ref={monthlyCanvasRef} id="chartMonthlyTrend" />
          </div>
        </div>

        {/* 4. 全年 365 天流日热力图 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="mb-3 text-base font-semibold text-emerald-400">全年 365 天流日熱力圖</h3>
          <div id="yearHeatmapGrid" className="flex flex-wrap gap-1">
            {allDays.map((d) => {
              const sc = d.scores || {};
              const sum =
                (sc.letou?.score ?? 0) +
                (sc.piancai?.score ?? 0) +
                (sc.shangji?.score ?? 0) +
                (sc.taohua?.score ?? 0) +
                (sc.guiren?.score ?? 0);
              let lvl = 0;
              if (sum >= 45) lvl = 5;
              else if (sum >= 35) lvl = 4;
              else if (sum >= 25) lvl = 3;
              else if (sum >= 15) lvl = 2;
              else if (sum >= 5) lvl = 1;

              return (
                <button
                  key={d.date}
                  type="button"
                  data-date={d.date}
                  title={`${d.date} (${d.dailyGanZhi || ''}日) 綜合總分: ${sum}`}
                  onClick={() => onSelectDate?.(d.date)}
                  className={`heatmap-day-cell lvl-${lvl} h-3 w-3 rounded-sm`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
