'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ZiweiChart, Palace } from '@/lib/ziwei/types';
import type { TimeView } from './TimeNav';
import {
  buildInterpretChatMessages,
  loadClientAiSettings,
  streamDirectClientAi,
} from '@/lib/ai-client';
import type { ProfileMessage } from '@/lib/profile-storage';

interface Message extends ProfileMessage {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean; // don't show user bubble for auto/topic messages
}

interface SelectedSiHua {
  starName: string;
  siHua: string;
  view: TimeView;
}

interface InsightPanelProps {
  chart: ZiweiChart;
  selectedPalace?: Palace | null;
  selectedSiHua?: SelectedSiHua | null;
  /** 从本机命盘库恢复的历史对话记录 */
  initialMessages?: ProfileMessage[];
  /** 对话更新（尤其 AI 回复完成后）回调，用于持久化到本机档案 */
  onMessagesChange?: (messages: ProfileMessage[]) => void;
  /** 当前档案名（仅用于展示本机保存状态） */
  profileName?: string | null;
}

const TOPICS = [
  { key: 'overview',     label: '命格' },
  { key: 'love',        label: '感情' },
  { key: 'career',      label: '事業' },
  { key: 'wealth',      label: '財運' },
  { key: 'health',      label: '健康' },
  { key: 'personality', label: '性格' },
] as const;

const TOPIC_PROMPTS: Record<string, string> = {
  overview: `【起盤現況核對】我剛排好命盤，請全程使用繁體中文，先不要直接下結論，而是像倪海廈老師初診問病史一樣，根據我命盤中最強烈的飛星特徵（化忌宮位、煞星交會點、來因宮與雙軌權重 Top 3 核心共振宮位），為我輸出一份 **【現況核對清單】**。
要求：
1. 只問 **3–5 個客觀事實問題**（例如原生家庭父母狀況、感情狀態與穩定經歷、事業工作狀態，以及若子女／疾厄宮有強烈訊號時溫柔詢問的身心／生育節點），**不要問情緒感受，只問客觀事實**。
2. 本輪**只輸出【現況核對清單】**後即暫停，等我點選或回覆真實情況後，再將「事實＋命盤」結合，進入六步辨證解盤。`,

  love: `【初診問診 · 感情關係】請全程使用繁體中文，結合現代多元感情觀與男女平權視角，聚焦我的夫妻宮、福德宮、交友宮及飛星化忌／煞星交會點，找出我在親密關係中最強的內耗病灶。
本輪為問診起手式：**只輸出【生活場景】與【命盤印證】**（先共情，再用具體相處場景向我反問求證），然後暫停等我確認，不要提前輸出後四步處方。`,

  career: `【初診問診 · 事業方向】請全程使用繁體中文，以現代職場視角（紫微＝高管／領導、天相＝幕僚／公關、破軍＝開拓／業務、貪狼廉貞＝公關／人緣），聚焦我的官祿宮、來因宮、財帛宮連動及當前大限流年的飛星化忌交會點，找出我在事業上最強的內耗病灶。
本輪為問診起手式：**只輸出【生活場景】與【命盤印證】**（先共情，再用具體職場／合作場景向我反問求證），然後暫停等我確認，不要提前輸出後四步處方。`,

  wealth: `【初診問診 · 財富能量】請全程使用繁體中文，聚焦我的財帛宮、田宅宮及飛星化忌／煞星沖剋點，找出我在金錢與豐盛流向上最強的卡點病灶。
本輪為問診起手式：**只輸出【生活場景】與【命盤印證】**（先共情，再用具體收支或合作消耗場景向我反問求證），然後暫停等我確認，不要提前輸出後四步處方。`,

  health: `【初診問診 · 身心健康】請全程使用繁體中文，聚焦我的疾厄宮、福德宮星曜、十二地支臟腑對應及當前大限流年化忌觸發點，找出我身心能量最容易失衡的病灶。
本輪為問診起手式：**只輸出【生活場景】與【命盤印證】**（先共情，再用具體身心疲憊／睡眠情緒訊號向我反問求證），然後暫停等我確認，不要提前輸出後四步處方。`,

  personality: `【初診問診 · 內在性格】請全程使用繁體中文，以現代心理學與平權視角，聚焦我的命宮、身宮、福德宮及三方四正的飛星化忌與執著點，找出我最容易反覆自我內耗的性格病灶。
本輪為問診起手式：**只輸出【生活場景】與【命盤印證】**（先共情，再用具體人際或內心拉扯場景向我反問求證），然後暫停等我確認，不要提前輸出後四步處方。`,
};

