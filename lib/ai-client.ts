import type { ZiweiChart, Palace } from './ziwei/types';
import { STEMS, BRANCHES, SHICHEN } from './ziwei/constants';
import { detectPatterns } from './ziwei/patterns';
import { computeMagneticField } from './ziwei-flying/magnetic-field';
import { VECTOR_STRENGTH } from './ziwei-flying/config';
import type { LuFollowsJiVector } from './ziwei-flying/types';
import {
  HEMING_METHODOLOGY,
  STAR_IN_FUQI_GU,
  SIHUA_IN_FUQI_GU,
  HEMING_SCORE_CRITERIA,
} from './ziwei/heming-knowledge';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  serviceTier?: string;
}

export const DEFAULT_DEEPINFRA_MODEL = 'deepseek-ai/DeepSeek-V4-Flash';
export const DEFAULT_DEEPINFRA_BASE_URL = 'https://api.deepinfra.com/v1/openai';

export const AI_CONFIG_STORAGE_KEY = 'ziwei_ai_config';

export interface ClientAiSettings {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export function loadClientAiSettings(): ClientAiSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ClientAiSettings>;
    if (!parsed || typeof parsed.apiKey !== 'string') return null;
    return {
      apiKey: parsed.apiKey.trim(),
      baseUrl: (parsed.baseUrl || DEFAULT_DEEPINFRA_BASE_URL).trim().replace(/\/+$/, ''),
      model: (parsed.model || DEFAULT_DEEPINFRA_MODEL).trim(),
    };
  } catch {
    return null;
  }
}

export function saveClientAiSettings(settings: ClientAiSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      AI_CONFIG_STORAGE_KEY,
      JSON.stringify({
        apiKey: settings.apiKey.trim(),
        baseUrl: (settings.baseUrl || DEFAULT_DEEPINFRA_BASE_URL).trim().replace(/\/+$/, ''),
        model: (settings.model || DEFAULT_DEEPINFRA_MODEL).trim(),
      }),
    );
    window.dispatchEvent(new CustomEvent('ziwei-ai-config-changed'));
  } catch {
    // ignore storage errors
  }
}

const PLACEHOLDER_KEYS = new Set([
  '',
  'your-deepinfra-api-key',
  'your-deepseek-api-key',
  'your-api-key',
]);

export function getAiProviderConfig(): AiProviderConfig {
  const provider = (process.env.AI_PROVIDER || 'deepinfra').toLowerCase();
  const serviceTier = (process.env.DEEPINFRA_SERVICE_TIER || '').trim() || undefined;

  if (provider === 'mimo') {
    return {
      apiKey: (process.env.MIMO_API_KEY || '').trim(),
      baseUrl: (process.env.MIMO_BASE_URL || 'https://api.deepinfra.com/v1/openai').replace(/\/+$/, ''),
      model: (process.env.MIMO_MODEL || DEFAULT_DEEPINFRA_MODEL).trim(),
      serviceTier,
    };
  }

  if (provider === 'deepseek' && !process.env.DEEPINFRA_API_KEY && !process.env.DEEPINFRA_BASE_URL) {
    return {
      apiKey: (process.env.DEEPSEEK_API_KEY || '').trim(),
      baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, ''),
      model: (process.env.DEEPSEEK_MODEL || 'deepseek-chat').trim(),
    };
  }

  // Default: DeepInfra OpenAI-compatible endpoint with DeepSeek-V4-Flash
  return {
    apiKey: (
      process.env.DEEPINFRA_API_KEY ||
      process.env.DEEPSEEK_API_KEY ||
      process.env.MIMO_API_KEY ||
      ''
    ).trim(),
    baseUrl: (
      process.env.DEEPINFRA_BASE_URL ||
      process.env.MIMO_BASE_URL ||
      'https://api.deepinfra.com/v1/openai'
    ).replace(/\/+$/, ''),
    model: (
      process.env.DEEPINFRA_MODEL ||
      process.env.MIMO_MODEL ||
      DEFAULT_DEEPINFRA_MODEL
    ).trim(),
    serviceTier,
  };
}

export function isApiKeyConfigured(apiKey: string): boolean {
  return !PLACEHOLDER_KEYS.has(apiKey);
}

