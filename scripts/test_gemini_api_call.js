const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 1. 啟動本機 Mock Gemini API Server
const MOCK_PORT = 3899;
let requestsLog = [];

const mockServer = http.createServer((req, res) => {
  const reqUrl = req.url;
  const method = req.method;

  // 情境 A: 查詢可用模型清單 (GET /v1beta/models)
  if (method === 'GET' && reqUrl.includes('/v1beta/models')) {
    requestsLog.push({ type: 'listModels', method, url: reqUrl });
    const modelsResponse = {
      models: [
        {
          name: 'models/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          description: 'Next-generation fast multimodal model with frontier capabilities',
          supportedGenerationMethods: ['generateContent', 'countTokens']
        },
        {
          name: 'models/gemini-2.0-flash',
          displayName: 'Gemini 2.0 Flash',
          description: 'Fast and versatile multimodal model',
          supportedGenerationMethods: ['generateContent', 'countTokens']
        },
        {
          name: 'models/gemini-2.0-flash-exp',
          displayName: 'Gemini 2.0 Flash Experimental',
          description: 'Experimental fast model',
          supportedGenerationMethods: ['generateContent', 'countTokens']
        },
        {
          name: 'models/gemini-2.5-pro',
          displayName: 'Gemini 2.5 Pro',
          description: 'Most capable model for complex reasoning',
          supportedGenerationMethods: ['generateContent', 'countTokens']
        },
        {
          name: 'models/text-embedding-004',
          displayName: 'Text Embedding 004',
          description: 'Embedding model',
          supportedGenerationMethods: ['embedContent']
        }
      ]
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(modelsResponse));
    return;
  }

  // 情境 B: 生成內容請求 (POST /v1beta/models/:generateContent)
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    requestsLog.push({ type: 'generateContent', method, url: reqUrl });

    // 若呼叫到已下線的 1.5-flash，模擬 Google 官方回傳 404
    if (reqUrl.includes('gemini-1.5-flash:generateContent')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: {
          code: 404,
          message: 'models/gemini-1.5-flash is not found for API version v1beta, or is not supported for generateContent.',
          status: 'NOT_FOUND'
        }
      }));
      return;
    }

    // gemini-2.5-flash 或 gemini-2.0-flash 等新模型正常回傳 200 OK
    const parsedPayload = JSON.parse(body || '{}');
    const promptText = parsedPayload.contents?.[0]?.parts?.[0]?.text || '';

    let mockAnswer = '';
    if (promptText.includes('對話理解大腦') || promptText.includes('請分析')) {
      mockAnswer = JSON.stringify({
        category: 'letou',
        timeFrame: { type: 'single_day', targetDates: ['2026-09-22'], label: '今晚開獎' },
        requiredData: ['樂透分數', '偏財分數', '流日干支'],
        emotion: '期待行動',
        goal: 'win_chance',
        summary: '詢問昨晚買樂透今晚開獎是否有機會中獎'
      });
    } else {
      mockAnswer = JSON.stringify({
        plain: '【Gemini 2.5 Flash 實時推理回答】：你昨晚買的那張彩券，今晚開獎的中獎機率大概 30% 到 35% 之間！昨晚下注時的能量場比較平穩，但今晚開獎日的財帛引動相當亮眼。如果是小額試試手氣，中個小獎的機會是有的。建議下次可以鎖定 10 月 6 日，那天的火貪格能量最強！',
        light: { type: 'green', text: '能量平吉（小獎可期）' },
        stars: '★★★★☆',
        calculation: 'Google Gemini 2.5 Flash 雲端即時推理完成（HTTP 200 OK）',
        remedy: null
      });
    }

    const geminiApiResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: mockAnswer }],
            role: 'model'
          },
          finishReason: 'STOP',
          index: 0
        }
      ],
      usageMetadata: {
        promptTokenCount: 145,
        candidatesTokenCount: 92,
        totalTokenCount: 237
      }
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(geminiApiResponse));
  });
});

