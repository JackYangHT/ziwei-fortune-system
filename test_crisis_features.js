/**
 * test_crisis_features.js
 * 驗證五大測試案例、保密機制、危機預警四段式格式、等待提示與打字機效果
 */
const assert = require('assert');
const app = require('./webapp/app.js');

console.log('====================================================');
console.log('🧪 開始執行「未來危機預警、Jack 老師風格與保密」驗證測試');
console.log('====================================================');

const session = {
  sessionId: 'test-session-1977',
  clientName: '阿珍',
  birthday: '1977-07-26',
  birthTime: '08:00',
  birthPlace: '曼谷',
  targetYear: 2026,
  messages: []
};

// ----------------------------------------------------
// 測試一：問「我今年運勢如何」→ 確認回答不主動提「肉慾」和「爛桃花」
// ----------------------------------------------------
console.log('\n--- [測試 1] 問「我今年運勢如何」---');
{
  const q = '我今年運勢如何';
  const intent = app.parseIntent(q, session);
  const data = app.fetchAstrologyData(intent, session);
  const res = app.generateNaturalAnswerFallback(intent, data, q, session, 'zh');

  console.log('💬 回答 Plain:', res.plain);
  console.log('🚦 燈號:', res.light);
  console.log('🔒 肉慾欄位 (sensual):', res.sensual);
  console.log('🔒 爛桃花欄位 (badPeachBlossom):', res.badPeachBlossom);

  assert.strictEqual(res.sensual, null, '肉慾欄位在未主動詢問時嚴格為 null');
  assert.strictEqual(res.badPeachBlossom, null, '爛桃花欄位在未主動詢問時嚴格為 null');
  assert.ok(!res.plain.includes('肉慾') && !res.plain.includes('情慾'), '白話版不得包含肉慾');
  assert.ok(!res.plain.includes('爛桃花'), '白話版不得主動提爛桃花');
  console.log('✅ 測試 1 通過：未主動詢問時嚴格不主動提及「肉慾」和「爛桃花」');
}

// ----------------------------------------------------
// 測試二：問「我今年會破財嗎」→ 確認回答有「財務危機預警」
// ----------------------------------------------------
console.log('\n--- [測試 2] 問「我今年會破財嗎」---');
{
  const q = '我今年會破財嗎';
  const intent = app.parseIntent(q, session);
  const data = app.fetchAstrologyData(intent, session);
  const res = app.generateNaturalAnswerFallback(intent, data, q, session, 'zh');

  console.log('💬 回答 Plain:', res.plain);
  console.log('⚠️ 危機預警:', res.crisisWarning);

  assert.ok(res.crisisWarning, '必須輸出危機預警物件');
  assert.strictEqual(res.crisisWarning.type, '財務危機', '危機類型必須為「財務危機」');
  assert.ok(res.plain.includes('根據命盤推算，您的財帛宮化忌，未來可能面臨財務危機'), '需包含第 1 句：推算與宮位');
  assert.ok(res.plain.includes('具體行為：不會理財、衝動投資'), '需包含第 2 句：具體行為');
  assert.ok(res.plain.includes('未來後果：破財、負債'), '需包含第 3 句：未來後果');
  assert.ok(res.plain.includes('建議提前資產配置、避免高風險投資、保留現金'), '需包含第 4 句：具體建議');
  console.log('✅ 測試 2 通過：正確輸出「財務危機預警」且嚴格符合四段式');
}

// ----------------------------------------------------
// 測試三：問「我今年健康如何」→ 確認回答有「健康危機預警」
// ----------------------------------------------------
console.log('\n--- [測試 3] 問「我今年健康如何」---');
{
  const q = '我今年健康如何';
  const intent = app.parseIntent(q, session);
  const data = app.fetchAstrologyData(intent, session);
  const res = app.generateNaturalAnswerFallback(intent, data, q, session, 'zh');

  console.log('💬 回答 Plain:', res.plain);
  console.log('⚠️ 危機預警:', res.crisisWarning);

  assert.ok(res.crisisWarning, '必須輸出危機預警物件');
  assert.strictEqual(res.crisisWarning.type, '健康危機', '危機類型必須為「健康危機」');
  assert.ok(res.plain.includes('根據命盤推算，您的疾厄宮化忌，未來可能面臨健康危機'), '需包含第 1 句：推算與疾厄宮');
  assert.ok(res.plain.includes('具體行為：抽菸、喝酒、晚睡'), '需包含第 2 句：具體行為');
  assert.ok(res.plain.includes('未來後果：肝膽疾病、心血管問題'), '需包含第 3 句：未來後果');
  assert.ok(res.plain.includes('建議提前調整作息、戒菸戒酒、定期健康檢查'), '需包含第 4 句：具體建議');
  console.log('✅ 測試 3 通過：正確輸出「健康危機預警」且嚴格符合四段式');
}