function formatPalaceLine(palace: Palace): string {
  const stem = STEMS[palace.stem] ?? '';
  const branch = BRANCHES[palace.branch] ?? '';
  const tags: string[] = [];
  if (palace.isMingGong) tags.push('命宫');
  if (palace.isShenGong) tags.push('身宫');
  if (palace.isCurrentDaXian) tags.push('当前大限');

  const formatStar = (s: Palace['stars'][number]) => {
    const bright = s.brightnessRaw ?? '';
    const sihua = s.siHua ? `[生年化${s.siHua}]` : '';
    return `${s.name}${bright ? `(${bright})` : ''}${sihua}`;
  };

  const major = palace.stars.filter(s => s.type === 'major').map(formatStar);
  const lucky = palace.stars.filter(s => s.type === 'lucky').map(formatStar);
  const sha = palace.stars.filter(s => s.type === 'sha').map(formatStar);
  const minor = palace.stars.filter(s => s.type === 'minor').map(formatStar);

  const majorText = major.length > 0
    ? major.join('、')
    : `空宫${palace.borrowedStars?.length ? `（借${palace.borrowedFromName ?? '对宫'}：${palace.borrowedStars.join('、')}）` : ''}`;

  const selfSihuaText = palace.selfSihua?.length
    ? ` | 宫干自化：${palace.selfSihua.map(x => `${x.starName}自化${x.siHua}`).join('、')}`
    : '';

  const daxianText = palace.daXianAge
    ? ` | 大限：${palace.daXianAge[0]}–${palace.daXianAge[1]}岁`
    : '';

  return `- 【${palace.name}】(${stem}${branch}宫${tags.length ? ` · ${tags.join('/')}` : ''})：主星[${majorText}]` +
    (lucky.length ? ` | 吉辅[${lucky.join('、')}]` : '') +
    (sha.length ? ` | 煞星[${sha.join('、')}]` : '') +
    (minor.length ? ` | 杂曜[${minor.join('、')}]` : '') +
    selfSihuaText +
    daxianText;
}

