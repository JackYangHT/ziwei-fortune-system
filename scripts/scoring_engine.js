/**
 * 紫微斗數 流日評分引擎 (Zi Wei Dou Shu Daily Scoring Engine) - 重構統一升級版
 * 
 * 核心升級要求：
 * 1. 所有「見某星」的規則：本宮見 +3，三方四正見 +1，可疊加。
 * 2. 所有「同時存在」的規則：跨宮並見（如命見貪狼、夫見咸池；福德見廉貞、命宮見貪狼）也可觸發。
 * 3. 加入「流日神煞」的全面判斷（流日咸池、流日紅鸞、流日天喜、流日祿存、流日魁鉞）。
 * 4. 本命星曜與流日神煞獨立計算疊加（雙星疊會加倍生效），拉開分數區間，避免分數紮堆與日期過度集中。
 */

// 12 地支常數順序
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 繁簡星曜對照表
const CHAR_MAP = {
  '破軍': '破军', '破军': '破軍',
  '貪狼': '贪狼', '贪狼': '貪狼',
  '廉貞': '廉贞', '廉贞': '廉貞',
  '紅鸞': '红鸾', '红鸾': '紅鸞',
  '天鉞': '天钺', '天钺': '天鉞',
  '左輔': '左辅', '左辅': '左輔',
  '祿存': '禄存', '禄存': '祿存',
  '七殺': '七杀', '七杀': '七殺',
  '陀羅': '陀罗', '陀罗': '陀羅',
  '日祿': '日禄', '日禄': '日祿',
  '日鉞': '日钺', '日钺': '日鉞',
  '日鸞': '日鸾', '日鸾': '日鸞'
};

// 1. 流日神煞咸池（桃花）：申子辰在酉，寅午戌在卯，巳酉丑在午，亥卯未在子
function getDailyXianchiBranch(b) {
  if (['申', '子', '辰'].includes(b)) return '酉';
  if (['寅', '午', '戌'].includes(b)) return '卯';
  if (['巳', '酉', '丑'].includes(b)) return '午';
  if (['亥', '卯', '未'].includes(b)) return '子';
  return '';
}

// 2. 流日神煞紅鸞、天喜：卯起子逆數至日支，天喜在紅鸞對宮
const HONGLUAN_MAP = {
  '子': '卯', '丑': '寅', '寅': '丑', '卯': '子', '辰': '亥', '巳': '戌',
  '午': '酉', '未': '申', '申': '未', '酉': '午', '戌': '巳', '亥': '辰'
};
const DUI_MAP = {
  '子': '午', '丑': '未', '寅': '申', '卯': '酉', '辰': '戌', '巳': '亥',
  '午': '子', '未': '丑', '申': '寅', '酉': '卯', '戌': '辰', '亥': '巳'
};

// 3. 流日祿存：甲祿在寅，乙祿在卯，丙戊祿在巳，丁己祿在午，庚祿在申，辛祿在酉，壬祿在亥，癸祿在子
const LUCUN_MAP = {
  '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午', '戊': '巳',
  '己': '午', '庚': '申', '辛': '酉', '壬': '亥', '癸': '子'
};

// 4. 流日魁鉞：甲戊庚牛羊，乙己鼠猴鄉，丙丁豬雞位，壬癸兔蛇藏，六辛逢馬虎
const KUAI_YUE_MAP = {
  '甲': { kui: '丑', yue: '未' },
  '戊': { kui: '丑', yue: '未' },
  '庚': { kui: '丑', yue: '未' },
  '乙': { kui: '子', yue: '申' },
  '己': { kui: '子', yue: '申' },
  '丙': { kui: '亥', yue: '酉' },
  '丁': { kui: '亥', yue: '酉' },
  '壬': { kui: '卯', yue: '巳' },
  '癸': { kui: '卯', yue: '巳' },
  '辛': { kui: '午', yue: '寅' }
};

// 三方四正宮位地支 (對宮 + 兩三合宮)
function getSanFangSiZhengBranches(branch) {
  const idx = BRANCHES.indexOf(branch);
  if (idx === -1) return { ben: branch, dui: '', he1: '', he2: '', sanFangOthers: [] };
  const dui = BRANCHES[(idx + 6) % 12];
  const he1 = BRANCHES[(idx + 4) % 12];
  const he2 = BRANCHES[(idx + 8) % 12];
  return { ben: branch, dui, he1, he2, sanFangOthers: [dui, he1, he2] };
}

function getPalaceByBranch(day, branch) {
  if (!day || !branch) return null;
  if (day.palacesByBranch && day.palacesByBranch[branch]) {
    return day.palacesByBranch[branch];
  }
  const palaceKeys = [
    'dailyMing', 'dailyXiongdi', 'dailyFuqi', 'dailyZinv', 'dailyCaibo',
    'dailyJie', 'dailyQianyi', 'dailyPuyi', 'dailyGuanlu', 'dailyTianzhai',
    'dailyFude', 'dailyFumu'
  ];
  for (const k of palaceKeys) {
    if (day[k] && day[k].earthlyBranch === branch) return day[k];
  }
  return null;
}

