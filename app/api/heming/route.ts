import { NextRequest } from 'next/server';
import type { ZiweiChart } from '@/lib/ziwei/types';
import {
  HEMING_METHODOLOGY,
  STAR_IN_FUQI_GU,
  SIHUA_IN_FUQI_GU,
  HEMING_SCORE_CRITERIA,
} from '@/lib/ziwei/heming-knowledge';
import {
  type ChatMessage,
  serializeChartForPrompt,
  streamOpenAiCompatibleSse,
  createStaticSseResponse,
} from '@/lib/ai-client';

interface HemingRequestBody {
  chartA: ZiweiChart;
  chartB: ZiweiChart;
  question?: string;
}

function getFuqiKnowledgeSnippet(chart: ZiweiChart, label: string): string {
  const fuqi = chart.palaces.find(p => p.name === '夫妻宫');
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
        }`
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as HemingRequestBody;
    if (!body?.chartA?.palaces || !body?.chartB?.palaces) {
      return createStaticSseResponse('**【请求参数错误】**\n缺少甲方或乙方的完整命盘数据。');
    }

    const chartAContext = serializeChartForPrompt(body.chartA, '甲方（A）');
    const chartBContext = serializeChartForPrompt(body.chartB, '乙方（B）');
    const fuqiNotesA = getFuqiKnowledgeSnippet(body.chartA, '甲方');
    const fuqiNotesB = getFuqiKnowledgeSnippet(body.chartB, '乙方');
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

    const userPrompt = body.question?.trim()
      ? `请针对甲乙双方合盘，重点回答以下追问：「${body.question.trim()}」
请按以下结构输出：

**【核心结论】**
针对「${body.question.trim()}」给出明确、直接的合盘定性判断。

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

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    return await streamOpenAiCompatibleSse(chatMessages, 0.7);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return createStaticSseResponse(`**【服务端异常】**\n${msg}`);
  }
}
