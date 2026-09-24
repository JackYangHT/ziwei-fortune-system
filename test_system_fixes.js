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

// -----------------------------------------------------------------------------
// 問題一：諮詢卡片標題 getChatPlainTitle 與去「白話版」驗證
// -----------------------------------------------------------------------------
console.log('\n--- 測試 6: 諮詢卡片標題 getChatPlainTitle 與嚴禁「白話版」 ---');

check('getChatPlainTitle 嚴格對應五大語言，且泰文為 💬【คำแนะนำจากพี่ Jack】', () => {
  assert.strictEqual(app.getChatPlainTitle('th'), '💬【คำแนะนำจากพี่ Jack】', '泰文標題必須為 💬【คำแนะนำจากพี่ Jack】');
  assert.strictEqual(app.getChatPlainTitle('zh'), '💬【Jack 老師解答】', '中文標題必須為 💬【Jack 老師解答】');
  assert.strictEqual(app.getChatPlainTitle('en'), '💬【Advice from Jack】', '英文標題必須為 💬【Advice from Jack】');
  assert.strictEqual(app.getChatPlainTitle('ja'), '💬【Jack 先生のアドバイス】', '日文標題必須為 💬【Jack 先生のアドバイス】');
  assert.strictEqual(app.getChatPlainTitle('ko'), '💬【Jack 선생님의 조언】', '韓文標題必須為 💬【Jack 선생님의 조언】');
});

// -----------------------------------------------------------------------------
// 問題二 & 問題三：泰文所有欄位標題、幽默文案與中泰混排規範
// -----------------------------------------------------------------------------
console.log('\n--- 測試 7: 泰文欄位標題純泰文規範與術語保留中文加註 ---');

check('泰文回答欄位標題純泰化【สัญญาณไฟ】【คะแนนดาว】【การคำนวณเต็มรูปแบบ】【ข้อเสนอแนะความแม่นยำ】', () => {
  const session = {
    sessionId: 'test-session-th',
    clientName: 'สมชาย',
    birthday: '1990-05-15',
    currentLang: 'th',
    messages: []
  };

  const todayThaiAns = app.generateNaturalAnswerFallback('ดวงรายวันวันนี้เป็นอย่างไร', session, 'th');

  assert.strictEqual(todayThaiAns.lang, 'th');
  assert.strictEqual(todayThaiAns.light.type, 'green');
  assert.strictEqual(todayThaiAns.light.text, 'ดวงเฮง (โชคลาภมาแรง)');
  assert.strictEqual(todayThaiAns.stars, '★★★★☆');

  // 驗證幽默文案三段式
  assert.ok(todayThaiAns.plain.startsWith('พี่บอกเลย ดูดวงแล้ววันนี้ดวงเธอปัง!'), '泰文開頭必須為「พี่บอกเลย ดูดวงแล้ว...」');
  assert.ok(todayThaiAns.plain.includes('อย่ารอช้า รีบไปเสี่ยงโชคก่อนหวยหมด!'), '泰文中間必須包含「อย่ารอช้า」「รีบไป...」');
  assert.ok(todayThaiAns.plain.includes('ซื้อสนุกๆ พอ'), '泰文結尾必須包含「ซื้อสนุกๆ พอ」');

  // 驗證完整推算標題
  assert.ok(todayThaiAns.calculation.includes('<strong>【การคำนวณเต็มรูปแบบ】：</strong>'), '推算標題必須為【การคำนวณเต็มรูปแบบ】');

  // 驗證除命理術語加註外，無多餘中文
  assert.ok(todayThaiAns.calculation.includes('『火貪格 (ฮั่วทานเก๋อ)』'), '命理術語火貪格保留中文並加註泰文解釋');
  assert.ok(todayThaiAns.calculation.includes('『祿存 (ลู่ฉุน)』'), '命理術語祿存保留中文並加註泰文解釋');
});

// -----------------------------------------------------------------------------
// 測試一 & 測試二：實際提問端到端卡片渲染驗證
// -----------------------------------------------------------------------------
console.log('\n--- 測試 8: 兩大指定測試提問完整對話卡片 DOM 渲染驗證 ---');