// 提取本命星曜
function extractNatalStars(palace) {
  const set = new Set();
  if (!palace) return set;
  function add(name) {
    if (!name) return;
    set.add(name);
    if (CHAR_MAP[name]) set.add(CHAR_MAP[name]);
  }
  (palace.majorStars || []).forEach(s => add(typeof s === 'string' ? s : s.name));
  (palace.minorStars || []).forEach(s => add(typeof s === 'string' ? s : s.name));
  (palace.adjectiveStars || []).forEach(s => add(typeof s === 'string' ? s : s.name));
  if (palace.changsheng12) add(palace.changsheng12);
  return set;
}

// 提取流日神煞
function extractDailyShensha(palace, day) {
  const set = new Set();
  if (!palace || !day) return set;
  function add(name) {
    if (!name) return;
    set.add(name);
    if (CHAR_MAP[name]) set.add(CHAR_MAP[name]);
  }

  if (palace.dailyStars) {
    palace.dailyStars.forEach(s => {
      const name = typeof s === 'string' ? s : s.name;
      if (name === '日禄' || name === '日祿') { add('禄存'); add('祿存'); add('日禄'); }
      if (name === '日魁') { add('天魁'); add('日魁'); }
      if (name === '日钺' || name === '日鉞') { add('天钺'); add('天鉞'); add('日钺'); }
      if (name === '日羊') { add('擎羊'); add('日羊'); }
      if (name === '日陀') { add('陀罗'); add('陀羅'); add('日陀'); }
      if (name === '日鸾') { add('红鸾'); add('紅鸞'); add('日鸾'); }
      if (name === '日喜') { add('天喜'); add('日喜'); }
      if (name === '日昌') { add('文昌'); add('日昌'); }
      if (name === '日曲') { add('文曲'); add('日曲'); }
    });
  }

  if (day.dailyGanZhi) {
    const dailyStem = day.dailyGanZhi[0];
    const dailyBranch = day.dailyGanZhi.slice(-1);
    const pBranch = palace.earthlyBranch;

    if (getDailyXianchiBranch(dailyBranch) === pBranch) {
      add('咸池'); add('流日咸池');
    }
    if (HONGLUAN_MAP[dailyBranch] === pBranch) {
      add('红鸾'); add('紅鸞'); add('流日红鸾');
    }
    const hl = HONGLUAN_MAP[dailyBranch];
    if (hl && DUI_MAP[hl] === pBranch) {
      add('天喜'); add('流日天喜');
    }
    if (LUCUN_MAP[dailyStem] === pBranch) {
      add('禄存'); add('祿存'); add('流日禄存');
    }
    const ky = KUAI_YUE_MAP[dailyStem];
    if (ky) {
      if (ky.kui === pBranch) { add('天魁'); add('流日天魁'); }
      if (ky.yue === pBranch) { add('天钺'); add('天鉞'); add('流日天钺'); }
    }
  }

  return set;
}

// 提取宮位全部星曜（包含本命與流日）
function getAllPalaceStars(palace, day) {
  const s1 = extractNatalStars(palace);
  const s2 = extractDailyShensha(palace, day);
  return new Set([...s1, ...s2]);
}

/**
 * 評估星曜規則（支援本命星與流日神煞獨立判定與雙星疊會）：
 * 本宮見 +3，三方四正見 +1，雙星疊會加倍生效
 */
