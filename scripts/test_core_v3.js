const assert = require('assert');
const app = require('../webapp/app.js');

console.log('🧪 開始執行「核心系統指令 v3.0」全面測試驗證...\n');

// 建立模擬 Session
function createMockSession(overrides = {}) {
  return {
    clientName: '測試用戶',
    birthday: '1990-05-12',
    birthClockTime: '08:30',
    gender: '男',
    targetYear: 2026,
    messages: [],
    ...overrides
  };
}

// ============================================================================
// 測試 1：用戶只提供年月日，未提供性別 → 確認系統主動問性別
// ============================================================================
console.log('--- 測試 1: 用戶只提供年月日，未提供性別 (主動問性別) ---');
const sessionWithoutGender = {
  clientName: '新用戶',
  messages: []
};

const dateOnlyInput1 = '1995-10-24';
const dateOnlyInput2 = '我是1988年3月15日出生的';

// 1. 驗證判定函式
assert(app.isBirthDateWithoutGender(dateOnlyInput1, sessionWithoutGender), '純年月日格式應被判定為未提供性別');
assert(app.isBirthDateWithoutGender(dateOnlyInput2, sessionWithoutGender), '句子包含年月日但無性別應被判定為未提供性別');

// 帶有性別的輸入不應觸發問性別
assert(!app.isBirthDateWithoutGender('1990-05-12 男', sessionWithoutGender), '已提供性別者不應觸發問性別');
assert(!app.isBirthDateWithoutGender('我是1990年5月12日出生的女生', sessionWithoutGender), '已說明是女生者不應觸發問性別');

// 2. 驗證系統主動詢問性別的回覆內容
const genderResponse = app.buildAskGenderResponse(sessionWithoutGender, dateOnlyInput1, 'zh');
console.log('【測試 1 回覆預覽】：\n', genderResponse.plain.slice(0, 200), '...\n');

assert(
  genderResponse.plain.includes('請問您是男生還是女生') || genderResponse.plain.includes('男生還是女生'),
  '回覆中必須明確詢問是男生還是女生'
);
assert(
  genderResponse.plain.includes('陽男陰女順行') || genderResponse.plain.includes('陰男陽女逆行'),
  '回覆中必須向用戶解釋性別決定大限順行或逆行之核心原理'
);
assert(
  genderResponse.genderOptions && genderResponse.genderOptions.includes('男') && genderResponse.genderOptions.includes('女'),
  '回覆中必須提供男/女性別選項'
);

// 3. 驗證透過 generateNaturalAnswerFallback 也能自動導流至性別詢問
const fallbackGenderAns = app.generateNaturalAnswerFallback(
  { rawText: dateOnlyInput1, category: 'today' },
  {},
  dateOnlyInput1,
  sessionWithoutGender,
  'zh'
);
assert(fallbackGenderAns.plain.includes('男生還是女生'), 'generateNaturalAnswerFallback 應主動問性別');

console.log('✅ 測試 1 通過：用戶只提供年月日未提供性別時，系統主動說明大限順逆原理並詢問性別\n');

// ============================================================================
// 測試 2：用戶問「我財運如何」→ 確認系統交叉分析五個宮位，且分開講正財與偏財
// ============================================================================
console.log('--- 測試 2: 用戶問「我財運如何」 (交叉分析五個宮位 + 區分正偏財) ---');
const wealthQ = '我財運如何';
const mockSession2 = createMockSession();

const wealthAns = app.buildWealthAnswer(mockSession2, wealthQ, 'zh');
console.log('【測試 2 回覆預覽】：\n', wealthAns.plain.slice(0, 350), '...\n');

// 1. 確認交叉分析五個宮位（主宮50% -> 輔宮30% -> 暗宮20%）
assert(wealthAns.plain.includes('財帛宮') && (wealthAns.plain.includes('主宮') || wealthAns.plain.includes('50%')), '必須包含財帛宮（主宮 50%）');
assert(wealthAns.plain.includes('田宅宮') && (wealthAns.plain.includes('財庫') || wealthAns.plain.includes('30%')), '必須包含田宅宮（輔宮 30%，實質財庫）');
assert(wealthAns.plain.includes('兄弟宮') && wealthAns.plain.includes('現金流'), '必須包含兄弟宮（輔宮，現金流調度）');
assert(wealthAns.plain.includes('遷移宮') && (wealthAns.plain.includes('偏財') || wealthAns.plain.includes('20%')), '必須包含遷移宮（暗宮 20%，偏財副業）');
assert(wealthAns.plain.includes('福德宮') && (wealthAns.plain.includes('花錢') || wealthAns.plain.includes('慾望') || wealthAns.plain.includes('欲望')), '必須包含福德宮（暗宮，花錢慾望）');

