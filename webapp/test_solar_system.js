const assert = require('assert');
global.self = global;
const iztro = require('./iztro.min.js');
const server = require('./server.js');

console.log('================================================================');
console.log('🧪 紫微斗數「出生地與真太陽時天文校正」全套自動化測試驗證');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${testName}`);
    passCount++;
  } catch (err) {
    console.error(`❌ [FAIL] ${testName}`);
    console.error(err);
    failCount++;
  }
}

// -------------------------------------------------------------
// 測試 1: 曼谷測試案例 (1977-07-26 08:00 曼谷)
// 需求：鐘錶 08:00 ➔ 真太陽時 07:35 ➔ 辰時 07:00-09:00
// -------------------------------------------------------------
runTest('測試 1: 曼谷 1977-07-26 08:00 (鐘錶 08:00 ➔ 真太陽時 07:35 ➔ 辰時)', () => {
  const result = server.calculateSolarTime('1977-07-26', '08:00', '曼谷');
  
  assert.strictEqual(result.clockTime, '08:00', '鐘錶時間應為 08:00');
  assert.strictEqual(result.location.name, '曼谷', '城市名稱應為曼谷');
  assert.strictEqual(result.location.tz, 7, '曼谷時區應為 UTC+7');
  assert.strictEqual(result.location.centralMeridian, 105, '曼谷中央經線應為 105°E');
  assert.strictEqual(result.geoOffsetMinutes, -18, '地理時差應為 -18 分鐘 (4 * (100.5 - 105))');
  assert.ok(Math.abs(result.eotMinutes - (-6.6)) < 0.5, `均時差 EOT 應約為 -6.6 分鐘 (實際: ${result.eotMinutes})`);
  assert.strictEqual(result.trueSolarTime, '07:35', '真太陽時應精準為 07:35');
  assert.strictEqual(result.adjustedShichenIndex, 4, '校正後時辰 index 應為 4 (辰時)');
  assert.ok(result.adjustedShichenName.includes('辰時'), '校正後時辰應包含辰時');
  
  // 驗證 iztro 排盤結果
  const astrolabe = iztro.astro.bySolar('1977-07-26', result.adjustedShichenIndex, '男', true, 'zh-CN');
  assert.ok(astrolabe, 'iztro 命盤排定成功');
  console.log(`   ➔ 曼谷排盤驗證成功: 鐘錶 ${result.clockTime} ➔ 真太陽時 ${result.trueSolarTime} (${result.adjustedShichenShort}時)，五行局: ${astrolabe.fiveElementsClass}，命主: ${astrolabe.soul}`);
});

// -------------------------------------------------------------
// 測試 2: 台北測試案例 (1990-03-15 14:00 台北)
// 需求：鐘錶 14:00 ➔ 台北經度 121.5° 時差 +6m ➔ 未時 13:00-15:00
// -------------------------------------------------------------
runTest('測試 2: 台北 1990-03-15 14:00 (鐘錶 14:00 ➔ 經度時差 +6m ➔ 未時 13:00-15:00)', () => {
  const result = server.calculateSolarTime('1990-03-15', '14:00', '台北');
  
  assert.strictEqual(result.clockTime, '14:00', '鐘錶時間應為 14:00');
  assert.strictEqual(result.location.name, '台北', '城市名稱應為台北');
  assert.strictEqual(result.location.tz, 8, '台北時區應為 UTC+8');
  assert.strictEqual(result.location.centralMeridian, 120, '台北中央經線應為 120°E');
  assert.strictEqual(result.geoOffsetMinutes, 6, '地理時差應為 +6 分鐘 (4 * (121.5 - 120))');
  assert.strictEqual(result.meanSolarTime, '14:06', '平太陽時應為 14:06 (鐘錶 14:00 + 時差 6m)');
  assert.ok(Math.abs(result.eotMinutes - (-9.6)) < 0.5, `均時差 EOT 應約為 -9.6 分鐘 (實際: ${result.eotMinutes})`);
  assert.strictEqual(result.trueSolarTime, '13:56', '真太陽時應為 13:56');
  assert.strictEqual(result.adjustedShichenIndex, 7, '校正後時辰 index 應為 7 (未時)');
  assert.ok(result.adjustedShichenName.includes('未時'), '校正後時辰應為未時');

  const astrolabe = iztro.astro.bySolar('1990-03-15', result.adjustedShichenIndex, '男', true, 'zh-CN');
  assert.ok(astrolabe, 'iztro 命盤排定成功');
  console.log(`   ➔ 台北排盤驗證成功: 鐘錶 ${result.clockTime} ➔ 平太陽時 ${result.meanSolarTime} ➔ 真太陽時 ${result.trueSolarTime} (${result.adjustedShichenShort}時)，五行局: ${astrolabe.fiveElementsClass}，命主: ${astrolabe.soul}`);
});

// -------------------------------------------------------------
// 測試 3: 時辰邊界處理 (前後 15 分鐘內)
// 需求：排出前後兩個時辰命盤、標註差異、提示確認出生時間
// -------------------------------------------------------------
runTest('測試 3: 時辰邊界檢測與雙時辰雙盤比對 (1990-03-15 13:10 台北，真太陽時 13:06 距 13:00 僅差 6.4 分鐘)', () => {
  const result = server.calculateSolarTime('1990-03-15', '13:10', '台北');
  
  assert.strictEqual(result.isNearBoundary, true, '距交界 6.4 分鐘 (<=15 分鐘)，應標記為時辰邊界');
  assert.ok(result.boundaryInfo, '應提供 boundaryInfo 物件');
  assert.strictEqual(result.boundaryInfo.boundaryTime, '13:00', '最近交界時刻應為 13:00');
  assert.ok(result.boundaryInfo.diffMinutes <= 15, '交界分差應小於等於 15 分鐘');
  assert.strictEqual(result.boundaryInfo.alternativeShichenIndex, 6, '相鄰時辰 index 應為 6 (午時)');
  assert.ok(result.boundaryInfo.alternativeShichenName.includes('午時'), '相鄰時辰應為午時');

  // 比對雙時辰命盤差異
  const chartMain = iztro.astro.bySolar('1990-03-15', result.adjustedShichenIndex, '男', true, 'zh-CN');
  const chartAlt = iztro.astro.bySolar('1990-03-15', result.boundaryInfo.alternativeShichenIndex, '男', true, 'zh-CN');
  assert.ok(chartMain && chartAlt, '前後雙時辰命盤皆順利生成');
  
  const mingMain = chartMain.palaces.find(p => p.name === '命宫' || p.name === '命宮');
  const mingAlt = chartAlt.palaces.find(p => p.name === '命宫' || p.name === '命宮');
  assert.notStrictEqual(mingMain.earthlyBranch, mingAlt.earthlyBranch, '雙時辰命宮地支應有顯著差異');
  console.log(`   ➔ 邊界雙盤成功比對: 主時辰未時 (命宮在${mingMain.earthlyBranch}) vs 相鄰午時 (命宮在${mingAlt.earthlyBranch})`);
});

// -------------------------------------------------------------
// 測試 4: 跨時辰校正 (原時辰 X ➔ 校正後時辰 Y)
// -------------------------------------------------------------
runTest('測試 4: 跨時辰校正 (曼谷 1977-07-26 07:15，鐘錶辰時 ➔ 真太陽時 06:50 卯時)', () => {
  const result = server.calculateSolarTime('1977-07-26', '07:15', '曼谷');
  
  assert.strictEqual(result.originalShichenIndex, 4, '鐘錶 07:15 原為辰時 (index 4)');
  assert.strictEqual(result.adjustedShichenIndex, 3, '校正後 06:50 切換為卯時 (index 3)');
  assert.strictEqual(result.isShichenChanged, true, 'isShichenChanged 應為 true');
  assert.strictEqual(result.originalShichenShort, '辰');
  assert.strictEqual(result.adjustedShichenShort, '卯');
  console.log(`   ➔ 跨時辰校正驗證成功: 原時辰 ${result.originalShichenShort}時 ➔ 校正後 ${result.adjustedShichenShort}時 (真太陽時 ${result.trueSolarTime})`);
});

// -------------------------------------------------------------
// 測試 5: 節氣交節天文時刻校正 (交節前後 2 小時內)
// -------------------------------------------------------------
runTest('測試 5: 節氣交節校正 (1990-02-04 10:15 台北，鄰近立春交節點)', () => {
  const result = server.calculateSolarTime('1990-02-04', '10:15', '台北');
  
  assert.ok(result.solarTerms.length > 0, '應偵測到立春節氣');
  const lichun = result.solarTerms.find(t => t.termName === '立春');
  assert.ok(lichun, '應正確匹配立春');
  assert.ok(Math.abs(lichun.solarDiffMinutes) <= 120, '真太陽時分差應在前後 120 分鐘 (2 小時) 內');
  console.log(`   ➔ 節氣交節精算驗證成功: 檢測到【${lichun.termName}】(天文交節: ${lichun.termLocalTime})，真太陽時相差 ${lichun.solarDiffMinutes} 分鐘`);
});

// -------------------------------------------------------------
// 測試 6: 經緯度自訂輸入解析
// -------------------------------------------------------------
runTest('測試 6: 經緯度座標輸入解析 (121.5, 25.0 與 100.5, 13.75)', () => {
  const res1 = server.parseLocationOrCoordinates('121.5, 25.0');
  assert.strictEqual(res1.lon, 121.5);
  assert.strictEqual(res1.lat, 25.0);
  assert.strictEqual(res1.tz, 8);
  assert.strictEqual(res1.centralMeridian, 120);

  const res2 = server.parseLocationOrCoordinates('100.5, 13.75');
  assert.strictEqual(res2.lon, 100.5);
  assert.strictEqual(res2.lat, 13.75);
  assert.strictEqual(res2.tz, 7);
  assert.strictEqual(res2.centralMeridian, 105);

  const res3 = server.parseLocationOrCoordinates('121.5');
  assert.strictEqual(res3.lon, 121.5);
  assert.strictEqual(res3.tz, 8);
  console.log(`   ➔ 座標解析驗證成功: 經緯度字串解析正確對應時區與中央經線`);
});

console.log('\n================================================================');
console.log(`🎯 測試結果統計: 共 ${passCount + failCount} 項測試，通過: ${passCount} 項，失敗: ${failCount} 項`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
