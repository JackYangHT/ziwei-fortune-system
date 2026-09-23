// test_relationship_rules.js
// 自動化測試套件：紫微斗數感情狀態判讀規則書_v1 完整功能驗證

const fs = require('fs');
const path = require('path');

console.log('=============================================================');
console.log('💖 紫微斗數感情狀態判讀規則書_v1 全功能自動化測試套件');
console.log('=============================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`✅ [通過] ${message}`);
    passedTests++;
  } else {
    console.error(`❌ [失敗] ${message}`);
    process.exitCode = 1;
  }
}

// 載入模組
const app = require('./webapp/app.js');
const {
  parseIntent,
  fetchAstrologyData,
  generateNaturalAnswerFallback,
  calculateDatingStatus,
  calculateMarriageStatus,
  calculateTrueLoveTimeline,
  calculateSpouseTraits,
  calculateDualSynastry,
  SPOUSE_STAR_TRAITS,
  RELATIONSHIP_RULES_V1,
  SYSTEM_PROMPT_TEMPLATE,
  formatAuspiciousDate
} = app;

const testSession = {
  clientName: '陳先生',
  birthday: '1990-03-15',
  birthTime: 6,
  gender: '男',
  targetYear: 2026
};

// -------------------------------------------------------------
// 測試一：規則書知識庫與 Prompt 模板完整性
// -------------------------------------------------------------
console.log('\n--- 測試一：規則書知識庫與 Prompt 規範驗證 ---');
assert(RELATIONSHIP_RULES_V1 && RELATIONSHIP_RULES_V1.title === '紫微斗數感情狀態判讀規則書_v1', 'RELATIONSHIP_RULES_V1 存在且標題正確');
assert(fs.existsSync(path.join(__dirname, 'docs', '紫微斗數感情狀態判讀規則書_v1.md')), 'docs/紫微斗數感情狀態判讀規則書_v1.md 知識庫文檔已建立');
assert(SYSTEM_PROMPT_TEMPLATE.includes('紫微斗數感情狀態判讀規則書_v1'), 'SYSTEM_PROMPT_TEMPLATE 包含感情狀態判讀規則書規範');
assert(SYSTEM_PROMPT_TEMPLATE.includes('交往對象詢問'), 'Prompt 包含「交往對象詢問」規範');
assert(SYSTEM_PROMPT_TEMPLATE.includes('法定婚姻狀態詢問'), 'Prompt 包含「法定婚姻狀態詢問」規範');
assert(SYSTEM_PROMPT_TEMPLATE.includes('正緣時間詢問'), 'Prompt 包含「正緣時間詢問」規範');
assert(SYSTEM_PROMPT_TEMPLATE.includes('正緣特質詢問'), 'Prompt 包含「正緣特質詢問」規範');
assert(SYSTEM_PROMPT_TEMPLATE.includes('雙人合盤婚配詢問'), 'Prompt 包含「雙人合盤婚配詢問」規範');

// -------------------------------------------------------------
// 測試二：意圖解析（五大感情問題與多種提問方式精準辨識）
// -------------------------------------------------------------
console.log('\n--- 測試二：意圖解析 (parseIntent) 精準辨識 ---');
const intentTests = [
  { q: '我目前有交往對象嗎', expected: 'dating_status' },
  { q: '我現在有對象嗎', expected: 'dating_status' },
  { q: '我現在單身嗎', expected: 'dating_status' },
  { q: '我結婚了嗎', expected: 'marriage_status' },
  { q: '我是不是結婚了', expected: 'marriage_status' },
  { q: '我結過婚嗎', expected: 'marriage_status' },
  { q: '我的正緣什麼時候來', expected: 'true_love_timeline' },
  { q: '我的正緣何時會出現', expected: 'true_love_timeline' },
  { q: '我哪一年紅鸞星動', expected: 'true_love_timeline' },
  { q: '我的正緣是什麼樣的人', expected: 'true_love_traits' },
  { q: '我未來的另一半是什麼樣的人', expected: 'true_love_traits' },
  { q: '我的正緣長相與特質如何', expected: 'true_love_traits' },
  { q: '我跟他適合結婚嗎', expected: 'dual_synastry' },
  { q: '我們適合結婚嗎', expected: 'dual_synastry' },
  { q: '雙人合盤看看我們合不合', expected: 'dual_synastry' }
];

intentTests.forEach(t => {
  const parsed = parseIntent(t.q, testSession);
  assert(parsed.event === t.expected, `提問「${t.q}」正確解析為 ${t.expected} (實際: ${parsed.event})`);
});

