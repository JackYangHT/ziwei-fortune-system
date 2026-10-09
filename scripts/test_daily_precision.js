const assert = require('assert');
const app = require('../webapp/app.js');

console.log('🧪 開始執行【流日極致精準推算模組與四重微觀驗證測試】...\n');

const mockSession = {
  clientName: '陳先生',
  gender: '男',
  birthday: '1985-06-15',
  birthHour: '08:30',
  targetYear: 2026,
  messages: []
};

// ============================================================================
// 測試一：問「我今日運勢如何」
// 驗證四重微觀驗證與科學命理白話轉譯
// ============================================================================
console.log('--- 測試 1: 問「我今日運勢如何」啟動四重微觀驗證 ---');
const qToday = '我今日運勢如何';
assert(app.isDailyPrecisionQuery(qToday), '「我今日運勢如何」必須被判定為流日微觀驗證提問');

const ansToday = app.buildDailyPrecisionAnswer(mockSession, qToday, 'zh');
const plainToday = ansToday.plain;
const calcToday = ansToday.calculation;

console.log('1.1 檢查開頭招呼與模組啟動宣告：');
assert(plainToday.includes('好，我捏好了。'), '白話版開頭必須有「好，我捏好了。」');
assert(plainToday.includes('流日極致精準推算模組'), '白話版必須提及「流日極致精準推算模組」');
assert(plainToday.includes('四重微觀驗證'), '白話版必須提及「四重微觀驗證」');
assert(plainToday.includes('不可僅憑八字日柱斷吉凶'), '白話版必須提醒不可僅憑八字日柱斷吉凶');

console.log('1.2 檢查第一重：建除與神煞：');
assert(plainToday.includes('第一重 · 建除與神煞'), '必須包含第一重建除與神煞');
assert(/建除十二神.*日/i.test(plainToday), '必須標註建除十二神何日');
assert(plainToday.includes('流日天乙貴人'), '必須檢查流日天乙貴人');
assert(plainToday.includes('流日驛馬'), '必須檢查流日驛馬');
assert(plainToday.includes('日破檢驗') || plainToday.includes('相沖'), '必須檢查日破');

console.log('1.3 檢查第二重：二十八星宿：');
assert(plainToday.includes('第二重 · 二十八星宿'), '必須包含第二重二十八星宿');
assert(plainToday.includes('宿'), '必須包含輪值星宿名稱');
assert(plainToday.includes('吉星') || plainToday.includes('凶星'), '必須簡述輪值星宿基礎能量屬性（吉星或凶星）');

console.log('1.4 檢查第三重：奇門遁甲（時家）：');
assert(plainToday.includes('第三重 · 奇門遁甲'), '必須包含第三重奇門遁甲');
assert(plainToday.includes('當日具體吉時') || plainToday.includes('吉時'), '必須指出當日吉時');
assert(plainToday.includes('生門') && plainToday.includes('開門'), '必須指出吉利方位（生門、開門所在方位）');
assert(plainToday.includes('阻力最小'), '必須指出阻力最小行動路徑');

console.log('1.5 檢查第四重：中醫子午流注：');
assert(plainToday.includes('第四重 · 中醫子午流注'), '必須包含第四重中醫子午流注');
assert(plainToday.includes('最佳行動時間點') || plainToday.includes('最佳時間點'), '必須給出當日最佳行動時間點');
assert(plainToday.includes('巳時') && plainToday.includes('脾經當令') && plainToday.includes('思慮最清晰'), '必須包含子午流注經絡氣血文書時段（巳時脾經當令）');

console.log('1.6 檢查科學命理白話轉譯：');
assert(plainToday.includes('科學命理白話轉譯') || plainToday.includes('現代科學'), '必須包含科學命理白話轉譯');
assert(plainToday.includes('環境磁場') || plainToday.includes('磁場'), '必須連結環境磁場科學解釋');
assert(plainToday.includes('晝夜節律') || plainToday.includes('Circadian') || plainToday.includes('前額葉'), '必須連結人體晝夜節律或神經科學');

console.log('1.7 檢查完整推算中包含流日微觀驗證六大項目：');
assert(calcToday.includes('六、流日極致微觀驗證（建除·星宿·奇門·子午流注）'), '完整推算必須包含第六部分流日微觀驗證');
assert(calcToday.includes('第一重 · 建除與神煞'), '完整推算必須包含第一重建除與神煞');
assert(calcToday.includes('第二重 · 二十八星宿'), '完整推算必須包含第二重二十八星宿');
assert(calcToday.includes('第三重 · 奇門遁甲吉方'), '完整推算必須包含第三重奇門遁甲');
assert(calcToday.includes('第四重 · 中醫子午流注'), '完整推算必須包含第四重中醫子午流注');

console.log('✅ 測試 1 通過：「我今日運勢如何」具備四重微觀驗證、科學命理轉譯與完整推算！\n');

// ============================================================================
// 測試二：問「我明天適合簽約嗎」
// 驗證具體吉時、吉利方位、最佳行動時間點
// ============================================================================
console.log('--- 測試 2: 問「我明天適合簽約嗎」 ---');
const qSigning = '我明天適合簽約嗎';
assert(app.isDailyPrecisionQuery(qSigning), '「我明天適合簽約嗎」必須被判定為流日微觀驗證提問');

