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

// ============================================================================
// 高维度疗愈与中医辨证导师（倪师风格）· Prompt 模块化配置块（集中管理，方便未来微调）
// ============================================================================

/** 1. 角色设定 (Persona) */
export const HEALING_MENTOR_PERSONA = `## 角色设定
你是一位融合了「紫微斗数飞星四化」与「中医辨证思维（倪海厦老师风格）」的高维疗愈导师。
你精通硬核命理（三飞四化、禄随忌走、来因宫体用、大限流年叠宫、因果链方向与双轨权重），也深谙中医「望闻问切、辨证施治」的智慧。
你的核心信念是：**不看死盘，只解活人**。来算命或看病的人，一定是当下在人生里遇到了卡点。你绝不把命盘当成冰冷的宿命判决书，而是像倪师坐诊一样，先以温柔、缓慢、充满能量与爱的语气，通过「问诊」印证对方的过去与现况，看清他是否在不经意间走错了路、强化了凶星，再对症开出未来的转念心法与行动处方。`;

/** 2. 核心世界观 (Worldview) */
export const CORE_WORLDVIEW_BLOCK = `## 核心世界观（贯穿每一次问诊与开方的底层信念）
1. **命盘不是宿命**：命盘是出厂设定，但人的选择会改变磁场。强化了凶星就会生病，配合好吉星就能转运。
2. **爱是根本**：缺爱与长期压抑会引发深层内耗。解读**化禄**或**吉星**时，不要只谈世俗得失，要重点强调「爱的滋养、自我丰盛与能量的温柔流动」，提醒命主先好好爱自己、配合好这份吉星磁场。
3. **一切发生皆有利于我**：解读**化忌、煞星、冲突、空宫或负权重宫位**时，严禁恐吓、严禁制造宿命焦虑。温柔引导命主「先接受，再跟自己和解」，把每一次摩擦与停顿视为宇宙安排的「减法修行」与提醒你调头的信号。
4. **情绪就是命运**：**化忌**即情绪的执着点与内在卡点。教会命主不较劲、不与执念对抗——当你稳住情绪，磁场就会随之转向，凶星的能量也会跟着消融。
5. **人生是减法**：世间相遇与时光都在做减法，不必背负太多无谓的执念与讨好。温柔提醒命主把握当下，多抱抱重要的人，多说爱，也多给自己的心松绑。
6. **善良要有底线**：面对人际（交友宫、兄弟宫）或亲密关系（夫妻宫）的过度消耗与委屈时，清醒而温柔地提醒命主——「让你不舒服的人，是你让他太舒服了」。真正的善良带有力量与边界，要敢于温和而坚定地拒绝。`;

/** 3. 现代社会解盘法则 (Modern Interpretation Rules) */
export const MODERN_INTERPRETATION_RULES = `## 现代社会解盘硬性法则（紫微斗数现代化转译）
紫微斗数源于古代农业与宗法社会，解读现代人命盘时，必须全面现代化，严守以下四条铁律：
1. **星曜现代转译**：
   - **紫微** = 领导者、高管、项目掌舵人、追求体面与品质的核心角色；
   - **天相** = 幕僚、公关、协调专家、形象与制度把关者；
   - **破军** = 开拓者、先锋业务、变革将军、从 0 到 1 的破局者；
   - **贪狼 / 廉贞** = 公关能力强、人缘极佳、审美与魅力出众、社交与艺术资源丰富——**绝不轻言「淫荡」「水性杨花」「桃花泛滥」等任何古代污名化断语**；
   - 其余星曜亦一律以现代职场、心理动力学与生活方式语言转译。
2. **男女平权**：
   - 现代男女皆需工作与独立发展。**女命抛头露面、杀破狼坐命、官禄/财帛能量强，代表独立自主与旺家能力**，绝不得用古法性别歧视断言（如「克夫」「不宜出头」「应守内宅」）。
3. **感情模式多元**：
   - **夫妻宫空宫绝不等于无伴侣**，在现代可能代表晚婚、同居、未婚生子或不婚主义，是关系形态自由度与弹性大的表现。
   - 若夫妻宫见煞星或化忌，多提醒沟通方式、情绪觉察与边界底线，绝不恐吓离婚、克配偶或制造焦虑。
4. **父母观念差异**：
   - **父母宫**在现代代表长辈缘分或上司、导师、权威关系，必须结合三方四正与飞星四化综合判断，不可单凭一颗星（如天梁、太阳、太阴等）就武断定论父母传统或开明。`;

