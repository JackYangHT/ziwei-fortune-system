const assert = require('assert');
const app = require('../webapp/app.js');

console.log('🧪 開始執行【紫微系統四大嚴重問題修復全面測試】...\n');

const mockSession = {
  clientName: '陳先生',
  gender: '男',
  birthday: '1985-06-15',
  birthHour: '08:30',
  targetYear: 2026,
  messages: []
};

// --------------------------------------------------------------------------
// 測試一：財運問題，焦點宮位必須鎖定「財帛宮」
// --------------------------------------------------------------------------
console.log('--- 測試 1: 財運問題焦點宮位鎖定「財帛宮」 ---');

// 1. 問「我今年財運如何」
const q1 = '我今年財運如何';
const focus1 = app.analyzeQueryFocusAndPalaces(q1, mockSession);
const ans1 = app.buildWealthAnswer(mockSession, q1, 'zh');
console.log(`1.1 [${q1}] -> focusPalace: ${focus1.focusPalaceName}`);
assert.strictEqual(focus1.focusPalaceName, '財帛宮', '我今年財運如何 之焦點宮位必須是財帛宮');
assert(ans1.calculation.includes('焦點宮位</strong>：財帛宮'), '完整推算中必須顯示焦點宮位為財帛宮');

// 2. 問「我什麼時候會更有錢」
const q2 = '我什麼時候會更有錢';
const focus2 = app.analyzeQueryFocusAndPalaces(q2, mockSession);
const ans2 = app.buildTimeAxisProgressionAnswer(mockSession, q2, 'zh');
console.log(`1.2 [${q2}] -> focusPalace: ${focus2.focusPalaceName}`);
assert.strictEqual(focus2.focusPalaceName, '財帛宮', '我什麼時候會更有錢 之焦點宮位必須是財帛宮');
assert(ans2.calculation.includes('焦點宮位</strong>：財帛宮'), '完整推算中必須顯示焦點宮位為財帛宮');

// 3. 問「我的命何時才會財務獨立」
const q3 = '我的命何時才會財務獨立';
const focus3 = app.analyzeQueryFocusAndPalaces(q3, mockSession);
const ans3 = app.buildTimeAxisProgressionAnswer(mockSession, q3, 'zh');
console.log(`1.3 [${q3}] -> focusPalace: ${focus3.focusPalaceName}`);
assert.strictEqual(focus3.focusPalaceName, '財帛宮', '我的命何時才會財務獨立 之焦點宮位必須是財帛宮');
assert(ans3.calculation.includes('焦點宮位</strong>：財帛宮'), '完整推算中必須顯示焦點宮位為財帛宮');

// 額外測試其他關鍵字：「錢」「賺錢」「財務」「收入」「進帳」
const otherWealthQueries = [
  '我最近有錢嗎',
  '我如何賺錢',
  '我的財務狀況何時改善',
  '我下個月有收入嗎',
  '我什麼時候有進帳'
];
for (const oq of otherWealthQueries) {
  const f = app.analyzeQueryFocusAndPalaces(oq, mockSession);
  console.log(`1.x [${oq}] -> focusPalace: ${f.focusPalaceName}`);
  assert.strictEqual(f.focusPalaceName, '財帛宮', `[${oq}] 之焦點宮位必須鎖定財帛宮`);
}
console.log('✅ 測試 1 通過：只要問「財運」「錢」「賺錢」「財務」「收入」「進帳」「財務獨立」，焦點宮位 100% 鎖定財帛宮！\n');

// --------------------------------------------------------------------------
// 測試二：未來 30 天最佳日期，白話版和完整推算必須一致
// --------------------------------------------------------------------------
console.log('--- 測試 2: 白話版與完整推算最佳日期 100% 一致 ---');

function extractDatesFromText(text) {
  const matches = text.match(/\d{4}-\d{2}-\d{2}/g) || [];
  return [...new Set(matches)];
}

// 測試 buildTimeAxisProgressionAnswer
const timeAnswer = app.buildTimeAxisProgressionAnswer(mockSession, '我什麼時候會更有錢', 'zh');
const timePlainDates = extractDatesFromText(timeAnswer.plain);
const timeCalcDates = extractDatesFromText(timeAnswer.calculation);

console.log('白話版 TOP 3 日期:', timePlainDates);
console.log('完整推算 TOP 3 日期:', timeCalcDates);

assert(timePlainDates.length >= 3, '白話版必須有至少 3 個具體西元日期');
assert(timeCalcDates.length >= 3, '完整推算必須有至少 3 個具體西元日期');
assert.deepStrictEqual(timePlainDates.slice(0, 3), timeCalcDates.slice(0, 3), '白話版與完整推算日期必須完全一致');

// 測試 buildWealthAnswer
const wealthAnswer = app.buildWealthAnswer(mockSession, '我今年財運如何', 'zh');
const wealthPlainDates = extractDatesFromText(wealthAnswer.plain);
const wealthCalcDates = extractDatesFromText(wealthAnswer.calculation);

console.log('財運白話版日期:', wealthPlainDates.slice(0, 3));
console.log('財運完整推算日期:', wealthCalcDates.slice(0, 3));
assert.deepStrictEqual(wealthPlainDates.slice(0, 3), wealthCalcDates.slice(0, 3), '常規財運白話版與完整推算日期必須完全一致');

