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
  '夫妻/伴侣': [
    '感情匹配度如何？',
    '两人结婚是否合适？',
    '哪方面最容易产生矛盾？',
    '如何滋养彼此的感情磁场？',
  ],
  '父母/长辈': [
    '我们之间最核心的因果课题是什么？',
    '为什么沟通时容易感到压力或愧疚？',
    '如何在孝顺与自我边界间找到平衡？',
    '近期长辈与我的相处需要注意什么？',
  ],
  '兄弟姊妹': [
    '我们手足之间是互相扶持还是容易内耗？',
    '家庭资源与责任分工上有什么需要注意的？',
    '如何化解彼此的比较心理或心结？',
    '适合一起合作或共同置业吗？',
  ],
  '合伙人/同事': [
    '适合合伙创业吗？',
    '财帛与官禄互动上谁适合主外、谁适合主内？',
    '利益分配与权责底线最容易在哪出问题？',
    '今年合作的关键机遇与避坑点是什么？',
  ],
  '朋友': [
    '这段友情是彼此滋养的贵人缘吗？',
    '相处中最容易产生误会或消耗的地方在哪？',
    '如何拿捏舒服的社交距离与底线？',
    '我们在事业或生活上能互相带旺吗？',
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

  // ─── AI 合盘分析状态 ─────────────────────────────────────
  const [relationType, setRelationType] = useState<HemingRelationType>('夫妻/伴侣');
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
      typeof relationType !== 'undefined' ? relationType : '夫妻/伴侣';
    setFormError(null);
    if (!isFormReady(formA) || !isFormReady(formB)) {
      setFormError('请先填写双方完整出生信息');
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
        // 静态托管无后端时回退至浏览器直连
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
  }, [formA, formB, generateChart, typeof relationType !== 'undefined' ? relationType : '夫妻/伴侣']);

  const cardStyle = {
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(200,160,60,0.2)'}`,
    borderRadius: '16px',
    padding: '24px',
  };

  const labelStyle = {
    fontSize: '10px', letterSpacing: '0.4em', color: 'var(--ac)', opacity: 0.7,
    marginBottom: '16px', display: 'block',
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-0)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {/* 顶栏 */}
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
        <span style={{ fontSize: '12px', color: 'var(--ac)', letterSpacing: '0.2em' }}>合盘分析</span>
        <div style={{ flex: 1 }} />
        <span className="hidden sm:inline" style={{ fontSize: '11px', color: 'var(--tx-3)' }}>夫妻 · 父母 · 手足 · 合伙 · 朋友</span>
        <ApiKeyModal />
      </header>

      {/* 主体 */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* 标题 */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '28px', color: 'var(--ac)', opacity: 0.15, marginBottom: '12px' }}>☯</div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '0.15em', color: 'var(--tx-0)', marginBottom: '8px' }}>
            紫微多维合盘
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--tx-3)', lineHeight: 1.6 }}>
            输入两个人的出生信息并选择双方关系类型，高维导师将从对应宫位视角进行中医辨证与飞星合盘印证
          </p>
        </div>

        {/* 关系类型选择器 */}
        <div style={{ ...cardStyle, marginBottom: '20px', padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', letterSpacing: '0.25em', color: 'var(--ac)', fontWeight: 600 }}>
              关系类型 · RELATIONSHIP
            </span>
            <span style={{ fontSize: '11px', color: 'var(--tx-3)' }}>
              当前视角：<strong style={{ color: 'var(--tx-0)' }}>{relationType}</strong>
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
            ✦ 辨证侧重：{HEMING_RELATION_FOCUS[relationType]}
          </div>
        </div>

        {/* 双栏表单 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}
          className="heming-grid">
          {/* 甲方 */}
          <div style={cardStyle}>
            <span style={labelStyle}>甲方 — A</span>
            <BirthForm
              hideSubmit
              onSubmit={() => {}}
              onFormSave={setFormA}
            />
          </div>

          {/* 乙方 */}
          <div style={cardStyle}>
            <span style={labelStyle}>乙方 — B</span>
            <BirthForm
              hideSubmit
              onSubmit={() => {}}
              onFormSave={setFormB}
            />
          </div>
        </div>

        {/* ═══ 大合盘分析框（视觉中心，始终显示）════════════════ */}
        <div ref={analysisRef} style={{
          ...cardStyle,
          minHeight: '320px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: (!analysis && !analyzing) ? 'center' : 'flex-start',
        }}>
          {/* 区块标题 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: (analysis || analyzing) ? '20px' : '24px' }}>
            <span style={{ color: 'var(--ac)', opacity: 0.6 }}>◉</span>
            <span style={{ fontSize: '11px', letterSpacing: '0.3em', color: 'var(--tx-3)' }}>合盘分析 · {relationType}</span>
          </div>

          {/* 状态分支 */}
          {!analysis && !analyzing && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: '13px', color: 'var(--tx-3)', marginBottom: '24px', lineHeight: 1.7 }}>
                填好双方出生信息并选定关系类型后，点击下方按钮<br />
                高维导师将从「<strong style={{ color: 'var(--tx-1)' }}>{relationType}</strong>」视角为您进行飞星辨证合盘
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
                开始【{relationType}】合盘分析
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
              正在以【{relationType}】视角比对双方命盘…
            </div>
          )}

          {analysis && <AiContent text={analysis} streaming={analyzing} />}

          {analysisError && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bdr)', background: 'var(--bg-card)', fontSize: '13px', color: 'var(--tx-2)', marginTop: '12px' }}>
              {apiMissing
                ? '尚未配置 AI API Key。请点击页面右上角的「🔑 API 设置」按钮填入您的 API Key（支持 DeepInfra / DeepSeek / OpenAI 兼容接口），保存后即可直接进行 AI 合盘分析。'
                : '分析暂时不可用，请检查右上角「🔑 API 设置」中的密钥是否正确后重试。'}
            </div>
          )}
        </div>

        {/* ═══ 针对合盘的追问聊天框（仅分析完成后显示）═══════════ */}
        {analysis && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'var(--tx-3)', marginBottom: '4px' }}>
              针对此次【{relationType}】合盘继续追问
            </div>

            {/* 快捷问题 */}
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

            {/* 输入框 + 追问按钮 */}
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
                placeholder={`针对【${relationType}】关系继续追问…`}
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
                {analyzing ? '分析中…' : '继续追问'}
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
