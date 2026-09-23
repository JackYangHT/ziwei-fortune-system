// test_future_intent.js
// 自動化測試：未來導向意圖解析與決策回答格式驗證

console.log('=============================================================');
console.log('🔮 執行未來導向意圖解析與決策回答驗證測試套件 (Future Intent Test)');
console.log('=============================================================\n');

// 設置 Node 環境中的全域瀏覽器相容物件
global.self = global;
global.window = global;
global.document = {
  addEventListener: () => {},
  getElementById: () => ({
    addEventListener: () => {},
    innerHTML: '',
    style: {},
    classList: { add: () => {}, remove: () => {} }
  }),
  querySelectorAll: () => []
};
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  length: 0,
  key: () => null
};

// 載入 iztro 引擎
global.iztro = require('./webapp/iztro.min.js');

// 載入 app.js 模組
const app = require('./webapp/app.js');
const {
  getSystemCurrentDate,
  parseRelativeDate,
  parseIntent,
  fetchAstrologyData,
  generateNaturalAnswerFallback,
  generateAnswer,
  calculateClientAstrolabe,
  state
} = app;

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// 建立測試 Session 客戶
const testSession = {
  sessionId: 'test-session-001',
  clientName: '測試客戶',
  birthday: '1990-03-15',
  calendarType: 'solar',
  birthPlace: '台北',
  birthClockTime: '14:00',
  birthTime: 7,
  gender: '男',
  targetYear: 2026,
  includeNatal: false
};

state.currentSession = testSession;
calculateClientAstrolabe(testSession);

const sysDate = getSystemCurrentDate();
console.log(`📅 當前系統日期: ${sysDate}`);
assert(sysDate === '2026-09-23', `系統基準日期為 2026-09-23 (實際: ${sysDate})`);
assert(state.allDays && state.allDays.length >= 365, `成功計算全年 ${state.allDays.length} 天流日星盤數據`);

// -------------------------------------------------------------
// 測試一：今年偏財如何
// -------------------------------------------------------------
console.log('\n--- 測試一：詢問「今年偏財如何」---');
const q1 = '今年偏財如何';
const intent1 = parseIntent(q1, testSession, 'zh');
assert(intent1.event === 'piancai', `意圖正確識別為 piancai (實際: ${intent1.event})`);
assert(intent1.timeFrame.type === 'year' && intent1.timeFrame.isFuture, `時間範圍標記為 year 且 isFuture=true`);

const data1 = fetchAstrologyData(intent1, testSession);
assert(data1.future30DaysPiancai, 'fetchAstrologyData 回傳 future30DaysPiancai 結構');
assert(data1.future30DaysPiancai.topDays.length === 5, `給出未來 30 天內偏財最旺 TOP 5 (實際數量: ${data1.future30DaysPiancai.topDays.length})`);
assert(data1.future30DaysPiancai.topDays[0].score >= data1.future30DaysPiancai.topDays[1].score, 'TOP 5 依偏財分數降序排列');

const ans1 = generateNaturalAnswerFallback(intent1, data1, q1, testSession, 'zh');
console.log('【白話版】:', ans1.plain);
assert(ans1.plain.includes('你今年偏財最旺的日期是') || ans1.plain.includes('今年未來 30 天內偏財最旺的一天是'), `白話版第一句直接回答未來哪一天最旺 (實際: ${ans1.plain.slice(0, 35)}...)`);
assert(ans1.calculation.includes('未來 30 天內偏財最旺 TOP 5 排行榜'), '完整推算包含未來 30 天 TOP 5 排行榜');
assert(ans1.calculation.includes('命中規則'), '完整推算包含命中規則說明');

// 驗證測試一四要素：國曆 + 農曆 + 干支 + 星期
assert(/\d+\s*月\s*\d+\s*日|\d{4}-\d{2}-\d{2}/.test(ans1.plain) && ans1.plain.includes('農曆') && ans1.plain.includes('癸丑日') && ans1.plain.includes('星期二'), '測試一白話版包含國曆+農曆+干支+星期四要素');
assert(ans1.calculation.includes('2026-10-06（農曆八月廿六，癸丑日，星期二）'), '測試一推算排行榜標註國曆+農曆+干支+星期四要素');

// -------------------------------------------------------------
// 測試二：我下個月偏財如何
// -------------------------------------------------------------
console.log('\n--- 測試二：詢問「我下個月偏財如何」---');
const q2 = '我下個月偏財如何';
const intent2 = parseIntent(q2, testSession, 'zh');
assert(intent2.event === 'piancai', `意圖識別為 piancai (實際: ${intent2.event})`);
assert(intent2.timeFrame.isNextMonth, `時間範圍鎖定下個月 isNextMonth=true`);

