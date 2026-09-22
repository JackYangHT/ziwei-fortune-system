const fs = require('fs');
const path = require('path');
const vm = require('vm');

const iztroCode = fs.readFileSync(path.join(__dirname, '../webapp/iztro.min.js'), 'utf8');
const appCode = fs.readFileSync(path.join(__dirname, '../webapp/app.js'), 'utf8');

// 模擬 DOM 環境
class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.className = '';
    this.innerHTML = '';
    this.children = [];
    this.scrollTop = 0;
    this.scrollHeight = 100;
  }
  appendChild(el) {
    this.children.push(el);
  }
}

const mockContainer = new MockElement('div');

const sandbox = {
  window: {},
  console,
  setTimeout,
  clearTimeout,
  mockContainer,
  document: {
    getElementById: (id) => {
      if (id === 'chatMessagesContainer') return mockContainer;
      return new MockElement('div');
    },
    querySelectorAll: () => [],
    createElement: (tag) => new MockElement(tag),
    addEventListener: () => {}
  },
  localStorage: { getItem: () => null, setItem: () => {}, length: 0, key: () => null, removeItem: () => {} }
};
sandbox.self = sandbox.window;
sandbox.global = sandbox.window;

vm.createContext(sandbox);
vm.runInContext(iztroCode, sandbox);
vm.runInContext(appCode, sandbox);

const testRunner = `
(() => {
  const session = {
    sessionId: 'client-test-001',
    clientName: '測試客戶',
    birthday: '1990-03-15',
    calendarType: 'solar',
    birthTime: 7,
    gender: '男',
    targetYear: 2026,
    includeNatal: false,
    messages: []
  };
  state.currentSession = session;

  console.log('=== 測試 renderChatMessages 空值容錯渲染 ===\\n');

  // 測試情境 1: remedy 為 null (最常見的報錯情境)
  session.messages.push({
    sender: 'assistant',
    text: '普通回答，無改運',
    answerData: {
      plain: '今天運勢平穩，不需要特別調整磁場。',
      light: { type: 'green', text: '大吉' },
      stars: '★★★★★',
      calculation: '流日分析完成',
      remedy: null
    }
  });

  // 測試情境 2: remedy 為 undefined
  session.messages.push({
    sender: 'assistant',
    text: 'remedy 為 undefined',
    answerData: {
      plain: '這是一則缺少 remedy 欄位的訊息。',
      light: { type: 'yellow', text: '平吉' },
      stars: '★★★☆☆',
      calculation: '簡明數據'
    }
  });

  // 測試情境 3: light 為 null、calculation 為空字串
  session.messages.push({
    sender: 'assistant',
    text: 'light 為 null',
    answerData: {
      plain: '這是一則缺少 light 欄位的訊息。',
      light: null,
      stars: '★★★★☆',
      calculation: '',
      remedy: null
    }
  });

  // 測試情境 4: 完整包含 remedy 物件 (驗證正常有改運建議時仍正確渲染)
  session.messages.push({
    sender: 'assistant',
    text: '包含完整 remedy',
    answerData: {
      plain: '如果想調整近期的身心磁場...',
      light: { type: 'green', text: '身心調和' },
      stars: '★★★★★',
      calculation: '天紀身心調和依據',
      remedy: {
        aroma: '蒼朮白芷醒脾辟穢香',
        acupoint: '百會穴與足三里穴',
        demai: '坐西北乾位朝東南'
      }
    }
  });

  // 執行渲染！
  try {
    renderChatMessages();
    console.log('✅ renderChatMessages 執行成功！共渲染訊息數:', mockContainer.children.length);
    mockContainer.children.forEach((c, idx) => {
      console.log(\`  - 訊息 \${idx + 1} 渲染 HTML 長度: \${c.innerHTML.length} 字元\`);
    });
    console.log('\\n🎉 所有 4 種極端空值情況皆順利渲染，無任何 Uncaught TypeError！');
  } catch (err) {
    console.error('❌ renderChatMessages 渲染時拋出異常:', err);
    process.exit(1);
  }
})();
`;

vm.runInContext(testRunner, sandbox);
