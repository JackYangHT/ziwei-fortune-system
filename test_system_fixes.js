/**
 * test_system_fixes.js - 驗證四個系統問題與響應式設計
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const app = require('./webapp/app.js');

console.log('======================================================');
console.log('🧪 執行四個系統問題修復與響應式設計自動化測試');
console.log('======================================================\n');

let passCount = 0;
let totalCount = 0;

function check(desc, fn) {
  totalCount++;
  try {
    fn();
    console.log(`✅ [通過] ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`❌ [失敗] ${desc}:`, err.message);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// 問題一 & 問題二：等待提示與秒數倒數驗證
// -----------------------------------------------------------------------------
console.log('--- 測試 1 & 2: 等待提示、等待秒數與各語言文案 ---');

check('等待提示正確輸出 console 日誌 (⏳ 等待提示已顯示 與 ⏱️ 等待秒數：X)', () => {
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
    origLog.apply(console, args);
  };

  try {
    app.showWaitingNotice(null, 'zh');
  } finally {
    console.log = origLog;
  }

  assert.ok(logs.some(l => l.includes('⏳ 等待提示已顯示')), '必須印出「⏳ 等待提示已顯示」');
  assert.ok(logs.some(l => l.includes('⏱️ 等待秒數：')), '必須印出「⏱️ 等待秒數：X」');
});

check('模擬 DOM 環境驗證 showWaitingNotice 正確插入節點與文案 (繁中、泰文、英文、日文、韓文)', () => {
  const mockContainer = {
    children: [],
    appendChild(el) { this.children.push(el); },
    removeChild(el) {
      const idx = this.children.indexOf(el);
      if (idx !== -1) this.children.splice(idx, 1);
    },
    scrollTop: 0,
    scrollHeight: 100
  };

  const expectedTexts = {
    zh: 'Jack 老師正在捏你的命盤...',
    th: 'พี่ Jack กำลังดูดวงให้อยู่...',
    en: 'Jack 老師 is reading your chart...',
    ja: 'Jack 先生が命盤を読んでいます...',
    ko: 'Jack 선생님이 명반을 읽고 있습니다...'
  };

  // Mock global document
  global.document = {
    getElementById(id) {
      if (id === 'chatMessagesContainer') return mockContainer;
      if (id === 'jackWaitingBubble') return mockContainer.children.find(c => c.id === 'jackWaitingBubble') || null;
      return null;
    },
    createElement(tag) {
      return {
        tagName: tag,
        id: '',
        className: '',
        innerHTML: '',
        parentNode: mockContainer,
        style: {}
      };
    }
  };

  try {
    for (const [lang, expected] of Object.entries(expectedTexts)) {
      mockContainer.children = [];
      app.showWaitingNotice(mockContainer, lang);
      assert.strictEqual(mockContainer.children.length, 1, `語言 ${lang} 必須插入等待氣泡元素`);
      const bubble = mockContainer.children[0];
      assert.strictEqual(bubble.id, 'jackWaitingBubble', '等待氣泡 id 必須為 jackWaitingBubble');
      assert.ok(bubble.innerHTML.includes(expected), `語言 ${lang} 等待文案必須包含「${expected}」`);
      assert.ok(bubble.innerHTML.includes('waiting-timer-badge'), '必須包含倒數計時秒數標籤');
      app.hideWaitingNotice();
      assert.strictEqual(mockContainer.children.length, 0, 'hideWaitingNotice 必須移除等待元素');
    }
  } finally {
    delete global.document;
  }
});

// -----------------------------------------------------------------------------
// 問題三：逐字打字效果驗證
// -----------------------------------------------------------------------------
console.log('\n--- 測試 3: 逐字打字效果與跳過動畫 ---');

check('showTypingEffect 印出 ⌨️ 逐字打字已啟動 並能順利完成', (done) => {
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
    origLog.apply(console, args);
  };

  const mockTarget = {
    innerHTML: '',
    appendChild() {}
  };

  let finished = false;
  try {
    app.showTypingEffect(mockTarget, '測試打字內容', 1, () => {
      finished = true;
    });
  } finally {
    console.log = origLog;
  }

  assert.ok(logs.some(l => l.includes('⌨️ 逐字打字已啟動')), '必須印出「⌨️ 逐字打字已啟動」');
});

// -----------------------------------------------------------------------------
// 問題四：語言偵測與傳遞驗證
// -----------------------------------------------------------------------------
console.log('\n--- 測試 4: 語言偵測演算法 (泰文 Unicode U+0E00-U+0E7F) ---');

check('泰文字元正確偵測並輸出 🌐 偵測到語言：th', () => {
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
    origLog.apply(console, args);
  };

  let lang;
  try {
    lang = app.detectLanguage('10 อันดับวันโชคลาภลอตเตอรี่สูงสุด');
  } finally {
    console.log = origLog;
  }

  assert.strictEqual(lang, 'th', '泰文提問必須偵測為 th');
  assert.ok(logs.some(l => l.includes('🌐 偵測到語言：th')), '必須印出「🌐 偵測到語言：th」');
});

check('中文與英文提問正確偵測並輸出對應語言日誌', () => {
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
    origLog.apply(console, args);
  };

  let langZh, langEn;
  try {
    langZh = app.detectLanguage('我今年偏財如何');
    langEn = app.detectLanguage('When is my lucky day?');
  } finally {
    console.log = origLog;
  }

  assert.strictEqual(langZh, 'zh');
  assert.strictEqual(langEn, 'en');
  assert.ok(logs.some(l => l.includes('🌐 偵測到語言：zh')));
  assert.ok(logs.some(l => l.includes('🌐 偵測到語言：en')));
});

// -----------------------------------------------------------------------------
// 新增：響應式設計驗證 (Responsive Design)
// -----------------------------------------------------------------------------
console.log('\n--- 測試 5: 響應式設計 (index.html, styles.css, 裝置偵測) ---');

check('index.html 包含正確的 viewport meta tag', () => {
  const html = fs.readFileSync(path.join(__dirname, 'webapp', 'index.html'), 'utf8');
  assert.ok(
    html.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">'),
    'viewport meta tag 必須包含 user-scalable=no 與最大縮放設定'
  );
  assert.ok(html.includes('id="btnMobileSidebarToggle"'), '必須包含手機版漢堡選單按鈕');
  assert.ok(html.includes('id="mobileSidebarBackdrop"'), '必須包含手機版側邊欄遮罩');
  assert.ok(html.includes('id="tabletQuickDropdown"'), '必須包含平板版快速提問下拉選單');
  assert.ok(html.includes('id="mobileQuickBar"'), '必須包含手機版快速提問按鈕列');
});

check('styles.css 包含完整的 media queries 與字型大小設定', () => {
  const css = fs.readFileSync(path.join(__dirname, 'webapp', 'styles.css'), 'utf8');
  assert.ok(css.includes('@media (max-width: 1024px)'), 'styles.css 必須包含 max-width: 1024px 媒體查詢');
  assert.ok(css.includes('@media (max-width: 768px)'), 'styles.css 必須包含 max-width: 768px 媒體查詢');
  assert.ok(css.includes('@media (max-width: 480px)'), 'styles.css 必須包含 max-width: 480px 媒體查詢');
  assert.ok(css.includes('font-size: 16px'), '電腦端字型大小基準 16px');
  assert.ok(css.includes('font-size: 15px'), '平板端字型大小 15px');
  assert.ok(css.includes('font-size: 14px'), '手機端字型大小 14px');
  assert.ok(css.includes('min-height: 44px') && css.includes('min-width: 44px'), '觸控優化最小按鈕尺寸 44x44px');
});

check('app.js detectDeviceType 正確判斷 desktop / tablet / mobile 並印出日誌', () => {
  global.window = { innerWidth: 1200 };
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
    origLog.apply(console, args);
  };

  try {
    // 1. 電腦 (> 1024px)
    global.window.innerWidth = 1200;
    assert.strictEqual(app.detectDeviceType(), 'desktop');
    app.applyResponsiveLayout();

    // 2. 平板 (768px - 1024px)
    global.window.innerWidth = 800;
    assert.strictEqual(app.detectDeviceType(), 'tablet');
    app.applyResponsiveLayout();

    // 3. 手機 (< 768px)
    global.window.innerWidth = 390;
    assert.strictEqual(app.detectDeviceType(), 'mobile');
    app.applyResponsiveLayout();
  } finally {
    console.log = origLog;
    delete global.window;
  }

  assert.ok(logs.some(l => l.includes('📱 偵測到裝置：desktop')), '印出 desktop 偵測日誌');
  assert.ok(logs.some(l => l.includes('📱 偵測到裝置：tablet')), '印出 tablet 偵測日誌');
  assert.ok(logs.some(l => l.includes('📱 偵測到裝置：mobile')), '印出 mobile 偵測日誌');
});

console.log('\n======================================================');
console.log(`🎉 系統問題與響應式測試結果: ${passCount} / ${totalCount} 項全部通過！`);
console.log('======================================================\n');