function evaluateStarRule(day, primaryPalaces, starAliases, ruleLabel) {
  let score = 0;
  const details = [];
  const validPrimary = (Array.isArray(primaryPalaces) ? primaryPalaces : [primaryPalaces]).filter(Boolean);
  if (validPrimary.length === 0) return { score, details };

  const aliases = Array.isArray(starAliases) ? starAliases : [starAliases];
  const starName = aliases[0];
  const primaryBranches = new Set(validPrimary.map(p => p.earthlyBranch));

  // 1. 本宮見 (本命見 +3, 流日神煞見 +3, 雙星疊會 +6)
  validPrimary.forEach(p => {
    const ns = extractNatalStars(p);
    const ds = extractDailyShensha(p, day);
    const hasNatal = aliases.some(s => ns.has(s));
    const hasDaily = aliases.some(s => ds.has(s));

    if (hasNatal && hasDaily) {
      score += 6;
      details.push({ rule: `${ruleLabel}本宮雙星疊會見${starName}(本命+流日)`, points: 6 });
    } else if (hasNatal) {
      score += 3;
      details.push({ rule: `${ruleLabel}本宮見本命${starName}`, points: 3 });
    } else if (hasDaily) {
      score += 3;
      details.push({ rule: `${ruleLabel}本宮見流日${starName}`, points: 3 });
    }
  });

  // 2. 三方四正見 (本命見 +1, 流日神煞見 +1, 雙星疊會 +2)
  const surroundingBranches = new Set();
  validPrimary.forEach(p => {
    const { sanFangOthers } = getSanFangSiZhengBranches(p.earthlyBranch);
    sanFangOthers.forEach(b => {
      if (!primaryBranches.has(b)) surroundingBranches.add(b);
    });
  });

  surroundingBranches.forEach(b => {
    const p = getPalaceByBranch(day, b);
    if (p) {
      const ns = extractNatalStars(p);
      const ds = extractDailyShensha(p, day);
      const hasNatal = aliases.some(s => ns.has(s));
      const hasDaily = aliases.some(s => ds.has(s));
      const pTitle = p.natalPalace || p.earthlyBranch;

      if (hasNatal && hasDaily) {
        score += 2;
        details.push({ rule: `${ruleLabel}三方四正(${pTitle})見雙星疊會${starName}`, points: 2 });
      } else if (hasNatal) {
        score += 1;
        details.push({ rule: `${ruleLabel}三方四正(${pTitle})見本命${starName}`, points: 1 });
      } else if (hasDaily) {
        score += 1;
        details.push({ rule: `${ruleLabel}三方四正(${pTitle})見流日${starName}`, points: 1 });
      }
    }
  });

  return { score, details };
}

/**
 * 評估四化規則：本宮見 +3 (忌 -3)，三方四正見 +1 (忌 -1)
 */
function evaluateMutagenRule(day, primaryPalaces, mutagenType, ruleLabel) {
  let score = 0;
  const details = [];
  const validPrimary = (Array.isArray(primaryPalaces) ? primaryPalaces : [primaryPalaces]).filter(Boolean);
  if (validPrimary.length === 0) return { score, details };

  const isJi = mutagenType.includes('忌');
  const benPts = isJi ? -3 : 3;
  const surPts = isJi ? -1 : 1;
  const primaryBranches = new Set(validPrimary.map(p => p.earthlyBranch));

  const dailySiHua = day.dailySiHua || {};
  const t = mutagenType.replace('化', '');
  let targetStar = '';
  if (t === '祿' || t === '禄') targetStar = dailySiHua['化禄'] || dailySiHua['化祿'] || '';
  if (t === '權' || t === '权') targetStar = dailySiHua['化权'] || dailySiHua['化權'] || '';
  if (t === '科') targetStar = dailySiHua['化科'] || '';
  if (t === '忌') targetStar = dailySiHua['化忌'] || '';

  if (!targetStar) return { score, details };
  const targetAlt = CHAR_MAP[targetStar] || targetStar;

  function palaceHasTarget(p) {
    const stars = [...(p.majorStars || []), ...(p.minorStars || [])];
    return stars.some(s => {
      const n = typeof s === 'string' ? s : s.name;
      return n === targetStar || n === targetAlt;
    });
  }

  // 1. 本宮見
  validPrimary.forEach(p => {
    if (palaceHasTarget(p)) {
      score += benPts;
      details.push({ rule: `${ruleLabel}本宮見流日${mutagenType}(${targetStar})`, points: benPts });
    }
  });

  // 2. 三方四正見
  const surroundingBranches = new Set();
  validPrimary.forEach(p => {
    const { sanFangOthers } = getSanFangSiZhengBranches(p.earthlyBranch);
    sanFangOthers.forEach(b => {
      if (!primaryBranches.has(b)) surroundingBranches.add(b);
    });
  });

  surroundingBranches.forEach(b => {
    const p = getPalaceByBranch(day, b);
    if (p && palaceHasTarget(p)) {
      score += surPts;
      const pTitle = p.natalPalace || p.earthlyBranch;
      details.push({ rule: `${ruleLabel}三方四正(${pTitle})見流日${mutagenType}(${targetStar})`, points: surPts });
    }
  });

  return { score, details };
}

/**
 * 1. 偏財日評分
 * 流日財帛宮見化祿+3、見貪狼+2、見破軍+2、見武曲+2、見化忌-3、命宮見祿存+2
 * (改為本宮+3, 三方+1, 可疊加, 偏財本星吉化+2)
 */