const FACT_CHECK_GROUPS = [
  {
    id: 'parents',
    label: '原生家庭',
    options: ['父母健在', '父母離異', '單親家庭', '父／母一方已故'],
  },
  {
    id: 'love',
    label: '感情現狀',
    options: ['單身', '戀愛中', '已婚', '同居', '未婚生子', '有超一年感情經歷', '暫無長期戀情'],
  },
  {
    id: 'career',
    label: '事業狀態',
    options: ['上班任職', '自主創業', '自由職業', '待業／過渡中', '在校學生'],
  },
  {
    id: 'fertility',
    label: '生育／節點（可選）',
    options: ['無墮胎／流產經歷', '曾有墮胎或流產經歷', '此項略過'],
  },
] as const;

const DIAGNOSTIC_OPTIONS = [
  {
    key: 'match',
    label: '✓ 很符合，正是如此',
    reply: '很符合，你說的正是我最近的真實狀況。請用繁體中文幫我繼續拆解病根，並給出轉念心法、處方建議和金句結尾。',
  },
  {
    key: 'partial',
    label: '◐ 部分符合',
    reply: '部分符合，有些地方確實被消耗到了，但程度沒那麼重。請用繁體中文結合這點幫我拆解病根，並給出轉念心法、處方建議和金句結尾。',
  },
  {
    key: 'mismatch',
    label: '✕ 不太符合',
    reply: '不太符合，我最近的真實情況不是這樣。請用繁體中文換一個角度重新為我辨證問診，看看能量是不是走到了別的宮位或層面。',
  },
] as const;

function isAwaitingFactCheck(text: string): boolean {
  const hasFactSection = text.includes('【现况核对清单】') || text.includes('【現況核對清單】');
  const hasStartedReading =
    text.includes('【生活场景】') ||
    text.includes('【生活場景】') ||
    text.includes('【病根拆解】') ||
    text.includes('【处方建议】') ||
    text.includes('【處方建議】');
  return hasFactSection && !hasStartedReading;
}

function isAwaitingDiagnosticConfirm(text: string): boolean {
  if (isAwaitingFactCheck(text)) return false;
  const hasConfirmSection = text.includes('【命盘印证】') || text.includes('【命盤印證】');
  const hasPrescriptionSection =
    text.includes('【处方建议】') ||
    text.includes('【處方建議】') ||
    text.includes('【金句结尾】') ||
    text.includes('【金句結尾】');
  return hasConfirmSection && !hasPrescriptionSection;
}

const PALACE_ROLES: Record<string, string> = {
  '命宫':   '自我、性格、先天格局',
  '兄弟宫': '兄弟关系、合伙人',
  '夫妻宫': '感情关系、婚姻状态',
  '子女宫': '子女缘分、下属关系',
  '财帛宫': '财运来源、收入方式',
  '疾厄宫': '身体健康、意外',
  '迁移宫': '外出机遇、人际格局',
  '交友宫': '朋友圈、贵人、小人',
  '官禄宫': '事业成就、社会地位',
  '田宅宫': '不动产、家庭环境',
  '福德宫': '精神享受、内心福分',
  '父母宫': '父母关系、文书契约',
};

