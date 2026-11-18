import { NextRequest } from 'next/server';
import type { ZiweiChart } from '@/lib/ziwei/types';
import {
  type ClientAiSettings,
  buildHemingChatMessages,
  streamOpenAiCompatibleSse,
  createStaticSseResponse,
} from '@/lib/ai-client';

interface HemingRequestBody {
  chartA: ZiweiChart;
  chartB: ZiweiChart;
  question?: string;
  aiConfig?: Partial<ClientAiSettings>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as HemingRequestBody;
    if (!body?.chartA?.palaces || !body?.chartB?.palaces) {
      return createStaticSseResponse('**【请求参数错误】**\n缺少甲方或乙方的完整命盘数据。');
    }

    const chatMessages = buildHemingChatMessages(body.chartA, body.chartB, body.question);

    return await streamOpenAiCompatibleSse(chatMessages, 0.7, body.aiConfig);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return createStaticSseResponse(`**【服务端异常】**\n${msg}`);
  }
}