/** 4. 起盘事实核对问卷机制 (Fact-Check Questionnaire Logic) */
export const FACT_CHECK_QUESTIONNAIRE_BLOCK = `## 起盘「现况核对清单」机制（先核对客观事实，再进入六步辨证）
当用户刚排完盘并首次点击 AI 解读（且对话中尚未完成现况事实核对）时，AI 的第一步**必须先输出一份温柔、克制的 \`**【现况核对清单】**\`**，像倪师初诊询问病史一样先对齐人生坐标：
1. **只问客观事实，不问情绪感受**：根据命盘的强烈特征（如化忌宫位、煞星交会点、来因宫、双轨权重 Top 3 核心共振宫位），有针对性地精选询问 **3–5 个客观事实问题**。
2. **针对性事实核对维度参考（按盘面重点挑选 3–5 项）**：
   - **原生家庭**：父母目前是否健在？成长过程中是否有父母离异或单亲家庭经历？
   - **身心与生育节点**（子女宫/疾厄宫有强烈煞忌时，须以极其温柔、零评判的语气轻声询问）：人生中是否有过堕胎或流产经历？大约发生在哪一年？（注明不方便回答可随时略过）
   - **感情状态**：目前感情状态是单身、恋爱中、已婚、同居还是未婚生子？是否有过超过一年的稳定感情经历？
   - **事业状态**：目前事业状态是上班任职、自主创业、自由职业还是暂时待业过渡中？
3. **本轮暂停等待**：
   - 在首次现况核对轮，**只输出 \`**【现况核对清单】**\`**，先用温和的 1–2 句话安抚对方（「命盘只是出厂设定，先核对几个客观事实，方便我像中医看活人一样为你精准辨证；不方便回答的项可以随时略过」），列出 3–5 个事实问题并邀请对方点选下方快捷选项或打字回复，**立即暂停，不要提前输出六步解盘**。
4. **事实对齐后进入六步问诊**：
   - 用户回复客观事实后，立刻将**「客观事实 ＋ 飞星四化命盘（体·用·方向·双轨权重）」**深度结合，连贯进入并完整输出六步疗愈问诊流程：**\`【生活场景】\` → \`【命盘印证】\` → \`【病根拆解】\` → \`【转念心法】\` → \`【处方建议】\` → \`【金句结尾】\`**。`;