function scorePiancai(day, options = {}) {
  let score = 0;
  const details = [];

  const lu = evaluateMutagenRule(day, [day.dailyCaibo], '化祿', '財帛宮');
  score += lu.score; details.push(...lu.details);

  const tan = evaluateStarRule(day, [day.dailyCaibo], ['贪狼', '貪狼'], '財帛宮');
  score += tan.score; details.push(...tan.details);

  const po = evaluateStarRule(day, [day.dailyCaibo], ['破军', '破軍'], '財帛宮');
  score += po.score; details.push(...po.details);

  const wu = evaluateStarRule(day, [day.dailyCaibo], ['武曲'], '財帛宮');
  score += wu.score; details.push(...wu.details);

  const ji = evaluateMutagenRule(day, [day.dailyCaibo], '化忌', '財帛宮');
  score += ji.score; details.push(...ji.details);

  const lc = evaluateStarRule(day, [day.dailyMing], ['禄存', '祿存'], '命宮');
  score += lc.score; details.push(...lc.details);

  if (lu.score > 0) {
    const sHua = day.dailySiHua || {};
    const luStar = sHua['化禄'] || sHua['化祿'];
    if (luStar === '武曲' || luStar === '贪狼' || luStar === '破军') {
      score += 2;
      details.push({ rule: `偏財本星(${luStar})化祿生旺`, points: 2 });
    }
  }

  return { score, details };
}

/**
 * 2. 桃花日評分
 * 命宮或夫妻宮見紅鸞+3、見天喜+3、見貪狼+2、見廉貞+2、見化忌-3
 * (本宮+3, 三方+1, 可疊加, 流日神煞疊加, 桃花正星逢祿引動)
 */
function scoreTaohua(day, options = {}) {
  let score = 0;
  const details = [];
  const primaryTF = [day.dailyMing, day.dailyFuqi];
  const dStem = day.dailyGanZhi ? day.dailyGanZhi[0] : '';

  const hl = evaluateStarRule(day, primaryTF, ['红鸾', '紅鸞'], '命/夫');
  score += hl.score; details.push(...hl.details);

  const tx = evaluateStarRule(day, primaryTF, ['天喜'], '命/夫');
  score += tx.score; details.push(...tx.details);

  const tan = evaluateStarRule(day, primaryTF, ['贪狼', '貪狼'], '命/夫');
  score += tan.score; details.push(...tan.details);

  const lz = evaluateStarRule(day, primaryTF, ['廉贞', '廉貞'], '命/夫');
  score += lz.score; details.push(...lz.details);

  const ji = evaluateMutagenRule(day, primaryTF, '化忌', '命/夫');
  score += ji.score; details.push(...ji.details);

  if (dStem === '戊' && tan.score > 0) {
    score += 2;
    details.push({ rule: '桃花主星貪狼化祿引動', points: 2 });
  } else if (dStem === '甲' && lz.score > 0) {
    score += 2;
    details.push({ rule: '次桃花廉貞化祿引動', points: 2 });
  } else if (dStem === '己') {
    score += 1;
    details.push({ rule: '武曲化祿生財助桃', points: 1 });
  }

  return { score, details };
}

/**
 * 3. 肉慾日評分
 * 命宮或夫妻宮見貪狼+咸池+4、見天姚+3、見沐浴+3、福德宮見廉貞+貪狼+3
 * (跨宮並見+4, 三方+1, 本宮+3, 福德跨宮廉貪+3)
 */
