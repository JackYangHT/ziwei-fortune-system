/**
 * 飞星规则库与匹配执行器 (patterns.ts)
 *
 * 阶段 C1：《从命盘到指令集》模块二前三大人生领域（事业与职涯、财富与房产、感情婚姻与桃花）规则实现。
 */

import type { Palace, SiHua, ZiweiChart } from '../ziwei/types';
import type {
  FlyingEdge,
  FlyingRule,
  FlyingRuleHit,
  LuFollowsJiVector,
  MagneticBody,
  RawFlyingMatrix,
  RawPalaceMatrixStats,
} from './types';

/**
 * 十二宫相对于命宫逆布的固定偏移索引（0=命宫, 1=兄弟, 2=夫妻, 3=子女, 4=财帛, 5=疾厄, 6=迁移, 7=仆役/交友, 8=官禄, 9=田宅, 10=福德, 11=父母）
 * 通过 chart.palaces 动态解析对应 Palace，避免硬编码宫位中文名差异（如「仆役」vs「交友」、「命宫」vs「命宮」）。
 */
const PALACE_OFFSET = {
  ming: 0,
  xiongDi: 1,
  fuQi: 2,
  ziNv: 3,
  caiBo: 4,
  jiE: 5,
  qianYi: 6,
  puYi: 7,
  guanLu: 8,
  tianZhai: 9,
  fuDe: 10,
  fuMu: 11,
} as const;

type PalaceKey = keyof typeof PALACE_OFFSET;

function resolvePalace(chart: ZiweiChart, key: PalaceKey): Palace {
  const branch = ((chart.mingGongBranch - PALACE_OFFSET[key]) % 12 + 12) % 12;
  return (
    chart.palaces.find((p) => p.branch === branch) ?? {
      branch,
      stem: 0,
      name: '',
      stars: [],
    }
  );
}

function getPalaceStats(
  rawMatrix: RawFlyingMatrix,
  palace: Palace,
): RawPalaceMatrixStats | undefined {
  return (
    rawMatrix.byPalace[palace.branch] ??
    rawMatrix.byPalace.find((p) => p.palaceName === palace.name)
  );
}

function getSanFangSiZhengPalaces(chart: ZiweiChart, center: Palace): Palace[] {
  const b = center.branch;
  const branches = [b, (b + 4) % 12, (b + 8) % 12, (b + 6) % 12];
  return chart.palaces.filter((p) => branches.includes(p.branch));
}

function hasStarInPalace(palace: Palace, starName: string): boolean {
  return palace.stars.some((s) => s.name === starName);
}

function hasAnyStarInPalace(palace: Palace, starNames: readonly string[]): boolean {
  return palace.stars.some((s) => starNames.includes(s.name));
}

function hasStarInPalaces(palaces: readonly Palace[], starName: string): boolean {
  return palaces.some((p) => hasStarInPalace(p, starName));
}

function findEdges(
  rawMatrix: RawFlyingMatrix,
  fromPalace: Palace,
  toPalace: Palace,
  siHua?: SiHua,
): FlyingEdge[] {
  return rawMatrix.edges.filter(
    (e) =>
      e.fromPalace === fromPalace.name &&
      e.toPalace === toPalace.name &&
      (siHua === undefined || e.siHua === siHua),
  );
}

/**
 * 飞星规则表（阶段 C1：事业 6 条 + 财富 6 条 + 感情 6 条 = 18 条核心规则）
 */