// ----------------------------------------------------
// 測試四：問「我今年感情如何」→ 確認回答有「感情危機預警」
// ----------------------------------------------------
console.log('\n--- [測試 4] 問「我今年感情如何」---');
{
  const q = '我今年感情如何';
  const intent = app.parseIntent(q, session);
  const data = app.fetchAstrologyData(intent, session);
  const res = app.generateNaturalAnswerFallback(intent, data, q, session, 'zh');

  console.log('💬 回答 Plain:', res.plain);
  console.log('⚠️ 危機預警:', res.crisisWarning);

  assert.ok(res.crisisWarning, '必須輸出危機預警物件');
  assert.strictEqual(res.crisisWarning.type, '感情危機', '危機類型必須為「感情危機」');
  assert.ok(res.plain.includes('根據命盤推算，您的夫妻宮化忌會空劫，未來可能面臨感情危機'), '需包含第 1 句：推算與夫妻宮');
  assert.ok(res.plain.includes('具體行為：外遇、爛桃花干擾'), '需包含第 2 句：具體行為');
  assert.ok(res.plain.includes('未來後果：離婚、分散'), '需包含第 3 句：未來後果');
  assert.ok(res.plain.includes('建議提前溝通、進行風水佈局斬爛桃花、必要時尋求諮商'), '需包含第 4 句：具體建議');
  console.log('✅ 測試 4 通過：正確輸出「感情危機預警」且嚴格符合四段式');
}

// ----------------------------------------------------
// 測試五：問「我有爛桃花嗎」→ 確認回答有「爛桃花」相關內容
// ----------------------------------------------------
console.log('\n--- [測試 5] 問「我有爛桃花嗎」---');
{
  const q = '我有爛桃花嗎';
  const intent = app.parseIntent(q, session);
  const data = app.fetchAstrologyData(intent, session);
  const res = app.generateNaturalAnswerFallback(intent, data, q, session, 'zh');

  console.log('💬 回答 Plain:', res.plain);
  console.log('🌸 爛桃花資料:', res.badPeachBlossom);

  assert.ok(res.plain.includes('爛桃花'), '使用者主動提問爛桃花時，回答必須包含爛桃花');
  assert.ok(res.badPeachBlossom, 'badPeachBlossom 物件必須存在');
  assert.strictEqual(res.badPeachBlossom.hasBadPeachBlossom, true, 'hasBadPeachBlossom 為 true');
  console.log('✅ 測試 5 通過：主動詢問時正確輸出「爛桃花」分析與開運避煞建議');
}

// ----------------------------------------------------
// 測試六：保密規範測試
// ----------------------------------------------------
console.log('\n--- [測試 6] 保密規範測試 ---');
{
  // 1. 問「你用什麼 AI」
  const qAi = '你用什麼 AI';
  const intentAi = app.parseIntent(qAi, session);
  const dataAi = app.fetchAstrologyData(intentAi, session);
  const resAi = app.generateNaturalAnswerFallback(intentAi, dataAi, qAi, session, 'zh');
  console.log('💬 AI 保密回答:', resAi.plain);
  assert.ok(resAi.plain.includes('這是商業機密，不便透露'), '問 AI 技術時必須回答「這是商業機密，不便透露」');

  // 2. 問「你的命理體系是什麼」
  const qSys = '你的命理體系是什麼';
  const intentSys = app.parseIntent(qSys, session);
  const dataSys = app.fetchAstrologyData(intentSys, session);
  const resSys = app.generateNaturalAnswerFallback(intentSys, dataSys, qSys, session, 'zh');
  console.log('💬 體系保密回答:', resSys.plain);
  assert.ok(resSys.plain.includes('這是千年命理智慧的整合，不便透露具體來源'), '問體系時必須回答「這是千年命理智慧的整合，不便透露具體來源」');

  // 3. 檢查回答中是否有違規提及
  const forbiddenKeywords = ['DeepSeek', 'Gemini', 'iztro', '倪海廈'];
  [resAi, resSys].forEach(r => {
    forbiddenKeywords.forEach(kw => {
      assert.ok(!r.plain.includes(kw), `回答中不得出現「${kw}」`);
    });
  });

  console.log('✅ 測試 6 通過：商業機密與命理傳承回答完全符合保密規定');
}

