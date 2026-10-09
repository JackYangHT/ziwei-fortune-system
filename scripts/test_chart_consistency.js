const assert = require('assert');
const app = require('../webapp/app.js');

console.log('🧪 開始執行【排盤一致性與多輪問答不重複】專項驗收測試...\n');

// 1. 模擬使用者輸入出生資料
const clientParams = {
  clientName: '王先生',
  birthday: '1971-07-10',
  birthClockTime: '00:00',
  birthPlace: '台北',
  gender: '男',
  hasExplicitBirthData: true
};

const session = app.createNewChatSession(clientParams);

// 2. 執行排盤並鎖定命盤資料於 session 中
console.log('--- 步驟 1: 建立 Session 並執行單次排盤 ---');
const chartData = app.initOrGetSessionChart(session);
assert(chartData, '命盤必須成功生成');
assert(session.chartData, '命盤必須存進 session 中');
console.log('✅ 八字四柱 (已固定):', chartData.baziFourPillars);
console.log('✅ 本命命宮 (已固定):', `命宮坐${chartData.mingGongBranch}宮`);
console.log('✅ 當前大限 (已固定):', `第 ${chartData.decadalIndex} 大限，大限命宮在${chartData.decadalPalaceBranch}宮`);

// 3. 第 1 次問「我財運如何」
console.log('\n--- 步驟 2: 第 1 次問「我財運如何」 ---');
const resWealth1 = app.buildWealthAnswer(session, '我財運如何', 'zh');
const calc1 = resWealth1.calculation;
const plain1 = resWealth1.plain;

// 提取八字、命宮、大限
const baziMatch1 = calc1.match(/八字四柱<\/strong>：([^\s<]+ [^\s<]+ [^\s<]+ [^\s<]+)/);
const mingGongMatch1 = calc1.match(/本命命宮<\/strong>：命宮坐([^\s<]+)宮/);
const daxianMatch1 = calc1.match(/大限命宮在([^\s<]+)宮/);

assert(baziMatch1, '推算依據中必須包含八字四柱');
assert(mingGongMatch1, '推算依據中必須包含本命命宮');
assert(daxianMatch1, '推算依據中必須包含大限命宮');

const bazi1 = baziMatch1[1];
const mingGong1 = mingGongMatch1[1];
const daxian1 = daxianMatch1[1];

console.log('第 1 次回答八字:', bazi1);
console.log('第 1 次回答命宮:', mingGong1);
console.log('第 1 次回答大限:', daxian1);

// 4. 第 2 次問「我財運如何」
console.log('\n--- 步驟 3: 第 2 次問「我財運如何」 ---');
const resWealth2 = app.buildWealthAnswer(session, '我財運如何', 'zh');
const calc2 = resWealth2.calculation;
const plain2 = resWealth2.plain;

const baziMatch2 = calc2.match(/八字四柱<\/strong>：([^\s<]+ [^\s<]+ [^\s<]+ [^\s<]+)/);
const mingGongMatch2 = calc2.match(/本命命宮<\/strong>：命宮坐([^\s<]+)宮/);
const daxianMatch2 = calc2.match(/大限命宮在([^\s<]+)宮/);

assert.strictEqual(baziMatch2[1], bazi1, '第 2 次八字四柱必須與第 1 次 100% 一模一樣');
assert.strictEqual(mingGongMatch2[1], mingGong1, '第 2 次命宮位置必須與第 1 次 100% 一模一樣');
assert.strictEqual(daxianMatch2[1], daxian1, '第 2 次大限位置必須與第 1 次 100% 一模一樣');
assert.notStrictEqual(plain1, plain2, '第 2 次回答內容必須與第 1 次不同（切入角度不同）');

console.log('✅ 八字一樣:', baziMatch2[1]);
console.log('✅ 命宮一樣:', mingGongMatch2[1]);
console.log('✅ 大限一樣:', daxianMatch2[1]);
console.log('✅ 回答內容不一樣（第 2 次切入田宅實質庫存與現金流防漏）');

// 5. 第 3 次問「我財運如何」
console.log('\n--- 步驟 4: 第 3 次問「我財運如何」 ---');
const resWealth3 = app.buildWealthAnswer(session, '我財運如何', 'zh');
const calc3 = resWealth3.calculation;
const plain3 = resWealth3.plain;

const baziMatch3 = calc3.match(/八字四柱<\/strong>：([^\s<]+ [^\s<]+ [^\s<]+ [^\s<]+)/);
const mingGongMatch3 = calc3.match(/本命命宮<\/strong>：命宮坐([^\s<]+)宮/);
const daxianMatch3 = calc3.match(/大限命宮在([^\s<]+)宮/);