// 2. 確認明確區分「正財」與「偏財」，分開論斷
assert(wealthAns.plain.includes('【正財分析') || wealthAns.plain.includes('正財分析'), '必須有獨立正財分析');
assert(wealthAns.plain.includes('薪水') || wealthAns.plain.includes('固定收入') || wealthAns.plain.includes('固定進帳'), '正財必須說明為薪水/固定收入/每月固定進帳');

assert(wealthAns.plain.includes('【偏財分析') || wealthAns.plain.includes('偏財分析'), '必須有獨立偏財分析');
assert(wealthAns.plain.includes('投資') || wealthAns.plain.includes('副業') || wealthAns.plain.includes('意外之財'), '偏財必須說明為投資/副業/意外之財');
assert(wealthAns.plain.includes('流日'), '偏財必須明確指出看流日星曜');

// 3. 確認 5 步驟結構化輸出
assert(wealthAns.plain.includes('步驟 1') || wealthAns.plain.includes('一句話結論'), '必須包含步驟 1（一句話結論）');
assert(wealthAns.plain.includes('步驟 2') || wealthAns.plain.includes('時間軸定位'), '必須包含步驟 2（先天命盤與時間軸定位）');
assert(wealthAns.plain.includes('步驟 3') || wealthAns.plain.includes('交叉分析深度解讀'), '必須包含步驟 3（十二宮交叉分析深度解讀）');
assert(wealthAns.plain.includes('步驟 4') || wealthAns.plain.includes('五感布局建議'), '必須包含步驟 4（五感布局建議）');
assert(wealthAns.plain.includes('步驟 5') || wealthAns.plain.includes('易經當下決策') || wealthAns.plain.includes('免責提醒'), '必須包含步驟 5（易經決策與免責提醒）');

// 4. 確認五感布局解釋「為什麼」
assert(wealthAns.plain.includes('地磁場') || wealthAns.plain.includes('地球磁場'), '五感方位必須解釋地磁場原理');
assert(wealthAns.plain.includes('光頻率'), '五感顏色必須解釋光頻率原理');
assert(wealthAns.plain.includes('聲頻率') || wealthAns.plain.includes('432Hz'), '五感音樂必須解釋聲頻率原理');
assert(wealthAns.plain.includes('化學頻率') || wealthAns.plain.includes('嗅神經') || wealthAns.plain.includes('嗅覺'), '五感香氣必須解釋嗅覺化學頻率');

// 5. 確認包含核心信念與免責提醒
assert(wealthAns.plain.includes('命是定的，運是 GPS，機會是你做對決定') || wealthAns.plain.includes('方向盤在你手裡，機會是你做對決定'), '必須包含核心邏輯賦權提醒');
assert(wealthAns.plain.includes('Jack 老師') || wealthAns.plain.includes('雞腿'), '必須包含 Jack 老師幽默句結尾');

console.log('✅ 測試 2 通過：交叉分析五個宮位（50%-30%-20%），精確區分正財（薪水）與偏財（流日投資），符合 5 步驟輸出\n');

// ============================================================================
// 測試 3：用戶問「我什麼時候...」→ 確認系統先看大限，再看流年、流月、流日
// ============================================================================
console.log('--- 測試 3: 用戶問「我什麼時候...」 (時間軸先大限、後流年、流月、流日) ---');
const timingQ = '我什麼時候能發財買房';
const mockSession3 = createMockSession();

// 1. 驗證判定函式
assert(app.isTimeAxisProgressionQuery(timingQ), '包含「什麼時候」應判定為時間軸推進提問');
assert(app.isTimeAxisProgressionQuery('我何時會有好機會'), '包含「何時」應判定為時間軸推進提問');

// 2. 驗證回答內容順序與結構
const timingAns = app.buildTimeAxisProgressionAnswer(mockSession3, timingQ, 'zh');
console.log('【測試 3 回覆預覽】：\n', timingAns.plain.slice(0, 350), '...\n');

