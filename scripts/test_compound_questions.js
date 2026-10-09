const assert = require('assert');
const app = require('../webapp/app.js');

console.log('🧪 開始執行【複合問題偵測、拆解與逐個回答專項測試】...\n');

const mockSession = {
  clientName: '陳先生',
  gender: '男',
  birthday: '1985-06-15',
  birthHour: '08:30',
  targetYear: 2026,
  messages: []
};

// ============================================================================
// 測試一：問「我何時有錢和家庭感情好起來」
// 驗證拆解為兩個子問題、逐個回答、焦點宮位、交叉分析、具體日期、易經卦象
// ============================================================================
console.log('--- 測試 1: 問「我何時有錢和家庭感情好起來」 ---');
const q1 = '我何時有錢和家庭感情好起來';
assert(app.isCompoundQuestion(q1), '「我何時有錢和家庭感情好起來」必須被判定為複合問題');

const subs1 = app.decomposeCompoundQuestion(q1);
console.log('1.1 拆解子問題結果：', subs1.map(s => s.text));
assert.strictEqual(subs1.length, 2, '必須拆解成兩個子問題');
assert(subs1[0].domain === 'wealth', '子問題一必須為財運 domain');
assert(subs1[1].domain === 'family' || subs1[1].domain === 'relationship', '子問題二必須為家庭或感情 domain');
assert(subs1[0].text.includes('有錢'), '子問題一文字必須提及有錢');
assert(subs1[1].text.includes('家庭') || subs1[1].text.includes('感情'), '子問題二文字必須提及家庭感情');

const ans1 = app.buildCompoundQuestionAnswer(mockSession, q1, 'zh');
const plain1 = ans1.plain;
const calc1 = ans1.calculation;

console.log('1.2 檢查回答結構與開頭宣告：');
assert(plain1.includes('你問了兩個問題，Jack 老師一個一個回答你。'), '開頭必須包含「你問了兩個問題，Jack 老師一個一個回答你。」');
assert(plain1.includes('好，我捏好了。'), '必須包含親切招呼');
assert(plain1.includes('【第一個問題：你問何時有錢……】') || plain1.includes('第一個問題'), '必須有第一個問題專屬區塊');
assert(plain1.includes('【第二個問題：你問家庭感情何時好起來……】') || plain1.includes('第二個問題'), '必須有第二個問題專屬區塊');
assert(plain1.includes('【綜合雙軌破局總結】') || plain1.includes('綜合總結'), '必須有結尾綜合總結');

console.log('1.3 檢查財運子問題要素（焦點宮位、交叉分析、具體日期、易經卦象）：');
assert(plain1.includes('財帛宮'), '財運必須包含焦點宮位財帛宮');
assert(plain1.includes('交叉分析'), '財運必須包含交叉分析');
assert(plain1.includes('田宅宮') && plain1.includes('兄弟宮'), '財運交叉分析必須包含田宅、兄弟等庫存現金流宮位');
assert(plain1.includes('2026') || plain1.includes('丙午'), '財運必須包含關鍵時程年份');
assert(plain1.includes('最佳發動日期 TOP 3') || plain1.includes('TOP 3'), '財運必須包含未來 30 天具體日期 TOP 3');
assert(plain1.includes('易經決策卦象'), '財運必須包含易經決策卦象');

console.log('1.4 檢查家庭感情子問題要素（焦點宮位、交叉分析、具體日期、易經卦象）：');
assert(plain1.includes('夫妻宮') || plain1.includes('家庭三宮'), '感情/家庭必須包含焦點宮位');
assert(plain1.includes('子女宮') && plain1.includes('田宅宮'), '家庭三宮必須交叉分析子女與田宅');
assert(plain1.includes('最佳家庭和睦互動吉日 TOP 3') || plain1.includes('吉日 TOP 3') || plain1.includes('TOP 3'), '家庭感情必須包含具體吉日');
assert(plain1.includes('易經決策卦象'), '家庭感情必須包含易經決策卦象');

console.log('1.5 檢查完整推算 calculation 涵蓋雙子問題：');
assert(calc1.includes('複合問題') || (calc1.includes('八字四柱') && calc1.includes('焦點宮位')), '完整推算必須涵蓋完整排盤依據');

