import { NextRequest } from 'next/server';
import type { ZiweiChart } from '@/lib/ziwei/types';
import {
  type ClientAiSettings,
  buildInterpretChatMessages,
  streamOpenAiCompatibleSse,
  createStaticSseResponse,
} from '@/lib/ai-client';

interface InterpretRequestBody {
  chart: ZiweiChart;
  messages: { role: 'user' | 'assistant'; content: string }[];
  referenceYear?: number;
  aiConfig?: Partial<ClientAiSettings>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as InterpretRequestBody;
    if (!body?.chart?.palaces || !Array.isArray(body?.messages)) {
      return createStaticSseResponse('**【请求参数错误】**\n缺少有效的命盘数据或对话消息。');
    }

    const lastUser = [...body.messages].reverse().find(m => m.role === 'user')?.content ?? '';
    const chatMessages = buildInterpretChatMessages(body.chart, body.messages, {
      referenceYear: body.referenceYear,
    });
    console.info('[api/interpret]', {
      turns: body.messages.length,
      referenceYear: body.referenceYear ?? null,
      questionPreview: lastUser.slice(0, 60),
      systemChars: chatMessages[0]?.content.length ?? 0,
    });

    return await streamOpenAiCompatibleSse(chatMessages, 0.7, body.aiConfig);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return createStaticSseResponse(`**【服务端异常】**\n${msg}`);
  }
}