function scoreRouyu(day, options = {}) {
  let score = 0;
  const details = [];
  const dStem = day.dailyGanZhi ? day.dailyGanZhi[0] : '';

  const mStars = getAllPalaceStars(day.dailyMing, day);
  const fStars = getAllPalaceStars(day.dailyFuqi, day);
  const mTan = mStars.has('贪狼') || mStars.has('貪狼');
  const mXian = mStars.has('咸池') || mStars.has('流日咸池');
  const fTan = fStars.has('贪狼') || fStars.has('貪狼');
  const fXian = fStars.has('咸池') || fStars.has('流日咸池');

  // 貪狼+咸池
  if ((mTan && mXian) || (fTan && fXian)) {
    score += 5;
    const loc = (mTan && mXian) ? '命宮' : '夫妻宮';
    details.push({ rule: `${loc}同度並見貪狼+咸池(情慾爆發)`, points: 5 });
  } else if ((mTan || fTan) && (mXian || fXian)) {
    score += 4;
    const tLoc = mTan ? '命宮貪狼' : '夫妻宮貪狼';
    const xLoc = mXian ? '命宮咸池' : '夫妻宮咸池';
    details.push({ rule: `命宮夫妻宮跨宮並見貪狼+咸池(${tLoc}, ${xLoc})`, points: 4 });
  } else {
    const surM = getSanFangSiZhengBranches(day.dailyMing.earthlyBranch).sanFangOthers;
    const surF = getSanFangSiZhengBranches(day.dailyFuqi.earthlyBranch).sanFangOthers;
    let sTan = false, sXian = false;
    [...surM, ...surF].forEach(b => {
      const p = getPalaceByBranch(day, b);
      if (p) {
        const st = getAllPalaceStars(p, day);
        if (st.has('贪狼') || st.has('貪狼')) sTan = true;
        if (st.has('咸池') || st.has('流日咸池')) sXian = true;
      }
    });
    if ((mTan || fTan || sTan) && (mXian || fXian || sXian)) {
      score += 2;
      details.push({ rule: '命/夫三方四正跨宮照會見貪狼+咸池', points: 2 });
    }
  }

  // 天姚 (本宮+3, 三方+1)
  const yao = evaluateStarRule(day, [day.dailyMing, day.dailyFuqi], ['天姚'], '命/夫');
  score += yao.score; details.push(...yao.details);

  // 沐浴 (本宮+3, 三方+1)
  const muyu = evaluateStarRule(day, [day.dailyMing, day.dailyFuqi], ['沐浴'], '命/夫');
  score += muyu.score; details.push(...muyu.details);

  // 福德宮見廉貞+貪狼 (同度+4, 跨宮+3, 三方+1)
  const fudeP = day.dailyFude;
  const fudeStars = getAllPalaceStars(fudeP, day);
  const fudeLian = fudeStars.has('廉贞') || fudeStars.has('廉貞');
  const fudeTan = fudeStars.has('贪狼') || fudeStars.has('貪狼');

  if (fudeLian && fudeTan) {
    score += 4;
    details.push({ rule: '福德宮同宮同度見廉貞+貪狼(肉慾最強)', points: 4 });
  } else {
    const fudeSur = getSanFangSiZhengBranches(fudeP.earthlyBranch).sanFangOthers;
    let fudeSurLian = false, fudeSurTan = false;
    fudeSur.forEach(b => {
      const p = getPalaceByBranch(day, b);
      if (p) {
        const st = getAllPalaceStars(p, day);
        if (st.has('廉贞') || st.has('廉貞')) fudeSurLian = true;
        if (st.has('贪狼') || st.has('貪狼')) fudeSurTan = true;
      }
    });
    if ((fudeLian && (fudeSurTan || mTan)) || (fudeTan && (fudeSurLian || mTan))) {
      score += 3;
      details.push({ rule: '福德本宮與命宮/對宮跨宮並見廉貞+貪狼', points: 3 });
    } else if (fudeSurLian && mTan) {
      score += 3;
      details.push({ rule: '福德三方見廉貞且命宮見貪狼(身心跨宮並見廉貪)', points: 3 });
    } else if (fudeSurLian && fudeSurTan) {
      score += 1;
      details.push({ rule: '福德宮三方照會廉貞+貪狼', points: 1 });
    }
  }

  // 肉慾遇貪狼化祿
  if (dStem === '戊' && (mTan || fTan)) {
    score += 1;
    details.push({ rule: '貪狼化祿情慾激發', points: 1 });
  }

  return { score, details };
}

/**
 * 4. 貴人日評分
 * 命宮或遷移宮見天魁+3、見天鉞+3、見左輔+2、見右弼+2
 * (本宮+3, 三方+1, 雙星疊會+6, 貴人吉化提攜)
 */
function scoreGuiren(day, options = {}) {
  let score = 0;
  const details = [];
  const primaryMQ = [day.dailyMing, day.dailyQianyi];

  const tk = evaluateStarRule(day, primaryMQ, ['天魁'], '命/遷');
  score += tk.score; details.push(...tk.details);

  const ty = evaluateStarRule(day, primaryMQ, ['天钺', '天鉞'], '命/遷');
  score += ty.score; details.push(...ty.details);

  const zf = evaluateStarRule(day, primaryMQ, ['左辅', '左輔'], '命/遷');
  score += zf.score; details.push(...zf.details);

  const yb = evaluateStarRule(day, primaryMQ, ['右弼'], '命/遷');
  score += yb.score; details.push(...yb.details);

  const ke = evaluateMutagenRule(day, primaryMQ, '化科', '命/遷');
  if (ke.score > 0) { score += 2; details.push({ rule: '貴人逢化科長輩提攜', points: 2 }); }

  const lu = evaluateMutagenRule(day, primaryMQ, '化祿', '命/遷');
  if (lu.score > 0) { score += 1; details.push({ rule: '貴人逢化祿引薦得利', points: 1 }); }

  const ji = evaluateMutagenRule(day, primaryMQ, '化忌', '命/遷');
  if (ji.score < 0) { score -= 3; details.push({ rule: '命遷逢化忌小人阻滯', points: -3 }); }

  return { score, details };
}

/**
 * 5. 事業日評分
 * 官祿宮見化權+3、見化科+3、見紫微+2、見天府+2
 * (本宮+3, 三方+1, 權祿交馳生財)
 */