export function serializeChartForPrompt(chart: ZiweiChart, label = '命盘'): string {
  const { birthInfo, lunarInfo } = chart;
  const genderStr = birthInfo.gender === 'male' ? '男' : '女';
  const shichenStr = SHICHEN[birthInfo.hour]?.name ?? `时辰序号${birthInfo.hour}`;
  const yearGanZhi = `${STEMS[lunarInfo.yearStem] ?? ''}${BRANCHES[lunarInfo.yearBranch] ?? ''}`;
  const currentDaXian = chart.daXians?.[chart.currentDaXianIndex];

  let patternsText = '无明显特殊格局';
  try {
    const patterns = detectPatterns(chart);
    if (patterns.length > 0) {
      patternsText = patterns
        .map(p => {
          const cond = p.conditions?.required?.length ? `（条件：${p.conditions.required.join('；')}）` : '';
          const brk = p.conditions?.breaking?.length ? ` [破格警示：${p.conditions.breaking.join('；')}]` : '';
          return `  * ${p.name} [${p.level}]：${p.description}${cond}${brk}`;
        })
        .join('\n');
    }
  } catch {
    // fallback if pattern detection fails on malformed input
  }

  const lines: string[] = [
    `### ${label}基本信息`,
    `- 性别：${chart.yinYangGender ?? genderStr}（${genderStr}命）`,
    `- 公历出生：${birthInfo.year}年${birthInfo.month}月${birthInfo.day}日 ${shichenStr}`,
    `- 农历生年：${yearGanZhi}年（农历${lunarInfo.lunarYear}年${lunarInfo.isLeapMonth ? '闰' : ''}${Math.abs(lunarInfo.lunarMonth)}月${lunarInfo.lunarDay}日）`,
    ...(lunarInfo.fourPillars ? [`- 四柱八字：${lunarInfo.fourPillars.join(' ')}`] : []),
    `- 五行局：${chart.wuxingJuName} | 命主：${chart.mingZhu ?? '未知'} | 身主：${chart.shenZhu ?? '未知'}`,
    `- 当前虚岁：${chart.currentAge}岁` +
      (currentDaXian
        ? ` | 当前大限：${currentDaXian.palaceName}（${currentDaXian.startAge}–${currentDaXian.endAge}岁，${currentDaXian.stemName ?? ''}干四化：${
            currentDaXian.siHua
              ? `${currentDaXian.siHua.lu}化禄、${currentDaXian.siHua.quan}化权、${currentDaXian.siHua.ke}化科、${currentDaXian.siHua.ji}化忌`
              : '无'
          }）`
        : ''),
    '',
    `### ${label}十二宫配置`,
    ...chart.palaces.map(formatPalaceLine),
    '',
    `### ${label}三合格局识别结果`,
    patternsText,
  ];

  // 注入磁场化（体 / 用 / 方向 / 双轨权重）六步解说骨架数据
  try {
    const mf = computeMagneticField({ chart });
    const ly = mf.body.laiYin;
    const relationPriority: Record<LuFollowsJiVector['relation'], number> = {
      'same-palace': 0,
      clamp: 1,
      'opposite-palace': 2,
      'sanhe-palace': 3,
      'other-palace': 4,
    };
    const sortedVectors = [...mf.vectors].sort(
      (a, b) => relationPriority[a.relation] - relationPriority[b.relation],
    );
    const laiYinVec = mf.vectors.find(v => v.level === 'laiYin');
    const decadalEdges = mf.rawMatrix.edges.filter(e => e.layer === 'decadal');
    const yearlyEdges = mf.rawMatrix.edges.filter(e => e.layer === 'yearly');

    lines.push(
      '',
      `### ${label}磁场化六步推演数据（体·用·方向·双轨权重）`,
      `1. **【第一步 · 来因宫（体·使命群组）】**：`,
      `   - 来因宫：【${ly.palaceName}】(${ly.stemName}${ly.branchName}宫) — 属${ly.domainType === 'inner' ? '内六宫·自立格（体：成败由己、自主开创）' : '外六宫·他立格（用：借力外部人际、伴侣与平台）'}`,
      `   - 三合使命群组：${ly.sanHePalaces.map(p => `${p.palaceName}(${p.branchName})`).join('、')}`,
      `   - 对宫体用投射端：${ly.oppositePalace.palaceName}(${ly.oppositePalace.branchName})`,
      `2. **【第二步 · 生年四化落点与禄随忌走终点】**：`,
      ...(['禄', '权', '科', '忌'] as const).map(sh => {
        const item = mf.body.natalSihua[sh];
        return `   - 生年化${sh}：${item.starName} → 落【${item.palaceName}】(${item.branchName}宫 · ${item.domainType === 'inner' ? '内宫' : '外宫'}${item.hasSelfSihua ? ' · ⚠同星离心自化' : ''})`;
      }),
      `   - 禄随忌走主线：${laiYinVec ? laiYinVec.trajectory : '无'}`,
      `3. **【第三步 · 当前大限四化叠宫】**：`,
      mf.rawMatrix.activeDecadalPalace
        ? `   - 大限命宫：【${mf.rawMatrix.activeDecadalPalace.palaceName}】(${mf.rawMatrix.activeDecadalPalace.stemName}${mf.rawMatrix.activeDecadalPalace.branchName} · ${mf.rawMatrix.activeDecadalPalace.ageRange[0]}–${mf.rawMatrix.activeDecadalPalace.ageRange[1]}岁)\n` +
          decadalEdges
            .map(e => `   - 大限${e.stemName}干：${e.starName}化${e.siHua} 飞入【${e.toPalace}】(${e.toBranchName})`)
            .join('\n')
        : '   - 当前尚未入大限',
      `4. **【第四步 · 流年四化触发宫位】**：`,
      `   - 流年太岁宫（${mf.rawMatrix.activeYearlyPalace.year}年）：【${mf.rawMatrix.activeYearlyPalace.palaceName}】(${mf.rawMatrix.activeYearlyPalace.stemName}${mf.rawMatrix.activeYearlyPalace.branchName})`,
      ...yearlyEdges.map(
        e => `   - 流年${e.stemName}干：${e.starName}化${e.siHua} 触发【${e.toPalace}】(${e.toBranchName})`,
      ),
      `5. **【第五步 · 空间关系最强的禄随忌走因果链 (same-palace > clamp > opposite > sanhe)】**：`,
      ...sortedVectors.slice(0, 6).map(
        v => `   - [${v.relation} | 强度${VECTOR_STRENGTH[v.relation]}] ${v.trajectory}`,
      ),
      `   - **已命中飞星规则库（共 ${mf.dualTrack.flyingRuleHits.length} 条）**：`,
      ...(mf.dualTrack.flyingRuleHits.length > 0
        ? mf.dualTrack.flyingRuleHits.map(
            h =>
              `     * [${h.id} · ${h.name} (${h.weightDelta >= 0 ? '+' : ''}${h.weightDelta})] 涉及宫位[${h.palaces.join('、')}]：${h.detail}`,
          )
        : ['     * 无特殊冲突规则命中']),
      `6. **【第六步 · 双轨制合成权重与核心共振 Top 3 宫位】**：`,
      `   - 双轨合成总指数：**${mf.dualTrack.combinedIndex >= 0 ? '+' : ''}${mf.dualTrack.combinedIndex}**（飞星矩阵主轨分 ${mf.dualTrack.flyingMatrixScore} × 0.7 + 三合格局背景分 ${mf.dualTrack.sanheBackgroundScore} × 0.3）`,
      `   - **注意力核心焦点 Top 3 宫位**：` +
        mf.dualTrack.topResonancePalaces
          .map(
            (p, idx) =>
              `#${idx + 1} 【${p.palaceName}】(${p.branchName}宫，净权重 ${p.totalNetWeight >= 0 ? '+' : ''}${p.totalNetWeight})`,
          )
          .join('、'),
      `   - 12宫净权重分布：` +
        mf.weightedField
          .map(w => `${w.palaceName}(${w.totalNetWeight >= 0 ? '+' : ''}${w.totalNetWeight})`)
          .join(' | '),
    );
  } catch {
    // 保持排盘基础序列化可用
  }

  return lines.join('\n');
}

