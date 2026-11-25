import { NextRequest } from 'next/server';
import type { ZiweiChart } from '@/lib/ziwei/types';
import {
  type ClientAiSettings,
  type HemingRelationType,
  normalizeHemingRelationType,
  buildHemingChatMessages,
  streamOpenAiCompatibleSse,
  createStaticSseResponse,
} from '@/lib/ai-client';

interface HemingRequestBody {
  chartA: ZiweiChart;
  chartB: ZiweiChart;
  question?: string;
  relationType?: HemingRelationType | string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  aiConfig?: Partial<ClientAiSettings>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as HemingRequestBody;
    if (!body?.chartA?.palaces || !body?.chartB?.palaces) {
      return createStaticSseResponse('**【請求參數錯誤】**\n缺少甲方（用戶本人）或乙方（對方）的完整命盤資料。');
    }

    const relationType = normalizeHemingRelationType(body.relationType);

    const chatMessages = buildHemingChatMessages(
      body.chartA,
      body.chartB,
      body.question,
      relationType,
      body.history,
    );

    return await streamOpenAiCompatibleSse(chatMessages, 0.7, body.aiConfig);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知錯誤';
    return createStaticSseResponse(`**【伺服器異常】**\n${msg}`);
  }
}
