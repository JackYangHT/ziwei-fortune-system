'use client';
import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import BirthForm, { type BirthFormState } from '@/components/BirthForm';
import ApiKeyModal from '@/components/ApiKeyModal';
import { formToBirthInfo } from '@/lib/ziwei/share';
import { generateChart as buildChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart } from '@/lib/ziwei/types';
import { useTheme } from '@/components/ThemeProvider';
import {
  HEMING_RELATION_TYPES,
  HEMING_RELATION_FOCUS,
  type HemingRelationType,
  buildHemingChatMessages,
  loadClientAiSettings,
  streamDirectClientAi,
} from '@/lib/ai-client';

const RELATION_QUICK_QUESTIONS: Record<HemingRelationType, string[]> = {
  '夫妻/伴侶': [
    '我們彼此的感情契合度如何？',
    '我們步入婚姻或長期同居合適嗎？',
    '在相處上我最容易在哪裡感到委屈或內耗？',
    '我該如何滋養彼此的感情磁場、守好邊界？',
  ],
  '父母/長輩': [
    '我與父母／長輩之間最核心的因果課題是什麼？',
    '為什麼互動時我常感到壓力或愧疚？',
    '我該如何在孝順與自我邊界間找到平衡？',
    '近期我與長輩相處最需要注意什麼？',
  ],
  '兄弟姊妹': [
    '我與手足之間是互相扶持，還是容易產生內耗？',
    '家庭資源與責任分工上，我有什麼需要注意的？',
    '如何化解彼此的比較心理或心結？',
    '我們適合一起合作或共同置產嗎？',
  ],
  '合夥人/同事': [
    '我與對方適合合夥創業或深度共事嗎？',
    '從人盤與財官飛化來看，我們各自適合負責什麼角色？',
    '利益分配與權責底線最容易在哪裡出問題？',
    '今年合作的關鍵機遇與我必須守住的避坑點是什麼？',
  ],
  '朋友': [
    '對方對我而言是彼此滋養的貴人緣嗎？',
    '我們相處中最容易產生誤會或單向消耗的地方在哪？',
    '我該如何拿捏舒服的社交距離與善良底線？',
    '我們在事業或生活上能互相帶旺嗎？',
  ],
};

// ─── AiContent 渲染器（与 InsightPanel 一致）────────────────
function AiContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {lines.map((line, i) => {
        const sectionMatch = line.match(/^\*\*【(.+?)】\*\*$/);
        if (sectionMatch) {
          return (
            <div key={i} style={{ paddingTop: i === 0 ? 0 : '14px', paddingBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ac)', letterSpacing: '0.04em' }}>
                【{sectionMatch[1]}】
              </span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} style={{ height: '4px' }} />;
        const parts = line.split(/\*\*(.+?)\*\*/);
        return (
          <div key={i} style={{ fontSize: '13px', lineHeight: 1.75, color: 'var(--tx-2)' }}>
            {parts.map((part, j) =>
              j % 2 === 0
                ? part
                : <strong key={j} style={{ fontWeight: 500, color: 'var(--tx-0)' }}>{part}</strong>
            )}
          </div>
        );
      })}
      {streaming && (
        <span style={{
          display: 'inline-block', width: '7px', height: '13px',
          background: 'var(--ac)', opacity: 0.5, borderRadius: '2px',
          animation: 'pulse 1s ease-in-out infinite',
          verticalAlign: 'middle', marginLeft: '2px',
        }} />
      )}
    </div>
  );
}