export function buildInterpretChatMessages(
  chart: ZiweiChart,
  messages: { role: 'user' | 'assistant'; content: string }[],
): ChatMessage[] {
  const chartContext = serializeChartForPrompt(chart, '命主');

  const systemPrompt = `你是一位融合倪海厦《天纪》三合星曜体系与钦天飞星四化（磁场化：体·用·方向·双轨权重）的资深紫微斗数命理师。
请严格根据下方提供的【命主排盘数据】、【三合格局识别结果】与【磁场化六步推演数据】进行深度解读与回答。

## 核心解盘六步骨架（必须在总览与深度分析中贯彻）
1. **先说来因宫（体 · 使命群组）**：明确定性来因宫属「内六宫自立（体）」还是「外六宫他立（用）」，结合三合使命群组与对宫投射端，一句话定性命主人生主轴。
2. **再说生年四化落点与禄随忌走终点**：指出生年禄、权、科、忌四颗星落点，说明「禄在哪、忌在哪，禄随忌走的终点归宿在哪一宫」。
3. **再叠大限四化（用 · 十年运势层）**：说明当前大限宫干四化给哪些宫位注入了什么能量或压力。
4. **再看流年四化（用 · 年度触发层）**：说明今年流年四化触发了哪些宫位，与原局/大限形成何种联动。
5. **再看 Vectors 最强因果链与命中规则（方向）**：按空间关系强度（same-palace 同宫共振 > clamp 邻宫夹制 > opposite 对宫激荡 > sanhe 三合传导）拆解最强的几条具体因果链，并结合已命中的飞星规则（flyingRuleHits）点出核心吉凶事项。
6. **最后给双轨制权重结论（权重）**：给出双轨制合成总指数与净权重绝对值最高的 **Top 3 核心共振宫位**（含具体分值），明确告诉命主当下注意力最该放在哪里。

## 三合星曜与倪师断盘原则
1. **三方四正联参 & 空宫借星**：看任何一宫，必同时审视其对宫与三合宫；空宫一律借对宫主星及四化参看。
2. **亮度定吉凶**：主星庙旺吉力倍增，落陷力弱；煞星庙旺反主突破，落陷逢忌则防灾厄。
3. **健康看疾厄与十二地支脏腑**：结合子胆、丑肝、寅肺、卯大肠、辰胃、巳脾、午心、未小肠、申膀胱、酉肾、戌心包、亥三焦给出具体养生建议。

## 输出格式要求（严格遵守前端渲染规范）
- 凡是段落小标题，必须单独占一行，且严格使用 \`**【小标题】**\` 格式（例如：\`**【一、来因定性】**\`），不要使用 \`#\` 或 \`###\`。
- 正文中需要强调的星曜名、宫位名、格局名、权重分值或核心结论，使用 \`**重点内容**\` 加粗。
- 语气客观、通透、有筋骨，既有传统命理与飞星数理深度，又给出脚踏实地的现代行动建议。

---
${chartContext}`;

  return [
    { role: 'system', content: systemPrompt },
    ...messages.slice(-10).map(m => ({
      role: m.role,
      content: m.content,
    })),
  ];
}