console.log('✅ 測試 1 通過：「我何時有錢和家庭感情好起來」完美拆解並逐個雙軌回答！\n');

// ============================================================================
// 測試二：問「我事業和健康如何」
// 驗證事業+健康複合問題拆解與回答
// ============================================================================
console.log('--- 測試 2: 問「我事業和健康如何」 ---');
const q2 = '我事業和健康如何';
assert(app.isCompoundQuestion(q2), '「我事業和健康如何」必須被判定為複合問題');

const subs2 = app.decomposeCompoundQuestion(q2);
console.log('2.1 拆解子問題結果：', subs2.map(s => s.text));
assert.strictEqual(subs2.length, 2, '必須拆解成兩個子問題');
assert(subs2[0].domain === 'career', '子問題一必須為事業 career domain');
assert(subs2[1].domain === 'health', '子問題二必須為健康 health domain');
assert(subs2[0].text.includes('事業'), '子問題一必須提及事業');
assert(subs2[1].text.includes('健康'), '子問題二必須提及健康');

const ans2 = app.buildCompoundQuestionAnswer(mockSession, q2, 'zh');
const plain2 = ans2.plain;

console.log('2.2 檢查回答內容：');
assert(plain2.includes('你問了兩個問題，Jack 老師一個一個回答你。'), '開頭必須包含「你問了兩個問題，Jack 老師一個一個回答你。」');
assert(plain2.includes('官祿宮'), '事業部分必須包含焦點宮位官祿宮');
assert(plain2.includes('疾厄宮'), '健康部分必須包含焦點宮位疾厄宮');
assert(plain2.includes('交叉分析'), '必須包含交叉分析');
assert(plain2.includes('易經決策卦象'), '必須包含易經決策卦象');
assert(plain2.includes('TOP 3'), '必須包含具體日期 TOP 3');

console.log('✅ 測試 2 通過：「我事業和健康如何」完美拆解並逐個回答！\n');

// ============================================================================
// 測試三：常見複合問題形式（三問題、其他連接詞）
// ============================================================================
console.log('--- 測試 3: 三問題與其他連接詞（還有、跟、以及、頓號） ---');
const q3 = '我財運、事業還有感情怎麼樣';
assert(app.isCompoundQuestion(q3), '三領域複合問題必須被判定為複合問題');
const subs3 = app.decomposeCompoundQuestion(q3);
console.log('3.1 拆解三問題結果：', subs3.map(s => s.text));
assert.strictEqual(subs3.length, 3, '必須拆解成三個子問題');
const ans3 = app.buildCompoundQuestionAnswer(mockSession, q3, 'zh');
assert(ans3.plain.includes('你問了三個問題，Jack 老師一個一個回答你。'), '三問題開頭必須說問了三個問題');
assert(ans3.plain.includes('財帛宮') && ans3.plain.includes('官祿宮') && ans3.plain.includes('夫妻宮'), '三問題必須涵蓋三個宮位');

const q4 = '我今年工作如何跟身體好不好';
assert(app.isCompoundQuestion(q4), '「跟」連接詞必須成功識別');
const subs4 = app.decomposeCompoundQuestion(q4);
assert.strictEqual(subs4.length, 2, '必須拆解為工作與身體兩個問題');

console.log('✅ 測試 3 通過：三問題與多種連接詞（還有、跟、頓號）均能精準拆解！\n');

// ============================================================================
// 測試四：邊界與非複合問題排除（不可誤判）
// ============================================================================
console.log('--- 測試 4: 邊界與非複合問題排除 ---');
const nonCompoundQueries = [
  '我有妻有兒女',
  '在工作領固定薪水',
  '我和老婆感情如何',
  '我什麼時候會更有錢',
  '天同和巨門在命宮',
  '我想買大樂透幸運號碼'
];
for (const nq of nonCompoundQueries) {
  const isC = app.isCompoundQuestion(nq);
  console.log(`4.x [${nq}] -> isCompound: ${isC}`);
  assert(!isC, `[${nq}] 不可被誤判為複合問題`);
}
console.log('✅ 測試 4 通過：非複合問題均安全排除，不影響原有單一問題處理流程！\n');

console.log('🎉 所有測試 100% 通過！【複合問題處理模組】完美就緒！');