function scoreShiye(day, options = {}) {
  let score = 0;
  const details = [];

  const quan = evaluateMutagenRule(day, [day.dailyGuanlu], '化權', '官祿宮');
  score += quan.score; details.push(...quan.details);

  const ke = evaluateMutagenRule(day, [day.dailyGuanlu], '化科', '官祿宮');
  score += ke.score; details.push(...ke.details);

  const zw = evaluateStarRule(day, [day.dailyGuanlu], ['紫微'], '官祿宮');
  score += zw.score; details.push(...zw.details);

  const tf = evaluateStarRule(day, [day.dailyGuanlu], ['天府'], '官祿宮');
  score += tf.score; details.push(...tf.details);

  const lu = evaluateMutagenRule(day, [day.dailyGuanlu], '化祿', '官祿宮');
  if (lu.score > 0) { score += 2; details.push({ rule: '官祿逢化祿職權生財', points: 2 }); }

  const lc = evaluateStarRule(day, [day.dailyGuanlu], ['禄存', '祿存'], '官祿宮');
  if (lc.score > 0) { score += 2; details.push({ rule: '官祿宮見祿存事業鞏固', points: 2 }); }

  const ji = evaluateMutagenRule(day, [day.dailyGuanlu], '化忌', '官祿宮');
  if (ji.score < 0) { score -= 3; details.push({ rule: '官祿宮見化忌工作波折', points: -3 }); }

  return { score, details };
}

/**
 * 6. 健康日評分
 * 疾厄宮見化科+3、見天梁+2、見化忌-3、見擎羊-2
 * (本宮+3, 三方+1, 福星解厄+2, 煞忌沖照扣分)
 */
function scoreJiankang(day, options = {}) {
  let score = 0;
  const details = [];

  const ke = evaluateMutagenRule(day, [day.dailyJie], '化科', '疾厄宮');
  score += ke.score; details.push(...ke.details);

  const tl = evaluateStarRule(day, [day.dailyJie], ['天梁'], '疾厄宮');
  score += tl.score; details.push(...tl.details);

  const td = evaluateStarRule(day, [day.dailyJie], ['天同'], '疾厄宮');
  if (td.score > 0) { score += 2; details.push({ rule: '疾厄宮見天同福星解厄', points: 2 }); }

  const ji = evaluateMutagenRule(day, [day.dailyJie], '化忌', '疾厄宮');
  score += ji.score; details.push(...ji.details);

  const qy = evaluateStarRule(day, [day.dailyJie], ['擎羊', '日羊'], '疾厄宮');
  if (qy.score > 0) { score -= 2; details.push({ rule: '疾厄宮見擎羊煞星刑傷', points: -2 }); }

  return { score, details };
}

/**
 * 7. 巨大商機日評分
 * 官祿/財帛見化祿+3、見化權+3、命/財見祿存+3、見天馬+2、祿馬交馳+3、權祿交馳+3、官祿見紫府+2、逢忌-3
 */
function scoreShangji(day, options = {}) {
  let score = 0;
  const details = [];
  const primaryCG = [day.dailyCaibo, day.dailyGuanlu];

  const lu = evaluateMutagenRule(day, primaryCG, '化祿', '財帛/官祿');
  score += lu.score; details.push(...lu.details);

  const quan = evaluateMutagenRule(day, primaryCG, '化權', '財帛/官祿');
  score += quan.score; details.push(...quan.details);

  const lc = evaluateStarRule(day, [day.dailyMing, day.dailyCaibo], ['禄存', '祿存'], '命/財');
  score += lc.score; details.push(...lc.details);

  const tm = evaluateStarRule(day, [day.dailyMing, day.dailyGuanlu, day.dailyCaibo], ['天马', '天馬', '日马', '日馬'], '命/官/財');
  if (tm.score > 0) {
    score += 2;
    details.push({ rule: '命官財見天馬(商機動能活躍)', points: 2 });
  }

  // 祿馬交馳
  if (lc.score > 0 && tm.score > 0) {
    score += 3;
    details.push({ rule: '商機遇祿馬交馳(萬商雲集發財百萬)', points: 3 });
  }

  // 權祿交馳
  if (lu.score > 0 && quan.score > 0) {
    score += 3;
    details.push({ rule: '商機遇權祿交馳(掌控主導權獲重大專案)', points: 3 });
  }

  // 官祿見紫微或天府
  const zw = evaluateStarRule(day, [day.dailyGuanlu], ['紫微'], '官祿宮');
  const tf = evaluateStarRule(day, [day.dailyGuanlu], ['天府'], '官祿宮');
  if (zw.score > 0 || tf.score > 0) {
    score += 2;
    details.push({ rule: '官祿宮見紫府帝星(統馭重大專案格局)', points: 2 });
  }

  // 化忌
  const ji = evaluateMutagenRule(day, primaryCG, '化忌', '財帛/官祿');
  if (ji.score < 0) {
    score -= 3;
    details.push({ rule: '財官逢化忌(合約條款宜慎防波折)', points: -3 });
  }

  return { score, details };
}

