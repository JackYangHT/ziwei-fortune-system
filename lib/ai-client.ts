import 'server-only';
import type { ZiweiChart, Palace } from './ziwei/types';
import { STEMS, BRANCHES, SHICHEN } from './ziwei/constants';
import { detectPatterns } from './ziwei/patterns';

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
    `### ${label}格局识别结果`,
    patternsText,
  ];

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