// -------------------------------------------------------------
// 測試三：功能 1 - 「我目前有交往對象嗎」大限與流年 命/夫/子 桃花化祿科檢視
// -------------------------------------------------------------
console.log('\n--- 測試三：功能 1 - 交往對象判讀 (dating_status) ---');
const datingResult = calculateDatingStatus(null, testSession, 2026);
assert(datingResult && typeof datingResult.isDating === 'boolean', 'calculateDatingStatus 回傳 isDating 布林值');
assert(datingResult.statusText, `回傳明確狀態判定文字 (${datingResult.statusText})`);
assert(datingResult.plainText.startsWith('根據命盤推算，你目前'), '白話版第一句直接給出結論並以「根據命盤推算」開頭');
assert(datingResult.plainText.includes('這是我的建議'), '包含「這是我的建議」保留諮詢語氣');
assert(datingResult.calculation.includes('大限與流年之命宮、夫妻宮、子女宮'), '推算依據中明確檢視大限與流年之命宮、夫妻宮、子女宮');
assert(datingResult.remedy === null, '未主動問改運時 remedy 嚴格為 null');

// -------------------------------------------------------------
// 測試四：功能 2 - 「我結婚了嗎」紅鸞+天刑+奏書、夫官線+父疾線、田宅宮祿旺檢視
// -------------------------------------------------------------
console.log('\n--- 測試四：功能 2 - 法定婚姻狀態判讀 (marriage_status) ---');
const marriageResult = calculateMarriageStatus(null, testSession, 2026);
assert(marriageResult && typeof marriageResult.isMarried === 'boolean', 'calculateMarriageStatus 回傳 isMarried 布林值');
assert(marriageResult.statusText, `回傳婚姻狀態文字 (${marriageResult.statusText})`);
assert(marriageResult.plainText.startsWith('根據命盤推算，你'), '白話版第一句直接給出婚姻狀態結論');
assert(marriageResult.calculation.includes('法定文書契約三角'), '推算依據中包含「法定文書契約三角」');
assert(marriageResult.calculation.includes('紅鸞') && marriageResult.calculation.includes('天刑') && marriageResult.calculation.includes('奏書'), '推算依據中檢視 紅鸞+天刑+奏書');
assert(marriageResult.calculation.includes('夫官線') && marriageResult.calculation.includes('父疾線'), '推算依據中檢視 夫官線+父疾線');
assert(marriageResult.calculation.includes('田宅'), '推算依據中檢視 田宅宮祿旺');
assert(marriageResult.remedy === null, '未主動問改運時 remedy 嚴格為 null');

// -------------------------------------------------------------
// 測試五：功能 3 - 「我的正緣什麼時候來」檢視流年與大限紅鸞星動年份
// -------------------------------------------------------------
console.log('\n--- 測試五：功能 3 - 正緣時間推算 (true_love_timeline) ---');
const timelineResult = calculateTrueLoveTimeline(null, testSession, 2026, 5);
assert(timelineResult && timelineResult.bestYear, 'calculateTrueLoveTimeline 正確計算最佳正緣年份');
assert(timelineResult.bestYear.yearFull && timelineResult.bestYear.yearFull.includes('年'), `最佳正緣年份包含年份與干支 (${timelineResult.bestYear.yearFull})`);
assert(timelineResult.topYears && timelineResult.topYears.length === 3, '回傳未來 5 年內 TOP 3 正緣黃金年份');
assert(timelineResult.plainText.startsWith('根據命盤推算，你的正緣預計在'), '白話版第一句直接給出正緣年份結論');
assert(timelineResult.plainText.includes(timelineResult.bestYear.yearFull), '白話版包含最佳年份');
assert(timelineResult.plainText.includes('紅鸞星動'), '白話版指出紅鸞星動吉象');
assert(timelineResult.calculation.includes('TOP 3'), '推算依據中包含 TOP 3 排行榜');
assert(timelineResult.remedy === null, '未主動問改運時 remedy 嚴格為 null');

// -------------------------------------------------------------
// 測試六：功能 4 - 「我的正緣是什麼樣的人」本命夫妻宮主星特質推算
// -------------------------------------------------------------
console.log('\n--- 測試六：功能 4 - 正緣人格特質推算 (true_love_traits) ---');
const traitsResult = calculateSpouseTraits(null, testSession);
assert(traitsResult && traitsResult.majorStars && traitsResult.majorStars.length > 0, `正確檢視本命夫妻宮主星 (${traitsResult.majorStars.join('、')})`);
assert(traitsResult.archetype, `正緣原型定位產生 (${traitsResult.archetype})`);
assert(traitsResult.plainText.startsWith('根據命盤推算，你的正緣是一位'), '白話版第一句直接勾勒正緣特質');
assert(traitsResult.calculation.includes('外貌氣質特徵'), '推算依據包含外貌氣質');
assert(traitsResult.calculation.includes('性格與心性優勢'), '推算依據包含性格優勢');
assert(traitsResult.calculation.includes('事業與專長傾向'), '推算依據包含事業專長');
assert(traitsResult.calculation.includes('兩性相處調適指南'), '推算依據包含兩性相處指南');
assert(traitsResult.remedy === null, '未主動問改運時 remedy 嚴格為 null');