// ----------------------------------------------------
// 測試七：泰文版測試（語言與術語保留）
// ----------------------------------------------------
console.log('\n--- [測試 7] 泰文提問與命理術語 ---');
{
  const qTh = '10 อันดับวันโชคลาภลอตเตอรี่สูงสุด';
  const lang = app.detectLanguage(qTh);
  assert.strictEqual(lang, 'th', '必須正確辨識泰文');
  const intentTh = app.parseIntent(qTh, session, lang);
  const dataTh = app.fetchAstrologyData(intentTh, session);
  const resTh = app.generateNaturalAnswerFallback(intentTh, dataTh, qTh, session, lang);

  console.log('💬 泰文回答 Plain:', resTh.plain);
  assert.ok(resTh.plain.includes('พี่บอกเลย') || resTh.plain.includes('ตามการคำนวณดวงชะตา'), '泰文回答必須以泰文自然語言開頭');
  assert.ok(resTh.plain.includes('火貪格') && resTh.plain.includes('ฮั่วทานเก๋อ'), '命理術語必須保留中文並附帶泰文括號');
  assert.ok(resTh.plain.includes('破軍逢祿') && resTh.plain.includes('พั่วจวินเฝิงลู่'), '命理術語必須保留中文並附帶泰文括號');
  assert.ok(resTh.plain.includes('祿存') && resTh.plain.includes('ลู่ฉุน'), '命理術語必須保留中文並附帶泰文括號');
  console.log('✅ 測試 7 通過：泰文提問以泰文回覆，且命理術語保留中文+泰文標註');
}

// ----------------------------------------------------
// 測試八：等待提示與打字機模組測試
// ----------------------------------------------------
console.log('\n--- [測試 8] 等待提示與打字機函式測試 ---');
{
  assert.strictEqual(typeof app.showWaitingNotice, 'function', 'showWaitingNotice 必須為函式');
  assert.strictEqual(typeof app.hideWaitingNotice, 'function', 'hideWaitingNotice 必須為函式');
  assert.strictEqual(typeof app.showTypingEffect, 'function', 'showTypingEffect 必須為函式');
  assert.strictEqual(typeof app.detectAstrolabeCrises, 'function', 'detectAstrolabeCrises 必須為函式');

  // 測試打字機函式邏輯（模擬 DOM 節點）
  const mockElement = { innerHTML: '', appendChild: () => {}, querySelector: () => null };
  let typingDone = false;
  app.showTypingEffect(mockElement, 'Jack 老師幫你算了', 1, () => {
    typingDone = true;
  });

  setTimeout(() => {
    assert.strictEqual(typingDone, true, '打字機動畫在短時間內應觸發完成回調');
    console.log('✅ 測試 8 通過：等待提示與打字機模組正確載入並可執行');
  }, 350);
}