// 六十甲子納音五行對照表
const NAYIN_MAP = {
  '甲子': '金', '乙丑': '金', '丙寅': '火', '丁卯': '火', '戊辰': '木', '己巳': '木',
  '庚午': '土', '辛未': '土', '壬申': '金', '癸酉': '金', '甲戌': '火', '乙亥': '火',
  '丙子': '水', '丁丑': '水', '戊寅': '土', '己卯': '土', '庚辰': '金', '辛巳': '金',
  '壬午': '木', '癸未': '木', '甲申': '水', '乙酉': '水', '丙戌': '土', '丁亥': '土',
  '戊子': '火', '己丑': '火', '庚寅': '木', '辛卯': '木', '壬辰': '水', '癸巳': '水',
  '甲午': '金', '乙未': '金', '丙申': '火', '丁酉': '火', '戊戌': '木', '己亥': '木',
  '庚子': '土', '辛丑': '土', '壬寅': '金', '癸卯': '金', '甲辰': '火', '乙巳': '火',
  '丙午': '水', '丁未': '水', '戊申': '土', '己酉': '土', '庚戌': '金', '辛亥': '金',
  '壬子': '木', '癸丑': '木', '甲寅': '水', '乙卯': '水', '丙辰': '土', '丁巳': '土',
  '戊午': '火', '己未': '火', '庚申': '木', '辛酉': '木', '壬戌': '水', '癸亥': '水'
};

function isKe(a, b) {
  return (a === '木' && b === '土') ||
         (a === '土' && b === '水') ||
         (a === '水' && b === '火') ||
         (a === '火' && b === '金') ||
         (a === '金' && b === '木');
}

/**
 * 8. 樂透運評分模組 (Lottery Fortune)
 * 1. 八字飛財判斷：年柱納音剋日柱或時柱納音，+5 分
 * 2. 紫微偏財格局：財帛宮見七殺+火星 +4、命宮貪狼+火星 +3、破軍+祿存/化祿 +3
 * 3. 流日財帛宮見化祿 +3
 * 4. 流日命宮見祿存 +3
 * 5. 流日財帛宮見化忌 -3
 */
