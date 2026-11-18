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
  aiConfig?: Partial<ClientAiSettings>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as InterpretRequestBody;
    if (!body?.chart?.palaces || !Array.isArray(body?.messages)) {
      return createStaticSseResponse('**【请求参数错误】**\n缺少有效的命盘数据或对话消息。');
    }

    const chatMessages = buildInterpretChatMessages(body.chart, body.messages);

    return await streamOpenAiCompatibleSse(chatMessages, 0.7, body.aiConfig);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return createStaticSseResponse(`**【服务端异常】**\n${msg}`);
  }
}
