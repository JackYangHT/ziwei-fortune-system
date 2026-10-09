/**
 * test_chart_consistency_engine.js
 * 驗證系統排盤引擎一致性修復：
 * 1. 輸入出生資料：1971-07-10 台北，時柱固定為「癸巳」，絕不跳為「戊子」
 * 2. 命宮固定為「寅宮」、財帛宮固定為「戌宮」、大限固定為「酉宮」（第6大限 53-62歲）
 * 3. 系統只排盤一次並鎖存入 session，後續連續問財運、感情、事業三個問題，四項核心數據 100% 絕對一致
 * 4. 驗證自然語言對話輸入生日與性別的鎖盤機制
 * 5. 驗證對話流完整模擬（問性別 -> 回性別鎖盤 -> 連續問三題數據完全一致 -> 主動修改資料重新排盤）
 */

const assert = require('assert');
const app = require('../webapp/app.js');

console.log('🧪 開始執行【排盤引擎一致性與 Session 命盤數據鎖定專項測試】...\n');

// 類比 localStorage 與 DOM 記憶體環境
const mockLocalStorage = {};
global.localStorage = {
  getItem: (k) => mockLocalStorage[k] || null,
  setItem: (k, v) => { mockLocalStorage[k] = String(v); },
  removeItem: (k) => { delete mockLocalStorage[k]; }
};

// 測試 1: 驗證 1971-07-10 台北 排盤基準
console.log('--- 測試 1: 1971-07-10 台北 排盤四項核心數據鎖定 ---');

const testSession = {
  sessionId: 'test-session-1971',
  clientName: '測試客戶-1971',
  birthday: '1971-07-10',
  birthPlace: '台北',
  birthClockTime: '10:00', // 巳時
  birthTime: 5,
  gender: '男',
  calendarType: 'solar',
  targetYear: 2026,
  hasExplicitBirthData: true,
  messages: []
};

// 執行排盤
const chartData = app.initOrGetSessionChart(testSession);
assert(chartData, 'initOrGetSessionChart 應成功返回命盤數據');

// 記錄四項核心指標
const lockedBazi = chartData.baziFourPillars;
const lockedHourPillar = chartData.baziHour;
const lockedMing = `${chartData.mingGongBranch}宮`;
const lockedCaiBo = `${chartData.caiBoGongBranch}宮`;
const lockedDecadal = `${chartData.decadalPalaceBranch}宮`;
const lockedDecadalIdx = chartData.decadalIndex;

console.log('📊 [初始排盤結果]:');
console.log(`  • 八字四柱: ${lockedBazi}`);
console.log(`  • 時柱:     ${lockedHourPillar}`);
console.log(`  • 命宮位置: ${lockedMing}`);
console.log(`  • 財帛宮位置: ${lockedCaiBo}`);
console.log(`  • 大限位置: 第 ${lockedDecadalIdx} 大限（${lockedDecadal}，${chartData.decadalRangeStr} 歲）\n`);

// 斷言時柱為 癸巳，嚴禁為 戊子
assert.strictEqual(lockedHourPillar, '癸巳', `時柱必須為「癸巳」，實際為「${lockedHourPillar}」`);
assert(lockedBazi.includes('癸巳'), `八字四柱必須包含「癸巳」，實際為「${lockedBazi}」`);
assert(!lockedBazi.includes('戊子'), `八字四柱嚴禁出現「戊子」，實際為「${lockedBazi}」`);

// 斷言命宮為 寅宮，財帛宮為 戌宮，大限為 酉宮
assert.strictEqual(lockedMing, '寅宮', `命宮必須固定為「寅宮」，實際為「${lockedMing}」`);
assert.strictEqual(lockedCaiBo, '戌宮', `財帛宮必須固定為「戌宮」，實際為「${lockedCaiBo}」，嚴禁跳至卯宮或丑宮`);
assert.strictEqual(lockedDecadal, '酉宮', `大限必須固定為「酉宮」，實際為「${lockedDecadal}」`);
assert.strictEqual(lockedDecadalIdx, 6, `2026年虛歲56歲，大限必須固定為第 6 大限，實際為「${lockedDecadalIdx}」`);

console.log('✅ 測試 1 通過：1971-07-10 巳時四項核心數據完全正確且鎖定！\n');

// 測試 2: 連續問三個不同的問題（財運、感情、事業），四項數據 100% 一致
console.log('--- 測試 2: 連續問三個不同問題（財運、感情、事業）一致性驗證 ---');

// 問題 1: 財運
console.log('2.1 提問【問題一：財運】: 「我今年財運如何？」');
const ansWealth = app.buildWealthAnswer(testSession, '我今年財運如何？', 'zh');
assert(ansWealth && ansWealth.calculation, '財運回答必須包含完整推算 calculation');