export default function HemingPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // ─── 双方命盘状态 ─────────────────────────────────────────
  const [chartA, setChartA] = useState<ZiweiChart | null>(null);
  const [chartB, setChartB] = useState<ZiweiChart | null>(null);
  // 双方表单状态由 BirthForm onFormSave 同步到此处，统一按钮触发起盘
  const [formA, setFormA] = useState<BirthFormState | null>(null);
  const [formB, setFormB] = useState<BirthFormState | null>(null);

  // ─── AI 合盤分析狀態 ─────────────────────────────────────
  const [relationType, setRelationType] = useState<HemingRelationType>('夫妻/伴侶');
  const [analysis, setAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [question, setQuestion] = useState('');
  const [analysisError, setAnalysisError] = useState(false);
  // 开源版不含 /api/heming：接口 404 时单独说明，而不是让用户反复重试
  const [apiMissing, setApiMissing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const analysisRef = useRef<HTMLDivElement>(null);

  // ─── 起盘（单次调用，返回 chart 给统一流程使用）──────────
  // 开源版不含后端 /api/generate：直接用本仓库的排盘引擎在浏览器里起盘
  const generateChart = useCallback(async (info: BirthInfo): Promise<ZiweiChart | null> => {
    try {
      return buildChart(info);
    } catch {
      return null;
    }
  }, []);

  // 表单是否填齐
  const isFormReady = (f: BirthFormState | null): boolean =>
    !!(f && f.year && f.month && f.day && f.gender && (f.unknownTime || (f.clockHour !== '' && f.clockMinute !== '')));

  // ─── 统一入口：起盘 + 合盘分析 ─────────────────────────────
  const runAnalysis = useCallback(async (q?: string) => {
    const activeRelation: HemingRelationType =
      typeof relationType !== 'undefined' ? relationType : '夫妻/伴侶';
    setFormError(null);
    if (!isFormReady(formA) || !isFormReady(formB)) {
      setFormError('請先填寫甲方（您本人）與乙方（對方）的完整出生資訊');
      return;
    }
    setAnalyzing(true);
    setAnalysis('');
    setAnalysisError(false);

    try {
      // 每次按当前表单起盘，避免编辑出生信息后复用旧盘。
      const [cA, cB] = await Promise.all([
        generateChart(formToBirthInfo(formA!)),
        generateChart(formToBirthInfo(formB!)),
      ]);
      if (!cA || !cB) {
        setAnalysisError(true);
        setAnalyzing(false);
        return;
      }
      setChartA(cA);
      setChartB(cB);

      const clientSettings = typeof loadClientAiSettings === 'function' ? loadClientAiSettings() : null;
      let usedServer = false;

      try {
        const res = await fetch('/api/heming', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chartA: cA,
            chartB: cB,
            relationType: activeRelation,
            question: q ?? undefined,
            ...(clientSettings?.apiKey ? { aiConfig: clientSettings } : {}),
          }),
        });
        const ct = res.headers?.get?.('content-type') ?? 'text/event-stream';
        if (res.ok && res.body && ct.includes('text/event-stream')) {
          usedServer = true;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let text = '';
          let pendingLine = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            pendingLine += decoder.decode(value, { stream: true });
            const lines = pendingLine.split('\n');
            pendingLine = lines.pop() ?? '';
            for (const rawLine of lines) {
              const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const delta = JSON.parse(data).delta?.text ?? '';
                text += delta;
                setAnalysis(text);
              } catch { /* skip */ }
            }
          }
        }
      } catch {
        // 靜態託管無後端時回退至瀏覽器直連
      }

      if (!usedServer) {
        if (!clientSettings?.apiKey || typeof buildHemingChatMessages !== 'function' || typeof streamDirectClientAi !== 'function') {
          setApiMissing(true);
          throw new Error('api-missing');
        }
        const chatMessages = buildHemingChatMessages(cA, cB, q, activeRelation);
        await streamDirectClientAi(chatMessages, clientSettings, (_delta, fullText) => {
          setAnalysis(fullText);
        });
      }

      // scroll to analysis
      setTimeout(() => analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch {
      setAnalysisError(true);
    } finally {
      setAnalyzing(false);
    }
  }, [formA, formB, generateChart, typeof relationType !== 'undefined' ? relationType : '夫妻/伴侶']);

  const cardStyle = {
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(200,160,60,0.2)'}`,
    borderRadius: '16px',
    padding: '24px',
  };

  const labelStyle = {
    fontSize: '11px', letterSpacing: '0.2em', color: 'var(--ac)', opacity: 0.9,
    marginBottom: '16px', display: 'block', fontWeight: 600,
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-0)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {/* 頂欄 */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: isDark ? 'rgba(2,8,16,0.88)' : 'rgba(250,245,235,0.92)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--bdr)',
        display: 'flex', alignItems: 'center', padding: '0 24px', height: '52px', gap: '16px',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px',
            color: 'var(--tx-3)', background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '16px' }}>‹</span>
          <span>返回</span>
        </button>
        <div style={{ width: '1px', height: '20px', background: 'var(--bdr-med)' }} />
        <span style={{ fontSize: '12px', color: 'var(--ac)', letterSpacing: '0.2em' }}>合盤分析</span>
        <div style={{ flex: 1 }} />
        <span className="hidden sm:inline" style={{ fontSize: '11px', color: 'var(--tx-3)' }}>夫妻 · 父母 · 手足 · 合夥 · 朋友</span>
        <ApiKeyModal />
      </header>

      {/* 主體 */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* 標題 */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '28px', color: 'var(--ac)', opacity: 0.15, marginBottom: '12px' }}>☯</div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '0.15em', color: 'var(--tx-0)', marginBottom: '8px' }}>
            紫微多維人盤合盤
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--tx-3)', lineHeight: 1.6 }}>
            請在<strong>甲方（A）</strong>填入您本人資料、<strong>乙方（B）</strong>填入對方資料，系統將結合「人盤太歲入卦＋關係立太極轉宮＋飛星四化」以繁體中文為您辨證合盤
          </p>
        </div>

        {/* 關係類型選擇器 */}
        <div style={{ ...cardStyle, marginBottom: '20px', padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', letterSpacing: '0.25em', color: 'var(--ac)', fontWeight: 600 }}>
              關係類型 · RELATIONSHIP
            </span>
            <span style={{ fontSize: '11px', color: 'var(--tx-3)' }}>
              目前視角：甲方（您）與 <strong style={{ color: 'var(--tx-0)' }}>【{relationType}】</strong>（乙方）
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {HEMING_RELATION_TYPES.map(rel => {
              const active = relationType === rel;
              return (
                <button
                  key={rel}
                  type="button"
                  onClick={() => setRelationType(rel)}
                  disabled={analyzing}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--r-pill)',
                    fontSize: '12px',
                    fontWeight: active ? 600 : 400,
                    cursor: analyzing ? 'not-allowed' : 'pointer',
                    background: active ? 'rgba(212,168,67,0.18)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(212,168,67,0.55)' : 'var(--bdr-med)'}`,
                    color: active ? 'var(--ac)' : 'var(--tx-2)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {rel}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--tx-3)', lineHeight: 1.6 }}>
            ✦ 人盤與飛星側重：{HEMING_RELATION_FOCUS[relationType]}
          </div>
        </div>

        {/* 雙欄表單 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}
          className="heming-grid">
          {/* 甲方（用戶本人） */}
          <div style={cardStyle}>
            <span style={labelStyle}>甲方（A）— 用戶本人（我）</span>
            <BirthForm
              hideSubmit
              onSubmit={() => {}}
              onFormSave={setFormA}
            />
          </div>

          {/* 乙方（對方） */}
          <div style={cardStyle}>
            <span style={labelStyle}>乙方（B）— 對方（我的{relationType}）</span>
            <BirthForm
              hideSubmit
              onSubmit={() => {}}
              onFormSave={setFormB}
            />
          </div>
        </div>

        {/* ═══ 大合盤分析框（視覺中心，始終顯示）════════════════ */}
        <div ref={analysisRef} style={{
          ...cardStyle,
          minHeight: '320px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: (!analysis && !analyzing) ? 'center' : 'flex-start',
        }}>
          {/* 區塊標題 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: (analysis || analyzing) ? '20px' : '24px' }}>
            <span style={{ color: 'var(--ac)', opacity: 0.6 }}>◉</span>
            <span style={{ fontSize: '11px', letterSpacing: '0.25em', color: 'var(--tx-3)' }}>人盤＋飛星合盤分析 · {relationType}</span>
          </div>

          {/* 狀態分支 */}
          {!analysis && !analyzing && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: '13px', color: 'var(--tx-3)', marginBottom: '24px', lineHeight: 1.7 }}>
                填好甲方（您本人）與乙方（對方）出生資訊並選定關係類型後，點擊下方按鈕<br />
                高維導師將從您作為甲方的視角，結合人盤與飛星深度辨證「<strong style={{ color: 'var(--tx-1)' }}>{relationType}</strong>」磁場
              </div>
              <button
                onClick={() => runAnalysis()}
                style={{
                  padding: '14px 40px', borderRadius: 'var(--r-pill)', border: 'none',
                  background: 'linear-gradient(135deg, #9a6210, #c88020)',
                  color: '#fff8e8', fontSize: '14px', fontWeight: 600,
                  letterSpacing: '0.15em', cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(140,100,20,0.25)',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
              >
                開始【{relationType}】人盤合盤分析
              </button>
              {formError && (
                <div style={{ marginTop: '20px', fontSize: '13px', color: '#dc2626' }}>
                  {formError}
                </div>
              )}
            </div>
          )}

          {analyzing && !analysis && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '40px 0', color: 'var(--tx-3)', fontSize: '13px' }}>
              <div style={{
                width: '14px', height: '14px',
                border: '2px solid var(--bdr-med)', borderTopColor: 'var(--ac)',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              }} />
              正在以您的【{relationType}】人盤與飛星視角比對雙方命盤…
            </div>
          )}

          {analysis && <AiContent text={analysis} streaming={analyzing} />}

          {analysisError && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bdr)', background: 'var(--bg-card)', fontSize: '13px', color: 'var(--tx-2)', marginTop: '12px' }}>
              {apiMissing
                ? '尚未設定 AI API Key。請點擊頁面右上角的「🔑 API 設置」按鈕填入您的 API Key（支援 DeepInfra / DeepSeek / OpenAI 相容介面），儲存後即可直接進行 AI 合盤分析。'
                : '分析暫時無法使用，請檢查右上角「🔑 API 設置」中的金鑰是否正確後重試。'}
            </div>
          )}
        </div>

        {/* ═══ 針對合盤的追問聊天框（僅分析完成後顯示）═══════════ */}
        {analysis && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'var(--tx-3)', marginBottom: '4px' }}>
              針對此次【{relationType}】人盤合盤繼續追問
            </div>

            {/* 快捷問題 */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {RELATION_QUICK_QUESTIONS[relationType].map(q => (
                <button
                  key={q}
                  onClick={() => { setQuestion(q); runAnalysis(q); }}
                  disabled={analyzing}
                  style={{
                    fontSize: '12px', padding: '6px 14px',
                    borderRadius: 'var(--r-pill)',
                    border: '1px solid var(--bdr-med)',
                    background: 'transparent', color: 'var(--tx-2)',
                    cursor: analyzing ? 'not-allowed' : 'pointer',
                    opacity: analyzing ? 0.5 : 1,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => { if (!analyzing) (e.currentTarget as HTMLElement).style.borderColor = 'var(--ac-bdr)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bdr-med)'; }}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* 輸入框 + 追問按鈕 */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !analyzing) runAnalysis(question || undefined); }}
                onFocus={e => {
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    const el = e.currentTarget;
                    window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 260);
                  }
                }}
                placeholder={`針對您與【${relationType}】的關係繼續追問…`}
                disabled={analyzing}
                className="input-base"
                style={{ fontSize: '13px', flex: 1, scrollMarginBottom: '140px' }}
              />
              <button
                onClick={() => runAnalysis(question || undefined)}
                disabled={analyzing}
                style={{
                  padding: '10px 20px', borderRadius: 'var(--r-sm)', border: 'none',
                  background: analyzing ? 'var(--bg-2)' : 'var(--tx-0)',
                  color: analyzing ? 'var(--tx-3)' : 'white',
                  fontSize: '13px', fontWeight: 500,
                  cursor: analyzing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
              >
                {analyzing ? '分析中…' : '繼續追問'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 680px) {
          .heming-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
