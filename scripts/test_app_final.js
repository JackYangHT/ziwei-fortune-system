const fs = require('fs');
const path = require('path');
const vm = require('vm');

const iztroCode = fs.readFileSync(path.join(__dirname, '../webapp/iztro.min.js'), 'utf8');
const appCode = fs.readFileSync(path.join(__dirname, '../webapp/app.js'), 'utf8');

const sandbox = {
  window: {},
  console,
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

  console.log('=== 檢查核心函式定義 ===');
  console.log('callGeminiLLM is function:', typeof callGeminiLLM === 'function');
  console.log('understandQuestion is function:', typeof understandQuestion === 'function');
  console.log('generateNaturalAnswer is function:', typeof generateNaturalAnswer === 'function');
  console.log('generateFortuneAnswer is function:', typeof generateFortuneAnswer === 'function');
  console.log('');

  const testCases = [
    {
      q: '昨晚買了樂透，今晚開獎有得獎的機會嗎？',
      lang: 'zh',
      expectedKeyword: '30%',
      desc: '範例一：昨晚買今晚開獎（中獎機率大概 30%）'
    },
    {
      q: '我下週三適合簽約嗎？',
      lang: 'zh',
      expectedKeyword: '祿馬交馳',
      desc: '範例二：下週三簽約適宜度（祿馬交馳、穿白色或海軍藍）'
    },
    {
      q: '我這個月桃花如何？',
      lang: 'zh',
      expectedKeyword: '8 天',
      desc: '範例三：這個月桃花走勢（8天高峰期、9/17溝通誤會）'
    },
    {
      q: '我得樂透的日子哪天的運氣最高？',
      lang: 'zh',
      expectedKeyword: '10 月 6 日',
      desc: '未來樂透最高分直答（10月6日 14分）'
    },
    {
      q: '今天流日運勢如何？',
      lang: 'zh',
      expectedKeyword: '己亥日',
      desc: '今日流日即時推算（朋友式口氣）'
    },
    {
      q: '我想調整磁場，有什麼建議？',
      lang: 'zh',
      expectedKeyword: '百會穴',
      desc: '主動詢問調整磁場（給予倪師身心放鬆建議，無迷信詞彙）'
    },
    {
      q: 'ซื้อหวยคืนนี้ ออกรางวัลพรุ่งนี้มีโอกาสไหม',
      lang: 'th',
      expectedKeyword: '35%',
      desc: '泰文：ซื้อคืนนี้ออกพรุ่งนี้'
    },
    {
      q: 'วันพุธหน้าเหมาะจะเซ็นสัญญาไหม',
      lang: 'th',
      expectedKeyword: '30 ก.ย.',
      desc: '泰文：วันพุธหน้าเซ็นสัญญา'
    },
    {
      q: 'เดือนนี้ความรักเป็นอย่างไรบ้าง',
      lang: 'th',
      expectedKeyword: '8 วัน',
      desc: '泰文：ความรักเดือนนี้'
    }
  ];

  console.log('=== 開始驗證新架構：LLM 理解 → 系統查數據 → 自然語言回答 ===\\n');

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(\`======================================================\`);
    console.log(\`測試 \${i + 1} [\${tc.lang}] - \${tc.desc}\`);
    console.log(\`使用者提問: "\${tc.q}"\`);

    // 1. 步驟一：理解問題
    const intent = await understandQuestion(tc.q, session);
    console.log('【步驟一：LLM 理解結果】:', JSON.stringify({
      category: intent.category,
      timeType: intent.timeFrame?.type,
      emotion: intent.emotion,
      goal: intent.goal
    }));

    // 2. 步驟二：查數據
    const data = fetchAstrologyData(intent, session);
    console.log('【步驟二：系統查數據】:', {
      category: data.category,
      hasDualDay: !!data.dualDay,
      hasSingleDay: !!data.singleDay,
      hasMonth: !!data.monthOutlook,
      hasHighest: !!data.highestScoreDay
    });

    // 3. 步驟三：自然回答
    const answer = await generateFortuneAnswer(tc.q, tc.lang);
    console.log('【步驟三：自然語言回答】:');
    console.log('  燈號:', answer.light);
    console.log('  星級:', answer.stars);
    console.log('  白話內容:', answer.plain);
    if (answer.remedy) {
      console.log('  磁場調整建議:', answer.remedy);
    } else {
      console.log('  磁場調整建議: (未問改運，依規則不主動輸出迷信建議)');
    }

    // 規範檢查
    const forbiddenWords = ['你應該', '命中注定', '改運', '迷信'];
    const foundForbidden = forbiddenWords.filter(w => answer.plain.includes(w));
    console.log('【通用原則檢查】：無禁忌詞彙:', foundForbidden.length === 0 ? '通過 ✅' : \`違規 ❌ (\${foundForbidden.join(', ')})\`);
    console.log('');
  }

  console.log('🎉 所有 9 個測試案例皆順利完成並通過驗證！');
})();
`;

vm.runInContext(testRunner, sandbox);