// 檢驗順序：必須先出現大限，再出現流年，再出現流月，最後出現流日
const daxianIdx = timingAns.plain.indexOf('大限');
const liunianIdx = timingAns.plain.indexOf('流年');
const liuyueIdx = timingAns.plain.indexOf('流月');
const liuriIdx = timingAns.plain.indexOf('流日');

assert(daxianIdx !== -1, '必須包含大限分析');
assert(liunianIdx !== -1, '必須包含流年分析');
assert(liuyueIdx !== -1, '必須包含流月分析');
assert(liuriIdx !== -1, '必須包含流日分析');

assert(daxianIdx < liunianIdx, '大限必須排在流年之前');
assert(liunianIdx < liuyueIdx, '流年必須排在流月之前');
assert(liuyueIdx < liuriIdx, '流月必須排在流日之前');

assert(timingAns.plain.includes('先看大限，再看流年、流月、流日') || timingAns.plain.includes('先看大限'), '必須明確指出時間軸四層推進鐵律');
assert(timingAns.plain.includes('虛歲'), '大限必須使用虛歲基準');
assert(timingAns.plain.includes('順行') && timingAns.plain.includes('逆行'), '必須包含陽男陰女順行、陰男陽女逆行規則');
assert(timingAns.plain.includes('24 節氣') || timingAns.plain.includes('每節氣 15 度') || timingAns.plain.includes('節氣'), '流月必須連結 24 節氣科學印證');

console.log('✅ 測試 3 通過：系統嚴格依照「第一步大限 → 第二步流年 → 第三步流月 → 第四步流日」階層式推算時間軸\n');

// ============================================================================
// 測試 4：用戶質疑「11/7 是週六」→ 確認系統承認質疑並給出具體解法，不閃躲，不說「命理只是參考」
// ============================================================================
console.log('--- 測試 4: 用戶質疑「11/7 是週六」 (承認質疑「你問得好」+ 落地解法，不閃躲) ---');
const challengeQ = '11/7 是週六';
const mockSession4 = createMockSession();

// 1. 驗證質疑判定函式
assert(app.isUserChallengeOrDoubtQuery(challengeQ), '質疑「11/7 是週六」應被精確辨識');
assert(app.isUserChallengeOrDoubtQuery('那天是週六銀行沒開門'), '質疑週六銀行沒開門應被精確辨識');

// 2. 驗證回覆內容
const challengeAns = app.buildUserChallengeResponse(mockSession4, challengeQ, 'zh');
console.log('【測試 4 回覆預覽】：\n', challengeAns.plain.slice(0, 350), '...\n');

// 必須承認質疑（開頭「你問得好」）
assert(challengeAns.plain.includes('你問得好'), '必須明確承認質疑「你問得好」');
assert(challengeAns.plain.includes('11/7 確實是週六') || challengeAns.plain.includes('確實是週六'), '必須正面承認 11/7 確實是週六的事實，不得閃躲');

// 必須給出具體解法（週六吉日定盟 + 工作日行政落實）
assert(
  challengeAns.plain.includes('吉日定盟') || challengeAns.plain.includes('線上') || challengeAns.plain.includes('意向'),
  '必須給出解法一：吉日私下碰面、線上確認或意向定盟'
);
assert(
  challengeAns.plain.includes('工作日') || challengeAns.plain.includes('週一') || challengeAns.plain.includes('臨櫃'),
  '必須給出解法二：正式銀行匯款或蓋章公證順延至緊接著的第一個工作日（週一辰時）'
);

// 嚴格規範：絕不能閃躲，絕不能說「命理只是參考」
assert(!challengeAns.plain.includes('命理只是參考'), '面對質疑絕不可說「命理只是參考」！');

// 結尾賦權提醒
assert(challengeAns.plain.includes('方向盤在你手裡，機會是你做對決定'), '必須包含 GPS 與做對決定結尾');

console.log('✅ 測試 4 通過：面對「11/7 是週六」質疑，系統以「你問得好」承認質疑，給出線上定盟與工作日順延的落地解法，不閃躲且未說「命理只是參考」\n');

// ============================================================================
// 測試 5：用戶說「我在工作領薪水」→ 確認系統記得，不用再問
// ============================================================================
console.log('--- 測試 5: 用戶說「我在工作領薪水」 (多輪對話記憶與事實不重複詢問) ---');
const userStatementQ = '我在工作領薪水';
const multiTurnSession = createMockSession({ messages: [] });