const ansSigning = app.buildDailyPrecisionAnswer(mockSession, qSigning, 'zh');
const plainSigning = ansSigning.plain;
const dpSigning = ansSigning.dailyPrecision;

console.log('2.1 檢查簽約評估結論：');
assert(plainSigning.includes('評估結論') || plainSigning.includes('簽約'), '白話版必須包含明確的簽約評估結論');

console.log('2.2 檢查具體吉時：');
assert(dpSigning.bestHoursStr && dpSigning.bestHoursStr.length > 0, '計算模組必須提供具體吉時');
assert(plainSigning.includes('吉時'), '白話版必須包含具體吉時');
assert(plainSigning.includes('09:00') || plainSigning.includes('15:00'), '必須明確標示出吉時時段');

console.log('2.3 檢查吉利方位（生門、開門）：');
assert(dpSigning.kaiMenDirection && dpSigning.kaiMenDirection.length > 0, '奇門開門方位必須計算出');
assert(dpSigning.shengMenDirection && dpSigning.shengMenDirection.length > 0, '奇門生門方位必須計算出');
assert(plainSigning.includes(dpSigning.kaiMenDirection), '白話版必須包含開門吉方');
assert(plainSigning.includes(dpSigning.shengMenDirection), '白話版必須包含生門吉方');
assert(plainSigning.includes(dpSigning.qimenPath), '白話版必須包含阻力最小行動路徑');

console.log('2.4 檢查最佳行動時間點與子午流注簽約安排：');
assert(dpSigning.ziwuBestHourStr && dpSigning.ziwuBestHourStr.length > 0, '子午流注最佳時間點必須存在');
assert(plainSigning.includes('最佳行動時間點'), '白話版必須包含最佳行動時間點');
assert(plainSigning.includes('巳時，脾經當令，思慮最清晰'), '白話版必須包含上午 9-11 點巳時審查文書建議');
assert(plainSigning.includes('申時，膀胱經當令') || plainSigning.includes('15-17 點'), '白話版必須包含下午簽約拍板建議');

console.log('✅ 測試 2 通過：「我明天適合簽約嗎」精準給出具體吉時、吉利方位與最佳行動時間點！\n');

// ============================================================================
// 測試三：科學命理白話轉譯詞彙與邏輯驗證
// ============================================================================
console.log('--- 測試 3: 科學命理白話轉譯（破日 vs 成日） ---');
// 模擬破日（2026-10-09 丙辰日，戌月，辰戌相沖破日）
const dpPo = app.calculateDailyPrecisionVerification('2026-10-09', mockSession, '今日運勢', 'zh');
console.log(`3.1 2026-10-09: zhixing = ${dpPo.zhixing}, isRiPo = ${dpPo.isRiPo}`);
assert(dpPo.zhixing === '破' || dpPo.isRiPo, '2026-10-09 應為破日或月破沖日');
assert(dpPo.scientificTranslation.includes('今日為『破日』') || dpPo.scientificTranslation.includes('環境磁場處於不穩定的發散狀態'), '破日科學轉譯必須說明環境磁場處於不穩定的發散狀態');

// 模擬成日（2026-10-11 戊午日）
const dpCheng = app.calculateDailyPrecisionVerification('2026-10-11', mockSession, '今日運勢', 'zh');
console.log(`3.2 2026-10-11: zhixing = ${dpCheng.zhixing}`);
assert(dpCheng.zhixing === '成', '2026-10-11 應為成日');
assert(dpCheng.scientificTranslation.includes('今日為『成日』') && dpCheng.scientificTranslation.includes('代表環境磁場穩定，適合做決定'), '成日科學轉譯必須說明代表環境磁場穩定，適合做決定');

console.log('✅ 測試 3 通過：科學命理白話轉譯完整符合規範！\n');

// ============================================================================
// 測試四：查詢意圖與排除邏輯驗證
// ============================================================================
console.log('--- 測試 4: 查詢意圖判定與邊界排除 ---');
const positiveQueries = [
  '我今日運勢如何',
  '今日運勢',
  '今天運勢好嗎',
  '明天運勢怎麼樣',
  '我明天適合簽約嗎',
  '下週三適合簽合同嗎',
  '今天適合談判嗎',
  '10月15日適合簽約嗎'
];
for (const q of positiveQueries) {
  assert(app.isDailyPrecisionQuery(q), `[${q}] 應被判定為流日微觀驗證提問`);
}

const negativeQueries = [
  '我在工作領薪水',
  '我有妻有兒女',
  '我什麼時候會更有錢',
  '我的命何時才會財務獨立',
  '我想買大樂透幸運號碼'
];
for (const q of negativeQueries) {
  assert(!app.isDailyPrecisionQuery(q), `[${q}] 應被排除，不可被誤判為流日微觀驗證提問`);
}
console.log('✅ 測試 4 通過：意圖判定精準且安全排除其他領域指令！\n');

console.log('🎉 所有測試 100% 通過！【流日極致精準推算模組】四重微觀驗證完美就緒！');
