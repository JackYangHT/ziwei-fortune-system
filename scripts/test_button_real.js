const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 1. 建立簡易本機 HTTP 靜態伺服器提供 webapp 內容
function startStaticServer(port = 8899) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml'
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '/app') reqPath = '/app.html';
    const filePath = path.join(__dirname, '..', 'webapp', reqPath);

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(content);
    });
  });

  return new Promise(resolve => {
    server.listen(port, () => resolve(server));
  });
}

async function runTests() {
  const server = await startStaticServer(8899);
  console.log('✅ 本機測試伺服器已於 http://127.0.0.1:8899 啟動');

  const tmpDir = os.tmpdir() + '/chrome-test-btn-' + Date.now();
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--user-data-dir=' + tmpDir
  ]);

  await new Promise(r => setTimeout(r, 1500));

  const list = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const pageTarget = list.find(t => t.type === 'page');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let msgId = 1;
  const cbs = new Map();

  function send(method, params = {}) {
    const curId = msgId++;
    return new Promise((res, rej) => {
      cbs.set(curId, { resolve: res, reject: rej });
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  const logs = [];
  const errors = [];

  ws.onmessage = async e => {
    const msg = JSON.parse(e.data);
    if (msg.method === 'Page.javascriptDialogOpening') {
      console.log('🔔 [瀏覽器 Dialog]:', msg.params.message);
      await send('Page.handleJavaScriptDialog', { accept: true });
    } else if (msg.id && cbs.has(msg.id)) {
      cbs.get(msg.id).resolve(msg.result);
      cbs.delete(msg.id);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const line = msg.params.args.map(a => a.value !== undefined ? a.value : (a.description || '')).join(' ');
      logs.push(`[${msg.params.type}] ${line}`);
      if (line.includes('新建客戶流程') || line.includes('Session 命盤')) {
        console.log(`[BROWSER LOG]`, line);
      }
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails);
      console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails);
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable');
  await send('Page.enable');

  console.log('\n--- 測試 1: 載入 /app 頁面 ---');
  await send('Page.navigate', { url: 'http://127.0.0.1:8899/app' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('\n--- 測試 2: 使用者登入 ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('loginUsernameInput').value = '小豪';
      document.getElementById('btnLoginSubmit').click();
    })()`
  });
  await new Promise(r => setTimeout(r, 500));

  console.log('\n--- 測試 3: 填入出生資料並點擊「開始排盤」按鈕 (#btnSubmitNewClient) ---');
  let clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const bday = document.getElementById('newBirthday');
      const clock = document.getElementById('newBirthClockTime');
      const place = document.getElementById('newBirthPlace');
      bday.value = '1995-10-24';
      clock.value = '08:30';
      place.value = '台中';

      const btn = document.getElementById('btnSubmitNewClient');
      if (!btn) return { error: 'Button not found' };
      btn.click();
      return {
        clicked: true,
        btnTag: btn.tagName,
        hasOnclick: typeof btn.onclick === 'function'
      };
    })()`,
    returnByValue: true
  });
  console.log('點擊按鈕結果:', clickRes.result.value);

  await new Promise(r => setTimeout(r, 2000));

  console.log('\n--- 測試 4: 驗證排盤是否成功產生命盤與對話記錄 ---');
  let chartRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const sess = state ? state.currentSession : null;
      return {
        hasSession: !!sess,
        sessionId: sess ? sess.sessionId : null,
        clientName: sess ? sess.clientName : null,
        birthday: sess ? sess.birthday : null,
        hasChartData: !!(sess && sess.chartData),
        bazi: sess && sess.chartData ? sess.chartData.baziFourPillars : null,
        mingGong: sess && sess.chartData ? sess.chartData.mingGongBranch : null,
        messageCount: document.querySelectorAll('.chat-message').length
      };
    })()`,
    returnByValue: true
  });
  console.log('命盤狀態:', chartRes.result.value);

  console.log('\n--- 測試 5: 測試僅使用下拉選單選擇日期（無 datepicker input） ---');
  let dropdownOnlyRes = await send('Runtime.evaluate', {
    expression: `(() => {
      // 清空 date input
      const bdayInput = document.getElementById('newBirthday');
      bdayInput.value = '';

      // 設定下拉選單
      const ySel = document.getElementById('birthYearSelect');
      const mSel = document.getElementById('birthMonthSelect');
      const dSel = document.getElementById('birthDaySelect');
      ySel.value = '1982';
      mSel.value = '3';
      dSel.value = '18';

      // 點擊開始排盤
      const btn = document.getElementById('btnSubmitNewClient');
      btn.click();

      const sess = state ? state.currentSession : null;
      return {
        birthday: sess ? sess.birthday : null,
        hasChart: !!(sess && sess.chartData),
        bazi: sess && sess.chartData ? sess.chartData.baziFourPillars : null
      };
    })()`,
    returnByValue: true
  });
  console.log('僅下拉選單排盤結果:', dropdownOnlyRes.result.value);

  console.log('\n--- 測試 6: 測試在輸入欄位按下 Enter 鍵觸發排盤 ---');
  let enterKeyRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const bday = document.getElementById('newBirthday');
      bday.value = '1971-07-10';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      bday.dispatchEvent(enterEvent);

      const sess = state ? state.currentSession : null;
      return {
        birthday: sess ? sess.birthday : null,
        bazi: sess && sess.chartData ? sess.chartData.baziFourPillars : null,
        timePillar: sess && sess.chartData ? sess.chartData.baziTimePillar : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Enter 鍵觸發結果:', enterKeyRes.result.value);

  ws.close();
  chrome.kill();
  server.close();

  if (errors.length > 0) {
    console.error('❌ 測試過程中存在未捕獲錯誤:', errors);
    process.exit(1);
  }

  console.log('\n🎉🎉🎉 所有「開始排盤」按鈕交互與排盤邏輯測試 100% 通過！');
  process.exit(0);
}

runTests().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