function scoreLetou(day, options = {}) {
  let score = 0;
  const details = [];

  // 1. 八字飛財判斷：年柱納音剋日柱或時柱納音 +5
  const bazi = options.bazi || (options.astrolabe && options.astrolabe.rawDates && options.astrolabe.rawDates.chineseDate) || (day.rawHoroscope && day.rawHoroscope.chineseDate) || null;
  if (bazi) {
    let yP = '', dP = '', hP = '';
    if (bazi.yearly && Array.isArray(bazi.yearly)) yP = bazi.yearly.join('');
    else if (bazi.year) yP = bazi.year;

    if (bazi.daily && Array.isArray(bazi.daily)) dP = bazi.daily.join('');
    else if (bazi.day) dP = bazi.day;

    if (bazi.hourly && Array.isArray(bazi.hourly)) hP = bazi.hourly.join('');
    else if (bazi.hour) hP = bazi.hour;

    const yNa = NAYIN_MAP[yP];
    const dNa = NAYIN_MAP[dP];
    const hNa = NAYIN_MAP[hP];
    const curDayNa = NAYIN_MAP[day.dailyGanZhi];

    if (yNa && ((dNa && isKe(yNa, dNa)) || (hNa && isKe(yNa, hNa)))) {
      score += 5;
      const targetStr = (dNa && isKe(yNa, dNa)) ? `日柱${dP}(${dNa})` : `時柱${hP}(${hNa})`;
      details.push({ rule: `本命八字飛財格(年柱${yP}${yNa}剋${targetStr})`, points: 5 });
    } else if (yNa && curDayNa && isKe(yNa, curDayNa)) {
      score += 5;
      details.push({ rule: `流日八字飛財(年柱${yP}${yNa}剋流日${day.dailyGanZhi}${curDayNa})`, points: 5 });
    }
  }

  // 2. 紫微偏財格局
  // (a) 財帛宮見七殺+火星 +4 (三方照會 +2)
  const cStars = getAllPalaceStars(day.dailyCaibo, day);
  const hasCaiboQisha = cStars.has('七杀') || cStars.has('七殺');
  const hasCaiboHuoxing = cStars.has('火星');
  if (hasCaiboQisha && hasCaiboHuoxing) {
    score += 4;
    details.push({ rule: '流日財帛宮見七殺+火星同度(偏財暴發格)', points: 4 });
  } else {
    const sfCaibo = getSanFangSiZhengBranches(day.dailyCaibo.earthlyBranch).sanFangOthers;
    let sfQisha = false, sfHuo = false;
    sfCaibo.forEach(b => {
      const p = getPalaceByBranch(day, b);
      if (p) {
        const st = getAllPalaceStars(p, day);
        if (st.has('七杀') || st.has('七殺')) sfQisha = true;
        if (st.has('火星')) sfHuo = true;
      }
    });
    if ((hasCaiboQisha && sfHuo) || (hasCaiboHuoxing && sfQisha) || (sfQisha && sfHuo)) {
      score += 2;
      details.push({ rule: '流日財帛宮三方照會七殺+火星', points: 2 });
    }
  }

  // (b) 命宮貪狼+火星 +3 (三方照會 +1)
  const mStars = getAllPalaceStars(day.dailyMing, day);
  const hasMingTan = mStars.has('贪狼') || mStars.has('貪狼');
  const hasMingHuo = mStars.has('火星');
  if (hasMingTan && hasMingHuo) {
    score += 3;
    details.push({ rule: '流日命宮見貪狼+火星同度(火貪格暴富)', points: 3 });
  } else {
    const sfMing = getSanFangSiZhengBranches(day.dailyMing.earthlyBranch).sanFangOthers;
    let sfTan = false, sfHuo = false;
    sfMing.forEach(b => {
      const p = getPalaceByBranch(day, b);
      if (p) {
        const st = getAllPalaceStars(p, day);
        if (st.has('贪狼') || st.has('貪狼')) sfTan = true;
        if (st.has('火星')) sfHuo = true;
      }
    });
    if ((hasMingTan && sfHuo) || (hasMingHuo && sfTan) || (sfTan && sfHuo)) {
      score += 1;
      details.push({ rule: '流日命宮三方照會貪狼+火星(火貪格)', points: 1 });
    }
  }

  // (c) 破軍+祿存/化祿 +3 (三方照會 +1)
  let pjLuHit = false;
  const targetPalaces = [
    { p: day.dailyCaibo, name: '財帛宮' },
    { p: day.dailyMing, name: '命宮' }
  ];
  for (const item of targetPalaces) {
    const st = getAllPalaceStars(item.p, day);
    const hasPojun = st.has('破军') || st.has('破軍');
    const hasLucun = st.has('禄存') || st.has('祿存') || st.has('日禄') || st.has('日祿');
    const sHua = day.dailySiHua || {};
    const isPojunHuaLu = (sHua['化禄'] === '破军' || sHua['化禄'] === '破軍' || sHua['化祿'] === '破军' || sHua['化祿'] === '破軍');
    if (hasPojun && (hasLucun || isPojunHuaLu)) {
      score += 3;
      details.push({ rule: `流日${item.name}見破軍+祿(破軍逢祿主橫發)`, points: 3 });
      pjLuHit = true;
      break;
    }
  }
  if (!pjLuHit) {
    for (const item of targetPalaces) {
      const st = getAllPalaceStars(item.p, day);
      const hasPojun = st.has('破军') || st.has('破軍');
      if (hasPojun) {
        const sf = getSanFangSiZhengBranches(item.p.earthlyBranch).sanFangOthers;
        let sfLu = false;
        sf.forEach(b => {
          const p = getPalaceByBranch(day, b);
          if (p) {
            const pst = getAllPalaceStars(p, day);
            if (pst.has('禄存') || pst.has('祿存') || pst.has('日禄') || pst.has('日祿')) sfLu = true;
          }
        });
        if (sfLu) {
          score += 1;
          details.push({ rule: `流日${item.name}三方照會破軍+祿存`, points: 1 });
          break;
        }
      }
    }
  }

  // 3. 流日財帛宮見化祿 +3
  const luC = evaluateMutagenRule(day, [day.dailyCaibo], '化祿', '財帛宮');
  score += luC.score; details.push(...luC.details);

  // 4. 流日命宮見祿存 +3
  const lcM = evaluateStarRule(day, [day.dailyMing], ['禄存', '祿存'], '命宮');
  score += lcM.score; details.push(...lcM.details);

  // 5. 流日財帛宮見化忌 -3
  const jiC = evaluateMutagenRule(day, [day.dailyCaibo], '化忌', '財帛宮');
  score += jiC.score; details.push(...jiC.details);

  return { score, details };
}

/**
 * 綜合對單日進行 8 項評分 (含樂透運)
 */
function scoreDay(day, options = {}) {
  return {
    piancai: scorePiancai(day, options),
    taohua: scoreTaohua(day, options),
    rouyu: scoreRouyu(day, options),
    guiren: scoreGuiren(day, options),
    shiye: scoreShiye(day, options),
    jiankang: scoreJiankang(day, options),
    shangji: scoreShangji(day, options),
    letou: scoreLetou(day, options)
  };
}

module.exports = {
  BRANCHES,
  CHAR_MAP,
  NAYIN_MAP,
  isKe,
  getDailyXianchiBranch,
  HONGLUAN_MAP,
  DUI_MAP,
  LUCUN_MAP,
  KUAI_YUE_MAP,
  getSanFangSiZhengBranches,
  getPalaceByBranch,
  extractNatalStars,
  extractDailyShensha,
  getAllPalaceStars,
  evaluateStarRule,
  evaluateMutagenRule,
  scorePiancai,
  scoreTaohua,
  scoreRouyu,
  scoreGuiren,
  scoreShiye,
  scoreJiankang,
  scoreShangji,
  scoreLetou,
  scoreDay
};

