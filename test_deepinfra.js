/**
 * test_deepinfra.js
 * 驗證 DeepInfra API 整合、宗旨保留（提前預知、降低傷害、積極佈局）、
 * System Prompt 規範、吉日四要素、禁用詞檢查以及端到端問答生成
 */

const assert = require('assert');
const http = require('http');

// 設置 Node 環境中的全域瀏覽器相容物件
global.self = global;
global.window = global;
global.document = {
  addEventListener: () => {},
  getElementById: () => ({
    addEventListener: () => {},
    innerHTML: '',
    style: {},
    classList: { add: () => {}, remove: () => {} }
  }),
  querySelectorAll: () => []
};
global.localStorage = {
  _store: {},
  getItem: function(k) { return this._store[k] || null; },
  setItem: function(k, v) { this._store[k] = String(v); },
  removeItem: function(k) { delete this._store[k]; },
  get length() { return Object.keys(this._store).length; },
  key: function(i) { return Object.keys(this._store)[i] || null; }
};

// 載入 iztro 引擎
global.iztro = require('./webapp/iztro.min.js');

const app = require('./webapp/app.js');

const {
  callDeepInfraLLM,
  calculateDeepInfraCost,
  callUnifiedLLM,
  SYSTEM_PROMPT_TEMPLATE,
  generateFortuneAnswer,
  generateNaturalAnswerFallback,
  formatAuspiciousDate,
  convertToLunar,
  getSystemCurrentDate,
  calculateClientAstrolabe,
  state
} = app;

const testSession = {
  sessionId: 'test-session-001',
  clientName: '測試客戶',
  birthday: '1990-03-15',
  calendarType: 'solar',
  birthPlace: '台北',
  birthClockTime: '14:00',
  birthTime: 7,
  gender: '男',
  targetYear: 2026,
  includeNatal: false
};
state.currentSession = testSession;
calculateClientAstrolabe(testSession);

console.log('====================================================');
console.log('🧪 啟動 DeepInfra API 與命理系統全面測試套件');
console.log('====================================================\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${testName}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${testName}`);
    console.error('   錯誤原因:', err.message);
    testsFailed++;
  }
}

async function runAsyncTest(testName, fn) {
  try {
    await fn();
    console.log(`✅ [PASS] ${testName}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${testName}`);
    console.error('   錯誤原因:', err.message);
    testsFailed++;
  }
}

