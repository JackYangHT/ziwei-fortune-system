/**
 * test_login_logout_engine.js
 * 驗證系統「登入 / 登出」與多使用者資料隔離功能：
 * 1. 使用者 A 登入 → 輸入出生資料 → 排盤 → 記下八字、命宮。
 * 2. 使用者 A 登出 → 確認：
 *    - 回到登入畫面
 *    - Console 有「🔒 已登出，資料已清除」
 *    - localStorage 沒有 chartData_${sessionId}
 * 3. 使用者 B 登入 → 輸入出生資料 → 排盤 → 記下八字、命宮。
 * 4. 使用者 B 的八字、命宮，跟使用者 A 不一樣。
 * 5. 使用者 B 登出 → 確認資料被清除。
 * 6. 使用者 A 再次登入 → 確認：
 *    - 從空白開始
 *    - 需要重新輸入出生資料
 */

const assert = require('assert');

// 設置 DOM 與 localStorage 模擬環境
const mockLocalStorage = {};
global.localStorage = {
  getItem: (k) => mockLocalStorage[k] !== undefined ? mockLocalStorage[k] : null,
  setItem: (k, v) => { mockLocalStorage[k] = String(v); },
  removeItem: (k) => { delete mockLocalStorage[k]; },
  clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
};

const domElements = {
  loginViewContainer: { style: { display: '' } },
  inputSectionWrapper: { style: { display: '' }, classList: { add: () => {}, remove: () => {}, contains: () => false } },
  chatScrollArea: { style: { display: '' } },
  userHeaderSection: { style: { display: '' } },
  currentUserNameDisplay: { textContent: '' },
  btnDrawerLogout: { style: { display: '' } },
  loginUsernameInput: { value: '', focus: () => {} },
  chatMessagesContainer: { innerHTML: '', appendChild: () => {} },
  newClientName: { value: '' },
  newBirthday: { value: '' },
  newBirthClockTime: { value: '' },
  newBirthPlace: { value: '' },
  newGender: { value: '男', options: [] },
  newBirthTime: { value: '' },
  birthYearSelect: { value: '', options: [], appendChild: () => {}, innerHTML: '' },
  birthMonthSelect: { value: '', options: [], appendChild: () => {}, innerHTML: '' },
  birthDaySelect: { value: '', options: [], appendChild: () => {}, innerHTML: '' }
};

global.document = {
  getElementById: (id) => {
    if (!domElements[id]) domElements[id] = {};
    const el = domElements[id];
    if (!el.style) el.style = {};
    if (!el.classList) el.classList = { add: () => {}, remove: () => {}, contains: () => false };
    if (!el.addEventListener) el.addEventListener = () => {};
    if (!el.removeEventListener) el.removeEventListener = () => {};
    if (!el.appendChild) el.appendChild = () => {};
    if (!el.focus) el.focus = () => {};
    if (!el.options) el.options = [];
    return el;
  },
  querySelector: (sel) => {
    if (sel === '.chat-bottom-wrapper') return { style: { display: '' } };
    return null;
  },
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: () => ({
    className: '',
    innerHTML: '',
    style: {},
    appendChild: () => {},
    addEventListener: () => {},
    setAttribute: () => {},
    classList: { add: () => {}, remove: () => {} }
  })
};

// 攔截 console.log 以驗證關鍵日誌輸出
const consoleLogs = [];
const originalLog = console.log;
console.log = function(...args) {
  const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  consoleLogs.push(line);
  originalLog.apply(console, args);
};

const app = require('../webapp/app.js');

console.log('\n🧪 開始執行【登入 / 登出與多使用者隔離機制專項驗證測試】...\n');

// -------------------------------------------------------------
// 測試 1: 使用者 A 登入 → 輸入出生資料 → 排盤 → 記下八字、命宮
// -------------------------------------------------------------
console.log('--- 測試 1: 使用者 A 登入、排盤與命盤鎖定 ---');

// 初始狀態下無使用者登入，確認登入畫面呈現
app.updateAuthUI();
assert.strictEqual(domElements.loginViewContainer.style.display, 'flex', '未登入時應顯示登入畫面');
assert.strictEqual(domElements.inputSectionWrapper.style.display, 'none', '未登入時應隱藏出生資料輸入區');
assert.strictEqual(domElements.chatScrollArea.style.display, 'none', '未登入時應隱藏對話區');

// 使用者 A 登入
const userAName = '使用者A';
const sessionIdA = app.handleLogin(userAName);
assert(sessionIdA.startsWith(`user_${userAName}_`), `sessionId 格式應為 user_\${name}_\${timestamp}，實際: ${sessionIdA}`);
assert.strictEqual(mockLocalStorage['user_session_id'], sessionIdA, 'localStorage 應儲存 user_session_id');
assert.strictEqual(mockLocalStorage['user_name'], userAName, 'localStorage 應儲存 user_name');

