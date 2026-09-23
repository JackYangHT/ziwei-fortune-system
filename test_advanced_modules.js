const http = require('http');
const assert = require('assert');
const serverModule = require('./webapp/server.js');

console.log('=============================================================');
console.log('🧪 執行紫微斗數進階整合測試：三才架構·三大派別·立太極·趨吉避凶');
console.log('=============================================================\n');

// 測試案例一：1977-07-26 08:00 曼谷 客戶
const sessionBangkok = {
  clientName: '曼谷高階客戶',
  birthday: '1977-07-26',
  birthClockTime: '08:00',
  birthPlace: '曼谷',
  targetYear: 2026,
  astrolabe: {
    fiveElementsClass: '金四局',
    soul: '文曲',
    body: '文昌',
    palaces: [
      { name: '命宮', earthlyBranch: '巳', majorStars: [{ name: '紫微' }], minorStars: [] },
      { name: '父母宮', earthlyBranch: '午', majorStars: [{ name: '天梁' }, { name: '天壽' }], minorStars: [{ name: '左輔' }] },
      { name: '夫妻宮', earthlyBranch: '卯', majorStars: [{ name: '廉貞' }], minorStars: [{ name: '地空' }, { name: '地劫' }, { name: '化忌' }] },
      { name: '子女宮', earthlyBranch: '辰', majorStars: [{ name: '天府' }], minorStars: [] },
      { name: '財帛宮', earthlyBranch: '丑', majorStars: [{ name: '武曲' }], minorStars: [] },
      { name: '田宅宮', earthlyBranch: '申', majorStars: [{ name: '天同' }], minorStars: [] },
      { name: '福德宮', earthlyBranch: '亥', majorStars: [], minorStars: [{ name: '陀羅' }] }
    ]
  }
};

// 1. 測試三才架構
console.log('1. 測試倪海廈《天紀》與《人紀》天地人三才架構...');
const sancai = serverModule.calculateSanCaiFramework(sessionBangkok);
assert.strictEqual(sancai.ratio.tian, '33.3% (先天命運)');
assert.strictEqual(sancai.ratio.di, '33.3% (空間磁場)');
assert.strictEqual(sancai.ratio.ren, '33.3% (自由意志)');
console.log('   ✅ 三才比例各 33.3% 驗證通過');
console.log(`   天道內涵: ${sancai.tian.components.join('、')}`);
console.log(`   地道座向: ${sancai.di.components.join('、')}`);
console.log(`   人道心法: ${sancai.ren.components.join('、')}`);

// 2. 測試中醫五味歸經與禁忌
console.log('\n2. 測試中醫五味歸經與禁忌...');
const tcm = serverModule.calculateNiTcmFramework(sessionBangkok);
assert.strictEqual(tcm.fiveFlavors.mappings.length, 5);
assert.ok(tcm.fiveFlavors.taboos.rules.some(r => r.includes('咸走血')));
assert.strictEqual(tcm.ziWuLiuZhu.rule, '實則瀉其子，虛則補其母。');
console.log('   ✅ 五味歸經、禁忌與子午流注母子補瀉法則驗證通過');

// 3. 測試紫微斗數三大派別 (三合 · 飛星 · 欽天門)
console.log('\n3. 測試紫微斗數三大派別與來因宮...');
const schools = serverModule.calculateThreeSchools(sessionBangkok.astrolabe, '丁');
assert.ok(schools.sanhe);
assert.ok(schools.feixing);
assert.ok(schools.qintian);
assert.strictEqual(schools.qintian.laiYinBranch, '巳');
console.log(`   ✅ 欽天門來因宮定位正確: 丁年來因在 ${schools.qintian.laiYinBranch}宮 (${schools.qintian.laiYinPalace})`);