assert.strictEqual(baziMatch3[1], bazi1, '第 3 次八字四柱必須與第 1 次 100% 一模一樣');
assert.strictEqual(mingGongMatch3[1], mingGong1, '第 3 次命宮位置必須與第 1 次 100% 一模一樣');
assert.strictEqual(daxianMatch3[1], daxian1, '第 3 次大限位置必須與第 1 次 100% 一模一樣');
assert.notStrictEqual(plain2, plain3, '第 3 次回答內容必須與第 2 次不同');
assert.notStrictEqual(plain1, plain3, '第 3 次回答內容必須與第 1 次不同');

console.log('✅ 八字一樣:', baziMatch3[1]);
console.log('✅ 命宮一樣:', mingGongMatch3[1]);
console.log('✅ 大限一樣:', daxianMatch3[1]);
console.log('✅ 回答內容不一樣（第 3 次切入急財不入急門與僕役人脈過濾）');

// 6. 問「我感情如何」
console.log('\n--- 步驟 5: 問「我感情如何」 ---');
const resLove = app.buildRelationshipAnswer(session, '我感情如何', 'zh');
const calcLove = resLove.calculation;

const baziMatchLove = calcLove.match(/八字四柱<\/strong>：([^\s<]+ [^\s<]+ [^\s<]+ [^\s<]+)/);
const mingGongMatchLove = calcLove.match(/本命命宮<\/strong>：命宮坐([^\s<]+)宮/);
const daxianMatchLove = calcLove.match(/大限命宮在([^\s<]+)宮/);

assert.strictEqual(baziMatchLove[1], bazi1, '問感情時八字四柱必須與財運 100% 一樣');
assert.strictEqual(mingGongMatchLove[1], mingGong1, '問感情時命宮位置必須與財運 100% 一樣');
assert.strictEqual(daxianMatchLove[1], daxian1, '問感情時大限位置必須與財運 100% 一樣');

console.log('✅ 八字一樣:', baziMatchLove[1]);
console.log('✅ 命宮一樣:', mingGongMatchLove[1]);
console.log('✅ 大限一樣:', daxianMatchLove[1]);

// 7. 問「我事業如何」
console.log('\n--- 步驟 6: 問「我事業如何」 ---');
const resCareer = app.buildCareerAnswer(session, '我事業如何', 'zh');
const calcCareer = resCareer.calculation;

const baziMatchCareer = calcCareer.match(/八字四柱<\/strong>：([^\s<]+ [^\s<]+ [^\s<]+ [^\s<]+)/);
const mingGongMatchCareer = calcCareer.match(/本命命宮<\/strong>：命宮坐([^\s<]+)宮/);
const daxianMatchCareer = calcCareer.match(/大限命宮在([^\s<]+)宮/);

assert.strictEqual(baziMatchCareer[1], bazi1, '問事業時八字四柱必須與財運 100% 一樣');
assert.strictEqual(mingGongMatchCareer[1], mingGong1, '問事業時命宮位置必須與財運 100% 一樣');
assert.strictEqual(daxianMatchCareer[1], daxian1, '問事業時大限位置必須與財運 100% 一樣');

console.log('✅ 八字一樣:', baziMatchCareer[1]);
console.log('✅ 命宮一樣:', mingGongMatchCareer[1]);
console.log('✅ 大限一樣:', daxianMatchCareer[1]);

// 8. 驗證幽默句不重複性
console.log('\n--- 步驟 7: 驗證同 Session 幽默句輪替不重複 ---');
const testSession = { usedHumorQuotes: {} };
const h1 = app.getDynamicHumorQuote('wealth', '寒露', 'zh', testSession);
const h2 = app.getDynamicHumorQuote('wealth', '寒露', 'zh', testSession);
const h3 = app.getDynamicHumorQuote('wealth', '寒露', 'zh', testSession);

console.log('幽默句 1:', h1);
console.log('幽默句 2:', h2);
console.log('幽默句 3:', h3);

assert.notStrictEqual(h1, h2, '幽默句 1 與幽默句 2 必須不同');
assert.notStrictEqual(h2, h3, '幽默句 2 與幽默句 3 必須不同');
assert.notStrictEqual(h1, h3, '幽默句 1 與幽默句 3 必須不同');
console.log('✅ 同 Session 連續 3 次幽默句全部不同，絕不重複！');

console.log('\n🎉🎉🎉 【排盤一致性、命宮固定、大限固定、多輪換說法與幽默句去重】所有驗收測試 100% 全部通過！');
