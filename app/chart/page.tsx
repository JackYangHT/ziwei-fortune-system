'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import BirthForm, { type BirthFormState } from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import ChartSidePanel from '@/components/ChartSidePanel';
import InsightPanel from '@/components/InsightPanel';
import ApiKeyModal from '@/components/ApiKeyModal';
import ProfileLibraryDropdown from '@/components/ProfileLibraryDropdown';
import TimeNav, { type TimeView } from '@/components/TimeNav';
import { generateChart } from '@/lib/ziwei/algorithm';
import { computeBazi } from '@/lib/bazi/chart';
import type { BirthInfo, ZiweiChart, Palace } from '@/lib/ziwei/types';
import {
  generateProfileId,
  getActiveProfileName,
  loadProfile,
  saveProfile,
  setActiveProfileName,
  type Profile,
  type ProfileMessage,
} from '@/lib/profile-storage';

interface DuplicatePromptState {
  existing: Profile;
  incomingBirthInfo: BirthInfo;
  incomingForm?: BirthFormState;
}

/**
 * 命盘页 —— 紫微斗数排盘 + 八字/飞星推演 + 高维辨证问诊 + 本机私密多档案库
 */
export default function ChartPage() {
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePromptState | null>(null);
  const [savedForm, setSavedForm] = useState<BirthFormState | undefined>(undefined);
  const [showRechartForm, setShowRechartForm] = useState(false);
  const [chartKey, setChartKey] = useState(0);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [view, setView] = useState<TimeView>('mingpan');
  const [liunianYear, setLiunianYear] = useState(() => new Date().getFullYear());
  const [rightMode, setRightMode] = useState<'sidePanel' | 'ai' | 'both'>('ai');

  const handlePalaceSelect = useCallback((palace: Palace) => {
    setSelectedPalace(palace);
  }, []);

  /** 加载已保存的本地档案（含命盘、八字与完整对话记录） */
  const applyLoadedProfile = useCallback((profile: Profile) => {
    setActiveProfile(profile);
    setActiveProfileName(profile.name);
    setChart(profile.chartData);
    if (profile.birthInfo.formSnapshot) {
      setSavedForm(profile.birthInfo.formSnapshot);
    }
    setSelectedPalace(null);
    setView('mingpan');
    setShowRechartForm(false);
    setDuplicatePrompt(null);
    setChartKey(k => k + 1);
  }, []);

  /** 执行新排盘（并在有姓名时保存到本机 IndexedDB） */
  const createAndOpenChart = useCallback(
    async (info: BirthInfo, formSnapshot?: BirthFormState, overwriteExistingId?: string) => {
      const nextChart = generateChart(info);
      const baziData = computeBazi({
        chart: nextChart,
        gender: info.gender === 'male' ? 'M' : 'F',
        referenceYear: new Date().getFullYear(),
      });

      const cleanName =
        info.name?.trim() ||
        `命主（${info.year}-${info.month}-${info.day} ${info.gender === 'male' ? '男' : '女'}）`;
      const now = Date.now();
      const saved = await saveProfile({
        id: overwriteExistingId || generateProfileId(),
        name: cleanName,
        birthInfo: {
          ...info,
          name: cleanName,
          ...(formSnapshot ? { formSnapshot } : {}),
        },
        chartData: nextChart,
        baziData,
        messages: [],
        createdAt: now,
        updatedAt: now,
      });
      setActiveProfile(saved);
      setActiveProfileName(saved.name);

      setChart(nextChart);
      setSelectedPalace(null);
      setView('mingpan');
      setShowRechartForm(false);
      setDuplicatePrompt(null);
      setChartKey(k => k + 1);
    },
    [],
  );

  /** 提交起盘：先检测本机是否已有同名档案 */
  const handleGenerateChart = useCallback(
    async (info: BirthInfo) => {
      const cleanName = info.name?.trim() || '';
      if (cleanName) {
        const existing = await loadProfile(cleanName);
        if (existing) {
          setDuplicatePrompt({
            existing,
            incomingBirthInfo: info,
            incomingForm: savedForm,
          });
          return;
        }
      }
      await createAndOpenChart(info, savedForm);
    },
    [createAndOpenChart, savedForm],
  );

  /** 当从首页「我的命盘库」跳转携带 ?profile=... 时自动加载该档案 */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const targetName = params.get('profile') || getActiveProfileName();
    if (!targetName) return;
    let cancelled = false;
    loadProfile(targetName).then(found => {
      if (!cancelled && found) {
        applyLoadedProfile(found);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [applyLoadedProfile]);

  /** 每次 AI 回复完成后自动持久化对话记录到当前档案 */
  const handleMessagesChange = useCallback(
    (nextMessages: ProfileMessage[]) => {
      setActiveProfile(prev => {
        if (!prev) return prev;
        const updated: Profile = {
          ...prev,
          messages: nextMessages,
          updatedAt: Date.now(),
        };
        saveProfile(updated).catch(() => {
          // 忽略偶发存储异常，避免打断对话
        });
        return updated;
      });
    },
    [],
  );

  const handleDeletedProfile = useCallback((deletedName: string) => {
    setActiveProfile(prev => (prev?.name === deletedName ? null : prev));
  }, []);

  /** 同名档案冲突弹窗 */
  const duplicateModal = duplicatePrompt && (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl"
        style={{
          background: 'var(--bg-0, #0c1220)',
          border: '1px solid rgba(212,168,67,0.35)',
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--ac, #d4a843)', fontSize: 16 }}>✦</span>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--tx-0)' }}>
            檢測到已有本機檔案
          </h2>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--tx-2)' }}>
          檢測到已有 <strong style={{ color: 'var(--ac)' }}>【{duplicatePrompt.existing.name}】</strong> 的檔案
          （{duplicatePrompt.existing.birthInfo.year}年{duplicatePrompt.existing.birthInfo.month}月
          {duplicatePrompt.existing.birthInfo.day}日 · 共{' '}
          {duplicatePrompt.existing.messages.filter(m => !m.hidden).length} 則對話紀錄），
          請問是要「載入歷史紀錄與命盤」還是「覆蓋並重新起盤」？
        </p>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={() => applyLoadedProfile(duplicatePrompt.existing)}
            className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold cursor-pointer border-none"
            style={{
              background: 'linear-gradient(135deg, #9a6210, #c88020)',
              color: '#fff8e8',
            }}
          >
            載入歷史紀錄與命盤
          </button>
          <button
            type="button"
            onClick={() =>
              createAndOpenChart(
                duplicatePrompt.incomingBirthInfo,
                duplicatePrompt.incomingForm,
                duplicatePrompt.existing.id,
              )
            }
            className="flex-1 py-2.5 px-3 rounded-xl text-xs font-medium cursor-pointer"
            style={{
              background: 'rgba(212,168,67,0.1)',
              border: '1px solid rgba(212,168,67,0.35)',
              color: 'var(--ac)',
            }}
          >
            覆蓋並重新起盤
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDuplicatePrompt(null)}
          className="w-full py-1.5 text-[11px] cursor-pointer bg-transparent border-none"
          style={{ color: 'var(--tx-3)' }}
        >
          取消
        </button>
      </div>
    </div>
  );

  // ── 未起盤：展示出生資訊表單 ──
  if (!chart) {
    return (
      <main
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '32px 16px calc(48px + env(safe-area-inset-bottom, 0px))',
          minHeight: '100dvh',
        }}
      >
        {duplicateModal}
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs no-underline"
              style={{ color: 'var(--tx-3)' }}
            >
              ‹ 首頁
            </Link>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--tx-0)' }}>紫微斗數排盤</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ProfileLibraryDropdown
              activeProfileName={activeProfile?.name}
              onSelectProfile={applyLoadedProfile}
              onDeletedProfile={handleDeletedProfile}
            />
            <Link
              href="/heming"
              className="text-xs px-3 py-1.5 rounded-lg no-underline"
              style={{
                border: '1px solid var(--bdr-med)',
                color: 'var(--tx-2)',
              }}
            >
              雙人合盤
            </Link>
            <ApiKeyModal />
          </div>
        </div>
        <p style={{ color: 'var(--tx-3, #888)', marginBottom: 24, fontSize: 13, lineHeight: 1.7 }}>
          輸入出生年月日時，即時生成紫微命盤、四柱八字與欽天飛星磁場。填寫姓名後，命盤與 AI 問診紀錄將自動私密保存在本機瀏覽器中。
        </p>
        <BirthForm
          initialData={savedForm}
          onFormSave={setSavedForm}
          onSubmit={handleGenerateChart}
        />
      </main>
    );
  }

  // ── 已起盤：命盤 + 右側面板（八字盤 / 磁場化 / 命中規則 / AI問診） ──
  return (
    <main
      style={{
        maxWidth: 1320,
        margin: '0 auto',
        padding: '20px 14px calc(28px + env(safe-area-inset-bottom, 0px))',
        minHeight: '100dvh',
      }}
    >
      {duplicateModal}

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setChart(null);
            setActiveProfile(null);
            setActiveProfileName(null);
            setSelectedPalace(null);
            setView('mingpan');
            setShowRechartForm(false);
          }}
          style={{
            padding: '6px 12px', cursor: 'pointer',
            border: '1px solid var(--bdr-med, #ccc)', borderRadius: 8, background: 'transparent',
            color: 'var(--tx-1, inherit)', fontSize: 12,
          }}
        >
          ← 重新起盤
        </button>
        <button
          type="button"
          onClick={() => setShowRechartForm(prev => !prev)}
          style={{
            padding: '6px 12px', cursor: 'pointer',
            border: '1px solid rgba(212,168,67,0.4)', borderRadius: 8,
            background: showRechartForm ? 'rgba(212,168,67,0.18)' : 'rgba(212,168,67,0.08)',
            color: 'var(--ac, #d4a843)', fontSize: 12, fontWeight: 500,
          }}
        >
          {showRechartForm ? '✕ 收起生辰表單' : '✎ 修改生辰'}
        </button>
        {activeProfile && (
          <span
            className="text-[11px] px-2.5 py-1 rounded-full"
            style={{
              background: 'rgba(212,168,67,0.10)',
              border: '1px solid rgba(212,168,67,0.28)',
              color: 'var(--ac)',
            }}
          >
            目前檔案：{activeProfile.name}（本機已存）
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <ProfileLibraryDropdown
            activeProfileName={activeProfile?.name}
            onSelectProfile={applyLoadedProfile}
            onDeletedProfile={handleDeletedProfile}
          />
          <Link
            href="/heming"
            className="text-xs px-2.5 py-1.5 rounded-lg no-underline"
            style={{
              border: '1px solid var(--bdr-med)',
              color: 'var(--tx-2)',
            }}
          >
            合盤
          </Link>
          <ApiKeyModal />
        </div>
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
        {/* 左側：紫微命盤 */}
        <ChartBoard
          key={`board-${chartKey}`}
          chart={chart}
          view={view}
          liunianYear={liunianYear}
          onViewChange={setView}
          onYearChange={setLiunianYear}
          onPalaceSelect={handlePalaceSelect}
        />

        {/* 右側：寬度 400px（桌面端），移動端自適應 dvh 高度 */}
        <div className="w-full lg:w-[400px] space-y-3">
          {/* 頂層切換欄 */}
          <div
            className="flex items-center rounded-xl p-1 gap-1"
            style={{
              background: 'var(--bg-1)',
              border: '1px solid var(--bdr-med)',
            }}
          >
            <button
              type="button"
              onClick={() => setRightMode('ai')}
              className="flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-medium transition-all"
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
              AI 辨證問診
            </button>
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
              八字／磁場／規則
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
              title="同時展開推演面板與 AI 問診"
            >
              同屏展開
            </button>
          </div>

          {/* AI 问诊面板（移动端采用 dvh 动态高度，避免键盘弹出时跳动） */}
          <div
            className={
              rightMode === 'sidePanel'
                ? 'hidden'
                : 'block h-[72dvh] min-h-[420px] max-h-[680px] lg:h-[560px]'
            }
          >
            <InsightPanel
              key={`insight-${chartKey}-${activeProfile?.id ?? 'anon'}`}
              chart={chart}
              selectedPalace={selectedPalace}
              initialMessages={activeProfile?.messages}
              onMessagesChange={handleMessagesChange}
              profileName={activeProfile?.name}
            />
          </div>

          {/* 八字盘 + 磁场化 + 命中规则面板 */}
          <div className={rightMode === 'ai' ? 'hidden' : 'block'}>
            <ChartSidePanel
              key={`side-${chartKey}`}
              chart={chart}
              referenceYear={liunianYear}
              initialBazi={activeProfile?.baziData}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