function getFuqiKnowledgeSnippet(chart: ZiweiChart, label: string): string {
  const fuqi = chart.palaces.find(p => p.name === '夫妻宫' || p.name === '夫妻');
  if (!fuqi) return '';
  const majorNames = fuqi.stars.filter(s => s.type === 'major').map(s => s.name);
  const starNames = majorNames.length > 0 ? majorNames : (fuqi.borrowedStars ?? []);
  const lines: string[] = [];

  for (const name of starNames) {
    const info = STAR_IN_FUQI_GU[name];
    if (info) {
      lines.push(
        `- ${label}夫妻宫【${name}】：${info.summary} | 吉象：${info.good} | 凶象：${info.bad} | 婚期：${info.timing}${
          info.ni_quote ? ` | 倪师原话：「${info.ni_quote}」` : ''
        }`,
      );
    }
  }

  for (const s of fuqi.stars) {
    if (s.siHua) {
      const key = `化${s.siHua}` as keyof typeof SIHUA_IN_FUQI_GU;
      const desc = SIHUA_IN_FUQI_GU[key];
      if (desc) {
        lines.push(`- ${label}夫妻宫【${s.name}化${s.siHua}】：${desc}`);
      }
    }
  }
  return lines.join('\n');
}

export function buildHemingChatMessages(
  chartA: ZiweiChart,
  chartB: ZiweiChart,
  question?: string,
): ChatMessage[] {
  const chartAContext = serializeChartForPrompt(chartA, '甲方（A）');
  const chartBContext = serializeChartForPrompt(chartB, '乙方（B）');
  const fuqiNotesA = getFuqiKnowledgeSnippet(chartA, '甲方');
  const fuqiNotesB = getFuqiKnowledgeSnippet(chartB, '乙方');
  const scoreCriteriaText = Object.entries(HEMING_SCORE_CRITERIA)
    .map(([k, v]) => `- ${k}：${v}`)
    .join('\n');

  const systemPrompt = `你是一位精通倪海厦《天纪》紫微斗数合盘体系的资深命理师。
请根据下方【合盘核心方法论】与【甲乙双方完整命盘数据】进行深度合盘比对。

${HEMING_METHODOLOGY}

### 评级参考标准
${scoreCriteriaText}

### 双方夫妻宫知识库断语参考
${fuqiNotesA || '- 甲方夫妻宫按对宫及三方综合论断'}
${fuqiNotesB || '- 乙方夫妻宫按对宫及三方综合论断'}

## 输出格式要求（严格遵守前端渲染规范）
- 凡是段落小标题，必须单独占一行，且严格使用 \`**【小标题】**\` 格式（例如：\`**【合盘综合评级】**\`），不要使用 \`#\` 或 \`###\`。
- 正文中需要强调的星曜、宫位、格局或核心结论，使用 \`**重点内容**\` 加粗。

---
${chartAContext}

---
${chartBContext}`;

  const userPrompt = question?.trim()
    ? `请针对甲乙双方合盘，重点回答以下追问：「${question.trim()}」
请按以下结构输出：

**【核心结论】**
针对「${question.trim()}」给出明确、直接的合盘定性判断。

**【命盘互参依据】**
结合双方命宫、夫妻宫、福德宫、官禄/财帛宫及四化飞星互参，详细拆解原因。

**【大限与流年走势】**
分析双方当前大限运势是否同步，以及近期需要注意的时间节点。

**【相处与行动建议】**
给出具体可落地的相处、沟通或合作建议。`
    : `请对甲乙双方进行全面紫微斗数合盘分析，严格按以下结构输出：

**【合盘综合评级】**
给出星级评价（★☆☆☆☆ 至 ★★★★★）与一句话缘分定性（如：天作之合 / 动静互补 / 欢喜冤家等）。

**【命格与性格互补度】**
对比甲方与乙方的命宫、身宫、福德宫星性，分析两人相处模式是同频共振还是刚柔互补。

**【夫妻宫与福德宫双宫互参】**
按倪师「看婚姻必同时看夫妻宫与福德宫」原则，分析甲方夫妻宫与乙方命盘的呼应、乙方夫妻宫与甲方命盘的呼应，以及太阳/太阴状态。

**【四化飞星互参】**
分析双方生年四化（禄权科忌）落入对方命盘宫位的化学反应，判断是正缘互旺还是化忌磨合。

**【大限同步与关键期】**
对比双方当前大限走势是否同步，指出未来感情或合作的关键机遇期与考验期。

**【相处之道与圆满建议】**
针对双方命盘最容易产生摩擦的宫位/星曜，给出具体、温暖且务实的经营建议。`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

export function createStaticSseResponse(text: string): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: { text } })}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