const data2 = fetchAstrologyData(intent2, testSession);
assert(data2.nextMonthPiancai, 'fetchAstrologyData 回傳 nextMonthPiancai 結構');
assert(data2.nextMonthPiancai.topDays.length === 5, `給出下個月偏財最旺 TOP 5 (實際數量: ${data2.nextMonthPiancai.topDays.length})`);
assert(data2.nextMonthPiancai.month === '2026-10', `下個月月份標籤為 2026-10 (實際: ${data2.nextMonthPiancai.month})`);

const ans2 = generateNaturalAnswerFallback(intent2, data2, q2, testSession, 'zh');
console.log('【白話版】:', ans2.plain);
assert(ans2.plain.startsWith('下個月偏財最旺的一天是'), `白話版第一句直接回答下個月哪一天最旺 (實際: ${ans2.plain.slice(0, 30)}...)`);
assert(ans2.calculation.includes('下個月') && ans2.calculation.includes('TOP 5'), '完整推算包含下個月 TOP 5 排行榜');

// 驗證測試二四要素：國曆 + 農曆 + 干支 + 星期
assert(/\d+\s*月\s*\d+\s*日|\d{4}-\d{2}-\d{2}/.test(ans2.plain) && ans2.plain.includes('農曆') && ans2.plain.includes('癸丑日') && ans2.plain.includes('星期二'), '測試二白話版包含國曆+農曆+干支+星期四要素');
assert(ans2.calculation.includes('2026-10-06（農曆八月廿六，癸丑日，星期二）'), '測試二推算排行榜標註國曆+農曆+干支+星期四要素');

// -------------------------------------------------------------
// 測試三：我這週偏財如何
// -------------------------------------------------------------
console.log('\n--- 測試三：詢問「我這週偏財如何」---');
const q3 = '我這週偏財如何';
const intent3 = parseIntent(q3, testSession, 'zh');
assert(intent3.event === 'piancai', `意圖識別為 piancai (實際: ${intent3.event})`);
assert(intent3.timeFrame.type === 'week', `時間範圍鎖定本週 type=week`);

const data3 = fetchAstrologyData(intent3, testSession);
assert(data3.thisWeekPiancai, 'fetchAstrologyData 回傳 thisWeekPiancai 結構');
assert(data3.thisWeekPiancai.topDays.length === 3, `給出本週偏財最旺 TOP 3 (實際數量: ${data3.thisWeekPiancai.topDays.length})`);

const ans3 = generateNaturalAnswerFallback(intent3, data3, q3, testSession, 'zh');
console.log('【白話版】:', ans3.plain);
assert(ans3.plain.startsWith('這週偏財最旺的一天是'), `白話版第一句直接回答這週哪一天最旺 (實際: ${ans3.plain.slice(0, 30)}...)`);
assert(ans3.calculation.includes('本週偏財最旺 TOP 3 排行榜'), '完整推算包含本週 TOP 3 排行榜');

// 驗證測試三四要素：國曆 + 農曆 + 干支 + 星期
assert(/\d+\s*月\s*\d+\s*日|\d{4}-\d{2}-\d{2}/.test(ans3.plain) && ans3.plain.includes('農曆') && ans3.plain.includes('辛丑日') && ans3.plain.includes('星期四'), '測試三白話版包含國曆+農曆+干支+星期四要素');
assert(ans3.calculation.includes('2026-09-24（農曆八月十四，辛丑日，星期四）'), '測試三推算排行榜標註國曆+農曆+干支+星期四要素');

// -------------------------------------------------------------
// 測試四：我明天適合買彩券嗎
// -------------------------------------------------------------
console.log('\n--- 測試四：詢問「我明天適合買彩券嗎」---');
const q4 = '我明天適合買彩券嗎';
const intent4 = parseIntent(q4, testSession, 'zh');
assert(intent4.event === 'letou', `意圖識別為 letou (實際: ${intent4.event})`);
assert(intent4.timeFrame.isTomorrow, `時間範圍標記為明天 isTomorrow=true`);

const data4 = fetchAstrologyData(intent4, testSession);
assert(data4.tomorrowLottery, 'fetchAstrologyData 回傳 tomorrowLottery 結構');
assert(data4.tomorrowLottery.date === '2026-09-24', `明天日期正確為 2026-09-24 (實際: ${data4.tomorrowLottery.date})`);
assert(data4.tomorrowLottery.isSuitable === true, `明日樂透得分為 ${data4.tomorrowLottery.letouScore} 分，isSuitable 正確判斷為 true`);
assert(data4.tomorrowLottery.luckyDirection.includes('東'), `辛丑日財神吉方為正東方 (實際: ${data4.tomorrowLottery.luckyDirection})`);