/** Render AI markdown: **【Title】** → gold header, **bold** → strong */
function AiContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const sectionMatch = line.match(/^\*\*【(.+?)】\*\*$/);
        if (sectionMatch) {
          return (
            <div key={i} className="pt-3 pb-0.5 first:pt-0">
              <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'var(--t-gold)' }}>
                【{sectionMatch[1]}】
              </span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        const parts = line.split(/\*\*(.+?)\*\*/);
        return (
          <div key={i} className="text-[11px] leading-relaxed" style={{ color: 'var(--t-text2)' }}>
            {parts.map((part, j) =>
              j % 2 === 0
                ? part
                : <strong key={j} className="font-medium" style={{ color: 'var(--t-text)' }}>{part}</strong>
            )}
          </div>
        );
      })}
      {streaming && (
        <span
          className="inline-block w-1.5 h-3 ml-0.5 animate-pulse rounded-sm align-middle"
          style={{ background: 'var(--t-gold)', opacity: 0.6 }}
        />
      )}
    </div>
  );
}

export default function InsightPanel({
  chart,
  selectedPalace,
  selectedSiHua,
  initialMessages,
  onMessagesChange,
  profileName,
}: InsightPanelProps) {
  const [messages, setMessages] = useState<Message[]>(() => initialMessages ?? []);
  const [input, setInput] = useState('');
  const [selectedFacts, setSelectedFacts] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string>('overview');
  const messagesRef = useRef<Message[]>(initialMessages ?? []); // always-current copy for closures
  const loadingRef = useRef(false);
  const autoLoaded = useRef(false);
  const lastPalaceBranch = useRef<number | undefined>(undefined);
  const lastSiHuaKey = useRef<string | undefined>(undefined);
  const lastChartRef = useRef<ZiweiChart | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onMessagesChangeRef = useRef(onMessagesChange);

  useEffect(() => {
    onMessagesChangeRef.current = onMessagesChange;
  }, [onMessagesChange]);

  // Keep refs in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 移动端虚拟键盘弹出时通过 visualViewport 保持输入框与最新对话可见、避免跳动
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handleViewportResize = () => {
      if (document.activeElement === inputRef.current && window.innerWidth < 768) {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    vv.addEventListener('resize', handleViewportResize);
    return () => vv.removeEventListener('resize', handleViewportResize);
  }, []);

  // Auto-generate 命格总览 on mount or when chart changes (若存在历史对话则直接恢复不覆盖)
  useEffect(() => {
    if (lastChartRef.current === chart && autoLoaded.current) return;
    lastChartRef.current = chart;
    autoLoaded.current = true;
    lastPalaceBranch.current = undefined;
    lastSiHuaKey.current = undefined;
    abortControllerRef.current?.abort();
    loadingRef.current = false;
    setLoading(false);

    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
      messagesRef.current = initialMessages;
      setActiveTopic('overview');
      return () => {
        abortControllerRef.current?.abort();
      };
    }

    setMessages([]);
    messagesRef.current = [];
    setActiveTopic('overview');
    sendMessage(TOPIC_PROMPTS.overview, true);
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [chart]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inject palace analysis when palace selected
  useEffect(() => {
    if (!selectedPalace || selectedPalace.branch === lastPalaceBranch.current) return;
    lastPalaceBranch.current = selectedPalace.branch;

    const majorStars = selectedPalace.stars.filter(s => s.type === 'major');
    const starDesc = majorStars.length > 0
      ? majorStars.map(s => `${s.name}${s.siHua ? '化' + s.siHua : ''}`).join('、')
      : '空宫（借对宫）';
    const role = PALACE_ROLES[selectedPalace.name] ?? '';

    const prompt = `【初診問診 · ${selectedPalace.name}】請全程使用繁體中文，聚焦我的【${selectedPalace.name}】（主管：${role}，主星：${starDesc}），結合其三方四正與飛星化忌／煞星交會點，找出此宮位最強的內耗病灶。
本輪為問診起手式：**只輸出【生活場景】與【命盤印證】**（先共情，再拋出具體生活場景向我反問求證），然後暫停等我確認，不要提前輸出後四步處方。`;

    sendMessage(prompt, true);
  }, [selectedPalace]); // eslint-disable-line react-hooks/exhaustive-deps

  // 注入四化飛化分析
  useEffect(() => {
    if (!selectedSiHua) return;
    const key = `${selectedSiHua.starName}-${selectedSiHua.siHua}-${selectedSiHua.view}`;
    if (key === lastSiHuaKey.current) return;
    lastSiHuaKey.current = key;

    // 找出該星所在宮位
    const palaceOfStar = chart.palaces.find(p =>
      p.stars.some(s => s.name === selectedSiHua.starName)
    );
    const palaceName = palaceOfStar?.name ?? '未知宮位';
    const viewLabel = selectedSiHua.view === 'daxian' ? '大限' : '流年';

    const prompt = `【初診問診 · ${viewLabel}${selectedSiHua.starName}化${selectedSiHua.siHua}】請全程使用繁體中文，聚焦【${viewLabel}${selectedSiHua.starName}化${selectedSiHua.siHua}】（落入【${palaceName}】）及三方四正飛化路徑，找出它當下觸發的核心能量卡點或滋養點。
本輪為問診起手式：**只輸出【生活場景】與【命盤印證】**（先共情，再用具體近期生活感受向我反問求證），然後暫停等我確認，不要提前輸出後四步處方。`;

    sendMessage(prompt, true);
  }, [selectedSiHua]); // eslint-disable-line react-hooks/exhaustive-deps

  // 当用户在页面上保存新的 API Key 时，若当前处于失败或尚未解读状态，自动重新触发总览解读
  useEffect(() => {
    const onConfigChanged = () => {
      const cfg = loadClientAiSettings();
      if (cfg?.apiKey && !loadingRef.current) {
        abortControllerRef.current?.abort();
        setMessages([]);
        messagesRef.current = [];
        setActiveTopic('overview');
        sendMessage(TOPIC_PROMPTS.overview, true);
      }
    };
    window.addEventListener('ziwei-ai-config-changed', onConfigChanged);
    return () => window.removeEventListener('ziwei-ai-config-changed', onConfigChanged);
  }, [chart]); // eslint-disable-line react-hooks/exhaustive-deps

  const streamResponse = async (apiMessages: { role: 'user' | 'assistant'; content: string }[]) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const clientSettings = loadClientAiSettings();

    try {
      // 1. 优先尝试服务端 /api/interpret（携带用户可选配置的 aiConfig）
      let usedServer = false;
      try {
        const res = await fetch('/api/interpret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chart,
            messages: apiMessages,
            aiConfig: clientSettings?.apiKey ? clientSettings : undefined,
          }),
          signal: controller.signal,
        });

        if (res.ok && res.body && res.headers.get('content-type')?.includes('text/event-stream')) {
          usedServer = true;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let assistantText = '';

          const initMessages: Message[] = [...messagesRef.current, { role: 'assistant', content: '', createdAt: Date.now() }];
          messagesRef.current = initMessages;
          setMessages(initMessages);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const delta = JSON.parse(data).delta?.text ?? '';
                assistantText += delta;
                const updated = [...messagesRef.current];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: assistantText,
                  createdAt: updated[updated.length - 1]?.createdAt ?? Date.now(),
                };
                messagesRef.current = updated;
                setMessages(updated);
              } catch { /* skip */ }
            }
          }
        }
      } catch (serverErr) {
        if (serverErr instanceof Error && serverErr.name === 'AbortError') return;
        // 静态托管环境（如 Firebase Hosting）下 /api/interpret 不可用，进入下方浏览器端直连回退
      }

      // 2. 若静态环境无后端，使用用户在主页/顶栏设置的 API Key 从浏览器直连 AI 接口
      if (!usedServer) {
        if (!clientSettings?.apiKey) {
          throw new Error('api-missing');
        }
        const chatMessages = buildInterpretChatMessages(chart, apiMessages);
        const initMessages: Message[] = [...messagesRef.current, { role: 'assistant', content: '', createdAt: Date.now() }];
        messagesRef.current = initMessages;
        setMessages(initMessages);
        await streamDirectClientAi(
          chatMessages,
          clientSettings,
          (_delta, fullText) => {
            const updated = [...messagesRef.current];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: fullText,
              createdAt: updated[updated.length - 1]?.createdAt ?? Date.now(),
            };
            messagesRef.current = updated;
            setMessages(updated);
          },
          controller.signal,
        );
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const missing = e instanceof Error && (e.message === 'api-missing' || e.message === 'api-key-empty');
      const errDetail = e instanceof Error ? e.message : '未知错误';
      const errMsg: Message = {
        role: 'assistant',
        content: missing
          ? '**【尚未配置 AI API Key】**\n请点击页面顶部导航栏或主页的 **「🔑 API 设置」** 按钮，填入您的 API Key（支持 DeepInfra `deepseek-ai/DeepSeek-V4-Flash`、DeepSeek 官方或 OpenAI 兼容接口），保存后即可自动开始 AI 深度命盘解读！'
          : `**【AI 解读请求失败】**\n${errDetail}\n请点击顶部 **「🔑 API 设置」** 检查您的 API Key、接口地址与模型名称是否正确。`,
        createdAt: Date.now(),
      };
      const updated = [...messagesRef.current, errMsg];
      messagesRef.current = updated;
      setMessages(updated);
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
        loadingRef.current = false;
        // AI 回复结束后自动同步并持久化到本地档案库
        if (messagesRef.current.length > 0) {
          onMessagesChangeRef.current?.(messagesRef.current);
        }
      }
    }
  };

  const sendMessage = (text: string, hidden = false) => {
    if (!text.trim() || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const userMsg: Message = { role: 'user', content: text, hidden, createdAt: Date.now() };
    // Capture current messages synchronously via ref (avoids stale closure)
    const nextMessages = [...messagesRef.current, userMsg];
    const apiMessages = nextMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setInput('');
    streamResponse(apiMessages);
  };

  const handleTopicClick = (topicKey: string) => {
    if (loadingRef.current) return;
    setSelectedFacts({});
    setActiveTopic(topicKey);
    sendMessage(TOPIC_PROMPTS[topicKey], true);
  };

  const toggleFactOption = (groupId: string, option: string) => {
    setSelectedFacts(prev => {
      const current = prev[groupId] ?? [];
      const exists = current.includes(option);
      const next = exists ? current.filter(item => item !== option) : [...current, option];
      return { ...prev, [groupId]: next };
    });
  };

  const selectedFactCount = Object.values(selectedFacts).reduce((acc, arr) => acc + arr.length, 0);

  const buildFactsReply = (extraNote?: string): string => {
    const parts = FACT_CHECK_GROUPS.map(g => {
      const chosen = selectedFacts[g.id];
      if (!chosen || chosen.length === 0) return '';
      return `${g.label}：${chosen.join('、')}`;
    }).filter(Boolean);

    const note = extraNote?.trim();
    const body = [
      parts.length > 0 ? `以下是我核對後的真實近況事實：${parts.join('；')}。` : '',
      note ? `補充說明：${note}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return `${body}\n請全程使用繁體中文，將以上客觀事實與我的命盤結合，完整進入六步辨證問診流程（生活場景 → 命盤印證 → 病根拆解 → 轉念心法 → 處方建議 → 金句結尾）。`;
  };

  const handleSubmitFacts = () => {
    if (loadingRef.current) return;
    if (selectedFactCount === 0 && !input.trim()) return;
    const reply = buildFactsReply(input);
    setSelectedFacts({});
    sendMessage(reply);
  };

  const lastMessage = messages[messages.length - 1];
  const awaitingFactCheck =
    !loading &&
    lastMessage?.role === 'assistant' &&
    isAwaitingFactCheck(lastMessage.content);
  const awaitingDiagnostic =
    !loading &&
    lastMessage?.role === 'assistant' &&
    isAwaitingDiagnosticConfirm(lastMessage.content);

  const handleSend = () => {
    if (awaitingFactCheck && selectedFactCount > 0) {
      handleSubmitFacts();
      return;
    }
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden card-glass">

      {/* ── Topic buttons ── */}
      <div className="flex-shrink-0 px-2 pt-2.5 pb-2" style={{ borderBottom: '1px solid var(--t-border)' }}>
        <div className="grid grid-cols-6 gap-1">
          {TOPICS.map(t => {
            const isActive = activeTopic === t.key;
            return (
              <button
                key={t.key}
                onClick={() => handleTopicClick(t.key)}
                disabled={loading}
                className="py-1.5 text-[10px] font-medium rounded-lg transition-all duration-150 disabled:opacity-40"
                style={{
                  background: isActive ? 'rgba(212,168,67,0.12)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(212,168,67,0.3)' : 'var(--t-border)'}`,
                  color: isActive ? 'var(--t-gold)' : 'var(--t-faint)',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

        {/* Loading state before first message */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3" style={{ color: 'var(--t-gold)', opacity: 0.1 }}>✦</div>
            <p className="text-[10px] animate-pulse" style={{ color: 'var(--t-faint)' }}>導師正在為您望聞問切…</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            if (msg.role === 'user' && msg.hidden) return null;

            if (msg.role === 'user') {
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div
                    className="max-w-[85%] rounded-xl px-3 py-2 text-[11px] whitespace-pre-line"
                    style={{
                      background: 'rgba(212,168,67,0.08)',
                      border: '1px solid rgba(212,168,67,0.18)',
                      color: 'var(--t-gold)',
                    }}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              );
            }

            // Assistant message
            const isLastMsg = i === messages.length - 1;
            const showFactCheckActions = isLastMsg && awaitingFactCheck;
            const showDiagnosticActions = isLastMsg && awaitingDiagnostic;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div
                  className="text-[9px] tracking-widest mb-2 flex items-center gap-1.5"
                  style={{ color: 'var(--t-faint)' }}
                >
                  <span style={{ color: 'var(--t-gold)', opacity: 0.4 }}>✦</span>
                  {showFactCheckActions
                    ? '高維導師 · 現況事實核對'
                    : showDiagnosticActions
                      ? '高維導師 · 初診問詢'
                      : '高維導師 · 辨證開方'}
                </div>
                <AiContent text={msg.content} streaming={loading && isLastMsg} />

                {showFactCheckActions && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 pt-2.5 space-y-2.5"
                    style={{ borderTop: '1px dashed var(--t-border)' }}
                  >
                    <div className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--t-faint)' }}>
                      <span style={{ color: 'var(--t-gold)', opacity: 0.7 }}>✦</span>
                      <span>快捷點選符合您的事實標籤（可複選，不方便項可略過），或直接在下方打字回覆：</span>
                    </div>

                    <div className="space-y-2">
                      {FACT_CHECK_GROUPS.map(group => {
                        const chosen = selectedFacts[group.id] ?? [];
                        return (
                          <div key={group.id} className="space-y-1">
                            <div className="text-[9px] font-medium" style={{ color: 'var(--t-faint)' }}>
                              {group.label}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {group.options.map(opt => {
                                const isSelected = chosen.includes(opt);
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    disabled={loading}
                                    onClick={() => toggleFactOption(group.id, opt)}
                                    className="px-2 py-1 rounded-lg text-[10px] transition-all duration-150 disabled:opacity-40 cursor-pointer"
                                    style={{
                                      background: isSelected ? 'rgba(212,168,67,0.18)' : 'var(--t-card)',
                                      border: `1px solid ${
                                        isSelected ? 'rgba(212,168,67,0.48)' : 'var(--t-border)'
                                      }`,
                                      color: isSelected ? 'var(--t-gold)' : 'var(--t-text2)',
                                      fontWeight: isSelected ? 600 : 400,
                                    }}
                                  >
                                    {isSelected ? `✓ ${opt}` : opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[9px]" style={{ color: 'var(--t-faint)' }}>
                        {selectedFactCount > 0 ? `已選 ${selectedFactCount} 項事實` : '可點選標籤，或在下方直接輸入年份／細節'}
                      </span>
                      <button
                        type="button"
                        disabled={loading || (selectedFactCount === 0 && !input.trim())}
                        onClick={handleSubmitFacts}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer border-none"
                        style={{
                          background: 'linear-gradient(135deg, #9a6210, #c88020)',
                          color: '#fff8e8',
                        }}
                      >
                        確認現況事實，開始辨證解盤 →
                      </button>
                    </div>
                  </motion.div>
                )}

                {showDiagnosticActions && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 pt-2.5 space-y-2"
                    style={{ borderTop: '1px dashed var(--t-border)' }}
                  >
                    <div className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--t-faint)' }}>
                      <span style={{ color: 'var(--t-gold)', opacity: 0.7 }}>✦</span>
                      <span>印證現況後，導師再為您拆解病根、開出處方（也可在下方直接打字補充）：</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DIAGNOSTIC_OPTIONS.map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          disabled={loading}
                          onClick={() => sendMessage(opt.reply)}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-150 hover:brightness-110 disabled:opacity-40"
                          style={{
                            background:
                              opt.key === 'match'
                                ? 'rgba(212,168,67,0.14)'
                                : 'var(--t-card)',
                            border: `1px solid ${
                              opt.key === 'match'
                                ? 'rgba(212,168,67,0.35)'
                                : 'var(--t-border)'
                            }`,
                            color: opt.key === 'match' ? 'var(--t-gold)' : 'var(--t-text2)',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Input ── */}
      <div
        className="insight-input-bar flex-shrink-0 px-3 pt-2 sticky bottom-0 z-20"
        style={{
          borderTop: '1px solid var(--t-border)',
          background: 'var(--t-bg)',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {profileName && (
          <div className="text-[9px] mb-1.5 flex items-center justify-between" style={{ color: 'var(--t-faint)' }}>
            <span>🔒 對話自動保存至本機檔案：{profileName}</span>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            onFocus={e => {
              const el = e.currentTarget;
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
              if (typeof window !== 'undefined' && window.innerWidth < 768) {
                window.setTimeout(() => {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 260);
              }
            }}
            placeholder={
              awaitingFactCheck
                ? '補充細節或年份（如：2021年有流產經歷），或直接打字回覆…'
                : awaitingDiagnostic
                  ? '點擊上方按鈕印證，或直接說說您的真實近況…'
                  : '繼續與導師對話，如：今年適合換工作嗎？'
            }
            disabled={loading}
            className="flex-1 rounded-lg px-3 py-2 text-[11px] focus:outline-none transition-colors"
            style={{
              background: 'var(--t-card)',
              border: '1px solid var(--t-border)',
              color: 'var(--t-text)',
              scrollMarginBottom: '140px',
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || (!input.trim() && !(awaitingFactCheck && selectedFactCount > 0))}
            className="px-3 py-2 rounded-lg text-[11px] font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(212,168,67,0.15)',
              border: '1px solid rgba(212,168,67,0.25)',
              color: 'var(--t-gold)',
            }}
          >
            {loading ? '…' : awaitingFactCheck ? '提交核對' : awaitingDiagnostic ? '回覆' : '追問'}
          </button>
        </div>
      </div>

    </div>
  );
}
