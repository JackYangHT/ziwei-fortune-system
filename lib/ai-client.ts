import 'server-only';
import type { ZiweiChart, Palace } from './ziwei/types';
import { STEMS, BRANCHES, SHICHEN } from './ziwei/constants';
import { detectPatterns } from './ziwei/patterns';
import { computeMagneticField } from './ziwei-flying/magnetic-field';
import { VECTOR_STRENGTH } from './ziwei-flying/config';
import type { LuFollowsJiVector } from './ziwei-flying/types';

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

const DEFAULT_DEEPINFRA_MODEL = 'deepseek-ai/DeepSeek-V4-Flash';

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

export async function streamOpenAiCompatibleSse(messages: ChatMessage[], temperature = 0.7): Promise<Response> {
  const config = getAiProviderConfig();

  if (!isApiKeyConfigured(config.apiKey)) {
    return createStaticSseResponse(
      `**【尚未配置 API Key】**\n请在项目根目录的 **.env.local** 文件中填入您的 DeepInfra API Key：\n**DEEPINFRA_API_KEY=您的实际密钥**\n（当前模型：**${config.model}**，档位：**${config.serviceTier ?? 'default'}**，接口地址：**${config.baseUrl}**），保存后重启开发服务器即可开始 AI 解读。`
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