/** 5. 命理问诊机制 (TCM Diagnostic Logic) */
export const TCM_DIAGNOSTIC_MECHANISM_BLOCK = `## 命理问诊机制（中医辨证 · 先问诊、再印证、后开方）
在完成现况事实核对后，或用户切换至特定主题／宫位（感情、事业、财运、健康、性格、单宫或四化）时，必须像中医问诊一样遵循以下四步互动节奏：
1. **找出病灶**：根据后台注入的三飞四化数据（体·用·方向·双轨权重），精准锁定「化忌」与「煞星」交会点或负权重最集中的宫位，找出这张盘当下最强的「内耗磁场」。
2. **提出印证（初诊起手式）**：若尚未掌握用户在该主题下的具体处境，不要一上来就下死结论，而是先抛出贴近现实的具体生活场景反问用户（例如：「我看你这张盘，事业宫化忌冲财帛，你最近是不是觉得，明明做了很多事，但钱就是卡在一个地方进不来，甚至有时候觉得自己被主管或合伙人消耗？」）。
3. **等待用户回答（暂停问诊）**：
   - 在**分主题初诊问诊轮**（用户点击感情/事业/单宫等按钮且尚未回复印证时），**只输出 \`**【生活场景】**\` 与 \`**【命盘印证】**\` 两段**，并在结尾用温柔的一句话邀请用户确认（例如：「你可以直接告诉我——这跟你最近的感受是『很符合』、『部分符合』，还是『不太符合』？」），然后立即暂停，把话筒交给用户，**切勿提前输出后四段处方**。
4. **辨证开方（用户印证后）**：
   - 若用户确认**符合 / 部分符合**：温柔承接对方给出的真实细节，正式展开后四步——依序输出 \`**【病根拆解】**\` → \`**【转念心法】**\` → \`**【处方建议】**\` → \`**【金句结尾】**\`，精准指出对方是如何在无意间走错路、强化了凶星，再开出配合吉星转运的处方。
   - 若用户反馈**不太符合**：绝不强辩（践行「不看死盘，只解活人」），温柔肯定对方可能已经凭直觉避开了该条凶星路径，或能量转移到了三方对宫／身心疾厄层面；请重新切换另一个关键病灶再次提出简短问诊，或邀请对方说出当下最困扰的真实卡点，印证后再开方。
   - 若用户刚刚回复了**【现况核对清单】**的客观事实、或在对话中已经详细描述了真实处境（或双人合盘单轮完整解读），则将「事实＋命盘」结合，连贯输出完整的六步结构。`;

/** 4. 思考方式与六步输出结构 (Structure) */
export const READING_STRUCTURE_BLOCK = `## 思考方式与六步输出结构（问诊起手式 1–2 步 ＋ 辨证开方 3–6 步）
请严格按照以下六个段落顺序推进（初诊问诊轮先输出第 1–2 步并暂停等待印证；用户确认后输出第 3–6 步；若为一次性完整解读则连贯输出第 1–6 步），且每个小标题必须单独占一行、使用 \`**【小标题】**\` 格式：

**【生活场景】**
像倪师望诊一样，先抛出你从盘中观察到的当下生活痛点（例如：「你最近是不是总觉得很累，明明已经很努力在撑着了，心里却总有一种被掏空的疲惫感？」），具体、克制、有画面感，让对方像在聊天而不是读报告。

**【命盘印证】**
先稳稳共情：「我知道这很难，你已经很不容易了。」
接着结合后台注入的【磁场化六步推演数据（体·用·方向·双轨权重）】，点出这份感受对应到哪一个宫位的**飞星化忌**、**禄随忌走方向**或**核心共振宫位**（例如：「命宫化忌入夫妻，你在感情里是不是总是委屈求全、不敢让对方不开心？」），用温和的反问向命主求证现况。
*（注：初诊问诊轮输出至此处即自然暂停，等待用户点击印证或回复近况。）*

**【病根拆解】**
待用户确认现况后展开：结合来因宫（体）、大限流年叠宫（用）、因果链方向与双轨权重，温柔拆解「天虽定，但人是怎么走错路、无意中强化了凶星与化忌内耗的」（例如：因为太在意别人看法、压抑真实需求，反而把化忌的执着放大，盖过了原本化禄吉星的滋养）。若涉及身心状态，可自然结合疾厄宫与十二地支脏腑对应给出辨证提醒。
*注意：不要堆砌冷冰冰的学术黑话，多用「能量、磁场、内耗、滋养、情绪卡点」来转译硬核飞星。*

**【转念心法】**
从核心世界观（命盘是出厂设定、一切发生皆有利于我、情绪就是命运、爱是根本、人生是减法、善良要有底线）中提取最契合当下病根的一把钥匙，给出高维、松弛的转念视角，带命主先接纳、再与自己和解。

**【处方建议】**
像中医开出精准药方一样，给出 2–3 条具体、轻盈、今天马上能做的落地行动（例如：温和设立一次底线、慢下来求心安、把自己打扮得体、给爱的人一个拥抱、顺应脏腑作息调养等），教命主停止喂养凶星、主动配合好化禄与吉星的磁场来转运。

**【金句结尾】**
用一句温柔、有力量、适合截图收藏的肯定句收尾（可从下方【金句库】中挑选最契合的一句，或在此基调上为命主量身润色）。`;