// 驗證 Console 印出：🔒 使用者資料已隔離（sessionId: xxx）
const isolateLogA = consoleLogs.find(l => l.includes(`🔒 使用者資料已隔離（sessionId: ${sessionIdA}）`));
assert(isolateLogA, `Console 應印出「🔒 使用者資料已隔離（sessionId: ${sessionIdA}）」`);

// 驗證已進入主系統
assert.strictEqual(domElements.loginViewContainer.style.display, 'none', '登入後登入畫面應隱藏');
assert.strictEqual(domElements.inputSectionWrapper.style.display, '', '登入後應顯示出生資料輸入區');
assert.strictEqual(domElements.chatScrollArea.style.display, '', '登入後應顯示對話區');
assert.strictEqual(domElements.currentUserNameDisplay.textContent, userAName, '導航列應顯示當前使用者名稱');

// 使用者 A 輸入出生資料：1971-07-10 10:00 台北 男
const sessionObjA = {
  sessionId: 'sess_A_001',
  userSessionId: sessionIdA,
  clientName: userAName,
  birthday: '1971-07-10',
  birthPlace: '台北',
  birthClockTime: '10:00',
  birthTime: 5,
  gender: '男',
  calendarType: 'solar',
  targetYear: 2026,
  hasExplicitBirthData: true,
  messages: [{ id: 'm1', sender: 'assistant', text: '你好，使用者A' }]
};

const chartDataA = app.initOrGetSessionChart(sessionObjA);
app.saveSession(sessionObjA);
app.recordUserRating({ sessionId: sessionObjA.sessionId, question: '財運', score: 9 });

assert(chartDataA, '使用者 A 應成功排盤');
const baziA = chartDataA.baziFourPillars;
const mingGongA = `${chartDataA.mingGongBranch}宮`;

console.log(`  • 使用者 A (${userAName}) Session ID: ${sessionIdA}`);
console.log(`  • 使用者 A 八字: ${baziA}`);
console.log(`  • 使用者 A 命宮: ${mingGongA}`);

// 驗證 localStorage 儲存 key：chartData_${sessionId}、chat_history_${sessionId}、user_ratings_${sessionId}
assert(mockLocalStorage[`chartData_${sessionIdA}`], `應存在 chartData_\${sessionIdA}`);
assert(mockLocalStorage[`chat_history_${sessionIdA}`], `應存在 chat_history_\${sessionIdA}`);
assert(mockLocalStorage[`user_ratings_${sessionIdA}`], `應存在 user_ratings_\${sessionIdA}`);

console.log('✅ 測試 1 通過：使用者 A 成功登入、排盤並將命盤與對話記錄存入專屬 key！\n');

// -------------------------------------------------------------
// 測試 2: 使用者 A 登出 → 確認回到登入畫面、Console 印出已登出、資料清除
// -------------------------------------------------------------
console.log('--- 測試 2: 使用者 A 登出與資料清除 ---');

app.handleLogout();

// 驗證 Console 印出：🔒 已登出，資料已清除
const logoutLog = consoleLogs.find(l => l.includes('🔒 已登出，資料已清除'));
assert(logoutLog, 'Console 應印出「🔒 已登出，資料已清除」');

// 驗證回到登入畫面
assert.strictEqual(domElements.loginViewContainer.style.display, 'flex', '登出後應回到登入畫面');
assert.strictEqual(domElements.inputSectionWrapper.style.display, 'none', '登出後應隱藏輸入區');
assert.strictEqual(domElements.userHeaderSection.style.display, 'none', '登出後導航列使用者區塊應隱藏');

// 驗證 localStorage 沒有 chartData_${sessionIdA}、chat_history、user_ratings、user_session_id
assert.strictEqual(localStorage.getItem(`chartData_${sessionIdA}`), null, 'localStorage 應已清除 chartData_${sessionIdA}');
assert.strictEqual(localStorage.getItem(`chat_history_${sessionIdA}`), null, 'localStorage 應已清除 chat_history_${sessionIdA}');
assert.strictEqual(localStorage.getItem(`user_ratings_${sessionIdA}`), null, 'localStorage 應已清除 user_ratings_${sessionIdA}');
assert.strictEqual(localStorage.getItem('user_session_id'), null, 'localStorage 應已清除 user_session_id');

console.log('✅ 測試 2 通過：使用者 A 登出後資料完全清除，並回到登入畫面！\n');

// -------------------------------------------------------------
// 測試 3: 使用者 B 登入 → 輸入出生資料 → 排盤 → 記下八字、命宮
// -------------------------------------------------------------
console.log('--- 測試 3: 使用者 B 登入、排盤 ---');

const userBName = '使用者B';
const sessionIdB = app.handleLogin(userBName);
assert(sessionIdB.startsWith(`user_${userBName}_`), `sessionId 格式應為 user_\${name}_\${timestamp}，實際: ${sessionIdB}`);
assert.notStrictEqual(sessionIdB, sessionIdA, '使用者 B 的 sessionId 應不同於使用者 A');