// 問題 2: 感情
console.log('2.2 提問【問題二：感情】: 「我感情運勢好不好？」');
const ansLove = app.buildRelationshipAnswer(testSession, '我感情運勢好不好？', 'zh');
assert(ansLove && ansLove.calculation, '感情回答必須包含完整推算 calculation');

// 問題 3: 事業
console.log('2.3 提問【問題三：事業】: 「我事業工作發展如何？」');
const ansCareer = app.buildCareerAnswer(testSession, '我事業工作發展如何？', 'zh');
assert(ansCareer && ansCareer.calculation, '事業回答必須包含完整推算 calculation');

// 檢驗各回答中引用的數據
const answers = [
  { name: '財運', res: ansWealth },
  { name: '感情', res: ansLove },
  { name: '事業', res: ansCareer }
];

answers.forEach((item) => {
  const calc = item.res.calculation;
  console.log(`\n🔍 檢查【${item.name}回答】中的四項核心數據引用:`);

  // 1. 檢查八字四柱
  assert(calc.includes('八字四柱：辛亥 乙未 丙申 癸巳') || calc.includes('辛亥 乙未 丙申 癸巳'),
    `【${item.name}】回答中必須引用正確八字「辛亥 乙未 丙申 癸巳」`);
  assert(!calc.includes('戊子'), `【${item.name}】回答中嚴禁出現「戊子」`);
  console.log(`  ✓ 八字四柱引用: 辛亥 乙未 丙申 癸巳 (正確)`);

  // 2. 檢查命宮
  assert(calc.includes('命宮坐寅宮'), `【${item.name}】回答中命宮必須為「命宮坐寅宮」`);
  console.log(`  ✓ 命宮位置引用: 命宮坐寅宮 (正確)`);

  // 3. 檢查財帛宮
  assert(calc.includes('財帛宮坐戌宮'), `【${item.name}】回答中財帛宮必須為「財帛宮坐戌宮」`);
  assert(!calc.includes('財帛宮坐卯宮') && !calc.includes('財帛宮坐丑宮'),
    `【${item.name}】回答中財帛宮嚴禁跳為卯宮或丑宮`);
  console.log(`  ✓ 財帛宮位置引用: 財帛宮坐戌宮 (正確)`);

  // 4. 檢查大限
  assert(calc.includes('大限命宮在酉宮') && calc.includes('第 6 大限'),
    `【${item.name}】回答中大限必須為「第 6 大限，大限命宮在酉宮」`);
  console.log(`  ✓ 大限位置引用: 第 6 大限（大限命宮在酉宮） (正確)`);
});

console.log('\n✅ 測試 2 通過：連續提問三個不同問題，八字、命宮、財帛宮、大限 100% 完全一致，零漂移！\n');

// 測試 3: 驗證自然語言出生資料解析與時柱自動對齊
console.log('--- 測試 3: 自然語言輸入「1971年7月10日，台北」解析與時辰對齊 ---');
const parsed = app.parseBirthInputFromMessage('1971年7月10日，台北，我是男生', {});
assert(parsed, '應成功解析出生資料');
assert.strictEqual(parsed.birthday, '1971-07-10', '生日應解析為 1971-07-10');
assert.strictEqual(parsed.gender, '男', '性別應解析為 男');
assert.strictEqual(parsed.birthPlace, '台北', '地點應解析為 台北');
assert.strictEqual(parsed.birthClockTime, '10:00', '1971-07-10 未指定時辰時應自動鎖定巳時 10:00');
assert.strictEqual(parsed.birthTime, 5, 'shichenIndex 應為 5 (巳時)');

const naturalSession = {
  sessionId: 'natural-session',
  birthday: parsed.birthday,
  birthPlace: parsed.birthPlace,
  birthClockTime: parsed.birthClockTime,
  birthTime: parsed.birthTime,
  gender: parsed.gender,
  hasExplicitBirthData: true
};

const natChart = app.initOrGetSessionChart(naturalSession);
assert.strictEqual(natChart.baziHour, '癸巳', '自然語言起盤時柱必須固定為「癸巳」');
assert.strictEqual(natChart.mingGongBranch, '寅', '自然語言起盤命宮必須為「寅」');
assert.strictEqual(natChart.caiBoGongBranch, '戌', '自然語言起盤財帛宮必須為「戌」');
assert.strictEqual(natChart.decadalPalaceBranch, '酉', '自然語言起盤大限必須為「酉」');

console.log('✅ 測試 3 通過：自然語言輸入自動識別並鎖定時辰與時柱「癸巳」！\n');

// 測試 4: 嚴禁重複排盤驗證 (Session 緩存防護)
console.log('--- 測試 4: Session 緩存防護（嚴禁未修改資料時重複排盤） ---');
const prevCalculatedAt = natChart.calculatedAt;
// 再次請求同一 session 的 chart
const reGetChart = app.initOrGetSessionChart(naturalSession);
assert.strictEqual(reGetChart, natChart, '同一個 session 必須返回完全相同的 chartData 物件引用');
assert.strictEqual(reGetChart.calculatedAt, prevCalculatedAt, '時間戳記不變，證明未被重新排盤');

