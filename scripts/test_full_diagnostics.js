const fs = require('fs');
const path = require('path');
const vm = require('vm');

const iztroCode = fs.readFileSync(path.join(__dirname, '../webapp/iztro.min.js'), 'utf8');
const appCode = fs.readFileSync(path.join(__dirname, '../webapp/app.js'), 'utf8');

const logs = [];
const mockConsole = {
  log: (...args) => { console.log(...args); logs.push(args.join(' ')); },
  warn: (...args) => { console.warn(...args); logs.push('[WARN] ' + args.join(' ')); },
  error: (...args) => { console.error(...args); logs.push('[ERROR] ' + args.join(' ')); },
  info: (...args) => { console.info(...args); logs.push('[INFO] ' + args.join(' ')); },
  group: (...args) => { console.log(...args); logs.push('[GROUP] ' + args.join(' ')); },
  groupEnd: () => { logs.push('[GROUP_END]'); },
  table: (...args) => { console.table(...args); }
};

const domStore = {};
function createMockElement(id) {
  return {
    id,
    style: {},
    innerHTML: '',
    value: '',
    scrollHeight: 100,
    scrollTop: 0,
    children: [],
    appendChild: function(c) { this.children.push(c); },
    addEventListener: () => {},
    setAttribute: () => {},
    getAttribute: () => 'app.js'
  };
}

const sandbox = {
  window: {},
  console: mockConsole,
  fetch: typeof fetch !== 'undefined' ? fetch : undefined,
  require,
  process,
  setTimeout: (fn) => fn(),
  clearTimeout: () => {},
  URL,
  localStorage: { getItem: () => null, setItem: () => {}, length: 0, key: () => null, removeItem: () => {} },
  document: {
    getElementById: (id) => {
      if (!domStore[id]) domStore[id] = createMockElement(id);
      return domStore[id];
    },
    querySelectorAll: (sel) => {
      if (sel === 'script') {
        return [{ src: 'app.js', getAttribute: () => 'app.js' }];
      }
      return [];
    },
    createElement: (tag) => createMockElement(tag),
    addEventListener: () => {}
  }
};
sandbox.self = sandbox.window;
sandbox.global = sandbox.window;

vm.createContext(sandbox);
vm.runInContext(iztroCode, sandbox);
vm.runInContext(appCode, sandbox);

const runnerScript = `
(async () => {
  console.log('\\n=====================================================');
  console.log('🔬 開始執行全方位系統診斷與真實 LLM 提問驗證');
  console.log('=====================================================\\n');

  // 1. 檢查 GEMINI_API_KEY 常數
  console.log('診斷 1: window.GEMINI_API_KEY =', window.GEMINI_API_KEY ? window.GEMINI_API_KEY.slice(0, 10) + '...' : 'undefined');
  if (!window.GEMINI_API_KEY || !window.GEMINI_API_KEY.startsWith('AQ.')) {
    throw new Error('window.GEMINI_API_KEY 未正確載入！');
  }

  // 2. 建立 Session
  const session = {
    sessionId: 'client-diagnostics-001',
    clientName: '診斷諮詢者',
    birthday: '1992-08-18',
    calendarType: 'solar',
    birthTime: 7,
    gender: '男',
    targetYear: 2026,
    includeNatal: false,
    messages: []
  };
  state.currentSession = session;
  state.sessions = [session];
  calculateClientAstrolabe(session);

  // 3. 測試 handleUserSend 調用
  const question = '我明年适合创业吗？';
  console.log('\\n👉 模擬使用者於介面輸入並送出: "' + question + '"');
  await handleUserSend(question);

  const lastMsg = session.messages[session.messages.length - 1];
  console.log('\\n=====================================================');
  console.log('🎉 handleUserSend 執行完畢，最後一則回覆訊息：');
  console.log('=====================================================');
  console.log('發送者:', lastMsg.sender);
  console.log('白話回答:', lastMsg.text);
  console.log('是否為真實 LLM 生成:', lastMsg.answerData ? lastMsg.answerData.isFromRealLLM : false);
  console.log('燈號評語:', lastMsg.answerData ? JSON.stringify(lastMsg.answerData.light) : '');
  console.log('星級評等:', lastMsg.answerData ? lastMsg.answerData.stars : '');
  console.log('改運建議 (未問改運應為 null):', lastMsg.answerData ? lastMsg.answerData.remedy : null);

  if (lastMsg.answerData && lastMsg.answerData.isFromRealLLM) {
    console.log('\\n✅ [驗證全部通過]：GEMINI_API_KEY 已載入、handleUserSend 成功觸發 askGemini / callGeminiLLM、真實雲端生成完成！');
  } else {
    console.error('\\n❌ [驗證失敗]：未由真實 LLM 成功生成！');
    process.exit(1);
  }
})();
`;

vm.runInContext(runnerScript, sandbox);