const isolateLogB = consoleLogs.find(l => l.includes(`🔒 使用者資料已隔離（sessionId: ${sessionIdB}）`));
assert(isolateLogB, `Console 應印出「🔒 使用者資料已隔離（sessionId: ${sessionIdB}）」`);

// 使用者 B 輸入出生資料：1985-05-20 14:00 台北 女
const sessionObjB = {
  sessionId: 'sess_B_001',
  userSessionId: sessionIdB,
  clientName: userBName,
  birthday: '1985-05-20',
  birthPlace: '台北',
  birthClockTime: '14:00', // 未時
  birthTime: 7,
  gender: '女',
  calendarType: 'solar',
  targetYear: 2026,
  hasExplicitBirthData: true,
  messages: [{ id: 'mb1', sender: 'assistant', text: '你好，使用者B' }]
};

const chartDataB = app.initOrGetSessionChart(sessionObjB);
app.saveSession(sessionObjB);

assert(chartDataB, '使用者 B 應成功排盤');
const baziB = chartDataB.baziFourPillars;
const mingGongB = `${chartDataB.mingGongBranch}宮`;

console.log(`  • 使用者 B (${userBName}) Session ID: ${sessionIdB}`);
console.log(`  • 使用者 B 八字: ${baziB}`);
console.log(`  • 使用者 B 命宮: ${mingGongB}`);

assert(localStorage.getItem(`chartData_${sessionIdB}`), `應存在 chartData_\${sessionIdB}`);
console.log('✅ 測試 3 通過：使用者 B 成功登入並排盤！\n');

// -------------------------------------------------------------
// 測試 4: 使用者 B 的八字、命宮，跟使用者 A 不一樣
// -------------------------------------------------------------
console.log('--- 測試 4: 使用者 A 與使用者 B 命盤數據嚴格隔離且不同 ---');

console.log(`  • 使用者 A 八字: [${baziA}], 命宮: [${mingGongA}]`);
console.log(`  • 使用者 B 八字: [${baziB}], 命宮: [${mingGongB}]`);

assert.notStrictEqual(baziA, baziB, '使用者 A 與 使用者 B 的八字四柱應完全不同');
assert.notStrictEqual(mingGongA, mingGongB, '使用者 A 與 使用者 B 的本命命宮應不同');

console.log('✅ 測試 4 通過：使用者 B 與 使用者 A 命盤完全不同，資料嚴格獨立！\n');

// -------------------------------------------------------------
// 測試 5: 使用者 B 登出 → 確認資料被清除
// -------------------------------------------------------------
console.log('--- 測試 5: 使用者 B 登出與資料清除 ---');

app.handleLogout();

assert.strictEqual(localStorage.getItem(`chartData_${sessionIdB}`), null, 'localStorage 應已清除 chartData_${sessionIdB}');
assert.strictEqual(localStorage.getItem(`chat_history_${sessionIdB}`), null, 'localStorage 應已清除 chat_history_${sessionIdB}');
assert.strictEqual(localStorage.getItem('user_session_id'), null, 'localStorage 應已清除 user_session_id');
assert.strictEqual(domElements.loginViewContainer.style.display, 'flex', '回到登入畫面');

console.log('✅ 測試 5 通過：使用者 B 登出後所有資料完全清除！\n');

// -------------------------------------------------------------
// 測試 6: 使用者 A 再次登入 → 確認從空白開始、需重新輸入出生資料
// -------------------------------------------------------------
console.log('--- 測試 6: 使用者 A 再次登入（從空白開始、生成新 sessionId） ---');

const sessionIdA2 = app.handleLogin(userAName);
console.log(`  • 使用者 A 新登入 Session ID: ${sessionIdA2}`);

// 驗證生成新的 sessionId
assert.notStrictEqual(sessionIdA2, sessionIdA, '再次登入時應生成全新的 sessionId（因 timestamp 不同）');
assert(sessionIdA2.startsWith(`user_${userAName}_`), '新 sessionId 前綴應符合規範');

// 驗證從空白開始：沒有舊的 chartData
assert.strictEqual(localStorage.getItem(`chartData_${sessionIdA2}`), null, '新 sessionId 下尚無排盤資料，從空白開始');
assert.strictEqual(localStorage.getItem(`chat_history_${sessionIdA2}`), null, '新 sessionId 下尚無對話紀錄，從空白開始');

// 驗證需要重新輸入出生資料
assert.strictEqual(domElements.loginViewContainer.style.display, 'none', '登入後登入畫面隱藏');
assert.strictEqual(domElements.inputSectionWrapper.style.display, '', '進入主系統，等待使用者重新輸入出生資料');

console.log('✅ 測試 6 通過：使用者 A 再次登入生成全新 sessionId，100% 從空白開始，需重新輸入出生資料！\n');

console.log('🎉🎉🎉 所有「登入 / 登出與多使用者隔離」測試 6 大項目全部 100% 通過！');