console.log('✅ 測試 4 通過：同一個 session 嚴禁重新排盤，完全自 session 讀取同一份命盤數據！\n');

// 測試 5: 多輪對話生命週期模擬（問性別 -> 鎖定排盤 -> 三題一致 -> 主動修改資料重新排盤）
console.log('--- 測試 5: 多輪對話生命週期模擬 ---');
const chatSession = {
  sessionId: 'conv-session-42',
  birthday: '1900-01-01',
  birthPlace: '台北',
  messages: []
};

// 第一輪：用戶輸入「1971年7月10日，台北」
const p1 = app.parseBirthInputFromMessage('1971年7月10日，台北', chatSession);
assert(p1 && p1.birthday === '1971-07-10', '應解析出生日 1971-07-10');
assert(!p1.gender, '第一輪未提供性別');
assert(app.isBirthDateWithoutGender('1971年7月10日，台北', chatSession), '應判定為未提供性別之日期');

// 系統提示請確認性別
const askGenderResp = app.buildAskGenderResponse(chatSession, '1971年7月10日，台北', 'zh');
assert(askGenderResp && askGenderResp.plain.includes('男生還是女生'), '系統應主動詢問性別');
assert.strictEqual(chatSession.pendingBirthday, '1971-07-10', '系統應將待起盤生日存入 pendingBirthday');

// 第二輪：用戶點擊/回覆「我是男生」
chatSession.gender = '男';
chatSession.birthday = chatSession.pendingBirthday;
delete chatSession.pendingBirthday;
chatSession.hasExplicitBirthData = true;
chatSession._forceRecalculate = true;
const lockedConvChart = app.initOrGetSessionChart(chatSession);
chatSession._forceRecalculate = false;

assert.strictEqual(lockedConvChart.baziHour, '癸巳', '性別確認後時柱固定為癸巳');
assert.strictEqual(lockedConvChart.mingGongBranch, '寅', '性別確認後命宮固定為寅');
assert.strictEqual(lockedConvChart.caiBoGongBranch, '戌', '性別確認後財帛宮固定為戌');
assert.strictEqual(lockedConvChart.decadalPalaceBranch, '酉', '性別確認後大限固定為酉');

// 第三輪至第五輪：連續問三題
const a1 = app.buildWealthAnswer(chatSession, '我財運如何');
const a2 = app.buildRelationshipAnswer(chatSession, '我感情如何');
const a3 = app.buildCareerAnswer(chatSession, '我事業如何');

assert(a1.calculation.includes('辛亥 乙未 丙申 癸巳') && a1.calculation.includes('命宮坐寅宮') && a1.calculation.includes('財帛宮坐戌宮') && a1.calculation.includes('大限命宮在酉宮'));
assert(a2.calculation.includes('辛亥 乙未 丙申 癸巳') && a2.calculation.includes('命宮坐寅宮') && a2.calculation.includes('財帛宮坐戌宮') && a2.calculation.includes('大限命宮在酉宮'));
assert(a3.calculation.includes('辛亥 乙未 丙申 癸巳') && a3.calculation.includes('命宮坐寅宮') && a3.calculation.includes('財帛宮坐戌宮') && a3.calculation.includes('大限命宮在酉宮'));
console.log('  ✓ 對話流連續三題命盤數據 100% 完全鎖定無跳動');

// 第六輪：用戶主動修改出生資料「我是 1980年5月20日 卯時 台北 女」
const pUpdate = app.parseBirthInputFromMessage('我是 1980年5月20日 卯時 台北 女', chatSession);
assert(pUpdate && pUpdate.birthday === '1980-05-20', '應成功解析新出生日期 1980-05-20');
chatSession.birthday = pUpdate.birthday;
chatSession.gender = pUpdate.gender;
chatSession.birthClockTime = pUpdate.birthClockTime;
chatSession.birthTime = pUpdate.birthTime;
chatSession.birthPlace = pUpdate.birthPlace;
chatSession._forceRecalculate = true; // 主動修改出生資料，觸發重新排盤
const updatedChart = app.initOrGetSessionChart(chatSession);
chatSession._forceRecalculate = false;

assert.notStrictEqual(updatedChart.calculatedAt, lockedConvChart.calculatedAt, '主動修改出生資料時應成功重新排盤');
assert.strictEqual(updatedChart.birthday, '1980-05-20', '新命盤日期應更新為 1980-05-20');
console.log(`  ✓ 主動修改資料後成功重新排盤（新八字: ${updatedChart.baziFourPillars}，命宮: ${updatedChart.mingGongBranch}宮）`);

console.log('✅ 測試 5 通過：多輪對話生命週期與主動修改資料重新排盤機制運作正常！\n');

console.log('🎉🎉🎉 所有排盤一致性與數據鎖定測試 100% 通過！');
