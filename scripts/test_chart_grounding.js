const assert = require('assert');
const app = require('../webapp/app.js');

console.log('🧪 開始執行【強制 LLM 先看命盤與回答一致性】專項驗收測試...\n');

const mockSession = {
  clientName: '李先生',
  birthday: '1988-06-18',
  birthClockTime: '10:30',
  gender: '男',
  targetYear: 2026,
  userFacts: {},
  messages: []
};

// ============================================================================
// 測試 1：問「我今年財運如何」
// 確認：
// 1. 焦點宮位是「財帛宮」，絕不是「夫妻宮」
// 2. 交叉分析五個宮位（財帛宮 + 田宅宮 + 兄弟宮 + 遷移宮 + 福德宮）
// 3. 有具體日期（年份、月份、未來 30 天 TOP 3）
// ============================================================================
console.log('--- 測試 1: 問「我今年財運如何」 ---');
const q1 = '我今年財運如何';
const ans1 = app.buildWealthAnswer(mockSession, q1, 'zh');

console.log('1. 驗證焦點宮位：');
assert(ans1.calculation, '完整推算必須存在');
assert(ans1.calculation.includes('焦點宮位'), '推算中必須包含「焦點宮位」');
assert(ans1.calculation.includes('財帛宮'), '焦點宮位必須是「財帛宮」');
assert(!ans1.calculation.includes('焦點宮位：夫妻宮'), '焦點宮位絕對不能是夫妻宮');
console.log('   ✅ 通過：焦點宮位鎖定為「財帛宮」，絕非「夫妻宮」！');

console.log('2. 驗證五宮交叉分析：');
const hasCaibo = ans1.calculation.includes('財帛宮');
const hasTianzhai = ans1.calculation.includes('田宅宮');
const hasXiongdi = ans1.calculation.includes('兄弟宮');
const hasQianyi = ans1.calculation.includes('遷移宮');
const hasFude = ans1.calculation.includes('福德宮');
assert(hasCaibo && hasTianzhai && hasXiongdi && hasQianyi && hasFude, '必須交叉分析財帛、田宅、兄弟、遷移、福德五個宮位');
assert(ans1.calculation.includes('五宮交叉分析聯動'), '推算中必須包含「五宮交叉分析聯動」');
console.log('   ✅ 通過：完整推算落實五宮交叉分析（財帛 + 田宅 + 兄弟 + 遷移 + 福德）！');

console.log('3. 驗證具體日期：');
assert(ans1.plain.includes('未來 30 天最佳日期 TOP 3'), '白話版必須包含「未來 30 天最佳日期 TOP 3」');
assert(ans1.calculation.includes('未來 30 天最佳發動日期 TOP 3'), '推算版必須包含「未來 30 天最佳發動日期 TOP 3」');
assert(ans1.calculation.includes('2026'), '必須包含具體年份 2026');
assert(ans1.calculation.includes('農曆四至六月') || ans1.calculation.includes('國曆 5-7 月'), '必須包含具體月份區間');
console.log('   ✅ 通過：給出具體年份、月份與未來 30 天最佳發動日期 TOP 3！');

// ============================================================================
// 測試 2：問「我有妻有兒女」
// 確認：
// 1. 焦點宮位是「夫妻宮 + 子女宮 + 田宅宮」，不能只有「夫妻宮」
// 2. 交叉分析三個宮位（夫妻宮 + 子女宮 + 田宅宮）
// ============================================================================
console.log('\n--- 測試 2: 問「我有妻有兒女」 ---');
const q2 = '我有妻有兒女';
assert(app.isUserStatementFactQuery(q2), '「我有妻有兒女」必須被判定為使用者陳述現實事實');

const ans2 = app.buildUserStatementFactResponse(mockSession, q2, 'zh');
console.log('1. 驗證焦點宮位：');
assert(ans2.calculation.includes('夫妻宮 + 子女宮 + 田宅宮'), '焦點宮位必須是「夫妻宮 + 子女宮 + 田宅宮」');
console.log('   ✅ 通過：焦點宮位明確鎖定為「夫妻宮 + 子女宮 + 田宅宮」！');