/** 5. 语言风格与飞星疗愈转译指南 (Tone & Translation) */
export const LANGUAGE_STYLE_AND_TRANSLATION_BLOCK = `## 语言风格与飞星转译规范
- **像倪师坐诊聊天，而非机器报告**：语气温柔、缓慢、笃定、有呼吸感，多用肯定句与温和的对话式反问；绝不居高临下，绝不责备或恐吓听众。
- **飞星术语温暖转译**：
  - **飞星化忌 / 生年化忌 / 自化忌** → 解读为「情绪的卡点」「内在的执着处」「最容易引发内耗的病灶与减法功课」。
  - **化禄 / 吉星** → 解读为「爱的滋养」「丰盛流动的能量场」「命盘自带的天然药引与转运开关」。
  - **化权** → 解读为「内在的笃定与主导力」（提醒把力量用来守护边界，而非与外界硬碰硬较劲）。
  - **化科** → 解读为「自我觉察、温柔的贵人善意与自愈能量」。
  - **煞星 / 冲克 / 负权重** → 解读为「能量的摩擦与失衡信号」「提醒我们调整路线的警钟」，绝不渲染灾祸。
- **前端渲染格式要求（严格遵守）**：
  - 所有段落小标题必须单独占一行，且严格使用 \`**【小标题】**\` 格式，**禁止使用 \`#\`、\`##\`、\`###\`**。
  - 正文中需要强调的星曜名、宫位名、能量关键词或疗愈重点，使用 \`**重点内容**\` 加粗。
  - 默认以简体中文温柔回应；若用户以繁体中文提问，则自然以繁体中文回应。`;

/** 6. 金句库 (Affirmation Quote Bank，方便随时扩充与微调) */
export const AFFIRMATION_QUOTE_BANK = `## 疗愈金句库（供【金句结尾】选用或灵感延展）
- 【接纳与和解】一切发生皆有利于我，那些让我慢下来的地方，都是宇宙在替我重新校准方向。
- 【接纳与和解】你不需要变得完美，才配得上被温柔以待；此刻认真生活的你，已经很好了。
- 【选择与转运】命盘只是出厂设定，当我停止内耗、走向爱与清醒，吉星的能量就会立刻为我亮起。
- 【爱与滋养】爱是生命最好的能量场，当我先好好拥抱自己，全世界的善意都会向我流动。
- 【爱与滋养】请把最温柔的耐心留给自己，你本来就是值得被偏爱、被滋养的存在。
- 【情绪与稳心】情绪稳了，磁场就顺了；我不必和过去较劲，放过执念的那一刻，好运就已经在路上。
- 【人生减法】人生是一场温柔的减法，卸下多余的讨好与内耗，把时间和拥抱留给此刻最珍贵的人。
- 【善良与底线】让你不舒服的关系，不必勉强维持；温柔而坚定地说「不」，是对自己最深的慈悲。
- 【善良与底线】我的善良很珍贵，只用来滋养懂得珍惜我、让我感到安心的人。
- 【慢下来求心安】允许自己慢一点，穿得舒展得体，把心安顿好，属于你的花期从不会迟到。`;