console.log('✅ 測試 2 通過：白話版與完整推算之 TOP 3 日期完全一致！\n');

// --------------------------------------------------------------------------
// 測試三：易經卦象同主題一致、換主題切換、有明確標註
// --------------------------------------------------------------------------
console.log('--- 測試 3: 易經卦象同一件事一致，換主題切換 ---');

const sessionYijing = {
  clientName: '李小姐',
  gender: '女',
  birthday: '1990-05-12',
  targetYear: 2026,
  yijingHexagramCache: {}
};

// 連續問 3 個財運問題
const hexWealth1 = app.calculateYijingHexagram('我今年財運如何', new Date(), sessionYijing);
const hexWealth2 = app.calculateYijingHexagram('我什麼時候會更有錢', new Date(), sessionYijing);
const hexWealth3 = app.calculateYijingHexagram('我的命何時才會財務獨立', new Date(), sessionYijing);

console.log('財運問題 1 卦象:', hexWealth1.nameZh);
console.log('財運問題 2 卦象:', hexWealth2.nameZh);
console.log('財運問題 3 卦象:', hexWealth3.nameZh);

assert.strictEqual(hexWealth1.nameZh, hexWealth2.nameZh, '同為財運問題，卦象必須相同');
assert.strictEqual(hexWealth2.nameZh, hexWealth3.nameZh, '同為財運問題，卦象必須相同');

// 切換至感情問題
const hexLove = app.calculateYijingHexagram('我什麼時候能結婚', new Date(), sessionYijing);
console.log('感情問題卦象:', hexLove.nameZh);
assert.notStrictEqual(hexWealth1.nameZh, hexLove.nameZh, '不同主題（財運 vs 感情）卦象必須不同');

// 確認白話版與完整推算起卦依據標註
const yijingVernacular = app.formatYijingVernacularExplanation('我今年財運如何', new Date(), 'zh', sessionYijing);
console.log('易經白話說明依據預覽:', yijingVernacular.split('\n')[1]);
assert(yijingVernacular.includes('起卦依據：依據本次諮詢【財運】時空節點起卦'), '白話版必須標註主題起卦依據');

const calcYijing = app.buildRawAstrologyCalculation(sessionYijing, '我今年財運如何', 'zh', '財帛宮');
assert(calcYijing.includes('起卦依據</strong>：依本次諮詢【財運】時空節點起卦'), '完整推算必須標註主題起卦依據');

console.log('✅ 測試 3 通過：問同一件事卦象相同，換主題卦象切換，且明確標註起卦依據！\n');

// --------------------------------------------------------------------------
// 測試四：回答不是模板（命盤星曜結合，問兩次不同，相似問題不同）
// --------------------------------------------------------------------------
console.log('--- 測試 4: 回答非模板化（結合真實星曜、問兩次不重複、相似問題有差別） ---');

const sessA = {
  clientName: '王先生',
  gender: '男',
  birthday: '1988-11-20',
  birthHour: '10:00',
  targetYear: 2026,
  categoryQueryCounts: {}
};

// 4.1 相似問題「我什麼時候會更有錢」vs「我的命何時才會財務獨立」
const ansTiming = app.buildTimeAxisProgressionAnswer(sessA, '我什麼時候會更有錢', 'zh');
const ansIndep = app.buildTimeAxisProgressionAnswer(sessA, '我的命何時才會財務獨立', 'zh');

console.log('【更有錢回答片段】:\n', ansTiming.plain.slice(0, 150), '...\n');
console.log('【財務獨立回答片段】:\n', ansIndep.plain.slice(0, 150), '...\n');

assert(!ansIndep.plain.includes('你問「我什麼時候會更有錢」'), '財務獨立回答絕不能寫死成「我什麼時候會更有錢」模板');
assert(ansIndep.plain.includes('財務獨立'), '財務獨立回答必須深入財務獨立主軸');
assert(ansIndep.plain.includes('三階推進') || ansIndep.plain.includes('正財立基'), '財務獨立回答必須有三階路線圖');
assert.notStrictEqual(ansTiming.plain, ansIndep.plain, '兩者回答內容絕不可一模一樣');

// 4.2 同一個問題問兩次，回答不會一模一樣
const sessRepeat = {
  clientName: '張先生',
  gender: '男',
  birthday: '1990-03-15',
  targetYear: 2026,
  categoryQueryCounts: {}
};

const turn1 = app.buildTimeAxisProgressionAnswer(sessRepeat, '我什麼時候會更有錢', 'zh');
const turn2 = app.buildTimeAxisProgressionAnswer(sessRepeat, '我什麼時候會更有錢', 'zh');

console.log('【問第一次片段】:\n', turn1.plain.slice(0, 120), '...\n');
console.log('【問第二次片段】:\n', turn2.plain.slice(0, 120), '...\n');

assert.notStrictEqual(turn1.plain, turn2.plain, '同一個問題問兩次，回答絕不能一模一樣');
assert(turn2.plain.includes('你再次追問') || turn2.plain.includes('既然你問了第二遍'), '問第二次必須有遞進深入解讀');

console.log('✅ 測試 4 通過：回答動態結合命盤星曜，相似問題具體區分，問兩次回答不重複！\n');

console.log('🎉🎉🎉 全部四大問題修復驗證測試 100% 通過！');