console.log('2. 驗證三宮交叉分析：');
assert(ans2.plain.includes('夫妻宮') && ans2.plain.includes('子女宮') && ans2.plain.includes('田宅宮'), '白話版必須解析夫妻、子女、田宅三宮');
assert(ans2.calculation.includes('家庭三宮交叉分析聯動'), '完整推算必須包含「家庭三宮交叉分析聯動」');
assert(ans2.calculation.includes('夫妻宮') && ans2.calculation.includes('子女宮') && ans2.calculation.includes('田宅宮'), '推算必須包含夫妻、子女、田宅三宮');
console.log('   ✅ 通過：白話版與完整推算均交叉分析三個宮位（夫妻宮 + 子女宮 + 田宅宮）！');

// ============================================================================
// 測試 3：問「我什麼時候會更有錢」
// 確認：
// 1. 給出具體年份、月份、日期
// 2. 不是只給方法論
// 3. 焦點宮位為「財帛宮」
// ============================================================================
console.log('\n--- 測試 3: 問「我什麼時候會更有錢」 ---');
const q3 = '我什麼時候會更有錢';
assert(app.isTimeAxisProgressionQuery(q3), '必須被識別為時間軸提問');

const ans3 = app.buildTimeAxisProgressionAnswer(mockSession, q3, 'zh');
console.log('1. 驗證給出具體年份、月份、日期：');
assert(ans3.plain.includes('2026') || ans3.plain.includes('丙午'), '白話版必須指出具體年份（2026 丙午）');
assert(ans3.plain.includes('農曆四月至六月') || ans3.plain.includes('5 月至 7 月'), '白話版必須指出具體月份');
assert(ans3.plain.includes('未來 30 天最佳發動日期 TOP 3'), '白話版必須包含「未來 30 天最佳發動日期 TOP 3」');
assert(/\d{4}-\d{2}-\d{2}/.test(ans3.plain), '白話版必須包含具體西元年月日');
console.log('   ✅ 通過：給出具體年份（2026 丙午）、具體月份、未來 30 天最佳發動日期 TOP 3！');

console.log('2. 驗證非純方法論：');
assert(ans3.plain.includes('絕不只講空泛的方法論'), '白話版明確破除純方法論教條');
assert(ans3.calculation.includes('財帛宮'), '焦點宮位必須是財帛宮');
assert(ans3.calculation.includes('五宮交叉分析聯動'), '完整推算包含五宮交叉分析');
console.log('   ✅ 通過：回答完全打破純抽象方法論，給出落地具體答案！');

// ============================================================================
// 測試 4：Prompt 注入驗證（強制 LLM 先看命盤）
// ============================================================================
console.log('\n--- 測試 4: Prompt 注入驗證（強制 LLM 先看命盤） ---');
const prompt = app.buildFortunePrompt({ rawText: q1 }, {}, q1, mockSession, 'zh');
assert(prompt.includes('【命盤焦點宮位與交叉分析真實星曜數據'), 'Prompt 必須包含命盤焦點宮位真實數據區塊');
assert(prompt.includes('財帛宮'), 'Prompt 必須包含焦點宮位「財帛宮」數據');
assert(prompt.includes('田宅宮') && prompt.includes('兄弟宮') && prompt.includes('遷移宮') && prompt.includes('福德宮'), 'Prompt 必須包含五宮數據');
assert(prompt.includes('只能根據上方命盤真實數據回答') && prompt.includes('嚴禁發明星曜'), 'Prompt 必須包含防發明星曜指令');
assert(prompt.includes('焦點宮位必須是「財帛宮」') && prompt.includes('絕對禁止跑到「夫妻宮」'), 'Prompt 必須包含焦點宮位嚴格約束');
console.log('   ✅ 通過：Prompt 成功注入真實命盤數據與嚴格回答約束！');

console.log('\n🎉 所有【強制 LLM 先看命盤與回答一致性】專項測試均順利通過！');