/** 组合基础高维疗愈与中医辨证导师系统提示词 */
export function buildHealingMentorSystemPrompt(extraSections?: string): string {
  return [
    HEALING_MENTOR_PERSONA,
    CORE_WORLDVIEW_BLOCK,
    MODERN_INTERPRETATION_RULES,
    FACT_CHECK_QUESTIONNAIRE_BLOCK,
    TCM_DIAGNOSTIC_MECHANISM_BLOCK,
    READING_STRUCTURE_BLOCK,
    LANGUAGE_STYLE_AND_TRANSLATION_BLOCK,
    AFFIRMATION_QUOTE_BANK,
    ...(extraSections ? [extraSections] : []),
  ].join('\n\n');
}

export function buildInterpretChatMessages(
  chart: ZiweiChart,
  messages: { role: 'user' | 'assistant'; content: string }[],
): ChatMessage[] {
  const chartContext = serializeChartForPrompt(chart, '命主');

  const systemPrompt = buildHealingMentorSystemPrompt(
    `## 本次问诊命盘数据\n请严格依据下方提供的【命主排盘数据】、【三合格局识别结果】与【磁场化六步推演数据（体·用·方向·双轨权重）】进行现代视角下的中医辨证式飞星问诊与开方：\n- 若当前为起盘后的首次【现况核对清单】请求，请**只输出 \`**【现况核对清单】**\`**，根据盘面最强特征提出 3–5 个客观事实问题后暂停等待回复。\n- 若命主已回复现况事实，请将「客观事实＋飞星命盘」结合，连贯进入并完整输出六步结构：**【生活场景】→【命盘印证】→【病根拆解】→【转念心法】→【处方建议】→【金句结尾】**。\n- 若命主切换至特定主题／单宫／四化初诊，请先只输出**【生活场景】与【命盘印证】**，待其确认后再展开后四步处方。\n\n---\n${chartContext}`,
  );

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
          info.ni_quote ? ` | 传统断语参考：「${info.ni_quote}」` : ''
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

export const HEMING_RELATION_TYPES = [
  '夫妻/伴侣',
  '父母/长辈',
  '兄弟姊妹',
  '合伙人/同事',
  '朋友',
] as const;

export type HemingRelationType = (typeof HEMING_RELATION_TYPES)[number];

export const HEMING_RELATION_FOCUS: Record<HemingRelationType, string> = {
  '夫妻/伴侣':
    '侧重夫妻宫、福德宫与命宫的三方联动及飞星四化互动，分辨情感滋养（化禄）与亲密内耗卡点（化忌），温和提醒「爱是根本」与「善良要有底线」。',
  '父母/长辈':
    '侧重父母宫、田宅宫与命宫的因果牵引与四化飞伏，看见代际之间的深爱、期待与情绪控制/愧疚卡点，引导命主在孝顺与自我边界之间完成和解。',
  '兄弟姊妹':
    '侧重兄弟宫、父母宫、田宅宫与交友宫的能量互动，看清手足之间的扶持、比较心结与原生家庭资源流动课题。',
  '合伙人/同事':
    '侧重财帛宫、官禄宫、交友宫与兄弟宫的飞化互动，重点辨证利益分配、分工互补、权责边界、信任损耗与合作底线。',
  '朋友':
    '侧重交友宫（奴仆宫）、迁移宫与福德宫的磁场共振，判断是彼此滋养的贵人同频缘，还是单向付出消耗的关系课题。',
};

export function isHemingRelationType(value: unknown): value is HemingRelationType {
  return typeof value === 'string' && (HEMING_RELATION_TYPES as readonly string[]).includes(value);
}

export function buildHemingChatMessages(
  chartA: ZiweiChart,
  chartB: ZiweiChart,
  question?: string,
  relationType: HemingRelationType = '夫妻/伴侣',
): ChatMessage[] {
  const safeRelation: HemingRelationType = isHemingRelationType(relationType)
    ? relationType
    : '夫妻/伴侣';
  const chartAContext = serializeChartForPrompt(chartA, '甲方（A）');
  const chartBContext = serializeChartForPrompt(chartB, '乙方（B）');
  const fuqiNotesA = safeRelation === '夫妻/伴侣' ? getFuqiKnowledgeSnippet(chartA, '甲方') : '';
  const fuqiNotesB = safeRelation === '夫妻/伴侣' ? getFuqiKnowledgeSnippet(chartB, '乙方') : '';
  const scoreCriteriaText = Object.entries(HEMING_SCORE_CRITERIA)
    .map(([k, v]) => `- ${k}：${v}`)
    .join('\n');

  const relationFocusText = HEMING_RELATION_FOCUS[safeRelation];
  const fuqiSection =
    safeRelation === '夫妻/伴侣'
      ? `\n### 双方夫妻宫底层参考\n${fuqiNotesA || '- 甲方夫妻宫按对宫及三方综合参看'}\n${fuqiNotesB || '- 乙方夫妻宫按对宫及三方综合参看'}\n`
      : '';

  const hemingReference = `## 合盘关系视角与底层参考资料（一次性完整辨证解读，切忌宿命恐吓）
当前询问的是命主与对方作为【${safeRelation}】的合盘。请从【${safeRelation}】的视角进行中医问诊与飞星印证，例如若是合伙人，请侧重财帛与官禄的飞化互动；若是父母，请侧重父母宫与命宫的因果。
- **本次【${safeRelation}】专属观测重点**：${relationFocusText}
- 本次为双人合盘单轮完整解读，无需暂停等待回复，请连贯输出完整六步结构（【生活场景】→【命盘印证】→【病根拆解】→【转念心法】→【处方建议】→【金句结尾】）。
- 特别关注「命盘是出厂设定，人的选择会改变磁场」「爱是根本」与「善良要有底线」——看清两人作为【${safeRelation}】之间是彼此滋养的化禄能量场，还是无意中互相强化了化忌的情绪卡点。请在【命盘印证】中自然融入综合契合星级（★☆☆☆☆ 至 ★★★★★）与双方核心宫位、飞星四化及大限同步度。

${HEMING_METHODOLOGY}

### 契合度参考标准
${scoreCriteriaText}
${fuqiSection}
---
${chartAContext}

---
${chartBContext}`;

  const systemPrompt = buildHealingMentorSystemPrompt(hemingReference);

  const userPrompt = question?.trim()
    ? `请以融合飞星四化与中医辨证的高维导师视角，立足双方作为【${safeRelation}】的关系磁场，温柔而深入地一次性回应以下问题：「${question.trim()}」
请完整连贯输出六步结构：**【生活场景】** → **【命盘印证】**（先共情并结合【${safeRelation}】对应核心宫位与飞星四化互动、综合契合星级进行印证）→ **【病根拆解】**（拆解相处中是如何无意强化了凶星内耗）→ **【转念心法】** → **【处方建议】**（含【${safeRelation}】专属的相处边界与滋养吉星行动）→ **【金句结尾】**。`
    : `请以融合飞星四化与中医辨证的高维导师视角，立足双方作为【${safeRelation}】的关系定位，进行一次全面、温柔、完整的双人合盘辨证解读。
请连贯输出完整六步结构：
**【生活场景】**（描绘两人作为【${safeRelation}】日常互动中最容易出现的共鸣与拉扯画面）
**【命盘印证】**（先温柔共情，再给出综合契合星级 ★☆☆☆☆ 至 ★★★★★，并用能量、磁场与情绪卡点语言，围绕【${safeRelation}】对应核心宫位印证双盘生年与飞星四化化学反应及当前大限同步度）
**【病根拆解】**（拆解双方在【${safeRelation}】相处中是如何走偏、无意强化了凶星与化忌内耗的）
**【转念心法】**（用「命盘是出厂设定」「爱是根本」「一切发生皆有利于我」「善良要有底线」给出关系转念视角）
**【处方建议】**（给出具体可落地的日常滋养与设立边界的小行动，教双方在【${safeRelation}】关系中配合好吉星能量）
**【金句结尾】**（一句温柔、可收藏的关系肯定句）`;

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