// 1. 提取事實並登錄
app.extractUserFacts(userStatementQ, multiTurnSession);

assert(multiTurnSession.careerFacts, 'Session 應建立 careerFacts 物件');
assert(multiTurnSession.careerFacts.isSalariedWorker === true, '應成功記住 isSalariedWorker: true');
assert(multiTurnSession.careerFacts.isEmployed === true, '應成功記住 isEmployed: true');

// 2. 測試事實陳述的回應
const factAns = app.buildUserStatementFactResponse(multiTurnSession, userStatementQ, 'zh');
console.log('【測試 5 事實確認回覆預覽】：\n', factAns.plain.slice(0, 300), '...\n');

assert(factAns.plain.includes('Jack 老師記住了'), '系統必須明確表達已記住用戶的事實');
assert(factAns.plain.includes('領薪水') || factAns.plain.includes('受薪上班族'), '必須確認受薪上班族事實');
assert(factAns.plain.includes('不再') || factAns.plain.includes('絕不再重複'), '必須明確告知後續不再重複詢問');

// 3. 多輪後續提問驗證：當用戶接下來問「我財運如何」
const followUpWealthAns = app.buildWealthAnswer(multiTurnSession, '我財運如何', 'zh');
console.log('【測試 5 後續財運推算開頭】：\n', followUpWealthAns.plain.slice(0, 200), '...\n');

// 確認系統主動應用已記住的事實，不再問是不是上班族，切勿稱其待業
assert(
  followUpWealthAns.plain.includes('在工作領薪水') || followUpWealthAns.plain.includes('受薪'),
  '後續推算應直接引用「在工作領薪水」的事實記憶'
);
assert(!followUpWealthAns.plain.includes('你是否有工作') && !followUpWealthAns.plain.includes('請問你是待業'), '後續推算絕不可重複詢問是否待業或有無工作');

// 4. 補充驗證「我已經結婚有子」多輪事實記憶
const familySession = createMockSession({ messages: [] });
app.extractUserFacts('我已經結婚有子', familySession);
assert(familySession.maritalStatus.isMarried === true, '已婚事實應被記住');
assert(familySession.maritalStatus.hasChildren === true, '有子事實應被記住');
const familyAns = app.buildUserStatementFactResponse(familySession, '我已經結婚有子', 'zh');
assert(familyAns.plain.includes('Jack 老師記住了') && familyAns.plain.includes('孩子'), '已婚有子事實確認正確');

console.log('✅ 測試 5 通過：多輪對話精準記住「在工作領薪水」與「已婚有子」，後續對話絕不再重複詢問！\n');

// ============================================================================
// 系統指令驗證：確認 SYSTEM_PROMPT_TEMPLATE 最前面包含核心系統指令 v3.0
// ============================================================================
console.log('--- 額外驗證：SYSTEM_PROMPT_TEMPLATE 最前面包含核心系統指令 v4.0 ---');
assert(app.SYSTEM_PROMPT_TEMPLATE.startsWith('【最高指導原則：核心系統指令 v4.0】') || app.SYSTEM_PROMPT_TEMPLATE.startsWith('【核心系統指令 v3.0】：'), 'SYSTEM_PROMPT_TEMPLATE 最開頭必須為核心系統指令');
assert(app.SYSTEM_PROMPT_TEMPLATE.includes('### 零：系統身份與核心承諾'), '必須包含零：系統身份與核心承諾');
assert(app.SYSTEM_PROMPT_TEMPLATE.includes('### 一：架構原理（科學命理觀）'), '必須包含一：架構原理');
assert(app.SYSTEM_PROMPT_TEMPLATE.includes('### 二：核心推算引擎（紫微斗數為主軸）'), '必須包含二：核心推算引擎');
assert(app.SYSTEM_PROMPT_TEMPLATE.includes('系統輸出與布局建議規範（五感實戰）'), '必須包含系統輸出與布局建議規範');
assert(app.SYSTEM_PROMPT_TEMPLATE.includes('補充三個'), '必須包含補充三個機制');
console.log('✅ 系統指令驗證通過！\n');

console.log('🎉🎉🎉 「核心系統指令」全面測試 100% 全部通過！');