// ----------------------------------------------------
// 測試九：五大語言風格、幽默感與去「白話版」驗證
// ----------------------------------------------------
console.log('\n--- [測試 9] 五大語言風格、幽默感與去「白話版」驗證 ---');
{
  // 1. 用泰文問「คนนี้เหมาะจะซื้อหวยวันไหน」→ 確認回答是泰文，且泰國年輕人看得懂，有幽默感
  const qThYouth = 'คนนี้เหมาะจะซื้อหวยวันไหน';
  const langTh = app.detectLanguage(qThYouth);
  assert.strictEqual(langTh, 'th', '必須正確辨識泰文');
  const intentTh = app.parseIntent(qThYouth, session, langTh);
  const dataTh = app.fetchAstrologyData(intentTh, session);
  const resTh = app.generateNaturalAnswerFallback(intentTh, dataTh, qThYouth, session, langTh);
  console.log('💬 泰文年輕人口語回答:\n', resTh.plain);
  assert.ok(resTh.plain.includes('พี่บอกเลย ดูดวงแล้ว'), '泰文回答必須以幽默的年輕人朋友口語開頭');
  assert.ok(resTh.plain.includes('อย่ารอช้า') || resTh.plain.includes('ซื้อสนุกๆ พอ') || resTh.plain.includes('อย่าซื้อเยอะ'), '泰文回答必須包含年輕人幽默口語');
  assert.ok(!resTh.plain.includes('白話版'), '泰文回答嚴格不得包含「白話版」三個字');
  console.log('✅ 測試 9.1 通過：泰文年輕人口語與幽默感驗證通過');

  // 2. 用繁體中文問「我今年偏財如何」→ 確認回答是繁體中文，有幽默感
  const qZhYouth = '我今年偏財如何';
  const langZh = app.detectLanguage(qZhYouth);
  const intentZh = app.parseIntent(qZhYouth, session, langZh);
  const dataZh = app.fetchAstrologyData(intentZh, session);
  const resZh = app.generateNaturalAnswerFallback(intentZh, dataZh, qZhYouth, session, langZh);
  console.log('💬 中文台灣年輕人回答:\n', resZh.plain);
  assert.ok(resZh.plain.includes('Jack 老師說，你今年'), '中文回答必須以「Jack 老師說，你今年」開頭');
  assert.ok(resZh.plain.includes('別等了') || resZh.plain.includes('快衝') || resZh.plain.includes('別衝動梭哈') || resZh.plain.includes('小試身手'), '中文回答必須包含台灣年輕人口語幽默感');
  assert.ok(!resZh.plain.includes('白話版'), '中文回答嚴格不得包含「白話版」三個字');
  console.log('✅ 測試 9.2 通過：繁體中文台灣年輕人口語與幽默感驗證通過');

  // 3. 用英文問「When is my lucky day?」→ 確認回答是英文，有幽默感
  const qEnYouth = 'When is my lucky day?';
  const langEn = app.detectLanguage(qEnYouth);
  const intentEn = app.parseIntent(qEnYouth, session, langEn);
  const dataEn = app.fetchAstrologyData(intentEn, session);
  const resEn = app.generateNaturalAnswerFallback(intentEn, dataEn, qEnYouth, session, langEn);
  console.log('💬 英文美式口語回答:\n', resEn.plain);
  assert.ok(resEn.plain.includes('Jack 老師 says: Check it out'), '英文回答必須以「Jack 老師 says: Check it out」開頭');
  assert.ok(resEn.plain.includes("Don't wait, go grab that ticket!") || resEn.plain.includes("don't bet the house") || resEn.plain.includes("don't go crazy"), '英文回答必須包含美式幽默口語');
  assert.ok(!resEn.plain.includes('白話版'), '英文回答嚴格不得包含「白話版」三個字');
  console.log('✅ 測試 9.3 通過：英文輕鬆美式口語與幽默感驗證通過');

  // 4. 確認命理術語保留中文並加註當地語言
  assert.ok(resTh.plain.includes('火貪格') && resTh.plain.includes('ฮั่วทานเก๋อ'), '泰文必須保留「火貪格」並加註泰文解釋');
  assert.ok(resTh.plain.includes('破軍逢祿') && resTh.plain.includes('พั่วจวินเฝิงลู่'), '泰文必須保留「破軍逢祿」並加註泰文解釋');
  assert.ok(resTh.plain.includes('祿存') && resTh.plain.includes('ลู่ฉุน'), '泰文必須保留「祿存」並加註泰文解釋');
  assert.ok(resEn.plain.includes('火貪格') && resEn.plain.includes('Huo Tan Ge'), '英文必須保留「火貪格」並加註英文解釋');
  assert.ok(resEn.plain.includes('破軍逢祿') && resEn.plain.includes('Po Jun Feng Lu'), '英文必須保留「破軍逢祿」並加註英文解釋');
  assert.ok(resZh.plain.includes('破軍逢祿') && resZh.plain.includes('祿存'), '中文必須保留命理術語');
  console.log('✅ 測試 9.4 通過：命理術語在各語言中正確保留中文並加註當地語言');

  // 5. 確認沒有標註「白話版」三個字
  [resTh, resZh, resEn].forEach(r => {
    assert.ok(!r.plain.includes('白話版'), '回答內文嚴禁出現「白話版」');
  });
  console.log('✅ 測試 9.5 通過：確認全系統輸出完全沒有標註「白話版」三個字');

  // 6. 確認各語言卡片標題正確 (renderChatMessages / getChatPlainTitle)
  const thTitle = app.getChatPlainTitle(langTh);
  const zhTitle = app.getChatPlainTitle(langZh);
  const enTitle = app.getChatPlainTitle(langEn);
  const jaTitle = app.getChatPlainTitle('ja');
  const koTitle = app.getChatPlainTitle('ko');

  assert.strictEqual(thTitle, '💬【คำแนะนำจากพี่ Jack】', '泰文標題必須為 💬【คำแนะนำจากพี่ Jack】');
  assert.strictEqual(zhTitle, '💬【Jack 老師解答】', '中文標題必須為 💬【Jack 老師解答】');
  assert.strictEqual(enTitle, '💬【Advice from Jack】', '英文標題必須為 💬【Advice from Jack】');
  assert.strictEqual(jaTitle, '💬【Jack 先生のアドバイス】', '日文標題必須為 💬【Jack 先生のアドバイス】');
  assert.strictEqual(koTitle, '💬【Jack 선생님의 조언】', '韓文標題必須為 💬【Jack 선생님의 조언】');
  console.log('✅ 測試 9.6 通過：各語言諮詢卡片標題正確（泰文: 💬【คำแนะนำจากพี่ Jack】、英文: 💬【Advice from Jack】）');

  setTimeout(() => {
    console.log('\n🎉 所有 9 大模組測試皆已 100% 通過！');
  }, 400);
}