// 測試空宮借對宮規則
console.log('--- 測試夫妻宮空宮借對宮 (官祿宮) ---');
const emptyPalaceAst = {
  palaces: [
    { index: 0, name: '命宮', majorStars: [{ name: '紫微' }], minorStars: [], adjectiveStars: [] },
    { index: 4, name: '夫妻', majorStars: [], minorStars: [], adjectiveStars: [] }, // 空宮
    { index: 10, name: '官祿', majorStars: [{ name: '天機' }, { name: '巨門' }], minorStars: [], adjectiveStars: [] } // 對宮
  ]
};
const borrowedResult = calculateSpouseTraits(emptyPalaceAst, testSession);
assert(borrowedResult.isBorrowed === true, '夫妻宮空宮時正確標記借對宮 (isBorrowed = true)');
assert(borrowedResult.majorStars.includes('天機') && borrowedResult.majorStars.includes('巨門'), '借對宮成功提取天機巨門主星');

// -------------------------------------------------------------
// 測試七：功能 5 - 「我跟他適合結婚嗎」雙人合盤 (契合度、對待關係、結婚共識期)
// -------------------------------------------------------------
console.log('\n--- 測試七：功能 5 - 雙人合盤婚配 (dual_synastry) ---');
const synastryResult = calculateDualSynastry(testSession);
assert(synastryResult && typeof synastryResult.compatibilityScore === 'number', `回傳合盤契合度分數 (${synastryResult.compatibilityScore} 分)`);
assert(synastryResult.plainText.startsWith('根據命盤推算，你們兩人適合結婚'), '白話版第一句直接回答婚配結論');
assert(synastryResult.plainText.includes('五行局'), '白話版檢視雙方五行局');
assert(synastryResult.plainText.includes('結婚共識黃金期'), '白話版給出結婚共識黃金期年份');
assert(synastryResult.calculation.includes('命宮星系契合度'), '推算依據中包含命宮契合度');
assert(synastryResult.calculation.includes('五行局生剋調和'), '推算依據中包含五行局生剋');
assert(synastryResult.calculation.includes('對待關係飛星動態'), '推算依據中包含對待關係互化');
assert(synastryResult.calculation.includes('結婚共識最佳年份'), '推算依據中包含結婚共識最佳年份');
assert(synastryResult.remedy === null, '未主動問改運時 remedy 嚴格為 null');

// -------------------------------------------------------------
// 測試八：全流程與對話管道集成 (fetchAstrologyData + generateNaturalAnswerFallback)
// -------------------------------------------------------------
console.log('\n--- 測試八：完整對話管道串接與回答格式驗證 ---');
const fiveQuestions = [
  '我目前有交往對象嗎',
  '我結婚了嗎',
  '我的正緣什麼時候來',
  '我的正緣是什麼樣的人',
  '我跟他適合結婚嗎'
];

const bannedWords = ['絕對', '精準', '完全', '百分之百', '鐵定', '必然', '主帥', '降維打擊'];

fiveQuestions.forEach(q => {
  const intent = parseIntent(q, testSession);
  const data = fetchAstrologyData(intent, testSession);
  const fb = generateNaturalAnswerFallback(intent, data, q, testSession, 'zh');

  assert(fb && fb.plain, `問題「${q}」成功生成白話版回答`);
  assert(fb.light && fb.light.text, `問題「${q}」包含燈號`);
  assert(fb.stars, `問題「${q}」包含星級`);
  assert(fb.calculation, `問題「${q}」包含背景推算依據`);
  assert(fb.remedy === null, `問題「${q}」之 remedy 嚴格為 null`);

  // 驗證第一句話直接給結論
  assert(fb.plain.startsWith('根據命盤推算'), `問題「${q}」第一句以「根據命盤推算」開頭先給結論`);

  // 驗證不包含禁用詞
  let hasBanned = false;
  bannedWords.forEach(bw => {
    if (fb.plain.includes(bw) || fb.calculation.includes(bw)) {
      hasBanned = true;
      console.error(`在問題「${q}」中發現禁用詞: ${bw}`);
    }
  });
  assert(!hasBanned, `問題「${q}」未包含任何禁用誇飾詞`);

  // 驗證白話版句子數量控制在 5 句內
  const sentences = fb.plain.split(/[。！？]/).filter(s => s.trim().length > 0);
  assert(sentences.length <= 5, `問題「${q}」白話版不超過 5 句話 (實際: ${sentences.length} 句)`);
});

// -------------------------------------------------------------
// 測試九：吉日四要素格式 (國曆、農曆、干支、星期) 驗證
// -------------------------------------------------------------
console.log('\n--- 測試九：吉日四要素格式驗證 ---');
const sampleDate = '2026-10-06';
const formatted = formatAuspiciousDate(sampleDate);
console.log('格式化範例：', formatted);
assert(formatted.includes('2026-10-06'), '包含國曆日期');
assert(formatted.includes('農曆'), '包含農曆日期');
assert(formatted.includes('日'), '包含干支日');
assert(formatted.includes('星期'), '包含星期');

console.log('\n=============================================================');
console.log(`🎉 測試完成！通過測試: ${passedTests} / ${totalTests}`);
console.log('=============================================================');

if (passedTests === totalTests) {
  console.log('🌟 所有紫微斗數感情狀態判讀規則書_v1 測試項目全部通過！');
} else {
  console.error(`❌ 有 ${totalTests - passedTests} 個測試失敗，請檢查修正！`);
  process.exit(1);
}