check('測試一：泰文提問「ดวงรายวันวันนี้เป็นอย่างไร」卡片 DOM 標題與欄位純泰化且無「白話版」', () => {
  const mockContainer = {
    children: [],
    innerHTML: '',
    appendChild(el) { this.children.push(el); },
    scrollTop: 0,
    scrollHeight: 100
  };

  global.document = {
    getElementById(id) {
      if (id === 'chatMessagesContainer') return mockContainer;
      return null;
    },
    createElement(tag) {
      return {
        tagName: tag,
        className: '',
        innerHTML: '',
        querySelector() { return null; }
      };
    }
  };

  const origSession = app.state.currentSession;
  try {
    const session = {
      sessionId: 'test-th-render',
      clientName: 'ทดสอบ',
      birthday: '1990-01-01',
      messages: []
    };
    app.state.currentSession = session;

    const ans = app.generateNaturalAnswerFallback('ดวงรายวันวันนี้เป็นอย่างไร', session, 'th');
    session.messages.push({
      id: 'msg-th-1',
      sender: 'assistant',
      timestamp: '12:00',
      text: ans.plain,
      answerData: ans,
      isNew: false
    });

    app.renderChatMessages();

    assert.strictEqual(mockContainer.children.length, 1);
    const cardHtml = mockContainer.children[0].innerHTML;

    // 1. 標題驗證：💬【คำแนะนำจากพี่ Jack】
    assert.ok(cardHtml.includes('💬【คำแนะนำจากพี่ Jack】'), '卡片標題必須是「💬【คำแนะนำจากพี่ Jack】」');
    assert.ok(!cardHtml.includes('白話版'), '卡片中絕對嚴禁出現「白話版」');

    // 2. 所有欄位標題純泰化
    assert.ok(cardHtml.includes('【สัญญาณไฟ】：'), '燈號標題必須純泰化為【สัญญาณไฟ】：');
    assert.ok(cardHtml.includes('【คะแนนดาว】：'), '星級標題必須純泰化為【คะแนนดาว】：');
    assert.ok(cardHtml.includes('📊【การคำนวณเต็มรูปแบบ】'), '完整推算標題必須純泰化為📊【การคำนวณเต็มรูปแบบ】');
    assert.ok(cardHtml.includes('【ข้อเสนอแนะความแม่นยำ】：'), '準確度回饋標題必須純泰化為【ข้อเสนอแนะความแม่นยำ】：');

    // 3. 作者標題純泰化
    assert.ok(cardHtml.includes('พี่ Jack (เข็มทิศดวงชะตา GPS)'), '作者名稱必須為「พี่ Jack (เข็มทิศดวงชะตา GPS)」');

    // 4. 幽默文案出現
    assert.ok(cardHtml.includes('พี่บอกเลย ดูดวงแล้ววันนี้ดวงเธอปัง!'), '卡片內文必須包含泰文幽默開頭');
  } finally {
    app.state.currentSession = origSession;
    delete global.document;
  }
});

check('測試二：中文提問「我今年偏財如何」卡片 DOM 標題為💬【Jack 老師解答】且具幽默感', () => {
  const mockContainer = {
    children: [],
    innerHTML: '',
    appendChild(el) { this.children.push(el); },
    scrollTop: 0,
    scrollHeight: 100
  };

  global.document = {
    getElementById(id) {
      if (id === 'chatMessagesContainer') return mockContainer;
      return null;
    },
    createElement(tag) {
      return {
        tagName: tag,
        className: '',
        innerHTML: '',
        querySelector() { return null; }
      };
    }
  };

  const origSession = app.state.currentSession;
  try {
    const session = {
      sessionId: 'test-zh-render',
      clientName: '王小明',
      birthday: '1990-01-01',
      messages: []
    };
    app.state.currentSession = session;

    const ans = app.generateNaturalAnswerFallback('我今年偏財如何', session, 'zh');
    session.messages.push({
      id: 'msg-zh-1',
      sender: 'assistant',
      timestamp: '12:00',
      text: ans.plain,
      answerData: ans,
      isNew: false
    });

    app.renderChatMessages();

    assert.strictEqual(mockContainer.children.length, 1);
    const cardHtml = mockContainer.children[0].innerHTML;

    // 1. 標題驗證：💬【Jack 老師解答】
    assert.ok(cardHtml.includes('💬【Jack 老師解答】'), '中文卡片標題必須是「💬【Jack 老師解答】」');
    assert.ok(!cardHtml.includes('白話版'), '卡片中絕對嚴禁出現「白話版」');

    // 2. 中文欄位標題
    assert.ok(cardHtml.includes('【燈號】：'), '中文燈號標題為【燈號】：');
    assert.ok(cardHtml.includes('【星級】：'), '中文星級標題為【星級】：');
    assert.ok(cardHtml.includes('📊【完整推算】'), '中文推算標題為📊【完整推算】');
    assert.ok(cardHtml.includes('【建議準確度回饋】：'), '中文回饋標題為【建議準確度回饋】：');

    // 3. 幽默文案出現
    assert.ok(cardHtml.includes('算到我都快白頭髮了'), '中文內文必須包含幽默自嘲「算到我都快白頭髮了」');
    assert.ok(cardHtml.includes('別衝動梭哈'), '中文內文必須包含生活化口語「別衝動梭哈」');
  } finally {
    app.state.currentSession = origSession;
    delete global.document;
  }
});

console.log('\n======================================================');
console.log(`🎉 系統問題與響應式測試結果: ${passCount} / ${totalCount} 項全部通過！`);
console.log('======================================================\n');