const ans4 = generateNaturalAnswerFallback(intent4, data4, q4, testSession, 'zh');
console.log('【白話版】:', ans4.plain);
assert(ans4.plain.startsWith('你明天適合買彩券！'), `白話版第一句直接回答「適合」或「不適合」 (實際: ${ans4.plain.slice(0, 30)}...)`);
assert(ans4.plain.includes('申時') && ans4.plain.includes('正東方'), '提供吉時與吉方');
assert(ans4.calculation.includes('定論：【適合（大吉）】'), '完整推算明確標註定論');

// 驗證測試四四要素：國曆 + 農曆 + 干支 + 星期
assert(ans4.plain.includes('2026-09-24（農曆八月十四，辛丑日，星期四）'), '測試四白話版包含 2026-09-24（農曆八月十四，辛丑日，星期四）四要素');
assert(ans4.calculation.includes('2026-09-24（農曆八月十四，辛丑日，星期四）'), '測試四推算明確標註明日四要素');

// -------------------------------------------------------------
// 測試五：過去 vs 未來區分（我上個月偏財如何）
// -------------------------------------------------------------
console.log('\n--- 測試五：過去驗證詢問「我上個月偏財如何」---');
const q5 = '我上個月偏財如何';
const intent5 = parseIntent(q5, testSession, 'zh');
assert(intent5.timeFrame.isPast, `上個月時間解析正確標記為 isPast=true`);

const data5 = fetchAstrologyData(intent5, testSession);
const ans5 = generateNaturalAnswerFallback(intent5, data5, q5, testSession, 'zh');
console.log('【白話版】:', ans5.plain);
assert(ans5.plain.includes('歷史') || ans5.plain.includes('驗證'), `過去日期明確說明用於歷史驗證`);
assert(ans5.calculation.includes('已過，用於歷史比對') || ans5.calculation.includes('驗證用'), '推算標註過去日期供驗證比對');

// -------------------------------------------------------------
// 測試六：直接調用 generateAnswer (相容回退入口) 驗證
// -------------------------------------------------------------
console.log('\n--- 測試六：generateAnswer 核心入口驗證 ---');
const genAns1 = generateAnswer(intent1, testSession);
assert(genAns1.plain.includes('你今年偏財最旺的日期是') || genAns1.plain.includes('今年未來 30 天內偏財最旺的一天是'), 'generateAnswer 支援今年未來 30 天 TOP 5');

const genAns4 = generateAnswer(intent4, testSession);
assert(genAns4.plain.includes('你明天適合買彩券！'), 'generateAnswer 支援明天買彩券適合度直接定論');
assert(genAns4.plain.includes('2026-09-24（農曆八月十四，辛丑日，星期四）'), 'generateAnswer 明天彩券包含四要素');

// -------------------------------------------------------------
// 測試七：農曆轉換函式 (convertToLunar 與 formatAuspiciousDate) 驗證
// -------------------------------------------------------------
console.log('\n--- 測試七：農曆轉換與吉日輸出格式驗證 ---');
const { convertToLunar, formatAuspiciousDate } = app;
const lunarRes = convertToLunar('2026-10-06');
console.log('convertToLunar(2026-10-06):', lunarRes);
assert(lunarRes.solar === '2026-10-06', `solar 正確 (實際: ${lunarRes.solar})`);
assert(lunarRes.lunar === '八月廿六', `lunar 正確為 八月廿六 (實際: ${lunarRes.lunar})`);
assert(lunarRes.ganzhi === '癸丑', `ganzhi 正確為 癸丑 (實際: ${lunarRes.ganzhi})`);
assert(lunarRes.weekday === '星期二', `weekday 正確為 星期二 (實際: ${lunarRes.weekday})`);

const fmtStandard = formatAuspiciousDate('2026-10-06');
console.log('formatAuspiciousDate standard:', fmtStandard);
assert(fmtStandard === '2026-10-06（農曆八月廿六，癸丑日，星期二）', `標準格式驗證通過: ${fmtStandard}`);

const fmtDisplay = formatAuspiciousDate('2026-10-06', { displayMonthDay: true });
console.log('formatAuspiciousDate displayMonthDay:', fmtDisplay);
assert(fmtDisplay === '10 月 6 日（農曆八月廿六，癸丑日，星期二）', `白話版格式驗證通過: ${fmtDisplay}`);

console.log('\n=============================================================');
console.log(`🎉 測試結果: 通過 ${passed} / ${total} 項測試 (${Math.round((passed/total)*100)}%)`);
console.log('=============================================================');
if (passed === total) {
  console.log('🌟 所有未來導向意圖解析與決策回答驗證全部通過！');
} else {
  console.error('❌ 有部分測試未通過！');
  process.exit(1);
}
