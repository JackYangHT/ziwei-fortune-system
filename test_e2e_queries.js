/**
 * test_e2e_queries.js - 端到端模擬提問流程
 */
const assert = require('assert');
const app = require('./webapp/app.js');

console.log('======================================================');
console.log('🧪 端到端提問流程驗證 (泰文與中文提問)');
console.log('======================================================\n');

const session = {
  sessionId: 'test-session-e2e',
  clientName: 'Jack 測試用戶',
  birthday: '1990-03-15',
  birthTime: 7,
  gender: 'M',
  targetYear: 2026,
  messages: []
};

app.state.currentSession = session;
app.calculateClientAstrolabe(session);

// 1. 泰文提問測試：「10 อันดับวันโชคลาภลอตเตอรี่สูงสุด」
console.log('--- 測試 1: 泰文提問 「10 อันดับวันโชคลาภลอตเตอรี่สูงสุด」 ---');
{
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
    origLog.apply(console, args);
  };

  const q = '10 อันดับวันโชคลาภลอตเตอรี่สูงสุด';
  const lang = app.detectLanguage(q);
  app.showWaitingNotice(null, lang);

  const intent = app.parseIntent(q, session, lang);
  const data = app.fetchAstrologyData(intent, session);
  const res = app.generateNaturalAnswerFallback(intent, data, q, session, lang);

  // 模擬打字
  const mockEl = { innerHTML: '', appendChild() {} };
  app.showTypingEffect(mockEl, res.plain, 1);

  console.log = origLog;

  assert.strictEqual(lang, 'th', '語言必須為泰文');
  assert.ok(logs.some(l => l.includes('🌐 偵測到語言：th')), '必須印出「🌐 偵測到語言：th」');
  assert.ok(logs.some(l => l.includes('⏳ 等待提示已顯示')), '必須印出「⏳ 等待提示已顯示」');
  assert.ok(logs.some(l => l.includes('⏱️ 等待秒數：')), '必須印出「⏱️ 等待秒數：X」');
  assert.ok(logs.some(l => l.includes('⌨️ 逐字打字已啟動')), '必須印出「⌨️ 逐字打字已啟動」');
  assert.ok(res.plain.includes('พี่บอกเลย') || res.plain.includes('ลอตเตอรี่'), '回答必須為泰文');
  console.log('✅ 泰文提問端到端流程驗證成功！');
}

// 2. 中文提問測試：「我今年偏財如何」
console.log('\n--- 測試 2: 中文提問 「我今年偏財如何」 ---');
{
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
    origLog.apply(console, args);
  };

  const q = '我今年偏財如何';
  const lang = app.detectLanguage(q);
  app.showWaitingNotice(null, lang);

  const intent = app.parseIntent(q, session, lang);
  const data = app.fetchAstrologyData(intent, session);
  const res = app.generateNaturalAnswerFallback(intent, data, q, session, lang);

  const mockEl = { innerHTML: '', appendChild() {} };
  app.showTypingEffect(mockEl, res.plain, 1);

  console.log = origLog;

  assert.strictEqual(lang, 'zh', '語言必須為繁中');
  assert.ok(logs.some(l => l.includes('🌐 偵測到語言：zh')), '必須印出「🌐 偵測到語言：zh」');
  assert.ok(logs.some(l => l.includes('⏳ 等待提示已顯示')), '必須印出「⏳ 等待提示已顯示」');
  assert.ok(logs.some(l => l.includes('⏱️ 等待秒數：')), '必須印出「⏱️ 等待秒數：X」');
  assert.ok(logs.some(l => l.includes('⌨️ 逐字打字已啟動')), '必須印出「⌨️ 逐字打字已啟動」');
  assert.ok(res.plain.includes('Jack 老師說，你今年'), '回答必須為繁體中文');
  console.log('✅ 中文提問端到端流程驗證成功！');
}

console.log('\n🎉 所有端到端流程測試通過！');
