import { NextRequest } from 'next/server';
import type { ZiweiChart } from '@/lib/ziwei/types';
import {
  type ChatMessage,
  serializeChartForPrompt,
  streamOpenAiCompatibleSse,
  createStaticSseResponse,
} from '@/lib/ai-client';

interface InterpretRequestBody {
  chart: ZiweiChart;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as InterpretRequestBody;
    if (!body?.chart?.palaces || !Array.isArray(body?.messages)) {
      return createStaticSseResponse('**【请求参数错误】**\n缺少有效的命盘数据或对话消息。');
    }

    const chartContext = serializeChartForPrompt(body.chart, '命主');

    const systemPrompt = `你是一位精通倪海厦《天纪》紫微斗数教学体系与《紫微斗数全书》的资深命理师。
请严格根据下方提供的【命主排盘数据】与【格局识别结果】进行深度解读与回答。

## 核心断盘原则（倪海厦《天纪》体系）
1. **三方四正联参**：看任何一宫，必同时审视其对宫（迁移/冲照）与三合宫（如命宫必联参财帛、官禄、迁移）。
2. **空宫借星**：若某宫无主星（空宫），一律借对宫主星及四化参看。
3. **亮度定吉凶**：主星庙旺（庙、旺、得、利）则吉力倍增，落陷（不、陷）则力弱或显负面特质；煞星庙旺反主激发突破，落陷逢化忌则防灾厄。
4. **四化飞星关键**：化禄主财源与顺遂、化权主掌权与争执、化科主声名与贵人解厄、化忌主执着、阻滞与功课。
5. **健康看疾厄与杀星落宫地支**：结合十二地支对应脏腑（子胆、丑肝、寅肺、卯大肠、辰胃、巳脾、午心、未小肠、申膀胱、酉肾、戌心包、亥三焦）与子午流注给出具体养生建议。
6. **男女命与双宫联参**：看感情婚姻必同时参看【夫妻宫】与【福德宫】；女命兼看太阳，男命兼看太阴。

## 输出格式要求（严格遵守前端渲染规范）
- 凡是段落小标题，必须单独占一行，且严格使用 \`**【小标题】**\` 格式（例如：\`**【命格定性】**\`），不要使用 \`#\` 或 \`###\`。
- 正文中需要强调的星曜名、宫位名、格局名或核心结论，使用 \`**重点内容**\` 加粗。
- 语气客观、通透、有筋骨，既有传统命理深度，又给出脚踏实地的现代行动建议（倪师强调“命由天定，运在人为”）。

---
${chartContext}`;

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...body.messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      })),
    ];

    return await streamOpenAiCompatibleSse(chatMessages, 0.7);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return createStaticSseResponse(`**【服务端异常】**\n${msg}`);
  }
}
