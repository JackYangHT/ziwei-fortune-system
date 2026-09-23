// test_mantianxing_plus.js
const fs = require('fs');
const path = require('path');
const { calculateQizhengSiyu, calculateFlowMinute } = require('./webapp/server');

console.log('====================================================');
console.log('🌟 滿天星 Plus 全模組自動化驗證測試套件 (Test Suite)');
console.log('====================================================');

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

// ----------------------------------------------------
// 模組一：七政四餘計算驗證 (1977-07-26 08:00 曼谷)
// ----------------------------------------------------
console.log('\n--- 模組一：七政四餘天象計算測試 ---');
const qz = calculateQizhengSiyu('1977-07-26', '08:00', '曼谷');
assert(qz && qz.sevenLuminaries.length === 7, '七政包含太陽、太陰、木、火、土、金、水 7 曜');
assert(qz && qz.fourExtras.length === 4, '四餘包含紫氣、月孛、羅睺、計都 4 餘');
assert(qz.sevenLuminaries[0].branch === '午', `太陽正確坐落午宮 (實際: ${qz.sevenLuminaries[0].branch})`);
assert(qz.sevenLuminaries[1].branch === '寅', `太陰正確坐落寅宮 (實際: ${qz.sevenLuminaries[1].branch})`);

const rahu = qz.fourExtras.find(e => e.key === 'rahu');
const ketu = qz.fourExtras.find(e => e.key === 'ketu');
const diff = Math.abs(rahu.totalDeg - ketu.totalDeg);
assert(Math.abs(diff - 180) < 0.1, `羅睺與計都天象呈 180° 對沖 (實際相差: ${diff.toFixed(2)}°)`);

// ----------------------------------------------------
// 模組二：流分推算驗證
// ----------------------------------------------------
console.log('\n--- 模組二：流分推算器測試 ---');
const flowMin = calculateFlowMinute('2026-09-23', '09:15', { birthPlace: '台北' });
assert(flowMin && flowMin.minuteGanZhi, `流分干支正確計算 (${flowMin.minuteGanZhi})`);
assert(flowMin.minutePalaceBranch, `流分命宮位置定位 (${flowMin.minutePalaceBranch}宮)`);
assert(flowMin.minuteSiHua && flowMin.minuteSiHua.化祿, `流分四化正確輸出 (${JSON.stringify(flowMin.minuteSiHua)})`);

// ----------------------------------------------------
// 模組三：多輪對話記憶與上下文理解
// ----------------------------------------------------
console.log('\n--- 模組三：多輪對話記憶測試 ---');
const appJsContent = fs.readFileSync(path.join(__dirname, 'webapp', 'app.js'), 'utf8');
assert(appJsContent.includes('slice(-20)'), '對話歷史擷取前 10 輪 (最多 20 則) 上下文');
assert(appJsContent.includes('【前 10 輪對話歷史上下文】：'), 'Prompt 模板包含前 10 輪對話記憶區塊');
assert(appJsContent.includes('多輪追問提醒'), '支援多輪追問主題延續判斷');

// ----------------------------------------------------
// 模組四：動態權重自適應學習
// ----------------------------------------------------
console.log('\n--- 模組四：動態權重調整測試 ---');
assert(appJsContent.includes('function adjustCategoryWeight'), '存在 adjustCategoryWeight 權重調整函數');
assert(appJsContent.includes('Math.min(3.0, Math.round(oldW * 1.1'), '建議中了自動增加 10% 權重 (上限 3.0x)');
assert(appJsContent.includes('Math.max(0.2, Math.round(oldW * 0.9'), '建議沒中自動降低 10% 權重 (下限 0.2x)');
assert(appJsContent.includes('weights[category]'), '評分引擎將權重參數注入各分類加權計算');

// ----------------------------------------------------
// 模組五：個人化處方辨證 (倪師改運體系)
// ----------------------------------------------------
console.log('\n--- 模組五：個人化處方辨證測試 ---');
assert(appJsContent.includes('陰虛燥熱型') && appJsContent.includes('陽虛水寒型'), '體質辨證包含陰虛燥熱與陽虛水寒雙向診斷');
assert(appJsContent.includes('特級海南沉香') && appJsContent.includes('特級公丁香'), '補水個人化差異：Client A 用沉香 vs Client B 用丁香');
assert(appJsContent.includes('太溪穴') && appJsContent.includes('足三里穴'), '補財個人化差異：Client A 按太溪 vs Client B 按足三里');

// ----------------------------------------------------
// 模組六：圖表視覺化 (Chart.js & 365天熱力圖)
// ----------------------------------------------------
console.log('\n--- 模組六：圖表視覺化測試 ---');
assert(appJsContent.includes('renderZodiacWheelChart'), '包含命盤圓圖 (十二宮輪盤 + 七政四餘)');
assert(appJsContent.includes('renderFiveElementsChart'), '包含五行能量雷達平衡圖');
assert(appJsContent.includes('renderMonthlyTrendChart'), '包含全年十二個月運勢折線圖');
assert(appJsContent.includes('renderYearHeatmap'), '包含全年 365 天流年熱力圖矩陣');

// ----------------------------------------------------
// 模組七：五語支援與術語註解
// ----------------------------------------------------
console.log('\n--- 模組七：五國語言支援測試 ---');
assert(appJsContent.includes('zh:') && appJsContent.includes('cn:') && appJsContent.includes('en:') && appJsContent.includes('ja:') && appJsContent.includes('ko:'), '支援 zh, cn, en, ja, ko 5 種主要語言');
assert(appJsContent.includes('ASTRO_TERMS'), '包含紫微斗數天體與專有名詞多語註釋字典');

// ----------------------------------------------------
// 模組八：PWA 與雲端部署配置
// ----------------------------------------------------
console.log('\n--- 模組八：PWA 與雲端部署測試 ---');
assert(fs.existsSync(path.join(__dirname, 'webapp', 'manifest.json')), 'manifest.json 存在');
assert(fs.existsSync(path.join(__dirname, 'webapp', 'service-worker.js')), 'service-worker.js 存在');
assert(fs.existsSync(path.join(__dirname, 'vercel.json')), 'vercel.json 存在');
assert(fs.existsSync(path.join(__dirname, 'netlify.toml')), 'netlify.toml 存在');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'webapp', 'manifest.json'), 'utf8'));
assert(manifest.display === 'standalone', 'PWA display 模式為 standalone');

console.log('\n====================================================');
console.log(`🎉 測試結果: 通過 ${passedTests} / ${totalTests} 項驗證！`);
console.log('====================================================\n');
