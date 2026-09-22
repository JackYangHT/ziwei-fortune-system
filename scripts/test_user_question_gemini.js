const fs = require('fs');
const path = require('path');
const vm = require('vm');

const iztroCode = fs.readFileSync(path.join(__dirname, '../webapp/iztro.min.js'), 'utf8');
const appCode = fs.readFileSync(path.join(__dirname, '../webapp/app.js'), 'utf8');

const sandbox = {
  window: {},
  console,
  fetch: typeof fetch !== 'undefined' ? fetch : undefined,
  require,
  process,
  setTimeout,
  clearTimeout,
  URL,
  localStorage: { getItem: () => null, setItem: () => {}, length: 0, key: () => null, removeItem: () => {} },
  document: { getElementById: () => null, querySelectorAll: () => [], addEventListener: () => {} }
};
sandbox.self = sandbox.window;
sandbox.global = sandbox.window;

vm.createContext(sandbox);
vm.runInContext(iztroCode, sandbox);
vm.runInContext(appCode, sandbox);

const testRunner = `
(async () => {
  console.log('=====================================================');
  console.log('開始測試：驗證 Gemini API 調用與「我明年适合创业吗？」提問');
  console.log('=====================================================\\n');

  const session = {
    sessionId: 'client-20260922-001',
    clientName: '創業諮詢者',
    birthday: '1992-08-18',
    calendarType: 'solar',
    birthTime: 7,
    gender: '男',
    targetYear: 2026,
    includeNatal: false,
    messages: []
  };
  state.currentSession = session;
  calculateClientAstrolabe(session);

  const question = '我明年适合创业吗？';
  console.log('[提問測試] 使用者輸入：「' + question + '」\\n');

  try {
    const answer = await generateFortuneAnswer(question, 'zh');
    console.log('\\n=====================================================');
    console.log('🎉 命理諮詢回答生成完畢：');
    console.log('=====================================================');
    console.log('✅ 是否來自真實 Gemini LLM (isFromRealLLM):', answer.isFromRealLLM);
    console.log('🚦 燈號 (Light):', JSON.stringify(answer.light));
    console.log('⭐ 星級 (Stars):', answer.stars);
    console.log('💬 白話建議 (Plain):\\n', answer.plain);
    if (answer.calculation) {
      console.log('📊 完整推算 (Calculation):\\n', answer.calculation);
    }
    if (answer.remedy) {
      console.log('🌿 倪師改運 (Remedy):', answer.remedy);
    }

    if (answer.isFromRealLLM) {
      console.log('\\n✅ 測試通過！回答成功由 Google Gemini 雲端 LLM 即時生成！');
    } else {
      console.error('\\n❌ 測試失敗：回答來自本地備用引擎，未成功調用真實 LLM！');
      process.exit(1);
    }
  } catch (err) {
    console.error('執行過程發生未捕獲錯誤:', err);
    process.exit(1);
  }
})();
`;

vm.runInContext(testRunner, sandbox);