export const FLYING_RULES: readonly FlyingRule[] = [
  // ============================================================================
  // 1. 事业与职涯 (career-01 ~ career-06)
  // ============================================================================
  {
    id: 'career-01',
    name: '官禄开创辅弼拱·适合创业拓荒',
    level: 'auspicious',
    description:
      '官禄宫无主星或坐守七杀、破军等开创型星曜，且三方四正有左辅、右弼拱照，具备开创事业的魄力，宜创业或独立开拓业务',
    weightDelta: 3,
    match: (ctx) => {
      const guanLu = resolvePalace(ctx.chart, 'guanLu');
      const majors = guanLu.stars.filter((s) => s.type === 'major');
      const isPioneering =
        majors.length === 0 ||
        majors.some((s) => s.name === '七杀' || s.name === '破军');
      const sanFang = getSanFangSiZhengPalaces(ctx.chart, guanLu);
      const hasZuoYou =
        hasStarInPalaces(sanFang, '左辅') && hasStarInPalaces(sanFang, '右弼');
      const hit = isPioneering && hasZuoYou;
      return {
        matched: hit,
        palaces: hit ? [guanLu.name] : undefined,
      };
    },
  },
  {
    id: 'career-02',
    name: '官禄府阴逢科·宜组织平台深耕',
    level: 'auspicious',
    description:
      '官禄宫坐守天府或太阴等稳重型星曜，且有化科落入，适合在大中型组织平台稳步发展以获取声誉与地位',
    weightDelta: 2.5,
    match: (ctx) => {
      const guanLu = resolvePalace(ctx.chart, 'guanLu');
      const guanLuStats = getPalaceStats(ctx.rawMatrix, guanLu);
      const hasSteadyStar = hasAnyStarInPalace(guanLu, ['天府', '太阴']);
      const hasKe =
        ctx.body.natalSihua['科'].palaceName === guanLu.name ||
        (guanLuStats ? guanLuStats.incoming.total.ke > 0 : false);
      const hit = hasSteadyStar && hasKe;
      return {
        matched: hit,
        palaces: hit ? [guanLu.name] : undefined,
      };
    },
  },
  {
    id: 'career-03',
    name: '官禄权科入父母·升迁得贵人提拔',
    level: 'auspicious',
    description:
      '官禄宫化权或化科飞向父母宫，代表易得长官、上级提拔或权威贵人在背后支持，考评晋升顺遂',
    weightDelta: 3,
    match: (ctx) => {
      const guanLu = resolvePalace(ctx.chart, 'guanLu');
      const fuMu = resolvePalace(ctx.chart, 'fuMu');
      const hit = ctx.rawMatrix.edges.some(
        (e) =>
          e.fromPalace === guanLu.name &&
          (e.siHua === '权' || e.siHua === '科') &&
          e.toPalace === fuMu.name,
      );
      return {
        matched: hit,
        palaces: hit ? [guanLu.name, fuMu.name] : undefined,
      };
    },
  },
  {
    id: 'career-04',
    name: '官禄忌冲财帛·劳而无功',
    level: 'inauspicious',
    description: '官禄宫化忌飞入财帛宫，工作辛苦但收入转化率偏低，易有职场透支之感',
    weightDelta: -3,
    match: (ctx) => {
      const guanLu = resolvePalace(ctx.chart, 'guanLu');
      const caiBo = resolvePalace(ctx.chart, 'caiBo');
      const hit = ctx.rawMatrix.edges.some(
        (e) =>
          e.fromPalace === guanLu.name &&
          e.siHua === '忌' &&
          e.toPalace === caiBo.name,
      );
      return {
        matched: hit,
        palaces: hit ? [guanLu.name, caiBo.name] : undefined,
      };
    },
  },
  {
    id: 'career-05',
    name: '官禄福德忌冲·职场高压身心俱疲',
    level: 'inauspicious',
    description:
      '官禄宫与福德宫发生化忌对冲或忌星交射，工作压力易直接侵蚀精神休息，身心俱疲',
    weightDelta: -3,
    match: (ctx) => {
      const guanLu = resolvePalace(ctx.chart, 'guanLu');
      const fuDe = resolvePalace(ctx.chart, 'fuDe');
      const edgeClash = ctx.rawMatrix.edges.some(
        (e) =>
          e.siHua === '忌' &&
          ((e.fromPalace === guanLu.name && e.toPalace === fuDe.name) ||
            (e.fromPalace === fuDe.name && e.toPalace === guanLu.name)),
      );
      const hit = edgeClash;
      return {
        matched: hit,
        palaces: hit ? [guanLu.name, fuDe.name] : undefined,
      };
    },
  },
  {
    id: 'career-06',
    name: '禄随忌走官禄归子女·事业成就倾注后代与合伙',
    level: 'neutral',
    description:
      '官禄宫飞星轨迹（禄随忌走）终点落在子女宫，事业打拼的成果与精力最终多倾注于子女晚辈、门生或合伙项目',
    weightDelta: 1.5,
    match: (ctx) => {
      const guanLu = resolvePalace(ctx.chart, 'guanLu');
      const ziNv = resolvePalace(ctx.chart, 'ziNv');
      const hit = ctx.vectors.some(
        (v) =>
          v.sourcePalace === guanLu.name && v.jiTargetPalace === ziNv.name,
      );
      return {
        matched: hit,
        palaces: hit ? [guanLu.name, ziNv.name] : undefined,
      };
    },
  },

  // ============================================================================
  // 2. 财富与房产 (wealth-01 ~ wealth-06)
  // ============================================================================
  {
    id: 'wealth-01',
    name: '武贪坐财得禄权·正财稳固善投资',
    level: 'auspicious',
    description:
      '财帛宫坐守武曲或贪狼，且有化禄或化权落入，代表正财根基扎实，具备专业变现与投资管理能力',
    weightDelta: 3.5,
    match: (ctx) => {
      const caiBo = resolvePalace(ctx.chart, 'caiBo');
      const caiBoStats = getPalaceStats(ctx.rawMatrix, caiBo);
      const hasWuOrTan = hasAnyStarInPalace(caiBo, ['武曲', '贪狼']);
      const hasLuOrQuan =
        ctx.body.natalSihua['禄'].palaceName === caiBo.name ||
        ctx.body.natalSihua['权'].palaceName === caiBo.name ||
        (caiBoStats
          ? caiBoStats.incoming.total.lu > 0 || caiBoStats.incoming.total.quan > 0
          : false);
      const hit = hasWuOrTan && hasLuOrQuan;
      return {
        matched: hit,
        palaces: hit ? [caiBo.name] : undefined,
      };
    },
  },
  {
    id: 'wealth-02',
    name: '财帛火贪铃贪会·偏财爆发潜能',
    level: 'auspicious',
    description:
      '财帛宫坐守贪狼且三方四正会照火星或铃星，具备偏财爆发与机会型横发潜力',
    weightDelta: 3,
    match: (ctx) => {
      const caiBo = resolvePalace(ctx.chart, 'caiBo');
      const hasTan = hasStarInPalace(caiBo, '贪狼');
      const sanFang = getSanFangSiZhengPalaces(ctx.chart, caiBo);
      const hasHuoOrLing =
        hasStarInPalaces(sanFang, '火星') || hasStarInPalaces(sanFang, '铃星');
      const hit = hasTan && hasHuoOrLing;
      return {
        matched: hit,
        palaces: hit ? [caiBo.name] : undefined,
      };
    },
  },
  {
    id: 'wealth-03',
    name: '田宅禄权激发子田线·购屋置产良机',
    level: 'auspicious',
    description:
      '田宅宫化禄或化权被激发且与对宫子女宫形成吉化联动，暗示不动产购置或资产扩充良机',
    weightDelta: 3,
    match: (ctx) => {
      const tianZhai = resolvePalace(ctx.chart, 'tianZhai');
      const ziNv = resolvePalace(ctx.chart, 'ziNv');
      const tzStats = getPalaceStats(ctx.rawMatrix, tianZhai);
      const znStats = getPalaceStats(ctx.rawMatrix, ziNv);
      const outgoingActive = tzStats
        ? tzStats.outgoing.lu > 0 || tzStats.outgoing.quan > 0
        : false;
      const tianZhaiLuQuanTriggered =
        ctx.body.natalSihua['禄'].palaceName === tianZhai.name ||
        ctx.body.natalSihua['权'].palaceName === tianZhai.name ||
        (tzStats
          ? tzStats.incoming.decadal.lu +
              tzStats.incoming.yearly.lu +
              tzStats.incoming.decadal.quan +
              tzStats.incoming.yearly.quan >
            0
          : false);
      const ziTianLineAuspicious =
        ctx.body.natalSihua['禄'].palaceName === ziNv.name ||
        ctx.body.natalSihua['权'].palaceName === ziNv.name ||
        ctx.rawMatrix.edges.some(
          (e) =>
            (e.siHua === '禄' || e.siHua === '权') &&
            ((e.fromPalace === tianZhai.name && e.toPalace === ziNv.name) ||
              (e.fromPalace === ziNv.name && e.toPalace === tianZhai.name)),
        ) ||
        (znStats
          ? znStats.incoming.decadal.lu +
              znStats.incoming.yearly.lu +
              znStats.incoming.decadal.quan +
              znStats.incoming.yearly.quan >
            0
          : false);
      const hit =
        outgoingActive && tianZhaiLuQuanTriggered && ziTianLineAuspicious;
      return {
        matched: hit,
        palaces: hit ? [tianZhai.name, ziNv.name] : undefined,
      };
    },
  },
  {
    id: 'wealth-04',
    name: '财帛化禄逢空劫·禄逢冲破财难留',
    level: 'inauspicious',
    description:
      '财帛宫有化禄落入但本宫或对宫受地空、地劫冲击，构成「禄逢冲破」，虽有进财机缘但易财来财去、难聚现成之财',
    weightDelta: -3,
    match: (ctx) => {
      const caiBo = resolvePalace(ctx.chart, 'caiBo');
      const fuDe = resolvePalace(ctx.chart, 'fuDe');
      const caiBoStats = getPalaceStats(ctx.rawMatrix, caiBo);
      const hasLu =
        ctx.body.natalSihua['禄'].palaceName === caiBo.name ||
        (caiBoStats ? caiBoStats.incoming.total.lu > 0 : false);
      const hasKongJieImpact =
        hasAnyStarInPalace(caiBo, ['地空', '地劫']) ||
        hasAnyStarInPalace(fuDe, ['地空', '地劫']);
      const hit = hasLu && hasKongJieImpact;
      return {
        matched: hit,
        palaces: hit ? [caiBo.name, fuDe.name] : undefined,
      };
    },
  },
  {
    id: 'wealth-05',
    name: '财田忌冲破库·置产或家事破财警示',
    level: 'inauspicious',
    description:
      '田宅宫见化忌且与财帛宫发生化忌飞冲，象征财库受冲击，需防因不动产、家庭开支或大宗投资失利而破耗',
    weightDelta: -3.5,
    match: (ctx) => {
      const caiBo = resolvePalace(ctx.chart, 'caiBo');
      const tianZhai = resolvePalace(ctx.chart, 'tianZhai');
      const tzStats = getPalaceStats(ctx.rawMatrix, tianZhai);
      const tianZhaiHasJi =
        ctx.body.natalSihua['忌'].palaceName === tianZhai.name ||
        (tzStats ? tzStats.incoming.total.ji > 0 : false);
      const caiTianJiEdge =
        findEdges(ctx.rawMatrix, caiBo, tianZhai, '忌').length > 0 ||
        findEdges(ctx.rawMatrix, tianZhai, caiBo, '忌').length > 0;
      const hit = tianZhaiHasJi && caiTianJiEdge;
      return {
        matched: hit,
        palaces: hit ? [caiBo.name, tianZhai.name] : undefined,
      };
    },
  },
  {
    id: 'wealth-06',
    name: '田宅忌冲或自化忌·财库漏泄防投资亏损',
    level: 'inauspicious',
    description:
      '田宅宫发生离心自化忌或受对宫子女宫向心化忌直冲，不动产与家庭储蓄易出现非预期漏泄',
    weightDelta: -3,
    match: (ctx) => {
      const tianZhai = resolvePalace(ctx.chart, 'tianZhai');
      const ziNv = resolvePalace(ctx.chart, 'ziNv');
      const tzStats = getPalaceStats(ctx.rawMatrix, tianZhai);
      const hit = tzStats
        ? tzStats.selfSihua.ji > 0 || tzStats.centripetalSihua.ji > 0
        : false;
      return {
        matched: hit,
        palaces: hit ? [tianZhai.name, ziNv.name] : undefined,
      };
    },
  },

  // ============================================================================
  // 3. 感情、婚姻与桃花 (relationship-01 ~ relationship-06)
  // ============================================================================
  {
    id: 'relationship-01',
    name: '夫妻三吉化入·正缘得力配偶条件佳',
    level: 'auspicious',
    description:
      '夫妻宫有生年化禄、化权或化科落入（或多层禄权科汇聚且无化忌破耗），配偶条件优秀，婚姻能带来助力或地位',
    weightDelta: 3,
    match: (ctx) => {
      const fuQi = resolvePalace(ctx.chart, 'fuQi');
      const fqStats = getPalaceStats(ctx.rawMatrix, fuQi);
      const natalSanJiInFuQi =
        (ctx.body.natalSihua['禄'].palaceName === fuQi.name ||
          ctx.body.natalSihua['权'].palaceName === fuQi.name ||
          ctx.body.natalSihua['科'].palaceName === fuQi.name) &&
        ctx.body.natalSihua['忌'].palaceName !== fuQi.name;
      const flyingMultiJiInFuQi = fqStats
        ? fqStats.incoming.total.lu >= 1 &&
          fqStats.incoming.total.quan >= 1 &&
          fqStats.incoming.total.ke >= 1 &&
          fqStats.incoming.total.ji === 0 &&
          fqStats.selfSihua.ji === 0
        : false;
      const hit = natalSanJiInFuQi || flyingMultiJiInFuQi;
      return {
        matched: hit,
        palaces: hit ? [fuQi.name] : undefined,
      };
    },
  },
  {
    id: 'relationship-02',
    name: '夫妻同阴逢科·伴侣温润感情和美',
    level: 'auspicious',
    description:
      '夫妻宫坐守天同或太阴，且有化科落入，代表伴侣性格温柔体贴、重情讲理，婚姻生活融洽',
    weightDelta: 2.5,
    match: (ctx) => {
      const fuQi = resolvePalace(ctx.chart, 'fuQi');
      const fqStats = getPalaceStats(ctx.rawMatrix, fuQi);
      const hasTongOrYin = hasAnyStarInPalace(fuQi, ['天同', '太阴']);
      const hasKe =
        ctx.body.natalSihua['科'].palaceName === fuQi.name ||
        (fqStats ? fqStats.incoming.total.ke > 0 : false);
      const hit = hasTongOrYin && hasKe;
      return {
        matched: hit,
        palaces: hit ? [fuQi.name] : undefined,
      };
    },
  },
  {
    id: 'relationship-03',
    name: '夫妻廉贪见忌·晚婚波折防桃花风波',
    level: 'inauspicious',
    description:
      '夫妻宫廉贞、贪狼同宫且见化忌，或夫妻宫廉贞/贪狼发生自化忌，感情易历经波折，宜晚婚并留意桃花困扰',
    weightDelta: -3.5,
    match: (ctx) => {
      const fuQi = resolvePalace(ctx.chart, 'fuQi');
      const fqStats = getPalaceStats(ctx.rawMatrix, fuQi);
      const hasBothLianTan =
        hasStarInPalace(fuQi, '廉贞') && hasStarInPalace(fuQi, '贪狼');
      const fuQiHasJi =
        ctx.body.natalSihua['忌'].palaceName === fuQi.name ||
        (fqStats ? fqStats.incoming.total.ji > 0 : false);
      const lianOrTanSelfJi = ctx.rawMatrix.edges.some(
        (e) =>
          e.layer === 'natal' &&
          e.fromPalace === fuQi.name &&
          e.isSelf &&
          e.siHua === '忌' &&
          (e.starName === '廉贞' || e.starName === '贪狼'),
      );
      const hit = (hasBothLianTan && fuQiHasJi) || lianOrTanSelfJi;
      return {
        matched: hit,
        palaces: hit ? [fuQi.name] : undefined,
      };
    },
  },
  {
    id: 'relationship-04',
    name: '夫妻交友兄弟忌禄交缠·桃花是非防第三方介入',
    level: 'inauspicious',
    description:
      '夫妻宫与交友（仆役）宫、兄弟宫形成化忌与化禄双向牵扯，暗示感情易受外人干扰或出现多角桃花是非',
    weightDelta: -3,
    match: (ctx) => {
      const fuQi = resolvePalace(ctx.chart, 'fuQi');
      const puYi = resolvePalace(ctx.chart, 'puYi');
      const xiongDi = resolvePalace(ctx.chart, 'xiongDi');
      const fuQiToOuterJi = ctx.rawMatrix.edges.some(
        (e) =>
          e.fromPalace === fuQi.name &&
          e.siHua === '忌' &&
          (e.toPalace === puYi.name || e.toPalace === xiongDi.name),
      );
      const outerToFuQiLuOrJi = ctx.rawMatrix.edges.some(
        (e) =>
          (e.fromPalace === puYi.name || e.fromPalace === xiongDi.name) &&
          (e.siHua === '禄' || e.siHua === '忌') &&
          e.toPalace === fuQi.name,
      );
      const hit = fuQiToOuterJi && outerToFuQiLuOrJi;
      return {
        matched: hit,
        palaces: hit ? [fuQi.name, puYi.name, xiongDi.name] : undefined,
      };
    },
  },
  {
    id: 'relationship-05',
    name: '夫妻忌飞父母·婆媳岳婿或长辈关系摩擦',
    level: 'inauspicious',
    description:
      '夫妻宫化忌飞向父母宫，暗示婚恋中与伴侣长辈（公婆或岳父母）观念易生摩擦，宜保持适度界限',
    weightDelta: -2.5,
    match: (ctx) => {
      const fuQi = resolvePalace(ctx.chart, 'fuQi');
      const fuMu = resolvePalace(ctx.chart, 'fuMu');
      const hit = ctx.rawMatrix.edges.some(
        (e) =>
          e.fromPalace === fuQi.name &&
          e.siHua === '忌' &&
          e.toPalace === fuMu.name,
      );
      return {
        matched: hit,
        palaces: hit ? [fuQi.name, fuMu.name] : undefined,
      };
    },
  },
  {
    id: 'relationship-06',
    name: '夫妻离心自化忌·感情疏离防聚少离多',
    level: 'inauspicious',
    description:
      '夫妻宫发生本宫离心自化忌，象征感情能量易向外耗散或内心对亲密关系缺乏安全感，需注重沟通耐心',
    weightDelta: -2.5,
    match: (ctx) => {
      const fuQi = resolvePalace(ctx.chart, 'fuQi');
      const fqStats = getPalaceStats(ctx.rawMatrix, fuQi);
      const hit = fqStats ? fqStats.selfSihua.ji > 0 : false;
      return {
        matched: hit,
        palaces: hit ? [fuQi.name] : undefined,
      };
    },
  },

  // ============================================================================
  // 4. 学业、考运与 IQ/EQ (academic-01 ~ academic-05)
  // ============================================================================
  {
    id: 'academic-01',
    name: '昌曲拱命少煞·文星拱命利考运学术',
    level: 'auspicious',
    description:
      '文昌、文曲齐聚命宫三方四正，且命宫无四煞空劫冲破，主聪明好学，利于学术深造与各类考试',
    weightDelta: 3,
    match: (ctx) => {
      const ming = resolvePalace(ctx.chart, 'ming');
      const sanFang = getSanFangSiZhengPalaces(ctx.chart, ming);
      const hasChangQu =
        hasStarInPalaces(sanFang, '文昌') && hasStarInPalaces(sanFang, '文曲');
      const mingHasHardSha = hasAnyStarInPalace(ming, [
        '擎羊',
        '陀罗',
        '火星',
        '铃星',
        '地空',
        '地劫',
      ]);
      const hit = hasChangQu && !mingHasHardSha;
      return {
        matched: hit,
        palaces: hit ? [ming.name] : undefined,
      };
    },
  },
  {
    id: 'academic-02',
    name: '阳梁昌禄会三方·金榜题名国家考运贵格',
    level: 'auspicious',
    description:
      '命宫三方四正会齐太阳、天梁、文昌与禄存（或化禄），构成阳梁昌禄格局，极利公职选拔、资格认证与竞争性大考',
    weightDelta: 4,
    match: (ctx) => {
      const ming = resolvePalace(ctx.chart, 'ming');
      const sanFang = getSanFangSiZhengPalaces(ctx.chart, ming);
      const hasYangLiangChang =
        hasStarInPalaces(sanFang, '太阳') &&
        hasStarInPalaces(sanFang, '天梁') &&
        hasStarInPalaces(sanFang, '文昌');
      const hasLuInSanFang =
        hasStarInPalaces(sanFang, '禄存') ||
        sanFang.some((p) => ctx.body.natalSihua['禄'].palaceName === p.name);
      const hit = hasYangLiangChang && hasLuInSanFang;
      return {
        matched: hit,
        palaces: hit ? [ming.name] : undefined,
      };
    },
  },
  {
    id: 'academic-03',
    name: '天机居寅申会吉·逻辑卓越善分析策划',
    level: 'auspicious',
    description:
      '天机星坐守寅宫或申宫且居命宫三方四正，同会左辅、右弼、文昌、文曲等吉星，逻辑思维与统筹策划能力卓越',
    weightDelta: 2.5,
    match: (ctx) => {
      const ming = resolvePalace(ctx.chart, 'ming');
      const sanFang = getSanFangSiZhengPalaces(ctx.chart, ming);
      const tianJiPalace = sanFang.find(
        (p) =>
          (p.branch === 2 || p.branch === 8) && hasStarInPalace(p, '天机'),
      );
      const luckyCount = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺'].filter(
        (s) => hasStarInPalaces(sanFang, s),
      ).length;
      const hit = Boolean(tianJiPalace) && luckyCount >= 2;
      return {
        matched: hit,
        palaces: hit && tianJiPalace ? [tianJiPalace.name] : undefined,
      };
    },
  },
  {
    id: 'academic-04',
    name: '福德巨门逢忌或自化忌·思虑过重易精神内耗',
    level: 'inauspicious',
    description:
      '福德宫坐守巨门且见化忌或发生离心自化忌，内心思虑繁杂，易陷入钻牛角尖与情绪内耗',
    weightDelta: -3,
    match: (ctx) => {
      const fuDe = resolvePalace(ctx.chart, 'fuDe');
      const fdStats = getPalaceStats(ctx.rawMatrix, fuDe);
      const hasJuMen = hasStarInPalace(fuDe, '巨门');
      const fuDeHasJi =
        ctx.body.natalSihua['忌'].palaceName === fuDe.name ||
        (fdStats ? fdStats.incoming.total.ji > 0 || fdStats.selfSihua.ji > 0 : false);
      const selfJiWithKong =
        (fdStats ? fdStats.selfSihua.ji > 0 : false) &&
        hasAnyStarInPalace(fuDe, ['地空', '地劫', '擎羊', '陀罗']);
      const hit = (hasJuMen && fuDeHasJi) || selfJiWithKong;
      return {
        matched: hit,
        palaces: hit ? [fuDe.name] : undefined,
      };
    },
  },
  {
    id: 'academic-05',
    name: '化科入命官·学业功名与专业声誉彰显',
    level: 'auspicious',
    description:
      '生年化科落入命宫或官禄宫（或命宫坐守昌曲且得飞星化科汇入），主学业考运顺遂、文章才华易获师长与评审赏识',
    weightDelta: 2.5,
    match: (ctx) => {
      const ming = resolvePalace(ctx.chart, 'ming');
      const guanLu = resolvePalace(ctx.chart, 'guanLu');
      const mingStats = getPalaceStats(ctx.rawMatrix, ming);
      const natalKeInMingOrGuan =
        ctx.body.natalSihua['科'].palaceName === ming.name ||
        ctx.body.natalSihua['科'].palaceName === guanLu.name;
      const flyingKeWithMingChangQu =
        (mingStats ? mingStats.incoming.total.ke > 0 : false) &&
        hasAnyStarInPalace(ming, ['文昌', '文曲']);
      const hit = natalKeInMingOrGuan || flyingKeWithMingChangQu;
      return {
        matched: hit,
        palaces: hit ? [ming.name, guanLu.name] : undefined,
      };
    },
  },

  // ============================================================================
  // 5. 身体健康与意外血光 (health-01 ~ health-05)
  // ============================================================================
  {
    id: 'health-01',
    name: '一六共宗命疾忌冲·先天体质与过劳预警',
    level: 'inauspicious',
    description:
      '命宫与疾厄宫一六共宗，两宫之间发生化忌飞冲或同受化忌煞星夹击，提示需重点养护先天体质、避免长期透支',
    weightDelta: -3.5,
    match: (ctx) => {
      const ming = resolvePalace(ctx.chart, 'ming');
      const jiE = resolvePalace(ctx.chart, 'jiE');
      const mingJiEdge =
        findEdges(ctx.rawMatrix, ming, jiE, '忌').length > 0 ||
        findEdges(ctx.rawMatrix, jiE, ming, '忌').length > 0;
      return {
        matched: mingJiEdge,
        palaces: mingJiEdge ? [ming.name, jiE.name] : undefined,
      };
    },
  },
  {
    id: 'health-02',
    name: '疾厄贪同木星受忌·肝胆代谢与免疫养护',
    level: 'inauspicious',
    description:
      '疾厄宫坐守贪狼或天同（木系关联肝胆与内分泌代谢）且受化忌冲击，宜规律作息、防范肝胆劳损与代谢失衡',
    weightDelta: -2.5,
    match: (ctx) => {
      const jiE = resolvePalace(ctx.chart, 'jiE');
      const jeStats = getPalaceStats(ctx.rawMatrix, jiE);
      const hasWoodStar = hasAnyStarInPalace(jiE, ['贪狼', '天同']);
      const hasJi =
        ctx.body.natalSihua['忌'].palaceName === jiE.name ||
        (jeStats ? jeStats.incoming.total.ji > 0 : false);
      const hit = hasWoodStar && hasJi;
      return {
        matched: hit,
        palaces: hit ? [jiE.name] : undefined,
      };
    },
  },
  {
    id: 'health-03',
    name: '疾厄太阴巨门受忌·肺系呼吸与脾胃粘膜留意',
    level: 'inauspicious',
    description:
      '疾厄宫坐守太阴或巨门（金系关联肺部、呼吸道与消化道粘膜）且受化忌冲击，换季与高压期需留意呼吸及肠胃调理',
    weightDelta: -2.5,
    match: (ctx) => {
      const jiE = resolvePalace(ctx.chart, 'jiE');
      const jeStats = getPalaceStats(ctx.rawMatrix, jiE);
      const hasMetalStar = hasAnyStarInPalace(jiE, ['太阴', '巨门']);
      const hasJi =
        ctx.body.natalSihua['忌'].palaceName === jiE.name ||
        (jeStats ? jeStats.incoming.total.ji > 0 : false);
      const hit = hasMetalStar && hasJi;
      return {
        matched: hit,
        palaces: hit ? [jiE.name] : undefined,
      };
    },
  },
  {
    id: 'health-04',
    name: '羊陀火铃入疾厄·防筋骨外伤与急性炎症',
    level: 'inauspicious',
    description:
      '疾厄宫聚守擎羊、陀罗、火星、铃星等四煞（双煞同宫或单煞配自化忌），提示留意运动外伤、外科小手术或急症发炎',
    weightDelta: -3,
    match: (ctx) => {
      const jiE = resolvePalace(ctx.chart, 'jiE');
      const jeStats = getPalaceStats(ctx.rawMatrix, jiE);
      const shaCount = ['擎羊', '陀罗', '火星', '铃星'].filter((s) =>
        hasStarInPalace(jiE, s),
      ).length;
      const hit =
        shaCount >= 2 ||
        (shaCount === 1 &&
          (jeStats
            ? jeStats.selfSihua.ji > 0 || jeStats.centripetalSihua.ji > 0
            : false));
      return {
        matched: hit,
        palaces: hit ? [jiE.name] : undefined,
      };
    },
  },
  {
    id: 'health-05',
    name: '大限流年叠忌冲疾厄·阶段性意外与手术预警',
    level: 'inauspicious',
    description:
      '大限或流年化忌飞入疾厄宫，且疾厄宫本命已有化忌或坐守四煞，构成双忌叠冲，近期尤需注意出入平安与定期体检',
    weightDelta: -4,
    match: (ctx) => {
      const jiE = resolvePalace(ctx.chart, 'jiE');
      const jeStats = getPalaceStats(ctx.rawMatrix, jiE);
      const refYear = ctx.rawMatrix.activeYearlyPalace.year;
      const hasDecadalJi = ctx.rawMatrix.edges.some(
        (e) => e.layer === 'decadal' && e.siHua === '忌' && e.toBranch === jiE.branch,
      );
      const hasYearlyJi = ctx.rawMatrix.edges.some(
        (e) => e.layer === 'yearly' && e.siHua === '忌' && e.toBranch === jiE.branch,
      );
      const dynamicJiInJiE = hasDecadalJi || hasYearlyJi;
      const baseVulnerability =
        ctx.body.natalSihua['忌'].palaceName === jiE.name ||
        (jeStats ? jeStats.incoming.natal.ji > 0 : false) ||
        hasAnyStarInPalace(jiE, ['擎羊', '陀罗', '火星', '铃星']);
      const hit = dynamicJiInJiE && baseVulnerability;
      return {
        matched: hit,
        palaces: hit ? [jiE.name] : undefined,
        detail: hit
          ? `${refYear}年${hasDecadalJi && hasYearlyJi ? '大限与流年双忌' : hasYearlyJi ? '流年化忌' : '大限化忌'}叠冲疾厄宫，叠加原局忌煞，近期需注重出入平安与身心体检`
          : undefined,
      };
    },
  },

  // ============================================================================
  // 6. 六亲缘分与复杂家族 (family-01 ~ family-05)
  // ============================================================================
  {
    id: 'family-01',
    name: '父母化权入兄弟·长辈强势主导手足家事',
    level: 'neutral',
    description:
      '父母宫化权飞向兄弟宫，象征父母长辈对家庭与手足事务掌控欲较强，或兄姐在家族中承担长辈式管束角色',
    weightDelta: 1,
    match: (ctx) => {
      const fuMu = resolvePalace(ctx.chart, 'fuMu');
      const xiongDi = resolvePalace(ctx.chart, 'xiongDi');
      const hit = findEdges(ctx.rawMatrix, fuMu, xiongDi, '权').length > 0;
      return {
        matched: hit,
        palaces: hit ? [fuMu.name, xiongDi.name] : undefined,
      };
    },
  },
  {
    id: 'family-02',
    name: '子女化忌反飞父母·隔代牵挂与家族因果债',
    level: 'inauspicious',
    description:
      '子女宫化忌反向飞入父母宫，暗示晚辈教养或健康议题易牵动长辈心力，形成隔代操劳的家族因果联结',
    weightDelta: -2.5,
    match: (ctx) => {
      const ziNv = resolvePalace(ctx.chart, 'ziNv');
      const fuMu = resolvePalace(ctx.chart, 'fuMu');
      const hit = findEdges(ctx.rawMatrix, ziNv, fuMu, '忌').length > 0;
      return {
        matched: hit,
        palaces: hit ? [ziNv.name, fuMu.name] : undefined,
      };
    },
  },
  {
    id: 'family-03',
    name: '父母紫府日月逢禄科·长辈上司器重荫护',
    level: 'auspicious',
    description:
      '父母宫坐守紫微、天府、太阳、太阴或天梁等贵曜且得生年或飞星化禄、化科拱照，主父母家教良好、职场易遇开明上司提拔',
    weightDelta: 2.5,
    match: (ctx) => {
      const fuMu = resolvePalace(ctx.chart, 'fuMu');
      const fmStats = getPalaceStats(ctx.rawMatrix, fuMu);
      const hasNobleStar = hasAnyStarInPalace(fuMu, [
        '紫微',
        '天府',
        '太阳',
        '太阴',
        '天梁',
      ]);
      const hasLuOrKe =
        ctx.body.natalSihua['禄'].palaceName === fuMu.name ||
        ctx.body.natalSihua['科'].palaceName === fuMu.name ||
        (fmStats
          ? fmStats.incoming.total.lu > 0 && fmStats.incoming.total.ke > 0
          : false);
      const hit = hasNobleStar && hasLuOrKe;
      return {
        matched: hit,
        palaces: hit ? [fuMu.name] : undefined,
      };
    },
  },
  {
    id: 'family-04',
    name: '兄弟羊陀逢忌·手足同辈竞争防财务摩擦',
    level: 'inauspicious',
    description:
      '兄弟宫见擎羊或陀罗且有化忌落入，手足或亲密同辈间立场较刚硬，合作与财务往来宜账目分明',
    weightDelta: -3,
    match: (ctx) => {
      const xiongDi = resolvePalace(ctx.chart, 'xiongDi');
      const xdStats = getPalaceStats(ctx.rawMatrix, xiongDi);
      const hasYangTuo = hasAnyStarInPalace(xiongDi, ['擎羊', '陀罗']);
      const hasJi =
        ctx.body.natalSihua['忌'].palaceName === xiongDi.name ||
        (xdStats ? xdStats.incoming.total.ji > 0 : false);
      const hit = hasYangTuo && hasJi;
      return {
        matched: hit,
        palaces: hit ? [xiongDi.name] : undefined,
      };
    },
  },
  {
    id: 'family-05',
    name: '父兄子三宫飞禄互通·家族凝聚互相扶持',
    level: 'auspicious',
    description:
      '父母宫与兄弟宫、子女宫之间形成双向化禄或禄科回流，家族内部资源与情感纽带紧密，关键时刻能彼此托底',
    weightDelta: 2,
    match: (ctx) => {
      const fuMu = resolvePalace(ctx.chart, 'fuMu');
      const xiongDi = resolvePalace(ctx.chart, 'xiongDi');
      const ziNv = resolvePalace(ctx.chart, 'ziNv');
      const fuMuOutLu = ctx.rawMatrix.edges.some(
        (e) =>
          e.fromPalace === fuMu.name &&
          e.siHua === '禄' &&
          (e.toPalace === xiongDi.name || e.toPalace === ziNv.name),
      );
      const backLuOrKe = ctx.rawMatrix.edges.some(
        (e) =>
          (e.fromPalace === xiongDi.name || e.fromPalace === ziNv.name) &&
          (e.siHua === '禄' || e.siHua === '科') &&
          e.toPalace === fuMu.name,
      );
      const hit = fuMuOutLu && backLuOrKe;
      return {
        matched: hit,
        palaces: hit ? [fuMu.name, xiongDi.name, ziNv.name] : undefined,
      };
    },
  },

  // ============================================================================
  // 7. 职场江湖与人际关系 (social-01 ~ social-05)
  // ============================================================================
  {
    id: 'social-01',
    name: '兄弟辅弼拱照无忌·平级同侪互助合拍',
    level: 'auspicious',
    description:
      '兄弟宫坐守左辅或右弼（或三方四正左辅右弼同会）且无生年忌与自化忌破耗，职场同级与盟友间协同顺畅',
    weightDelta: 2.5,
    match: (ctx) => {
      const xiongDi = resolvePalace(ctx.chart, 'xiongDi');
      const xdStats = getPalaceStats(ctx.rawMatrix, xiongDi);
      const sanFang = getSanFangSiZhengPalaces(ctx.chart, xiongDi);
      const hasFuBi =
        hasAnyStarInPalace(xiongDi, ['左辅', '右弼']) ||
        (hasStarInPalaces(sanFang, '左辅') && hasStarInPalaces(sanFang, '右弼'));
      const noBadJi =
        ctx.body.natalSihua['忌'].palaceName !== xiongDi.name &&
        (xdStats ? xdStats.selfSihua.ji === 0 : true);
      const hit = hasFuBi && noBadJi;
      return {
        matched: hit,
        palaces: hit ? [xiongDi.name] : undefined,
      };
    },
  },
  {
    id: 'social-02',
    name: '交友坐吉得禄科·贵人广聚下属得力',
    level: 'auspicious',
    description:
      '交友（仆役）宫坐左辅、右弼、天魁或天钺，且有化禄或化科飞入，社交人脉层次佳，易得得力助手与客户支持',
    weightDelta: 3,
    match: (ctx) => {
      const puYi = resolvePalace(ctx.chart, 'puYi');
      const pyStats = getPalaceStats(ctx.rawMatrix, puYi);
      const hasLuckyStar = hasAnyStarInPalace(puYi, [
        '左辅',
        '右弼',
        '天魁',
        '天钺',
      ]);
      const hasLuOrKe =
        ctx.body.natalSihua['禄'].palaceName === puYi.name ||
        ctx.body.natalSihua['科'].palaceName === puYi.name ||
        (pyStats
          ? pyStats.incoming.total.lu > 0 || pyStats.incoming.total.ke > 0
          : false);
      const hit = hasLuckyStar && hasLuOrKe;
      return {
        matched: hit,
        palaces: hit ? [puYi.name] : undefined,
      };
    },
  },
  {
    id: 'social-03',
    name: '交友化忌冲命财·慎防人际背刺与合作损财',
    level: 'inauspicious',
    description:
      '交友（仆役）宫化忌飞入命宫或财帛宫，提示在合伙、借贷及核心业务授权上需立契留痕，防范损友拖累',
    weightDelta: -3.5,
    match: (ctx) => {
      const puYi = resolvePalace(ctx.chart, 'puYi');
      const ming = resolvePalace(ctx.chart, 'ming');
      const caiBo = resolvePalace(ctx.chart, 'caiBo');
      const hit = ctx.rawMatrix.edges.some(
        (e) =>
          e.fromPalace === puYi.name &&
          e.siHua === '忌' &&
          (e.toPalace === ming.name || e.toPalace === caiBo.name),
      );
      return {
        matched: hit,
        palaces: hit ? [puYi.name, ming.name, caiBo.name] : undefined,
      };
    },
  },
  {
    id: 'social-04',
    name: '交友迁移夫妻飞化交织·社交繁盛防外部利益纠葛',
    level: 'inauspicious',
    description:
      '交友（仆役）宫与迁移宫、夫妻宫形成双向飞星牵动，外务应酬与人脉流动频繁，合作中宜厘清公私与感情边界',
    weightDelta: -1.5,
    match: (ctx) => {
      const puYi = resolvePalace(ctx.chart, 'puYi');
      const qianYi = resolvePalace(ctx.chart, 'qianYi');
      const fuQi = resolvePalace(ctx.chart, 'fuQi');
      const puYiToQian = ctx.rawMatrix.edges.some(
        (e) =>
          e.fromPalace === puYi.name &&
          (e.siHua === '禄' || e.siHua === '忌') &&
          e.toPalace === qianYi.name,
      );
      const fuQiLink = ctx.rawMatrix.edges.some(
        (e) =>
          (e.siHua === '禄' || e.siHua === '忌') &&
          ((e.fromPalace === puYi.name && e.toPalace === fuQi.name) ||
            (e.fromPalace === fuQi.name && e.toPalace === puYi.name) ||
            (e.fromPalace === qianYi.name && e.toPalace === fuQi.name)),
      );
      const hit = puYiToQian && fuQiLink;
      return {
        matched: hit,
        palaces: hit ? [puYi.name, qianYi.name, fuQi.name] : undefined,
      };
    },
  },
  {
    id: 'social-05',
    name: '兄友羊陀空劫逢忌·职场江湖防小人暗算',
    level: 'inauspicious',
    description:
      '兄弟宫或交友（仆役）宫同见擎羊/陀罗与地空/地劫且有化忌落入，需提防职场暗箭、口舌构陷或盟友失信',
    weightDelta: -3.5,
    match: (ctx) => {
      const xiongDi = resolvePalace(ctx.chart, 'xiongDi');
      const puYi = resolvePalace(ctx.chart, 'puYi');
      const checkPalace = (p: Palace): boolean => {
        const st = getPalaceStats(ctx.rawMatrix, p);
        const hasYangTuo = hasAnyStarInPalace(p, ['擎羊', '陀罗']);
        const hasKongJie = hasAnyStarInPalace(p, ['地空', '地劫']);
        const hasJi =
          ctx.body.natalSihua['忌'].palaceName === p.name ||
          (st ? st.incoming.total.ji > 0 : false);
        return hasYangTuo && hasKongJie && hasJi;
      };
      const xdHit = checkPalace(xiongDi);
      const pyHit = checkPalace(puYi);
      const hit = xdHit || pyHit;
      return {
        matched: hit,
        palaces: hit
          ? [
              ...(xdHit ? [xiongDi.name] : []),
              ...(pyHit ? [puYi.name] : []),
            ]
          : undefined,
      };
    },
  },

  // ============================================================================
  // 8. 时间应期与叠宫共振 (timing-01 ~ timing-06)
  // ============================================================================
  {
    id: 'timing-01',
    name: '大限忌叠流年忌冲命宫·双忌夹冲命',
    level: 'inauspicious',
    description:
      '流年与大限的化忌同时冲击命宫，当年易有较大变动或身心内耗，提醒慢下来',
    weightDelta: -4.0,
    match: (ctx) => {
      const ming = resolvePalace(ctx.chart, 'ming');
      const qianYi = resolvePalace(ctx.chart, 'qianYi');
      const refYear = ctx.rawMatrix.activeYearlyPalace.year;
      const decadalJi = ctx.rawMatrix.edges.find(
        (e) => e.layer === 'decadal' && e.siHua === '忌',
      );
      const yearlyJi = ctx.rawMatrix.edges.find(
        (e) => e.layer === 'yearly' && e.siHua === '忌',
      );
      if (!decadalJi || !yearlyJi) return { matched: false };

      const mingAxis = new Set([ming.branch, qianYi.branch]);
      const bothImpactMing =
        mingAxis.has(decadalJi.toBranch) && mingAxis.has(yearlyJi.toBranch);

      const leftBranch = (ming.branch + 11) % 12;
      const rightBranch = (ming.branch + 1) % 12;
      const clampMing =
        (decadalJi.toBranch === leftBranch && yearlyJi.toBranch === rightBranch) ||
        (decadalJi.toBranch === rightBranch && yearlyJi.toBranch === leftBranch);

      const hit = bothImpactMing || clampMing;
      return {
        matched: hit,
        palaces: hit
          ? Array.from(new Set([ming.name, decadalJi.toPalace, yearlyJi.toPalace]))
          : undefined,
        detail: hit
          ? `${refYear}年大限${decadalJi.starName}忌与流年${yearlyJi.starName}忌${clampMing ? '夹制' : '叠冲'}命宫，当年易有较大变动或身心内耗，提醒慢下来`
          : undefined,
      };
    },
  },
  {
    id: 'timing-02',
    name: '流年禄入大限忌宫·因祸得福',
    level: 'auspicious',
    description: '大限的压力点在今年迎来了化禄的滋养，是转机之年',
    weightDelta: 2.5,
    match: (ctx) => {
      const refYear = ctx.rawMatrix.activeYearlyPalace.year;
      const decadalJi = ctx.rawMatrix.edges.find(
        (e) => e.layer === 'decadal' && e.siHua === '忌',
      );
      const yearlyLu = ctx.rawMatrix.edges.find(
        (e) => e.layer === 'yearly' && e.siHua === '禄',
      );
      if (!decadalJi || !yearlyLu) return { matched: false };

      const hit = yearlyLu.toBranch === decadalJi.toBranch;
      return {
        matched: hit,
        palaces: hit ? [decadalJi.toPalace] : undefined,
        detail: hit
          ? `${refYear}年流年${yearlyLu.starName}化禄飞入大限化忌所在【${decadalJi.toPalace}】，大限压力点迎来化禄滋养，是因祸得福的转机之年`
          : undefined,
      };
    },
  },
  {
    id: 'timing-03',
    name: '流年忌冲大限命宫·换跑道',
    level: 'inauspicious',
    description: '今年容易有职涯或环境的变动，顺势而为即可',
    weightDelta: -3.0,
    match: (ctx) => {
      const activeDecadal = ctx.rawMatrix.activeDecadalPalace;
      const refYear = ctx.rawMatrix.activeYearlyPalace.year;
      const yearlyJi = ctx.rawMatrix.edges.find(
        (e) => e.layer === 'yearly' && e.siHua === '忌',
      );
      if (!activeDecadal || !yearlyJi) return { matched: false };

      const decadalMingBranch = activeDecadal.branch;
      const decadalOppositeBranch = (decadalMingBranch + 6) % 12;
      const hit =
        yearlyJi.toBranch === decadalMingBranch ||
        yearlyJi.toBranch === decadalOppositeBranch;
      return {
        matched: hit,
        palaces: hit
          ? Array.from(new Set([activeDecadal.palaceName, yearlyJi.toPalace]))
          : undefined,
        detail: hit
          ? `${refYear}年流年${yearlyJi.starName}化忌入【${yearlyJi.toPalace}】直冲大限命宫【${activeDecadal.palaceName}】，当年易有职涯或环境变动，顺势而为即可`
          : undefined,
      };
    },
  },
  {
    id: 'timing-04',
    name: '大限流年双禄交会财帛或官禄·爆发之年',
    level: 'auspicious',
    description: '事业或财运迎来双重加持，适合把握机会',
    weightDelta: 4.0,
    match: (ctx) => {
      const caiBo = resolvePalace(ctx.chart, 'caiBo');
      const guanLu = resolvePalace(ctx.chart, 'guanLu');
      const fuDe = resolvePalace(ctx.chart, 'fuDe');
      const fuQi = resolvePalace(ctx.chart, 'fuQi');
      const refYear = ctx.rawMatrix.activeYearlyPalace.year;

      const decadalLu = ctx.rawMatrix.edges.find(
        (e) => e.layer === 'decadal' && e.siHua === '禄',
      );
      const yearlyLu = ctx.rawMatrix.edges.find(
        (e) => e.layer === 'yearly' && e.siHua === '禄',
      );
      if (!decadalLu || !yearlyLu) return { matched: false };

      const coreWealthCareer = new Set([caiBo.branch, guanLu.branch]);
      const axisWealthCareer = new Set([
        caiBo.branch,
        guanLu.branch,
        fuDe.branch,
        fuQi.branch,
      ]);

      // 双禄均落入财官轴线（财帛/官禄及其对宫福德/夫妻），且至少一禄直接坐入财帛或官禄
      const hit =
        axisWealthCareer.has(decadalLu.toBranch) &&
        axisWealthCareer.has(yearlyLu.toBranch) &&
        (coreWealthCareer.has(decadalLu.toBranch) ||
          coreWealthCareer.has(yearlyLu.toBranch));

      return {
        matched: hit,
        palaces: hit
          ? Array.from(new Set([decadalLu.toPalace, yearlyLu.toPalace]))
          : undefined,
        detail: hit
          ? `${refYear}年大限${decadalLu.starName}禄与流年${yearlyLu.starName}禄交会财官线（【${decadalLu.toPalace}】、【${yearlyLu.toPalace}】），事业或财运迎来双重加持，适合把握机会`
          : undefined,
      };
    },
  },
  {
    id: 'timing-05',
    name: '流年科权入夫妻或官禄·名声与升迁',
    level: 'auspicious',
    description:
      '流年化科或化权飞入夫妻宫或官禄宫，主当年声誉彰显、升迁考评或重要关系推进顺利',
    weightDelta: 3.0,
    match: (ctx) => {
      const fuQi = resolvePalace(ctx.chart, 'fuQi');
      const guanLu = resolvePalace(ctx.chart, 'guanLu');
      const refYear = ctx.rawMatrix.activeYearlyPalace.year;
      const hitEdges = ctx.rawMatrix.edges.filter(
        (e) =>
          e.layer === 'yearly' &&
          (e.siHua === '权' || e.siHua === '科') &&
          (e.toBranch === fuQi.branch || e.toBranch === guanLu.branch),
      );
      const hit = hitEdges.length > 0;
      return {
        matched: hit,
        palaces: hit
          ? Array.from(new Set(hitEdges.map((e) => e.toPalace)))
          : undefined,
        detail: hit
          ? `${refYear}年流年${hitEdges.map((e) => `${e.starName}化${e.siHua}入【${e.toPalace}】`).join('、')}，利于名声彰显、升迁或关系进阶`
          : undefined,
      };
    },
  },
  {
    id: 'timing-06',
    name: '大限流年叠禄入疾厄·修复与调养',
    level: 'neutral',
    description: '今年是调理身体、修复旧疾的好时机',
    weightDelta: 1.0,
    match: (ctx) => {
      const jiE = resolvePalace(ctx.chart, 'jiE');
      const fuMu = resolvePalace(ctx.chart, 'fuMu');
      const refYear = ctx.rawMatrix.activeYearlyPalace.year;
      const decadalLu = ctx.rawMatrix.edges.find(
        (e) => e.layer === 'decadal' && e.siHua === '禄',
      );
      const yearlyLu = ctx.rawMatrix.edges.find(
        (e) => e.layer === 'yearly' && e.siHua === '禄',
      );
      if (!decadalLu || !yearlyLu) return { matched: false };

      const fuJiAxis = new Set([jiE.branch, fuMu.branch]);
      // 大限禄与流年禄同入疾厄，或落于父疾轴线照会疾厄（至少一禄直入疾厄）
      const hit =
        fuJiAxis.has(decadalLu.toBranch) &&
        fuJiAxis.has(yearlyLu.toBranch) &&
        (decadalLu.toBranch === jiE.branch || yearlyLu.toBranch === jiE.branch);

      return {
        matched: hit,
        palaces: hit
          ? Array.from(new Set([jiE.name, decadalLu.toPalace, yearlyLu.toPalace]))
          : undefined,
        detail: hit
          ? `${refYear}年大限${decadalLu.starName}禄与流年${yearlyLu.starName}禄叠照疾厄宫，是调理身体、修复旧疾的好时机`
          : undefined,
      };
    },
  },
];

/**
 * 执行飞星规则判定
 */
export function evaluateFlyingRules(
  ctx: {
    chart: ZiweiChart;
    body: MagneticBody;
    rawMatrix: RawFlyingMatrix;
    vectors: LuFollowsJiVector[];
  },
  rules: readonly FlyingRule[] = FLYING_RULES,
): FlyingRuleHit[] {
  const hits: FlyingRuleHit[] = [];
  for (const rule of rules) {
    const res = rule.match(ctx);
    if (res.matched) {
      hits.push({
        id: rule.id,
        name: rule.name,
        level: rule.level,
        palaces: res.palaces ?? [],
        weightDelta: rule.weightDelta,
        detail: res.detail ?? rule.description,
      });
    }
  }
  return hits;
}