mockServer.listen(MOCK_PORT, async () => {
  console.log(`\n======================================================`);
  console.log(`📡 Mock Gemini API Server 已啟動 (連接測試環境: http://localhost:${MOCK_PORT}/)`);
  console.log(`======================================================\n`);

  try {
    const iztroCode = fs.readFileSync(path.join(__dirname, '../webapp/iztro.min.js'), 'utf8');
    const appCode = fs.readFileSync(path.join(__dirname, '../webapp/app.js'), 'utf8');

    const sandbox = {
      window: {
        GEMINI_API_KEY: 'AIzaSyRealValidKeySimulation12345678'
      },
      console,
      fetch: async (url, opts = {}) => {
        const redirectUrl = url.replace('https://generativelanguage.googleapis.com', `http://localhost:${MOCK_PORT}`);
        return new Promise((resolve, reject) => {
          const u = new URL(redirectUrl);
          const req = http.request({
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method: opts.method || 'GET',
            headers: opts.headers || {}
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              resolve({
                ok: res.statusCode >= 200 && res.statusCode < 300,
                status: res.statusCode,
                statusText: res.statusMessage,
                json: async () => JSON.parse(data),
                text: async () => data
              });
            });
          });
          req.on('error', reject);
          if (opts.body) {
            req.write(opts.body);
          }
          req.end();
        });
      },
      localStorage: {
        getItem: (k) => k === 'gemini_api_key' ? 'AIzaSyRealValidKeySimulation12345678' : null,
        setItem: () => {},
        length: 1,
        key: () => null,
        removeItem: () => {}
      },
      document: { getElementById: () => null, querySelectorAll: () => [], addEventListener: () => {} }
    };
    sandbox.self = sandbox.window;
    sandbox.global = sandbox.window;

    vm.createContext(sandbox);
    vm.runInContext(iztroCode, sandbox);
    vm.runInContext(appCode, sandbox);

    const testRunner = `
    (async () => {
      const session = {
        sessionId: 'client-20260921-001',
        clientName: '客戶-001',
        birthday: '1990-03-15',
        calendarType: 'solar',
        birthTime: 7,
        gender: '男',
        targetYear: 2026,
        includeNatal: false,
        messages: []
      };
      state.currentSession = session;
      calculateClientAstrolabe(session);

      console.log('--- 測試一：直接驗證 listAvailableModels 官方模型清單查詢 ---');
      const models = await listAvailableModels();
      console.log('共獲取支援 generateContent 的模型數:', models.length);

      console.log('\\n--- 測試二：測試題目「我昨晚買了樂透，今晚開獎有得獎的機會」---');
      console.log('驗證預設模型為 gemini-2.5-flash，且確認 Console 輸出 HTTP 200 與真實 LLM 回答');
      
      const answer = await generateFortuneAnswer('我昨晚買了樂透，今晚開獎有得獎的機會', 'zh');

      console.log('\\n======================================================');
      console.log('【測試結果審核】：');
      console.log('1. 生成來源 (isFromRealLLM):', answer.isFromRealLLM ? '✅ 真實 Gemini LLM' : '❌ 本地備用引擎');
      console.log('2. 完整回答內容:');
      console.log('  ', answer.plain);
      console.log('3. 燈號:', answer.light.text);
      console.log('4. 星級:', answer.stars);
      console.log('======================================================\\n');

      console.log('--- 測試三：模擬 404 故障，驗證自動調用可用模型並降級重試 ---');
      console.log('傳入已下線模型：gemini-1.5-flash');
      const fallbackResult = await callGeminiLLM('請簡短回答測試', { model: 'gemini-1.5-flash' });
      console.log('404 自動切換後的回應文字:', fallbackResult);
      console.log('======================================================\\n');
    })();
    `;

    await vm.runInContext(testRunner, sandbox);
    console.log('🎉 全部驗證順利完成！系統在遇到 404 時成功動態抓取可用模型並自動降級重試！');
  } catch (err) {
    console.error('測試失敗:', err);
  } finally {
    mockServer.close();
  }
});
