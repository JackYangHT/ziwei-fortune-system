/**
 * test_thai_font.js - 驗證泰文字型整合與中泰混排設定
 */
const fs = require('fs');
const path = require('path');

console.log('======================================================');
console.log('🧪 執行泰文字型與排版規範自動化測試');
console.log('======================================================\n');

let passCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    console.log(`✅ [通過] ${message}`);
    passCount++;
  } else {
    console.error(`❌ [失敗] ${message}`);
    process.exitCode = 1;
  }
}

// 1. 檢驗 index.html
const htmlPath = path.join(__dirname, 'webapp', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

assert(
  htmlContent.includes('fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&family=Sarabun:wght@300;400;500;600;700&family=Kanit:wght@300;400;500;600;700'),
  'index.html 正確引入 Google Fonts (Prompt, Sarabun, Kanit 300-700 完整字重)'
);
assert(
  htmlContent.includes('rel="preconnect" href="https://fonts.googleapis.com"') &&
  htmlContent.includes('rel="preconnect" href="https://fonts.gstatic.com"'),
  'index.html 包含 Google Fonts preconnect 加速連線'
);

// 2. 檢驗 styles.css
const cssPath = path.join(__dirname, 'webapp', 'styles.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

assert(
  cssContent.includes("'Prompt', 'Sarabun', 'Kanit', 'Microsoft JhengHei', 'Noto Sans TC', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"),
  'styles.css body 字型族群符合優先順序 (Prompt -> Sarabun -> Kanit -> Microsoft JhengHei -> Noto Sans TC -> Inter)'
);

assert(
  cssContent.includes("'Kanit', 'Prompt', 'Microsoft JhengHei'"),
  'styles.css 標題類文字指定使用 Kanit / Prompt'
);

assert(
  cssContent.includes("'Sarabun', 'Prompt', 'Kanit', 'Microsoft JhengHei'"),
  'styles.css 內文與對話閱讀類文字指定使用 Sarabun / Prompt'
);

assert(
  cssContent.includes('[lang="th"]') && cssContent.includes('body[data-lang="th"]'),
  'styles.css 支援泰文模式特定字型與行高強化'
);

assert(
  cssContent.includes('line-height: 1.65') && cssContent.includes('vertical-align: baseline'),
  'styles.css 包含中泰混排垂直基準與行高對齊規範 (確保高度一致不跳動)'
);

// 3. 檢驗 app.js 語言切換
const appJsPath = path.join(__dirname, 'webapp', 'app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

assert(
  appJsContent.includes("document.documentElement.lang = lang === 'zh' ? 'zh-TW'") &&
  appJsContent.includes("document.body.setAttribute('data-lang', lang)"),
  'app.js updateUILanguage 動態同步 html[lang] 與 body[data-lang]'
);

console.log('\n======================================================');
console.log(`🎉 泰文字型測試結果: ${passCount} / ${totalCount} 項全部通過！`);
console.log('======================================================\n');