// 4. 測試立太極 (借宮推算：父母健康壽元與婚姻危機)
console.log('\n4. 測試立太極借宮推算...');
const taiji = serverModule.calculateTaiJiPalaces(sessionBangkok.astrolabe, sessionBangkok);
assert.ok(taiji.parentHealth.longevityEvaluation.includes('福壽綿長'));
assert.strictEqual(taiji.marriageCrisis.isAffairRisk, true);
assert.ok(taiji.marriageCrisis.riskLevel.includes('高度預警'));
console.log(`   ✅ 父母健康評估: ${taiji.parentHealth.longevityEvaluation}`);
console.log(`   ✅ 婚姻危機預警: ${taiji.marriageCrisis.riskLevel} - ${taiji.marriageCrisis.riskAnalysis}`);

// 5. 測試 2026 丙午年四化
console.log('\n5. 測試 2026 丙午年四化環境巨浪...');
const sihua2026 = serverModule.calculate2026BingWuSiHua();
assert.strictEqual(sihua2026.mutagens.lu.star, '天同化祿');
assert.strictEqual(sihua2026.mutagens.quan.star, '天機化權');
assert.strictEqual(sihua2026.mutagens.ke.star, '文昌化科');
assert.strictEqual(sihua2026.mutagens.ji.star, '廉貞化忌');
console.log('   ✅ 2026 丙午四化正確: 天同祿、天機權、文昌科、廉貞忌');

// 6. 測試易經起卦與河圖五行生成數
console.log('\n6. 測試易經起卦與河圖五行生成數...');
const iching = serverModule.calculateIChingAndNumerology('2026-09-23', '08:00');
assert.ok(iching.iching.upperGua);
assert.ok(iching.iching.lowerGua);
assert.ok(iching.numerology['水'].base.includes(1));
assert.ok(iching.numerology['水'].base.includes(6));
console.log(`   ✅ 易經卦象: ${iching.iching.upperGua} / ${iching.iching.lowerGua} (${iching.iching.decisionHexagram})`);
console.log(`   ✅ 河圖天一生水地六成之: [${iching.numerology['水'].base}] 生成數 [${iching.numerology['水'].luckyNums.slice(0, 5)}]`);

// 7. 測試桃花煞判斷與風水斬桃花
console.log('\n7. 測試桃花煞與風水斬桃花...');
const peach = serverModule.calculatePeachBlossomSha({ dailyGanZhi: '庚辰' });
assert.strictEqual(peach.peachPosition, '酉方 (正西方)');
assert.ok(peach.fengShuiRemedy.items.some(i => i.includes('桃木劍')));
console.log(`   ✅ 申子辰桃花在: ${peach.peachPosition}`);
console.log(`   ✅ 斬桃花物件: ${peach.fengShuiRemedy.items.join('、')}`);

// 8. 測試趨吉避凶核心哲學
console.log('\n8. 測試趨吉避凶核心哲學...');
const harm = serverModule.getHarmMitigationGuidance();
assert.ok(harm.corePhilosophy.includes('緩衝期'));
assert.ok(harm.corePhilosophy.includes('降低傷害'));
assert.ok(harm.corePhilosophy.includes('尊嚴安詳'));
console.log(`   ✅ 核心哲學: ${harm.corePhilosophy}`);

// 9. 測試 HTTP API 伺服器
console.log('\n9. 測試 HTTP API 伺服器各端點回應...');
function fetchApi(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${path}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function runApiTests() {
  const routes = [
    '/api/sancai?birthday=1977-07-26&place=曼谷',
    '/api/taiji?birthStem=丁',
    '/api/iching?date=2026-09-23&time=08:00',
    '/api/peach-blossom?dailyGanZhi=庚辰',
    '/api/investment',
    '/api/2026-sihua',
    '/api/harm-mitigation'
  ];

  for (const r of routes) {
    const json = await fetchApi(r);
    assert.strictEqual(json.success, true, `API ${r} should return success: true`);
    console.log(`   ✅ GET ${r.split('?')[0]} 通過`);
  }

  console.log('\n🎉 所有進階模組與 API 測試全數通過！');
}

runApiTests().catch(err => {
  console.error('❌ 測試失敗:', err);
  process.exit(1);
});