async function main() {
  // ---------------------------------------------------------------
  // 測試 1: DeepInfra Token 消耗與預估成本計算
  // ---------------------------------------------------------------
  runTest('1. 驗證 calculateDeepInfraCost 成本計算 (V4 Flash, V4 Pro, V3.2)', () => {
    // DeepSeek V4 Flash: $0.09 / 1M prompt, $0.18 / 1M completion
    const costFlash = calculateDeepInfraCost('deepseek-ai/DeepSeek-V4-Flash-0731', {
      prompt_tokens: 1000,
      completion_tokens: 500,
      total_tokens: 1500
    });
    assert.strictEqual(costFlash.promptTokens, 1000);
    assert.strictEqual(costFlash.completionTokens, 500);
    assert.strictEqual(costFlash.inputPricePerM, 0.09);
    assert.strictEqual(costFlash.outputPricePerM, 0.18);
    // (1000 * 0.09 / 1e6) + (500 * 0.18 / 1e6) = 0.00009 + 0.00009 = 0.00018
    assert.strictEqual(Math.round(costFlash.totalCostUsd * 1e6), 180);
    assert(costFlash.totalCostTwd > 0);
    assert(costFlash.totalCostThb > 0);

    // DeepSeek V4 Pro: $0.27 / 1M prompt, $1.10 / 1M completion
    const costPro = calculateDeepInfraCost('deepseek-ai/DeepSeek-V4-Pro-0813', {
      prompt_tokens: 1000,
      completion_tokens: 1000
    });
    assert.strictEqual(costPro.inputPricePerM, 0.27);
    assert.strictEqual(costPro.outputPricePerM, 1.10);

    // DeepSeek V3.2: $0.14 / 1M prompt, $0.28 / 1M completion
    const costV32 = calculateDeepInfraCost('deepseek-ai/DeepSeek-V3.2', {
      prompt_tokens: 1000,
      completion_tokens: 1000
    });
    assert.strictEqual(costV32.inputPricePerM, 0.14);
    assert.strictEqual(costV32.outputPricePerM, 0.28);
  });

  // ---------------------------------------------------------------
  // 測試 2: System Prompt 規範檢查
  // ---------------------------------------------------------------
  runTest('2. 驗證 System Prompt 規範與防逃避條款完整保留', () => {
    // 檢查核心原則
    assert(SYSTEM_PROMPT_TEMPLATE.includes('提前預知、降低傷害、積極佈局'), '缺少提前預知核心宗旨');
    assert(SYSTEM_PROMPT_TEMPLATE.includes('不要用「命理是機率」來逃避'), '缺少父母健康防逃避規範');
    assert(SYSTEM_PROMPT_TEMPLATE.includes('不要用「無法確認」來逃避'), '缺少婚姻危機防逃避規範');
    assert(SYSTEM_PROMPT_TEMPLATE.includes('不要用「實際效果取決於你的行動」來逃避'), '缺少財務破耗防逃避規範');
    
    // 檢查推算與保證之區分
    assert(SYSTEM_PROMPT_TEMPLATE.includes('根據命盤推算，可能性很高'), '缺少保證改用可能性的規範');
    assert(SYSTEM_PROMPT_TEMPLATE.includes('不能只說「參考看看」'), '缺少具體行動規範');

    // 檢查禁用詞
    assert(SYSTEM_PROMPT_TEMPLATE.includes('絕對'), '缺少絕對禁用詞');
    assert(SYSTEM_PROMPT_TEMPLATE.includes('精準'), '缺少精準禁用詞');
    assert(SYSTEM_PROMPT_TEMPLATE.includes('完全'), '缺少完全禁用詞');
    assert(SYSTEM_PROMPT_TEMPLATE.includes('百分之百'), '缺少百分之百禁用詞');
    assert(SYSTEM_PROMPT_TEMPLATE.includes('鐵定'), '缺少鐵定禁用詞');
    assert(SYSTEM_PROMPT_TEMPLATE.includes('必然'), '缺少必然禁用詞');

    // 檢查四要素
    assert(SYSTEM_PROMPT_TEMPLATE.includes('國曆日期、農曆日期、八字干支、星期'), '缺少吉日四要素');

    // 檢查倪師改運
    assert(SYSTEM_PROMPT_TEMPLATE.includes('remedy 欄位必須嚴格為 null'), '缺少改運未問不給規範');
  });

  // ---------------------------------------------------------------
  // 測試 3: 吉日格式四要素輸出檢查
  // ---------------------------------------------------------------
  runTest('3. 驗證 formatAuspiciousDate 輸出完整四要素 (國曆、農曆、干支、星期)', () => {
    const formatted = formatAuspiciousDate('2026-10-06');
    // 預期包含：2026-10-06、農曆八月廿六、癸丑日、星期二
    assert(formatted.includes('2026-10-06'), '缺少國曆日期');
    assert(formatted.includes('農曆'), '缺少農曆標籤');
    assert(formatted.includes('癸丑日') || formatted.includes('癸丑'), '缺少干支日');
    assert(formatted.includes('星期二'), '缺少星期');

    const formattedDisplay = formatAuspiciousDate('2026-10-06', { displayMonthDay: true });
    assert(formattedDisplay.includes('10 月 6 日'), '缺少月日標示');
    assert(formattedDisplay.includes('農曆'), '缺少農曆標示');
    assert(formattedDisplay.includes('星期二'), '缺少星期標示');
  });

  // ---------------------------------------------------------------
  // 測試 4: 測試「我父母健康如何」
  // ---------------------------------------------------------------
  runTest('4. 驗證「我父母健康如何」具體建議與防逃避', () => {
    const session = {
      clientName: '測試客戶',
      birthday: '1990-03-15',
      targetYear: 2026,
      messages: []
    };
    const ans = generateNaturalAnswerFallback(
      { category: 'jiankang', rawText: '我父母健康如何' },
      {},
      '我父母健康如何',
      session,
      'zh'
    );

    assert(ans.plain, '缺少白話版回答');
    assert(ans.plain.includes('根據命盤推算'), '必須包含「根據命盤推算」');
    assert(ans.plain.includes('健康檢查') || ans.plain.includes('醫療資源') || ans.plain.includes('多陪伴'), '必須包含具體行動建議');
    assert(!ans.plain.includes('命理是機率'), '不可用「命理是機率」逃避');
    assert.strictEqual(ans.remedy, null, '未主動問及改運，remedy 必須為 null');
    assert(ans.calculation.includes('父母宮'), '完整推算必須包含父母宮位分析');

    // 禁用詞檢查
    const forbiddenWords = ['絕對', '精準', '完全', '百分之百', '鐵定', '必然', '主帥', '降維打擊'];
    for (const word of forbiddenWords) {
      assert(!ans.plain.includes(word), `回答中不可出現禁用詞 "${word}"`);
    }
  });

  // ---------------------------------------------------------------
  // 測試 5: 測試「我婚姻有危機嗎」
  // ---------------------------------------------------------------
  runTest('5. 驗證「我婚姻有危機嗎」具體建議與防逃避', () => {
    const session = {
      clientName: '測試客戶',
      birthday: '1990-03-15',
      targetYear: 2026,
      messages: []
    };
    const ans = generateNaturalAnswerFallback(
      { category: 'taohua', rawText: '我婚姻有危機嗎' },
      {},
      '我婚姻有危機嗎',
      session,
      'zh'
    );

    assert(ans.plain, '缺少白話版回答');
    assert(ans.plain.includes('根據命盤推算'), '必須包含「根據命盤推算」');
    assert(ans.plain.includes('夫妻宮化忌') || ans.plain.includes('夫妻宮'), '必須點出夫妻宮受煞忌考驗');
    assert(ans.plain.includes('外遇') || ans.plain.includes('破裂風險') || ans.plain.includes('危機'), '必須直接指出風險');
    assert(ans.plain.includes('提前溝通') || ans.plain.includes('風水佈局') || ans.plain.includes('諮商'), '必須給予具體挽救建議');
    assert(!ans.plain.includes('無法確認'), '不可用「無法確認」逃避');
    assert.strictEqual(ans.remedy, null, '未問改運，remedy 必須為 null');

    // 禁用詞檢查
    const forbiddenWords = ['絕對', '精準', '完全', '百分之百', '鐵定', '必然', '主帥', '降維打擊'];
    for (const word of forbiddenWords) {
      assert(!ans.plain.includes(word), `回答中不可出現禁用詞 "${word}"`);
    }
  });

  // ---------------------------------------------------------------
  // 測試 6: 測試「我今年偏財如何」
  // ---------------------------------------------------------------
  runTest('6. 驗證「我今年偏財如何」具體吉日與四要素標註', () => {
    const session = {
      clientName: '測試客戶',
      birthday: '1990-03-15',
      targetYear: 2026,
      messages: []
    };
    const ans = generateNaturalAnswerFallback(
      { category: 'piancai', rawText: '我今年偏財如何', timeFrame: { type: 'year' } },
      {
        future30DaysPiancai: {
          bestDay: { date: '2026-10-06', dailyGanZhi: '癸丑', score: 12 },
          topDays: [
            { date: '2026-10-06', dailyGanZhi: '癸丑', score: 12, rules: ['財帛宮逢化祿(破軍)', '命宮祿存'] },
            { date: '2026-10-12', dailyGanZhi: '己未', score: 9, rules: ['財帛宮逢化祿(武曲)'] }
          ]
        }
      },
      '我今年偏財如何',
      session,
      'zh'
    );

    assert(ans.plain, '缺少白話版回答');
    // 白話版第一句包含吉日
    assert(ans.plain.includes('你今年偏財最旺的日期是'), '第一句必須直接給出今年偏財最旺日期');
    assert(ans.plain.includes('2026-10-06') || ans.plain.includes('10 月 6 日'), '必須包含國曆日期');
    assert(ans.plain.includes('農曆'), '必須包含農曆');
    assert(ans.plain.includes('癸丑'), '必須包含干支');
    assert(ans.plain.includes('星期二'), '必須包含星期');

    // 排行榜每一天都包含四要素
    assert(ans.calculation.includes('2026-10-06') || ans.calculation.includes('10月6日'), '推算中應有吉日');
    assert(ans.calculation.includes('農曆'), '推算中應有農曆');
    assert(ans.calculation.includes('星期'), '推算中應有星期');
    assert.strictEqual(ans.remedy, null, '未問改運，remedy 必須為 null');

    // 格式五要素檢查
    assert(ans.plain, '缺少 plain 欄位');
    assert(ans.light && ans.light.type, '缺少 light 欄位');
    assert(ans.stars, '缺少 stars 欄位');
    assert(ans.calculation, '缺少 calculation 欄位');
    assert(ans.remedy === null, 'remedy 欄位應為 null');

    // 禁用詞檢查
    const forbiddenWords = ['絕對', '精準', '完全', '百分之百', '鐵定', '必然', '主帥', '降維打擊'];
    for (const word of forbiddenWords) {
      assert(!ans.plain.includes(word), `回答中不可出現禁用詞 "${word}"`);
    }
  });

  // ---------------------------------------------------------------
  // 測試 7: Mock DeepInfra API 呼叫驗證 (OpenAI 相容協議、Header、格式解析)
  // ---------------------------------------------------------------
  await runAsyncTest('7. 驗證 callDeepInfraLLM 對外請求格式與 Bearer 驗證 (Mock Server)', async () => {
    let capturedHeaders = null;
    let capturedBody = null;

    // 建立本地模擬 DeepInfra OpenAI 相容端點伺服器
    const mockServer = http.createServer((req, res) => {
      capturedHeaders = req.headers;
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        capturedBody = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'chatcmpl-mock-12345',
          object: 'chat.completion',
          created: 1727072000,
          model: 'deepseek-ai/DeepSeek-V4-Flash-0731',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  plain: '你今年偏財最旺的日期是 2026-10-06（農曆八月廿六，癸丑日，星期二），得分高達 12 分。根據命盤推算，這一天財帛宮破軍逢祿存坐守。這是我的建議：你可以試著把握短線收益。',
                  light: { type: 'green', text: '大吉（偏財高峰）' },
                  stars: '★★★★★',
                  calculation: '【2026 偏財推算依據】：10月6日逢雙祿朝垣，得分 12 分。',
                  remedy: null
                })
              },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 120,
            completion_tokens: 80,
            total_tokens: 200
          }
        }));
      });
    });

    await new Promise((resolve) => mockServer.listen(0, resolve));
    const port = mockServer.address().port;
    const mockEndpoint = `http://127.0.0.1:${port}/v1/openai/chat/completions`;

    try {
      const responseText = await callDeepInfraLLM('我今年偏財如何', {
        endpoint: mockEndpoint,
        apiKey: 'test-dip-key-99999',
        model: 'deepseek-ai/DeepSeek-V4-Flash-0731',
        temperature: 0.7
      });

      // 檢查 Header
      assert.strictEqual(capturedHeaders['authorization'], 'Bearer test-dip-key-99999', 'Header 必須是 Authorization: Bearer <key>');
      assert.strictEqual(capturedHeaders['content-type'], 'application/json', 'Content-Type 必須是 application/json');

      // 檢查 Body (OpenAI 相容格式)
      assert.strictEqual(capturedBody.model, 'deepseek-ai/DeepSeek-V4-Flash-0731', '模型需為 deepseek-ai/DeepSeek-V4-Flash-0731');
      assert(Array.isArray(capturedBody.messages), 'messages 必須為陣列');
      assert.strictEqual(capturedBody.messages[0].role, 'system', '第一則訊息需為 system');
      assert.strictEqual(capturedBody.messages[1].role, 'user', '第二則訊息需為 user');
      assert.strictEqual(capturedBody.messages[1].content, '我今年偏財如何');

      // 檢查解析回傳
      const parsedRes = JSON.parse(responseText);
      assert(parsedRes.plain.includes('2026-10-06（農曆八月廿六，癸丑日，星期二）'), '回傳內容符合格式');
      assert.strictEqual(parsedRes.remedy, null, 'remedy 欄位為 null');
    } finally {
      mockServer.close();
    }
  });

  // ---------------------------------------------------------------
  // 測試 8: 驗證 callUnifiedLLM 自動降級 (DeepInfra ➔ 本地引擎)
  // ---------------------------------------------------------------
  await runAsyncTest('8. 驗證 callUnifiedLLM 故障降級鏈條 (無 Key 時自動安全降級)', async () => {
    // 當無 DeepInfra key 且無 Gemini key 時，callUnifiedLLM 應適當丟出錯誤以便外層捕捉進入 generateNaturalAnswerFallback
    let errorThrown = false;
    try {
      await callUnifiedLLM('測試問題', { apiKey: '' });
    } catch (e) {
      errorThrown = true;
    }
    assert(errorThrown, '無 API Key 時應正確觸發錯誤以讓 pipeline 回退至本地備用引擎');

    // 測試端到端 generateFortuneAnswer
    const res = await generateFortuneAnswer('我今年偏財如何');
    assert(res.plain, '回答必須成功生成');
    assert(res.plain.includes('偏財最旺的日期是'), '回答須符合規範');
  });

  console.log('\n====================================================');
  console.log(`📊 測試結果彙整: 共 ${testsPassed + testsFailed} 項測試，通過: ${testsPassed}，失敗: ${testsFailed}`);
  console.log('====================================================');

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('測試套件執行異常:', err);
  process.exit(1);
});