async function callChatCompletions(
  config: AiProviderConfig,
  messages: ChatMessage[],
  temperature: number,
  useServiceTier: boolean
): Promise<Response> {
  const payload: Record<string, unknown> = {
    model: config.model,
    messages,
    stream: true,
    temperature,
    max_tokens: 2048,
  };
  if (useServiceTier && config.serviceTier && config.serviceTier !== 'default') {
    payload.service_tier = config.serviceTier;
  }

  return fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function streamOpenAiCompatibleSse(
  messages: ChatMessage[],
  temperature = 0.7,
  customConfig?: Partial<ClientAiSettings>,
): Promise<Response> {
  const defaultConfig = getAiProviderConfig();
  const config: AiProviderConfig = {
    apiKey: (customConfig?.apiKey?.trim() || defaultConfig.apiKey),
    baseUrl: (customConfig?.baseUrl?.trim()?.replace(/\/+$/, '') || defaultConfig.baseUrl),
    model: (customConfig?.model?.trim() || defaultConfig.model),
    serviceTier: defaultConfig.serviceTier,
  };

  if (!isApiKeyConfigured(config.apiKey)) {
    return createStaticSseResponse(
      `**【尚未配置 API Key】**\n请点击主页或排盘页右上角的 **「🔑 API 设置」** 填入您的 API Key（支持 DeepInfra / DeepSeek / OpenAI 兼容接口），或在服务器 **.env.local** 中配置 **DEEPINFRA_API_KEY**。`
    );
  }

  let upstreamRes = await callChatCompletions(config, messages, temperature, true);

  // 若当前模型在 DeepInfra 上暂不支持 service_tier="flex"（返回 400/422），自动回退到标准档重试
  if (
    !upstreamRes.ok &&
    config.serviceTier &&
    config.serviceTier !== 'default' &&
    (upstreamRes.status === 400 || upstreamRes.status === 422 || upstreamRes.status === 503)
  ) {
    upstreamRes = await callChatCompletions(config, messages, temperature, false);
  }

  if (!upstreamRes.ok || !upstreamRes.body) {
    const errText = await upstreamRes.text().catch(() => '');
    return createStaticSseResponse(
      `**【AI 接口调用失败】**\nDeepInfra 返回状态码 **${upstreamRes.status}**。\n请检查 **.env.local** 中的 **DEEPINFRA_API_KEY** 与 **DEEPINFRA_MODEL**（当前为 **${config.model}**）是否正确。\n${errText ? `详情：${errText.slice(0, 200)}` : ''}`
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const upstreamReader = upstreamRes.body.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await upstreamReader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            if (payload === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(payload);
              const contentDelta: string =
                parsed.choices?.[0]?.delta?.content ??
                parsed.delta?.text ??
                '';
              if (contentDelta) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ delta: { text: contentDelta } })}\n\n`)
                );
              }
            } catch {
              // ignore malformed chunk
            }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        const msg = err instanceof Error ? err.message : '流式中断';
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ delta: { text: `\n\n**【流式读取中断】** ${msg}` } })}\n\n`)
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

/**
 * 浏览器端直接调用 OpenAI 兼容流式接口（当静态托管如 Firebase Hosting 无 /api/* 后端或用户配置了前端 API Key 时使用）
 */
export async function streamDirectClientAi(
  chatMessages: ChatMessage[],
  settings: ClientAiSettings,
  onDelta: (deltaText: string, fullText: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const apiKey = settings.apiKey.trim();
  const baseUrl = (settings.baseUrl || DEFAULT_DEEPINFRA_BASE_URL).trim().replace(/\/+$/, '');
  const model = (settings.model || DEFAULT_DEEPINFRA_MODEL).trim();

  if (!isApiKeyConfigured(apiKey)) {
    throw new Error('api-key-empty');
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: chatMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI 接口返回 ${res.status}${errText ? `：${errText.slice(0, 160)}` : ''}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        const delta: string =
          parsed.choices?.[0]?.delta?.content ??
          parsed.delta?.text ??
          '';
        if (delta) {
          fullText += delta;
          onDelta(delta, fullText);
        }
      } catch {
        // skip malformed SSE chunk
      }
    }
  }
}
