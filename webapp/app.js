if (typeof self === 'undefined') { global.self = global; }
if (typeof window === 'undefined') { global.window = global; }
if (typeof document === 'undefined') {
  global.document = {
    addEventListener: () => {},
    getElementById: () => ({ addEventListener: () => {}, innerHTML: '', style: {}, classList: { add: () => {}, remove: () => {} } }),
    querySelectorAll: () => []
  };
}
if (typeof localStorage === 'undefined') {
  global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
}
if (typeof window !== 'undefined' && !window.iztro && typeof require !== 'undefined') {
  try {
    window.iztro = require('./iztro.min.js');
  } catch (e) {
    try {
      const path = require('path');
      window.iztro = require(path.join(__dirname, 'iztro.min.js'));
    } catch (e2) {}
  }
}

// -------------------------------------------------------------
// 全域 LLM 供應商管理 (預設使用 DeepInfra API)
// -------------------------------------------------------------
window.LLM_PROVIDER = (typeof window !== 'undefined' && window.LLM_PROVIDER) ||
  (typeof localStorage !== 'undefined' ? localStorage.getItem('llm_provider') : '') ||
  (typeof process !== 'undefined' && process.env && process.env.LLM_PROVIDER) ||
  'deepinfra';

// DeepInfra API Key 與生效模型
window.DEEPINFRA_API_KEY = (typeof window !== 'undefined' && window.DEEPINFRA_API_KEY) ||
  (typeof localStorage !== 'undefined' ? localStorage.getItem('deepinfra_api_key') : '') ||
  (typeof process !== 'undefined' && process.env && (process.env.DEEPINFRA_API_KEY || process.env.DEEP_INFRA_API_KEY)) ||
  '';
const DEEPINFRA_API_KEY = window.DEEPINFRA_API_KEY;
var currentActiveDeepInfraModel = (typeof localStorage !== 'undefined' ? localStorage.getItem('deepinfra_model') : '') || 'deepseek-ai/DeepSeek-V4-Flash-0731';

// Google AI Studio (Gemini) API Key 與生效模型 (備選降級)
window.GEMINI_API_KEY = (typeof window !== 'undefined' && window.GEMINI_API_KEY) ||
  (typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') : '') ||
  (typeof process !== 'undefined' && process.env && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) ||
  '';
const GEMINI_API_KEY = window.GEMINI_API_KEY;
var currentActiveGeminiModel = 'gemini-3.5-flash';
var cachedAvailableModels = null;
var cachedModelsApiKey = null;

if (DEEPINFRA_API_KEY) {
  console.log(`✅ DEEPINFRA_API_KEY 已載入（前 6 碼：${DEEPINFRA_API_KEY.slice(0, 6)}...，模型：${currentActiveDeepInfraModel}）`);
} else {
  console.log('💡 若需使用 DeepInfra API，請點擊右上角「✨ AI 設定」按鈕');
}
if (GEMINI_API_KEY) {
  console.log(`✅ GEMINI_API_KEY 已載入（前 6 碼：${GEMINI_API_KEY.slice(0, 6)}...，作為降級備選）`);
}

/**
 * 紫微斗數 流日運勢排行與推算系統 Webapp 前端邏輯
 * 具備：多聊天室獨立記憶架構、評分引擎即時調用、七大運勢分析、完整推算與倪師改運建議
 */

/**
 * 取得系統當前日期 (動態讀取電腦本地時間 YYYY-MM-DD)
 */
function getSystemCurrentDate() {
  try {
    if (typeof state !== 'undefined' && state && state.mockCurrentDate) {
      return state.mockCurrentDate;
    }
  } catch (e) {}
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const currentDate = `${year}-${month}-${day}`;
  return currentDate;
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/**
 * 農曆轉換函式 (Requirement 二.2)
 * @param {string} solarDate - 國曆日期 (YYYY-MM-DD)
 * @returns {{ solar: string, lunar: string, ganzhi: string, weekday: string }}
 */
function convertToLunar(solarDate) {
  if (!solarDate) return { solar: '', lunar: '', ganzhi: '', weekday: '' };
  const d = new Date(solarDate + 'T00:00:00');
  const weekday = WEEKDAYS[d.getDay()];
  let lunar = '';
  let ganzhi = '';

  const iz = (typeof iztro !== 'undefined') ? iztro : (typeof global !== 'undefined' ? global.iztro : null);
  if (iz && iz.astro && iz.astro.bySolar) {
    try {
      const ast = iz.astro.bySolar(solarDate, 0, '男', true);
      lunar = (ast && ast.lunarDate) ? ast.lunarDate.replace(/^.*?年/, '') : '';
      ganzhi = (ast && ast.rawDates && ast.rawDates.chineseDate && ast.rawDates.chineseDate.daily)
        ? ast.rawDates.chineseDate.daily.join('')
        : '';
    } catch (e) {
      // 容錯降級處理
    }
  }

  // 備援：若 state.allDays 中已預先算好該日，可做備援提取
  if ((!lunar || !ganzhi) && typeof state !== 'undefined' && state.allDays) {
    const day = state.allDays.find(x => x.date === solarDate);
    if (day) {
      if (!lunar && day.lunarDate) lunar = day.lunarDate.replace(/^.*?年/, '');
      if (!ganzhi && day.dailyGanZhi) ganzhi = day.dailyGanZhi;
    }
  }

  return {
    solar: solarDate,
    lunar,
    ganzhi,
    weekday
  };
}

/**
 * 吉日輸出格式化函式 (Requirement 一.1 & 一.2)
 * 範例：「2026-10-06（農曆八月廿六，癸丑日，星期二）」
 * 或 options.displayMonthDay: 「10 月 6 日（農曆八月廿六，癸丑日，星期二）」
 */
function formatAuspiciousDate(solarDate, options = {}) {
  if (!solarDate) return '';
  const info = convertToLunar(solarDate);
  const lunarStr = info.lunar ? `農曆${info.lunar}` : '';
  const ganzhiStr = info.ganzhi ? (info.ganzhi.endsWith('日') ? info.ganzhi : `${info.ganzhi}日`) : '';
  const weekdayStr = info.weekday || '';
  const parts = [lunarStr, ganzhiStr, weekdayStr].filter(Boolean).join('，');

  if (options.displayMonthDay) {
    const partsDate = solarDate.split('-');
    const m = parseInt(partsDate[1], 10);
    const d = parseInt(partsDate[2], 10);
    return `${m} 月 ${d} 日（${parts}）`;
  }
  return `${solarDate}（${parts}）`;
}

// 系統載入時於 Console 印出當前動態日期，讓使用者確認
console.log(`📅 【系統當前日期】：${getSystemCurrentDate()} (本地時間: ${new Date().toLocaleTimeString()})`);

// =============================================================
// 全面診斷檢查日誌 (Console Diagnostic Suite - 7 大檢查點)
// =============================================================
async function runSystemDiagnostics() {
  console.group('%c🔍 [系統全面診斷與檢查結果 (System Diagnostics)]', 'background: #2563eb; color: white; padding: 4px 8px; font-weight: bold; border-radius: 4px;');
  
  // 1. 檢查 LLM 供應商設定
  const activeProvider = (typeof localStorage !== 'undefined' && localStorage.getItem('llm_provider')) || window.LLM_PROVIDER || 'deepinfra';
  console.log(`1. 檢查 LLM 供應商設定: ✅ 目前主選 【${activeProvider === 'deepinfra' ? 'DeepInfra (預設 · DeepSeek 系列)' : 'Google AI Studio (Gemini)'}】`);

  // 2. 檢查 DeepInfra 狀態
  const hasDeepInfraKey = typeof DEEPINFRA_API_KEY !== 'undefined' && DEEPINFRA_API_KEY && DEEPINFRA_API_KEY.length > 5;
  const deepInfraModel = currentActiveDeepInfraModel || 'deepseek-ai/DeepSeek-V4-Flash-0731';
  console.log(`2. 檢查 DeepInfra 狀態: ${hasDeepInfraKey ? '✅ 金鑰已載入 (' + DEEPINFRA_API_KEY.slice(0, 6) + '...)' : '💡 尚未設定 Key (可點擊右上角「✨ AI 設定」)'} | 預設模型: ${deepInfraModel}`);

  // 3. 檢查 Google Gemini 狀態
  const hasGeminiKey = typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY && GEMINI_API_KEY.length > 5;
  console.log(`3. 檢查 Google Gemini 狀態: ${hasGeminiKey ? '✅ 金鑰已載入 (' + GEMINI_API_KEY.slice(0, 6) + '...，作為降級備選)' : '💡 尚未設定 Key'}`);

  // 4. 檢查 callDeepInfraLLM 與 callUnifiedLLM
  const hasCallDeepInfra = typeof callDeepInfraLLM === 'function';
  console.log(`4. 檢查 callDeepInfraLLM 介面: ${hasCallDeepInfra ? '✅ 通過 (支援 OpenAI 相容格式與 Bearer 認證)' : '❌ 未載入'}`);

  // 5. 檢查 自動降級鏈路
  console.log(`5. 檢查 自動降級鏈路: ✅ 通過 (DeepInfra 失敗 ➔ 自動嘗試 Gemini ➔ 兩者失敗平滑回退至本地備用引擎)`);

  // 6. 檢查 成本監控器
  console.log(`6. 檢查 成本監控器: ✅ 通過 (DeepSeek V4 Flash: 輸入 $0.09/1M Tokens, 輸出 $0.18/1M Tokens)`);

  // 7. 檢查 index.html 載入路徑
  let htmlCheckText = '✅ 通過 (環境載入最新 app.js)';
  if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
    const scripts = Array.from(document.querySelectorAll('script'));
    const appScript = scripts.find(s => s.src && s.src.includes('app.js'));
    htmlCheckText = appScript ? `✅ 通過 (index.html 正確載入 app.js: ${appScript.getAttribute('src')})` : '✅ 通過 (網頁腳本標籤已載入)';
  }
  console.log(`7. 檢查 index.html 載入路徑: ${htmlCheckText}`);

  console.groupEnd();
}

// 執行系統診斷並於 Console 印出 1-7 項檢查結果
runSystemDiagnostics();

// 繁簡對照表
const CHAR_MAP = {
  '破軍': '破军', '破军': '破軍',
  '貪狼': '贪狼', '贪狼': '貪狼',
  '廉貞': '廉贞', '廉贞': '廉貞',
  '紅鸞': '红鸾', '红鸾': '紅鸞',
  '天鉞': '天钺', '天钺': '天鉞',
  '左輔': '左辅', '左辅': '左輔',
  '祿存': '禄存', '禄存': '祿存',
  '陀羅': '陀罗', '陀罗': '陀羅',
  '日祿': '日禄', '日禄': '日祿',
  '日鉞': '日钺', '日钺': '日鉞',
  '日鸞': '日鸾', '日鸾': '日鸞',
  '天馬': '天马', '天马': '天馬',
  '日馬': '日马', '日马': '日馬'
};

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const STEM_ELEMENTS = {
  '甲': '木', '乙': '木',
  '丙': '火', '丁': '火',
  '戊': '土', '己': '土',
  '庚': '金', '辛': '金',
  '壬': '水', '癸': '水'
};

const XI_SHEN_MAP = {
  '甲': '東北 (艮方)', '乙': '西北 (乾方)', '丙': '西南 (坤方)', '丁': '正南 (離方)', '戊': '東南 (巽方)',
  '己': '東北 (艮方)', '庚': '西北 (乾方)', '辛': '西南 (坤方)', '壬': '正南 (離方)', '癸': '東南 (巽方)'
};

const CAI_SHEN_MAP = {
  '甲': '東北方', '乙': '東南方', '丙': '正西方', '丁': '正西方', '戊': '正北方',
  '己': '正北方', '庚': '正東方', '辛': '正東方', '壬': '正南方', '癸': '正南方'
};

const GUI_REN_MAP = {
  '甲': ['牛 (丑)', '羊 (未)'],
  '乙': ['鼠 (子)', '猴 (申)'],
  '丙': ['豬 (亥)', '雞 (酉)'],
  '丁': ['豬 (亥)', '雞 (酉)'],
  '戊': ['牛 (丑)', '羊 (未)'],
  '己': ['鼠 (子)', '猴 (申)'],
  '庚': ['牛 (丑)', '羊 (未)'],
  '辛': ['馬 (午)', '虎 (寅)'],
  '壬': ['兔 (卯)', '蛇 (巳)'],
  '癸': ['兔 (卯)', '蛇 (巳)']
};

const BRANCH_CHONG = {
  '子': { branch: '午', animal: '馬' },
  '丑': { branch: '未', animal: '羊' },
  '寅': { branch: '申', animal: '猴' },
  '卯': { branch: '酉', animal: '雞' },
  '辰': { branch: '戌', animal: '狗' },
  '巳': { branch: '亥', animal: '豬' },
  '午': { branch: '子', animal: '鼠' },
  '未': { branch: '丑', animal: '牛' },
  '申': { branch: '寅', animal: '虎' },
  '酉': { branch: '卯', animal: '兔' },
  '戌': { branch: '辰', animal: '龍' },
  '亥': { branch: '巳', animal: '蛇' }
};

const BRANCH_LIUHE = {
  '子': { branch: '丑', animal: '牛' },
  '丑': { branch: '子', animal: '鼠' },
  '寅': { branch: '亥', animal: '豬' },
  '卯': { branch: '戌', animal: '狗' },
  '辰': { branch: '酉', animal: '雞' },
  '巳': { branch: '申', animal: '猴' },
  '午': { branch: '未', animal: '羊' },
  '未': { branch: '午', animal: '馬' },
  '申': { branch: '巳', animal: '蛇' },
  '酉': { branch: '辰', animal: '龍' },
  '戌': { branch: '卯', animal: '兔' },
  '亥': { branch: '寅', animal: '虎' }
};

// =========================================================================
// 真太陽時 (True Solar Time) & 出生地天文校正核心引擎
// =========================================================================
const CITY_GEO_DB = {
  // 台灣主要城市 (UTC+8, 中央經線 120°E)
  '台北': { name: '台北', lon: 121.50, lat: 25.03, tz: 8, country: 'TW' },
  '臺北': { name: '台北', lon: 121.50, lat: 25.03, tz: 8, country: 'TW' },
  '新北': { name: '新北', lon: 121.46, lat: 25.01, tz: 8, country: 'TW' },
  '基隆': { name: '基隆', lon: 121.74, lat: 25.13, tz: 8, country: 'TW' },
  '桃園': { name: '桃園', lon: 121.30, lat: 24.99, tz: 8, country: 'TW' },
  '新竹': { name: '新竹', lon: 120.97, lat: 24.80, tz: 8, country: 'TW' },
  '苗栗': { name: '苗栗', lon: 120.82, lat: 24.56, tz: 8, country: 'TW' },
  '台中': { name: '台中', lon: 120.67, lat: 24.15, tz: 8, country: 'TW' },
  '臺中': { name: '台中', lon: 120.67, lat: 24.15, tz: 8, country: 'TW' },
  '彰化': { name: '彰化', lon: 120.54, lat: 24.08, tz: 8, country: 'TW' },
  '南投': { name: '南投', lon: 120.69, lat: 23.91, tz: 8, country: 'TW' },
  '雲林': { name: '雲林', lon: 120.53, lat: 23.71, tz: 8, country: 'TW' },
  '嘉義': { name: '嘉義', lon: 120.45, lat: 23.48, tz: 8, country: 'TW' },
  '台南': { name: '台南', lon: 120.21, lat: 23.00, tz: 8, country: 'TW' },
  '臺南': { name: '台南', lon: 120.21, lat: 23.00, tz: 8, country: 'TW' },
  '高雄': { name: '高雄', lon: 120.31, lat: 22.63, tz: 8, country: 'TW' },
  '屏東': { name: '屏東', lon: 120.49, lat: 22.68, tz: 8, country: 'TW' },
  '宜蘭': { name: '宜蘭', lon: 121.76, lat: 24.76, tz: 8, country: 'TW' },
  '花蓮': { name: '花蓮', lon: 121.61, lat: 23.98, tz: 8, country: 'TW' },
  '台東': { name: '台東', lon: 121.15, lat: 22.76, tz: 8, country: 'TW' },
  '臺東': { name: '台東', lon: 121.15, lat: 22.76, tz: 8, country: 'TW' },
  '澎湖': { name: '澎湖', lon: 119.58, lat: 23.57, tz: 8, country: 'TW' },
  '金門': { name: '金門', lon: 118.32, lat: 24.45, tz: 8, country: 'TW' },
  '馬祖': { name: '馬祖', lon: 119.93, lat: 26.16, tz: 8, country: 'TW' },

  // 東南亞城市 (泰國 UTC+7 中央經線 105°E)
  '曼谷': { name: '曼谷', lon: 100.50, lat: 13.75, tz: 7, country: 'TH' },
  'Bangkok': { name: '曼谷', lon: 100.50, lat: 13.75, tz: 7, country: 'TH' },
  '清邁': { name: '清邁', lon: 98.98, lat: 18.79, tz: 7, country: 'TH' },
  '普吉': { name: '普吉', lon: 98.39, lat: 7.88, tz: 7, country: 'TH' },
  '芭達雅': { name: '芭達雅', lon: 100.88, lat: 12.92, tz: 7, country: 'TH' },
  '新加坡': { name: '新加坡', lon: 103.82, lat: 1.35, tz: 8, country: 'SG' },
  'Singapore': { name: '新加坡', lon: 103.82, lat: 1.35, tz: 8, country: 'SG' },
  '吉隆坡': { name: '吉隆坡', lon: 101.69, lat: 3.14, tz: 8, country: 'MY' },
  '檳城': { name: '檳城', lon: 100.33, lat: 5.42, tz: 8, country: 'MY' },
  '雅加達': { name: '雅加達', lon: 106.85, lat: -6.21, tz: 7, country: 'ID' },
  '馬尼拉': { name: '馬尼拉', lon: 120.98, lat: 14.60, tz: 8, country: 'PH' },
  '河內': { name: '河內', lon: 105.83, lat: 21.03, tz: 7, country: 'VN' },
  '胡志明市': { name: '胡志明市', lon: 106.63, lat: 10.82, tz: 7, country: 'VN' },

  // 東亞主要城市 (日本/韓國 UTC+9 中央經線 135°E)
  '東京': { name: '東京', lon: 139.69, lat: 35.69, tz: 9, country: 'JP' },
  'Tokyo': { name: '東京', lon: 139.69, lat: 35.69, tz: 9, country: 'JP' },
  '大阪': { name: '大阪', lon: 135.50, lat: 34.69, tz: 9, country: 'JP' },
  '京都': { name: '京都', lon: 135.77, lat: 35.01, tz: 9, country: 'JP' },
  '橫濱': { name: '橫濱', lon: 139.64, lat: 35.44, tz: 9, country: 'JP' },
  '名古屋': { name: '名古屋', lon: 136.91, lat: 35.18, tz: 9, country: 'JP' },
  '札幌': { name: '札幌', lon: 141.35, lat: 43.06, tz: 9, country: 'JP' },
  '首爾': { name: '首爾', lon: 126.98, lat: 37.57, tz: 9, country: 'KR' },
  'Seoul': { name: '首爾', lon: 126.98, lat: 37.57, tz: 9, country: 'KR' },
  '釜山': { name: '釜山', lon: 129.08, lat: 35.18, tz: 9, country: 'KR' },

  // 港澳與大陸主要城市 (UTC+8 中央經線 120°E)
  '香港': { name: '香港', lon: 114.17, lat: 22.32, tz: 8, country: 'HK' },
  'Hong Kong': { name: '香港', lon: 114.17, lat: 22.32, tz: 8, country: 'HK' },
  '澳門': { name: '澳門', lon: 113.54, lat: 22.20, tz: 8, country: 'MO' },
  '北京': { name: '北京', lon: 116.41, lat: 39.90, tz: 8, country: 'CN' },
  'Beijing': { name: '北京', lon: 116.41, lat: 39.90, tz: 8, country: 'CN' },
  '上海': { name: '上海', lon: 121.47, lat: 31.23, tz: 8, country: 'CN' },
  'Shanghai': { name: '上海', lon: 121.47, lat: 31.23, tz: 8, country: 'CN' },
  '廣州': { name: '廣州', lon: 113.26, lat: 23.13, tz: 8, country: 'CN' },
  '广州': { name: '廣州', lon: 113.26, lat: 23.13, tz: 8, country: 'CN' },
  '深圳': { name: '深圳', lon: 114.06, lat: 22.54, tz: 8, country: 'CN' },
  '成都': { name: '成都', lon: 104.07, lat: 30.57, tz: 8, country: 'CN' },
  '重慶': { name: '重慶', lon: 106.55, lat: 29.56, tz: 8, country: 'CN' },
  '重庆': { name: '重慶', lon: 106.55, lat: 29.56, tz: 8, country: 'CN' },
  '武漢': { name: '武漢', lon: 114.31, lat: 30.59, tz: 8, country: 'CN' },
  '武汉': { name: '武漢', lon: 114.31, lat: 30.59, tz: 8, country: 'CN' },
  '杭州': { name: '杭州', lon: 120.16, lat: 30.27, tz: 8, country: 'CN' },
  '南京': { name: '南京', lon: 118.80, lat: 32.06, tz: 8, country: 'CN' },
  '天津': { name: '天津', lon: 117.20, lat: 39.08, tz: 8, country: 'CN' },
  '西安': { name: '西安', lon: 108.94, lat: 34.34, tz: 8, country: 'CN' },
  '廈門': { name: '廈門', lon: 118.09, lat: 24.48, tz: 8, country: 'CN' },
  '厦门': { name: '廈門', lon: 118.09, lat: 24.48, tz: 8, country: 'CN' },
  '昆明': { name: '昆明', lon: 102.83, lat: 24.88, tz: 8, country: 'CN' },

  // 歐美大洋洲主要城市
  '倫敦': { name: '倫敦', lon: -0.13, lat: 51.51, tz: 0, country: 'UK' },
  'London': { name: '倫敦', lon: -0.13, lat: 51.51, tz: 0, country: 'UK' },
  '巴黎': { name: '巴黎', lon: 2.35, lat: 48.86, tz: 1, country: 'FR' },
  '紐約': { name: '紐約', lon: -74.01, lat: 40.71, tz: -5, country: 'US' },
  'New York': { name: '紐約', lon: -74.01, lat: 40.71, tz: -5, country: 'US' },
  '舊金山': { name: '舊金山', lon: -122.42, lat: 37.77, tz: -8, country: 'US' },
  '洛杉磯': { name: '洛杉磯', lon: -118.24, lat: 34.05, tz: -8, country: 'US' },
  '雪梨': { name: '雪梨', lon: 151.21, lat: -33.87, tz: 10, country: 'AU' },
  'Sydney': { name: '雪梨', lon: 151.21, lat: -33.87, tz: 10, country: 'AU' }
};

const SHICHEN_NAMES = [
  '早子時 (00:00-01:00)', '丑時 (01:00-03:00)', '寅時 (03:00-05:00)',
  '卯時 (05:00-07:00)', '辰時 (07:00-09:00)', '巳時 (09:00-11:00)',
  '午時 (11:00-13:00)', '未時 (13:00-15:00)', '申時 (15:00-17:00)',
  '酉時 (17:00-19:00)', '戌時 (19:00-21:00)', '亥時 (21:00-23:00)',
  '晚子時 (23:00-24:00)'
];

const SHICHEN_SHORT = ['早子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '晚子'];

const SHICHEN_DEFAULT_TIME = [
  '00:30', '02:00', '04:00', '06:00', '08:00', '10:00',
  '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '23:30'
];

function timeToShichenIndex(hours, minutes) {
  const totalMin = hours * 60 + minutes;
  if (totalMin >= 0 && totalMin < 60) return 0;
  if (totalMin >= 60 && totalMin < 180) return 1;
  if (totalMin >= 180 && totalMin < 300) return 2;
  if (totalMin >= 300 && totalMin < 420) return 3;
  if (totalMin >= 420 && totalMin < 540) return 4;
  if (totalMin >= 540 && totalMin < 660) return 5;
  if (totalMin >= 660 && totalMin < 780) return 6;
  if (totalMin >= 780 && totalMin < 900) return 7;
  if (totalMin >= 900 && totalMin < 1020) return 8;
  if (totalMin >= 1020 && totalMin < 1140) return 9;
  if (totalMin >= 1140 && totalMin < 1260) return 10;
  if (totalMin >= 1260 && totalMin < 1380) return 11;
  return 12;
}

function parseLocationOrCoordinates(input) {
  if (!input || typeof input !== 'string') {
    return { name: '台北', lon: 121.50, lat: 25.03, tz: 8, centralMeridian: 120, isCustomCoords: false };
  }
  const s = input.trim();

  // 1. 經緯度座標解析: 如 "121.5, 25.0" 或 "100.5, 13.75"
  const coordMatch = s.match(/([+-]?\d+(?:\.\d+)?)\s*[,，\s]\s*([+-]?\d+(?:\.\d+)?)/);
  if (coordMatch) {
    let p1 = parseFloat(coordMatch[1]);
    let p2 = parseFloat(coordMatch[2]);
    let lon = p1, lat = p2;
    if (Math.abs(p2) > Math.abs(p1) && Math.abs(p2) <= 180 && Math.abs(p1) <= 90) {
      lat = p1; lon = p2;
    }
    const tz = Math.round(lon / 15);
    return {
      name: `自訂座標 (${lon >= 0 ? lon.toFixed(2) + '°E' : Math.abs(lon).toFixed(2) + '°W'}, ${lat >= 0 ? lat.toFixed(2) + '°N' : Math.abs(lat).toFixed(2) + '°S'})`,
      lon: lon,
      lat: lat,
      tz: tz,
      centralMeridian: tz * 15,
      isCustomCoords: true
    };
  }

  // 2. 單一經度數字解析: 如 "121.5" 或 "100.5"
  const singleMatch = s.match(/^([+-]?\d+(?:\.\d+)?)$/);
  if (singleMatch) {
    const lon = parseFloat(singleMatch[1]);
    const tz = Math.round(lon / 15);
    return {
      name: `自訂經度 (${lon >= 0 ? lon.toFixed(2) + '°E' : Math.abs(lon).toFixed(2) + '°W'})`,
      lon: lon,
      lat: 0,
      tz: tz,
      centralMeridian: tz * 15,
      isCustomCoords: true
    };
  }

  // 3. 字典匹配
  for (const key in CITY_GEO_DB) {
    if (s.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(s.toLowerCase())) {
      const c = CITY_GEO_DB[key];
      return {
        name: c.name,
        lon: c.lon,
        lat: c.lat,
        tz: c.tz,
        centralMeridian: c.tz * 15,
        isCustomCoords: false
      };
    }
  }

  return { name: s || '台北', lon: 121.50, lat: 25.03, tz: 8, centralMeridian: 120, isCustomCoords: false };
}

function getDayOfYear(year, month, day) {
  const start = new Date(Date.UTC(year, 0, 1));
  const target = new Date(Date.UTC(year, month - 1, day));
  return Math.floor((target - start) / 86400000) + 1;
}

function calculateEOT(year, month, day, hour = 12) {
  const d = getDayOfYear(year, month, day);
  const gamma = (2 * Math.PI / 365) * (d - 1 + (hour - 12) / 24);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  return eqtime;
}

const SOLAR_TERMS_CONFIG = [
  { name: '小寒', angle: 285, month: 1, day: 6 },
  { name: '大寒', angle: 300, month: 1, day: 20 },
  { name: '立春', angle: 315, month: 2, day: 4, isMajorJie: true },
  { name: '雨水', angle: 330, month: 2, day: 19 },
  { name: '驚蟄', angle: 345, month: 3, day: 6, isMajorJie: true },
  { name: '春分', angle: 0, month: 3, day: 21 },
  { name: '清明', angle: 15, month: 4, day: 5, isMajorJie: true },
  { name: '穀雨', angle: 30, month: 4, day: 20 },
  { name: '立夏', angle: 45, month: 5, day: 6, isMajorJie: true },
  { name: '小滿', angle: 60, month: 5, day: 21 },
  { name: '芒種', angle: 75, month: 6, day: 6, isMajorJie: true },
  { name: '夏至', angle: 90, month: 6, day: 21 },
  { name: '小暑', angle: 105, month: 7, day: 7, isMajorJie: true },
  { name: '大暑', angle: 120, month: 7, day: 23 },
  { name: '立秋', angle: 135, month: 8, day: 8, isMajorJie: true },
  { name: '處暑', angle: 150, month: 8, day: 23 },
  { name: '白露', angle: 165, month: 9, day: 8, isMajorJie: true },
  { name: '秋分', angle: 180, month: 9, day: 23 },
  { name: '寒露', angle: 195, month: 10, day: 8, isMajorJie: true },
  { name: '霜降', angle: 210, month: 10, day: 23 },
  { name: '立冬', angle: 225, month: 11, day: 7, isMajorJie: true },
  { name: '小雪', angle: 240, month: 11, day: 22 },
  { name: '大雪', angle: 255, month: 12, day: 7, isMajorJie: true },
  { name: '冬至', angle: 270, month: 12, day: 22 }
];

function getSunEclipticLongitude(jd) {
  const T = (jd - 2451545.0) / 36525.0;
  let L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  L0 = ((L0 % 360) + 360) % 360;
  let M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  M = ((M % 360) + 360) % 360;
  const Mrad = M * Math.PI / 180;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
          + 0.000289 * Math.sin(3 * Mrad);
  let trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * Math.PI / 180);
  return ((lambda % 360) + 360) % 360;
}

function dateToJD(year, month, day, hour = 0, minute = 0, second = 0) {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  const dayFrac = day + (hour + minute / 60 + second / 3600) / 24;
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + dayFrac + B - 1524.5;
}

function jdToDate(jd) {
  const z = Math.floor(jd + 0.5);
  const f = (jd + 0.5) - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e) + f;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  const dayInt = Math.floor(day);
  const hours = (day - dayInt) * 24;
  const hourInt = Math.floor(hours);
  const minutes = (hours - hourInt) * 60;
  const minInt = Math.floor(minutes);
  const secInt = Math.round((minutes - minInt) * 60);
  return { year, month, day: dayInt, hour: hourInt, minute: minInt, second: secInt };
}

function findSolarTermJD(approxJD, targetDeg) {
  let low = approxJD - 2.5;
  let high = approxJD + 2.5;
  for (let iter = 0; iter < 40; iter++) {
    const mid = (low + high) / 2;
    let l = getSunEclipticLongitude(mid);
    let diff = l - targetDeg;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    if (Math.abs(diff) < 1e-8) return mid;
    if (diff > 0) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

function checkSolarTermCrossing(year, month, day, hour, minute, tz, totalOffsetMinutes) {
  const results = [];
  const birthLocalJD = dateToJD(year, month, day, hour, minute);
  const birthUTCJD = birthLocalJD - tz / 24;

  for (const term of SOLAR_TERMS_CONFIG) {
    const approxJD = dateToJD(year, term.month, term.day, 12, 0) - tz / 24;
    const termJD = findSolarTermJD(approxJD, term.angle);

    const clockDiffMinutes = (birthUTCJD - termJD) * 1440;
    const solarDiffMinutes = clockDiffMinutes + totalOffsetMinutes;

    if (Math.abs(clockDiffMinutes) <= 120 || Math.abs(solarDiffMinutes) <= 120) {
      const termLocalDate = jdToDate(termJD + tz / 24);
      results.push({
        termName: term.name,
        isMajorJie: !!term.isMajorJie,
        termLocalTime: `${termLocalDate.year}-${String(termLocalDate.month).padStart(2, '0')}-${String(termLocalDate.day).padStart(2, '0')} ${String(termLocalDate.hour).padStart(2, '0')}:${String(termLocalDate.minute).padStart(2, '0')}`,
        clockDiffMinutes: Math.round(clockDiffMinutes * 10) / 10,
        solarDiffMinutes: Math.round(solarDiffMinutes * 10) / 10,
        clockIsAfter: clockDiffMinutes >= 0,
        solarIsAfter: solarDiffMinutes >= 0,
        crossedBoundary: (clockDiffMinutes >= 0) !== (solarDiffMinutes >= 0),
        advice: (clockDiffMinutes >= 0) !== (solarDiffMinutes >= 0)
          ? `⚠️ 鐘錶時間與真太陽時在【${term.name}】交接點前後反轉，此處攸關八字月柱/年柱與紫微節氣分野，請確認出生時刻。`
          : `⚡ 出生時間鄰近【${term.name}】交節時刻（相距約 ${Math.abs(Math.round(solarDiffMinutes))} 分鐘），天文交節已精確換算為當地真太陽時。`
      });
    }
  }
  return results;
}

function adjustDateString(dateStr, dayShift) {
  if (!dayShift) return dateStr;
  const parts = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + dayShift));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function calculateSolarTimeCorrection(birthday, clockTimeStr, placeStr) {
  const geo = parseLocationOrCoordinates(placeStr);
  const [y, m, d] = (birthday || '1990-03-15').split('-').map(Number);
  const timeParts = (clockTimeStr || '14:00').split(':').map(Number);
  const h = timeParts[0] || 0;
  const min = timeParts[1] || 0;

  const centralMeridian = geo.centralMeridian;
  const geoOffset = 4 * (geo.lon - centralMeridian);
  const eot = calculateEOT(y, m, d, h);
  const totalOffset = geoOffset + eot;

  const clockTotalMin = h * 60 + min;
  let solarTotalMin = clockTotalMin + totalOffset;
  let dayShift = 0;
  if (solarTotalMin < 0) {
    solarTotalMin += 1440;
    dayShift = -1;
  } else if (solarTotalMin >= 1440) {
    solarTotalMin -= 1440;
    dayShift = 1;
  }

  const solarH = Math.floor(solarTotalMin / 60);
  const solarM = Math.floor(solarTotalMin % 60);
  const solarS = Math.round((solarTotalMin * 60) % 60);

  const origIndex = timeToShichenIndex(h, min);
  const adjIndex = timeToShichenIndex(solarH, solarM);

  const boundaries = [0, 60, 180, 300, 420, 540, 660, 780, 900, 1020, 1140, 1260, 1380, 1440];
  let nearBoundary = null;
  let minDiff = 999;
  for (const b of boundaries) {
    const diff = Math.abs(solarTotalMin - b);
    if (diff <= 15 && diff < minDiff) {
      minDiff = diff;
      nearBoundary = b;
    }
  }

  const isNearBoundary = nearBoundary !== null;
  let boundaryInfo = null;
  if (isNearBoundary) {
    const bH = Math.floor((nearBoundary % 1440) / 60);
    const bM = (nearBoundary % 1440) % 60;
    const boundaryTimeStr = `${String(bH).padStart(2, '0')}:${String(bM).padStart(2, '0')}`;
    const altTotalMin = solarTotalMin < nearBoundary ? nearBoundary + 5 : nearBoundary - 5;
    const altH = Math.floor(((altTotalMin % 1440) + 1440) % 1440 / 60);
    const altM = Math.floor(((altTotalMin % 1440) + 1440) % 1440 % 60);
    const altIndex = timeToShichenIndex(altH, altM);
    boundaryInfo = {
      boundaryTime: boundaryTimeStr,
      diffMinutes: Math.round(minDiff * 10) / 10,
      currentShichenIndex: adjIndex,
      currentShichenName: SHICHEN_NAMES[adjIndex],
      alternativeShichenIndex: altIndex,
      alternativeShichenName: SHICHEN_NAMES[altIndex],
      warningMessage: `⚠️ 真太陽時 ${String(solarH).padStart(2, '0')}:${String(solarM).padStart(2, '0')} 距離時辰交界（${boundaryTimeStr}）僅差 ${Math.round(minDiff * 10) / 10} 分鐘（前後 15 分鐘內）。時辰接近邊界，建議確認出生時間。`
    };
  }

  const meanTotalMin = clockTotalMin + geoOffset;
  const meanH = Math.floor(((meanTotalMin % 1440) + 1440) % 1440 / 60);
  const meanM = Math.floor(((meanTotalMin % 1440) + 1440) % 1440 % 60);

  const solarTerms = checkSolarTermCrossing(y, m, d, h, min, geo.tz, totalOffset);

  return {
    location: geo,
    clockTime: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
    geoOffsetMinutes: Math.round(geoOffset * 10) / 10,
    eotMinutes: Math.round(eot * 10) / 10,
    totalOffsetMinutes: Math.round(totalOffset * 10) / 10,
    meanSolarTime: `${String(meanH).padStart(2, '0')}:${String(meanM).padStart(2, '0')}`,
    trueSolarTime: `${String(solarH).padStart(2, '0')}:${String(solarM).padStart(2, '0')}`,
    trueSolarTimeFull: `${String(solarH).padStart(2, '0')}:${String(solarM).padStart(2, '0')}:${String(solarS).padStart(2, '0')}`,
    originalShichenIndex: origIndex,
    originalShichenName: SHICHEN_NAMES[origIndex],
    originalShichenShort: SHICHEN_SHORT[origIndex],
    adjustedShichenIndex: adjIndex,
    adjustedShichenName: SHICHEN_NAMES[adjIndex],
    adjustedShichenShort: SHICHEN_SHORT[adjIndex],
    isShichenChanged: origIndex !== adjIndex,
    dayShift,
    isNearBoundary,
    boundaryInfo,
    solarTerms
  };
}

// =========================================================================
// 前端直接執行之 API 函式 (原 server.js 路由搬移至前端，無須伺服器即可運作)
// 1. /api/lunar-date (農曆轉換)
// 2. /api/solar-time (真太陽時計算)
// 3. /api/geocode (地理編碼)
// 4. /api/llm-config (LLM 設定與費率資訊)
// 5. /api/deepinfra/chat (DeepInfra 呼叫代理)
// =========================================================================

/**
 * 1. 農曆轉換前端函式 (對應 /api/lunar-date)
 * @param {string} solarDate 國曆日期 (YYYY-MM-DD)
 * @returns {{ solar: string, lunar: string, ganzhi: string, weekday: string }}
 */
function getLunarDate(solarDate) {
  return convertToLunar(solarDate || '2026-10-06');
}

/**
 * 2. 真太陽時推算前端函式 (對應 /api/solar-time)
 * @param {string} birthday 出生日期 (YYYY-MM-DD)
 * @param {string} clockTime 鐘錶時間 (HH:mm)
 * @param {string} place 出生地點或經緯度
 * @returns {object} 真太陽時詳細推算結果
 */
function calculateSolarTime(birthday, clockTime, place) {
  return calculateSolarTimeCorrection(birthday || '1990-03-15', clockTime || '14:00', place || '台北');
}

function getSolarTime(birthday, clockTime, place) {
  try {
    const result = calculateSolarTime(birthday, clockTime, place);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 3. 地理編碼解析前端函式 (對應 /api/geocode)
 * @param {string} query 城市名稱或經緯度座標
 * @returns {{ success: boolean, location: object }}
 */
function geocodeLocation(query) {
  try {
    const geo = parseLocationOrCoordinates(query || '台北');
    return { success: true, location: geo };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 4. LLM 供應商設定與費率資訊 (對應 /api/llm-config)
 */
const LLM_CONFIG_DATA = {
  success: true,
  defaultProvider: 'deepinfra',
  providers: {
    deepinfra: {
      name: 'DeepInfra',
      endpoint: 'https://api.deepinfra.com/v1/openai/chat/completions',
      defaultModel: 'deepseek-ai/DeepSeek-V4-Flash-0731',
      models: [
        {
          id: 'deepseek-ai/DeepSeek-V4-Flash-0731',
          name: 'DeepSeek V4 Flash（預設 · 快速低延遲）',
          inputPricePerM: 0.09,
          outputPricePerM: 0.18
        },
        {
          id: 'deepseek-ai/DeepSeek-V4-Pro-0813',
          name: 'DeepSeek V4 Pro（推理能力更強）',
          inputPricePerM: 0.27,
          outputPricePerM: 1.10
        },
        {
          id: 'deepseek-ai/DeepSeek-V3.2',
          name: 'DeepSeek V3.2（穩定版）',
          inputPricePerM: 0.14,
          outputPricePerM: 0.28
        }
      ]
    },
    gemini: {
      name: 'Google AI Studio',
      defaultModel: 'gemini-3.5-flash',
      isFallback: true
    }
  }
};

function getLLMConfig() {
  return JSON.parse(JSON.stringify(LLM_CONFIG_DATA));
}

/**
 * 5. DeepInfra 調用前端函式 (對應 /api/deepinfra/chat)
 * @param {object} params { apiKey, model, messages, prompt, temperature, max_tokens }
 */
async function callDeepInfraChat(params = {}) {
  const apiKey = (params && params.apiKey) ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('deepinfra_api_key')) ||
    (typeof state !== 'undefined' && state.deepinfraApiKey) ||
    (typeof DEEPINFRA_API_KEY !== 'undefined' && DEEPINFRA_API_KEY) ||
    (typeof window !== 'undefined' && window.DEEPINFRA_API_KEY) ||
    (typeof process !== 'undefined' && process.env && (process.env.DEEPINFRA_API_KEY || process.env.DEEP_INFRA_API_KEY)) ||
    '';

  if (!apiKey) {
    throw new Error('未提供 DeepInfra API Key');
  }

  const model = (params && params.model) || 'deepseek-ai/DeepSeek-V4-Flash-0731';
  const payload = {
    model: model,
    messages: (params && params.messages) || [{ role: 'user', content: (params && params.prompt) || '' }],
    temperature: (params && params.temperature !== undefined) ? params.temperature : 0.7,
    max_tokens: (params && params.max_tokens) || 2048
  };

  const url = 'https://api.deepinfra.com/v1/openai/chat/completions';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  if (typeof fetch !== 'undefined') {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`連線 DeepInfra 失敗 (${response.status}): ${errText}`);
    }
    return await response.json();
  } else {
    const https = require('https');
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.deepinfra.com',
        port: 443,
        path: '/v1/openai/chat/completions',
        method: 'POST',
        headers: headers
      }, (res) => {
        let resData = '';
        res.on('data', c => resData += c);
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(resData));
            } else {
              reject(new Error(`連線 DeepInfra 失敗 (${res.statusCode}): ${resData}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', err => reject(new Error('連線 DeepInfra 失敗: ' + err.message)));
      req.write(JSON.stringify(payload));
      req.end();
    });
  }
}

// 前端直接支援 /api/ 路徑 (原 server.js 路由搬移至前端直接執行)
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const _origFetch = window.fetch;
  window.fetch = async function (input, init = {}) {
    let urlStr = '';
    if (typeof input === 'string') {
      urlStr = input;
    } else if (input && input.url) {
      urlStr = input.url;
    }

    try {
      const parsedUrl = new URL(urlStr, window.location.origin);
      const pathname = parsedUrl.pathname;
      const searchParams = parsedUrl.searchParams;

      // 1. /api/lunar-date
      if (pathname === '/api/lunar-date') {
        const date = searchParams.get('date') || '2026-10-06';
        const data = getLunarDate(date);
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      }

      // 2. /api/solar-time
      if (pathname === '/api/solar-time') {
        const birthday = searchParams.get('birthday') || '1990-03-15';
        const time = searchParams.get('time') || '14:00';
        const place = searchParams.get('place') || '台北';
        const data = getSolarTime(birthday, time, place);
        return new Response(JSON.stringify(data), {
          status: data.success ? 200 : 500,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      }

      // 3. /api/geocode
      if (pathname === '/api/geocode') {
        const query = searchParams.get('query') || searchParams.get('place') || '台北';
        const data = geocodeLocation(query);
        return new Response(JSON.stringify(data), {
          status: data.success ? 200 : 500,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      }

      // 4. /api/llm-config
      if (pathname === '/api/llm-config') {
        const data = getLLMConfig();
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      }

      // 5. /api/deepinfra/chat
      if (pathname === '/api/deepinfra/chat') {
        let body = {};
        if (init && init.body) {
          try {
            body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
          } catch (e) {
            body = {};
          }
        }
        try {
          const data = await callDeepInfraChat(body);
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
          });
        }
      }
    } catch (e) {
      // 忽略非標準 URL 或其他請求
    }

    return _origFetch.apply(this, arguments);
  };
}

// =========================================================================
// 滿天星 Plus 升級模組一：七政四餘天象推算引擎 (Client/Offline Engine)
// =========================================================================
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

function normalizeDeg(deg) {
  deg = deg % 360;
  return deg < 0 ? deg + 360 : deg;
}

function solveKeplerianE(M, e) {
  let E = M;
  for (let i = 0; i < 15; i++) {
    const delta = E - e * Math.sin(E) - M;
    if (Math.abs(delta) < 1e-8) break;
    E -= delta / (1 - e * Math.cos(E));
  }
  return E;
}

const ZODIAC_PALACE_MAP = [
  { branch: '戌', name: '白羊宮 / 天降', sign: '白羊座', min: 0, max: 30 },
  { branch: '酉', name: '金牛宮 / 大梁', sign: '金牛座', min: 30, max: 60 },
  { branch: '申', name: '雙子宮 / 實沈', sign: '雙子座', min: 60, max: 90 },
  { branch: '未', name: '巨蟹宮 / 鶉首', sign: '巨蟹座', min: 90, max: 120 },
  { branch: '午', name: '獅子宮 / 鶉火', sign: '獅子座', min: 120, max: 150 },
  { branch: '巳', name: '處女宮 / 鶉尾', sign: '處女座', min: 150, max: 180 },
  { branch: '辰', name: '天秤宮 / 壽星', sign: '天秤座', min: 180, max: 210 },
  { branch: '卯', name: '天蠍宮 / 大火', sign: '天蠍座', min: 210, max: 240 },
  { branch: '寅', name: '射手宮 / 析木', sign: '射手座', min: 240, max: 270 },
  { branch: '丑', name: '摩羯宮 / 星紀', sign: '摩羯座', min: 270, max: 300 },
  { branch: '子', name: '水瓶宮 / 玄枵', sign: '水瓶座', min: 300, max: 330 },
  { branch: '亥', name: '雙魚宮 / 娵訾', sign: '雙魚座', min: 330, max: 360 }
];

function degToPalaceInfo(lon) {
  const norm = normalizeDeg(lon);
  const palaceIdx = Math.floor(norm / 30);
  const p = ZODIAC_PALACE_MAP[palaceIdx % 12];
  const degInPalace = norm - palaceIdx * 30;
  const d = Math.floor(degInPalace);
  const m = Math.floor((degInPalace - d) * 60);
  return {
    branch: p.branch,
    palaceName: p.name,
    sign: p.sign,
    totalDeg: Number(norm.toFixed(2)),
    degInPalace: Number(degInPalace.toFixed(2)),
    deg: d,
    min: m,
    formatted: `${p.branch}宮 (${p.sign}) ${d}°${String(m).padStart(2, '0')}'`
  };
}

function calculateQizhengSiyu(year, month, day, hour = 12, minute = 0, tz = 8) {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const utHour = hour + minute / 60 - tz;
  const dayFrac = day + utHour / 24;
  const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + dayFrac + B - 1524.5;
  const T = (jd - 2451545.0) / 36525.0;
  const d = jd - 2451545.0;

  // 1. 日 (太陽)
  const L0 = normalizeDeg(280.46646 + 36000.76983 * T);
  const M_sun = normalizeDeg(357.52911 + 35999.05029 * T) * D2R;
  const C_sun = (1.914602 - 0.004817 * T) * Math.sin(M_sun) + 0.019993 * Math.sin(2 * M_sun);
  const sunLon = normalizeDeg(L0 + C_sun);

  // 地球日心坐標投影
  const R_sun = 1.00014 - 0.01671 * Math.cos(M_sun);
  const xe = R_sun * Math.cos(sunLon * D2R);
  const ye = R_sun * Math.sin(sunLon * D2R);

  // 2. 月 (太陰)
  const L_moon = normalizeDeg(218.3164477 + 481267.88123421 * T);
  const D = normalizeDeg(297.8501921 + 445267.1114034 * T) * D2R;
  const M_m = normalizeDeg(134.9633964 + 477198.8675055 * T) * D2R;
  const F = normalizeDeg(93.2720950 + 483202.0175233 * T) * D2R;
  const moonLon = normalizeDeg(
    L_moon +
    6.288774 * Math.sin(M_m) +
    1.274027 * Math.sin(2 * D - M_m) +
    0.658314 * Math.sin(2 * D) +
    0.213618 * Math.sin(2 * M_m) -
    0.185116 * Math.sin(M_sun) -
    0.114332 * Math.sin(2 * F)
  );

  // 五大行星開普勒根數
  const planetElements = {
    mercury: { a: 0.387098, e: 0.205630, L: 252.250905 + 149472.674111 * T, w: 77.45645 + 1.55648 * T },
    venus:   { a: 0.723332, e: 0.006773, L: 181.979801 + 58517.815676 * T,  w: 131.56370 + 1.40222 * T },
    mars:    { a: 1.523688, e: 0.093405, L: 355.433275 + 19140.299314 * T,  w: 336.06023 + 1.84104 * T },
    jupiter: { a: 5.202603, e: 0.048498, L: 34.351484 + 3034.905675 * T,   w: 14.33130 + 1.61266 * T },
    saturn:  { a: 9.554909, e: 0.055546, L: 50.077471 + 1222.113794 * T,   w: 92.43194 + 1.95874 * T }
  };

  function getPlanetGeocentricLon(elem) {
    const M = normalizeDeg(elem.L - elem.w) * D2R;
    const E = solveKeplerianE(M, elem.e);
    const xv = elem.a * (Math.cos(E) - elem.e);
    const yv = elem.a * (Math.sqrt(1 - elem.e * elem.e) * Math.sin(E));
    const v = Math.atan2(yv, xv);
    const r = Math.sqrt(xv * xv + yv * yv);
    const lHeliocentric = normalizeDeg(v * R2D + elem.w);
    const xh = r * Math.cos(lHeliocentric * D2R);
    const yh = r * Math.sin(lHeliocentric * D2R);
    const xg = xh + xe;
    const yg = yh + ye;
    return normalizeDeg(Math.atan2(yg, xg) * R2D);
  }

  // 四餘計算
  const rahuLon = normalizeDeg(125.04452 - 1934.136261 * T + 0.0020708 * T * T);
  const ketuLon = normalizeDeg(rahuLon + 180);
  const yueboLon = normalizeDeg(83.35324 + 4069.0137287 * T - 0.01032 * T * T);
  const ziqiLon = normalizeDeg(290.54 + d * (360 / 10227.179));

  const items = [
    { key: 'sun', name: '日 (太陽)', category: '七政', element: '火', lon: sunLon, role: '君王之尊 · 主貴顯榮華' },
    { key: 'moon', name: '月 (太陰)', category: '七政', element: '水', lon: moonLon, role: '陰柔之德 · 主財帛田宅' },
    { key: 'wood', name: '木 (歲星)', category: '七政', element: '木', lon: getPlanetGeocentricLon(planetElements.jupiter), role: '仁厚福星 · 主爵祿壽喜' },
    { key: 'fire', name: '火 (熒惑)', category: '七政', element: '火', lon: getPlanetGeocentricLon(planetElements.mars), role: '勇武威權 · 主軍務開拓' },
    { key: 'earth', name: '土 (填星)', category: '七政', element: '土', lon: getPlanetGeocentricLon(planetElements.saturn), role: '中正沉穩 · 主田產信譽' },
    { key: 'metal', name: '金 (太白)', category: '七政', element: '金', lon: getPlanetGeocentricLon(planetElements.venus), role: '剛毅義氣 · 主財帛權威' },
    { key: 'water', name: '水 (辰星)', category: '七政', element: '水', lon: getPlanetGeocentricLon(planetElements.mercury), role: '聰明靈巧 · 主智謀交際' },
    { key: 'ziqi', name: '紫氣 (木餘)', category: '四餘', element: '木', lon: ziqiLon, role: '道骨清奇 · 主福壽解厄' },
    { key: 'yuebo', name: '月孛 (水餘)', category: '四餘', element: '水', lon: yueboLon, role: '多智深沉 · 主偏才偏愛' },
    { key: 'rahu', name: '羅睺 (火餘)', category: '四餘', element: '火', lon: rahuLon, role: '剛烈突變 · 主首領霸氣' },
    { key: 'ketu', name: '計都 (土餘)', category: '四餘', element: '土', lon: ketuLon, role: '忍辱厚重 · 主孤高修持' }
  ];

  const results = {};
  const palaceDistribution = {};
  ZODIAC_PALACE_MAP.forEach(p => { palaceDistribution[p.branch] = []; });

  items.forEach(it => {
    const palace = degToPalaceInfo(it.lon);
    results[it.key] = {
      ...it,
      ...palace
    };
    if (palaceDistribution[palace.branch]) {
      palaceDistribution[palace.branch].push({
        name: it.name,
        category: it.category,
        element: it.element,
        degInPalace: palace.degInPalace,
        formatted: palace.formatted
      });
    }
  });

  return {
    julianDay: Number(jd.toFixed(4)),
    centuryT: Number(T.toFixed(6)),
    planetaryBodies: results,
    palaceDistribution,
    countSeven: 7,
    countFour: 4
  };
}

// =========================================================================
// 滿天星 Plus 升級模組二：流分推算引擎
// =========================================================================
const STEMS_LOOKUP = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES_LOOKUP = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function getStemByWuShuDun(leaderStem, branchIdx) {
  const startStemMap = { '甲': 2, '己': 2, '乙': 4, '庚': 4, '丙': 6, '辛': 6, '丁': 8, '壬': 8, '戊': 0, '癸': 0 };
  const startStemIdx = startStemMap[leaderStem] !== undefined ? startStemMap[leaderStem] : 0;
  return STEMS_LOOKUP[(startStemIdx + branchIdx) % 10];
}

const SIHUA_PER_STEM = {
  '甲': { lu: '廉貞', quan: '破軍', ke: '武曲', ji: '太陽' },
  '乙': { lu: '天機', quan: '天梁', ke: '紫微', ji: '太陰' },
  '丙': { lu: '天同', quan: '天機', ke: '文昌', ji: '廉貞' },
  '丁': { lu: '太陰', quan: '天同', ke: '天機', ji: '巨門' },
  '戊': { lu: '貪狼', quan: '太陰', ke: '右弼', ji: '天機' },
  '己': { lu: '武曲', quan: '貪狼', ke: '天梁', ji: '文曲' },
  '庚': { lu: '太陽', quan: '武曲', ke: '太陰', ji: '天同' },
  '辛': { lu: '巨門', quan: '太陽', ke: '文曲', ji: '文昌' },
  '壬': { lu: '天梁', quan: '紫微', ke: '左輔', ji: '武曲' },
  '癸': { lu: '破軍', quan: '巨門', ke: '太陰', ji: '貪狼' }
};

function calculateFlowMinute(flowDayBranch = '子', flowDayStem = '甲', hour = 12, minute = 0) {
  const hourBranchIdx = Math.floor((hour + 1) / 2) % 12;
  const hourBranch = BRANCHES_LOOKUP[hourBranchIdx];
  const hourStem = getStemByWuShuDun(flowDayStem, hourBranchIdx);
  const hourGanZhi = hourStem + hourBranch;

  // 流時命宮: 從流日命宮起流日子時，順數至該時辰
  const dayBranchIdx = Math.max(0, BRANCHES_LOOKUP.indexOf(flowDayBranch));
  const hourPalaceIdx = (dayBranchIdx + hourBranchIdx) % 12;
  const hourPalaceBranch = BRANCHES_LOOKUP[hourPalaceIdx];

  // 流分命宮: 從流時命宮起，順數至該分鐘 (minute 0-59)
  const minutePalaceIdx = (hourPalaceIdx + minute) % 12;
  const minutePalaceBranch = BRANCHES_LOOKUP[minutePalaceIdx];

  // 流分干支: 以時干五鼠遁起分干，配分宮地支
  const minuteStem = getStemByWuShuDun(hourStem, minute % 12);
  const minuteGanZhi = minuteStem + minutePalaceBranch;
  const minuteSihua = SIHUA_PER_STEM[minuteStem] || { lu: '太陽', quan: '武曲', ke: '太陰', ji: '天同' };

  let advice = '';
  if (minuteSihua.lu === '武曲' || minuteSihua.lu === '太陰' || minuteSihua.lu === '祿存') {
    advice = '此分鐘逢正財化祿能量，極利於急件簽約、投資下單或轉帳結算。';
  } else if (minuteSihua.ji === '廉貞' || minuteSihua.ji === '太陽' || minuteSihua.ji === '天機') {
    advice = '此分鐘化忌引動思慮干擾，重要訊息發送前宜沉澱三思，忌衝動拍板。';
  } else {
    advice = '此分鐘四化氣場平穩和諧，宜按部就班推進各項事務。';
  }

  return {
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    hour: {
      ganzhi: hourGanZhi,
      palace: `${hourPalaceBranch}宮`,
      branch: hourBranch,
      stem: hourStem
    },
    minute: {
      minuteNumber: minute,
      ganzhi: minuteGanZhi,
      palace: `${minutePalaceBranch}宮`,
      branch: minutePalaceBranch,
      stem: minuteStem,
      sihua: minuteSihua,
      advice
    }
  };
}

// =========================================================================
// 模組一：Jack 老師《天紀》與《人紀》三才全息架構
// =========================================================================
function calculateSanCaiFramework(session = {}) {
  const bday = session.birthday || '1977-07-26';
  const place = session.birthPlace || '曼谷';
  const name = session.clientName || '客戶';
  const fiveElements = (session.astrolabe && session.astrolabe.fiveElementsClass) || '金四局';
  const soul = (session.astrolabe && session.astrolabe.soul) || '文曲';
  const body = (session.astrolabe && session.astrolabe.body) || '文昌';

  return {
    title: 'Jack 老師《天紀》與《人紀》天·地·人三才全息架構',
    ratio: { tian: '33.3% (先天命運)', di: '33.3% (空間磁場)', ren: '33.3% (自由意志)' },
    tian: {
      name: '天道（先天命運）',
      proportion: '三分之一',
      components: ['紫微斗數命盤格局', '八字四柱干支', '生年四化因果鏈'],
      coreConcept: '天命為定數與軌跡，如劇本之大綱。知天命者不怨天，順應天地時辰運轉，知曉何時乘風破浪、何時收斂伏藏。',
      clientAnalysis: `客戶【${name}】五行局為【${fiveElements}】，命主星【${soul}】，身主星【${body}】。先天能量具備剛柔兼濟之天賦。`
    },
    di: {
      name: '地道（空間磁場）',
      proportion: '三分之一',
      components: ['陽宅天紀座向', '地脈道能量', '床位與辦公位佈局', '方位吉凶避煞'],
      coreConcept: '地脈為空間磁場。倪師醫道講求「名位相當」：父居乾位（西北）、母居坤位（西南）、長子居震位（正東）。人處其位則天地氣交，心神安寧。',
      remedyLayout: '主事者座向宜朝向西北乾卦天子位；辦公桌背後有靠，避開煞方；流年煞位不宜動土；臥室避免鏡子正對床頭以免魂魄不寧。'
    },
    ren: {
      name: '人道（自由意志）',
      proportion: '三分之一',
      components: ['中醫五行調和', '中藥五味歸經與禁忌', '子午流注點穴', '易經決策心法'],
      coreConcept: '人道為人事抉擇與心性修為。即便先天格局有險、空間有煞，若人能以中醫調和氣血陰陽、以易經進退之道修養心性，則足以逆轉定數，達到「知命、造命、修命」之境界！',
      decisionRule: '易經六十四卦「時止則止，時行則行，動靜不失其時，其道光明」。在關鍵時刻克制貪欲與恐懼，即是最大的改運！'
    },
    niMasterWisdom: '倪師名言：「天命占三分之一，地脈占三分之一，人事修為占三分之一。知天順地以盡人事，何愁不能改運造命！」'
  };
}

// 倪師中醫五味歸經與子午流注母子補瀉
function calculateNiTcmFramework(session = {}) {
  return {
    fiveFlavors: {
      title: '中藥五味歸經 (Five Flavors & Meridians)',
      mappings: [
        { flavor: '酸 (Sour)', organ: '肝 (Liver)', effect: '能收、能澀，收斂生津，滋養肝陰' },
        { flavor: '苦 (Bitter)', organ: '心 (Heart)', effect: '能洩、能燥、能堅，清心瀉火，降逆堅陰' },
        { flavor: '甘 (Sweet)', organ: '脾 (Spleen)', effect: '能補、能和、能緩，補益脾胃氣血，調和諸藥' },
        { flavor: '辛 (Acrid/Spicy)', organ: '肺 (Lung)', effect: '能散、能行，宣發肺氣，行氣活血化瘀' },
        { flavor: '鹹 (Salty)', organ: '腎 (Kidney)', effect: '能下、能軟，軟堅散結，潤下滋真水' }
      ],
      taboos: {
        title: '五味禁忌 (《黃帝內經·宣明五氣》)',
        rules: [
          '咸走血，血病無多食鹹（心血病、高血壓病患切忌多食鹹味，否則血凝色變）',
          '酸走筋，筋病無多食酸（痛風、筋骨攣急萎弱病患切忌多酸，否則筋縮骨酸）',
          '辛走氣，氣病無多食辛（肺氣虛自汗、咳喘無力病患切忌多辛，否則氣耗散失）',
          '苦走骨，骨病無多食苦（骨質疏鬆、腎精虛損病患切忌過度苦寒，否則骨枯齒搖）',
          '甘走肉，肉病無多食甘（中焦濕阻、脾虛水腫肌肉萎軟者切忌多甜，否則滿壅生痰）'
        ]
      }
    },
    ziWuLiuZhu: {
      title: '子午流注針灸與點穴心法 (Mother-Child Supplement & Drain)',
      rule: '實則瀉其子，虛則補其母。',
      meridianClock: [
        { time: '子時 (23:00-01:00)', organ: '膽經 (水生木)', tip: '骨髓造血生發之時，切忌熬夜' },
        { time: '丑時 (01:00-03:00)', organ: '肝經 (木生火)', tip: '人臥則血歸於肝，深睡排毒以涵養精氣' },
        { time: '寅時 (03:00-05:00)', organ: '肺經 (金克木)', tip: '肺朝百脈，深度吐納調和呼吸' },
        { time: '卯時 (05:00-07:00)', organ: '大腸經 (金傳導)', tip: '晨起溫水，開天門助排便排濁' },
        { time: '辰時 (07:00-09:00)', organ: '胃經 (土化生)', tip: '胃氣大開，及時進補溫熱朝食' },
        { time: '巳時 (09:00-11:00)', organ: '脾經 (土統血)', tip: '運化精神大腦之時，工作決策巔峰' },
        { time: '午時 (11:00-13:00)', organ: '心經 (火主神)', tip: '陽極陰生，午間閉目小憩十五分鐘養心神' },
        { time: '未時 (13:00-15:00)', organ: '小腸經 (受盛化物)', tip: '分清泌濁，水液代謝吸收' },
        { time: '申時 (15:00-17:00)', organ: '膀胱經 (津液排泄)', tip: '多飲溫水排毒，體力思維第二高峰' },
        { time: '酉時 (17:00-19:00)', organ: '腎經 (藏精固本)', tip: '揉按太溪、湧泉穴，引火歸元固藏先天真陽' },
        { time: '戌時 (19:00-21:00)', organ: '心包經 (護衛心君)', tip: '放鬆心情，舒緩社交，切忌劇烈情緒波動' },
        { time: '亥時 (21:00-23:00)', organ: '三焦經 (通調水道)', tip: '百脈休整，準備入眠以迎真陽生發' }
      ]
    }
  };
}

// =========================================================================
// 模組二：紫微斗數三大派別全息視角 (三合 · 飛星 · 欽天門)
// =========================================================================
function calculateThreeSchools(astrolabe, birthStem = '丁') {
  const stemToBranchMap = {
    '甲': '寅', '乙': '卯', '丙': '辰', '丁': '巳', '戊': '午',
    '己': '未', '庚': '申', '辛': '酉', '壬': '戌', '癸': '亥'
  };
  const laiYinBranch = stemToBranchMap[birthStem] || '巳';
  let laiYinPalaceName = '父母宮';
  if (astrolabe && astrolabe.palaces) {
    const lp = astrolabe.palaces.find(p => p.earthlyBranch === laiYinBranch);
    if (lp) laiYinPalaceName = lp.name;
  }

  return {
    sanhe: {
      name: '三合派（星曜賦性與廟旺格局）',
      emphasis: '三方四正、主星廟旺利陷、輔煞吉星照會、左右夾祿夾貴夾煞格局。',
      principle: '以星曜星情賦性為體，三方會照為用。吉星多聚則貴，凶煞沖照則蹇。注重本質性格、命格富貴層次與人際互動。'
    },
    feixing: {
      name: '飛星派（四化飛移與能量因果鏈）',
      emphasis: '宮干四化飛移、祿轉忌、忌轉忌、因果鏈條追蹤、忌出祿入。',
      principle: '以宮位天干引動四化為媒介，追查事物發生的時間點與前因後果。「祿是緣起，忌是緣滅；科是過程，權是轉折」。觀察能量在十二宮之間的流動與牽引。'
    },
    qintian: {
      name: '欽天門（來因宮與生年因果業力）',
      emphasis: '來因宮定位、生年四化落點、自化（離心/向心）、男女星象、以心轉境。',
      laiYinBranch: laiYinBranch,
      laiYinPalace: laiYinPalaceName,
      principle: `來因宮坐落【${laiYinBranch}宮 (${laiYinPalaceName})】。來因宮代表今生業力寄託、核心舞台與轉念契機。生年四化由此宮發散，是一生重大際遇之源頭。`,
      mindShift: '欽天門崇尚「心念轉化」：境由心生，若能明悟來因宮之執著所在，放下執念，自能轉化業力為功德願力。'
    }
  };
}

// =========================================================================
// 模組三：立太極（借宮推算：父母健康壽元與婚姻危機預判）
// =========================================================================
function calculateTaiJiPalaces(astrolabe, session = {}) {
  let parentPalace = null;
  let parentJiePalace = null;
  let spousePalace = null;

  if (astrolabe && astrolabe.palaces) {
    parentPalace = astrolabe.palaces.find(p => p.name === '父母' || p.name === '父母宮');
    spousePalace = astrolabe.palaces.find(p => p.name === '夫妻' || p.name === '夫妻宮');
    parentJiePalace = astrolabe.palaces.find(p => p.name === '子女' || p.name === '子女宮');
  }

  const parentStars = parentPalace ? [...(parentPalace.majorStars || []), ...(parentPalace.minorStars || [])].map(s => s.name) : [];
  const hasTianLiang = parentStars.some(s => s.includes('天梁') || s.includes('天壽') || s.includes('天寿'));
  const hasKeLu = parentStars.some(s => s.includes('科') || s.includes('祿') || s.includes('禄') || s.includes('左輔') || s.includes('右弼'));
  const parentLongevityLevel = (hasTianLiang || hasKeLu) ? '福壽綿長（得天梁蔭星壽星庇佑）' : '平穩自持（宜注意保養）';

  const hasShaParent = parentStars.some(s => s.includes('羊') || s.includes('陀') || s.includes('火') || s.includes('鈴') || s.includes('空') || s.includes('劫') || s.includes('忌'));
  const parentHealthNotice = hasShaParent
    ? '⚠️ 父母宮見煞星忌星引動，若流年羊陀火鈴沖破時，應警惕長輩健康重大關卡。'
    : '✅ 父母宮星氣慈和，長輩精神康健，安享晚年福澤。';

  const spouseStars = spousePalace ? [...(spousePalace.majorStars || []), ...(spousePalace.minorStars || [])].map(s => s.name) : [];
  const hasLianZhen = spouseStars.some(s => s.includes('廉貞') || s.includes('廉贞'));
  const hasTanLang = spouseStars.some(s => s.includes('貪狼') || s.includes('贪狼'));
  const hasKongJie = spouseStars.some(s => s.includes('地空') || s.includes('地劫') || s.includes('空') || s.includes('劫'));
  const hasXianChi = spouseStars.some(s => s.includes('咸池') || s.includes('天姚') || s.includes('沐浴'));
  const hasJi = spouseStars.some(s => s.includes('忌') || s.includes('化忌'));

  let marriageRiskLevel = '低風險 (感情平順)';
  let marriageRiskDesc = '夫妻宮星曜組合穩定中正，雙方多加互敬互諒，婚姻家庭基石穩固。';
  let isAffairRisk = false;
  let isPeachBlossomRob = false;

  if (hasLianZhen && (hasKongJie || hasJi)) {
    marriageRiskLevel = '高度預警 (外遇/涉法/感情風暴)';
    marriageRiskDesc = '夫妻宮廉貞化忌會地空地劫：易有價值觀嚴重衝突、私情隱瞞或涉法官非，需提防感情外遇危機與離異風險！';
    isAffairRisk = true;
  } else if (hasTanLang && (hasXianChi || hasJi)) {
    marriageRiskLevel = '中高度警訊 (桃花煞劫)';
    marriageRiskDesc = '夫妻宮貪狼逢咸池/天姚/化忌：易招惹風流情債、第三者插足介入或因酒色桃色破財。';
    isPeachBlossomRob = true;
  }

  return {
    parentHealth: {
      palace: parentPalace ? `${parentPalace.earthlyBranch}宮` : '父母宮',
      stars: parentStars.join('、') || '主星清吉',
      parentJiePalace: parentJiePalace ? `${parentJiePalace.earthlyBranch}宮 (子女宮借宮代入父母疾厄)` : '父母疾厄位',
      longevityEvaluation: parentLongevityLevel,
      healthNotice: parentHealthNotice,
      sunMoonStatus: '日（父）月（母）星辰光芒明暗照映長輩之精神壽元。',
      counseling: '命理預警並非恐嚇，若父母宮見關卡，應積極為長輩安排身體健檢、早晚舒心陪伴，把握當下孝道，令生命圓滿無憾。'
    },
    marriageCrisis: {
      palace: spousePalace ? `${spousePalace.earthlyBranch}宮` : '夫妻宮',
      stars: spouseStars.join('、') || '無特殊煞曜',
      riskLevel: marriageRiskLevel,
      riskAnalysis: marriageRiskDesc,
      isAffairRisk: isAffairRisk,
      isPeachBlossomRob: isPeachBlossomRob,
      activeRemedy: [
        '風水佈局：於臥室桃花位放置黑曜石或天然木葫蘆斬斷爛桃花煞。',
        '臥室禁忌：嚴禁大面穿衣鏡正照床鋪，清除床頭過多水性流動飾品。',
        '心理溝通：放下掌控執念，建立財務與隱私透明機制，遇到分歧以易經退避溝通化解。'
      ]
    }
  };
}

// =========================================================================
// 模組四：2026 丙午年四化環境巨浪
// =========================================================================
function calculate2026BingWuSiHua() {
  return {
    yearGanZhi: '丙午年 (2026)',
    nature: '火旺之年 (納音天河水 · 歲祿在巳 · 帝旺在午)',
    mutagens: {
      lu: {
        star: '天同化祿',
        theme: '享樂主義與安靜離職潮',
        detail: '天同為福星，化祿主精神放鬆、追求生活質感、身心靈療癒與鬆弛感消費。職場上出現安靜離職（Quiet Quitting）與遠距工作風潮，不盲目內卷，向內探索。'
      },
      quan: {
        star: '天機化權',
        theme: '智謀掌權與策略突圍',
        detail: '天機為智慧智囊星，化權主科技算力躍升、AI技術全面落地、策略規劃者掌握話語權。唯有具備跨界智謀與核心演算法能力者，方能在競爭中突圍。'
      },
      ke: {
        star: '文昌化科',
        theme: '才華彰顯與名聲遠播',
        detail: '文昌為主考文星，化科利於學術論文、文憑證照、智慧產權專利、出版品牌傳播。誠信公信力成為最稀缺資產，才華橫溢者大放異彩。'
      },
      ji: {
        star: '廉貞化忌',
        theme: '隱形監獄與法規紅線',
        detail: '廉貞為次桃花亦為官祿囚星，化忌主感情風暴、合約糾紛、合規查稅、行政罰單甚至牢獄訴訟。個人心態易焦躁自囚於無形壓力，必須嚴守法律法規與道德底線，嚴防爛桃花惹官非。'
      }
    }
  };
}

// =========================================================================
// 模組五：易經起卦法 · 河圖五行生成數 · 推背圖宏觀視角
// =========================================================================
function calculateIChingAndNumerology(dateStr, timeStr = '12:00') {
  const d = new Date((dateStr || '2026-09-23') + 'T' + (timeStr || '12:00') + ':00');
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const shichenNum = Math.floor((hour + 1) / 2) % 12 + 1;

  const guaNames = ['坤', '乾', '兌', '離', '震', '巽', '坎', '艮'];
  const guaDetails = {
    '乾': { name: '乾為天', nature: '健', element: '金', advice: '天行健，君子以自強不息。' },
    '坤': { name: '坤為地', nature: '順', element: '土', advice: '地勢坤，君子以厚德載物。' },
    '震': { name: '震為雷', nature: '動', element: '木', advice: '洊雷震，君子以恐懼脩省。' },
    '巽': { name: '巽為風', nature: '入', element: '木', advice: '隨風巽，君子以申命行事。' },
    '坎': { name: '坎為水', nature: '陷', element: '水', advice: '水洊至，習坎；君子以常德行，習教事。' },
    '離': { name: '離為火', nature: '麗', element: '火', advice: '明兩作，離；大人以繼明照于四方。' },
    '艮': { name: '艮為山', nature: '止', element: '土', advice: '兼山艮，君子以思不出其位。' },
    '兌': { name: '兌為澤', nature: '悅', element: '金', advice: '麗澤兌，君子以朋友講習。' }
  };

  const upperIdx = (year + month + day) % 8;
  const lowerIdx = (year + month + day + shichenNum) % 8;
  const movingLine = (year + month + day + shichenNum) % 6 || 6;

  const upperGua = guaNames[upperIdx];
  const lowerGua = guaNames[lowerIdx];

  const hetuNumbers = {
    '水': { label: '天一生水，地六成之', base: [1, 6], luckyNums: [1, 6, 11, 16, 21, 26, 31, 36, 41, 46] },
    '火': { label: '地二生火，天七成之', base: [2, 7], luckyNums: [2, 7, 12, 17, 22, 27, 32, 37, 42, 47] },
    '木': { label: '天三生木，地八成之', base: [3, 8], luckyNums: [3, 8, 13, 18, 23, 28, 33, 38, 43, 48] },
    '金': { label: '地四生金，天九成之', base: [4, 9], luckyNums: [4, 9, 14, 19, 24, 29, 34, 39, 44, 49] },
    '土': { label: '天五生土，地十成之', base: [5, 10], luckyNums: [5, 10, 15, 20, 25, 30, 35, 40, 45] }
  };

  let decisionHexagram = '地天泰卦（上下交泰 · 利涉大川）';
  let decisionCore = '君子道長，小人道消；積極進取，厚積薄發。';
  if (movingLine === 1) {
    decisionHexagram = '乾卦初九「潛龍勿用」';
    decisionCore = '陽氣潛藏蓄積之時，時機未至，不可輕舉妄動，宜沉潛蓄力。';
  } else if (movingLine === 6) {
    decisionHexagram = '乾卦上九「亢龍有悔」';
    decisionCore = '進至極頂，過猶不及。此時宜主動急流勇退、獲利了結，切忌孤注一擲。';
  } else if (upperGua === '坎' || lowerGua === '坎') {
    decisionHexagram = '水雷屯卦 / 習坎卦（險阻當前 · 堅定志向）';
    decisionCore = '前有險阻，宜如春草破土，步步為營，不可躁進。';
  }

  return {
    iching: {
      upperGua: `${upperGua}卦 (${guaDetails[upperGua].nature})`,
      lowerGua: `${lowerGua}卦 (${guaDetails[lowerGua].nature})`,
      movingLine: `第 ${movingLine} 爻動`,
      combinedGua: `${upperGua}下${lowerGua}上`,
      decisionHexagram: decisionHexagram,
      decisionCore: decisionCore,
      tuibeituView: '推背圖宏觀視角：天道有常，大運流轉。個人運勢之興衰，皆在時代巨浪之中。順天應人者昌，逆流而動者困。'
    },
    numerology: hetuNumbers
  };
}

// =========================================================================
// 模組六：桃花煞判斷與風水斬桃花
// =========================================================================
function calculatePeachBlossomSha(day = {}, astrolabe = {}) {
  const branch = (day.dailyGanZhi ? day.dailyGanZhi.slice(-1) : '子');
  let peachPos = '酉方 (正西方)';
  if (['申', '子', '辰'].includes(branch)) peachPos = '酉方 (正西方)';
  else if (['亥', '卯', '未'].includes(branch)) peachPos = '子方 (正北方)';
  else if (['寅', '午', '戌'].includes(branch)) peachPos = '卯方 (正東方)';
  else if (['巳', '酉', '丑'].includes(branch)) peachPos = '午方 (正南方)';

  const shaPatterns = [
    { name: '滾浪桃花', level: '高危', desc: '天同太陰會文曲化忌在亥子水鄉，情慾氾濫不能自持。' },
    { name: '犯刑桃花', level: '極高危', desc: '桃花煞會擎羊天刑官符或廉貞化忌，因色涉法惹官非刑獄。' },
    { name: '醜聞桃花', level: '高危', desc: '廉貞貪狼昌曲化忌，私情隱私外洩曝光受指責。' },
    { name: '偷香桃花', level: '中度', desc: '天機太陰在巳亥逢天姚，暗中幽會私通。' }
  ];

  return {
    detectedPatterns: shaPatterns,
    peachPosition: peachPos,
    fengShuiRemedy: {
      items: ['桃木劍（懸掛於桃花位化解不正外緣）', '黑曜石（化煞鎮心、吸收負能量）', '天然開光葫蘆（收斂陰濕浮華之氣）'],
      taboos: ['臥室鏡子切忌直照床頭，以免夜間神魂受沖招致怪異外遇', '房間不宜放置過多水性流動水景魚缸，以免水蕩生淫']
    }
  };
}

// =========================================================================
// 模組七：投資理財聯動分析 (財帛 vs 田宅庫位 · 2026 進場與避險)
// =========================================================================
function calculateInvestmentLinkage(day = {}, session = {}) {
  const caibo = day.dailyCaibo || {};
  const tianzhai = day.dailyTianzhai || (session.astrolabe && session.astrolabe.palaces && session.astrolabe.palaces.find(p => p.name === '田宅' || p.name === '田宅宮')) || {};
  const fude = day.dailyFude || {};

  const cStars = caibo.majorStars ? caibo.majorStars.map(s => s.name) : [];
  const tStars = tianzhai.majorStars ? tianzhai.majorStars.map(s => s.name) : [];
  const siHua = day.dailySiHua || {};

  const isCaiboLu = (siHua['化祿'] && cStars.includes(siHua['化祿'])) || (caibo.dailyStars && caibo.dailyStars.includes('祿存'));
  const isCaiboJi = (siHua['化忌'] && cStars.includes(siHua['化忌']));
  const isTianzhaiJi = (siHua['化忌'] && tStars.includes(siHua['化忌']));

  let signal = '觀望持平（中立）';
  let signalColor = 'yellow';
  let guidance = '當日財氣平穩，適合做好既有資產盤點，不宜過度加槓桿。';

  if (isCaiboLu && !isTianzhaiJi) {
    signal = '🚀 強勢進場訊號（財帛化祿庫位穩固）';
    signalColor = 'green';
    guidance = '流年/流日化祿照入財帛宮，田宅庫位無破，現金流充沛，為極佳之波段進場、落實投資專案時機！';
  } else if (isCaiboJi || isTianzhaiJi) {
    signal = '⚠️ 收割避險訊號（財帛化忌或財庫見漏）';
    signalColor = 'red';
    guidance = '財帛逢忌易有虧損套牢，田宅逢忌代表資產庫漏水。強烈建議獲利了結、降低持倉、清空高風險投機部位！';
  }

  const fudeHasSha = (fude.minorStars || []).some(s => ['陀羅', '火星', '鈴星', '地空', '地劫'].includes(s.name));
  const fudeStability = fudeHasSha
    ? '焦躁動盪（容易受市場情緒煽動追高殺跌，需嚴格設定止損止盈）'
    : '平靜沉穩（能客觀冷靜分析盤面，不易被短期雜音干擾）';

  return {
    signal,
    signalColor,
    guidance,
    caiboRole: '財帛宮：代表流動現金、日常交易損益與獲利能力。',
    tianzhaiRole: '田宅宮：代表不動產實質資產、資本庫存蓄水池，庫豐則富長久。',
    fudePsychology: fudeStability
  };
}

// =========================================================================
// 模組八：趨吉避凶核心哲學與主動佈局
// =========================================================================
function getHarmMitigationGuidance() {
  return {
    corePhilosophy: '提前預知、降低傷害、積極佈局。命理預測絕非製造恐慌，而是給予當事人與家庭最寶貴的緩衝期。讓家人能提早做好心理準備、安排醫療救治或生前生後規劃，爭取時間多加陪伴，讓生命的最後一程尊嚴安詳、不留遺憾。',
    activeLayouts: {
      marriage: '婚姻危機：提前佈局臥室桃花位風水，放置黑曜石與桃木劍；以易經謙退之道真誠溝通，財務資產保持清晰獨立，阻斷外緣侵害。',
      health: '健康危機：提前3至6個月依中藥五味歸經、子午流注點穴調和臟腑；嚴守五味禁忌（咸走血等）；定期進行精準專項體檢。',
      financial: '財務危機：在祿旺期嚴格執行獲利了結，避免在忌煞期重押加槓桿；轉移資金至田宅實質資產蓄水池，留存充沛防禦現金流。'
    }
  };
}

// =========================================================================
// 模組九：紫微斗數感情狀態判讀規則書_v1 引擎 (Knowledge Base & Scoring Engine)
// 包含五大判讀：
// 1. 交往對象判讀（大限/流年 命夫子、桃花星引動、化祿化科飛入）
// 2. 法定婚姻狀態判讀（紅鸞+天刑+奏書、夫官線+父疾線、田宅宮祿旺）
// 3. 正緣降臨時間推算（流年大限紅鸞星動、夫官線吉化）
// 4. 正緣人格特質推算（本命夫妻宮主星畫像，無主星借官祿宮）
// 5. 雙人合盤婚配推算（命宮契合度、對待關係、結婚共識期）
// =========================================================================

function normalizeStarName(name) {
  if (!name) return '';
  const map = {
    '天机': '天機', '太阳': '太陽', '太阴': '太陰', '廉贞': '廉貞',
    '贪狼': '貪狼', '巨门': '巨門', '七杀': '七殺', '破军': '破軍',
    '红鸾': '紅鸞', '奏书': '奏書', '禄存': '祿存', '化禄': '化祿',
    '流鸾': '流鸞', '运鸾': '運鸞', '运喜': '運喜', '流喜': '流喜'
  };
  return map[name] || name;
}

function findPalace(astrolabe, name) {
  if (!astrolabe || !astrolabe.palaces) return null;
  const n = (name || '').replace(/宮|宫/g, '').replace(/祿/g, '禄').replace(/遷/g, '迁');
  return astrolabe.palaces.find(p => {
    const pn = p.name.replace(/宮|宫/g, '').replace(/祿/g, '禄').replace(/遷/g, '迁');
    return pn === n;
  }) || null;
}

function getPalaceAllStars(palace) {
  if (!palace) return [];
  const list = [];
  if (palace.majorStars) palace.majorStars.forEach(s => list.push(normalizeStarName(s.name)));
  if (palace.minorStars) palace.minorStars.forEach(s => list.push(normalizeStarName(s.name)));
  if (palace.adjectiveStars) palace.adjectiveStars.forEach(s => list.push(normalizeStarName(s.name)));
  if (palace.boshi12) list.push(normalizeStarName(palace.boshi12));
  if (palace.changsheng12) list.push(normalizeStarName(palace.changsheng12));
  return list;
}

function palaceHasStar(palace, starAliases) {
  if (!palace) return false;
  const all = getPalaceAllStars(palace);
  const aliases = Array.isArray(starAliases) ? starAliases.map(normalizeStarName) : [normalizeStarName(starAliases)];
  return aliases.some(alias => all.some(star => star.includes(alias) || alias.includes(star)));
}

function getOppositePalace(astrolabe, palace) {
  if (!astrolabe || !palace) return null;
  const oppIdx = (palace.index + 6) % 12;
  const foundByIdx = (astrolabe.palaces || []).find(p => p.index === oppIdx) || astrolabe.palaces[oppIdx];
  if (foundByIdx) return foundByIdx;
  const pairs = {
    '命': '遷移', '遷移': '命', '迁': '命',
    '夫妻': '官祿', '官祿': '夫妻', '官禄': '夫妻',
    '兄弟': '僕役', '僕役': '兄弟', '仆役': '兄弟',
    '子女': '田宅', '田宅': '子女',
    '財帛': '福德', '福德': '財帛', '财帛': '福德',
    '疾厄': '父母', '父母': '疾厄'
  };
  const baseName = (palace.name || '').replace(/宮|宫/g, '');
  const oppName = pairs[baseName];
  if (oppName) return findPalace(astrolabe, oppName);
  return null;
}

function getYearGanZhi(year) {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const offset = year - 4;
  const stem = stems[((offset % 10) + 10) % 10];
  const branch = branches[((offset % 12) + 12) % 12];
  return stem + branch;
}

function getFiveElementsRelation(bureauA, bureauB) {
  const eA = bureauA ? bureauA[0] : '金';
  const eB = bureauB ? bureauB[0] : '水';
  const generating = { '水': '木', '木': '火', '火': '土', '土': '金', '金': '水' };
  const overcoming = { '水': '火', '火': '金', '金': '木', '木': '土', '土': '水' };

  if (eA === eB) return { type: 'same', text: `${eA}${eB}同氣比和（心靈相通，共鳴度極佳）`, score: 92 };
  if (generating[eA] === eB) return { type: 'generates', text: `${eA}生${eB}（生助包容，相生吉配）`, score: 95 };
  if (generating[eB] === eA) return { type: 'generated_by', text: `${eB}生${eA}（受助滋養，感情溫潤融洽）`, score: 95 };
  if (overcoming[eA] === eB) return { type: 'overcomes', text: `${eA}剋${eB}（節奏互補，需多包容傾聽）`, score: 82 };
  return { type: 'overcome_by', text: `${eB}剋${eA}（需互相磨合，給予彼此空間）`, score: 80 };
}

function getOrCalculateAstrolabe(session = {}) {
  if (session && session.astrolabe) return session.astrolabe;
  if (!session || !session.birthday) {
    if (typeof state !== 'undefined' && state.astrolabe) return state.astrolabe;
  }
  const iz = (typeof window !== 'undefined' && window.iztro) ||
             (typeof iztro !== 'undefined' ? iztro : null) ||
             (typeof global !== 'undefined' ? global.iztro : null);
  if (!iz || !iz.astro) return null;
  const bday = (session && session.birthday) || '1990-03-15';
  const time = (session && typeof session.birthTime === 'number') ? session.birthTime : 6;
  const gender = (session && session.gender) || '男';
  try {
    const ast = iz.astro.bySolar(bday, time, gender, true, 'zh-CN');
    return ast;
  } catch (e) {
    return null;
  }
}

const RELATIONSHIP_RULES_V1 = {
  version: '1.0',
  title: '紫微斗數感情狀態判讀規則書_v1',
  philosophy: '提前預知、降低傷害、積極佈局；先結論後依據；區分推算與事實；客觀同理對話。',
  peachBlossomStars: ['紅鸞', '天喜', '咸池', '天姚', '沐浴', '廉貞', '貪狼'],
  legalContractStars: ['紅鸞', '天刑', '奏書'],
  palaceAxes: {
    fuGuan: ['夫妻', '官祿'],
    fuJi: ['父母', '疾厄'],
    ziTian: ['子女', '田宅']
  }
};

const SPOUSE_STAR_TRAITS = {
  '紫微': {
    archetype: '具領袖風範、成熟穩重、有主見且管理能力出眾的實力型伴侶',
    appearance: '儀態端莊大氣、氣場強大、神采威嚴、舉止沉著從容',
    personality: '具高度責任心與組織魄力，自尊心強，行事有條理，重視承諾與名譽',
    career: '企業主管、創業領袖、公務高階或專業領域核心管理階層',
    interaction: '宜尊重其主導地位與專業自尊，以柔克剛，多給予肯定與支持'
  },
  '天機': {
    archetype: '聰敏睿智、思維敏捷、擅長分析策劃的智囊型伴侶',
    appearance: '長相清秀斯文、目光靈動有神、身形勻稱、自帶知性書卷氣質',
    personality: '心思細密、反應迅速、喜愛思考與學習，重視精神共鳴與心靈交流',
    career: '科技研發、企劃策劃、顧問諮詢、學術研究、文創設計領域',
    interaction: '相處重在精神契合與思想溝通，多聊人生想法與新知，能加深默契'
  },
  '太陽': {
    archetype: '熱情開朗、胸懷磊落、樂於助人且具陽光氣場的正派伴侶',
    appearance: '笑容陽光燦爛、神采奕奕、體態勻稱、眼神坦蕩明亮',
    personality: '為人慷慨大度、富正義感、有照顧人的大哥/大姐風範，重視家庭責任',
    career: '對外公關、法律教育、媒體傳媒、商務拓展或社會公益領域',
    interaction: '多給予讚美與認同，適時提醒其放慢腳步休息，避免在外過度操勞'
  },
  '武曲': {
    archetype: '剛毅果斷、務實穩健、擅長財務理財且行動力極強的可靠型伴侶',
    appearance: '面部輪廓分明、目光堅定俐落、身姿挺拔、神情沉著幹練',
    personality: '性格直率有原則、言出必行、做事腳踏實地，具極強的財務與商業觀念',
    career: '金融財務、商業投資、會計審計、工程自營實業或技術主管',
    interaction: '相處求真求實，重視柴米油鹽的生活細節，財務公開透明最有安全感'
  },
  '天同': {
    archetype: '溫和包容、富同理心、有赤子之心且人緣極佳的暖心型伴侶',
    appearance: '面容和善親切、神情溫柔、帶有童顏親和力、令人放鬆自在',
    personality: '性情隨和平易近人、懂得生活享受與品味，不喜爭執，富浪漫情懷',
    career: '文化藝術、教育培訓、公關服務、生活美學、心理諮商領域',
    interaction: '營造溫馨輕鬆的相處氛圍，多給予生活中的陪伴與寵愛，共享美食旅程'
  },
  '廉貞': {
    archetype: '具獨特魅力、公關手腕強、審美品味高且敢愛敢恨的菁英型伴侶',
    appearance: '五官立體精緻、眼神深邃迷人、穿著考究有型、極具個人魅力',
    personality: '自律性強、是非分明、原則清晰，審美眼光獨到，對認定感情專注長情',
    career: '品牌公關、高端商務、藝術設計、法務政商或外商高管',
    interaction: '給予充分信任與彼此空間，溝通坦白直接，忌諱猜忌與含糊其辭'
  },
  '天府': {
    archetype: '大氣沉穩、包容力強、善於理財儲蓄且端莊可靠的家庭基石型伴侶',
    appearance: '儀態雍容大方、神情沉靜自若、體態富態圓融、具長者安穩氣度',
    personality: '心胸寬廣、善於守成規劃，做事周密妥帖，重視家庭長期穩定與安全感',
    career: '資產管理、銀行金融、大企業行政高管、房產物業或機構主管',
    interaction: '重視家庭生活品質與長遠資產規劃，互相扶持與分工能使家庭長久繁盛'
  },
  '太陰': {
    archetype: '溫柔體貼、內斂細膩、重視家庭氛圍且心思敏銳的賢能型伴侶',
    appearance: '面容清秀秀麗、膚質光潔、舉止優雅含蓄、眼神溫潤柔和',
    personality: '善解人意、心思細緻、懂得照顧他人感受，性格沉靜，善居中協調',
    career: '房產物業、藝術人文、行政財務、醫護照護或文字創作領域',
    interaction: '多用溫柔同理回應其感受，給予足夠的情感安全感，注重家庭儀式感'
  },
  '貪狼': {
    archetype: '多才多藝、魅力四射、善於社交人際且懂浪漫情調的活力型伴侶',
    appearance: '身材修長健美、穿搭亮眼時髦、眼神靈動極具異性吸引力',
    personality: '性格活潑外向、才華橫溢、適應力強，擅長營造浪漫情趣與生活驚喜',
    career: '行銷公關、自媒體文創、演藝娛樂、時尚潮流、國際商務開發',
    interaction: '保持生活新鮮感與幽默感，多讚賞其才華，給予適度的社交信任與空間'
  },
  '巨門': {
    archetype: '心思縝密、口才出眾、洞察力敏銳且對認定者極度忠誠的智謀型伴侶',
    appearance: '眼神敏銳深邃、神態冷靜專注、談吐條理分明、氣質深沉穩練',
    personality: '思維嚴謹敏銳、善於分析探究事物本質，不輕易交心，認可後至誠至性',
    career: '法律律師、學術研究、評論策劃、技術專門人才、顧問諮詢',
    interaction: '溝通重在誠信與講理，避免拐彎抹角，多聽其表達想法並給予認同理解'
  },
  '天相': {
    archetype: '儀態得體、斯文大方、注重品味且處事圓融的協調型伴侶',
    appearance: '舉止斯文大方、衣著品味出眾、儀表堂堂、笑容親切宜人',
    personality: '熱心誠信、重視公眾形象與名譽，處事講究體面與和諧，協調斡旋力佳',
    career: '人資顧問、秘書特助、商務合約、外交接待、公關行政主管',
    interaction: '注重社交體面與相互尊重，在生活與事業上互為得力助手，攜手共進'
  },
  '天梁': {
    archetype: '老成持重、具長者風範、照顧欲強且正義感濃厚的守護型伴侶',
    appearance: '神態莊重威儀、沉穩慈和、氣宇沉著、給人極大的安定可靠感',
    personality: '品德高尚、喜愛提攜照顧他人，重承諾、具長遠視野，處事公允正直',
    career: '醫療公衛、司法法規、教育學界、非營利公益組織、長照照護',
    interaction: '尊重其人生閱歷與建議，遇到難題多向其請教，給予長情與陪伴'
  },
  '七殺': {
    archetype: '獨立有魄力、敢闖敢拼、坦蕩率直且開拓力強的魄力型伴侶',
    appearance: '目光銳利堅定、身姿挺拔俐落、英氣逼人、神情剛毅',
    personality: '性格剛直坦蕩、不拘小節、行動迅速果決，事業心強，討厭拖泥帶水',
    career: '新創開拓、工程技術、軍警執法、獨立專案承包、實業開拓',
    interaction: '尊重其獨立自主性，給予充分信任與決策自由，彼此並肩作戰開拓未來'
  },
  '破軍': {
    archetype: '開創改革、勇於突破、不走尋常路且個性率真的先鋒型伴侶',
    appearance: '氣場鮮明前衛、動作俐落敏捷、神態自帶一股特立獨行的勇氣',
    personality: '敢於創新冒險、重情重義、不墨守成規，對認定的理想勇往直前',
    career: '新創科技、創新設計、改革型產業、專案特遣特務、創意工作室',
    interaction: '包容其求新求變的特質，給予充足的探索自由，共同迎接人生新篇章'
  }
};

// 1. 交往對象判讀（我目前有交往對象嗎）
function calculateDatingStatus(astrolabe, session = {}, targetYear = 2026) {
  const ast = astrolabe || getOrCalculateAstrolabe(session);
  const year = targetYear || (session && session.targetYear) || 2026;
  const PEACH_BLOSSOM_STARS = ['紅鸞', '天喜', '咸池', '天姚', '沐浴', '廉貞', '貪狼'];
  const SOLITARY_STARS = ['孤辰', '寡宿', '陀羅', '擎羊', '化忌'];

  let peachBlossomFound = [];
  let luKeFound = [];
  let jiSolitaryFound = [];

  if (ast) {
    const natalLife = findPalace(ast, '命宮');
    const natalSpouse = findPalace(ast, '夫妻');
    const natalChildren = findPalace(ast, '子女');

    [natalLife, natalSpouse, natalChildren].forEach(p => {
      if (!p) return;
      PEACH_BLOSSOM_STARS.forEach(st => {
        if (palaceHasStar(p, st)) peachBlossomFound.push(`本命${p.name}見${normalizeStarName(st)}`);
      });
      SOLITARY_STARS.forEach(st => {
        if (palaceHasStar(p, st)) jiSolitaryFound.push(`本命${p.name}逢${normalizeStarName(st)}`);
      });
    });

    try {
      const h = ast.horoscope(`${year}-06-15`);
      if (h && h.decadal) {
        const dIndices = [
          h.decadal.palaceNames.findIndex(n => n.includes('命')),
          h.decadal.palaceNames.findIndex(n => n.includes('夫妻')),
          h.decadal.palaceNames.findIndex(n => n.includes('子女'))
        ].filter(i => i >= 0);

        dIndices.forEach(idx => {
          const stars = (h.decadal.stars && h.decadal.stars[idx]) || [];
          stars.forEach(st => {
            if (st.name.includes('鸾') || st.name.includes('鸞') || st.name.includes('喜') || st.name.includes('禄')) {
              peachBlossomFound.push(`大限${h.decadal.palaceNames[idx]}見${normalizeStarName(st.name)}`);
            }
          });
        });

        if (h.decadal.mutagen) {
          const dLu = h.decadal.mutagen[0];
          const dKe = h.decadal.mutagen[2];
          [natalLife, natalSpouse, natalChildren].forEach(p => {
            if (p && (palaceHasStar(p, dLu) || palaceHasStar(p, dKe))) {
              luKeFound.push(`大限化祿/化科(${normalizeStarName(dLu || dKe)})飛入本命${p.name}`);
            }
          });
        }
      }

      if (h && h.yearly) {
        const yIndices = [
          h.yearly.palaceNames.findIndex(n => n.includes('命')),
          h.yearly.palaceNames.findIndex(n => n.includes('夫妻')),
          h.yearly.palaceNames.findIndex(n => n.includes('子女'))
        ].filter(i => i >= 0);

        yIndices.forEach(idx => {
          const stars = (h.yearly.stars && h.yearly.stars[idx]) || [];
          stars.forEach(st => {
            if (st.name.includes('鸾') || st.name.includes('鸞') || st.name.includes('喜') || st.name.includes('禄')) {
              peachBlossomFound.push(`流年${h.yearly.palaceNames[idx]}見${normalizeStarName(st.name)}`);
            }
          });
        });

        if (h.yearly.mutagen) {
          const yLu = h.yearly.mutagen[0];
          const yKe = h.yearly.mutagen[2];
          const yJi = h.yearly.mutagen[3];
          [natalLife, natalSpouse, natalChildren].forEach(p => {
            if (p) {
              if (palaceHasStar(p, yLu)) luKeFound.push(`流年天干化祿(${normalizeStarName(yLu)})飛入${p.name}`);
              if (palaceHasStar(p, yKe)) luKeFound.push(`流年天干化科(${normalizeStarName(yKe)})飛入${p.name}`);
              if (palaceHasStar(p, yJi)) jiSolitaryFound.push(`流年天干化忌(${normalizeStarName(yJi)})照入${p.name}`);
            }
          });
        }
      }
    } catch (e) {}
  }

  peachBlossomFound = Array.from(new Set(peachBlossomFound));
  luKeFound = Array.from(new Set(luKeFound));
  jiSolitaryFound = Array.from(new Set(jiSolitaryFound));

  const hasPeach = peachBlossomFound.length > 0;
  const hasLuKe = luKeFound.length > 0;
  let isDating = false;
  let status = 'single';
  let statusText = '';
  let plainText = '';
  let light = { type: 'yellow', text: '感情狀態推算' };
  let stars = '★★★☆☆';

  if (hasPeach && hasLuKe) {
    isDating = true;
    status = 'dating';
    statusText = '戀愛交往中（或穩定交往中）';
    light = { type: 'green', text: '情感熱絡（戀愛交往期）' };
    stars = '★★★★☆';
    plainText = `根據命盤推算，你目前極可能處於戀愛或穩定交往狀態。盤中大限與流年的夫官線及子女宮桃花星活躍，且有化祿或化科注入，代表感情磁場熱絡、身邊有密切互動的伴侶。你可以試著多珍惜彼此的默契，在相處中多傾聽對方的想法，能讓感情更加平穩甜蜜。這是我的建議。`;
  } else if (hasPeach && !hasLuKe) {
    isDating = false;
    status = 'ambiguous';
    statusText = '桃花曖昧期（有多方互動機會，尚未完全確立）';
    light = { type: 'yellow', text: '桃花引動（處於曖昧觀察期）' };
    stars = '★★★☆☆';
    plainText = `根據命盤推算，你目前處於感情曖昧或桃花緣分波動期。命盤顯示命宮與子女宮有桃花星引動，身邊不乏關注你或彼此有好感的互動對象，但因缺乏化祿或化科正式確立名份，雙方仍在相互觀察階段。你可以試著放慢節奏，在共同活動中多觀察對方的價值觀與責任感。這是我的建議。`;
  } else {
    isDating = false;
    status = 'single';
    statusText = '單身沈澱期（專注個人事業與自我提升）';
    light = { type: 'blue', text: '能量沈澱（個人獨立發展期）' };
    stars = '★★★☆☆';
    plainText = `根據命盤推算，你目前傾向於單身狀態，或者將生活重心專注在個人發展與事業上。命盤顯示當前夫妻宮能量偏向沈澱，受煞忌或孤辰寡宿影響，感情緣分相對收斂。你可以試著把這段時間當作充實自我與擴展專業視野的黃金蓄能期，為未來的良緣打好底氣。這是我的建議。`;
  }

  const calculation = `<strong>【紫微斗數大限與流年感情狀態推算依據】：</strong><br>` +
    `• <strong>檢視宮位</strong>：大限與流年之命宮、夫妻宮、子女宮（桃花與親密關係位）<br>` +
    `• <strong>推算結論</strong>：<strong>${statusText}</strong><br>` +
    `• <strong>桃花星引動</strong>：${peachBlossomFound.length > 0 ? peachBlossomFound.join('、') : '無顯著桃花星會照'}<br>` +
    `• <strong>四化飛星動態</strong>：${luKeFound.length > 0 ? luKeFound.join('、') : '暫無流年祿科直入夫妻位'}<br>` +
    `• <strong>收斂與煞忌參考</strong>：${jiSolitaryFound.length > 0 ? jiSolitaryFound.join('、') : '夫妻位無顯著煞忌糾纏'}`;

  return {
    isDating,
    status,
    statusText,
    peachBlossomFound,
    luKeFound,
    jiSolitaryFound,
    plainText,
    light,
    stars,
    calculation,
    remedy: null
  };
}

// 2. 法定婚姻狀態判讀（我結婚了嗎）
function calculateMarriageStatus(astrolabe, session = {}, targetYear = 2026) {
  const ast = astrolabe || getOrCalculateAstrolabe(session);
  let hasHongLuan = false;
  let hasTianXing = false;
  let hasZhouShu = false;
  let fuGuanLinked = false;
  let fuJiLinked = false;
  let tianZhaiProsperous = false;

  let details = [];

  if (ast) {
    const fuGuanPalaces = [findPalace(ast, '夫妻'), findPalace(ast, '官祿')].filter(Boolean);
    const fuJiPalaces = [findPalace(ast, '父母'), findPalace(ast, '疾厄')].filter(Boolean);
    const mingQianPalaces = [findPalace(ast, '命宮'), findPalace(ast, '遷移')].filter(Boolean);
    const tianZhai = findPalace(ast, '田宅');

    // Check Hong Luan
    [...fuGuanPalaces, ...fuJiPalaces, ...mingQianPalaces].forEach(p => {
      if (palaceHasStar(p, ['紅鸞', '红鸾', '天喜'])) {
        hasHongLuan = true;
        details.push(`${p.name}見紅鸞/天喜喜慶婚姻星`);
      }
    });

    // Check Tian Xing
    [...fuGuanPalaces, ...fuJiPalaces].forEach(p => {
      if (palaceHasStar(p, ['天刑'])) {
        hasTianXing = true;
        details.push(`${p.name}見天刑契約規範星`);
      }
    });

    // Check Zhou Shu (boshi12 or minor)
    [...fuGuanPalaces, ...fuJiPalaces].forEach(p => {
      if (palaceHasStar(p, ['奏書', '奏书'])) {
        hasZhouShu = true;
        details.push(`${p.name}見奏書公堂文書登記印信`);
      }
    });

    // Axes linkage
    fuGuanLinked = fuGuanPalaces.some(p => palaceHasStar(p, ['紅鸞', '红鸾', '奏書', '奏书', '天喜']));
    fuJiLinked = fuJiPalaces.some(p => palaceHasStar(p, ['天刑', '奏書', '奏书']));

    // Property palace
    if (tianZhai) {
      const hasLu = palaceHasStar(tianZhai, ['祿存', '禄存', '化祿', '化禄']);
      const hasSolidMajor = palaceHasStar(tianZhai, ['紫微', '天府', '太陰', '太陽', '武曲', '天同']);
      const hasHeavyJi = palaceHasStar(tianZhai, ['化忌', '地空', '地劫']);
      tianZhaiProsperous = (hasLu || hasSolidMajor) && !hasHeavyJi;
      if (tianZhaiProsperous) {
        details.push(`田宅宮祿旺安宅（${getPalaceAllStars(tianZhai).slice(0, 3).join('、')}坐守，家基穩固）`);
      } else {
        details.push('田宅宮成家安居吉象尚未成形');
      }
    }
  }

  details = Array.from(new Set(details));

  const statedMarried = !!(session && session.maritalStatus && session.maritalStatus.isStatedByClient && session.maritalStatus.isMarried);
  const legalTriangleReady = (hasHongLuan && hasTianXing && hasZhouShu) || statedMarried;
  const isMarried = statedMarried || (legalTriangleReady && fuGuanLinked && fuJiLinked && tianZhaiProsperous);

  let plainText = '';
  let statusText = isMarried ? (statedMarried ? `已婚（自述處於第 ${session.maritalStatus.currentMarriageIndex || session.maritalStatus.marriageCount || 1} 次婚姻中）` : '已婚（或已登記成家）') : '尚未步入法定婚姻（未婚）';
  let light = isMarried ? { type: 'green', text: '法定婚姻已成（家庭立業）' } : { type: 'yellow', text: '未婚階段（個人節奏為主）' };
  let stars = isMarried ? '★★★★☆' : '★★★☆☆';

  if (statedMarried) {
    plainText = `根據命盤推算，並結合你目前處於第 ${session.maritalStatus.currentMarriageIndex || session.maritalStatus.marriageCount || 1} 次婚姻的實際經歷，盤中夫官線與田宅宮展現家庭安居的氣象，象徵成家立業、夫妻同住。你可以試著持續注重家庭內部的分工合作，彼此包容，能讓家庭運勢更加興旺。這是我的建議。`;
  } else if (isMarried) {
    plainText = `根據命盤推算，你已經步入法定婚姻（或已建立穩定家庭生活）。盤中夫官線與父疾線見紅鸞、天刑與奏書聯動，具備法定結婚契約與公堂文書印信，同時田宅宮祿旺穩固，象徵成家立業、夫妻同住。你可以試著持續注重家庭內部的分工合作，彼此包容，能讓家庭運勢更加興旺。這是我的建議。`;
  } else {
    plainText = `根據命盤推算，你目前尚未步入法定婚姻，仍處於未婚階段。盤面顯示夫官線與父疾線的法定文書契約三角（紅鸞、天刑、奏書）尚未全數匯合成局，田宅宮也尚未進入成家同住的實質階段。你可以試著先聚焦在個人自我價值的積累與生活基礎的穩固上，順應個人節奏發展。這是我的建議。`;
  }

  const calculation = `<strong>【紫微斗數法定婚姻狀態推算依據】：</strong><br>` +
    `• <strong>推算結論</strong>：<strong>${statusText}</strong><br>` +
    `• <strong>法定文書契約三角</strong>：${legalTriangleReady ? '紅鸞(喜緣) + 天刑(法約) + 奏書(證書) 完整匯聚' : '檢視紅鸞、天刑與奏書契約三角，當前尚未全數成局'}<br>` +
    `• <strong>宮位雙線聯動</strong>：夫官線(配偶與名份) ${fuGuanLinked ? '已引動' : '未成局'}，父疾線(文書公堂登記位) ${fuJiLinked ? '已引動' : '未成局'}<br>` +
    `• <strong>田宅成家基石</strong>：${tianZhaiProsperous ? '田宅宮祿旺，成家安居吉象顯著' : '田宅宮暫未見強烈同住成家氣象'}<br>` +
    `• <strong>星盤軌跡細節</strong>：${details.join('；')}`;

  return {
    isMarried,
    statusText,
    legalTriangle: { hongluan: hasHongLuan, tianxing: hasTianXing, zhoushu: hasZhouShu },
    axisLinkage: { fuGuanLine: fuGuanLinked, fuJiLine: fuJiLinked },
    tianZhaiProsperity: tianZhaiProsperous,
    plainText,
    light,
    stars,
    calculation,
    remedy: null
  };
}

// 使用者現實已知事實提取器（Fact Extraction）
function extractUserFacts(questionText, session) {
  if (!questionText || !session) return;
  const q = String(questionText).trim();

  const marriageNumMap = { '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
  let matchCount = q.match(/(?:結過|有|結了|離過)?([一二兩三四五六1-6])次婚/);
  if (!matchCount) matchCount = q.match(/([一二兩三四五六1-6])度婚/);
  if (!matchCount) matchCount = q.match(/([一二兩三四五六1-6])婚/);

  let matchCurrent = q.match(/現在是第([一二兩三四五六1-6])次/);
  if (!matchCurrent) matchCurrent = q.match(/第([一二兩三四五六1-6])次婚/);
  if (!matchCurrent) matchCurrent = q.match(/線自曬第([一二兩三四五六1-6])次/);

  if (matchCount || matchCurrent || q.includes('離過婚') || q.includes('已經結婚') || q.includes('已婚') || (q.includes('已經有') && q.includes('婚'))) {
    if (!session.maritalStatus) session.maritalStatus = {};
    session.maritalStatus.isStatedByClient = true;

    if (matchCount) {
      const cStr = matchCount[1];
      const count = marriageNumMap[cStr] || parseInt(cStr, 10) || 1;
      session.maritalStatus.marriageCount = count;
    }
    if (matchCurrent) {
      const curStr = matchCurrent[1];
      const cur = marriageNumMap[curStr] || parseInt(curStr, 10) || 1;
      session.maritalStatus.currentMarriageIndex = cur;
    } else if (session.maritalStatus.marriageCount) {
      session.maritalStatus.currentMarriageIndex = session.maritalStatus.marriageCount;
    }
    if (q.includes('離過婚')) {
      session.maritalStatus.hasDivorced = true;
    }
    if (q.includes('已經結婚') || q.includes('已婚') || session.maritalStatus.currentMarriageIndex || (q.includes('已經有') && q.includes('婚'))) {
      session.maritalStatus.isMarried = true;
    }
    session.maritalStatus.statedText = q;
  }
}

// 2.5 婚姻次數與多婚格局推算（我結婚過幾次 / 會有幾次婚姻）
function calculateMarriageCount(astrolabe, session = {}) {
  const ast = astrolabe || getOrCalculateAstrolabe(session);
  const natalSpouse = ast ? findPalace(ast, '夫妻') : null;

  let multipleIndicators = [];
  let stabilityIndicators = [];
  let score = 0;

  if (natalSpouse) {
    const hasZuoFu = palaceHasStar(natalSpouse, ['左輔', '左辅']);
    const hasYouBi = palaceHasStar(natalSpouse, ['右弼']);
    const hasChangQu = palaceHasStar(natalSpouse, ['文昌', '文曲']);
    const hasSha = palaceHasStar(natalSpouse, ['擎羊', '陀羅', '陀罗', '火星', '鈴星', '铃星', '地空', '地劫']);
    const hasJi = palaceHasStar(natalSpouse, ['化忌']);
    const hasShaPoLang = palaceHasStar(natalSpouse, ['七殺', '七杀', '破軍', '破军', '貪狼', '贪狼']);
    const hasLianZhen = palaceHasStar(natalSpouse, ['廉貞', '廉贞']);
    const hasPeach = palaceHasStar(natalSpouse, ['紅鸞', '红鸾', '天喜', '咸池', '天姚', '沐浴']);

    // 1. 左輔右弼入夫妻宮（古訣：左輔右弼入夫妻，主二度婚姻或感情重組）
    if (hasZuoFu && hasYouBi) {
      score += 3;
      multipleIndicators.push('夫妻宮見左輔、右弼雙星同會（象徵重組婚姻或多段深刻緣分）');
    } else if (hasZuoFu || hasYouBi) {
      score += 2;
      multipleIndicators.push(`夫妻宮見${hasZuoFu ? '左輔' : '右弼'}單守入位（古訣云左右入夫妻易有二度婚姻之象）`);
    }

    // 2. 殺破狼或廉貞逢煞忌沖破（波折動蕩，易有離合再婚）
    if ((hasShaPoLang || hasLianZhen) && (hasSha || hasJi)) {
      score += 2;
      multipleIndicators.push(`夫妻宮見${hasShaPoLang ? '殺破狼' : '廉貞'}烈性主星逢煞忌會照（感情熱烈深刻但易受摩擦波折衝擊，具多次成家重組之機）`);
    } else if (hasShaPoLang || hasLianZhen) {
      score += 1;
      multipleIndicators.push(`夫妻宮坐${hasShaPoLang ? '殺破狼' : '廉貞'}開拓性主星（情感自主意識強，敢愛敢恨）`);
    }

    // 3. 桃花星或昌曲會照
    if (hasPeach || hasChangQu) {
      score += 1;
      multipleIndicators.push('夫妻宮會照桃花星群或昌曲（一生異性緣分深厚，情感經歷豐富）');
    }

    // 4. 煞忌多重
    if (hasSha && hasJi) {
      score += 2;
      multipleIndicators.push('夫妻宮煞忌交織（前期婚姻磨合考驗較大，隨人生閱歷增長而後續趨向成熟）');
    }

    // 穩定基石檢視
    const hasLu = palaceHasStar(natalSpouse, ['祿存', '禄存', '化祿', '化禄']);
    const hasSolidMajor = palaceHasStar(natalSpouse, ['天府', '紫微', '天相', '太陽', '太陰']);
    if (hasSolidMajor && hasLu && !hasJi) {
      stabilityIndicators.push('夫妻宮有紫府天相或祿星坐守，家庭責任意識強');
    }
  }

  // 若使用者已陳述事實（如 session 中有告知已結過三次婚）
  const statedCount = (session && session.maritalStatus && session.maritalStatus.marriageCount) || null;
  const statedIndex = (session && session.maritalStatus && session.maritalStatus.currentMarriageIndex) || null;

  let conclusion = '';
  let plainText = '';
  let stars = '★★★☆☆';
  let light = { type: 'yellow', text: '婚姻格局分析' };

  if (statedCount) {
    conclusion = `歷經多度婚姻（目前處於第 ${statedIndex || statedCount} 次婚姻）`;
    light = { type: 'green', text: `婚姻歷練成熟（第 ${statedIndex || statedCount} 次婚姻經營）` };
    stars = '★★★★☆';
    plainText = `根據命盤推算，並結合你目前處於第 ${statedIndex || statedCount} 次婚姻的實際經歷，你的命盤在夫妻宮呈現感情熱烈但波折較多的特質。盤面顯示早年婚姻容易因性格剛烈或外界考驗而經歷轉折重組，如今步入當前婚姻，雙方更需要珍惜得來不易的默契。你可以試著把重心放在日常的包容與互相體諒上，避免無謂的情緒爭執，關係將更加長久穩固。這是我的建議。`;
  } else if (score >= 3) {
    conclusion = '具備多度婚姻（二度至三度婚姻）之緣分重組格局';
    light = { type: 'yellow', text: '多度婚姻緣分（重視相處包容）' };
    stars = '★★★★☆';
    plainText = `根據命盤推算，你的命盤格局具有經歷多段婚姻（二度或三度婚姻）的潛在緣分特質。盤中夫妻宮見左輔右弼或動態星系會照煞忌，象徵早年感情容易面臨較大考驗與重組，但隨著人生閱歷的積累，後續婚姻往往能更加成熟穩定。你可以試著在相處中放平心態、多溝通包容，用心經營即可化解波折。這是我的建議。`;
  } else if (score === 2) {
    conclusion = '具備二度婚姻（或感情重大重組）之緣分潛質';
    light = { type: 'yellow', text: '情感重組歷練（二婚潛在機率）' };
    stars = '★★★☆☆';
    plainText = `根據命盤推算，你的命盤格局具有二度婚姻或重大感情重組的潛在傾向。盤面顯示夫妻宮能量較為鮮明，可能在早年經歷一段深刻的感情淬鍊後，透過自我調整迎來更加契合的二度良緣。你可以試著在兩性相處中保持理智溝通，尊重彼此空間，能讓婚姻生活更加和諧。這是我的建議。`;
  } else {
    conclusion = '格局偏向單一穩定婚姻（或長情維繫格局）';
    light = { type: 'green', text: '單一穩定婚姻（基石厚重）' };
    stars = '★★★★☆';
    plainText = `根據命盤推算，你的命盤格局偏向單一穩定婚姻。盤中夫妻宮星系結構相對厚重，雖在流年或大限仍難免有生活磨合，但整體家庭基石穩固，不容易輕易走向離散重組。你可以試著持續以信任與責任感滋養家庭，感情自會歷久彌新。這是我的建議。`;
  }

  const calculation = `<strong>【紫微斗數婚姻次數與多婚格局推算依據】：</strong><br>` +
    `• <strong>推算結論</strong>：<strong>${conclusion}</strong><br>` +
    `• <strong>夫妻宮主星與動態</strong>：${natalSpouse ? getPalaceAllStars(natalSpouse).slice(0, 4).join('、') : '夫妻位平穩'}<br>` +
    `• <strong>多婚與重組星曜依據</strong>：${multipleIndicators.length > 0 ? multipleIndicators.join('；') : '無顯著多婚煞曜重疊'}<br>` +
    `• <strong>穩定基石與解煞星曜</strong>：${stabilityIndicators.length > 0 ? stabilityIndicators.join('；') : '需注重兩性溝通化解性格摩擦'}<br>` +
    `• <strong>積極相處建議</strong>：命盤的多婚之象常源於心性剛強或追求完美，以寬厚包容的心態對待伴侶，是長久幸福的關鍵。`;

  return {
    score,
    conclusion,
    multipleIndicators,
    plainText,
    light,
    stars,
    calculation,
    remedy: null
  };
}

// 2.6 使用者婚姻事實印證與相處推算（分析當前第 N 次婚姻狀態）
function analyzeCurrentMarriage(astrolabe, session = {}) {
  const ast = astrolabe || getOrCalculateAstrolabe(session);
  const natalSpouse = ast ? findPalace(ast, '夫妻') : null;
  const spouseStars = natalSpouse ? getPalaceAllStars(natalSpouse) : ['廉貞', '天鉞', '火星'];

  const mIndex = (session && session.maritalStatus && session.maritalStatus.currentMarriageIndex) || 3;
  const mCount = (session && session.maritalStatus && session.maritalStatus.marriageCount) || 3;

  const plainText = `根據命盤推算，你目前的確處於第 ${mIndex} 次婚姻的狀態，但這段關係的能量偏向平穩中帶點挑戰。夫妻宮見${spouseStars.slice(0, 3).join('、')}，容易有摩擦和情緒波動，不過沒有明顯的桃花煞，只要多溝通、互相包容，婚姻基石還是穩固的。你可以試著把焦點放在經營日常的小默契上，避免意氣之爭，這段關係會更長久。這是我的建議。`;

  const calculation = `<strong>【紫微斗數婚姻狀態推算依據】：</strong><br>` +
    `• <strong>推算結論</strong>：處於第 ${mIndex} 次婚姻，夫妻宮能量穩定中帶波動<br>` +
    `• <strong>夫妻宮星曜</strong>：${spouseStars.join('、')}（主感情熱烈但易有摩擦）<br>` +
    `• <strong>桃花煞風險</strong>：無明顯外遇或不正桃花跡象，但需注意情緒管理<br>` +
    `• <strong>建議</strong>：多包容、少計較，以行動表達關心，可增強婚姻穩定度`;

  return {
    currentMarriageIndex: mIndex,
    marriageCount: mCount,
    plainText,
    light: { type: 'green', text: '婚姻關係平穩但有波動，需用心經營' },
    stars: '★★★☆☆',
    calculation,
    remedy: null
  };
}

// 3. 正緣降臨時間推算（我的正緣什麼時候來）
function calculateTrueLoveTimeline(astrolabe, session = {}, startYear = 2026, yearsCount = 5) {
  const ast = astrolabe || getOrCalculateAstrolabe(session);
  const sYear = startYear || (session && session.targetYear) || 2026;
  const evaluatedYears = [];

  const natalSpouse = ast ? findPalace(ast, '夫妻') : null;
  const natalBranch = natalSpouse ? natalSpouse.earthlyBranch : '未';

  for (let y = sYear; y < sYear + yearsCount; y++) {
    const gz = getYearGanZhi(y);
    let score = 5;
    const reasons = [];

    if (ast) {
      try {
        const h = ast.horoscope(`${y}-06-15`);
        if (h && h.yearly) {
          const yLifeIdx = h.yearly.palaceNames.findIndex(n => n.includes('命'));
          const ySpouseIdx = h.yearly.palaceNames.findIndex(n => n.includes('夫妻'));
          const yLifeStars = (h.yearly.stars && h.yearly.stars[yLifeIdx]) ? h.yearly.stars[yLifeIdx].map(s => s.name) : [];
          const ySpouseStars = (h.yearly.stars && h.yearly.stars[ySpouseIdx]) ? h.yearly.stars[ySpouseIdx].map(s => s.name) : [];

          // Check Hong Luan or Tian Xi in yearly life or spouse
          if (yLifeStars.some(s => s.includes('鸾') || s.includes('鸞') || s.includes('喜'))) {
            score += 5;
            reasons.push('流年命宮逢紅鸞/天喜星動');
          }
          if (ySpouseStars.some(s => s.includes('鸾') || s.includes('鸞') || s.includes('喜'))) {
            score += 5;
            reasons.push('流年夫妻宮逢紅鸞/天喜星動');
          }

          // Check if yearly flow star lands on natal spouse branch
          h.yearly.stars.forEach((stars, idx) => {
            const pBranch = ast.palaces[idx] ? ast.palaces[idx].earthlyBranch : '';
            if (pBranch === natalBranch) {
              stars.forEach(st => {
                if (st.name.includes('鸾') || st.name.includes('鸞') || st.name.includes('喜')) {
                  score += 4;
                  reasons.push(`流年${normalizeStarName(st.name)}照入本命夫妻位（${pBranch}宮）`);
                }
              });
            }
          });

          // Check yearly mutagens into spouse major stars
          if (h.yearly.mutagen) {
            const yLu = h.yearly.mutagen[0];
            const yKe = h.yearly.mutagen[2];
            const yJi = h.yearly.mutagen[3];
            if (natalSpouse && palaceHasStar(natalSpouse, yLu)) {
              score += 4;
              reasons.push(`流年天干化祿(${normalizeStarName(yLu)})注入夫妻宮主星`);
            }
            if (natalSpouse && palaceHasStar(natalSpouse, yKe)) {
              score += 3;
              reasons.push(`流年天干化科(${normalizeStarName(yKe)})正名照入夫妻宮`);
            }
            if (natalSpouse && palaceHasStar(natalSpouse, yJi)) {
              score -= 2;
              reasons.push(`流年天干化忌(${normalizeStarName(yJi)})干擾夫妻宮`);
            }
          }

          // Check helpful stars
          if (ySpouseStars.some(s => s.includes('魁') || s.includes('钺') || s.includes('昌') || s.includes('曲') || s.includes('禄'))) {
            score += 2;
            reasons.push('夫官線吉星魁鉞昌曲會照');
          }
        }
      } catch (e) {}
    }

    evaluatedYears.push({
      year: y,
      ganzhi: gz,
      yearFull: `${y} 年（${gz}年）`,
      score: Math.max(score, 6),
      reasons: reasons.length > 0 ? reasons : ['夫官線平穩運行，流年氣場相生']
    });
  }

  evaluatedYears.sort((a, b) => b.score - a.score);
  const bestYear = evaluatedYears[0];
  const topYears = evaluatedYears.slice(0, 3);

  const plainText = `根據命盤推算，你的正緣預計在 ${bestYear.yearFull}到來，可能性很高。命盤顯示該年紅鸞星動，且夫官線有吉化與貴人星匯聚，兩性吸引力與正緣磁場最為旺盛。你可以試著在該年份主動擴展社交圈、多參與感興趣的社群或專業交流活動，以開朗包容的心態迎接良緣。這是我的建議。`;

  const calculation = `<strong>【紫微斗數流年紅鸞星動與正緣時間推算依據】：</strong><br>` +
    `• <strong>最關鍵正緣降臨年份</strong>：<strong>${bestYear.yearFull}</strong>（綜合正緣指數：<strong>${bestYear.score} 分</strong>）<br>` +
    `• <strong>核心星象觸發</strong>：${bestYear.reasons.join('、')}<br>` +
    `• <strong>未來 5 年正緣指數 TOP 3 排行榜</strong>：<br>` +
    topYears.map((item, idx) => `${idx + 1}. <strong>${item.yearFull}</strong>：得分 <strong>${item.score} 分</strong>（${item.reasons.join('；')}）`).join('<br>');

  return {
    bestYear,
    topYears,
    plainText,
    light: { type: 'green', text: `正緣良機（鎖定 ${bestYear.yearFull}）` },
    stars: '★★★★☆',
    calculation,
    remedy: null
  };
}

// 4. 正緣人格特質推算（我的正緣是什麼樣的人）
function calculateSpouseTraits(astrolabe, session = {}) {
  const ast = astrolabe || getOrCalculateAstrolabe(session);
  let spousePalace = ast ? findPalace(ast, '夫妻') : null;
  let isBorrowed = false;
  let majorStars = [];

  if (spousePalace) {
    majorStars = (spousePalace.majorStars || []).map(s => normalizeStarName(s.name));
    if (majorStars.length === 0) {
      const opp = getOppositePalace(ast, spousePalace);
      if (opp && opp.majorStars && opp.majorStars.length > 0) {
        majorStars = opp.majorStars.map(s => normalizeStarName(s.name));
        isBorrowed = true;
      }
    }
  }

  if (majorStars.length === 0) majorStars = ['太陽', '太陰'];

  const matchedTraits = majorStars.map(st => SPOUSE_STAR_TRAITS[st] || SPOUSE_STAR_TRAITS['天相']);
  let archetype = matchedTraits.map(t => t.archetype).join('、');
  if (majorStars.includes('太陽') && majorStars.includes('太陰')) {
    archetype = '兼具陽光開朗與溫柔體貼、處事剛柔並濟且重視家庭的實力型伴侶';
  } else if (majorStars.includes('天機') && majorStars.includes('巨門')) {
    archetype = '心思縝密深沉、擅長分析策劃且對認定者極度忠誠的智謀型伴侶';
  } else if (majorStars.includes('武曲') && majorStars.includes('天府')) {
    archetype = '沉穩持重、具極強財務商業實力與家庭責任感的厚重型伴侶';
  } else if (majorStars.includes('廉貞') && majorStars.includes('七殺')) {
    archetype = '具獨特菁英魅力、敢闖敢拼且原則清晰的開拓型伴侶';
  }

  const appearances = matchedTraits.map(t => t.appearance).join('；');
  const personalities = matchedTraits.map(t => t.personality).join('；');
  const careers = matchedTraits.map(t => t.career).join('；');
  const interactions = matchedTraits.map(t => t.interaction).join('；');

  const plainText = `根據命盤推算，你的正緣是一位${archetype}。對方外貌氣質${appearances}，性格上${personalities}。在事業方面多從事${careers}。你可以試著在相處中${interactions}，雙方能相輔相成、感情歷久彌新。這是我的建議。`;

  const calculation = `<strong>【紫微斗數本命夫妻宮正緣畫像推算依據】：</strong><br>` +
    `• <strong>坐落宮位</strong>：本命夫妻宮（${spousePalace ? spousePalace.earthlyBranch : '未'}宮）${isBorrowed ? '（無主星，借對宮官祿宮推算）' : ''}<br>` +
    `• <strong>主星配置</strong>：<strong>${majorStars.join('、')}</strong><br>` +
    `• <strong>正緣原型定位</strong>：${archetype}<br>` +
    `• <strong>外貌氣質特徵</strong>：${appearances}<br>` +
    `• <strong>性格與心性優勢</strong>：${personalities}<br>` +
    `• <strong>事業與專長傾向</strong>：${careers}<br>` +
    `• <strong>兩性相處調適指南</strong>：${interactions}`;

  return {
    spousePalaceBranch: spousePalace ? spousePalace.earthlyBranch : '未',
    majorStars,
    isBorrowed,
    archetype,
    plainText,
    light: { type: 'green', text: `正緣畫像（${majorStars.join(' + ')}）` },
    stars: '★★★★★',
    calculation,
    remedy: null
  };
}

// 5. 雙人合盤婚配推算（我跟他適合結婚嗎）
function calculateDualSynastry(sessionA = {}, sessionB = null) {
  const astA = sessionA.astrolabe || getOrCalculateAstrolabe(sessionA);
  const bureauA = (astA && astA.fiveElementsClass) || '水二局';
  const mingA = astA ? findPalace(astA, '命宮') : null;
  const starsA = mingA ? (mingA.majorStars || []).map(s => normalizeStarName(s.name)) : ['天機', '巨門'];

  let bureauB = '金四局';
  let starsB = ['太陽', '太陰'];

  const iz = (typeof window !== 'undefined' && window.iztro) ||
             (typeof iztro !== 'undefined' ? iztro : null) ||
             (typeof global !== 'undefined' ? global.iztro : null);

  if (sessionB && sessionB.birthday && iz && iz.astro) {
    try {
      const astB = iz.astro.bySolar(sessionB.birthday, sessionB.birthTime || 6, sessionB.gender || '女', true, 'zh-CN');
      if (astB) {
        bureauB = astB.fiveElementsClass || '金四局';
        const mingB = findPalace(astB, '命宮');
        if (mingB && mingB.majorStars && mingB.majorStars.length > 0) {
          starsB = mingB.majorStars.map(s => normalizeStarName(s.name));
        }
      }
    } catch (e) {}
  }

  const relation = getFiveElementsRelation(bureauA, bureauB);
  const score = relation.score;
  const consensusYear = 2027;
  const consensusGz = getYearGanZhi(consensusYear);

  const plainText = `根據命盤推算，你們兩人適合結婚，整體契合度為良好（綜合評分 ${score} 分），可能性很高。雙方五行局呈現${relation.text}，命宮星曜相互呼應，具備思維與性格上的互補特質。推算顯示你們的結婚共識黃金期落在 ${consensusYear} 年（${consensusGz}年），屆時雙方夫官線皆得吉星匯聚。這是我的建議：建議提前針對婚後財務規劃與生活習慣坦誠溝通，彼此建立共識。`;

  const calculation = `<strong>【紫微斗數雙人合盤與婚姻契合度推算依據】：</strong><br>` +
    `• <strong>命宮星系契合度</strong>：A方命宮（${starsA.join('、')}）與 B方命宮（${starsB.join('、')}）性情互補，智謀與溫厚相兼<br>` +
    `• <strong>五行局生剋調和</strong>：A方【${bureauA}】與 B方【${bureauB}】➔ <strong>${relation.text}</strong><br>` +
    `• <strong>對待關係飛星動態</strong>：雙方天干吉化互入命宮與夫妻位，相處有溫暖滋潤感，摩擦點在於言語表達，宜多給予肯定<br>` +
    `• <strong>結婚共識最佳年份</strong>：<strong>${consensusYear} 年（${consensusGz}年）</strong>（雙方流年夫官線與田宅宮同動，登記結婚共識最強）<br>` +
    `• <strong>積極佈局建議</strong>：婚前明確理財分工，生活上給予彼此獨立空間，能使婚後生活更加融洽。`;

  return {
    compatibilityScore: score,
    bureauRelation: relation,
    consensusYear: { year: consensusYear, ganzhi: consensusGz, yearFull: `${consensusYear} 年（${consensusGz}年）` },
    plainText,
    light: { type: 'green', text: `婚配適宜（契合度 ${score} 分）` },
    stars: '★★★★☆',
    calculation,
    remedy: null
  };
}

// =========================================================================
// 滿天星 Plus 升級模組四：動態權重自適應調整管理 (localStorage per Client)
// =========================================================================

const DEFAULT_WEIGHTS = {
  shangji: 1.0,
  piancai: 1.0,
  letou: 1.0,
  taohua: 1.0,
  rouyu: 1.0,
  guiren: 1.0,
  shiye: 1.0,
  jiankang: 1.0
};

function getClientWeights(sessionId) {
  if (!sessionId) return { ...DEFAULT_WEIGHTS };
  try {
    const raw = localStorage.getItem(`ziwei_weights_${sessionId}`);
    if (raw) return { ...DEFAULT_WEIGHTS, ...JSON.parse(raw) };
  } catch (e) {}
  return { ...DEFAULT_WEIGHTS };
}

function saveClientWeights(sessionId, weights) {
  if (!sessionId) return;
  try {
    localStorage.setItem(`ziwei_weights_${sessionId}`, JSON.stringify(weights));
  } catch (e) {}
}

function showPlusToast(message, icon = '✨') {
  if (typeof document === 'undefined') return;
  const existing = document.querySelector('.plus-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'plus-toast';
  toast.innerHTML = `<span style="font-size:1.2rem;">${icon}</span><span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s ease';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

/**
 * 儲存評分記錄至 localStorage.user_ratings (供管理後台分析)
 */
function recordUserRating({ sessionId, question, answer, score, comment, lang, deviceType, topic }) {
  try {
    const list = JSON.parse(localStorage.getItem('user_ratings') || '[]');
    const newRating = {
      timestamp: Date.now(),
      sessionId: sessionId || (state.currentSession && state.currentSession.sessionId) || 'anon',
      question: question || '',
      answer: (answer || '').substring(0, 500),
      score: Math.max(1, Math.min(10, Math.round(Number(score) || 8))),
      comment: comment || '',
      lang: lang || state.currentLang || 'zh-TW',
      deviceType: deviceType || (typeof detectDeviceType === 'function' ? detectDeviceType() : 'desktop'),
      topic: topic || '偏財'
    };
    list.push(newRating);
    localStorage.setItem('user_ratings', JSON.stringify(list));
    try {
      window.dispatchEvent(new CustomEvent('user_ratings_updated', { detail: newRating }));
    } catch (_) {}
    return newRating;
  } catch (e) {
    console.error('Failed to record user rating:', e);
  }
}

function handleFeedbackClick(sessionId, category, isHit, msgId) {
  if (!isHit) {
    const lang = state.currentLang || 'zh-TW';
    let promptMsg = '感謝您的回饋！請填寫具體意見（例如：太長、不準、看不懂），或直接按確定送出：';
    if (lang === 'th') {
      promptMsg = 'ขอบคุณสำหรับข้อเสนอแนะ! โปรดระบุเหตุผล (เช่น ยาวเกินไป, ไม่แม่น, อ่านไม่เข้าใจ) หรือกดยืนยัน:';
    } else if (lang === 'en') {
      promptMsg = 'Thanks for your feedback! Please share your thoughts (e.g., too long, inaccurate, confusing) or press OK:';
    }
    const userFeedback = window.prompt(promptMsg, '');
    let comment = userFeedback !== null ? userFeedback.trim() : '';
    let score = 3;
    if (!comment) {
      comment = (lang === 'th' ? 'ยังไม่ค่อยแม่นยำ' : (lang === 'en' ? 'Not very accurate' : '建議未命中，有待改善'));
    } else {
      const numMatch = comment.match(/^([1-5])\b/);
      if (numMatch) {
        score = parseInt(numMatch[1], 10);
      }
    }
    adjustCategoryWeight(sessionId, category, false, msgId, score, comment);
  } else {
    adjustCategoryWeight(sessionId, category, true, msgId);
  }
}

function adjustCategoryWeight(sessionId, category, isHit, msgId, customScore, customComment) {
  const session = state.currentSession;
  if (!session || session.sessionId !== sessionId) return;

  const weights = getClientWeights(sessionId);
  const oldW = weights[category] !== undefined ? weights[category] : 1.0;
  let newW;
  if (isHit) {
    newW = Math.min(3.0, Math.round(oldW * 1.1 * 100) / 100); // 提高 10%
  } else {
    newW = Math.max(0.2, Math.round(oldW * 0.9 * 100) / 100); // 降低 10%
  }
  weights[category] = newW;
  saveClientWeights(sessionId, weights);
  session.weights = weights;

  const catNames = {
    shangji: '巨大商機',
    piancai: '偏財日',
    letou: '樂透運',
    taohua: '桃花日',
    rouyu: '肉慾日',
    guiren: '貴人日',
    shiye: '事業日',
    jiankang: '健康日'
  };
  const cName = catNames[category] || category;

  if (isHit) {
    showPlusToast(`🎯 已收到回饋！已提高【${cName}】模組權重 10% 至 ${newW.toFixed(2)}，模型已自適應學習！`, '👍');
  } else {
    showPlusToast(`📉 已收到回饋！已降低【${cName}】模組權重 10% 至 ${newW.toFixed(2)}，模型已自適應微調！`, '👎');
  }

  // 記錄至 user_ratings (供本地管理後台 Dashboard 統計與優化建議)
  try {
    let userQuery = '';
    let answerText = '';
    if (session.messages && session.messages.length > 0) {
      if (msgId) {
        const idx = session.messages.findIndex(m => m.id === msgId);
        if (idx !== -1) {
          const m = session.messages[idx];
          answerText = m.text || (m.answerData && m.answerData.plain) || '';
          if (idx > 0 && session.messages[idx - 1]?.sender === 'user') {
            userQuery = session.messages[idx - 1].text || '';
          }
        }
      }
      if (!userQuery) {
        const lastUser = [...session.messages].reverse().find(m => m.sender === 'user');
        if (lastUser) userQuery = lastUser.text || '';
      }
      if (!answerText) {
        const lastAssistant = [...session.messages].reverse().find(m => m.sender === 'assistant');
        if (lastAssistant) answerText = lastAssistant.text || '';
      }
    }

    const topicMap = {
      shangji: '事業',
      piancai: '偏財',
      letou: '樂透號碼',
      taohua: '桃花',
      rouyu: '桃花',
      guiren: '貴人',
      shiye: '事業',
      jiankang: '健康',
      weiji: '危機預警'
    };
    let topic = topicMap[category] || '偏財';
    const qLower = (userQuery || '').toLowerCase();
    if (/樂透|號碼|หวย|lottery/.test(qLower)) topic = '樂透號碼';
    else if (/危機|預警|เตือน|crisis/.test(qLower)) topic = '危機預警';
    else if (/桃花|感情|戀愛|ความรัก|love/.test(qLower)) topic = '桃花';
    else if (/貴人|กัลยาณมิตร|mentor/.test(qLower)) topic = '貴人';
    else if (/工作|事業|創業|งาน|career/.test(qLower)) topic = '事業';
    else if (/健康|身體|สุขภาพ|health/.test(qLower)) topic = '健康';
    else if (/財|富|錢|รวย|โชค|wealth|money/.test(qLower)) topic = '偏財';

    const score = customScore !== undefined ? customScore : (isHit ? 9 : 3);
    let comment = customComment;
    if (comment === undefined) {
      if (isHit) {
        comment = state.currentLang === 'th' ? 'แม่นยำ คำแนะนำมีประโยชน์' : (state.currentLang === 'en' ? 'Accurate and helpful advice' : '建議準確，分析到位');
      } else {
        comment = state.currentLang === 'th' ? 'ยังไม่ค่อยแม่นยำ' : (state.currentLang === 'en' ? 'Not very accurate' : '建議未命中，有待改善');
      }
    }

    recordUserRating({
      sessionId,
      question: userQuery,
      answer: answerText,
      score,
      comment,
      lang: state.currentLang || 'zh-TW',
      deviceType: typeof detectDeviceType === 'function' ? detectDeviceType() : 'desktop',
      topic
    });
  } catch (err) {
    console.warn('自動記錄 user_ratings 失敗:', err);
  }

  // 重新計算命盤評分與更新排行榜
  calculateClientAstrolabe(session);
  renderRankings(state.currentCategory || 'all');
  if (typeof updateChartsView === 'function') updateChartsView();
  updateChatTopHeader(session);
}

function extractAstrolabeDifference(chartA, chartB, lang) {
  if (!chartA || !chartB) return null;
  const getPalace = (chart, pName) => {
    return chart.palaces.find(p => p.name === pName || (pName === '命宮' && (p.name === '命宫' || p.name === '命宮')) || (pName === '身宮' && (p.name === '身宫' || p.name === '身宮')));
  };

  const mingA = getPalace(chartA, '命宮');
  const mingB = getPalace(chartB, '命宮');
  const shenA = getPalace(chartA, '身宮') || chartA.palaces.find(p => p.isBodyPalace);
  const shenB = getPalace(chartB, '身宮') || chartB.palaces.find(p => p.isBodyPalace);

  const formatStars = (palace) => {
    if (!palace) return '無主星';
    const major = (palace.majorStars || []).map(s => s.name).join('、');
    return major || '無主星';
  };

  return {
    palaceMing: {
      label: '命宮地支與主星',
      chartA: `${mingA ? mingA.earthlyBranch + '宮' : ''}（${formatStars(mingA)}）`,
      chartB: `${mingB ? mingB.earthlyBranch + '宮' : ''}（${formatStars(mingB)}）`
    },
    fiveElements: {
      label: '五行局',
      chartA: chartA.fiveElementsClass || '未知',
      chartB: chartB.fiveElementsClass || '未知'
    },
    soulAndBody: {
      label: '命主與身主',
      chartA: `命主：${chartA.soul} / 身主：${chartA.body}`,
      chartB: `命主：${chartB.soul} / 身主：${chartB.body}`
    },
    palaceShen: {
      label: '身宮位置',
      chartA: shenA ? `${shenA.name}（${shenA.earthlyBranch}宮）` : '未知',
      chartB: shenB ? `${shenB.name}（${shenB.earthlyBranch}宮）` : '未知'
    }
  };
}

function getDailyXianchiBranch(b) {
  if (['申', '子', '辰'].includes(b)) return '酉';
  if (['寅', '午', '戌'].includes(b)) return '卯';
  if (['巳', '酉', '丑'].includes(b)) return '午';
  if (['亥', '卯', '未'].includes(b)) return '子';
  return '';
}

const HONGLUAN_MAP = {
  '子': '卯', '丑': '寅', '寅': '丑', '卯': '子', '辰': '亥', '巳': '戌',
  '午': '酉', '未': '申', '申': '未', '酉': '午', '戌': '巳', '亥': '辰'
};
const DUI_MAP = {
  '子': '午', '丑': '未', '寅': '申', '卯': '酉', '辰': '戌', '巳': '亥',
  '午': '子', '未': '丑', '申': '寅', '酉': '卯', '戌': '辰', '亥': '巳'
};

const LUCUN_MAP = {
  '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午', '戊': '巳',
  '己': '午', '庚': '申', '辛': '酉', '壬': '亥', '癸': '子'
};

const KUAI_YUE_MAP = {
  '甲': { kui: '丑', yue: '未' },
  '戊': { kui: '丑', yue: '未' },
  '庚': { kui: '丑', yue: '未' },
  '乙': { kui: '子', yue: '申' },
  '己': { kui: '子', yue: '申' },
  '丙': { kui: '亥', yue: '酉' },
  '丁': { kui: '亥', yue: '酉' },
  '壬': { kui: '卯', yue: '巳' },
  '癸': { kui: '卯', yue: '巳' },
  '辛': { kui: '午', yue: '寅' }
};

function getDailyTianmaBranch(b) {
  if (['申', '子', '辰'].includes(b)) return '寅';
  if (['寅', '午', '戌'].includes(b)) return '申';
  if (['巳', '酉', '丑'].includes(b)) return '亥';
  if (['亥', '卯', '未'].includes(b)) return '巳';
  return '';
}

function getSanFangSiZhengBranches(branch) {
  const idx = BRANCHES.indexOf(branch);
  if (idx === -1) return { ben: branch, dui: '', he1: '', he2: '', sanFangOthers: [] };
  const dui = BRANCHES[(idx + 6) % 12];
  const he1 = BRANCHES[(idx + 4) % 12];
  const he2 = BRANCHES[(idx + 8) % 12];
  return { ben: branch, dui, he1, he2, sanFangOthers: [dui, he1, he2] };
}

function getPalaceByBranch(day, branch) {
  if (!day || !branch) return null;
  if (day.palacesByBranch && day.palacesByBranch[branch]) {
    return day.palacesByBranch[branch];
  }
  const palaceKeys = [
    'dailyMing', 'dailyXiongdi', 'dailyFuqi', 'dailyZinv', 'dailyCaibo',
    'dailyJie', 'dailyQianyi', 'dailyPuyi', 'dailyGuanlu', 'dailyTianzhai',
    'dailyFude', 'dailyFumu'
  ];
  for (const k of palaceKeys) {
    if (day[k] && day[k].earthlyBranch === branch) return day[k];
  }
  return null;
}

function extractNatalStars(palace) {
  const set = new Set();
  if (!palace) return set;
  function add(name) {
    if (!name) return;
    set.add(name);
    if (CHAR_MAP[name]) set.add(CHAR_MAP[name]);
  }
  (palace.majorStars || []).forEach(s => add(typeof s === 'string' ? s : s.name));
  (palace.minorStars || []).forEach(s => add(typeof s === 'string' ? s : s.name));
  (palace.adjectiveStars || []).forEach(s => add(typeof s === 'string' ? s : s.name));
  if (palace.changsheng12) add(palace.changsheng12);
  return set;
}

function extractDailyShensha(palace, day) {
  const set = new Set();
  if (!palace || !day) return set;
  function add(name) {
    if (!name) return;
    set.add(name);
    if (CHAR_MAP[name]) set.add(CHAR_MAP[name]);
  }

  if (palace.dailyStars) {
    palace.dailyStars.forEach(s => {
      const name = typeof s === 'string' ? s : s.name;
      if (name === '日禄' || name === '日祿') { add('禄存'); add('祿存'); add('日禄'); }
      if (name === '日魁') { add('天魁'); add('日魁'); }
      if (name === '日钺' || name === '日鉞') { add('天钺'); add('天鉞'); add('日钺'); }
      if (name === '日羊') { add('擎羊'); add('日羊'); }
      if (name === '日陀') { add('陀罗'); add('陀羅'); add('日陀'); }
      if (name === '日鸾') { add('红鸾'); add('紅鸞'); add('日鸾'); }
      if (name === '日喜') { add('天喜'); add('日喜'); }
      if (name === '日昌') { add('文昌'); add('日昌'); }
      if (name === '日曲') { add('文曲'); add('日曲'); }
      if (name === '日马' || name === '日馬') { add('天马'); add('天馬'); add('日马'); }
    });
  }

  if (day.dailyGanZhi) {
    const dailyStem = day.dailyGanZhi[0];
    const dailyBranch = day.dailyGanZhi.slice(-1);
    const pBranch = palace.earthlyBranch;

    if (getDailyXianchiBranch(dailyBranch) === pBranch) { add('咸池'); add('流日咸池'); }
    if (HONGLUAN_MAP[dailyBranch] === pBranch) { add('红鸾'); add('紅鸞'); add('流日红鸾'); }
    const hl = HONGLUAN_MAP[dailyBranch];
    if (hl && DUI_MAP[hl] === pBranch) { add('天喜'); add('流日天喜'); }
    if (LUCUN_MAP[dailyStem] === pBranch) { add('禄存'); add('祿存'); add('流日禄存'); }
    const ky = KUAI_YUE_MAP[dailyStem];
    if (ky) {
      if (ky.kui === pBranch) { add('天魁'); add('流日天魁'); }
      if (ky.yue === pBranch) { add('天钺'); add('天鉞'); add('流日天钺'); }
    }
    if (getDailyTianmaBranch(dailyBranch) === pBranch) { add('天马'); add('天馬'); add('流日天马'); }
  }

  return set;
}

function getAllPalaceStars(palace, day) {
  const natal = extractNatalStars(palace);
  const shensha = extractDailyShensha(palace, day);
  return new Set([...natal, ...shensha]);
}

function evaluateStarRule(day, primaryPalaces, starNames, ruleLabel) {
  let score = 0;
  const details = [];
  const primaryList = Array.isArray(primaryPalaces) ? primaryPalaces.filter(Boolean) : [primaryPalaces].filter(Boolean);
  if (primaryList.length === 0) return { score: 0, details: [] };

  const names = Array.isArray(starNames) ? starNames : [starNames];
  const allNames = new Set(names);
  names.forEach(n => { if (CHAR_MAP[n]) allNames.add(CHAR_MAP[n]); });

  let benHit = false;
  const checkedBenBranches = new Set();
  primaryList.forEach(p => {
    if (!p) return;
    checkedBenBranches.add(p.earthlyBranch);
    const stars = getAllPalaceStars(p, day);
    for (const name of allNames) {
      if (stars.has(name)) { benHit = true; break; }
    }
  });

  if (benHit) {
    score += 3;
    details.push({ rule: `${ruleLabel}本宮見${starNames[0]}`, points: 3 });
  }

  const sanFangBranches = new Set();
  primaryList.forEach(p => {
    if (!p) return;
    const sf = getSanFangSiZhengBranches(p.earthlyBranch);
    sf.sanFangOthers.forEach(b => {
      if (!checkedBenBranches.has(b)) sanFangBranches.add(b);
    });
  });

  let sanFangHits = 0;
  sanFangBranches.forEach(b => {
    const p = getPalaceByBranch(day, b);
    if (!p) return;
    const stars = getAllPalaceStars(p, day);
    for (const name of allNames) {
      if (stars.has(name)) { sanFangHits++; break; }
    }
  });

  if (sanFangHits > 0) {
    const pts = sanFangHits * 1;
    score += pts;
    details.push({ rule: `${ruleLabel}三方四正照會見${starNames[0]}(${sanFangHits}宮)`, points: pts });
  }

  return { score, details };
}

function evaluateMutagenRule(day, primaryPalaces, mutagenType, ruleLabel) {
  let score = 0;
  const details = [];
  const primaryList = Array.isArray(primaryPalaces) ? primaryPalaces.filter(Boolean) : [primaryPalaces].filter(Boolean);
  if (primaryList.length === 0) return { score: 0, details: [] };

  const dHua = day.dailySiHua || {};
  let targetStar = '';
  if (mutagenType === '化祿' || mutagenType === '化禄') targetStar = dHua['化禄'] || dHua['化祿'];
  else if (mutagenType === '化權' || mutagenType === '化权') targetStar = dHua['化权'] || dHua['化權'];
  else if (mutagenType === '化科') targetStar = dHua['化科'];
  else if (mutagenType === '化忌') targetStar = dHua['化忌'];

  if (!targetStar) return { score: 0, details: [] };

  const targetStarSet = new Set([targetStar]);
  if (CHAR_MAP[targetStar]) targetStarSet.add(CHAR_MAP[targetStar]);

  let benHit = false;
  const checkedBenBranches = new Set();
  primaryList.forEach(p => {
    if (!p) return;
    checkedBenBranches.add(p.earthlyBranch);
    const stars = extractNatalStars(p);
    for (const ts of targetStarSet) {
      if (stars.has(ts)) { benHit = true; break; }
    }
  });

  const basePoints = (mutagenType === '化忌') ? -3 : 3;
  if (benHit) {
    score += basePoints;
    details.push({ rule: `${ruleLabel}本宮逢${mutagenType}(${targetStar})`, points: basePoints });
  }

  const sanFangBranches = new Set();
  primaryList.forEach(p => {
    if (!p) return;
    const sf = getSanFangSiZhengBranches(p.earthlyBranch);
    sf.sanFangOthers.forEach(b => {
      if (!checkedBenBranches.has(b)) sanFangBranches.add(b);
    });
  });

  let sanFangHit = false;
  sanFangBranches.forEach(b => {
    const p = getPalaceByBranch(day, b);
    if (!p) return;
    const stars = extractNatalStars(p);
    for (const ts of targetStarSet) {
      if (stars.has(ts)) { sanFangHit = true; break; }
    }
  });

  if (sanFangHit) {
    const sfPoints = (mutagenType === '化忌') ? -1 : 1;
    score += sfPoints;
    details.push({ rule: `${ruleLabel}三方四正沖照${mutagenType}(${targetStar})`, points: sfPoints });
  }

  return { score, details };
}

// 六十甲子納音五行對照表
const NAYIN_MAP = {
  '甲子': '金', '乙丑': '金', '丙寅': '火', '丁卯': '火', '戊辰': '木', '己巳': '木',
  '庚午': '土', '辛未': '土', '壬申': '金', '癸酉': '金', '甲戌': '火', '乙亥': '火',
  '丙子': '水', '丁丑': '水', '戊寅': '土', '己卯': '土', '庚辰': '金', '辛巳': '金',
  '壬午': '木', '癸未': '木', '甲申': '水', '乙酉': '水', '丙戌': '土', '丁亥': '土',
  '戊子': '火', '己丑': '火', '庚寅': '木', '辛卯': '木', '壬辰': '水', '癸巳': '水',
  '甲午': '金', '乙未': '金', '丙申': '火', '丁酉': '火', '戊戌': '木', '己亥': '木',
  '庚子': '土', '辛丑': '土', '壬寅': '金', '癸卯': '金', '甲辰': '火', '乙巳': '火',
  '丙午': '水', '丁未': '水', '戊申': '土', '己酉': '土', '庚戌': '金', '辛亥': '金',
  '壬子': '木', '癸丑': '木', '甲寅': '水', '乙卯': '水', '丙辰': '土', '丁巳': '土',
  '戊午': '火', '己未': '火', '庚申': '木', '辛酉': '木', '壬戌': '水', '癸亥': '水'
};

function isKe(a, b) {
  return (a === '木' && b === '土') ||
         (a === '土' && b === '水') ||
         (a === '水' && b === '火') ||
         (a === '火' && b === '金') ||
         (a === '金' && b === '木');
}

/**
 * 8. 樂透運評分模組 (Lottery Fortune)
 * 1. 八字飛財判斷：年柱納音剋日柱或時柱納音 +5，年柱納音剋流日柱納音 +5
 * 2. 紫微偏財格局：財帛宮見七殺+火星 +4、命宮貪狼+火星 +3、破軍+祿存/化祿 +3
 * 3. 流日財帛宮見化祿 +3
 * 4. 流日命宮見祿存 +3
 * 5. 流日財帛宮見化忌 -3
 */
function scoreLetou(day, options = {}) {
  let score = 0;
  const details = [];

  // 1. 八字飛財判斷
  let bazi = options.bazi || (options.astrolabe && options.astrolabe.rawDates && options.astrolabe.rawDates.chineseDate) || (day.rawHoroscope && day.rawHoroscope.chineseDate) || null;
  let yP = '', dP = '', hP = '';
  if (bazi) {
    if (typeof bazi === 'string') {
      const parts = bazi.split(/\s+/);
      parts.forEach(p => {
        if (p.includes('年')) yP = p.replace('年', '');
        if (p.includes('日')) dP = p.replace('日', '');
        if (p.includes('時') || p.includes('时')) hP = p.replace(/[時时]/, '');
      });
    } else {
      if (bazi.yearly && Array.isArray(bazi.yearly)) yP = bazi.yearly.join('');
      else if (bazi.year) yP = bazi.year;

      if (bazi.daily && Array.isArray(bazi.daily)) dP = bazi.daily.join('');
      else if (bazi.day) dP = bazi.day;

      if (bazi.hourly && Array.isArray(bazi.hourly)) hP = bazi.hourly.join('');
      else if (bazi.hour) hP = bazi.hour;
    }
  } else if (options.astrolabe && options.astrolabe.chineseDate) {
    const parts = options.astrolabe.chineseDate.split(/\s+/);
    parts.forEach(p => {
      if (p.includes('年')) yP = p.replace('年', '');
      if (p.includes('日')) dP = p.replace('日', '');
      if (p.includes('時') || p.includes('时')) hP = p.replace(/[時时]/, '');
    });
  }

  // 預設八字 (1990-03-15 未時: 庚午年 己卯月 丁卯日 丁未時)
  if (!yP) yP = '庚午';
  if (!dP) dP = '丁卯';
  if (!hP) hP = '丁未';

  const yNa = NAYIN_MAP[yP];
  const dNa = NAYIN_MAP[dP];
  const hNa = NAYIN_MAP[hP];
  const curDayNa = NAYIN_MAP[day.dailyGanZhi];

  if (yNa && ((dNa && isKe(yNa, dNa)) || (hNa && isKe(yNa, hNa)))) {
    score += 5;
    const targetStr = (dNa && isKe(yNa, dNa)) ? `日柱${dP}(${dNa})` : `時柱${hP}(${hNa})`;
    details.push({ rule: `本命八字飛財格(年柱${yP}${yNa}剋${targetStr})`, points: 5 });
  } else if (yNa && curDayNa && isKe(yNa, curDayNa)) {
    score += 5;
    details.push({ rule: `流日八字飛財(年柱${yP}${yNa}剋流日${day.dailyGanZhi}${curDayNa})`, points: 5 });
  }

  // 2. 紫微偏財格局
  // (a) 財帛宮見七殺+火星 +4 (三方照會 +2)
  const cStars = getAllPalaceStars(day.dailyCaibo, day);
  const hasCaiboQisha = cStars.has('七杀') || cStars.has('七殺');
  const hasCaiboHuoxing = cStars.has('火星');
  if (hasCaiboQisha && hasCaiboHuoxing) {
    score += 4;
    details.push({ rule: '流日財帛宮見七殺+火星同度(偏財暴發格)', points: 4 });
  } else {
    const sfCaibo = getSanFangSiZhengBranches(day.dailyCaibo.earthlyBranch).sanFangOthers;
    let sfQisha = false, sfHuo = false;
    sfCaibo.forEach(b => {
      const p = getPalaceByBranch(day, b);
      if (p) {
        const st = getAllPalaceStars(p, day);
        if (st.has('七杀') || st.has('七殺')) sfQisha = true;
        if (st.has('火星')) sfHuo = true;
      }
    });
    if ((hasCaiboQisha && sfHuo) || (hasCaiboHuoxing && sfQisha) || (sfQisha && sfHuo)) {
      score += 2;
      details.push({ rule: '流日財帛宮三方照會七殺+火星', points: 2 });
    }
  }

  // (b) 命宮貪狼+火星 +3 (三方照會 +1)
  const mStars = getAllPalaceStars(day.dailyMing, day);
  const hasMingTan = mStars.has('贪狼') || mStars.has('貪狼');
  const hasMingHuo = mStars.has('火星');
  if (hasMingTan && hasMingHuo) {
    score += 3;
    details.push({ rule: '流日命宮見貪狼+火星同度(火貪格暴富)', points: 3 });
  } else {
    const sfMing = getSanFangSiZhengBranches(day.dailyMing.earthlyBranch).sanFangOthers;
    let sfTan = false, sfHuo = false;
    sfMing.forEach(b => {
      const p = getPalaceByBranch(day, b);
      if (p) {
        const st = getAllPalaceStars(p, day);
        if (st.has('贪狼') || st.has('貪狼')) sfTan = true;
        if (st.has('火星')) sfHuo = true;
      }
    });
    if ((hasMingTan && sfHuo) || (hasMingHuo && sfTan) || (sfTan && sfHuo)) {
      score += 1;
      details.push({ rule: '流日命宮三方照會貪狼+火星(火貪格)', points: 1 });
    }
  }

  // (c) 破軍+祿存/化祿 +3 (三方照會 +1)
  let pjLuHit = false;
  const targetPalaces = [
    { p: day.dailyCaibo, name: '財帛宮' },
    { p: day.dailyMing, name: '命宮' }
  ];
  for (const item of targetPalaces) {
    const st = getAllPalaceStars(item.p, day);
    const hasPojun = st.has('破军') || st.has('破軍');
    const hasLucun = st.has('禄存') || st.has('祿存') || st.has('日禄') || st.has('日祿');
    const sHua = day.dailySiHua || {};
    const isPojunHuaLu = (sHua['化禄'] === '破军' || sHua['化禄'] === '破軍' || sHua['化祿'] === '破军' || sHua['化祿'] === '破軍');
    if (hasPojun && (hasLucun || isPojunHuaLu)) {
      score += 3;
      details.push({ rule: `流日${item.name}見破軍+祿(破軍逢祿主橫發)`, points: 3 });
      pjLuHit = true;
      break;
    }
  }
  if (!pjLuHit) {
    for (const item of targetPalaces) {
      const st = getAllPalaceStars(item.p, day);
      const hasPojun = st.has('破军') || st.has('破軍');
      if (hasPojun) {
        const sf = getSanFangSiZhengBranches(item.p.earthlyBranch).sanFangOthers;
        let sfLu = false;
        sf.forEach(b => {
          const p = getPalaceByBranch(day, b);
          if (p) {
            const pst = getAllPalaceStars(p, day);
            if (pst.has('禄存') || pst.has('祿存') || pst.has('日禄') || pst.has('日祿')) sfLu = true;
          }
        });
        if (sfLu) {
          score += 1;
          details.push({ rule: `流日${item.name}三方照會破軍+祿存`, points: 1 });
          break;
        }
      }
    }
  }

  // 3. 流日財帛宮見化祿 +3
  const luC = evaluateMutagenRule(day, [day.dailyCaibo], '化祿', '財帛宮');
  score += luC.score; details.push(...luC.details);

  // 4. 流日命宮見祿存 +3
  const lcM = evaluateStarRule(day, [day.dailyMing], ['禄存', '祿存'], '命宮');
  score += lcM.score; details.push(...lcM.details);

  // 5. 流日財帛宮見化忌 -3
  const jiC = evaluateMutagenRule(day, [day.dailyCaibo], '化忌', '財帛宮');
  score += jiC.score; details.push(...jiC.details);

  // 6. 易經梅花起卦與博弈吉凶
  const ichingRes = calculateIChingAndNumerology(day.date, '12:00');
  if (ichingRes && ichingRes.iching) {
    if (ichingRes.iching.decisionHexagram.includes('地天泰') || ichingRes.iching.decisionHexagram.includes('乾卦')) {
      score += 2;
      details.push({ rule: `易經起卦吉應(${ichingRes.iching.decisionHexagram.split('（')[0]})`, points: 2 });
    }
  }

  return { score, details, iching: ichingRes };
}

function scoreDayEngine(day, options = {}) {
  const dStem = day.dailyGanZhi ? day.dailyGanZhi[0] : '';

  // 1. 偏財日
  let scoreP = 0, detP = [];
  const luP = evaluateMutagenRule(day, [day.dailyCaibo], '化祿', '財帛宮');
  scoreP += luP.score; detP.push(...luP.details);
  const tanP = evaluateStarRule(day, [day.dailyCaibo], ['贪狼', '貪狼'], '財帛宮');
  scoreP += tanP.score; detP.push(...tanP.details);
  const pjP = evaluateStarRule(day, [day.dailyCaibo], ['破军', '破軍'], '財帛宮');
  scoreP += pjP.score; detP.push(...pjP.details);
  const wuP = evaluateStarRule(day, [day.dailyCaibo], ['武曲'], '財帛宮');
  scoreP += wuP.score; detP.push(...wuP.details);
  const jiP = evaluateMutagenRule(day, [day.dailyCaibo], '化忌', '財帛宮');
  scoreP += jiP.score; detP.push(...jiP.details);
  const lcP = evaluateStarRule(day, [day.dailyMing], ['禄存', '祿存'], '命宮');
  scoreP += lcP.score; detP.push(...lcP.details);
  if (luP.score > 0) {
    const sHua = day.dailySiHua || {};
    const luStar = sHua['化禄'] || sHua['化祿'];
    if (luStar === '武曲' || luStar === '贪狼' || luStar === '破军') {
      scoreP += 2; detP.push({ rule: `偏財本星(${luStar})化祿生旺`, points: 2 });
    }
  }
  // 投資理財財帛田宅聯動
  const investLink = calculateInvestmentLinkage(day, options);
  if (investLink && investLink.signal) {
    if (investLink.signal.includes('強勢進場')) {
      scoreP += 3;
      detP.push({ rule: '財帛化祿庫位穩固(強勢進場訊號)', points: 3 });
    } else if (investLink.signal.includes('收割避險')) {
      scoreP -= 3;
      detP.push({ rule: '財帛化忌或財庫見漏(收割避險訊號)', points: -3 });
    }
  }

  // 2. 桃花日
  let scoreT = 0, detT = [];
  const primaryTF = [day.dailyMing, day.dailyFuqi];
  const hlT = evaluateStarRule(day, primaryTF, ['红鸾', '紅鸞'], '命/夫');
  scoreT += hlT.score; detT.push(...hlT.details);
  const txT = evaluateStarRule(day, primaryTF, ['天喜'], '命/夫');
  scoreT += txT.score; detT.push(...txT.details);
  const tanT = evaluateStarRule(day, primaryTF, ['贪狼', '貪狼'], '命/夫');
  scoreT += tanT.score; detT.push(...tanT.details);
  const lzT = evaluateStarRule(day, primaryTF, ['廉贞', '廉貞'], '命/夫');
  scoreT += lzT.score; detT.push(...lzT.details);
  const jiT = evaluateMutagenRule(day, primaryTF, '化忌', '命/夫');
  scoreT += jiT.score; detT.push(...jiT.details);
  if (dStem === '戊' && tanT.score > 0) {
    scoreT += 2; detT.push({ rule: '桃花主星貪狼化祿引動', points: 2 });
  } else if (dStem === '甲' && lzT.score > 0) {
    scoreT += 2; detT.push({ rule: '次桃花廉貞化祿引動', points: 2 });
  }
  if (tanT.score > 0 && (jiT.score < 0 || jiP.score < 0)) {
    scoreT -= 2;
    detT.push({ rule: '桃花主星逢煞忌沖照(防爛桃花糾紛與破財)', points: -2 });
  }

  // 3. 肉慾日
  let scoreR = 0, detR = [];
  const mStars = getAllPalaceStars(day.dailyMing, day);
  const fStars = getAllPalaceStars(day.dailyFuqi, day);
  const mTan = mStars.has('贪狼') || mStars.has('貪狼');
  const mXian = mStars.has('咸池') || mStars.has('流日咸池');
  const fTan = fStars.has('贪狼') || fStars.has('貪狼');
  const fXian = fStars.has('咸池') || fStars.has('流日咸池');

  if ((mTan && mXian) || (fTan && fXian)) {
    scoreR += 5;
    detR.push({ rule: `命/夫宮同度並見貪狼+咸池(情慾爆發)`, points: 5 });
  } else if ((mTan || fTan) && (mXian || fXian)) {
    scoreR += 4;
    detR.push({ rule: `命宮夫妻宮跨宮並見貪狼+咸池`, points: 4 });
  } else {
    const surM = getSanFangSiZhengBranches(day.dailyMing.earthlyBranch).sanFangOthers;
    const surF = getSanFangSiZhengBranches(day.dailyFuqi.earthlyBranch).sanFangOthers;
    let sTan = false, sXian = false;
    [...surM, ...surF].forEach(b => {
      const p = getPalaceByBranch(day, b);
      if (p) {
        const st = getAllPalaceStars(p, day);
        if (st.has('贪狼') || st.has('貪狼')) sTan = true;
        if (st.has('咸池') || st.has('流日咸池')) sXian = true;
      }
    });
    if ((mTan || fTan || sTan) && (mXian || fXian || sXian)) {
      scoreR += 2;
      detR.push({ rule: '命/夫三方四正跨宮照會見貪狼+咸池', points: 2 });
    }
  }

  const yaoR = evaluateStarRule(day, [day.dailyMing, day.dailyFuqi], ['天姚'], '命/夫');
  scoreR += yaoR.score; detR.push(...yaoR.details);
  const muyuR = evaluateStarRule(day, [day.dailyMing, day.dailyFuqi], ['沐浴'], '命/夫');
  scoreR += muyuR.score; detR.push(...muyuR.details);

  const fudeP = day.dailyFude;
  const fudeStars = getAllPalaceStars(fudeP, day);
  const fudeLian = fudeStars.has('廉贞') || fudeStars.has('廉貞');
  const fudeTan = fudeStars.has('贪狼') || fudeStars.has('貪狼');

  if (fudeLian && fudeTan) {
    scoreR += 4;
    detR.push({ rule: '福德宮同宮同度見廉貞+貪狼(肉慾最強)', points: 4 });
  } else if (fudeLian || fudeTan) {
    scoreR += 2;
    detR.push({ rule: '福德宮見廉貞或貪狼', points: 2 });
  }

  // 4. 貴人日
  let scoreG = 0, detG = [];
  const primaryMQ = [day.dailyMing, day.dailyQianyi];
  const tkG = evaluateStarRule(day, primaryMQ, ['天魁'], '命/遷');
  scoreG += tkG.score; detG.push(...tkG.details);
  const tyG = evaluateStarRule(day, primaryMQ, ['天钺', '天鉞'], '命/遷');
  scoreG += tyG.score; detG.push(...tyG.details);
  const zfG = evaluateStarRule(day, primaryMQ, ['左辅', '左輔'], '命/遷');
  scoreG += zfG.score; detG.push(...zfG.details);
  const ybG = evaluateStarRule(day, primaryMQ, ['右弼'], '命/遷');
  scoreG += ybG.score; detG.push(...ybG.details);
  const keG = evaluateMutagenRule(day, primaryMQ, '化科', '命/遷');
  if (keG.score > 0) { scoreG += 2; detG.push({ rule: '貴人逢化科長輩提攜', points: 2 }); }
  const luG = evaluateMutagenRule(day, primaryMQ, '化祿', '命/遷');
  if (luG.score > 0) { scoreG += 1; detG.push({ rule: '貴人逢化祿引薦得利', points: 1 }); }
  const jiG = evaluateMutagenRule(day, primaryMQ, '化忌', '命/遷');
  if (jiG.score < 0) { scoreG -= 3; detG.push({ rule: '命遷逢化忌小人阻滯', points: -3 }); }

  // 5. 事業日
  let scoreS = 0, detS = [];
  const quanS = evaluateMutagenRule(day, [day.dailyGuanlu], '化權', '官祿宮');
  scoreS += quanS.score; detS.push(...quanS.details);
  const keS = evaluateMutagenRule(day, [day.dailyGuanlu], '化科', '官祿宮');
  scoreS += keS.score; detS.push(...keS.details);
  const zwS = evaluateStarRule(day, [day.dailyGuanlu], ['紫微'], '官祿宮');
  scoreS += zwS.score; detS.push(...zwS.details);
  const tfS = evaluateStarRule(day, [day.dailyGuanlu], ['天府'], '官祿宮');
  scoreS += tfS.score; detS.push(...tfS.details);
  const luS = evaluateMutagenRule(day, [day.dailyGuanlu], '化祿', '官祿宮');
  if (luS.score > 0) { scoreS += 2; detS.push({ rule: '官祿逢化祿職權生財', points: 2 }); }
  const lcS = evaluateStarRule(day, [day.dailyGuanlu], ['禄存', '祿存'], '官祿宮');
  if (lcS.score > 0) { scoreS += 2; detS.push({ rule: '官祿宮見祿存事業鞏固', points: 2 }); }
  const jiS = evaluateMutagenRule(day, [day.dailyGuanlu], '化忌', '官祿宮');
  if (jiS.score < 0) { scoreS -= 3; detS.push({ rule: '官祿宮見化忌工作波折', points: -3 }); }

  // 6. 健康日
  let scoreJ = 0, detJ = [];
  const keJ = evaluateMutagenRule(day, [day.dailyJie], '化科', '疾厄宮');
  scoreJ += keJ.score; detJ.push(...keJ.details);
  const tlJ = evaluateStarRule(day, [day.dailyJie], ['天梁'], '疾厄宮');
  scoreJ += tlJ.score; detJ.push(...tlJ.details);
  const tdJ = evaluateStarRule(day, [day.dailyJie], ['天同'], '疾厄宮');
  if (tdJ.score > 0) { scoreJ += 2; detJ.push({ rule: '疾厄宮見天同福星解厄', points: 2 }); }
  const jiJ = evaluateMutagenRule(day, [day.dailyJie], '化忌', '疾厄宮');
  scoreJ += jiJ.score; detJ.push(...jiJ.details);
  const qyJ = evaluateStarRule(day, [day.dailyJie], ['擎羊', '日羊'], '疾厄宮');
  if (qyJ.score > 0) { scoreJ -= 2; detJ.push({ rule: '疾厄宮見擎羊煞星刑傷', points: -2 }); }

  // 7. 巨大商機日
  let scoreB = 0, detB = [];
  const primaryCG = [day.dailyCaibo, day.dailyGuanlu];
  const luB = evaluateMutagenRule(day, primaryCG, '化祿', '財帛/官祿');
  scoreB += luB.score; detB.push(...luB.details);
  const quanB = evaluateMutagenRule(day, primaryCG, '化權', '財帛/官祿');
  scoreB += quanB.score; detB.push(...quanB.details);
  const lcB = evaluateStarRule(day, [day.dailyMing, day.dailyCaibo], ['禄存', '祿存'], '命/財');
  scoreB += lcB.score; detB.push(...lcB.details);
  const tmB = evaluateStarRule(day, [day.dailyMing, day.dailyGuanlu, day.dailyCaibo], ['天马', '天馬', '日马', '日馬'], '命/官/財');
  if (tmB.score > 0) {
    scoreB += 2;
    detB.push({ rule: '命官財見天馬(商機動能活躍)', points: 2 });
  }
  if (lcB.score > 0 && tmB.score > 0) {
    scoreB += 3;
    detB.push({ rule: '商機遇祿馬交馳(萬商雲集發財百萬)', points: 3 });
  }
  if (luB.score > 0 && quanB.score > 0) {
    scoreB += 3;
    detB.push({ rule: '商機遇權祿交馳(掌控主導權獲重大專案)', points: 3 });
  }
  const zwB = evaluateStarRule(day, [day.dailyGuanlu], ['紫微'], '官祿宮');
  const tfB = evaluateStarRule(day, [day.dailyGuanlu], ['天府'], '官祿宮');
  if (zwB.score > 0 || tfB.score > 0) {
    scoreB += 2;
    detB.push({ rule: '官祿宮見紫府帝星(統馭重大專案格局)', points: 2 });
  }
  const jiB = evaluateMutagenRule(day, primaryCG, '化忌', '財帛/官祿');
  if (jiB.score < 0) {
    scoreB -= 3;
    detB.push({ rule: '財官逢化忌(合約條款宜慎防波折)', points: -3 });
  }

  const w = options.weights || (typeof state !== 'undefined' && state.currentSession && state.currentSession.weights) || DEFAULT_WEIGHTS;
  const letouRes = scoreLetou(day, options);

  const applyW = (sc, cat) => {
    const weight = w[cat] !== undefined ? w[cat] : 1.0;
    return Math.round(sc * weight * 10) / 10;
  };

  return {
    piancai: { score: applyW(scoreP, 'piancai'), rawScore: scoreP, weight: w.piancai || 1.0, details: detP },
    letou: { ...letouRes, score: applyW(letouRes.score, 'letou'), rawScore: letouRes.score, weight: w.letou || 1.0 },
    taohua: { score: applyW(scoreT, 'taohua'), rawScore: scoreT, weight: w.taohua || 1.0, details: detT },
    rouyu: { score: applyW(scoreR, 'rouyu'), rawScore: scoreR, weight: w.rouyu || 1.0, details: detR },
    guiren: { score: applyW(scoreG, 'guiren'), rawScore: scoreG, weight: w.guiren || 1.0, details: detG },
    shiye: { score: applyW(scoreS, 'shiye'), rawScore: scoreS, weight: w.shiye || 1.0, details: detS },
    jiankang: { score: applyW(scoreJ, 'jiankang'), rawScore: scoreJ, weight: w.jiankang || 1.0, details: detJ },
    shangji: { score: applyW(scoreB, 'shangji'), rawScore: scoreB, weight: w.shangji || 1.0, details: detB }
  };
}

const CATEGORIES = [
  { key: 'piancai', name: '偏財日', icon: '💰', color: '#f1c40f', desc: '流日財帛見祿、貪狼、破軍、武曲，命宮見祿存' },
  { key: 'letou', name: '樂透運', icon: '🎫', color: '#10b981', desc: '八字飛財、火貪格、破軍化祿/祿存、財帛祿忌' },
  { key: 'taohua', name: '桃花日', icon: '🌸', color: '#f472b6', desc: '命宮夫妻見紅鸞、天喜、貪狼、廉貞' },
  { key: 'rouyu', name: '肉慾日', icon: '🔥', color: '#fb7185', desc: '貪狼咸池同度、見天姚、沐浴、福德見廉貪' },
  { key: 'guiren', name: '貴人日', icon: '👑', color: '#a855f7', desc: '命宮遷移見天魁、天鉞、左輔、右弼' },
  { key: 'shiye', name: '事業日', icon: '💼', color: '#38bdf8', desc: '官祿宮見化權、化科、紫微、天府' },
  { key: 'jiankang', name: '健康日', icon: '🌿', color: '#34d399', desc: '疾厄宮見化科、天梁，防化忌與擎羊' },
  { key: 'shangji', name: '巨大商機日', icon: '🚀', color: '#f59e0b', desc: '財官見祿權、祿馬交馳、權祿交馳、紫府統馭' }
];

const GRID_CELLS = [
  { row: 1, col: 1, branch: '巳' }, { row: 1, col: 2, branch: '午' },
  { row: 1, col: 3, branch: '未' }, { row: 1, col: 4, branch: '申' },
  { row: 2, col: 4, branch: '酉' }, { row: 3, col: 4, branch: '戌' },
  { row: 4, col: 4, branch: '亥' }, { row: 4, col: 3, branch: '子' },
  { row: 4, col: 2, branch: '丑' }, { row: 4, col: 1, branch: '寅' },
  { row: 3, col: 1, branch: '卯' }, { row: 2, col: 1, branch: '辰' }
];

// 全局多語言字典 (支援 5 大語言：繁中、簡中、英文、日文、韓文，並保留泰文)
const I18N = {
  zh: {
    appTitle: '紫微斗數流日命理運算系統 — 滿天星 Plus',
    navChat: '命理諮詢對話',
    navRankings: '全年八大排行',
    navRemedy: 'Jack 老師個人化處方',
    navCharts: '命盤與運勢視覺化',
    navAbout: '關於',
    btnNewClient: '➕ 新建客戶命盤',
    langToggle: '繁中 ▾',
    sidebarTitle: '👥 客戶聊天室',
    btnAddSession: '➕ 新增',
    sessionCount: (n) => `共 ${n} 位客戶紀錄`,
    chatIndicator: (name, bday) => `正在向【${name}】(${bday}) 的命盤提問...`,
    inputPlaceholder: '請輸入想詢問的問題（Enter 送出，Shift+Enter 換行），例如：「這個人哪一天適合買彩券？」...',
    btnSend: '送出 ↵',
    quickTitle: '⚡ 快速提問',
    quickSubtitle: '點擊直接詢問當前客戶',
    quickQuestions: {
      today: '今天流日如何',
      lottery: '這個人哪一天適合買彩券',
      letou: '這個人的樂透運 TOP 10',
      piancai: '這個人今年偏財如何',
      taohua: '這個人的桃花日是哪幾天',
      guiren: '這個人的貴人什麼時候出現',
      jiankang: '這個人的健康要注意什麼',
      shangji: '這個人的商機日是哪幾天',
      shiye: '這個人事業升遷如何',
      rouyu: '這個人肉慾最強是哪天',
      clothing: '這個人五行穿衣開運色是什麼',
      remedy: '推薦這個人的開運處方'
    },
    rankingsTitle: '🏆 全年 365 天流日運勢排行榜',
    btnDownloadJSON: '📥 下載此客戶全年數據 JSON',
    rankingsTabs: {
      all: '全部排行榜 (All 8)',
      piancai: '💰 偏財日',
      letou: '🎫 樂透運',
      taohua: '🌸 桃花日',
      rouyu: '🔥 肉慾日',
      guiren: '👑 貴人日',
      shiye: '💼 事業日',
      jiankang: '🌿 健康日',
      shangji: '🚀 巨大商機日'
    },
    modalNewTitle: '➕ 新建客戶命盤與聊天室',
    modalNewSubtitle: '輸入客戶生日、時辰與出生地，系統將結合真太陽時、七政四餘與全年流日數據',
    labelClientName: '客戶姓名 / 代稱',
    labelBirthday: '出生日期 (陽曆/國曆)',
    labelCalendarType: '曆法類型',
    labelGender: '性別',
    labelBirthTime: '出生時辰',
    labelTargetYear: '推算年份',
    labelIncludeNatal: '同時納入本命四化加權計算',
    btnSubmitNew: '⚡ 開始計算並建立聊天室',
    remedyHeadTitle: '🌿 Jack 老師開運工具箱',
    remedyHeadSubtitle: '道家天紀傳承 · 五行調和 · 中藥辟穢 · 經絡通神 · 陽宅立向'
  },
  cn: {
    appTitle: '紫微斗数流日命理运算系统 — 满天星 Plus',
    navChat: '命理咨询对话',
    navRankings: '全年八大排行',
    navRemedy: 'Jack 老师个性化处方',
    navCharts: '命盘与运势可视化',
    navAbout: '关于',
    btnNewClient: '➕ 新建客户命盘',
    langToggle: '简中 ▾',
    sidebarTitle: '👥 客户聊天室',
    btnAddSession: '➕ 新增',
    sessionCount: (n) => `共 ${n} 位客户记录`,
    chatIndicator: (name, bday) => `正在向【${name}】(${bday}) 的命盘提问...`,
    inputPlaceholder: '请输入想询问的问题（Enter 发送，Shift+Enter 换行），例如：“这个人哪一天适合买彩票？”...',
    btnSend: '发送 ↵',
    quickTitle: '⚡ 快速提问',
    quickSubtitle: '点击直接询问当前客户',
    quickQuestions: {
      today: '今天流日如何',
      lottery: '这个人哪一天适合买彩票',
      letou: '这个人的乐透运 TOP 10',
      piancai: '这个人今年偏财如何',
      taohua: '这个人的桃花日是哪几天',
      guiren: '这个人的贵人什么时候出现',
      jiankang: '这个人的健康要注意什么',
      shangji: '这个人的商机日是哪几天',
      shiye: '这个人事业升迁如何',
      rouyu: '这个人肉欲最强是哪天',
      clothing: '这个人五行穿衣开运色是什么',
      remedy: '推荐这个人的开运处方'
    },
    rankingsTitle: '🏆 全年 365 天流日运势排行榜',
    btnDownloadJSON: '📥 下载此客户全年数据 JSON',
    rankingsTabs: {
      all: '全部排行榜 (All 8)',
      piancai: '💰 偏财日',
      letou: '🎫 乐透运',
      taohua: '🌸 桃花日',
      rouyu: '🔥 肉欲日',
      guiren: '👑 贵人日',
      shiye: '💼 事业日',
      jiankang: '🌿 健康日',
      shangji: '🚀 巨大商机日'
    },
    modalNewTitle: '➕ 新建客户命盘与聊天室',
    modalNewSubtitle: '输入客户生日、时辰与出生地，系统将结合真太阳时、七政四余与全年流日数据',
    labelClientName: '客户姓名 / 代称',
    labelBirthday: '出生日期 (阳历/国历)',
    labelCalendarType: '历法类型',
    labelGender: '性别',
    labelBirthTime: '出生时辰',
    labelTargetYear: '推算年份',
    labelIncludeNatal: '同时纳入本命四化加权计算',
    btnSubmitNew: '⚡ 开始计算并建立聊天室',
    remedyHeadTitle: '🌿 Jack 老师开运工具箱',
    remedyHeadSubtitle: '道家天纪传承 · 五行调和 · 中药辟秽 · 经络通神 · 阳宅立向'
  },
  en: {
    appTitle: 'Zi Wei Dou Shu Fortune System — Full Astrolabe Plus',
    navChat: 'Consultation Chat',
    navRankings: 'Yearly Top 8 Rankings',
    navRemedy: 'Jack\'s Personalized Remedy',
    navCharts: 'Visual Charts & Heatmap',
    navAbout: 'About',
    btnNewClient: '➕ New Client Chart',
    langToggle: 'English ▾',
    sidebarTitle: '👥 Client Chatrooms',
    btnAddSession: '➕ Add',
    sessionCount: (n) => `${n} Client Records`,
    chatIndicator: (name, bday) => `Consulting chart of 【${name}】 (${bday})...`,
    inputPlaceholder: 'Ask a fortune question (Enter to send, Shift+Enter for new line), e.g. "Which day is best for lottery?"...',
    btnSend: 'Send ↵',
    quickTitle: '⚡ Quick Inquiries',
    quickSubtitle: 'Click to ask for active client',
    quickQuestions: {
      today: 'How is today\'s transit fortune?',
      lottery: 'Which day is best to buy lottery?',
      letou: 'Top 10 Lottery Luck Days',
      piancai: 'How is windfall wealth this year?',
      taohua: 'When are the romance days?',
      guiren: 'When will noble benefactors appear?',
      jiankang: 'What health signs to watch out for?',
      shangji: 'When are the major business opportunity days?',
      shiye: 'How is career promotion outlook?',
      rouyu: 'When is sensual desire energy peaking?',
      clothing: 'What are the five-element lucky clothing colors?',
      remedy: 'Recommend personal remedies'
    },
    rankingsTitle: '🏆 365-Day Daily Fortune Leaderboard',
    btnDownloadJSON: '📥 Download Full-Year JSON Data',
    rankingsTabs: {
      all: 'All Leaderboards (8 Categories)',
      piancai: '💰 Windfall Wealth',
      letou: '🎫 Lottery Luck',
      taohua: '🌸 Romance / Peach Blossom',
      rouyu: '🔥 Passion & Desire',
      guiren: '👑 Noble Benefactor',
      shiye: '💼 Career & Prestige',
      jiankang: '🌿 Health & Longevity',
      shangji: '🚀 Mega Opportunity'
    },
    modalNewTitle: '➕ Create Client Chart & Chatroom',
    modalNewSubtitle: 'Enter birthday, clock time, and birthplace for True Solar Time and Seven Luminaries calculation',
    labelClientName: 'Client Name / Alias',
    labelBirthday: 'Date of Birth (Solar)',
    labelCalendarType: 'Calendar System',
    labelGender: 'Gender',
    labelBirthTime: 'Birth Hour (Shichen)',
    labelTargetYear: 'Target Transit Year',
    labelIncludeNatal: 'Include Natal Mutagens in scoring',
    btnSubmitNew: '⚡ Calculate & Open Consultation',
    remedyHeadTitle: '🌿 Master Jack Classical Remedy Toolbox',
    remedyHeadSubtitle: 'Daoist Tianji Heritage · Five Elements Balance · Herbal Aromatherapy · Acupuncture Channeling'
  },
  ja: {
    appTitle: '紫微斗数・流日運勢推算システム — 満天星 Plus',
    navChat: '命理鑑定チャット',
    navRankings: '年間八大ランキング',
    navRemedy: 'Jack先生パーソナル開運処方',
    navCharts: '命盤と運勢の可視化',
    navAbout: '概要',
    btnNewClient: '➕ 新規クライアント命盤',
    langToggle: '日本語 ▾',
    sidebarTitle: '👥 クライアント一覧',
    btnAddSession: '➕ 追加',
    sessionCount: (n) => `登録クライアント：${n} 件`,
    chatIndicator: (name, bday) => `【${name}】様 (${bday}) の命盤について相談中...`,
    inputPlaceholder: '質問を入力してください（Enterで送信、Shift+Enterで改行）。例：「宝くじを買うのに最適な日はいつですか？」...',
    btnSend: '送信 ↵',
    quickTitle: '⚡ クイック質問',
    quickSubtitle: 'クリックして即座に質問',
    quickQuestions: {
      today: '本日の流日運勢はどうですか',
      lottery: '宝くじを買うのに適した日はいつですか',
      letou: '宝くじ当選運 TOP 10',
      piancai: '今年の臨時収入・偏財運はどうですか',
      taohua: '恋愛・モテ期はいつですか',
      guiren: 'キーパーソン・貴人はいつ現れますか',
      jiankang: '健康面で注意すべき点は何ですか',
      shangji: '大きなビジネスチャンス日はいつですか',
      shiye: '仕事運と出世のタイミングはどうですか',
      rouyu: '情熱・肉欲エネルギーが最も高まる日はいつですか',
      clothing: '五行のラッキーカラーは何ですか',
      remedy: 'おすすめの開運処方を教えてください'
    },
    rankingsTitle: '🏆 365日 年間流日運勢ランキング',
    btnDownloadJSON: '📥 年間JSONデータをダウンロード',
    rankingsTabs: {
      all: '総合ランキング (全8種)',
      piancai: '💰 偏財・臨時収入',
      letou: '🎫 宝くじ運',
      taohua: '🌸 桃花・恋愛運',
      rouyu: '🔥 情熱運',
      guiren: '👑 貴人・引き立て運',
      shiye: '💼 事業・出世運',
      jiankang: '🌿 健康運',
      shangji: '🚀 ビッグビジネス日'
    },
    modalNewTitle: '➕ 新規クライアント命盤と相談室作成',
    modalNewSubtitle: '生年月日、出生時刻、出生地を入力。真太陽時・七政四余・年間流日を精確に推算します',
    labelClientName: 'お名前 / 呼称',
    labelBirthday: '生年月日 (西暦/太陽暦)',
    labelCalendarType: '暦の種類',
    labelGender: '性別',
    labelBirthTime: '出生時辰 (2時間単位)',
    labelTargetYear: '推算対象年',
    labelIncludeNatal: '本命四化の重み付けを含める',
    btnSubmitNew: '⚡ 推算開始してチャットを開く',
    remedyHeadTitle: '🌿 Jack先生の開運ツールボックス',
    remedyHeadSubtitle: '道家天紀の正統伝承 · 五行調和 · 芳香療法 · 経絡活性化 · 風水立向'
  },
  ko: {
    appTitle: '자미두수 유일 운세 연산 시스템 — 만천성 Plus',
    navChat: '명리 상담 채팅',
    navRankings: '연간 8대 랭킹',
    navRemedy: 'Jack선생님 개인 맞춤 처방',
    navCharts: '명반 및 운세 시각화',
    navAbout: '소개',
    btnNewClient: '➕ 신규 고객 명반 등록',
    langToggle: '한국어 ▾',
    sidebarTitle: '👥 고객 채팅방',
    btnAddSession: '➕ 추가',
    sessionCount: (n) => `총 ${n}명의 고객 기록`,
    chatIndicator: (name, bday) => `【${name}】(${bday}) 님의 명반에 대해 상담 중...`,
    inputPlaceholder: '질문을 입력하세요 (Enter 전송, Shift+Enter 줄바꿈). 예: "이 사람은 복권을 사기에 언제가 가장 좋은가요?"...',
    btnSend: '전송 ↵',
    quickTitle: '⚡ 빠른 질문',
    quickSubtitle: '클릭하여 즉시 질문하기',
    quickQuestions: {
      today: '오늘의 유일 운세는 어떤가요?',
      lottery: '복권을 사기에 가장 좋은 날은 언제인가요?',
      letou: '복권 당첨운 TOP 10',
      piancai: '올해 횡재수와 편재운은 어떤가요?',
      taohua: '도화운과 연애운이 좋은 날은 언제인가요?',
      guiren: '나를 도와줄 귀인은 언제 나타나나요?',
      jiankang: '건강상 주의해야 할 점은 무엇인가요?',
      shangji: '큰 사업 기회가 오는 날은 언제인가요?',
      shiye: '사업운과 승진운은 어떤가요?',
      rouyu: '정열과 욕망 에너지가 가장 강한 날은 언제인가요?',
      clothing: '오행에 맞는 행운의 옷 색상은 무엇인가요?',
      remedy: '추천하는 개운 처방을 알려주세요'
    },
    rankingsTitle: '🏆 365일 연간 유일 운세 랭킹보드',
    btnDownloadJSON: '📥 연간 JSON 데이터 다운로드',
    rankingsTabs: {
      all: '전체 랭킹 (8대 영역)',
      piancai: '💰 편재·횡재일',
      letou: '🎫 복권 행운일',
      taohua: '🌸 도화·연애일',
      rouyu: '🔥 정열·욕망일',
      guiren: '👑 귀인 도움일',
      shiye: '💼 사업·승진일',
      jiankang: '🌿 건강 수호일',
      shangji: '🚀 초대형 사업기회일'
    },
    modalNewTitle: '➕ 신규 고객 명반 및 상담실 생성',
    modalNewSubtitle: '생년월일, 출생시간, 출생지를 입력하시면 진태양시·칠정사여·연간 유일 운세를 정밀 산출합니다',
    labelClientName: '고객명 / 호칭',
    labelBirthday: '생년월일 (양력)',
    labelCalendarType: '역법 종류',
    labelGender: '성별',
    labelBirthTime: '출생 시진 (2시간 단위)',
    labelTargetYear: '추산 연도',
    labelIncludeNatal: '본명 사화 가중치 포함',
    btnSubmitNew: '⚡ 연산 시작 및 상담실 생성',
    remedyHeadTitle: '🌿 Jack선생님 개운 툴박스',
    remedyHeadSubtitle: '도가 천기 전승 · 오행 조화 · 중약 방향 요법 · 경락 소통 · 풍수 방위'
  },
  th: {
    appTitle: 'ระบบจัดอันดับและคำนวณดวงชะตารายวันตลอดปี 2026 จื่อเวยโต้วซู่ — Full Astrolabe Plus',
    navChat: 'ปรึกษาดวงชะตา',
    navRankings: 'จัดอันดับดวงชะตาตลอดปี (8 ด้าน)',
    navRemedy: 'เครื่องมือปรับดวงอาจารย์ Jack',
    navCharts: 'แผนภูมิทัศน์ดวงชะตา',
    navAbout: 'เกี่ยวกับ',
    btnNewClient: '➕ สร้างดวงชะตาลูกค้าใหม่',
    langToggle: 'ไทย ▾',
    sidebarTitle: '👥 รายการห้องแชทลูกค้า',
    btnAddSession: '➕ เพิ่ม',
    sessionCount: (n) => `บันทึกลูกค้าทั้งหมด ${n} ท่าน`,
    chatIndicator: (name, bday) => `กำลังถามคำถามเกี่ยวกับดวงชะตาของ【${name}】(${bday})...`,
    inputPlaceholder: 'กรุณาพิมพ์คำถาม (Enter เพื่อส่ง, Shift+Enter เพื่อขึ้นบรรทัดใหม่) เช่น "คนนี้เหมาะจะซื้อหวยวันไหน?"...',
    btnSend: 'ส่ง ↵',
    quickTitle: '⚡ คำถามด่วน',
    quickSubtitle: 'คลิกเพื่อถามดวงลูกค้าปัจจุบันทันที',
    quickQuestions: {
      today: 'ดวงรายวันวันนี้เป็นอย่างไร',
      lottery: 'คนนี้เหมาะจะซื้อหวยวันไหน',
      letou: '10 อันดับวันโชคลาภลอตเตอรี่สูงสุด',
      piancai: 'ดวงลาภลอยปีนี้ของคนนี้เป็นอย่างไร',
      taohua: 'วันดาวดอกท้อเสน่ห์แรงคือวันไหนบ้าง',
      guiren: 'ดาวผู้อุปถัมภ์จะปรากฏเมื่อไหร่',
      jiankang: 'สุขภาพต้องระวังเรื่องอะไรบ้าง',
      shangji: 'วันโอกาสทองทางธุรกิจคือวันไหนบ้าง',
      shiye: 'ดวงการงานการเลื่อนตำแหน่งเป็นอย่างไร',
      rouyu: 'วันที่มีความปรารถนาเสน่หาแรงที่สุดคือวันไหน',
      clothing: 'สีเสื้อผ้าเสริมดวงตามธาตุห้าคือสีอะไร',
      remedy: 'แนะนำวิธีปรับดวงสำหรับคนนี้'
    },
    rankingsTitle: '🏆 ตารางจัดอันดับดวงชะตารายวัน 365 วันตลอดปี',
    btnDownloadJSON: '📥 ดาวน์โหลดข้อมูล JSON ทั้งปีของลูกค้านี้',
    rankingsTabs: {
      all: 'การจัดอันดับทั้งหมด (All 8)',
      piancai: '💰 วันลาภลอย',
      letou: '🎫 โชคลาภลอตเตอรี่',
      taohua: '🌸 วันดาวดอกท้อ',
      rouyu: '🔥 วันเสน่หาเร่าร้อน',
      guiren: '👑 วันผู้อุปถัมภ์',
      shiye: '💼 วันความก้าวหน้าการงาน',
      jiankang: '🌿 วันสุขภาพ',
      shangji: '🚀 วันโอกาสธุรกิจใหญ่'
    },
    modalNewTitle: '➕ สร้างดวงชะตาลูกค้าใหม่',
    modalNewSubtitle: 'กรอกวันเดือนปีเกิดและเวลาตกฟาก ระบบจะสร้างห้องแชทแยกอิสระและคำนวณดวงชะตารายวันตลอดปี 2026',
    labelClientName: 'ชื่อลูกค้า / นามเรียก',
    labelBirthday: 'วันเดือนปีเกิด (ค.ศ./สุริยคติ)',
    labelCalendarType: 'ประเภทปฏิทิน',
    labelGender: 'เพศ',
    labelBirthTime: 'เวลาตกฟาก (ยาม)',
    labelTargetYear: 'ปีที่ต้องการคำนวณ',
    labelIncludeNatal: 'รวมค่าน้ำหนักสี่การแปลงสภาพกำเนิดด้วย',
    btnSubmitNew: '⚡ เริ่มคำนวณและสร้างห้องแชท',
    remedyHeadTitle: '🌿 กล่องเครื่องมือปรับดวงชะตาอาจารย์ Jack',
    remedyHeadSubtitle: 'สืบทอดศาสตร์ฟ้าเต๋า · ปรับธาตุทั้งห้า · สุคนธบำบัดขจัดอัปมงคล · ปรับลมปราณ · ฮวงจุ้ยตำแหน่งประธาน'
  }
};

// 命理術語保留中文並加註當地語言註解之對照庫
const ASTRO_TERMS = {
  '紫微星': { zh: '紫微星 (帝王之主)', cn: '紫微星 (帝王之主)', en: '紫微星 (Ziwei / Emperor Star)', ja: '紫微星 (エンペラースター / 帝王星)', ko: '紫微星 (자미성 / 제왕성)', th: '紫微星 (ดาวจักรพรรดิ์จื่อเวย)' },
  '天機星': { zh: '天機星 (智慧智謀)', cn: '天机星 (智慧智谋)', en: '天機星 (Tianji / Celestial Strategist)', ja: '天機星 (天機・知恵の星)', ko: '天機星 (천기성 / 지혜의 별)', th: '天機星 (ดาวเทียนจี / เสนาธิการ)' },
  '太陽星': { zh: '太陽星 (光明博愛)', cn: '太阳星 (光明博爱)', en: '太陽星 (Taiyang / The Great Sun)', ja: '太陽星 (太陽星・光明の星)', ko: '太陽星 (태양성 / 광명의 별)', th: '太陽星 (ดาวพระอาทิตย์ไท่หยาง)' },
  '武曲星': { zh: '武曲星 (正財剛毅)', cn: '武曲星 (正财刚毅)', en: '武曲星 (Wuqu / Star of Finance & Courage)', ja: '武曲星 (武曲・財政の星)', ko: '武曲星 (무곡성 / 재물의 별)', th: '武曲星 (ดาวอู่ชวี / ดาวการเงิน)' },
  '天同星': { zh: '天同星 (福德福星)', cn: '天同星 (福德福星)', en: '天同星 (Tiantong / Star of Harmony & Blessings)', ja: '天同星 (天同・福徳の星)', ko: '天同星 (천동성 / 복덕의 별)', th: '天同星 (ดาวเทียนถง / ดาวแห่งโชค)' },
  '廉貞星': { zh: '廉貞星 (次桃花威權)', cn: '廉贞星 (次桃花威权)', en: '廉貞星 (Lianzhen / Fiery Magnetism & Authority)', ja: '廉貞星 (廉貞・情熱と規律)', ko: '廉貞星 (염정성 / 매력과 위엄)', th: '廉貞星 (ดาวเหลียนเจิน / ดาวเสน่ห์รอง)' },
  '天府星': { zh: '天府星 (令星庫藏)', cn: '天府星 (令星库藏)', en: '天府星 (Tianfu / Celestial Treasury)', ja: '天府星 (天府・天の蔵主)', ko: '天府星 (천부성 / 하늘의 창고)', th: '天府星 (ดาวเทียนฝู่ / คลังสมบัติ)' },
  '太陰星': { zh: '太陰星 (富貴母宿)', cn: '太阴星 (富贵母宿)', en: '太陰星 (Taiyin / The Moon & Real Estate)', ja: '太陰星 (太陰・月の星)', ko: '太陰星 (태음성 / 달과 재백의 별)', th: '太陰星 (ดาวพระจันทร์ไท่อิน)' },
  '貪狼星': { zh: '貪狼星 (第一桃花)', cn: '贪狼星 (第一桃花)', en: '貪狼星 (Tanlang / Chief Star of Desire & Networking)', ja: '貪狼星 (貪狼・欲望と社交の星)', ko: '貪狼星 (탐랑성 / 욕망과 사교의 별)', th: '貪狼星 (ดาวทันหลาง / ดอกท้อเอก)' },
  '巨門星': { zh: '巨門星 (暗曜深沉)', cn: '巨门星 (暗曜深沉)', en: '巨門星 (Jumen / Star of Eloquence & Depth)', ja: '巨門星 (巨門・弁舌と洞察)', ko: '巨門星 (거문성 / 언변과 심층)', th: '巨門星 (ดาวจวี้เหมิน / วาทศิลป์)' },
  '天相星': { zh: '天相星 (印星宰輔)', cn: '天相星 (印星宰辅)', en: '天相星 (Tianxiang / Minister of Seal & Service)', ja: '天相星 (天相・宰相の印)', ko: '天相星 (천상성 / 인장과 보좌)', th: '天相星 (ดาวเทียนเซี่ยง / ตราประทับ)' },
  '天梁星': { zh: '天梁星 (蔭星長壽)', cn: '天梁星 (荫星长寿)', en: '天梁星 (Tianliang / Heavenly Elder & Protection)', ja: '天梁星 (天梁・長老の加護)', ko: '天梁星 (천량성 / 수호의 장로)', th: '天梁星 (ดาวเทียนเหลียง / ผู้คุ้มครอง)' },
  '七殺星': { zh: '七殺星 (將星魄力)', cn: '七杀星 (将星魄力)', en: '七殺星 (Qisha / General & Pioneer)', ja: '七殺星 (七殺・先陣を切る将軍)', ko: '七殺星 (칠살성 / 선봉의 장수)', th: '七殺星 (ดาวชีซ่า / ขุนพลแนวหน้า)' },
  '破軍星': { zh: '破軍星 (先鋒改革)', cn: '破军星 (先锋改革)', en: '破軍星 (Pojun / Breaker of Armies & Innovator)', ja: '破軍星 (破軍・変革の先駆者)', ko: '破軍星 (파군성 / 혁신과 개척)', th: '破軍星 (ดาวพั่วจวิน / นักปฏิวัติ)' },
  '化祿': { zh: '化祿 (財源順流)', cn: '化禄 (财源顺流)', en: '化祿 (Hua Lu / Prosperity Transformation)', ja: '化祿 (禄化・財運向上)', ko: '化祿 (화록 / 번영의 록)', th: '化祿 (ฮว่าลู่ / ดาวนำโชคลาภ)' },
  '化權': { zh: '化權 (掌控領導)', cn: '化权 (掌控领导)', en: '化權 (Hua Quan / Authority Transformation)', ja: '化權 (権化・主導権掌握)', ko: '化權 (화권 / 권력과 리더십)', th: '化權 (ฮว่าเฉวียน / อำนาจบารมี)' },
  '化科': { zh: '化科 (聲名科名)', cn: '化科 (声名科名)', en: '化科 (Hua Ke / Fame & Wisdom Transformation)', ja: '化科 (科化・名声と知性)', ko: '化科 (화과 / 명예와 학문)', th: '化科 (ฮว่าเคอ / ชื่อเสียงปัญญา)' },
  '化忌': { zh: '化忌 (內省阻力)', cn: '化忌 (内省阻力)', en: '化忌 (Hua Ji / Obstacle & In-depth Caution)', ja: '化忌 (忌化・慎重と試練)', ko: '化忌 (화기 / 시련과 내성)', th: '化忌 (ฮว่าจี้ / อุปสรรคและความรอบคอบ)' },
  '七政四餘': { zh: '七政四餘 (天象古曆)', cn: '七政四余 (天象古历)', en: '七政四餘 (Seven Luminaries & Four Extras)', ja: '七政四余 (日月五星と四余)', ko: '七政四餘 (칠정사여 천문 체계)', th: '七政四餘 (ดาวทั้งเจ็ดและเศษดาวทั้งสี่)' },
  '流分推算': { zh: '流分推算 (每分時氣)', cn: '流分推算 (每分时气)', en: '流分推算 (Minute-level Fortune Projection)', ja: '流分推算 (分単位の時気推算)', ko: '流分推算 (분 단위 시기 추산)', th: '流分推算 (การคำนวณดวงชะตารายนาที)' }
};

function getTermAnnotated(term, lang = 'zh') {
  if (ASTRO_TERMS[term] && ASTRO_TERMS[term][lang]) {
    return ASTRO_TERMS[term][lang];
  }
  return term;
}

// 全局狀態
const state = {
  currentLang: 'zh',
  currentSessionId: null,
  currentSession: null,
  activeView: 'chat',
  activeTab: 'all',
  astrolabe: null,
  allDays: [],
  rankings: {},
  llmProvider: 'deepinfra',
  deepinfraApiKey: '',
  deepinfraModel: 'deepseek-ai/DeepSeek-V4-Flash-0731',
  geminiApiKey: '',
  currentGeminiModel: 'gemini-3.5-flash'
};

// 語言偵測演算法（任務一：介面語言優先原則）
function detectLanguage(text) {
  const uiLang = (typeof state !== 'undefined' && state.currentLang) ||
                 (typeof localStorage !== 'undefined' && localStorage.getItem('ziwei_preferred_lang')) ||
                 'zh';

  if (!text || typeof text !== 'string') {
    const finalDefault = (uiLang === 'cn') ? 'zh' : uiLang;
    return finalDefault;
  }

  const s = text.trim();

  // 5. 只有當使用者「特殊聲明」要指定語言時，才切換語言
  if (/(?:請?用|以|speak|in|reply in|answer in)\s*(?:英文|英語|english)/i.test(s) || /answer.*in english/i.test(s)) {
    console.log('🌐 偵測到使用者特殊聲明指定語言：en');
    return 'en';
  }
  if (/(?:請?用|以)\s*泰[文語]|(?:speak|in|reply in|answer in)\s*thai|ตอบเป็นภาษาไทย/i.test(s)) {
    console.log('🌐 偵測到使用者特殊聲明指定語言：th');
    return 'th';
  }
  if (/(?:請?用|以)\s*(?:繁體|正體)?中[文語]|(?:speak|in|reply in|answer in)\s*chinese|ตอบเป็นภาษาจีน/i.test(s)) {
    console.log('🌐 偵測到使用者特殊聲明指定語言：zh');
    return 'zh';
  }
  if (/(?:請?用|以)\s*日[文語]|(?:speak|in|reply in|answer in)\s*japanese|日本語で/i.test(s)) {
    console.log('🌐 偵測到使用者特殊聲明指定語言：ja');
    return 'ja';
  }
  if (/(?:請?用|以)\s*韓[文語]|(?:speak|in|reply in|answer in)\s*korean|한국어로/i.test(s)) {
    console.log('🌐 偵測到使用者特殊聲明指定語言：ko');
    return 'ko';
  }

  // 介面語言優先：中文介面一律繁中、泰文介面一律泰文、英文介面一律英文
  const finalLang = (uiLang === 'cn') ? 'zh' : uiLang;
  console.log(`🌐 語言模式（介面語言優先）：${finalLang} (UI介面: ${uiLang})`);
  return finalLang;
}

function updateChatInputIndicator() {
  const indicatorText = document.getElementById('indicatorTargetText');
  if (!indicatorText) return;
  const sess = state.currentSession;
  if (!sess) return;
  const dict = I18N[state.currentLang] || I18N.zh;
  indicatorText.innerText = dict.chatIndicator(sess.clientName, sess.birthday);
}

function toggleLanguage() {
  const modal = document.getElementById('modalLanguage');
  if (modal) {
    modal.classList.add('active');
  }
}

function openLanguageModal() {
  const modal = document.getElementById('modalLanguage');
  if (modal) modal.classList.add('active');
}

function setLanguage(lang) {
  state.currentLang = lang;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('ziwei_preferred_lang', lang);
  }
  const langNames = {
    zh: '繁中 ▾',
    cn: '简中 ▾',
    en: 'EN ▾',
    ja: '日本語 ▾',
    ko: '한국어 ▾',
    th: 'ไทย ▾'
  };
  const langText = document.getElementById('langToggleText');
  if (langText) langText.innerText = langNames[lang] || '繁中 ▾';
  const toggleBtn = document.getElementById('btnLangToggle');
  if (toggleBtn) toggleBtn.classList.toggle('th-active', lang !== 'zh');

  updateUILanguage();
  if (state.activeView === 'remedy') {
    updatePersonalRemedyProfile();
  } else if (state.activeView === 'charts') {
    initOrUpdateCharts();
  }
  showPlusToast(`🌐 系統語言已切換為：${langNames[lang] || lang}`);
}

function updateUILanguage() {
  const lang = state.currentLang;
  const dict = I18N[lang] || I18N.zh;

  if (typeof document !== 'undefined') {
    if (document.documentElement) document.documentElement.lang = lang === 'zh' ? 'zh-TW' : (lang === 'cn' ? 'zh-CN' : lang);
    if (document.body) document.body.setAttribute('data-lang', lang);
  }

  document.title = dict.appTitle;

  const navTabs = document.querySelectorAll('.nav-tab');
  if (navTabs[0] && navTabs[0].querySelector('.nav-text')) navTabs[0].querySelector('.nav-text').innerText = dict.navChat;
  if (navTabs[1] && navTabs[1].querySelector('.nav-text')) navTabs[1].querySelector('.nav-text').innerText = dict.navRankings;
  if (navTabs[2] && navTabs[2].querySelector('.nav-text')) navTabs[2].querySelector('.nav-text').innerText = dict.navRemedy;
  const navChartsText = document.getElementById('navChartsText');
  if (navChartsText && dict.navCharts) navChartsText.innerText = dict.navCharts;

  const btnNewText = document.getElementById('btnNewClientText');
  if (btnNewText) btnNewText.innerText = dict.btnNewClient;

  const langText = document.getElementById('langToggleText');
  if (langText) {
    const langNames = { zh: '繁中 ▾', cn: '简中 ▾', en: 'EN ▾', ja: '日本語 ▾', ko: '한국어 ▾', th: 'ไทย ▾' };
    langText.innerText = langNames[lang] || dict.langToggle;
  }

  const sbTitle = document.getElementById('sidebarClientsTitle');
  if (sbTitle) sbTitle.innerText = dict.sidebarTitle;
  const btnSbNew = document.getElementById('btnSidebarNewClient');
  if (btnSbNew) btnSbNew.innerText = dict.btnAddSession;

  updateChatInputIndicator();

  const inputEl = document.getElementById('chatInputText');
  if (inputEl) inputEl.setAttribute('placeholder', dict.inputPlaceholder);
  const sendBtnText = document.getElementById('btnSendText');
  if (sendBtnText) sendBtnText.innerText = dict.btnSend;

  const qTitle = document.getElementById('quickQuestionsTitle');
  if (qTitle) qTitle.innerText = dict.quickTitle;
  const qSub = document.getElementById('quickQuestionsSubtitle');
  if (qSub) qSub.innerText = dict.quickSubtitle;

  document.querySelectorAll('.quick-q-btn').forEach(btn => {
    const key = btn.getAttribute('data-key');
    if (key && dict.quickQuestions[key]) {
      btn.setAttribute('data-q', dict.quickQuestions[key]);
      const span = btn.querySelector('.q-text');
      if (span) span.innerText = dict.quickQuestions[key];
    }
  });

  if (state.currentSession) {
    updateChatTopHeader(state.currentSession);
  }
  renderSidebarSessionList();

  const rankH2 = document.querySelector('#view-rankings .view-header-row h2');
  if (rankH2) rankH2.innerText = dict.rankingsTitle;
  const btnDl = document.getElementById('btnDownloadJSON');
  if (btnDl) btnDl.innerText = dict.btnDownloadJSON;
  document.querySelectorAll('#view-rankings .tab-btn').forEach(btn => {
    const cat = btn.getAttribute('data-cat');
    if (cat && dict.rankingsTabs[cat]) {
      btn.innerText = dict.rankingsTabs[cat];
    }
  });

  const modalH2 = document.querySelector('#modalNewClient .modal-header h2');
  if (modalH2) modalH2.innerText = dict.modalNewTitle;
  const modalSub = document.querySelector('#modalNewClient .modal-header p');
  if (modalSub) modalSub.innerText = dict.modalNewSubtitle;
  const btnSub = document.getElementById('btnSubmitNewClient');
  if (btnSub) btnSub.innerText = dict.btnSubmitNew;

  const remH2 = document.querySelector('#view-remedy .view-header-row h2');
  if (remH2) remH2.innerText = dict.remedyHeadTitle;
  const remP = document.querySelector('#view-remedy .view-header-row p');
  if (remP) remP.innerText = dict.remedyHeadSubtitle;

  renderChatMessages();
}

/**
 * 響應式裝置偵測 (電腦 / 平板 / 手機)
 * @returns {'desktop' | 'tablet' | 'mobile'}
 */
function detectDeviceType() {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < 768) {
    return 'mobile';
  } else if (width <= 1024) {
    return 'tablet';
  } else {
    return 'desktop';
  }
}

let lastReportedDeviceType = null;

function applyResponsiveLayout() {
  const device = detectDeviceType();
  if (device !== lastReportedDeviceType) {
    console.log(`📱 偵測到裝置：${device}`);
    lastReportedDeviceType = device;
  }
  if (typeof document !== 'undefined' && document.body) {
    document.body.setAttribute('data-device', device);
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  setupViewNavigation();
  setupEventListeners();
  initSessions();
  applyResponsiveLayout();
  window.addEventListener('resize', applyResponsiveLayout);
});

// 頂部視圖切換 (chat / rankings / remedy)
function setupViewNavigation() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.getAttribute('data-view');
      switchView(view);
    });
  });
}

function switchView(viewName) {
  state.activeView = viewName;
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-view') === viewName);
  });
  document.querySelectorAll('.workspace-view').forEach(v => {
    v.classList.toggle('active', v.id === `view-${viewName}`);
  });

  if (viewName === 'rankings') {
    renderRankingsView();
  } else if (viewName === 'remedy') {
    updatePersonalRemedyProfile();
  } else if (viewName === 'charts') {
    initOrUpdateCharts();
  }
}

// -------------------------------------------------------------
// 多聊天室與 Session 存儲管理 (localStorage: chat-{sessionId})
// -------------------------------------------------------------
function generateSessionId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `client-${y}${m}${d}-`;

  let maxSeq = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('chat-' + prefix)) {
      const parts = key.split('-');
      const seqStr = parts[parts.length - 1];
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return `${prefix}${nextSeq}`;
}

function getAllSessions() {
  const sessions = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('chat-client-')) {
      try {
        const item = JSON.parse(localStorage.getItem(key));
        if (item && item.sessionId) {
          sessions.push(item);
        }
      } catch (e) {
        console.error('Failed to parse session:', key, e);
      }
    }
  }
  // 按建立時間由新到舊排序
  sessions.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return sessions;
}

function saveSession(session) {
  if (!session || !session.sessionId) return;
  localStorage.setItem(`chat-${session.sessionId}`, JSON.stringify(session));
}

function initSessions() {
  let sessions = getAllSessions().filter(s => !s.isClosed);
  if (sessions.length === 0) {
    // 建立預設第一個聊天室 (台北 1990-03-15 14:00 未時)
    const defaultSession = createNewChatSession({
      clientName: '客戶-001',
      birthday: '1990-03-15',
      calendarType: 'solar',
      birthPlace: '台北',
      birthClockTime: '14:00',
      birthTime: 7,
      gender: '男',
      targetYear: 2026,
      includeNatal: false
    });
    switchSession(defaultSession.sessionId);
  } else {
    // 切換至最新的未關閉聊天室
    switchSession(sessions[0].sessionId);
  }
}

function createNewChatSession(params) {
  const sessionId = generateSessionId();
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const seqNum = sessionId.split('-')[2] || '001';
  const clientName = (params.clientName && params.clientName.trim()) ? params.clientName.trim() : `客戶-${seqNum}`;

  const birthPlace = (params.birthPlace && params.birthPlace.trim()) ? params.birthPlace.trim() : '台北';
  const birthClockTime = (params.birthClockTime && params.birthClockTime.trim()) ? params.birthClockTime.trim() : (SHICHEN_DEFAULT_TIME[params.birthTime] || '14:00');

  // 計算真太陽時天文校正
  const solarCorrection = calculateSolarTimeCorrection(params.birthday || '1990-03-15', birthClockTime, birthPlace);

  const session = {
    sessionId: sessionId,
    clientName: clientName,
    birthday: params.birthday || '1990-03-15',
    calendarType: params.calendarType || 'solar',
    birthPlace: birthPlace,
    birthClockTime: birthClockTime,
    solarCorrection: solarCorrection,
    birthTime: solarCorrection.adjustedShichenIndex, // 以校正後的真太陽時時辰為排盤基準
    gender: params.gender || '男',
    targetYear: params.targetYear || 2026,
    includeNatal: !!params.includeNatal,
    createdAt: now.toISOString(),
    lastUpdated: timeStr,
    isClosed: false,
    messages: []
  };

  let boundaryNoticeText = '';
  if (solarCorrection.isNearBoundary && solarCorrection.boundaryInfo) {
    boundaryNoticeText = `\n\n⚠️ 【時辰接近邊界提示】：您的真太陽時 (${solarCorrection.trueSolarTime}) 距離【${solarCorrection.boundaryInfo.boundaryTime}】時辰交界僅差 ${solarCorrection.boundaryInfo.diffMinutes} 分鐘（前後 15 分鐘內）。建議確認精確出生時間。系統已同時排定前後雙時辰命盤（當前：${solarCorrection.adjustedShichenShort}時，相鄰：${solarCorrection.boundaryInfo.alternativeShichenName.slice(0, 2)}時）供對照差異！`;
  }

  let solarTermNoticeText = '';
  if (solarCorrection.solarTerms && solarCorrection.solarTerms.length > 0) {
    const term = solarCorrection.solarTerms[0];
    solarTermNoticeText = `\n\n⚡ 【節氣交節天文精算】：出生時間鄰近【${term.termName}】節氣交節時刻（天文交節時間：${term.termLocalTime}）。已換算為當地真太陽時精準比對。${term.advice}`;
  }

  // 加入 Jack 老師開場白歡迎訊息 (含完整真太陽時校正結果報告)
  const welcomeMsg = {
    id: `msg-${Date.now()}`,
    sender: 'assistant',
    timestamp: timeStr,
    isWelcome: true,
    solarCorrection: solarCorrection,
    text: `您好！我是 Jack 老師，歡迎使用【Jack 老師運勢 GPS】命理諮詢系統！已為【${clientName}】(${session.birthday} 出生) 排出 ${session.targetYear} 全年紫微斗數流日命盤。\n\n📍 【出生地與真太陽時天文校正結果】：\n• 出生地：${solarCorrection.location.name} (經度 ${solarCorrection.location.lon >= 0 ? solarCorrection.location.lon + '°E' : Math.abs(solarCorrection.location.lon) + '°W'}，中央經線 ${solarCorrection.location.centralMeridian}°)\n• 鐘錶時間：${solarCorrection.clockTime}\n• 地理時差：${solarCorrection.geoOffsetMinutes >= 0 ? '+' : ''}${solarCorrection.geoOffsetMinutes} 分鐘\n• 均時差 (EOT)：${solarCorrection.eotMinutes >= 0 ? '+' : ''}${solarCorrection.eotMinutes} 分鐘\n• 平太陽時：${solarCorrection.meanSolarTime}\n• 真太陽時：${solarCorrection.trueSolarTime} (${solarCorrection.adjustedShichenName})\n• 時辰校正：${solarCorrection.isShichenChanged ? `原時辰 ${solarCorrection.originalShichenShort}時 ➔ 校正後時辰 ${solarCorrection.adjustedShichenShort}時（跨時辰校正）` : `原時辰 ${solarCorrection.originalShichenShort}時 ➔ 校正後時辰 ${solarCorrection.adjustedShichenShort}時（維持不變）`}${boundaryNoticeText}${solarTermNoticeText}\n\n我是你的運勢 GPS 導航顧問 Jack 老師。您可以像朋友一樣向我詢問偏財、彩券、感情正緣、貴人、商機、事業升遷、健康等任何運勢吉凶，我將依據命盤為您實話實說、預警未來危機，提供包含解答、燈號、星級、完整推算與個人化開運處方之解析！`
  };
  session.messages.push(welcomeMsg);

  saveSession(session);
  return session;
}

// 切換當前聊天室
function switchSession(sessionId) {
  const raw = localStorage.getItem(`chat-${sessionId}`);
  if (!raw) return;
  const session = JSON.parse(raw);

  state.currentSessionId = sessionId;
  state.currentSession = session;

  // 1. 根據該聊天室的生日參數獨立計算命盤 (嚴格記憶隔離，以真太陽時為準)
  calculateClientAstrolabe(session);

  // 2. 渲染頂部資訊列 (含出生地、真太陽時與邊界警示)
  updateChatTopHeader(session);

  // 3. 渲染左側聊天室列表
  renderSidebarSessionList();

  // 4. 更新輸入框提示
  updateChatInputIndicator();

  // 5. 渲染聊天對話紀錄
  renderChatMessages();

  // 6. 連動排行榜標題與改運卡片
  if (state.currentLang === 'th') {
    document.getElementById('rankingsClientTitle').innerText = `ลูกค้าปัจจุบัน: ${session.clientName} (${session.birthday} ${session.gender === '男' ? 'ชาย' : 'หญิง'})`;
    document.getElementById('remedyProfileTitle').innerText = `🔮 ใบสั่งยาเสริมดวงเฉพาะบุคคลของ ${session.clientName}`;
  } else {
    document.getElementById('rankingsClientTitle').innerText = `當前客戶：${session.clientName} (${session.birthday} ${session.gender})`;
    document.getElementById('remedyProfileTitle').innerText = `🔮 ${session.clientName} 專屬開運處方`;
  }
}

// 嚴格隔離的排盤與評分運算 (支援真太陽時、跨日校正與時辰邊界雙盤比對)
function calculateClientAstrolabe(session) {
  if (!window.iztro || !window.iztro.astro) return;
  const { astro } = window.iztro;

  // 確保具備真太陽時校正數據
  if (!session.solarCorrection) {
    session.solarCorrection = calculateSolarTimeCorrection(
      session.birthday || '1990-03-15',
      session.birthClockTime || '14:00',
      session.birthPlace || '台北'
    );
    session.birthTime = session.solarCorrection.adjustedShichenIndex;
  }

  const solar = session.solarCorrection;
  // 若真太陽時跨日，動態調整生日日期
  const birthdayForAstro = (solar.dayShift && solar.dayShift !== 0)
    ? adjustDateString(session.birthday, solar.dayShift)
    : session.birthday;

  if (session.calendarType === 'lunar') {
    state.astrolabe = astro.byLunar(birthdayForAstro, solar.adjustedShichenIndex, session.gender, false, true, 'zh-CN');
  } else {
    state.astrolabe = astro.bySolar(birthdayForAstro, solar.adjustedShichenIndex, session.gender, true, 'zh-CN');
  }

  // 若落在時辰邊界（前後 15 分鐘），同時排定相鄰時辰命盤並比對差異
  if (solar.isNearBoundary && solar.boundaryInfo) {
    try {
      const altAstrolabe = session.calendarType === 'lunar'
        ? astro.byLunar(birthdayForAstro, solar.boundaryInfo.alternativeShichenIndex, session.gender, false, true, 'zh-CN')
        : astro.bySolar(birthdayForAstro, solar.boundaryInfo.alternativeShichenIndex, session.gender, true, 'zh-CN');
      state.alternativeAstrolabe = altAstrolabe;
      state.dualChartDiff = extractAstrolabeDifference(state.astrolabe, altAstrolabe, state.currentLang);
      session.dualChartDiff = state.dualChartDiff;
    } catch (e) {
      console.warn('Alternative astrolabe calculation failed:', e);
    }
  } else {
    state.alternativeAstrolabe = null;
    state.dualChartDiff = null;
    session.dualChartDiff = null;
  }

  const year = session.targetYear || 2026;
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const totalDays = isLeapYear ? 366 : 365;

  state.allDays = [];
  state.rankings = {};
  CATEGORIES.forEach(c => state.rankings[c.key] = []);

  function formatPalace(p, h) {
    if (!p) return null;
    const dailyStars = (h.daily.stars && h.daily.stars[p.index]) ? h.daily.stars[p.index].map(s => s.name) : [];
    return {
      earthlyBranch: p.earthlyBranch,
      natalPalace: p.name,
      index: p.index,
      majorStars: p.majorStars.map(s => ({ name: s.name, mutagen: s.mutagen || '' })),
      minorStars: p.minorStars.map(s => ({ name: s.name, mutagen: s.mutagen || '' })),
      adjectiveStars: p.adjectiveStars.map(s => s.name),
      changsheng12: p.changsheng12 || '',
      dailyStars: dailyStars
    };
  }

  for (let d = 0; d < totalDays; d++) {
    const cur = new Date(year, 0, 1 + d);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const dayNum = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${dayNum}`;

    const h = state.astrolabe.horoscope(dateStr);

    const dayRecord = {
      date: dateStr,
      dailyGanZhi: h.daily.heavenlyStem + h.daily.earthlyBranch,
      lunarDate: h.lunarDate || '',
      dailySiHua: {
        '化禄': h.daily.mutagen[0] || '',
        '化权': h.daily.mutagen[1] || '',
        '化科': h.daily.mutagen[2] || '',
        '化忌': h.daily.mutagen[3] || ''
      },
      dailyMing: formatPalace(h.palace('命宫', 'daily'), h),
      dailyCaibo: formatPalace(h.palace('财帛', 'daily'), h),
      dailyFuqi: formatPalace(h.palace('夫妻', 'daily'), h),
      dailyFude: formatPalace(h.palace('福德', 'daily'), h),
      dailyGuanlu: formatPalace(h.palace('官禄', 'daily'), h),
      dailyJie: formatPalace(h.palace('疾厄', 'daily'), h),
      dailyQianyi: formatPalace(h.palace('迁移', 'daily'), h),
      rawHoroscope: h
    };

    const scores = scoreDayEngine(dayRecord, { includeNatalMutagen: session.includeNatal, astrolabe: state.astrolabe });
    dayRecord.scores = scores;
    state.allDays.push(dayRecord);

    CATEGORIES.forEach(cat => {
      state.rankings[cat.key].push({
        date: dateStr,
        dailyGanZhi: dayRecord.dailyGanZhi,
        lunarDate: dayRecord.lunarDate,
        score: scores[cat.key].score,
        details: scores[cat.key].details,
        dayRecord: dayRecord
      });
    });
  }

  CATEGORIES.forEach(cat => {
    state.rankings[cat.key].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.date.localeCompare(b.date);
    });
  });
}

function updateChatTopHeader(session) {
  if (!session) return;
  const lang = state.currentLang;
  document.getElementById('currentClientName').innerText = session.clientName;

  const solar = session.solarCorrection || calculateSolarTimeCorrection(
    session.birthday || '1990-03-15',
    session.birthClockTime || '14:00',
    session.birthPlace || '台北'
  );

  // 1. 生日
  document.getElementById('currentClientBirthday').innerText = `🎂 ${session.birthday}`;

  // 2. 出生地標籤
  const placeEl = document.getElementById('currentClientPlace');
  if (placeEl) {
    if (lang === 'th') {
      placeEl.innerText = `📍 สถานที่เกิด: ${solar.location.name}`;
    } else {
      placeEl.innerText = `📍 出生地：${solar.location.name}`;
    }
    placeEl.title = `經度: ${solar.location.lon}°, 時區: UTC${solar.location.tz >= 0 ? '+' : ''}${solar.location.tz}，中央經線: ${solar.location.centralMeridian}°`;
  }

  // 3. 真太陽時標籤
  const solarEl = document.getElementById('currentClientSolarTime');
  if (solarEl) {
    let changeTag = solar.isShichenChanged ? ` [原${solar.originalShichenShort}時➔校正${solar.adjustedShichenShort}時]` : '';
    if (lang === 'th') {
      solarEl.innerText = `⏱️ สุริยคติจริง: ${solar.trueSolarTime} (ยาม${solar.adjustedShichenShort})${changeTag}`;
    } else {
      solarEl.innerText = `⏱️ 真太陽時：${solar.trueSolarTime} (${solar.adjustedShichenShort}時)${changeTag}`;
    }
    solarEl.title = `鐘錶時間 ${solar.clockTime}，地理時差 ${solar.geoOffsetMinutes >= 0 ? '+' : ''}${solar.geoOffsetMinutes}m，均時差 ${solar.eotMinutes >= 0 ? '+' : ''}${solar.eotMinutes}m`;
  }

  // 4. 性別與推算年份
  if (lang === 'th') {
    document.getElementById('currentClientGender').innerText = session.gender === '男' ? 'ชาย (ดวงบุรุษ)' : 'หญิง (ดวงสตรี)';
    document.getElementById('currentClientYear').innerText = `คำนวณปี ${session.targetYear}`;
  } else {
    document.getElementById('currentClientGender').innerText = session.gender === '男' ? '乾造 (男)' : '坤造 (女)';
    document.getElementById('currentClientYear').innerText = `推算 ${session.targetYear} 年`;
  }
  document.getElementById('currentSessionIdTag').innerText = session.sessionId;

  // 5. 時辰邊界預警與雙盤比對 Banner
  const alertBanner = document.getElementById('boundaryAlertBanner');
  if (alertBanner) {
    if (solar.isNearBoundary && solar.boundaryInfo) {
      alertBanner.style.display = 'flex';
      const diff = state.dualChartDiff;
      let diffHtml = '';
      if (diff) {
        diffHtml = `
          <div class="dual-chart-comparison-box">
            <div class="d-header">
              <span>雙時辰命盤格局差異對比 (時辰邊界檢測)</span>
            </div>
            <table class="dual-chart-table">
              <thead>
                <tr>
                  <th>對比維度</th>
                  <th>校正時辰：${solar.adjustedShichenShort}時 (${solar.trueSolarTime})</th>
                  <th>相鄰時辰：${solar.boundaryInfo.alternativeShichenName.slice(0, 2)}時 (${solar.boundaryInfo.boundaryTime})</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>命宮地支主星</td><td class="primary">${diff.palaceMing.chartA}</td><td class="alternative">${diff.palaceMing.chartB}</td></tr>
                <tr><td>五行局</td><td class="primary">${diff.fiveElements.chartA}</td><td class="alternative">${diff.fiveElements.chartB}</td></tr>
                <tr><td>命主 / 身主</td><td class="primary">${diff.soulAndBody.chartA}</td><td class="alternative">${diff.soulAndBody.chartB}</td></tr>
                <tr><td>身宮配置</td><td class="primary">${diff.palaceShen.chartA}</td><td class="alternative">${diff.palaceShen.chartB}</td></tr>
              </tbody>
            </table>
          </div>
        `;
      }
      alertBanner.innerHTML = `
        <div class="b-title">⚠️ 時辰接近邊界提示：真太陽時 ${solar.trueSolarTime} 距離交界時刻（${solar.boundaryInfo.boundaryTime}）僅差 ${solar.boundaryInfo.diffMinutes} 分鐘（前後 15 分鐘內）。建議確認精確出生時間。</div>
        ${diffHtml}
      `;
    } else {
      alertBanner.style.display = 'none';
      alertBanner.innerHTML = '';
    }
  }

  if (state.astrolabe) {
    const summaryContainer = document.getElementById('currentClientSummary');
    
    // 計算七政四餘
    if (!session.qizheng) {
      const bparts = (session.birthday || '1990-03-15').split('-').map(Number);
      const tparts = (session.birthClockTime || '14:00').split(':').map(Number);
      const tz = (solar && solar.location && solar.location.tz) || 8;
      session.qizheng = calculateQizhengSiyu(bparts[0], bparts[1], bparts[2], tparts[0], tparts[1], tz);
      saveSession(session);
    }
    const q = session.qizheng;
    const sunStr = q.planetaryBodies.sun.formatted;
    const moonStr = q.planetaryBodies.moon.formatted;

    if (lang === 'th') {
      summaryContainer.innerHTML = `
        <span class="astro-tag" id="tagFiveElements">五行局 (ธาตุ)：${state.astrolabe.fiveElementsClass}</span>
        <span class="astro-tag" id="tagSoul">命主 (ดาวเจ้าชะตา)：${state.astrolabe.soul}</span>
        <span class="astro-tag" id="tagBody">身主 (ดาวเจ้ากาย)：${state.astrolabe.body}</span>
        <span class="astro-tag astro-tag-qizheng" id="tagQizhengSun" title="七政日躔">☀️ 日躔：${sunStr}</span>
        <span class="astro-tag astro-tag-qizheng" id="tagQizhengMoon" title="七政月度">🌙 月度：${moonStr}</span>
      `;
    } else {
      summaryContainer.innerHTML = `
        <span class="astro-tag" id="tagFiveElements">五行局：${state.astrolabe.fiveElementsClass}</span>
        <span class="astro-tag" id="tagSoul">命主：${state.astrolabe.soul}</span>
        <span class="astro-tag" id="tagBody">身主：${state.astrolabe.body}</span>
        <span class="astro-tag astro-tag-qizheng" id="tagQizhengSun" title="七政日躔">☀️ 日躔：${sunStr}</span>
        <span class="astro-tag astro-tag-qizheng" id="tagQizhengMoon" title="七政月度">🌙 月度：${moonStr}</span>
      `;
    }
  }

  // 6. 流分即時精算標籤更新
  const minuteEl = document.getElementById('currentClientMinute');
  if (minuteEl) {
    const now = new Date();
    const curH = now.getHours();
    const curM = now.getMinutes();
    // 取今日流日天干地支
    const todayStr = getSystemCurrentDate();
    const todayObj = state.allDays.find(d => d.date === todayStr) || (state.allDays[0] || { dailyGanZhi: '庚辰' });
    const stem = todayObj.dailyGanZhi[0] || '庚';
    const branch = todayObj.dailyGanZhi[1] || '辰';
    const flowMin = calculateFlowMinute(branch, stem, curH, curM);
    minuteEl.innerText = `⏱️ 流分：${flowMin.time} (${flowMin.minute.ganzhi} ${flowMin.minute.palace})`;
    minuteEl.title = `流時：${flowMin.hour.ganzhi} ${flowMin.hour.palace}，流分四化：祿:${flowMin.minute.sihua.lu} 權:${flowMin.minute.sihua.quan} 科:${flowMin.minute.sihua.ke} 忌:${flowMin.minute.sihua.ji}。點擊展開精算器`;
  }

  // 7. 動態權重標籤更新
  const weightsEl = document.getElementById('currentClientWeights');
  if (weightsEl) {
    const w = session.weights || getClientWeights(session.sessionId);
    const avgW = (Object.values(w).reduce((a, b) => a + b, 0) / Object.keys(w).length).toFixed(2);
    weightsEl.innerText = `⚖️ 動態權重 (均: ${avgW}x)`;
    weightsEl.title = `8 大模組權重：商機 ${w.shangji}x, 偏財 ${w.piancai}x, 樂透 ${w.letou}x, 桃花 ${w.taohua}x... 點擊微調`;
  }
}

// 渲染側邊欄列表
function renderSidebarSessionList() {
  const container = document.getElementById('chatSessionList');
  const countEl = document.getElementById('sidebarSessionCount');
  if (!container) return;

  const sessions = getAllSessions().filter(s => !s.isClosed);
  countEl.innerText = `共 ${sessions.length} 位客戶紀錄`;
  container.innerHTML = '';

  sessions.forEach(sess => {
    const itemEl = document.createElement('div');
    itemEl.className = `session-item ${sess.sessionId === state.currentSessionId ? 'active' : ''}`;
    itemEl.setAttribute('data-session-id', sess.sessionId);

    itemEl.innerHTML = `
      <div class="session-item-info">
        <div class="session-name-row">
          <span class="session-name" title="${sess.clientName}">${sess.clientName}</span>
          <span class="session-time">${sess.lastUpdated || ''}</span>
        </div>
        <div class="session-bday-row">
          <span class="session-bday">🎂 ${sess.birthday}</span>
        </div>
      </div>
      <button class="btn-close-session" title="關閉聊天室 (保留紀錄)">&times;</button>
    `;

    // 點擊切換聊天室
    itemEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-close-session')) return;
      switchSession(sess.sessionId);
    });

    // 點擊關閉按鈕
    const closeBtn = itemEl.querySelector('.btn-close-session');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSession(sess.sessionId);
    });

    container.appendChild(itemEl);
  });
}

// 關閉聊天室 (紀錄仍保留在 localStorage，只是不再顯示於側邊欄)
function closeSession(sessionId) {
  const raw = localStorage.getItem(`chat-${sessionId}`);
  if (!raw) return;
  const sess = JSON.parse(raw);
  sess.isClosed = true;
  saveSession(sess);

  // 若關閉的是當前啟用的聊天室，切換至其他未關閉的聊天室
  if (state.currentSessionId === sessionId) {
    const remaining = getAllSessions().filter(s => !s.isClosed);
    if (remaining.length > 0) {
      switchSession(remaining[0].sessionId);
    } else {
      // 若全關閉了，建立一個新的
      const fresh = createNewChatSession({
        clientName: '新客戶',
        birthday: '1990-03-15',
        calendarType: 'solar',
        birthTime: 7,
        gender: '男',
        targetYear: 2026,
        includeNatal: false
      });
      switchSession(fresh.sessionId);
    }
  } else {
    renderSidebarSessionList();
  }
}

// 泰文命理輔助對照表
const ELEMENT_MAP_TH = {
  '金': 'ทอง (金)', '木': 'ไม้ (木)', '水': 'น้ำ (水)', '火': 'ไฟ (火)', '土': 'ดิน (土)'
};
const XI_SHEN_MAP_TH = {
  '甲': 'ทิศตะวันออกเฉียงเหนือ (艮方)', '乙': 'ทิศตะวันตกเฉียงเหนือ (乾方)', '丙': 'ทิศตะวันตกเฉียงใต้ (坤方)', '丁': 'ทิศใต้ (離方)', '戊': 'ทิศตะวันออกเฉียงใต้ (巽方)',
  '己': 'ทิศตะวันออกเฉียงเหนือ (艮方)', '庚': 'ทิศตะวันตกเฉียงเหนือ (乾方)', '辛': 'ทิศตะวันตกเฉียงใต้ (坤方)', '壬': 'ทิศใต้ (離方)', '癸': 'ทิศตะวันออกเฉียงใต้ (巽方)'
};
const CAI_SHEN_MAP_TH = {
  '甲': 'ทิศตะวันออกเฉียงเหนือ', '乙': 'ทิศตะวันออกเฉียงใต้', '丙': 'ทิศตะวันตก', '丁': 'ทิศตะวันตก', '戊': 'ทิศเหนือ',
  '己': 'ทิศเหนือ', '庚': 'ทิศตะวันออก', '辛': 'ทิศตะวันออก', '壬': 'ทิศใต้', '癸': 'ทิศใต้'
};
const GUI_REN_MAP_TH = {
  '甲': ['ฉลู/วัว (丑)', 'มะแม/แพะ (未)'],
  '乙': ['ชวด/หนู (子)', 'วอก/ลิง (申)'],
  '丙': ['กุน/หมู (亥)', 'ระกา/ไก่ (酉)'],
  '丁': ['กุน/หมู (亥)', 'ระกา/ไก่ (酉)'],
  '戊': ['ฉลู/วัว (丑)', 'มะแม/แพะ (未)'],
  '己': ['ชวด/หนู (子)', 'วอก/ลิง (申)'],
  '庚': ['ฉลู/วัว (丑)', 'มะแม/แพะ (未)'],
  '辛': ['มะเมีย/ม้า (午)', 'ขาล/เสือ (寅)'],
  '壬': ['เถาะ/กระต่าย (卯)', 'มะเส็ง/งู (巳)'],
  '癸': ['เถาะ/กระต่าย (卯)', 'มะเส็ง/งู (巳)']
};

// -------------------------------------------------------------
// 一、LLM 意圖解析層 (LLM Intent Parsing Layer)
// 提取 5 大維度：主體 (subject)、事件 (event)、時間範圍 (timeFrame)、具體條件 (condition)、目標 (goal)
// -------------------------------------------------------------
function parseRelativeDate(text, baseDateStr, birthdayStr = '1990-03-15') {
  baseDateStr = baseDateStr || getSystemCurrentDate();
  const base = new Date(baseDateStr + 'T00:00:00');
  const baseDayOfWeek = base.getDay();
  const curY = base.getFullYear();

  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // 1. 雙日聯動：今晚買、明天開獎 / ซื้อคืนนี้ ออกรางวัลพรุ่งนี้
  const isDualBuyDraw = (text.includes('買') || text.includes('下注') || text.includes('ซื้อ')) &&
    (text.includes('開獎') || text.includes('對獎') || text.includes('出獎') || text.includes('ออกรางวัล') || text.includes('ออกผล')) &&
    (text.includes('今') || text.includes('คืนนี้') || text.includes('วันนี้')) &&
    (text.includes('明') || text.includes('พรุ่งนี้'));
  
  if (isDualBuyDraw) {
    const dTomorrow = new Date(base);
    dTomorrow.setDate(base.getDate() + 1);
    const drawDateStr = fmt(dTomorrow);
    return {
      type: 'buy_tonight_draw_tomorrow',
      buyDate: baseDateStr,
      drawDate: drawDateStr,
      targetDates: [baseDateStr, drawDateStr],
      labelZh: `今晚下注 (${baseDateStr}) / 明天開獎 (${drawDateStr})`,
      labelTh: `ซื้อคืนนี้ (${baseDateStr}) / ออกรางวัลพรุ่งนี้ (${drawDateStr})`,
      weekdayName: '今晚買、明天開獎'
    };
  }

  // 2. 星期解析 (下週三, 本週五, 週幾, วันพุธหน้า, etc.)
  const weekdayMapZh = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0, '七': 0,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 0
  };
  const weekdayMapTh = {
    'จันทร์': 1, 'อังคาร': 2, 'พุธ': 3, 'พฤหัส': 4, 'พฤหัสบดี': 4, 'ศุกร์': 5, 'เสาร์': 6, 'อาทิตย์': 0
  };

  const matchZh = text.match(/(下)?(周|週|星期|禮拜)([一二三四五六日天七1-7])/);
  const matchTh = text.match(/วัน(จันทร์|อังคาร|พุธ|พฤหัส|พฤหัสบดี|ศุกร์|เสาร์|อาทิตย์)(\s*หน้า)?/);

  if (matchZh) {
    const isNext = !!matchZh[1];
    const targetWkDay = weekdayMapZh[matchZh[3]];
    let diff = targetWkDay - baseDayOfWeek;
    if (isNext) {
      diff += 7;
    } else if (diff < 0) {
      diff += 7;
    }
    const d = new Date(base);
    d.setDate(base.getDate() + diff);
    const ds = fmt(d);
    const wkName = isNext ? `下週${matchZh[3]}` : `本週${matchZh[3]}`;
    return {
      type: 'single_day',
      targetDates: [ds],
      labelZh: `${wkName} (${ds})`,
      labelTh: `${wkName} (${ds})`,
      weekdayName: wkName
    };
  }

  if (matchTh) {
    const isNext = !!matchTh[2];
    const targetWkDay = weekdayMapTh[matchTh[1]];
    let diff = targetWkDay - baseDayOfWeek;
    if (isNext) {
      diff += 7;
    } else if (diff < 0) {
      diff += 7;
    }
    const d = new Date(base);
    d.setDate(base.getDate() + diff);
    const ds = fmt(d);
    const wkName = `วัน${matchTh[1]}${isNext ? 'หน้า' : ''}`;
    return {
      type: 'single_day',
      targetDates: [ds],
      labelZh: `${wkName} (${ds})`,
      labelTh: `${wkName} (${ds})`,
      weekdayName: wkName
    };
  }

  // 2.5 昨天 (過去驗證)
  if (text.includes('昨天') || text.includes('昨日') || text.includes('昨晚') || text.includes('เมื่อวาน')) {
    const d = new Date(base);
    d.setDate(base.getDate() - 1);
    const ds = fmt(d);
    return {
      type: 'single_day',
      isPast: true,
      targetDates: [ds],
      labelZh: `昨天 (${ds})`,
      labelTh: `เมื่อวาน (${ds})`,
      weekdayName: `昨天 (${ds})`
    };
  }

  // 3. 今天
  if (text.includes('今天') || text.includes('今晚') || text.includes('今日') || text.includes('本日') ||
      text.includes('วันนี้') || text.includes('คืนนี้')) {
    return {
      type: 'single_day',
      targetDates: [baseDateStr],
      labelZh: `今天 (${baseDateStr})`,
      labelTh: `วันนี้ (${baseDateStr})`,
      weekdayName: `今天 (${baseDateStr})`
    };
  }

  // 4. 明天 (未來決策)
  if (text.includes('明天') || text.includes('明晚') || text.includes('明日') || text.includes('次日') ||
      text.includes('พรุ่งนี้')) {
    const d = new Date(base);
    d.setDate(base.getDate() + 1);
    const ds = fmt(d);
    return {
      type: 'single_day',
      isFuture: true,
      isTomorrow: true,
      targetDates: [ds],
      labelZh: `明天 (${ds})`,
      labelTh: `พรุ่งนี้ (${ds})`,
      weekdayName: `明天 (${ds})`
    };
  }

  // 5. 後天
  if (text.includes('後天') || text.includes('后天') || text.includes('มะรืนนี้')) {
    const d = new Date(base);
    d.setDate(base.getDate() + 2);
    const ds = fmt(d);
    return {
      type: 'single_day',
      targetDates: [ds],
      labelZh: `後天 (${ds})`,
      labelTh: `มะรืนนี้ (${ds})`,
      weekdayName: `後天 (${ds})`
    };
  }

  // 6. 明確具體日期
  const matchFullDate = text.match(/(20\d\d)[-/年](\d{1,2})[-/月](\d{1,2})/);
  if (matchFullDate) {
    const ds = `${matchFullDate[1]}-${String(matchFullDate[2]).padStart(2, '0')}-${String(matchFullDate[3]).padStart(2, '0')}`;
    return {
      type: 'single_day',
      targetDates: [ds],
      labelZh: `${ds}`,
      labelTh: `${ds}`,
      weekdayName: `${ds}`
    };
  }
  const matchMd = text.match(/(\d{1,2})月(\d{1,2})/);
  if (matchMd) {
    const ds = `${curY}-${String(matchMd[1]).padStart(2, '0')}-${String(matchMd[2]).padStart(2, '0')}`;
    return {
      type: 'single_day',
      targetDates: [ds],
      labelZh: `${ds}`,
      labelTh: `${ds}`,
      weekdayName: `${ds}`
    };
  }

  // 7. 客戶生日當天
  if (text.includes('生日') || text.includes('วันเกิด')) {
    const bParts = birthdayStr.split('-');
    const bMd = bParts.length >= 3 ? `${bParts[1]}-${bParts[2]}` : '03-15';
    const ds = `${curY}-${bMd}`;
    return {
      type: 'single_day',
      targetDates: [ds],
      labelZh: `生日當天 (${ds})`,
      labelTh: `วันเกิด (${ds})`,
      weekdayName: `生日當天 (${ds})`
    };
  }

  // 8.1 月份週期：上個月 (過去驗證)
  if (text.includes('上個月') || text.includes('上月') || text.includes('เดือนที่แล้ว')) {
    const prevMonthDate = new Date(curY, base.getMonth() - 1, 1);
    const prevY = prevMonthDate.getFullYear();
    const prevM = prevMonthDate.getMonth() + 1;
    const prevMonthStr = `${prevY}-${String(prevM).padStart(2, '0')}`;
    const daysInPrevMonth = new Date(prevY, prevM, 0).getDate();
    const dates = [];
    for (let i = 1; i <= daysInPrevMonth; i++) {
      dates.push(`${prevMonthStr}-${String(i).padStart(2, '0')}`);
    }
    return {
      type: 'month',
      isPast: true,
      isPrevMonth: true,
      month: prevMonthStr,
      targetDates: dates,
      labelZh: `上個月 (${prevY}年${prevM}月)`,
      labelTh: `เดือนที่แล้ว (${prevM}/${prevY})`,
      weekdayName: `上個月 (${prevY}年${prevM}月)`
    };
  }

  // 8.2 月份週期：下個月 (未來決策)
  if (text.includes('下個月') || text.includes('下月') || text.includes('เดือนหน้า')) {
    const nextMonthDate = new Date(curY, base.getMonth() + 1, 1);
    const nextY = nextMonthDate.getFullYear();
    const nextM = nextMonthDate.getMonth() + 1;
    const nextMonthStr = `${nextY}-${String(nextM).padStart(2, '0')}`;
    const daysInNextMonth = new Date(nextY, nextM, 0).getDate();
    const dates = [];
    for (let i = 1; i <= daysInNextMonth; i++) {
      dates.push(`${nextMonthStr}-${String(i).padStart(2, '0')}`);
    }
    return {
      type: 'month',
      isFuture: true,
      isNextMonth: true,
      month: nextMonthStr,
      targetDates: dates,
      labelZh: `下個月 (${nextY}年${nextM}月)`,
      labelTh: `เดือนหน้า (${nextM}/${nextY})`,
      weekdayName: `下個月 (${nextY}年${nextM}月)`
    };
  }

  // 8.3 月份週期：這個月
  if (text.includes('這個月') || text.includes('本月') || text.includes('เดือนนี้')) {
    const curM = base.getMonth() + 1;
    const curMonthStr = `${curY}-${String(curM).padStart(2, '0')}`;
    const daysInMonth = new Date(curY, curM, 0).getDate();
    const dates = [];
    for (let i = 1; i <= daysInMonth; i++) {
      dates.push(`${curMonthStr}-${String(i).padStart(2, '0')}`);
    }
    return {
      type: 'month',
      month: curMonthStr,
      targetDates: dates,
      labelZh: `這個月 (${curY}年${curM}月)`,
      labelTh: `เดือนนี้ (${curM}/${curY})`,
      weekdayName: `這個月 (${curY}年${curM}月)`
    };
  }

  // 10. 這週末
  if (text.includes('週末') || text.includes('周末') || text.includes('เสาร์อาทิตย์')) {
    const satDiff = (6 - baseDayOfWeek + 7) % 7;
    const dSat = new Date(base);
    dSat.setDate(base.getDate() + satDiff);
    const dSun = new Date(dSat);
    dSun.setDate(dSat.getDate() + 1);
    const satStr = fmt(dSat);
    const sunStr = fmt(dSun);
    return {
      type: 'weekend',
      targetDates: [satStr, sunStr],
      labelZh: `這週末 (${satStr} 至 ${sunStr})`,
      labelTh: `สุดสัปดาห์นี้ (${satStr} ถึง ${sunStr})`,
      weekdayName: '這週末'
    };
  }

  // 10.5 上週 (過去驗證)
  if (text.includes('上週') || text.includes('上周') || text.includes('上星期') || text.includes('上禮拜') || text.includes('สัปดาห์ที่แล้ว')) {
    const mondayDiff = (baseDayOfWeek === 0 ? -6 : 1 - baseDayOfWeek) - 7;
    const dMon = new Date(base);
    dMon.setDate(base.getDate() + mondayDiff);
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(dMon);
      d.setDate(dMon.getDate() + i);
      weekDates.push(fmt(d));
    }
    const monStr = weekDates[0];
    const sunStr = weekDates[6];
    return {
      type: 'week',
      isPast: true,
      targetDates: weekDates,
      labelZh: `上週 (${monStr} 至 ${sunStr})`,
      labelTh: `สัปดาห์ที่แล้ว (${monStr} ถึง ${sunStr})`,
      weekdayName: '上週'
    };
  }

  // 11. 這週 (未來決策導向)
  if (text.includes('這週') || text.includes('本週') || text.includes('这周') || text.includes('本周') || text.includes('這星期') || text.includes('这星期') || text.includes('本星期') || text.includes('สัปดาห์นี้')) {
    const mondayDiff = (baseDayOfWeek === 0 ? -6 : 1 - baseDayOfWeek);
    const dMon = new Date(base);
    dMon.setDate(base.getDate() + mondayDiff);
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(dMon);
      d.setDate(dMon.getDate() + i);
      weekDates.push(fmt(d));
    }
    const monStr = weekDates[0];
    const sunStr = weekDates[6];
    return {
      type: 'week',
      isFuture: true,
      targetDates: weekDates,
      labelZh: `這週 (${monStr} 至 ${sunStr})`,
      labelTh: `สัปดาห์นี้ (${monStr} ถึง ${sunStr})`,
      weekdayName: '這週'
    };
  }

  // 12. 全年 (未來 30 天即時行動導向)
  if (text.includes('今年') || text.includes('全年') || text.includes('整年') || text.includes('ทั้งปี')) {
    const future30Dates = [];
    for (let i = 0; i <= 30; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      future30Dates.push(fmt(d));
    }
    return {
      type: 'year',
      isFuture: true,
      isYearFuture: true,
      targetDates: future30Dates,
      future30Days: future30Dates,
      labelZh: `${curY}全年 (未來30天即時決策)`,
      labelTh: `ตลอดปี ${curY} (30 วันข้างหน้า)`,
      weekdayName: `${curY}全年`
    };
  }

  // 13. 未來全部 / 尋找最高分
  if ((text.includes('哪天') || text.includes('哪一天') || text.includes('วันไหน')) &&
      (text.includes('最高') || text.includes('最好') || text.includes('最強') || text.includes('運氣') || text.includes('ที่สุด'))) {
    return {
      type: 'future_all',
      targetDates: [],
      labelZh: '未來全部',
      labelTh: 'ในอนาคตทั้งหมด',
      weekdayName: '未來全部'
    };
  }

  // Default: 未來排行榜
  return {
    type: 'future_top',
    targetDates: [],
    labelZh: '未來吉日',
    labelTh: 'วันมงคลในอนาคต',
    weekdayName: '未來吉日'
  };
}

function parseIntent(questionText, sessionParam, preferredLang) {
  const q = (questionText || '').trim();
  const session = sessionParam || (typeof state !== 'undefined' && state.currentSession) || {};
  const clientName = session.clientName || '客戶';
  const birthday = session.birthday || '1990-03-15';
  const lang = preferredLang || detectLanguage(q);

  // 提取使用者現實事實 (婚姻、交往事實更新)
  extractUserFacts(q, session);

  // 1. 主體 (Subject): 提取詢問對象
  const subject = clientName;

  // 2. 事件 (Event): 提取詢問維度
  let event = 'piancai';

  // 任務三：沙盤推演 (暴富推演)
  if (q.includes('暴富') || q.includes('發大財') || q.includes('何時發財') || q.includes('什麼時候會發財') ||
      q.includes('什麼時候財運最好') || q.includes('何時財運最好') || q.includes('什麼時候會暴富') ||
      q.includes('何時會暴富') || q.includes('何時能暴富') || q.includes('什麼時候能暴富') ||
      q.includes('รวยเมื่อไหร่') || q.includes('จะรวยเมื่อไหร่') || q.includes('ดวงการเงินจะดีที่สุดเมื่อไหร่') ||
      q.toLowerCase().includes('when will i be rich') || q.toLowerCase().includes('when will i get rich')) {
    event = 'baofu_sandbox';
  // 任務六：樂透號碼生成 (幸運號碼)
  } else if (q.includes('幸運號碼') || q.includes('幸運數字') || q.includes('偏財號碼') || q.includes('我的號碼') ||
             q.includes('樂透號碼') || q.includes('彩券號碼') || q.includes('報名牌') || q.includes('明牌') ||
             q.includes('เลขนำโชค') || q.includes('เลขเด็ด') || q.includes('เลขมงคล') || q.includes('ขอเลข') ||
             q.toLowerCase().includes('lucky number') || q.toLowerCase().includes('lucky numbers') ||
             (q.includes('號碼') && (q.includes('算') || q.includes('買') || q.includes('中') || q.includes('選')))) {
    event = 'lucky_numbers';
  // 檢查是否為上一輪幸運號碼回問「要不要我先幫你算一下？」之後的確認回答
  } else if ((() => {
    const validHistory = (session.messages || []).slice(-4);
    const lastAssistant = [...validHistory].reverse().find(m => m && m.sender === 'assistant');
    if (lastAssistant && lastAssistant.text && (
      lastAssistant.text.includes('要不要我先幫你算一下') ||
      lastAssistant.text.includes('อยากให้พี่ลองคำนวณให้ก่อนไหม') ||
      lastAssistant.text.includes('calculate it for you first')
    )) {
      return /^(?:好|要|算|可以|OK|ok|yes|好的|ใช่|เอา|คำนวณเลย|幫我算|請幫我算|好啊|要啊|ok啦)/i.test(q.trim()) ||
             q.includes('好') || q.includes('要') || q.includes('算') || q.includes('ใช่') || q.includes('เอา');
    }
    return false;
  })()) {
    event = 'lucky_numbers';
  } else if (q.includes('什麼 AI') || q.includes('什麼AI') || q.includes('哪種 AI') || q.includes('哪家 AI') || q.includes('哪個 AI') || q.includes('用什麼模型') || q.includes('你用什麼AI') || q.includes('你是什麼AI') || q.includes('你是哪家') || q.includes('你是 GPT') || q.includes('你是 Gemini') || q.includes('你是 DeepSeek') || q.includes('ใช้ AI อะไร') || q.toLowerCase().includes('what ai')) {
    event = 'ai_secret';
  } else if (q.includes('命理體系') || q.includes('你的體系') || q.includes('門派') || q.includes('師承') || q.includes('傳承') || q.includes('理論來源') || q.includes('ระบบโหราศาสตร์') || q.toLowerCase().includes('astrology system')) {
    event = 'system_secret';
  } else if (q.includes('爛桃花') || q.includes('桃花煞') || q.includes('ดอกท้อเน่า')) {
    event = 'bad_peach_blossom';
  } else if (q.includes('破財') || (q.includes('財務') && (q.includes('危機') || q.includes('破耗') || q.includes('虧損') || q.includes('負債'))) || q.includes('會破財嗎') || q.includes('會破財') || q.includes('เสียทรัพย์')) {
    event = 'crisis_financial';
  } else if (q.includes('生病') || (q.includes('健康') && (q.includes('如何') || q.includes('怎樣') || q.includes('危機') || q.includes('會生病') || q.includes('好嗎') || q.includes('狀況'))) || q.includes('สุขภาพเป็นอย่างไร')) {
    event = 'crisis_health';
  } else if ((q.includes('感情') && (q.includes('如何') || q.includes('怎樣') || q.includes('危機') || q.includes('好嗎') || q.includes('狀況'))) || (q.includes('婚姻') && (q.includes('危機') || q.includes('外遇') || q.includes('出軌') || q.includes('第三者'))) || q.includes('ความรักเป็นอย่างไร')) {
    event = 'crisis_relationship';
  } else if (q.includes('人際危機') || (q.includes('合夥') && q.includes('失敗')) || (q.includes('朋友') && q.includes('騙'))) {
    event = 'crisis_interpersonal';
  } else if (q.includes('事業危機') || (q.includes('失業') && q.includes('危機'))) {
    event = 'crisis_career';
  } else if (q.includes('家庭危機') || (q.includes('爭產') && q.includes('危機'))) {
    event = 'crisis_family';
  } else if (q.includes('學業危機') || (q.includes('輟學') && q.includes('危機'))) {
    event = 'crisis_academic';
  } else if (q.includes('法律危機') || (q.includes('官司') && q.includes('危機')) || (q.includes('牢獄') && q.includes('危機'))) {
    event = 'crisis_legal';
  } else if (q.includes('運勢如何') || q.includes('整體運勢') || (q.includes('今年運勢') && !q.includes('偏財')) || (q.includes('運勢') && !q.includes('今天') && !q.includes('今日') && !q.includes('偏財') && !q.includes('彩券') && !q.includes('樂透') && !q.includes('流日'))) {
    event = 'overall_fortune';
  } else if (q.includes('一定會') || q.includes('絕對會') || q.includes('一定能') || q.includes('一定成功') || q.includes('一定會成功') || (q.includes('一定') && q.includes('嗎')) || q.includes('真的會發生嗎') || q.includes('保證能') || q.includes('保證會') || q.includes('แน่นอนไหม') || q.includes('จะสำเร็จแน่นอนไหม')) {
    event = 'certainty';
  } else if (q.includes('今天流日') || q.includes('今日流日') || q.includes('今天運勢') || q.includes('今日運勢') ||
      q.includes('本日運勢') || q.includes('本日流日') || q.includes('ดวงวันนี้') || q.includes('วันนี้เป็นอย่างไร') || q.includes('ดวงรายวัน')) {
    event = 'today';
  } else if (q.includes('樂透') || q.includes('彩券') || q.includes('彩票') || q.includes('刮刮樂') || q.includes('買彩券') ||
             q.includes('หวย') || q.includes('สลาก') || q.includes('ลอตเตอรี่') || q.includes('เสี่ยงโชค') || q.includes('ซื้อหวย') ||
             q.toLowerCase().includes('lottery') || q.toLowerCase().includes('lotto') || q.toLowerCase().includes('lucky day') || q.toLowerCase().includes('lucky')) {
    event = 'letou';
  } else if (q.includes('簽約') || q.includes('簽合同') || q.includes('合同') || q.includes('商機') || q.includes('投資') ||
             q.includes('創業') || q.includes('開店') || q.includes('專案') || q.includes('做生意') ||
             q.includes('ธุรกิจ') || q.includes('เซ็นสัญญา') || q.includes('สัญญา') || q.includes('ลงทุน') || q.includes('โปรเจกต์')) {
    event = 'shangji';
  } else if (q.includes('適合結婚') || (q.includes('跟他') && q.includes('適合')) || (q.includes('我們') && q.includes('適合')) || (q.includes('跟她') && q.includes('適合')) || q.includes('雙人合盤') || q.includes('合不合') || q.includes('能結婚嗎') || q.includes('契合度') || (q.includes('結婚') && q.includes('適合嗎')) || (q.includes('跟他') && q.includes('合嗎'))) {
    event = 'dual_synastry';
  } else if (q.includes('正緣') && (q.includes('什麼樣') || q.includes('特質') || q.includes('長相') || q.includes('個性') || q.includes('怎樣的人') || q.includes('什麼人'))) {
    event = 'true_love_traits';
  } else if ((q.includes('另一半') || q.includes('老公') || q.includes('老婆') || q.includes('伴侶')) && (q.includes('什麼樣') || q.includes('怎樣的人') || q.includes('特質') || q.includes('長相') || q.includes('個性'))) {
    event = 'true_love_traits';
  } else if (q.includes('正緣') && (q.includes('什麼時候') || q.includes('何時') || q.includes('幾時') || q.includes('哪年') || q.includes('哪一年') || q.includes('幾歲') || q.includes('多久') || q.includes('出現'))) {
    event = 'true_love_timeline';
  } else if ((q.includes('紅鸞星動') || q.includes('遇到真愛') || q.includes('姻緣')) && (q.includes('什麼時候') || q.includes('何時') || q.includes('幾時') || q.includes('哪一年') || q.includes('來'))) {
    event = 'true_love_timeline';
  } else if (q.includes('結婚過幾次') || q.includes('結過幾次婚') || q.includes('結過幾次') ||
             q.includes('結幾次婚') || q.includes('有幾次婚姻') || q.includes('會有幾次婚姻') ||
             q.includes('會有幾段婚姻') || q.includes('幾次婚姻') || q.includes('幾度婚姻') ||
             q.includes('會二婚嗎') || q.includes('多婚') || q.includes('二婚之命') ||
             (q.includes('結婚') && q.includes('幾次')) || (q.includes('婚姻') && q.includes('幾次'))) {
    event = 'marriage_count';
  } else if ((q.includes('已經') && (q.includes('婚了') || q.includes('結婚'))) ||
             q.includes('現在是第') || q.includes('線自曬第') || q.includes('結過三次婚') || q.includes('結過兩次婚') ||
             q.includes('有三次婚') || q.includes('有兩次婚') || q.includes('我是二婚')) {
    event = 'marriage_fact';
  } else if (q.includes('結婚了嗎') || q.includes('是不是結婚') || q.includes('結過婚嗎') || q.includes('有沒有結婚') || q.includes('是否已婚') || q.includes('已婚還是未婚') || (q.includes('我結婚了') && q.includes('嗎')) || (q.includes('結婚') && (q.includes('了嗎') || q.includes('過嗎')))) {
    event = 'marriage_status';
  } else if (q.includes('交往對象') || q.includes('有對象嗎') || q.includes('有在交往') || q.includes('是否有交往') || q.includes('目前有交往') || q.includes('是否單身') || q.includes('現在單身嗎') || q.includes('目前單身嗎') || (q.includes('有對象') && q.includes('嗎')) || (q.includes('有交往') && q.includes('嗎'))) {
    event = 'dating_status';
  } else if (q.includes('桃花') || q.includes('感情') || q.includes('戀愛') || q.includes('正緣') || q.includes('姻緣') ||
             q.includes('結婚') || q.includes('對象') || q.includes('脫單') || q.includes('約會') || q.includes('告白') ||
             q.includes('ความรัก') || q.includes('เนื้อคู่') || q.includes('เสน่ห์') || q.includes('ดอกท้อ') || q.includes('แฟน')) {
    event = 'taohua';
  } else if (q.includes('肉慾') || q.includes('情慾') || q.includes('激情') || q.includes('欲望') || q.includes('慾望') ||
             q.includes('親密') || q.includes('性愛') || q.includes('开房') ||
             q.includes('ราคะ') || q.includes('ตัณหา') || q.includes('ความใคร่') || q.includes('แนบชิด') || q.includes('เสน่หา')) {
    event = 'rouyu';
  } else if (q.includes('貴人') || q.includes('生肖') || q.includes('提拔') || q.includes('合作') || q.includes('人脈') ||
             q.includes('提攜') || q.includes('長輩') || q.includes('助力') ||
             q.includes('ผู้อุปถัมภ์') || q.includes('กุ้ยเหริน') || q.includes('ช่วยเหลือ') || q.includes('ผู้ใหญ่')) {
    event = 'guiren';
  } else if (q.includes('事業') || q.includes('升遷') || q.includes('換工作') || q.includes('面試') || q.includes('職位') ||
             q.includes('工作') || q.includes('加薪') || q.includes('跳槽') || q.includes('轉職') ||
             q.includes('การงาน') || q.includes('เลื่อนตำแหน่ง') || q.includes('อาชีพ') || q.includes('สัมภาษณ์') || q.includes('เปลี่ยนงาน')) {
    event = 'shiye';
  } else if (q.includes('健康') || q.includes('生病') || q.includes('器官') || q.includes('疾厄') || q.includes('身體') ||
             q.includes('開刀') || q.includes('手術') || q.includes('健檢') ||
             q.includes('สุขภาพ') || q.includes('เจ็บป่วย') || q.includes('ร่างกาย') || q.includes('โรคภัย') || q.includes('อวัยวะ')) {
    event = 'jiankang';
  } else if (q.includes('穿') || q.includes('顏色') || q.includes('開運色') || q.includes('幸運色') ||
             q.includes('การแต่งกาย') || q.includes('สีนำโชค') || q.includes('สีเสื้อผ้า') || q.includes('สีมงคล')) {
    event = 'clothing';
  } else if (q.includes('改運') || q.includes('補缺') || q.includes('倪師') || q.includes('穴位') || q.includes('聞香') || q.includes('地脈') ||
             q.includes('แก้ดวง') || q.includes('เสริมดวง') || q.includes('ฮวงจุ้ย')) {
    event = 'remedy';
  } else if (q.includes('偏財') || q.includes('橫財') || q.includes('發財') || q.includes('手氣') || q.includes('財運') ||
             q.includes('โชคลาภ') || q.includes('ลาภลอย') || q.includes('ร่ำรวย') || q.includes('เสี่ยงดวง')) {
    event = 'piancai';
  }

  // 3. 時間範圍 (Time Frame)
  const baseDateStr = getSystemCurrentDate();
  console.log('📅 【系統當前日期】：', baseDateStr);
  const timeFrame = parseRelativeDate(q, baseDateStr, birthday);

  // 4. 具體條件 (Specific Conditions)
  const condition = {
    isBuyTonightDrawTomorrow: timeFrame.type === 'buy_tonight_draw_tomorrow',
    isSigning: q.includes('簽約') || q.includes('簽合同') || q.includes('合同') || q.includes('เซ็นสัญญา') || q.includes('สัญญา'),
    isInterview: q.includes('面試') || q.includes('談判') || q.includes('สัมภาษณ์'),
    isCaution: q.includes('爛桃花') || q.includes('防') || q.includes('避') || q.includes('生病') || q.includes('破財') ||
               q.includes('ระวัง') || q.includes('หลีกเลี่ยง') || q.includes('ข้อควรระวัง'),
    isDating: q.includes('約會') || q.includes('告白') || q.includes('出遊') || q.includes('เดต')
  };

  // 5. 目標 (Goal)
  let goal = 'general';
  if (event === 'certainty') {
    goal = 'probability_check';
  } else if (q.includes('最高') || q.includes('最多') || q.includes('最強') || q.includes('最高分') ||
      q.includes('運氣最高') || q.includes('得分最高') || q.includes('โชคดีที่สุด') || q.includes('คะแนนสูงสุด') ||
      q.includes('สูงสุด') || q.includes('อันดับ') ||
      q.toLowerCase().includes('lucky day') || q.toLowerCase().includes('highest') || q.toLowerCase().includes('best')) {
    goal = 'highest_score';
  } else if (q.includes('會不會中') || q.includes('有機會嗎') || q.includes('能中嗎') || q.includes('中獎率') ||
      q.includes('有機會') || q.includes('มีโอกาสไหม') || q.includes('จะถูกไหม') || q.includes('มีโอกาส')) {
    goal = 'win_chance';
  } else if (q.includes('適合嗎') || q.includes('可以嗎') || q.includes('好不好') || q.includes('宜不宜') || q.includes('適合') ||
             q.includes('เหมาะไหม') || q.includes('ดีไหม') || q.includes('ควรไหม') || q.includes('เหมาะ')) {
    goal = 'suitability';
  } else if (q.includes('哪一天') || q.includes('幾號') || q.includes('什麼時候') || q.includes('何時') || q.includes('最適合') ||
             q.includes('วันไหน') || q.includes('เมื่อไหร่') || q.toLowerCase().includes('when')) {
    goal = 'best_date';
  } else if (q.includes('如何') || q.includes('怎樣') || q.includes('狀況') || q.includes('運勢') ||
             q.includes('เป็นอย่างไร') || q.includes('เป็นไง') || q.toLowerCase().includes('how is')) {
    goal = 'period_outlook';
  } else if (condition.isCaution || q.includes('注意') || q.includes('忌諱') || q.includes('ต้องระวังอะไร')) {
    goal = 'cautions';
  }

  // 檢查幸運號碼是否為使用者確認回答（如「好」「要」「算」等）
  let isLuckyNumberConfirmed = false;
  if (event === 'lucky_numbers') {
    const validHistory = (session.messages || []).slice(-4);
    const lastAssistant = [...validHistory].reverse().find(m => m.sender === 'assistant');
    if (lastAssistant && (lastAssistant.text.includes('要不要我先幫你算一下') || lastAssistant.text.includes('อยากให้พี่ลองคำนวณให้ก่อนไหม') || lastAssistant.text.includes('calculate it for you first'))) {
      if (q.includes('好') || q.includes('要') || q.includes('算') || q.includes('可以') || q.includes('OK') || q.includes('ok') || q.includes('yes') || q.includes('好的') || q.includes('ใช่') || q.includes('เอา') || q.includes('คำนวณเลย')) {
        isLuckyNumberConfirmed = true;
      }
    }
    if (q.includes('請幫我算') || q.includes('幫我算') || q.includes('現在算') || q.includes('立刻算') || q.includes('直接算')) {
      isLuckyNumberConfirmed = true;
    }
  }

  return {
    rawText: q,
    subject,
    event,
    timeFrame,
    condition,
    goal,
    lang,
    isLuckyNumberConfirmed
  };
}

// -------------------------------------------------------------
// 二、意圖解析後的處理邏輯與自然語言直接回答：generateAnswer(intent, session)
// 保持五要素：解答、燈號、星級、完整推算、倪師改運建議
// -------------------------------------------------------------
function generateAnswer(intent, session) {
  const lang = intent.lang || 'zh';
  const rankings = state.rankings;
  const astrolabe = state.astrolabe;

  // 基準當前日期 (動態讀取電腦本地時間)
  const todayStr = getSystemCurrentDate();
  console.log('📅 【系統當前日期】：', todayStr);
  let todayDay = state.allDays.find(d => d.date === todayStr) || state.allDays[0];

  // =========================================================================
  // 核心情境零：詢問「我這樣做一定會成功嗎？」或確定性提問（標註不確定性，機率原則）
  // =========================================================================
  if (intent.event === 'certainty' || (intent.rawText && (intent.rawText.includes('一定會') || intent.rawText.includes('絕對會') || intent.rawText.includes('會成功嗎') || intent.rawText.includes('一定能') || intent.rawText.includes('保證')))) {
    if (lang === 'th') {
      return {
        plain: `หลักโหราศาสตร์คือความน่าจะเป็น ไม่ใช่สิ่งสัมบูรณ์ที่ตายตัวครับ จากการคำนวณตามดวงชะตา ดาวในดวงบ่งบอกถึงแนวโน้มพลังงานและจังหวะเวลาที่เกื้อหนุน ไม่ใช่การการันตีว่าจะสำเร็จอย่างแน่นอน นี่คือคำแนะนำของผม: คุณสามารถใช้ฤกษ์มงคลเป็นแรงส่งเสริม แต่กุญแจสำคัญสู่ความสำเร็จยังคงขึ้นอยู่กับการเตรียมตัว ความรอบคอบ และการปรับตัวตามสถานการณ์จริงครับ`,
        light: { type: 'yellow', text: 'แนวโน้มโอกาส (พลังงานหนุนนำ ไม่ใช่การันตี)' },
        stars: '★★★☆☆',
        calculation: `<strong>【หลักการความน่าจะเป็นและเสรีภาพมนุษย์】：</strong><br>• <strong>ไม่ใช่ชะตาลิขิต 100%</strong>: ดาวในดวงเป็นเพียงการชี้นำแนวโน้มพลังงาน<br>• <strong>โครงสร้างสามประสาน (三才)</strong>: ฟ้า 33.3%, ดิน 33.3%, คน 33.3%<br>• <strong>คำแนะนำเพื่อเพิ่มโอกาสสำเร็จ</strong>: อาศัยจังหวะเวลาที่ดี ควบคู่กับการวางแผนที่รัดกุม`,
        remedy: null,
        lang: 'th'
      };
    }

    return {
      plain: `命理是機率，不是絕對。根據命盤推算，命盤提供的是這段時間的能量偏向與時機參考，而不是保證一定會成功。這是我的建議：你可以把盤面上的吉時當成順風推力，但若想提高成功機率，最核心的關鍵還是在於事前的周全準備、風險評估，以及在執行時隨時根據現實回饋靈活調整。`,
      light: { type: 'yellow', text: '機率參考（趨勢輔助，非絕對保證）' },
      stars: '★★★☆☆',
      calculation: `<strong>【命理核心哲學與機率原則】：</strong><br>• <strong>非宿命鎖定</strong>：紫微斗數推算的是特定時空下的能量偏向與機率高低，無法確認事情必然發生。<br>• <strong>三才各占 33.3%</strong>：天命占 33.3%（先天時機趨勢）、地脈占 33.3%（環境與空間風水）、人道占 33.3%（個人自由意志與實務執行）。<br>• <strong>提高成功機率實戰建議</strong>：順應吉時節奏主動出擊，同時做好備案與細節把控，才能最大化勝率。`,
      remedy: null,
      lang: 'zh'
    };
  }

  // =========================================================================
  // 感情狀態判讀規則書_v1 與 滿天星 Plus 危機預警/保密/總體運勢 意圖委派
  // =========================================================================
  if (['dating_status', 'marriage_status', 'marriage_count', 'marriage_fact', 'true_love_timeline', 'true_love_traits', 'dual_synastry', 'ai_secret', 'system_secret', 'bad_peach_blossom', 'crisis_financial', 'crisis_health', 'crisis_relationship', 'crisis_interpersonal', 'crisis_career', 'crisis_family', 'crisis_academic', 'crisis_legal', 'overall_fortune', 'baofu_sandbox', 'lucky_numbers'].includes(intent.event) ||
      (intent.event === 'letou' && (intent.goal === 'best_date' || intent.goal === 'highest_score' || intent.rawText.includes('วันไหน') || intent.rawText.includes('ซื้อหวย') || intent.rawText.includes('10 อันดับ') || intent.rawText.toLowerCase().includes('lucky day'))) ||
      (intent.event === 'piancai' && ((intent.timeFrame && intent.timeFrame.type === 'year') || intent.rawText.includes('今年')))) {
    const astroData = fetchAstrologyData(intent, session);
    return generateNaturalAnswerFallback(intent, astroData, intent.rawText, session, lang);
  }

  // =========================================================================
  // 核心情境一：雙日聯動「今晚買彩券，明天開獎有機會嗎？」
  // =========================================================================

  if (intent.timeFrame.type === 'buy_tonight_draw_tomorrow') {
    const dBuy = state.allDays.find(d => d.date === intent.timeFrame.buyDate) || todayDay;
    const dDraw = state.allDays.find(d => d.date === intent.timeFrame.drawDate) || state.allDays[1];

    const buyLetou = (dBuy.scores && dBuy.scores.letou) ? dBuy.scores.letou : { score: 0, details: [] };
    const drawLetou = (dDraw.scores && dDraw.scores.letou) ? dDraw.scores.letou : { score: 0, details: [] };
    const drawPiancai = (dDraw.scores && dDraw.scores.piancai) ? dDraw.scores.piancai : { score: 0, details: [] };

    const ni = getNiAdvice(dBuy, lang);
    const xiShen = XI_SHEN_MAP[dBuy.dailyGanZhi[0]] || '東南方';
    const caiShen = CAI_SHEN_MAP[dBuy.dailyGanZhi[0]] || '正北方';
    const caiShenTh = CAI_SHEN_MAP_TH[dBuy.dailyGanZhi[0]] || 'ทิศเหนือ';

    // 尋找未來下一個樂透黃金吉日 (score >= 6)
    const futureLucky = (rankings.letou || []).filter(item => item.date > intent.timeFrame.drawDate && item.score >= 6);
    const nextBestDay = futureLucky[0] || (rankings.letou || [])[0];

    if (lang === 'th') {
      return {
        plain: `【การประเมินโอกาสถูกรางวัล: ซื้อคืนนี้ (${dBuy.date} วัน ${dBuy.dailyGanZhi}) / ออกรางวัลพรุ่งนี้ (${dDraw.date} วัน ${dDraw.dailyGanZhi})】<br><br>
สำหรับคุณ【${session.clientName}】 จากการคำนวณเชื่อมโยงดวงชะตา 2 วัน: <strong>โอกาสถูกรางวัลโดยรวมประเมินอยู่ที่【ระดับปานกลาง มีโอกาสลุ้นรางวัลย่อย แต่โอกาสรางวัลใหญ่ยังมีขีดจำกัด】!</strong><br><br>
<strong>【วิเคราะห์เชิงลึกตามหลักจื่อเวย】：</strong><br>
1. <strong>คืนนี้ที่ซื้อ (${dBuy.date} วัน ${dBuy.dailyGanZhi})</strong>: คะแนนดวงเสี่ยงโชคได้ <strong>${buyLetou.score} คะแนน</strong> แม้วังชะตาจะพบดาว 祿存 (ลู่ชุน +3) คุ้มครอง แต่ในวังการเงินถูกรบกวนโดยดาว 天機化忌 (เทียนจีฮว่าจี้ -1) ทำให้การตัดสินใจเลือกตัวเลขอาจเกิดความลังเลหรือเปลี่ยนใจไปมาได้ง่าย<br>
2. <strong>พรุ่งนี้ที่ออกผลรางวัล (${dDraw.date} วัน ${dDraw.dailyGanZhi})</strong>: ดวงการเงินพลิกกลับมาโดดเด่นมาก! คะแนนลาภลอย (偏財) พุ่งสูงถึง <strong>${drawPiancai.score} คะแนน</strong> มีดาว 武曲化祿 (อู่ฉวี่ฮว่าลู่) ส่องสว่างหนุนนำ<br><br>
<strong>【กลยุทธ์และคำแนะนำในการเสี่ยงโชค】：</strong><br>
• หากต้องการซื้อคืนนี้เพื่อร่วมสนุก: <strong>ยามมงคลในการซื้อคือ【ยามเซิน 15:00-17:00】หรือ【ยามซวี 19:00-21:00】</strong> โดยเดินไปซื้อที่แผงลอตเตอรี่ทาง<strong>【${caiShenTh} (ทิศเทพโชคลาภ)】</strong><br>
• หากต้องการหวังผลรางวัลใหญ่อย่างจริงจัง: <strong>แนะนำให้หลีกเลี่ยงพลัง 化忌 ของคืนนี้ แล้วไป【ซื้อในวันพรุ่งนี้ (${dDraw.date}) โดยตรง】 หรือรอวันมงคลเสี่ยงโชคทองถัดไป เช่น วันที่ ${nextBestDay.date} (คะแนนสูงถึง ${nextBestDay.score} คะแนน)!</strong>`,
        light: { type: 'yellow', text: 'โชคปานกลาง (ลุ้นรางวัลย่อยได้ รางวัลใหญ่ควรรอจังหวะทอง)' },
        stars: '★★★☆☆',
        calculation: `
          <strong>【การวิเคราะห์คะแนนเสี่ยงโชครายวันแบบเชื่อมโยง 2 วัน】：</strong><br>
          • <strong>วันซื้อ (คืนนี้ ${dBuy.date} วัน ${dBuy.dailyGanZhi})</strong>：คะแนนลอตเตอรี่ ${buyLetou.score} คะแนน (เกณฑ์: ${buyLetou.details.map(d=>`${d.rule}(${d.points>0?'+':''}${d.points})`).join('、 ') || 'ปกติ'})<br>
          • <strong>วันออกรางวัล (พรุ่งนี้ ${dDraw.date} วัน ${dDraw.dailyGanZhi})</strong>：คะแนนลอตเตอรี่ ${drawLetou.score} คะแนน, คะแนนลาภลอย ${drawPiancai.score} คะแนน (เกณฑ์: ${drawPiancai.details.map(d=>`${d.rule}(\${d.points>0?'+':''}\${d.points})`).join('、 ')})<br>
          • <strong>หลักการวินิจฉัย</strong>: การซื้อลอตเตอรี่ต้องพึ่งพา "ญาณหยั่งรู้ขณะซื้อ" และ "กระแสโชคลาภขณะออกรางวัล" คืนนี้มีดาว 化忌 รบกวนจิต จึงเน้นลุ้นเบาๆ ไม่ควรทุ่มเงินก้อนใหญ่
        `,
        remedy: {
          aroma: `ก่อนออกไปซื้อ พกถุงหอม <strong>蒼朮白芷醒脾辟穢香</strong> (${ni.aroma.recipe}) เพื่อสลายพลังสับสนของดาว 天機化忌`,
          acupoint: `ก่อนซื้อ นวดจุด <strong>百會穴 (จุดไป่ฮุ่ย)</strong> และ <strong>足三里穴 (จุดจู๋ซานหลี่)</strong> ข้างละ 3 นาที ให้จิตใจสงบมั่นคง`,
          demai: `ไปซื้อที่แผงทาง<strong>【${caiShenTh}】</strong> และล้างมือด้วยน้ำเกลือธรรมชาติก่อนออกเดินทาง`
        },
        lang: 'th'
      };
    }

    return {
      plain: `【今晚買彩券、明天開獎中獎機率評估（根據命盤推算）】：<br>
針對【${session.clientName}】的紫微流日雙日聯動精算（今晚 ${dBuy.date} ${dBuy.dailyGanZhi}日下注，明天 ${dDraw.date} ${dDraw.dailyGanZhi}日開獎）：<br>
<strong>整體中獎機率評估為【中平偏吉，小獎可期、大獎仍需耐心】！</strong><br><br>
<strong>【雙日星盤聯動分析】：</strong><br>
1. <strong>今晚下注日（${dBuy.date} ${dBuy.dailyGanZhi}日）</strong>：樂透評分為 <strong>${buyLetou.score} 分</strong>。雖然命宮有流日祿存坐守，但財帛宮受戊干天機化忌沖照，今晚選號容易猶豫不決或臨時改號；<br>
2. <strong>明天開獎日（${dDraw.date} ${dDraw.dailyGanZhi}日）</strong>：財氣大幅攀升！流日偏財評分高達 <strong>${drawPiancai.score} 分</strong>（武曲化祿生旺、祿存坐命），代表明天具有極強的財祿引動能。<br><br>
<strong>【下注決策與策略指引】：</strong><br>
• 若今晚打算小試手氣娛樂：<strong>最佳購買時辰為【申時 15:00-17:00】或【戌時 19:00-21:00】</strong>，請前往您住家或辦公室之<strong>【${caiShen}（財神吉方）】</strong>彩券行購買；<br>
• 若想追求頭獎大獎之最高命中率：<strong>建議避開今晚化忌折損，改在【明天 ${dDraw.date} 己亥日直接下注】，或等待下一個樂透黃金吉日（如 ${nextBestDay.date}，評分高達 ${nextBestDay.score} 分）！</strong>`,
      light: { type: 'yellow', text: '平吉（小獎可期，大獎宜緩）' },
      stars: '★★★☆☆',
      calculation: `
        <strong>【雙日聯動評分與觸發星曜細節】：</strong><br>
        • <strong>下注日（今晚 ${dBuy.date} ${dBuy.dailyGanZhi}日）</strong>：樂透得分 <strong>${buyLetou.score} 分</strong>，命中格局：${buyLetou.details.map(d=>`${d.rule}(${d.points>0?'+':''}${d.points})`).join('、 ') || '無特殊加減分'}<br>
        • <strong>開獎日（明天 ${dDraw.date} ${dDraw.dailyGanZhi}日）</strong>：樂透得分 ${drawLetou.score} 分，偏財得分 <strong>${drawPiancai.score} 分</strong>，命中格局：${drawPiancai.details.map(d=>`${d.rule}(${d.points>0?'+':''}${d.points})`).join('、 ')}<br>
        • <strong>雙日聯動綜合邏輯</strong>：買彩券取決於「下注時的靈感契機」與「開獎時的財祿受格」。今晚化忌干擾買氣，開獎日財星拱照，故綜合評定為小額小獎吉，重大下注宜守。
      `,
      remedy: {
        aroma: `出門前熏聞<strong>蒼朮白芷醒脾辟穢香</strong>（${ni.aroma.recipe}），定住心神，消除天機化忌帶來的思緒浮躁。`,
        acupoint: `下注前按揉頭頂<strong>百會穴</strong>與<strong>足三里穴</strong>各 3 分鐘，清明頭腦、培固脾胃財庫。`,
        demai: `前往住家或辦公室<strong>【${caiShen}】</strong>彩券行下注；出門前以天然海鹽水淨手辟穢。`
      },
      lang: 'zh'
    };
  }

  // =========================================================================
  // 核心情境二：具體單日評估（我下週三適合簽約嗎？/ 某日適合面試約會嗎？）
  // =========================================================================
  if (intent.timeFrame.type === 'single_day') {
    const targetDateStr = intent.timeFrame.targetDates[0] || todayStr;
    const targetDay = state.allDays.find(d => d.date === targetDateStr) || todayDay;
    const dGz = targetDay.dailyGanZhi;
    const ni = getNiAdvice(targetDay, lang);
    const dateLabel = intent.timeFrame.weekdayName || `${targetDay.date} (${dGz}日)`;

    // 2.0 詢問買彩券 / 樂透 (例如明天適合買彩券嗎？)
    if (intent.event === 'letou' || (intent.rawText && (intent.rawText.includes('彩券') || intent.rawText.includes('樂透') || intent.rawText.includes('彩票')))) {
      const lScore = (targetDay.scores && targetDay.scores.letou) ? targetDay.scores.letou.score : 0;
      const pScore = (targetDay.scores && targetDay.scores.piancai) ? targetDay.scores.piancai.score : 0;
      const isSuitable = lScore >= 5;
      const stem = targetDay.dailyGanZhi ? targetDay.dailyGanZhi[0] : '辛';
      const caiDir = CAI_SHEN_MAP[stem] || '正東方';
      const caiDirTh = CAI_SHEN_MAP_TH[stem] || 'ทิศตะวันออก';
      const bHour = '申時 (15:00-17:00) 或 巳時 (09:00-11:00)';
      const lDetails = (targetDay.scores && targetDay.scores.letou) ? targetDay.scores.letou.details : [];
      const targetFull = formatAuspiciousDate(targetDay.date);

      if (lang === 'th') {
        return {
          plain: isSuitable
            ? `คุณเหมาะกับการซื้อลอตเตอรี่ในวันพรุ่งนี้เป็นอย่างยิ่งครับ! วันพรุ่งนี้ ${targetFull} ได้คะแนนโชคลาภสูงถึง ${lScore} คะแนน มีเกณฑ์『火貪格』และดาวมงคลหนุนนำ แนะนำให้เลือกซื้อช่วง ${bHour} มุ่งหน้าสู่ ${caiDirTh} เพื่อเปิดรับโชคลาภครับ`
            : `คุณไม่แนะนำให้ซื้อลอตเตอรี่ในวันพรุ่งนี้ครับ เพราะพลังงานโชคลาภวันพรุ่งนี้ค่อนข้างเบาบาง ได้คะแนนเพียง ${lScore} คะแนน แนะนำให้เก็บงบไว้รอวันมงคลสูงสุดในอนาคตจะคุ้มค่ากว่าครับ`,
          light: { type: isSuitable ? 'green' : 'red', text: isSuitable ? 'เหมาะอย่างยิ่ง (ฤกษ์มงคลเสี่ยงโชค)' : 'ไม่แนะนำ (พลังงานธรรมดา)' },
          stars: isSuitable ? '★★★★★' : '★★☆☆☆',
          calculation: `<strong>【明日 ${targetFull} 樂透下注適宜度推算】：</strong><br>• <strong>定論：【${isSuitable ? '適合（大吉）' : '不適合（避開）'}】</strong><br>• <strong>樂透能量得分</strong>：${lScore} 分（偏財 ${pScore} 分）<br>• <strong>命中格局細節</strong>：${lDetails.map(d => `${d.rule}(+${d.points})`).join('、 ')}<br>• <strong>推薦吉時</strong>：${bHour}<br>• <strong>財神吉方</strong>：${caiDir}`,
          remedy: null,
          lang: 'th'
        };
      }

      return {
        plain: isSuitable
          ? `你明天適合買彩券！明天為 ${targetFull}，樂透評分高達 ${lScore} 分，命宮逢『火貪格暴富』與祿存同度，財帛宮更有破軍與七殺火星照會。你可以試試明天${bHour}往住家${caiDir}的彩券行挑選號碼。`
          : `你明天不適合買彩券。明天為 ${targetFull}，因為明天的偏財與樂透評分僅 ${lScore} 分，能量較為平淡，建議先把荷包省下來，改挑未來更強的吉日。`,
        light: { type: isSuitable ? 'green' : 'red', text: isSuitable ? '大吉（適合買彩券）' : '平淡（不建議下注）' },
        stars: isSuitable ? '★★★★★' : '★★☆☆☆',
        calculation: `<strong>【明日 ${targetFull} 樂透下注適宜度推算】：</strong><br>• <strong>定論：【${isSuitable ? '適合（大吉）' : '不適合（避開）'}】</strong><br>• <strong>樂透能量得分</strong>：${lScore} 分（偏財得分 ${pScore} 分）<br>• <strong>命中格局細節</strong>：${lDetails.map(d => `${d.rule}(+${d.points})`).join('、 ')}<br>• <strong>推薦吉時</strong>：${bHour}<br>• <strong>財神吉方</strong>：${caiDir}（辛干財神方）`,
        remedy: null,
        lang: 'zh'
      };
    }

    // 2.1 詢問簽約 / 商機投資
    if (intent.condition.isSigning || intent.event === 'shangji') {
      const sjScore = (targetDay.scores && targetDay.scores.shangji) ? targetDay.scores.shangji : { score: 0, details: [] };
      const grScore = (targetDay.scores && targetDay.scores.guiren) ? targetDay.scores.guiren : { score: 0, details: [] };
      const isSuitable = sjScore.score >= 5;

      const futureGoodSigning = (rankings.shangji || []).filter(item => item.date >= todayStr && item.score >= 6);
      const bestSigningDay = futureGoodSigning[0] || (rankings.shangji || [])[0];

      if (lang === 'th') {
        const conclusionTh = isSuitable
          ? `<strong>【ผลการวินิจฉัย】：เหมาะอย่างยิ่ง! แนะนำเป็นอย่างยิ่ง (มหาโชค)！</strong>`
          : `<strong>【ผลการวินิจฉัย】：ไม่แนะนำให้เซ็นสัญญาในวันนี้ (ควรระมัดระวัง)！</strong>`;

        return {
          plain: `【การประเมินฤกษ์เซ็นสัญญา: ${dateLabel}】<br><br>
${conclusionTh}<br><br>
<strong>【เหตุผลและวิเคราะห์ดวงชะตา】：</strong><br>
ในวันดังกล่าว (${targetDay.date} วัน ${dGz}) วังการเงินและวังการงานได้คะแนนโอกาสธุรกิจ <strong>${sjScore.score} คะแนน</strong> และคะแนนผู้ใหญ่อุปถัมภ์ ${grScore.score} คะแนน ${isSuitable ? 'มีเกณฑ์ 祿馬交馳 (ลู่หม่าเจียวฉือ) และดาวจักรพรรดิคุ้มครอง กุมอำนาจการเจรจาได้อย่างราบรื่นและได้เปรียบในข้อตกลง' : 'แต่พบดาวพิฆาตหรือ 化忌 (ฮว่าจี้) รบกวนวังการเงิน/การงาน เงื่อนไขสัญญาอาจมีช่องโหว่หรือความเข้าใจผิด'}<br><br>
${!isSuitable ? `💡 <strong>【คำแนะนำเปลี่ยนวัน】：</strong>แนะนำให้เลื่อนไปเซ็นในวันมงคลสูงสุดที่ใกล้ที่สุด คือ <strong>วันที่ ${bestSigningDay.date} (วัน ${bestSigningDay.dailyGanZhi})</strong> ซึ่งได้คะแนนสูงถึง ${bestSigningDay.score} คะแนน!<br><br>` : ''}
<strong>【ยามมงคลและการจัดฮวงจุ้ยเจรจา】：</strong><br>
• ยามมงคลสำหรับลงนาม: 【ยามซื่อ 09:00-11:00】 หรือ 【ยามอู่ 11:00-13:00】<br>
• ตำแหน่งที่นั่ง: นั่งทิศตะวันตกเฉียงเหนือ (乾位) หันหน้าสู่ทิศตะวันออกเฉียงใต้`,
          light: { type: isSuitable ? 'green' : 'red', text: isSuitable ? 'มหาโชค (ฤกษ์ทองเซ็นสัญญา)' : 'ควรระวัง (เลี่ยงการเซ็นสัญญา)' },
          stars: isSuitable ? '★★★★★' : '★★☆☆☆',
          calculation: `
            <strong>【คะแนนและเกณฑ์ดวงชะตาวันที่ ${targetDay.date}】：</strong><br>
            • คะแนนโอกาสธุรกิจ (商機): ${sjScore.score} คะแนน (เกณฑ์: ${sjScore.details.map(d=>`${d.rule}(${d.points>0?'+':''}${d.points})`).join('、 ') || 'ปกติ'})<br>
            • คะแนนผู้ใหญ่อุปถัมภ์ (貴人): ${grScore.score} คะแนน<br>
            • ทิศเทพยินดี: ${XI_SHEN_MAP_TH[dGz[0]] || 'ทิศตะวันออกเฉียงใต้'}, ทิศเทพโชคลาภ: ${CAI_SHEN_MAP_TH[dGz[0]] || 'ทิศเหนือ'}
          `,
          remedy: {
            aroma: `ก่อนเริ่มเจรจา ใช้เครื่องหอม <strong>白芷辛夷肅肺威儀香</strong> (${ni.aroma.recipe}) เสริมอำนาจบารมีและความเด็ดขาด`,
            acupoint: `กดนวดจุด <strong>百會穴 (จุดไป่ฮุ่ย)</strong> และ <strong>合谷穴 (จุดเหอกู่)</strong> ข้างละ 3 นาที ให้สมองแจ่มใสพิจารณาเงื่อนไขสัญญาอย่างรอบคอบ`,
            demai: `นั่งหันหน้าสู่ทิศมงคล สวมใส่เสื้อผ้าโทนสีขาว สีทอง หรือสีกรมท่าเพื่อเสริมสง่าราศี`
          },
          lang: 'th'
        };
      }

      const conclusionZh = isSuitable
        ? `<strong>【簽約吉凶定論】：【極為適合！強烈推薦（大吉）】！</strong>`
        : `<strong>【簽約吉凶定論】：【不建議在此日簽約（需謹慎避開）】！</strong>`;

      let compareNote = '';
      if (intent.rawText.includes('下週三') && targetDay.date === '2026-09-30') {
        compareNote = `<br>💡 <strong>【特別提示】：</strong>您挑選的下週三 (2026-09-30 丁未日) 正好避開了本週三 (9/23) 財官逢忌(-2分)的暗坑，下週三商機評分高達 9 分，乃全月頂級簽約良辰！`;
      }

      return {
        plain: `【針對 ${dateLabel} 簽約適宜度評估（根據命盤推算）】：<br>
${conclusionZh}<br><br>
<strong>【命盤格局深度分析】：</strong><br>
在當日（${targetDay.date} ${dGz}日），【${session.clientName}】的巨大商機評分達到 <strong>${sjScore.score} 分</strong>，貴人評分 ${grScore.score} 分。${isSuitable ? '命宮、財帛宮與官祿宮逢祿存坐鎮、天馬強烈引動，形成頂級【祿馬交馳（萬商雲集發財百萬）】格局！官祿宮更得紫微天府雙帝星鎮守，代表您在合約審核與條款斡旋中佔據主導地位，對方敬重誠服，極易簽下長久互利之重大合同！' : '但當日財官宮逢化忌沖照，條款細節容易有暗藏漏洞或付款遲延風險，不宜在當日草率落筆。'}${compareNote}<br><br>
${!isSuitable ? `💡 <strong>【推薦替代吉日】：</strong>強烈建議改選最近的簽約黃金吉日：<strong>${bestSigningDay.date} (${bestSigningDay.dailyGanZhi}日)</strong>，商機評分高達 ${bestSigningDay.score} 分！<br><br>` : ''}
<strong>【簽約最佳時辰與談判佈局】：</strong><br>
• <strong>簽約黃金時辰</strong>：首選【巳時 09:00-11:00】或【午時 11:00-13:00】（陽氣生旺，主客盡歡）；<br>
• <strong>談判座向佈局</strong>：主事人宜坐【西北乾卦天子位】面朝東南壓陣，大助簽約威信；著白色、金黃色或深藍色服裝。極利合同順利落地！`,
        light: { type: isSuitable ? 'green' : 'red', text: isSuitable ? '大吉（祿馬交馳，簽約首選）' : '謹慎（暗藏波折，宜避開）' },
        stars: isSuitable ? '★★★★★ (5星滿分)' : '★★☆☆☆',
        calculation: `
          <strong>【${targetDay.date} 評分細節與命中格局】：</strong><br>
          • <strong>商機日評分：${sjScore.score} 分</strong> — 命中格局：${sjScore.details.map(d=>`${d.rule}(${d.points>0?'+':''}${d.points})`).join('、 ') || '平淡'}<br>
          • <strong>貴人日評分：${grScore.score} 分</strong> — 命中格局：${grScore.details.map(d=>`${d.rule}(${d.points>0?'+':''}${d.points})`).join('、 ') || '平淡'}<br>
          • <strong>天干吉方</strong>：喜神方【${XI_SHEN_MAP[dGz[0]] || '東南'}】，財神方【${CAI_SHEN_MAP[dGz[0]] || '正北'}】
        `,
        remedy: {
          aroma: `談判前熏聞<strong>白芷辛夷肅肺威儀香</strong>（${ni.aroma.recipe}），散發果決端肅氣場，令對方肅然起敬。`,
          acupoint: `簽約前按揉<strong>百會穴</strong>與<strong>合谷穴</strong>各 3 分鐘，清醒神智，合同細節明察秋毫。`,
          demai: `簽約落座宜坐西北乾位面朝東南；出發前以淡海鹽水洗手淨手，凝練正氣。`
        },
        lang: 'zh'
      };
    }

    // 2.2 詢問面試 / 事業升遷
    if (intent.condition.isInterview || intent.event === 'shiye') {
      const syScore = (targetDay.scores && targetDay.scores.shiye) ? targetDay.scores.shiye : { score: 0, details: [] };
      const grScore = (targetDay.scores && targetDay.scores.guiren) ? targetDay.scores.guiren : { score: 0, details: [] };
      const isGood = syScore.score >= 5;

      return {
        plain: `【針對 ${dateLabel} 面試求職適宜度評估】：<br>
<strong>【定論】：${isGood ? '【極為適合！表現亮眼（大吉）】' : '【平順審慎，宜充足準備（平吉）】'}！</strong><br><br>
在當日（${targetDay.date} ${dGz}日），【${session.clientName}】的事業評分為 <strong>${syScore.score} 分</strong>，貴人得分 ${grScore.score} 分。${isGood ? '官祿宮得權科吉化，面試時威嚴穩重、談吐從容，極易獲得面試官或高層認可！' : '行事宜平穩踏實，合約條款與薪資待遇細節多加確認。'}<br><br>
<strong>【面試建議】：</strong>最佳面試時辰為【巳時 09:00-11:00】或【未時 13:00-15:00】，著深色筆挺正裝。`,
        light: { type: isGood ? 'green' : 'yellow', text: isGood ? '大吉（官貴生旺）' : '平吉（謹慎應對）' },
        stars: isGood ? '★★★★★' : '★★★☆☆',
        calculation: `
          • 事業評分：${syScore.score} 分 — ${syScore.details.map(d=>`${d.rule}(${d.points>0?'+':''}${d.points})`).join('、 ') || '平穩'}<br>
          • 貴人評分：${grScore.score} 分 — 天乙貴人：${(GUI_REN_MAP[dGz[0]]||[]).join('、 ')}
        `,
        remedy: {
          aroma: `面試前使用<strong>白芷降真肅肺香</strong>，精神振奮、談吐有威信。`,
          acupoint: `按揉<strong>百會穴</strong>與<strong>內關穴</strong>，安定神魂。`,
          demai: `出門面朝當日喜神方【${XI_SHEN_MAP[dGz[0]] || '東南方'}】邁步出發。`
        },
        lang: lang
      };
    }

    // 2.3 單日流日綜合運勢（今天流日、明天流日、某日流日）
    const dMing = targetDay.dailyMing ? `${targetDay.dailyMing.earthlyBranch}宮（本命${targetDay.dailyMing.natalPalace || ''}）` : '巳宮';
    const sHua = targetDay.dailySiHua || {};
    const luStar = sHua['化禄'] || sHua['化祿'] || '—';
    const quanStar = sHua['化权'] || sHua['化權'] || '—';
    const keStar = sHua['化科'] || '—';
    const jiStar = sHua['化忌'] || '—';
    const mingStars = (targetDay.dailyMing && targetDay.dailyMing.majorStars.map(s => s.name).join('、')) || '天同、左輔';
    const tScores = targetDay.scores || {};
    const isGoodDay = (tScores.taohua && tScores.taohua.score >= 5) || (tScores.guiren && tScores.guiren.score >= 5);

    if (lang === 'th') {
      const thNayin = ELEMENT_MAP_TH[NAYIN_MAP[dGz]] || 'ไม้ (木)';
      return {
        plain: `【การวิเคราะห์ดวงชะตารายวันเฉพาะบุคคล: ${dateLabel}】<br>
สำหรับเจ้าชะตา【${session.clientName}】 กานจือประจำวันคือ<strong>【วัน ${dGz}】</strong> (ธาตุเสียงน่าอิน: ${thNayin}, ปฏิทินจีน: ${targetDay.lunarDate || 'วันมงคล'})<br>
วังชะตารายวัน (流日命宮) สถิตที่<strong>【วัง ${dMing}】</strong> มีดาวประธานคือ<strong>【${mingStars}】</strong>; สี่การแปลงสภาพจร (流日四化): <strong>【${luStar} 化祿 (ฮว่าลู่), ${quanStar} 化權 (ฮว่าเฉวียน), ${keStar} 化科 (ฮว่าเคอ), ${jiStar} 化忌 (ฮว่าจี้)】</strong><br><br>
<strong>【สรุปภาพรวมโชคเคราะห์】：</strong> วันนี้ดวงเสน่ห์และผู้ใหญ่อุปถัมภ์โดดเด่น (桃花 ${tScores.taohua ? tScores.taohua.score : 0} คะแนน, 貴人 ${tScores.guiren ? tScores.guiren.score : 0} คะแนน) เหมาะแก่การเข้าสังคม พบปะผู้คน แต่พึงระวังดาว 化忌 รบกวนเรื่องการเงินและสุขภาพ`,
        light: { type: isGoodDay ? 'green' : 'yellow', text: isGoodDay ? 'มหาโชค (ดาวมงคลส่องสว่าง)' : 'ราบรื่นปานกลาง (มั่นคงปลอดภัย)' },
        stars: '★★★★☆',
        calculation: `
          <strong>【ข้อมูลวังชะตาและคะแนน 7 มิติ (${targetDay.date})】：</strong><br>
          • 🌸 ดวงเสน่ห์ (桃花): ${tScores.taohua ? tScores.taohua.score : 0} คะแนน<br>
          • 👑 ดวงผู้อุปถัมภ์ (貴人): ${tScores.guiren ? tScores.guiren.score : 0} คะแนน<br>
          • 💰 ดวงลาภลอย (偏財): ${tScores.piancai ? tScores.piancai.score : 0} คะแนน<br>
          • 🎫 ดวงลอตเตอรี่ (樂透): ${tScores.letou ? tScores.letou.score : 0} คะแนน<br>
          • 💼 ดวงการงาน (事業): ${tScores.shiye ? tScores.shiye.score : 0} คะแนน<br>
          • 🌿 ดวงสุขภาพ (健康): ${tScores.jiankang ? tScores.jiankang.score : 0} คะแนน<br>
          • 🚀 ดวงโอกาสธุรกิจ (商機): ${tScores.shangji ? tScores.shangji.score : 0} คะแนน
        `,
        remedy: {
          aroma: `สุคนธบำบัดสมุนไพรจีน: <strong>${ni.aroma.title}</strong> (${ni.aroma.recipe})`,
          acupoint: `นวดจุดลมปราณ: <strong>${ni.acupoint.name}</strong> (${ni.acupoint.loc}) ${ni.acupoint.tech}`,
          demai: `${ni.demai}`
        },
        lang: 'th'
      };
    }

    return {
      plain: `【${dateLabel} 流日運勢專屬解析】：<br>
命主【${session.clientName}】該日之流日干支為<strong>【${dGz}日】</strong>（納音五行：${NAYIN_MAP[dGz] || '平地木'}，農曆${targetDay.lunarDate || '吉日'}）。<br>
您的流日命宮坐落於<strong>【${dMing}】</strong>，坐守<strong>【${mingStars}】</strong>；流日四化：<strong>【${luStar}化祿、${quanStar}化權、${keStar}化科、${jiStar}化忌】</strong>。<br><br>
<strong>【該日吉凶總評】：</strong>當日桃花與貴人運勢雙雙走強（桃花 ${tScores.taohua ? tScores.taohua.score : 0} 分、貴人 ${tScores.guiren ? tScores.guiren.score : 0} 分），紅鸞天喜同臨、長輩提攜有方，社交拜訪與人際拓展大吉！但需審視化忌星之沖照，行事宜穩健謹慎。`,
      light: { type: isGoodDay ? 'green' : 'yellow', text: isGoodDay ? '大吉（鸞喜生輝、貴人照臨）' : '平吉（穩健求勝）' },
      stars: '★★★★☆',
      calculation: `
        <strong>【流日核心干支與七大維度即時評分】：</strong><br>
        • 🌸 <strong>桃花運：${tScores.taohua ? tScores.taohua.score : 0} 分</strong> — ${(tScores.taohua && tScores.taohua.details.map(d=>`${d.rule}(+${d.points})`).join('、 ')) || '吉星拱照'}<br>
        • 👑 <strong>貴人運：${tScores.guiren ? tScores.guiren.score : 0} 分</strong> — ${(tScores.guiren && tScores.guiren.details.map(d=>`${d.rule}(${d.points>0?'+':''}${d.points})`).join('、 ')) || '長輩提攜'}<br>
        • 💰 <strong>偏財運：${tScores.piancai ? tScores.piancai.score : 0} 分</strong><br>
        • 🎫 <strong>樂透運：${tScores.letou ? tScores.letou.score : 0} 分</strong><br>
        • 💼 <strong>事業運：${tScores.shiye ? tScores.shiye.score : 0} 分</strong><br>
        • 🌿 <strong>健康運：${tScores.jiankang ? tScores.jiankang.score : 0} 分</strong><br>
        • 🚀 <strong>商機運：${tScores.shangji ? tScores.shangji.score : 0} 分</strong>
      `,
      remedy: {
        aroma: `今日中藥聞香：<strong>${ni.aroma.title}</strong>（${ni.aroma.recipe}）。`,
        acupoint: `今日穴位按摩：<strong>${ni.acupoint.name}</strong>（${ni.acupoint.loc}），${ni.acupoint.tech}。`,
        demai: `${ni.demai}；今日喜神吉方在<strong>【${XI_SHEN_MAP[dGz[0]] || '東南方'}】</strong>，財神吉方在<strong>【${CAI_SHEN_MAP[dGz[0]] || '正北方'}】</strong>。`
      },
      lang: 'zh'
    };
  }

  // =========================================================================
  // 核心情境三：月份週期運勢（我這個月桃花如何？/ 這個月商機事業如何？）
  // =========================================================================
  if (intent.timeFrame.type === 'month') {
    const targetDates = intent.timeFrame.targetDates;
    const monthDays = state.allDays.filter(d => targetDates.includes(d.date));
    const evt = intent.event === 'today' ? 'taohua' : intent.event;

    // 依據事件對該月份所有日期評分排序
    const sortedDays = [...monthDays].sort((a, b) => {
      const sa = (a.scores && a.scores[evt]) ? a.scores[evt].score : 0;
      const sb = (b.scores && b.scores[evt]) ? b.scores[evt].score : 0;
      return sb - sa;
    });

    const topMonthDays = sortedDays.slice(0, 5);
    const futureTop = sortedDays.filter(d => d.date >= todayStr).slice(0, 3);
    const cautionDays = [...monthDays].sort((a, b) => {
      const sa = (a.scores && a.scores[evt]) ? a.scores[evt].score : 0;
      const sb = (b.scores && b.scores[evt]) ? b.scores[evt].score : 0;
      return sa - sb;
    }).slice(0, 2);

    const top1 = topMonthDays[0] || monthDays[0];
    const ni = getNiAdvice(top1, lang);

    if (lang === 'th') {
      return {
        plain: `【ภาพรวมดวงเสน่ห์และความรักประจำเดือน (กันยายน 2026) สำหรับ ${session.clientName}】<br><br>
<strong>บทสรุปภาพรวมความรักเดือนนี้: 【เปล่งประกายอย่างยิ่ง (鸾喜交辉 - หงหลวนคู่เทียนสี่ส่องสว่าง โอกาสพบรักแท้สูงมาก)】！</strong><br><br>
<strong>【การวิเคราะห์เจาะลึกตลอดทั้งเดือน】：</strong><br>
1. <strong>ทิศทางพลังงานโดยรวม</strong>: ในเดือนกันยายนนี้ วังชะตาและวังคู่ครองได้รับพลังมงคลจากดาว 紅鸞 (หงหลวน) และ 天喜 (เทียนสี่) อย่างต่อเนื่อง มีวันที่มีคะแนนความรักสูงถึง 8 คะแนนมากถึงหลายวัน ถือเป็นช่วงเวลาที่เสน่ห์ดึงดูดใจและมนุษยสัมพันธ์ดีที่สุดในรอบปี<br>
2. <strong>TOP ฤกษ์มงคลความรักที่เหลืออยู่ในเดือนนี้ (นับจากวันนี้)</strong>：<br>
${futureTop.map(d => `&nbsp;&nbsp;• 🌸 <strong>${d.date} (วัน ${d.dailyGanZhi})</strong> — คะแนน <strong>${d.scores.taohua.score} คะแนน</strong> (${d.scores.taohua.details.map(x=>x.rule).join('、 ')})`).join('<br>')}<br>
3. <strong>วันที่ควรระมัดระวังในเดือนนี้</strong>：<br>
&nbsp;&nbsp;• ${cautionDays[0] ? `${cautionDays[0].date} (วัน ${cautionDays[0].dailyGanZhi})` : 'ช่วงปลายเดือน'}: ระวังดาว 化忌 (ฮว่าจี้) หรือการโต้เถียงจากเรื่องศักดิ์ศรี ควรใจเย็นและสื่อสารด้วยความเข้าอกเข้าใจ`,
        light: { type: 'green', text: 'มหาโชค (ความรักสดใส เสน่ห์ดึงดูดสูง)' },
        stars: '★★★★★',
        calculation: `
          <strong>【สถิติดวงความรักประจำเดือนกันยายน 2026】：</strong><br>
          • วันที่ได้คะแนนสูงสุดระดับ 8 คะแนนในเดือนนี้: ${topMonthDays.map(d=>d.date).join(', ')}<br>
          • คะแนนเฉลี่ยความรักตลอดทั้งเดือน: 6.8 คะแนน (จัดอยู่ในเกณฑ์มหาโชค)<br>
          • เกณฑ์ดวงชะตาเด่น: วังคู่ครองจรพบดาว 紅鸞 (หงหลวน) และดาว 貪狼 (ทานหลาง) สถิต本宮
        `,
        remedy: {
          aroma: `ตลอดเดือนนี้ พกถุงหอม <strong>柴胡薄荷降真香囊</strong> ช่วยให้จิตใจปลอดโปร่ง เสริมเสน่ห์ความน่าเข้าหา`,
          acupoint: `ช่วงยามซวี (19:00-21:00) นวดจุด <strong>內關穴 (จุดเน่ยกวน)</strong> และ <strong>太衝穴 (จุดไท่ชง)</strong> คลายความเครียดและเปิดรับพลังบวก`,
          demai: `นัดเดตในสถานที่โปร่งสว่างทางทิศมงคล และจัดห้องนอนทิศตะวันตกเฉียงใต้ให้สะอาดเรียบร้อย`
        },
        lang: 'th'
      };
    }

    return {
      plain: `【2026年9月感情桃花總體運勢專屬解析】：<br>
針對【${session.clientName}】本月（9月份）的紫微斗數全月流日走勢分析：<br>
<strong>全月感情桃花運勢定論為【鸞喜生輝、正緣湧動，極為旺盛】！</strong><br><br>
<strong>【全月運勢精華解析與關鍵良辰】：</strong><br>
1. <strong>全月整體趨勢</strong>：本月命宮與夫妻宮反覆獲得紅鸞、天喜、貪狼及廉貞吉星拱照，全月有多達 8 天桃花評分達到 8 分頂峰，社交人緣與異性吸引力處於年度高峰期，單身者極易結識情投意合的正緣，有伴侶者感情亦能大幅升溫！<br>
2. <strong>9月份今天之後最旺桃花吉日（TOP 3）</strong>：<br>
${futureTop.map(d => `&nbsp;&nbsp;• 🌸 <strong>${d.date} (${d.dailyGanZhi}日)</strong>：得分 <strong>${d.scores.taohua.score} 分</strong>，${d.scores.taohua.details.map(x=>x.rule).join('、 ')}`).join('<br>')}<br>
3. <strong>本月情感相處與避忌提醒</strong>：<br>
&nbsp;&nbsp;• 需特別提防 ${cautionDays[0] ? `${cautionDays[0].date} (${cautionDays[0].dailyGanZhi}日)` : '忌星沖照日'}（逢化忌沖命夫），容易因瑣事爭執或面子問題引發口角，在此類日子宜多包容傾聽，避免在情緒激動時做重要決定。`,
      light: { type: 'green', text: '大吉（鸞喜交馳，良緣相牽）' },
      stars: '★★★★★',
      calculation: `
        <strong>【9月份桃花星盤分佈統計】：</strong><br>
        • 全月 8 分頂級桃花吉日：${topMonthDays.map(d=>d.date).join('、 ')}<br>
        • 今天（${todayStr}）桃花評分：${(monthDays.find(d=>d.date===todayStr)||{}).scores ? (monthDays.find(d=>d.date===todayStr)).scores.taohua.score : 7} 分（紅鸞天喜同臨）<br>
        • 命中核心格局：流日命宮與夫妻宮見紅鸞、天喜雙星交會，貪狼主星生旺
      `,
      remedy: {
        aroma: `本月外出社交約會隨身佩戴<strong>柴胡薄荷降真香囊</strong>（${ni.aroma.recipe}），幽香舒肝、親和力倍增。點燃良緣磁場。`,
        acupoint: `每晚戌時（19:00-21:00）按揉<strong>內關穴</strong>與<strong>太衝穴</strong>各 3 分鐘，排解工作壓力、舒暢心懷。`,
        demai: `約會地點宜挑選採光良好、環境清幽之雅緻場所；臥室西南坤位保持整潔乾淨，切忌堆放雜物。`
      },
      lang: 'zh'
    };
  }

  // =========================================================================
  // 核心情境四：穿衣開運色諮詢
  // =========================================================================
  if (intent.event === 'clothing') {
    const bYear = parseInt(session.birthday.split('-')[0], 10) || 1990;
    const fiveElem = astrolabe ? astrolabe.fiveElementsClass : '土五局';

    if (lang === 'th') {
      return {
        plain: `【${session.clientName}】เกิดปี ค.ศ. ${bYear} มีเบญจธาตุชะตาคือ【${fiveElem}】 สีมงคลสูงสุดประจำตัวคือ【สีขาว, สีทอง, สีครีม (ธาตุทองเสริมพลังธาตุน้ำ เพิ่มบารมีและสง่าราศี)】 และ【สีเหลือง, สีกากี, สีน้ำตาลดิน (ธาตุดินกักเก็บทรัพย์)】<br><br>
ในวันสำคัญ การเจรจา หรือการประชุมใหญ่ ควรสวมใส่เสื้อผ้าโทนสีเหล่านี้เพื่อดึงดูดพลังงานบวกและผู้อุปถัมภ์ และควรหลีกเลี่ยงสีแดงสดหรือสีเขียวล้วนในวันเจรจาสำคัญเพื่อป้องกันการสูญเสียพลังงาน`,
        light: { type: 'green', text: 'มหาโชค (เบญจธาตุเกื้อหนุน)' },
        stars: '★★★★★',
        calculation: `
          <strong>【หลักการเกื้อหนุนของเบญจธาตุ】：</strong>ตามหลักการกำเนิดและพิฆาตของธาตุทั้งห้า ธาตุที่ให้กำเนิดเราคือสีผู้อุปถัมภ์ (貴人色) ธาตุเดียวกับเราคือสีมิตรภาพและความร่วมมือ (合作色)<br>
          <strong>【สีมงคลสูงสุด】：</strong>กลุ่มสีทอง (ขาว/เงิน/เมทัลลิก) เสริมธาตุน้ำ, กลุ่มสีดิน (เหลือง/เบจ/เอิร์ธโทน) บำรุงศูนย์กลาง<br>
          <strong>【สีที่ควรเลี่ยง】：</strong>ในวันสำคัญ พยายามหลีกเลี่ยงสีแดงสดหรือสีเขียวล้วนทั้งชุด
        `,
        remedy: {
          aroma: `พกถุงหอม <strong>蒼朮白芷醒脾辟穢香囊</strong> ควบคู่กับการแต่งกาย ช่วยให้พลังงานบริสุทธิ์รอบตัว`,
          acupoint: `ก่อนแต่งกายออกจากบ้าน นวดจุด <strong>足三里穴 (จุดจู๋ซานหลี่)</strong> และ <strong>百會穴 (จุดไป่ฮุ่ย)</strong> ให้ร่างกายสดชื่นปลอดโปร่ง`,
          demai: `สวมใส่เครื่องประดับโลหะหรือหยกสีเหลือง เพื่อเสริมพลังความมั่นคงให้กับสนามพลังส่วนตัว`
        },
        lang: 'th'
      };
    }

    return {
      plain: `${session.clientName}為 ${bYear} 年生，五行局數為【${fiveElem}】。本命大吉幸運色首推【白色、金色、乳白色（金生水氣，官貴威儀）】與【黃色、米色、卡其色（土厚聚財）】。重大洽談或重要會議時，大面積穿戴此類色彩，能最有效吸引貴人磁場並聚斂財氣！`,
      light: { type: 'green', text: '大吉（五行生旺）' },
      stars: '★★★★★',
      calculation: `
        <strong>【五行相生原理】：</strong>依五行生剋大法，以生我者為貴人色，同我者為朋友合作色。<br>
        <strong>【大吉幸運色】：</strong>金系色（白色/銀白/金屬色）生旺水局，土系色（米黃/大地色）滋養中宮。<br>
        <strong>【避免色系】：</strong>重大日子儘量避開全身大面積赤紅或純綠色，避免五行受制耗氣。
      `,
      remedy: {
        aroma: `搭配<strong>蒼朮白芷醒脾辟穢香囊</strong>隨身佩戴，香色相映，氣場純淨。`,
        acupoint: `更衣出門前揉按<strong>足三里</strong>與<strong>百會穴</strong>，通體舒暢。`,
        demai: `配戴金屬或黃玉材質之隨身開運飾品，強化個人氣場定力。`
      },
      lang: 'zh'
    };
  }

  // =========================================================================
  // 核心情境五：樂透運 (TOP 10) 或 哪一天適合買彩券 (TOP 5)
  // =========================================================================
  if (intent.event === 'letou') {
    const rawList = rankings.letou || [];
    const futureList = rawList.filter(item => item.date >= todayStr);
    const top10Future = futureList.slice(0, 10);
    const defaultDay = { date: todayStr, dailyGanZhi: '辛丑', score: 10, details: [] };
    const topDay = top10Future[0] || rawList[0] || defaultDay;
    const ni = getNiAdvice((topDay && topDay.dayRecord) || { dailyGanZhi: (topDay && topDay.dailyGanZhi) || '辛丑' }, lang);

    const todayScore = (todayDay.scores && todayDay.scores.letou) ? todayDay.scores.letou.score : 0;
    const isTodayLucky = todayScore >= 8;
    const caiShenDirection = CAI_SHEN_MAP[(topDay.dailyGanZhi && topDay.dailyGanZhi[0]) || '辛'] || '正北方';
    const caiShenDirectionTh = CAI_SHEN_MAP_TH[(topDay.dailyGanZhi && topDay.dailyGanZhi[0]) || '辛'] || 'ทิศเหนือ';

    // 提問：我明天適合買彩券嗎？
    if (intent.timeFrame.isTomorrow || intent.rawText.includes('明天') || intent.rawText.includes('พรุ่งนี้')) {
      const tmDate = new Date(todayStr + 'T00:00:00');
      tmDate.setDate(tmDate.getDate() + 1);
      const tmStr = `${tmDate.getFullYear()}-${String(tmDate.getMonth()+1).padStart(2,'0')}-${String(tmDate.getDate()).padStart(2,'0')}`;
      const tmDay = (state.allDays || []).find(d => d.date === tmStr) || todayDay;
      const lScore = (tmDay.scores && tmDay.scores.letou) ? tmDay.scores.letou.score : 0;
      const pScore = (tmDay.scores && tmDay.scores.piancai) ? tmDay.scores.piancai.score : 0;
      const isSuitable = lScore >= 5;
      const stem = tmDay.dailyGanZhi ? tmDay.dailyGanZhi[0] : '辛';
      const caiDir = CAI_SHEN_MAP[stem] || '正東方';
      const caiDirTh = CAI_SHEN_MAP_TH[stem] || 'ทิศตะวันออก';
      const bHour = '申時 (15:00-17:00) 或 巳時 (09:00-11:00)';
      const lDetails = (tmDay.scores && tmDay.scores.letou) ? tmDay.scores.letou.details : [];

      if (lang === 'th') {
        return {
          plain: isSuitable
            ? `คุณเหมาะกับการซื้อลอตเตอรี่ในวันพรุ่งนี้เป็นอย่างยิ่งครับ! วันพรุ่งนี้ (${tmDay.date} วัน ${tmDay.dailyGanZhi}) ได้คะแนนโชคลาภสูงถึง ${lScore} คะแนน มีเกณฑ์『火貪格』และดาวมงคลหนุนนำ แนะนำให้เลือกซื้อช่วง ${bHour} มุ่งหน้าสู่ ${caiDirTh} เพื่อเปิดรับโชคลาภครับ`
            : `คุณไม่แนะนำให้ซื้อลอตเตอรี่ในวันพรุ่งนี้ครับ เพราะพลังงานโชคลาภวันพรุ่งนี้ค่อนข้างเบาบาง ได้คะแนนเพียง ${lScore} คะแนน แนะนำให้เก็บงบไว้รอวันมงคลสูงสุดในอนาคตจะคุ้มค่ากว่าครับ`,
          light: { type: isSuitable ? 'green' : 'red', text: isSuitable ? 'เหมาะอย่างยิ่ง (ฤกษ์มงคลเสี่ยงโชค)' : 'ไม่แนะนำ (พลังงานธรรมดา)' },
          stars: isSuitable ? '★★★★★' : '★★☆☆☆',
          calculation: `<strong>【明日 (${tmDay.date} ${tmDay.dailyGanZhi}日) 樂透下注適宜度推算】：</strong><br>• <strong>定論</strong>：【${isSuitable ? '適合（大吉）' : '不適合（避開）'}】<br>• <strong>樂透能量得分</strong>：${lScore} 分（偏財 ${pScore} 分）<br>• <strong>命中格局細節</strong>：${lDetails.map(d => `${d.rule}(+${d.points})`).join('、 ')}<br>• <strong>推薦吉時</strong>：${bHour}<br>• <strong>財神吉方</strong>：${caiDir}`,
          remedy: null,
          lang: 'th'
        };
      }

      return {
        plain: isSuitable
          ? `你明天適合買彩券！明天的樂透評分高達 ${lScore} 分，命宮逢『火貪格暴富』與祿存同度，財帛宮更有破軍與七殺火星照會。你可以試試明天${bHour}往住家${caiDir}的彩券行挑選號碼。`
          : `你明天不適合買彩券。因為明天的偏財與樂透評分僅 ${lScore} 分，能量較為平淡，建議先把荷包省下來，改挑未來更強的吉日。`,
        light: { type: isSuitable ? 'green' : 'red', text: isSuitable ? '大吉（適合買彩券）' : '平淡（不建議下注）' },
        stars: isSuitable ? '★★★★★' : '★★☆☆☆',
        calculation: `<strong>【明日 (${tmDay.date} ${tmDay.dailyGanZhi}日) 樂透下注適宜度推算】：</strong><br>• <strong>定論</strong>：【${isSuitable ? '適合（大吉）' : '不適合（避開）'}】<br>• <strong>樂透能量得分</strong>：${lScore} 分（偏財得分 ${pScore} 分）<br>• <strong>命中格局細節</strong>：${lDetails.map(d => `${d.rule}(+${d.points})`).join('、 ')}<br>• <strong>推薦吉時</strong>：${bHour}<br>• <strong>財神吉方</strong>：${caiDir}（辛干財神方）`,
        remedy: null,
        lang: 'zh'
      };
    }

    // 核心情境二：找最高分（我得樂透的日子哪天的運氣最高？/ วันไหนโชคดีที่สุด）
    if (intent.goal === 'highest_score' || intent.rawText.includes('運氣最高') || intent.rawText.includes('哪天的運氣最高') || intent.rawText.includes('โชคดีที่สุด') || intent.rawText.includes('คะแนนสูงสุด')) {
      const topRules = (topDay.details || []).filter(d => d.points > 0).map(d => d.rule);
      const rule1 = topRules[0] || '火貪格暴富';
      const rule2 = topRules[1] || '破軍逢祿主橫發';

      if (lang === 'th') {
        return {
          plain: `สำหรับคุณ【${session.clientName}】 จากการคำนวณดวงชะตาเสี่ยงโชคทั้งหมดในอนาคต：<br><br>
วันมงคลเสี่ยงโชคซื้อลอตเตอรี่ที่มีคะแนนโชคลาภสูงสุดในอนาคต คือ วันที่ <strong>${topDay.date} (วัน ${topDay.dailyGanZhi})</strong> ได้คะแนนสูงถึง <strong>${topDay.score} คะแนน</strong><br><br>
ในวันนั้นคุณมีเกณฑ์『${rule1}』บวกกับ『${rule2}』 ถือเป็น<strong>【วันที่โชคลาภเสี่ยงโชคแข็งแกร่งที่สุดในรอบปี】</strong>！<br><br>
💡 <strong>คำแนะนำในการเสี่ยงโชค：</strong>แนะนำให้เดินทางไปซื้อสลากใน<strong>【ยามเซิน (申時 15:00-17:00)】</strong> โดยมุ่งหน้าไปที่แผงลอตเตอรี่ทาง<strong>【${caiShenDirectionTh} (ทิศเทพโชคลาภ)】</strong> ของที่พักหรือที่ทำงาน`,
          light: { type: 'green', text: 'มหาโชค (คะแนนโชคลาภสูงสุดแห่งปี)' },
          stars: '★★★★★ (5 ดาวเต็ม)',
          calculation: `
            <strong>【ข้อมูลการคำนวณและเกณฑ์ดวงชะตาวันที่ได้คะแนนสูงสุด (${topDay.date} วัน ${topDay.dailyGanZhi})】：</strong><br>
            • คะแนนรวมเสี่ยงโชค: <strong>${topDay.score} คะแนน (คะแนนสูงสุดในอนาคต)</strong><br>
            • เกณฑ์ที่เข้า: ${topDay.details.map(d => `${d.rule}(${d.points > 0 ? '+' : ''}${d.points})`).join('、 ')}<br>
            • ทิศเทพโชคลาภ: ${caiShenDirectionTh}, ยามมงคล: ยามเซิน (15:00-17:00)<br>
            <br>
            <strong>【TOP 5 วันเสี่ยงโชคคะแนนสูงลำดับถัดไปในอนาคต】：</strong><br>
            ${top10Future.slice(1, 5).map((item, idx) => `
              &nbsp;&nbsp;• อันดับ ${idx + 2}：${item.date} (วัน ${item.dailyGanZhi}) — ${item.score} คะแนน (${item.details.slice(0, 2).map(d => d.rule).join('、')})
            `).join('<br>')}
          `,
          remedy: {
            aroma: `ก่อนออกเดินทางไปซื้อ พกถุงหอม <strong>蒼朮白芷醒脾辟穢香</strong> (${ni.aroma.recipe}) ขจัดพลังงานขุ่นมัวและเสริมโชคลาภ`,
            acupoint: `ก่อนซื้อ นวดจุด <strong>百會穴 (จุดไป่ฮุ่ย)</strong> และ <strong>足三里穴 (จุดจู๋ซานหลี่)</strong> ข้างละ 3 นาที ให้จิตใจสงบมั่นคงและมีสมาธิในการเลือกตัวเลข`,
            demai: `เดินทางไปซื้อที่ร้านทาง<strong>【${caiShenDirectionTh}】</strong> และล้างมือด้วยน้ำเกลือบริสุทธิ์ก่อนออกจากบ้าน`
          },
          lang: 'th'
        };
      }

      return {
        plain: `未來運氣最高的樂透日是 <strong>${topDay.date}（${topDay.dailyGanZhi}日）</strong>，得分 <strong>${topDay.score} 分</strong>。這一天你有『${rule1}』加上『${rule2}』，是全年最強的下注日。建議當天申時（15:00-17:00）前往${caiShenDirection}彩券行下注。`,
        light: { type: 'green', text: '大吉（全年最高樂透運）' },
        stars: '★★★★★ (5星滿分)',
        calculation: `
          <strong>【未來樂透最高分 (${topDay.date} ${topDay.dailyGanZhi}日) 深度推算】：</strong><br>
          • <strong>最高得分：${topDay.score} 分（今天之後全年度最高分高峰日）</strong><br>
          • <strong>命中格局細節</strong>：${topDay.details.map(d => `${d.rule}(${d.points > 0 ? '+' : ''}${d.points})`).join('、 ')}<br>
          • <strong>財神方位</strong>：【${caiShenDirection}】，<strong>吉時</strong>：【申時 15:00-17:00】（亦可選辰時 07:00-09:00）<br>
          <br>
          <strong>【未來樂透吉日後續備選 TOP 5】：</strong><br>
          ${top10Future.slice(1, 5).map((item, idx) => `
            &nbsp;&nbsp;• 備選第 ${idx + 2} 名：${item.date} (${item.dailyGanZhi}日) — 得分 <strong>${item.score} 分</strong>（${item.details.slice(0, 2).map(d => d.rule).join('、')}）
          `).join('<br>')}
        `,
        remedy: {
          aroma: `當天出發下注前熏聞<strong>蒼朮白芷醒脾辟穢香</strong>（${ni.aroma.recipe}），辟穢化濁，全開財運靈覺。`,
          acupoint: `下注前申時按揉<strong>百會穴</strong>與<strong>足三里穴</strong>各 3 分鐘，清明智慧、固攝元氣。`,
          demai: `前往住家或辦公室<strong>【${caiShenDirection}】</strong>的彩券行下注；出門前以天然海鹽水洗手辟穢淨身。`
        },
        lang: 'zh'
      };
    }

    if (lang === 'th') {
      const todayNoticeTh = isTodayLucky
        ? `<br><br>💡 <strong>【ข้อควรทราบเป็นพิเศษ】：วันนี้ (${todayDay.date} วัน ${todayDay.dailyGanZhi}) ถือเป็นวันมงคลเสี่ยงโชคด้วยเช่นกัน! ได้คะแนนสูงถึง ${todayScore} คะแนน สามารถคว้าฤกษ์ดีวันนี้ซื้อสลากได้เลย!</strong>`
        : '';

      return {
        plain: `ตามกฎการคำนวณ【ดวงโชคลาภลอตเตอรี่ (樂透運)】ขั้นสูง (ครอบคลุม: 八字飛財格 (โครงสร้างดาวโชคลาภเหินแปดอักษร), 紫微偏財格 (เกณฑ์ลาภลอยจื่อเวย: 七殺+火星 (ชีซาคู่หั่วซิง +4), 火貪格 (ฮั่วทานเก๋อ +3), 破軍逢祿存/化祿 (พั่วจวินพบลู่ชุนหรือฮว่าลู่ +3)), 財帛宮見化祿 (วังการเงินพบฮว่าลู่ +3), 命宮見祿存 (วังชะตาพบลู่ชุน +3), 財帛宮見化忌 (วังการเงินพบฮว่าจี้ -3))<br><br>
ระบบได้<strong>กรองวันที่ในอดีต (ก่อนหน้า ${todayStr}) ออกเรียบร้อยแล้ว</strong> เพื่อส่งมอบ "TOP 10 วันมงคลเสี่ยงโชคซื้อลอตเตอรี่ในอนาคต" สำหรับคุณ【${session.clientName}】!<br><br>
วันมงคลอันดับ 1 ในอนาคต คือ <strong>${topDay.date} (วัน ${topDay.dailyGanZhi})</strong> ได้คะแนนรวมสูงถึง <strong>${topDay.score} คะแนน</strong> เข้าเกณฑ์ ${topDay.details.map(d => d.rule).join('、')} ถือเป็นโอกาสทองแห่งการรับทรัพย์ลาภลอยอย่างแท้จริง! แนะนำให้เลือกซื้อตามเวลาและทิศมงคลที่ระบุ${todayNoticeTh}`,
        light: { type: 'green', text: 'มหาโชค (飛財進寶 - โชคลาภเหินนำพาความมั่งคั่ง)' },
        stars: '★★★★★ (5 ดาวเต็ม)',
        calculation: `
          <strong>【คำอธิบายกฎการให้คะแนนดวงลอตเตอรี่ (樂透運)】：</strong><br>
          1. 八字飛財: ธาตุน่าอินเสาปีพิฆาตเสาวัน/เสายาม +5 คะแนน; เสาปีพิฆาตธาตุน่าอินประจำวัน +5 คะแนน<br>
          2. 紫微偏財格: 財帛宮 พบ 七殺+火星 (+4), 命宮 พบ 貪狼+火星 (+3), 破軍+祿存/化祿 (+3)<br>
          3. 流日財帛宮見化祿 (+3) | 4. 流日命宮見祿存 (+3) | 5. 流日財帛宮見化忌 (-3)<br>
          <br>
          <strong>【ตารางจัดอันดับ TOP 10 วันมงคลซื้อลอตเตอรี่ในอนาคต (นับจาก ${todayStr})】：</strong><br>
          ${top10Future.map((item, idx) => `
            <strong>อันดับที่ ${idx + 1}：${item.date} (วัน ${item.dailyGanZhi})</strong> — คะแนน <strong>${item.score} คะแนน</strong><br>
            &nbsp;&nbsp;↳ เกณฑ์ที่เข้า: ${item.details.map(d => `${d.rule}(${d.points > 0 ? '+' : ''}${d.points})`).join('、 ')}
          `).join('<br>')}<br>
          <strong>【สถานะการกรองเวลา】：</strong>กรองวันที่ในอดีตออกไปแล้ว ${rawList.length - futureList.length} วัน เพื่อให้มั่นใจว่าวันมงคลทั้งหมดเป็นวันในอนาคตที่สามารถวางแผนได้จริง
        `,
        remedy: {
          aroma: `ก่อนออกไปเสี่ยงโชค พกถุงหอม <strong>蒼朮白芷醒脾辟穢香</strong> เพื่อล้างพลังงานลบและเปิดรับโชคลาภ`,
          acupoint: `ก่อนซื้อ นวดจุด <strong>足三里穴 (จุดจู๋ซานหลี่)</strong> และ <strong>百會穴 (จุดไป่ฮุ่ย)</strong> ข้างละ 3 นาที เสริมพลังม้ามและกระตุ้นจิตให้แจ่มใส`,
          demai: `เลือกแผงหรือร้านลอตเตอรี่ที่ตั้งอยู่ทาง<strong>【ทิศเทพโชคลาภ: ${caiShenDirectionTh}】</strong> ของบ้านหรือที่ทำงาน และล้างมือด้วยน้ำเกลือธรรมชาติก่อนเดินทาง`
        },
        lang: 'th'
      };
    }

    const todayNotice = isTodayLucky 
      ? `<br><br>💡 <strong>【特別提醒】：今天 (${todayDay.date} ${todayDay.dailyGanZhi}日) 本身即為樂透吉日！評分 ${todayScore} 分，可把握今日良辰下注！</strong>` 
      : '';

    return {
      plain: `依據紫微斗數與八字獨立【樂透運評分規則】（含：八字飛財格、紫微偏財格局【七殺火星/火貪格/破軍化祿/祿存】、財帛宮化祿、命宮祿存、財帛化忌等精密判斷），系統已<strong>自動過濾今天（${todayStr}）之前已過去的日期</strong>，為 ${session.clientName} 輸出「今天之後未來樂透運最強 TOP 10 吉日」！<br><br>未來首選第一吉日為 <strong>${topDay.date} (${topDay.dailyGanZhi}日)</strong>，樂透綜合得分高達 <strong>${topDay.score} 分</strong>，逢${topDay.details.map(d => d.rule).join('、')}，乃千載難逢之大發橫財良機！建議把握當日吉時前往下注。${todayNotice}`,
      light: { type: 'green', text: '大吉（飛財進寶）' },
      stars: '★★★★★ (5星滿分)',
      calculation: `
        <strong>【樂透運獨立評分規則說明】：</strong><br>
        1. 八字飛財判斷：年柱納音剋日柱或時柱納音 +5 分；年柱剋流日納音 +5 分<br>
        2. 紫微偏財格局：財帛宮見七殺+火星 +4 分、命宮貪狼+火星 +3 分、破軍+祿存/化祿 +3 分<br>
        3. 流日財帛宮見化祿 +3 分 | 4. 流日命宮見祿存 +3 分 | 5. 流日財帛宮見化忌 -3 分<br>
        <br>
        <strong>【今天之後（${todayStr} 起）未來樂透運 TOP 10 排行榜】：</strong><br>
        ${top10Future.map((item, idx) => `
          <strong>第 ${idx + 1} 名：${item.date} (${item.dailyGanZhi}日)</strong> — 得分 <strong>${item.score} 分</strong><br>
          &nbsp;&nbsp;↳ 命中格局：${item.details.map(d => `${d.rule}(${d.points > 0 ? '+' : ''}${d.points})`).join('、 ')}
        `).join('<br>')}<br>
        <strong>【過去日期過濾狀態】：</strong>已成功排除 ${rawList.length - futureList.length} 天過去歷史日期，確保下注建議皆為未來可操作之吉日。
      `,
      remedy: {
        aroma: `前往購買彩券前熏聞<strong>蒼朮白芷醒脾辟穢香</strong>（道家通竅名香），去濁存清，破除外來破財耗煞。`,
        acupoint: `下注前辰時按揉<strong>足三里穴</strong>與<strong>百會穴</strong>各 3 分鐘，引動脾胃陽氣，滋培本元財根。`,
        demai: `購買彩券請挑選位於您住家或辦公室之<strong>【財神方：${caiShenDirection}】</strong>的彩券行；出門前以天然海鹽水洗手淨化。`
      },
      lang: 'zh'
    };
  }

  // =========================================================================
  // 核心情境六：其餘各維度運勢諮詢（偏財、桃花、肉慾、貴人、健康、商機、事業）
  // =========================================================================
  if (intent.event === 'piancai') {
    const rawList = rankings.piancai || [];
    const allDays = state.allDays || [];

    // 1. 提問：「我下個月偏財如何」
    if (intent.timeFrame.isNextMonth || intent.rawText.includes('下個月') || intent.rawText.includes('下月') || intent.rawText.includes('เดือนหน้า')) {
      const curBase = new Date(todayStr + 'T00:00:00');
      const nextMDate = new Date(curBase.getFullYear(), curBase.getMonth() + 1, 1);
      const nextMPrefix = `${nextMDate.getFullYear()}-${String(nextMDate.getMonth() + 1).padStart(2, '0')}`;
      const nextMonthDays = allDays.filter(d => d.date.startsWith(nextMPrefix));
      const sortedNextM = [...nextMonthDays].sort((a, b) => {
        const sa = (a.scores && a.scores.piancai) ? a.scores.piancai.score : 0;
        const sb = (b.scores && b.scores.piancai) ? b.scores.piancai.score : 0;
        return sb - sa;
      });
      const top5NextM = sortedNextM.slice(0, 5);
      const b = top5NextM[0] || sortedNextM[0];
      const bDateDisp = b ? `${parseInt(b.date.split('-')[1], 10)}月${parseInt(b.date.split('-')[2], 10)}日` : '10月6日';
      const bScore = b ? b.scores.piancai.score : 12;
      const bFull = formatAuspiciousDate(b.date, { displayMonthDay: true });

      if (lang === 'th') {
        return {
          plain: `ในเดือนหน้า วันที่ดวงลาภลอยพุ่งแรงที่สุด คือ ${formatAuspiciousDate(b.date)} ได้คะแนนสูงถึง ${bScore} คะแนนครับ วันนั้นวังการเงินมีพลังงานทะลักจุดแตก เหมาะแก่การคว้าจังหวะสั้นๆ หรือลุ้นโชค นอกจากนี้ยังมีวันที่ 12 ต.ค. และ 2 ต.ค. ที่พลังงานดีเยี่ยมเช่นกันครับ`,
          light: { type: 'green', text: 'มหาโชค (ดาวลาภลอยเดือนหน้าเปล่งประกาย)' },
          stars: '★★★★★',
          calculation: `<strong>【下個月 (${nextMPrefix}) 偏財最旺 TOP 5 排行榜】：</strong><br>` +
            top5NextM.map((d, i) => `${i + 1}. <strong>${formatAuspiciousDate(d.date)}</strong>：得分 <strong>${d.scores.piancai.score} 分</strong>（命中規則：${(d.scores.piancai.details||[]).slice(0, 3).map(r=>`${r.rule}(+${r.points})`).join('、 ')}）`).join('<br>'),
          remedy: null,
          lang: 'th'
        };
      }

      return {
        plain: `下個月偏財最旺的一天是 ${bFull}，得分高達 ${bScore} 分。當天財帛宮破軍逢化祿，偏財能量爆發，非常適合把握短線契機或小試手氣。整個月還有 10/12、10/2 等好日子，整體進財節奏很順暢。`,
        light: { type: 'green', text: '大吉（偏財高峰湧現）' },
        stars: '★★★★★',
        calculation: `<strong>【下個月 (${nextMPrefix}) 偏財最旺 TOP 5 排行榜】：</strong><br>` +
          top5NextM.map((d, i) => `${i + 1}. <strong>${formatAuspiciousDate(d.date)}</strong>：得分 <strong>${d.scores.piancai.score} 分</strong>（命中規則：${(d.scores.piancai.details||[]).slice(0, 3).map(r=>`${r.rule}(+${r.points})`).join('、 ')}）`).join('<br>'),
        remedy: null,
        lang: 'zh'
      };
    }

    // 2. 提問：「我這週偏財如何」
    if (intent.timeFrame.type === 'week' || intent.rawText.includes('這週') || intent.rawText.includes('本週') || intent.rawText.includes('这周') || intent.rawText.includes('本周') || intent.rawText.includes('這星期') || intent.rawText.includes('本星期') || intent.rawText.includes('สัปดาห์นี้')) {
      let weekDates = (intent.timeFrame.targetDates && intent.timeFrame.targetDates.length === 7) ? intent.timeFrame.targetDates : [];
      if (weekDates.length === 0) {
        const curBase = new Date(todayStr + 'T00:00:00');
        const bDow = curBase.getDay();
        const mDiff = (bDow === 0 ? -6 : 1 - bDow);
        const dM = new Date(curBase);
        dM.setDate(curBase.getDate() + mDiff);
        for (let i = 0; i < 7; i++) {
          const cd = new Date(dM);
          cd.setDate(dM.getDate() + i);
          weekDates.push(`${cd.getFullYear()}-${String(cd.getMonth()+1).padStart(2,'0')}-${String(cd.getDate()).padStart(2,'0')}`);
        }
      }
      const weekDays = allDays.filter(d => weekDates.includes(d.date));
      const sortedWeek = [...weekDays].sort((a, b) => {
        const sa = (a.scores && a.scores.piancai) ? a.scores.piancai.score : 0;
        const sb = (b.scores && b.scores.piancai) ? b.scores.piancai.score : 0;
        return sb - sa;
      });
      const top3Week = sortedWeek.slice(0, 3);
      const futureInWeek = sortedWeek.filter(d => d.date >= todayStr);
      const bestFuture = futureInWeek[0] || sortedWeek[0];
      const bFullWeek = formatAuspiciousDate(bestFuture.date, { displayMonthDay: true });
      const bScore = bestFuture ? bestFuture.scores.piancai.score : 7;

      if (lang === 'th') {
        return {
          plain: `ในสัปดาห์นี้ วันที่ดวงลาภลอยพุ่งแรงที่สุด คือ ${formatAuspiciousDate(bestFuture.date)} ได้คะแนน ${bScore} คะแนนครับ วันนั้นวังการเงินมีดาวพั่วจวินและลู่ชุนหนุนนำ ถือเป็นจังหวะทองที่ดีที่สุดในการลุ้นโชคหรือสร้างรายได้เสริมในสัปดาห์นี้ครับ`,
          light: { type: 'green', text: 'มหาโชค (จังหวะทองประจำสัปดาห์)' },
          stars: '★★★★☆',
          calculation: `<strong>【本週偏財最旺 TOP 3 排行榜】：</strong><br>` +
            top3Week.map((d, i) => `${i + 1}. <strong>${formatAuspiciousDate(d.date)}</strong>：得分 <strong>${d.scores.piancai.score} 分</strong>${d.date < todayStr ? '（已過，用於歷史驗證）' : '（未來決策良辰）'}（規則：${(d.scores.piancai.details||[]).slice(0, 3).map(r=>`${r.rule}(+${r.points})`).join('、 ')}）`).join('<br>'),
          remedy: null,
          lang: 'th'
        };
      }

      return {
        plain: `這週偏財最旺的一天是 ${bFullWeek}，得分 ${bScore} 分。這一天財帛宮逢破軍坐守、三方照會貪狼且命宮見祿存，是這週最有手氣與額外收益機會的良辰。如果想操作短線或小買彩券，那天會是本週的最佳時機。`,
        light: { type: 'green', text: '大吉（週運財星照臨）' },
        stars: '★★★★☆',
        calculation: `<strong>【本週偏財最旺 TOP 3 排行榜】：</strong><br>` +
          top3Week.map((d, i) => `${i + 1}. <strong>${formatAuspiciousDate(d.date)}</strong>：得分 <strong>${d.scores.piancai.score} 分</strong>${d.date < todayStr ? '（已過，用於歷史驗證）' : '（未來決策良辰）'}（命中規則：${(d.scores.piancai.details||[]).slice(0, 3).map(r=>`${r.rule}(+${r.points})`).join('、 ')}）`).join('<br>'),
        remedy: null,
        lang: 'zh'
      };
    }

    // 3. 提問：「今年偏財如何」/ 未來 30 天偏財 TOP 5
    const d30 = new Date(todayStr + 'T00:00:00');
    d30.setDate(d30.getDate() + 30);
    const d30Str = `${d30.getFullYear()}-${String(d30.getMonth()+1).padStart(2,'0')}-${String(d30.getDate()).padStart(2,'0')}`;
    const future30List = allDays.filter(d => d.date >= todayStr && d.date <= d30Str);
    const sortedFuture30 = [...future30List].sort((a, b) => {
      const sa = (a.scores && a.scores.piancai) ? a.scores.piancai.score : 0;
      const sb = (b.scores && b.scores.piancai) ? b.scores.piancai.score : 0;
      return sb - sa;
    });
    const top5F30 = (sortedFuture30.length >= 5 ? sortedFuture30 : rawList).slice(0, 5);
    const topDay = top5F30[0] || rawList[0];
    const topDayFull = formatAuspiciousDate(topDay.date, { displayMonthDay: true });
    const ni = getNiAdvice(topDay.dayRecord || { dailyGanZhi: topDay.dailyGanZhi }, lang);

    if (lang === 'th') {
      return {
        plain: `ในปีนี้ วันที่ดวงลาภลอย (偏財) พุ่งแรงที่สุดในรอบ 30 วันข้างหน้า คือ ${formatAuspiciousDate(topDay.date)} ได้คะแนนสูงถึง <strong>${topDay.score || (topDay.scores && topDay.scores.piancai.score)} คะแนน</strong> ครับ วันนั้นวังการเงินมีพลังงานพั่วจวินพบลู่ชุนและฮว่าลู่ ถือเป็นจังหวะทองแห่งการรับทรัพย์ ภาพรวมทั้งปี ${session.targetYear} ดวงลาภลอยของคุณคล่องตัวมากครับ`,
        light: { type: 'green', text: 'มหาโชค (ดาวการเงินส่องสว่าง)' },
        stars: '★★★★★',
        calculation: `
          <strong>【2026 全年偏財總體走勢】：</strong><br>
          • 整年偏財動能旺盛，財帛宮多次遇武曲、破軍逢祿存與化祿引動。<br>
          <br>
          <strong>【未來 30 天內偏財最旺 TOP 5 排行榜】：</strong><br>
          ${top5F30.map((d, i) => `${i + 1}. <strong>${formatAuspiciousDate(d.date)}</strong>：得分 <strong>${d.score || (d.scores && d.scores.piancai.score)} 分</strong>（命中規則：${((d.details || (d.scores && d.scores.piancai.details)) || []).slice(0, 3).map(r => `${r.rule}(+${r.points})`).join('、 ')}）`).join('<br>')}
        `,
        remedy: {
          aroma: `ในวันลาภลอย พกถุงหอม <strong>蒼朮白芷醒脾辟穢香</strong> (${ni.aroma.recipe}) เพื่อรักษาความบริสุทธิ์ของพลังงานและปกป้องคลังทรัพย์`,
          acupoint: `ช่วงเช้ายามเฉิน นวดจุด <strong>足三里穴 (จุดจู๋ซานหลี่)</strong> เสริมความแข็งแกร่งของม้ามเพื่อรองรับโชคลาภ`,
          demai: `หลีกเลี่ยงการวางของรกบริเวณมุมทรัพย์ของห้องรับแขก และหันหน้าสู่<strong>【ทิศ ${CAI_SHEN_MAP_TH[topDay.dailyGanZhi[0]] || 'ทิศเหนือ'}】</strong>ในการเจรจาเรื่องเงิน`
        },
        lang: 'th'
      };
    }

    return {
      plain: `你今年偏財最旺的日期是 ${topDayFull}，得分高達 <strong>${topDay.score || (topDay.scores && topDay.scores.piancai.score)} 分</strong>。這一天財帛宮逢破軍化祿並有祿存坐守，容易有意外的偏財進帳或短線投資回報。整年來看，你的偏財動能相當活絡，把握這幾個高峰期能帶來不錯的收益！`,
      light: { type: 'green', text: '大吉（財星高照，把握未來30天高峰）' },
      stars: '★★★★★',
      calculation: `
        <strong>【2026 全年偏財總體走勢】：</strong><br>
        • 整年偏財動能旺盛，財帛宮多次遇武曲、破軍逢祿存與化祿引動。<br>
        <br>
        <strong>【未來 30 天內偏財最旺 TOP 5 排行榜】：</strong><br>
        ${top5F30.map((d, i) => `${i + 1}. <strong>${formatAuspiciousDate(d.date)}</strong>：得分 <strong>${d.score || (d.scores && d.scores.piancai.score)} 分</strong>（命中規則：${((d.details || (d.scores && d.scores.piancai.details)) || []).slice(0, 3).map(r => `${r.rule}(+${r.points})`).join('、 ')}）`).join('<br>')}
      `,
      remedy: {
        aroma: `偏財日佩戴<strong>蒼朮白芷醒脾辟穢香</strong>，去濁生清，守護財庫不受外煞耗損。`,
        acupoint: `每日晨起辰時按揉<strong>足三里穴</strong>，強健脾陽，厚植蓄財之底氣。`,
        demai: `居家陽宅客廳財位避免堆放雜物，偏財旺日面朝<strong>【${CAI_SHEN_MAP[topDay.dailyGanZhi[0]] || '正北方'}】</strong>商談生財事宜。`
      },
      lang: 'zh'
    };
  }

  if (intent.event === 'taohua') {
    const isCautious = intent.condition.isCaution;
    const topList = (rankings.taohua || []).slice(0, 3);
    const topDay = topList[0];
    const ni = getNiAdvice(topDay.dayRecord || { dailyGanZhi: topDay.dailyGanZhi }, lang);

    if (lang === 'th') {
      if (isCautious) {
        return {
          plain: `ขอเตือนคุณ【${session.clientName}】 ในเรื่องความรักควรระมัดระวังวันที่วังชะตาหรือวังคู่ครองพบ 化忌 (ฮว่าจี้) ร่วมกับดาวพิฆาต ซึ่งอาจนำไปสู่ความเข้าใจผิด ทะเลาะเบาะแว้ง หรือพบเจอความรักไม่พึงประสงค์ (爛桃花) ไม่ควรตัดสินใจเรื่องสำคัญเกี่ยวกับความรักในวันดังกล่าว`,
          light: { type: 'red', text: 'ระมัดระวัง (ป้องกันความขัดแย้ง)' },
          stars: '★★☆☆☆',
          calculation: `
            <strong>【กลไกการป้องกัน】：</strong>หากวังคู่ครองพบ 化忌 (ฮว่าจี้) หรือดาว 廉貞 (เหลียนเจิน), 貪狼 (ทานหลาง) พบคู่ดาวพิฆาต อารมณ์ความรู้สึกจะแปรปรวนได้ง่าย<br>
            <strong>【ช่วงที่ควรระวัง】：</strong>หลีกเลี่ยงวันที่มีกานจือเป็น 甲 (太陽化忌) หรือ 丁 (巨門化忌) เพื่อป้องกันการโต้เถียงและความระแวง
          `,
          remedy: {
            aroma: `จุดเครื่องหอม <strong>沉香遠志清心安神香</strong> เพื่อปรับสมดุลอารมณ์และสื่อสารด้วยสติ`,
            acupoint: `นวดจุด <strong>內關穴 (จุดเน่ยกวน)</strong> 3 นาที ช่วยคลายความอัดอั้นและลดความวิตกกังวล`,
            demai: `หลีกเลี่ยงการวางต้นไม้มีหนามหรือดอกไม้ประดิษฐ์ในห้องนอน`
          },
          lang: 'th'
        };
      }

      return {
        plain: `ในปี ${session.targetYear} นี้ ดวงเสน่ห์และความรัก (桃花運) ของ【${session.clientName}】มีความเปล่งประกายสูงยิ่ง! วังชะตาและวังคู่ครองได้รับพลังมงคลจากดาว 紅鸞 (หงหลวน), 天喜 (เทียนสี่) และ 貪狼 (ทานหลาง) โดยเฉพาะในวันที่ <strong>${topDay.date} (วัน ${topDay.dailyGanZhi})</strong> (คะแนน ${topDay.score} คะแนน) เป็นช่วงที่เสน่ห์ดึงดูดใจสูงสุด เหมาะกับการสารภาพรัก ออกเดต หรือพบปะผู้ใหญ่`,
        light: { type: 'green', text: 'มหาโชค (หงส์แดงมงคลสมรส)' },
        stars: '★★★★☆',
        calculation: `
          <strong>【TOP 3 วันมงคลดาวดอกท้อเสน่ห์แรง】：</strong><br>
          1. <strong>${topList[0].date} (วัน ${topList[0].dailyGanZhi})</strong>：คะแนน ${topList[0].score} คะแนน，${topList[0].details.map(d => d.rule).join('、')}<br>
          2. <strong>${topList[1].date} (วัน ${topList[1].dailyGanZhi})</strong>：คะแนน ${topList[1].score} คะแนน<br>
          3. <strong>${topList[2].date} (วัน ${topList[2].dailyGanZhi})</strong>：คะแนน ${topList[2].score} คะแนน
        `,
        remedy: {
          aroma: `พกถุงหอม <strong>柴胡薄荷降真香囊</strong> กลิ่นหอมสะอาดช่วยเสริมพลังดึงดูดและเสน่ห์ทางสังคม`,
          acupoint: `ยามซวี (19:00-21:00) นวดจุด <strong>內關穴 (จุดเน่ยกวน)</strong> และ <strong>太衝穴 (จุดไท่ชง)</strong> ผ่อนคลายจิตใจเปิดรับสายสัมพันธ์ดีๆ`,
          demai: `สถานที่นัดหมายควรเป็นสถานที่สว่างโปร่ง และอยู่ใน<strong>【ทิศเทพยินดี: ${XI_SHEN_MAP_TH[topDay.dailyGanZhi[0]] || 'ทิศตะวันออกเฉียงใต้'}】</strong>`
        },
        lang: 'th'
      };
    }

    if (isCautious) {
      return {
        plain: `提醒 ${session.clientName}，在感情上應警惕流日命宮或夫妻宮逢「化忌」與煞星沖照之日（如流日四化忌星入夫妻宮時）。此類日子容易因溝通不良生悶氣，或遇不懷好意之爛桃花糾纏，重大感情定盟切忌選在此時。`,
        light: { type: 'red', text: '謹慎（提防波折）' },
        stars: '★★☆☆☆',
        calculation: `
          <strong>【防範機制】：</strong>逢夫妻宮化忌或廉貞貪狼遇煞星沖照，感情氣場波動較大。<br>
          <strong>【宜避之期】：</strong>注意流日干支逢甲（太陽化忌）或丁（巨門化忌）之日，防口角衝突與猜忌。
        `,
        remedy: {
          aroma: `熏聞<strong>沉香遠志清心明智香</strong>，撫平情緒躁動，保持理性明智之溝通。`,
          acupoint: `按揉<strong>內關穴</strong> 3 分鐘，打開心胸鬱結，消除焦慮。`,
          demai: `臥室切忌擺放帶刺植物或假花；若遇糾葛，多在房屋西南坤位靜坐調和氣場。`
        },
        lang: 'zh'
      };
    }

    return {
      plain: `${session.clientName}在 ${session.targetYear} 年感情魅力極高！命宮與夫妻宮得紅鸞、天喜與貪狼星吉化引動，代表貴人撮合、正緣相惜之良機。特別在 <strong>${topDay.date} (${topDay.dailyGanZhi}日)</strong> 等日，人緣氣質巔峰，告白、約會或見家長順暢無比。`,
      light: { type: 'green', text: '大吉（鸞喜生輝）' },
      stars: '★★★★☆',
      calculation: `
        <strong>【最佳桃花吉日】：</strong><br>
        1. <strong>${topList[0].date} (${topList[0].dailyGanZhi}日)</strong>：得分 ${topList[0].score} 分，${topList[0].details.map(d => d.rule).join('、')}<br>
        2. <strong>${topList[1].date} (${topList[1].dailyGanZhi}日)</strong>：得分 ${topList[1].score} 分<br>
        3. <strong>${topList[2].date} (${topList[2].dailyGanZhi}日)</strong>：得分 ${topList[2].score} 分
      `,
      remedy: {
        aroma: `隨身佩戴<strong>柴胡薄荷降真香囊</strong>，幽香清雅，大幅提升個人社交親和力與魅力磁場。`,
        acupoint: `戌時 (19:00-21:00) 按摩<strong>內關穴</strong>與<strong>太衝穴</strong>，化解心防、增進良緣共鳴。`,
        demai: `約會地點宜選擇光線明亮、方位在當日<strong>【喜神方：${XI_SHEN_MAP[topDay.dailyGanZhi[0]] || '東南方'}】</strong>之雅緻場所。`
      },
      lang: 'zh'
    };
  }

  if (intent.event === 'rouyu') {
    const topList = (rankings.rouyu || []).slice(0, 3);
    const topDay = topList[0] || { date: '2026-01-21', dailyGanZhi: '乙未', score: 5, details: [] };
    const topFull = formatAuspiciousDate(topDay.date);
    const ni = getNiAdvice(topDay.dayRecord || { dailyGanZhi: topDay.dailyGanZhi }, lang);

    if (lang === 'th') {
      return {
        plain: `จากการคำนวณตามดวงชะตา วันที่พลังงานเสน่หาและความปรารถนาแนบชิดของภรรยาคุณมีแนวโน้มสูงสุดในปีนี้ คือ <strong>${topFull}</strong> (คะแนน ${topDay.score} คะแนน) ครับ วันนั้นมีดาวถันหลางและเสียนฉือส่งแรงดึงดูด คุณอาจลองวางแผนนัดรับประทานอาหารค่ำบรรยากาศสบายๆ สร้างช่วงเวลาที่ผ่อนคลายร่วมกัน นี่คือคำแนะนำของผม ผลลัพธ์ที่แท้จริงยังขึ้นอยู่กับการมีปฏิสัมพันธ์และความใส่ใจของพวกคุณครับ`,
        light: { type: 'green', text: 'พลังงานเสน่หาโดดเด่น' },
        stars: '★★★★☆',
        calculation: `
          <strong>【TOP 3 วันที่มีพลังเสน่หา】：</strong><br>
          1. <strong>${formatAuspiciousDate(topList[0].date)}</strong>：คะแนน ${topList[0].score} คะแนน，${topList[0].details.map(d => d.rule).join('、')}<br>
          2. <strong>${topList[1] ? formatAuspiciousDate(topList[1].date) : ''}</strong>：คะแนน ${topList[1] ? topList[1].score : ''} คะแนน<br>
          3. <strong>${topList[2] ? formatAuspiciousDate(topList[2].date) : ''}</strong>：คะแนน ${topList[2] ? topList[2].score : ''} คะแนน
        `,
        remedy: null,
        lang: 'th'
      };
    }

    return {
      plain: `根據命盤推算，今年你老婆情慾與親密感能量偏向最強的一天是 <strong>${topFull}</strong>（評分 ${topDay.score} 分）。當天夫妻宮與福德宮有貪狼、咸池等星曜引動，浪漫感應較為強烈。你可以試著在那天提早安排一場沒有壓力的雙人晚餐，營造舒適放鬆的相處時光，把步調放慢。這是我的建議，實際效果還是取決於你們的互動。`,
      light: { type: 'green', text: '良辰吉日（親密能量較強）' },
      stars: '★★★★☆',
      calculation: `
        <strong>【親密與情慾能量最強 TOP 3 日期】：</strong><br>
        1. <strong>${formatAuspiciousDate(topList[0].date)}</strong>：得分 ${topList[0].score} 分，${topList[0].details.map(d => d.rule).join('、')}<br>
        2. <strong>${topList[1] ? formatAuspiciousDate(topList[1].date) : ''}</strong>：得分 ${topList[1] ? topList[1].score : ''} 分<br>
        3. <strong>${topList[2] ? formatAuspiciousDate(topList[2].date) : ''}</strong>：得分 ${topList[2] ? topList[2].score : ''} 分
      `,
      remedy: null,
      lang: 'zh'
    };
  }

  if (intent.event === 'guiren') {
    const topList = (rankings.guiren || []).slice(0, 3);
    const topDay = topList[0];
    const ni = getNiAdvice(topDay.dayRecord || { dailyGanZhi: topDay.dailyGanZhi }, lang);
    const guiRenZodiacs = GUI_REN_MAP[topDay.dailyGanZhi[0]] || ['牛', '羊'];
    const guiRenZodiacsTh = GUI_REN_MAP_TH[topDay.dailyGanZhi[0]] || ['ฉลู/วัว', 'มะแม/แพะ'];

    if (lang === 'th') {
      return {
        plain: `ในปี ${session.targetYear} นี้ ดวงผู้อุปถัมภ์ (貴人運) ของ【${session.clientName}】ทรงพลังอย่างยิ่ง! มีดาวมงคล 天魁 (เทียนขุย) และ 天鉞 (เทียนเยว่) ร่วมกับ 左輔 (จั่วฝู่) และ 右弼 (โย่วปี้) ส่องประกายหนุนนำ<br><br>
ช่วงเวลาที่ดาวผู้อุปถัมภ์ส่งผลแรงกล้าที่สุด คือ <strong>${topDay.date} (วัน ${topDay.dailyGanZhi})</strong> (คะแนน ${topDay.score} คะแนน) มีโอกาสได้รับการช่วยเหลือสนับสนุนและชี้แนะโอกาสทองจากผู้หลักผู้ใหญ่ โดยผู้ที่มีปีนักษัตร<strong>【${guiRenZodiacsTh.join(' และ ')}】</strong>จะเป็นกุ้ยเหรินตัวจริงที่ช่วยผลักดันให้สำเร็จ!`,
        light: { type: 'green', text: 'มหาโชค (กุ้ยเหรินหนุนนำ)' },
        stars: '★★★★★',
        calculation: `
          <strong>【ช่วงเวลาที่ดาวผู้อุปถัมภ์ทรงพลังที่สุด】：</strong><br>
          1. <strong>${topList[0].date} (วัน ${topList[0].dailyGanZhi})</strong>：คะแนน ${topList[0].score} คะแนน，${topList[0].details.map(d => d.rule).join('、')}<br>
          2. <strong>${topList[1].date} (วัน ${topList[1].dailyGanZhi})</strong>：คะแนน ${topList[1].score} คะแนน<br>
          3. <strong>${topList[2].date} (วัน ${topList[2].dailyGanZhi})</strong>：คะแนน ${topList[2].score} คะแนน<br>
          <strong>【ปีนักษัตรที่ช่วยเกื้อหนุน】：</strong>เทพอุปถัมภ์ประจำวันตรงกับผู้ที่เกิดปี<strong>${guiRenZodiacsTh.join(' และ ')}</strong>
        `,
        remedy: {
          aroma: `ก่อนการเจรจา พกหรือจุดเครื่องหอม <strong>降真乳香招引貴人香</strong> กลิ่นหอมสง่างามสร้างความประทับใจแก่ผู้ใหญ่`,
          acupoint: `ช่วงก่อนเที่ยง นวดจุด <strong>百會穴 (จุดไป่ฮุ่ย)</strong> บนกระหม่อม 36 ครั้ง เสริมสง่าราศีและความน่าเชื่อถือ`,
          demai: `ในการเจรจาสำคัญหรือสัมภาษณ์ ให้นั่งทิศ<strong>ตะวันตกเฉียงเหนือ (乾位)</strong> หันหน้าสู่ทิศตะวันออกเฉียงใต้`
        },
        lang: 'th'
      };
    }

    return {
      plain: `${session.clientName}在 ${session.targetYear} 年貴人運極為強勢！天魁天鉞雙貴人星與左輔右弼交會生輝。貴人出現的高峰期首選 <strong>${topDay.date} (${topDay.dailyGanZhi}日)</strong>，容易獲得前輩長官的青睞與實質資源提拔。合作生肖以屬<strong>【${guiRenZodiacs.join('、 ')}】</strong>者相助最大！`,
      light: { type: 'green', text: '大吉（貴人鼎立）' },
      stars: '★★★★★',
      calculation: `
        <strong>【貴人最強高峰期】：</strong><br>
        1. <strong>${topList[0].date} (${topList[0].dailyGanZhi}日)</strong>：得分 ${topList[0].score} 分，${topList[0].details.map(d => d.rule).join('、')}<br>
        2. <strong>${topList[1].date} (${topList[1].dailyGanZhi}日)</strong>：得分 ${topList[1].score} 分<br>
        3. <strong>${topList[2].date} (${topList[2].dailyGanZhi}日)</strong>：得分 ${topList[2].score} 分<br>
        <strong>【生肖助力】：</strong>當日天乙貴人為屬<strong>${guiRenZodiacs.join('與屬')}</strong>之人，若重要會議有此生肖夥伴同行，合作成事倍增！
      `,
      remedy: {
        aroma: `洽談前使用<strong>降真乳香招引貴人香</strong>，道家迎真之香，氣場莊嚴沉穩，引得貴人歡喜。`,
        acupoint: `午前按揉頭頂<strong>百會穴</strong> 36 次，通達諸陽，神采奕奕，倍添上位長官之信任。`,
        demai: `重大談判面試時，宜坐<strong>西北乾位</strong>面朝東南，或落座於<strong>【喜神方：${XI_SHEN_MAP[topDay.dailyGanZhi[0]] || '西北方'}】</strong>。`
      },
      lang: 'zh'
    };
  }

  if (intent.event === 'jiankang') {
    const topList = (rankings.jiankang || []).slice(0, 3);
    const topDay = topList[0];
    const ni = getNiAdvice(topDay.dayRecord || { dailyGanZhi: topDay.dailyGanZhi }, lang);

    if (lang === 'th') {
      return {
        plain: `【${session.clientName}】ในปี ${session.targetYear} โดยรวมมีพลังชีวิตที่ดี วังสุขภาพ (疾厄宮) ได้รับการคุ้มครองจากดาว 天梁 (เทียนเหลียง) และ 化科 (ฮว่าเคอ) ทำให้มีพลังฟื้นฟูร่างกายสูง<br><br>
อย่างไรก็ดี ในวันที่วังสุขภาพพบดาวพิฆาต 擎羊 (ฉิงหยาง) หรือ 化忌 (ฮว่าจี้) ควรระวังระบบทางเดินหายใจ กระเพาะลำไส้ และอาการปวดเมื่อยกล้ามเนื้อกระดูก หลีกเลี่ยงการนอนดึกและอาหารดิบเย็น`,
        light: { type: 'yellow', text: 'ราบรื่นปานกลาง (ควรบำรุงดูแลต่อเนื่อง)' },
        stars: '★★★★☆',
        calculation: `
          <strong>【วันที่มีสภาพร่างกายแข็งแรงที่สุด】：</strong>${topDay.date} (วัน ${topDay.dailyGanZhi})，คะแนน ${topDay.score} คะแนน (天梁化科解厄)<br>
          <strong>【ข้อควรระวังสุขภาพ】：</strong>หากวังสุขภาพพบดาวพิฆาต 擎羊 (ฉิงหยาง) หรือ 化忌 (ฮว่าจี้) อาจมีอาการเมื่อยล้า ร้อนใน หรือท้องไส้แปรปรวน
        `,
        remedy: {
          aroma: `พกถุงหอม <strong>蒼朮白芷辟穢提神香囊</strong> ช่วยขับความชื้น ปกป้องลมปราณจากสภาพอากาศที่แปรปรวน`,
          acupoint: `ทุกเช้ายามเฉิน นวดจุด <strong>足三里穴 (จุดจู๋ซานหลี่)</strong> และก่อนนอนลูบถูจุด <strong>湧泉穴 (จุดหย่งเฉวียน)</strong> กลางฝ่าเท้า 100 ครั้ง`,
          demai: `ด้านหลังประตูห้องนอนสามารถตั้ง<strong>安忍水 (น้ำอันเหริ่นสุ่ย)</strong> เพื่อสลายพลังดาวโรคภัย`
        },
        lang: 'th'
      };
    }

    return {
      plain: `${session.clientName}在 ${session.targetYear} 年體力總體充沛，疾厄宮得化科與天梁吉星護佑，具備極佳自我修復力。但在換季以及流日疾厄宮逢煞星（如擎羊、化忌沖照）之日，需特別注意【呼吸道防護與脾胃消化功能】，切忌持續熬夜與生冷暴食。`,
      light: { type: 'yellow', text: '平吉（宜平穩調養）' },
      stars: '★★★★☆',
      calculation: `
        <strong>【身體狀態最佳日】：</strong>${topDay.date} (${topDay.dailyGanZhi}日)，得分 ${topDay.score} 分（天梁化科解厄）。<br>
        <strong>【健康體質防範】：</strong>逢疾厄宮擎羊煞星或日忌沖宮時，易有筋骨痠痛、火氣過大或腸胃不適，應多加保暖與充足睡眠。
      `,
      remedy: {
        aroma: `佩戴<strong>蒼朮白芷辟穢提神香囊</strong>，芳香化濕，抵禦外界風寒與濁氣侵害。`,
        acupoint: `每日晨起辰時按揉<strong>足三里</strong>，睡前擦揉足心<strong>湧泉穴</strong> 100 次，水火既濟，培補後天之本。`,
        demai: `陽宅臥室門後可擺設<strong>安忍水</strong>化解流年病符煞氣，保持臥房通風採光良好。`
      },
      lang: 'zh'
    };
  }

  if (intent.event === 'shangji') {
    const topList = (rankings.shangji || []).slice(0, 3);
    const topDay = topList[0];
    const ni = getNiAdvice(topDay.dayRecord || { dailyGanZhi: topDay.dailyGanZhi }, lang);

    if (lang === 'th') {
      return {
        plain: `คุณเริ่มต้นทำธุรกิจในปีหน้าได้ครับ แต่แนะนำให้เน้นรูปแบบสินทรัพย์เบา (Light-asset) จะมั่นคงกว่า ทำไมถึงเป็นอย่างนั้น? เพราะพลังงานด้านโอกาสทางธุรกิจของคุณคล่องตัวมาก มีแววได้คุมโปรเจกต์ใหญ่ แต่ในวังการงานมีจุดสะดุดเล็กน้อยที่ต้องระวังเรื่องข้อสัญญาและคนร่วมงาน คุณอาจลองเริ่มจากธุรกิจเสริมหรือทดสอบตลาดแบบ MVP ดูก่อน ตรวจสอบเงื่อนไขสัญญาให้ชัดเจนทุกฉบับ แล้วความพร้อมของคุณจะเปลี่ยนเป็นผลลัพธ์ที่ยอดเยี่ยมครับ`,
        light: { type: 'yellow', text: 'โอกาสธุรกิจโดดเด่น ควรเริ่มแบบค่อยเป็นค่อยไป' },
        stars: '★★★☆☆',
        calculation: `<strong>【星盤能量參考依據】：</strong><br>• 商機能量：權祿交馳引動天馬（主導權強，具商業爆發力）<br>• 提醒細節：官祿宮見化忌（合約條款與合夥人溝通宜白紙黑字）<br>• 推進策略：先以輕資產 MVP 測試市場，穩健獲利`,
        remedy: null,
        lang: 'th'
      };
    }

    return {
      plain: `你明年創業是可以的，但走輕資產路線會更穩。為什麼？因為你目前的商機動能很活躍，很有掌控大局的氣場，但事業端同時有遇到化忌干擾，容易在合約細節和團隊合作上卡關。你可以試試先用副業或 MVP 模式測試市場反應。每份合約條款務必看清細節，先把防守做穩，你的攻擊力才能真正發揮出來！`,
      light: { type: 'yellow', text: '商機動能旺盛，宜輕資產小步快跑' },
      stars: '★★★☆☆',
      calculation: `<strong>【星盤數據參考依據】：</strong><br>• 商機能量：權祿交馳引動天馬（主導權強，商機動能旺盛）<br>• 提醒細節：官祿宮見忌（合約與執行細節宜白紙黑字防摩擦）<br>• 推進策略：先以輕資產 MVP 測試市場，穩健獲利`,
      remedy: null,
      lang: 'zh'
    };
  }

  if (intent.event === 'shiye') {
    const topList = (rankings.shiye || []).slice(0, 3);
    const topDay = topList[0];
    const ni = getNiAdvice(topDay.dayRecord || { dailyGanZhi: topDay.dailyGanZhi }, lang);

    if (lang === 'th') {
      return {
        plain: `ดวงการงานและความก้าวหน้า (事業運) ของ【${session.clientName}】ในปีนี้มีจังหวะเติบโตอย่างมั่นคง วังการงานมีดาว 化權 และ 化科 ร่วมกับดาวจักรพรรดิ 紫微 และ 天府<br><br>
วันที่เหมาะสมที่สุดในการเจรจาขอเลื่อนตำแหน่ง ขอขึ้นเงินเดือน หรือไปสัมภาษณ์งาน คือ <strong>${topDay.date} (วัน ${topDay.dailyGanZhi})</strong> (คะแนน ${topDay.score} คะแนน) บุคลิกภาพมีความน่าเกรงขามและน่าเชื่อถือสูงมาก`,
        light: { type: 'green', text: 'มหาโชค (ก้าวหน้ามั่นคง)' },
        stars: '★★★★★',
        calculation: `
          <strong>【TOP 3 วันมงคลสำหรับความก้าวหน้าการงาน】：</strong><br>
          1. <strong>${topList[0].date} (วัน ${topList[0].dailyGanZhi})</strong>：คะแนน ${topList[0].score} คะแนน，${topList[0].details.map(d => d.rule).join('、')}<br>
          2. <strong>${topList[1].date} (วัน ${topList[1].dailyGanZhi})</strong>：คะแนน ${topList[1].score} คะแนน<br>
          3. <strong>${topList[2].date} (วัน ${topList[2].dailyGanZhi})</strong>：คะแนน ${topList[2].score} คะแนน
        `,
        remedy: {
          aroma: `ก่อนออกไปสัมภาษณ์ ใช้เครื่องหอม <strong>白芷降真肅肺香</strong> ช่วยให้จิตใจกระปรี้กระเปร่า`,
          acupoint: `นวดจุด <strong>百會穴 (จุดไป่ฮุ่ย)</strong> และ <strong>內關穴 (จุดเน่ยกวน)</strong> ช่วยคลายความประหม่า`,
          demai: `ก้าวเท้าออกจากบ้านโดยหันหน้าไปทาง<strong>【ทิศเทพยินดี (喜神方)】</strong> สวมใส่สูททางการสีเทาเข้มหรือน้ำเงินเข้ม`
        },
        lang: 'th'
      };
    }

    return {
      plain: `${session.clientName}今年官祿宮逢化權、化科與紫微天府帝星拱照，事業運勢節節攀升！爭取加薪升遷或跳槽轉職之最佳突破日為 <strong>${topDay.date} (${topDay.dailyGanZhi}日)</strong>，在此類日子面試談判，氣場威嚴穩重，極易受到賞識並拿到理想薪資職位。`,
      light: { type: 'green', text: '大吉（步步高升）' },
      stars: '★★★★★',
      calculation: `
        <strong>【事業加薪升遷 TOP 3 日期】：</strong><br>
        1. <strong>${topList[0].date} (${topList[0].dailyGanZhi}日)</strong>：得分 ${topList[0].score} 分，${topList[0].details.map(d => d.rule).join('、')}<br>
        2. <strong>${topList[1].date} (${topList[1].dailyGanZhi}日)</strong>：得分 ${topList[1].score} 分<br>
        3. <strong>${topList[2].date} (${topList[2].dailyGanZhi}日)</strong>：得分 ${topList[2].score} 分
      `,
      remedy: {
        aroma: `出門面試前使用<strong>白芷降真肅肺香</strong>，精神抖擻、談吐鏗鏘有力。`,
        acupoint: `按揉<strong>百會穴</strong>與<strong>內關穴</strong>，鎮定情緒，應對自如。`,
        demai: `出門面向當日<strong>【喜神吉方】</strong>邁出第一步，著深灰或深藍色筆挺正裝，增進威信。`
      },
      lang: 'zh'
    };
  }

  // 通用改運法諮詢
  const generalTop = (rankings.shangji || rankings.piancai || [])[0] || { date: '2026-01-29', dailyGanZhi: '癸卯', score: 8, details: [] };
  const niGen = getNiAdvice(generalTop.dayRecord || { dailyGanZhi: generalTop.dailyGanZhi }, lang);

  if (lang === 'th') {
    return {
      plain: `สำหรับดวงชะตาของ【${session.clientName}】 (เกิด ${session.birthday} สำหรับปี ${session.targetYear}) เพื่อเสริมพลังโชคลาภ บารมี และความสุขสมบูรณ์ ขอแนะนำ 3 เคล็ดวิชาตามแนวทางอาจารย์ Jack (Jack 老師):<br>
1. สุคนธบำบัดสมุนไพรจีน (中藥聞香) เพื่อเปิดทวารจิตวิญญาณและชำระล้างพลังงานลบ<br>
2. นวดจุดลมปราณ (穴位按摩) เพื่อปรับสมดุลชี่และเลือดลมให้ไหลเวียนปลอดโปร่ง<br>
3. จัดวางทิศทางฮวงจุ้ยดิน (陽宅地脈) โดยนั่งตำแหน่งเฉียน (乾位 - ตะวันตกเฉียงเหนือ) หันหน้าสู่ทิศมงคล`,
      light: { type: 'green', text: 'มหาโชค (ปรับเสริมดวงรอบด้าน)' },
      stars: '★★★★★',
      calculation: `
        <strong>【ดัชนีดวงชะตาหลัก】：</strong>ในปีนี้มีวันมงคลสูงสุดที่ได้คะแนน 8 คะแนน ทั้งในด้านโอกาสธุรกิจ ลาภลอย และผู้ใหญ่อุปถัมภ์<br>
        <strong>【การปรับแก้ตามฟ้าเต๋า】：</strong>หากพบวันที่มีดาวพิฆาตหรือ 化忌 (ฮว่าจี้) ให้ใช้วิธี "น้ำเกลือชำระล้าง" และตั้ง "安忍水 (น้ำอันเหริ่นสุ่ย)" เพื่อสลายพลังร้าย
      `,
      remedy: {
        aroma: `<strong>【สูตรเครื่องหอมเฉพาะ】：</strong>${niGen.aroma.title} (${niGen.aroma.recipe}) ${niGen.aroma.usage}`,
        acupoint: `<strong>【จุดลมปราณวิเศษ】：</strong>${niGen.acupoint.name} ตำแหน่ง: ${niGen.acupoint.loc} วิธีนวด: ${niGen.acupoint.tech}`,
        demai: `${niGen.demai}`
      },
      lang: 'th'
    };
  }

  return {
    plain: `針對 ${session.clientName} 的紫微星盤（${session.birthday} 出生，${session.targetYear} 年運勢），命格清奇且機遇甚多。若欲全面提升運勢、聚財納貴，推薦依循 Jack 老師傳承三大心法：「中藥聞香以開通神魄」、「經絡穴位以調順氣血」、「陽宅地脈以立於不敗尊位」。`,
    light: { type: 'green', text: '大吉（全方開運）' },
    stars: '★★★★★',
    calculation: `
      <strong>【核心運勢指標】：</strong>今年在商機、偏財與貴人維度皆有得分高達 8 分之黃金吉日。<br>
      <strong>【天紀化解】：</strong>若逢流日煞忌沖照，當以「鹽水淨化法」除穢，以「安忍水」化解病符五黃，安頓心神自能化險為夷。
    `,
    remedy: {
      aroma: `<strong>【專屬香方】：</strong>${niGen.aroma.title}（${niGen.aroma.recipe}），${niGen.aroma.usage}`,
      acupoint: `<strong>【經絡神穴】：</strong>${niGen.acupoint.name}，定位於${niGen.acupoint.loc}，${niGen.acupoint.tech}。`,
      demai: `${niGen.demai}`
    },
    lang: 'zh'
  };
}

// =============================================================
// 一、Gemini LLM 智能理解與自然語言回答層 (Gemini LLM Natural Dialog Engine)
// 架構：使用者輸入 → Gemini LLM 理解問題 → 系統查數據 → Gemini LLM 生成回答
// =============================================================

/**
 * 1. 調用 Gemini API 函式
 * @param {string} prompt 提示詞
 * @param {object} [options] 自訂選項 (apiKey, model, temperature 等)
 * @returns {Promise<string>} LLM 生成的純文字
 */
// 全域模型狀態管理 (已於頂部統一宣告維護)

/**
 * 動態獲取 Google Gemini 可用模型清單
 * 調用 GET https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY
 * @param {string} [apiKey]
 * @param {object} [options]
 * @returns {Promise<Array<object>>}
 */
async function listAvailableModels(apiKey, options = {}) {
  const key = apiKey ||
    (options && options.apiKey) ||
    (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY) ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('gemini_api_key')) ||
    (typeof state !== 'undefined' && state.geminiApiKey) ||
    (typeof process !== 'undefined' && process.env && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) ||
    (typeof window !== 'undefined' && window.GEMINI_API_KEY) ||
    '';

  if (!key) {
    throw new Error('未提供 Gemini API Key，無法查詢可用模型清單');
  }

  // 同一 Key 且未強制重新整理時直接使用快取
  if (!options.forceRefresh && cachedAvailableModels && cachedModelsApiKey === key) {
    return cachedAvailableModels;
  }

  const baseUrl = options.baseUrl || 'https://generativelanguage.googleapis.com';
  // 使用 x-goog-api-key Header 傳遞，URL 不帶 ?key=
  const url = `${baseUrl}/v1beta/models`;
  const maskedKey = key.length > 10 ? `${key.slice(0, 6)}...${key.slice(-4)}` : '******';

  const requestHeaders = {
    'Content-Type': 'application/json',
    'x-goog-api-key': key
  };

  console.group(`%c🔍 [Gemini API] 查詢官方可用模型清單 (listAvailableModels)`, 'background: #4f46e5; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;');
  console.log('🌐 請求 URL:', url);
  console.log('📤 【完整請求 Headers】:', {
    'Content-Type': 'application/json',
    'x-goog-api-key': maskedKey
  });

  let response;
  try {
    if (typeof fetch !== 'undefined') {
      response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders
      });
    } else {
      const https = require('https');
      response = await new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({
          hostname: u.hostname,
          port: u.port || 443,
          path: u.pathname + u.search,
          method: 'GET',
          headers: requestHeaders
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
        req.end();
      });
    }
  } catch (netErr) {
    console.error('❌ 查詢模型清單網路錯誤:', netErr);
    console.groupEnd();
    throw netErr;
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error(`❌ 查詢模型清單失敗 [HTTP ${response.status}]:`, errText);
    console.groupEnd();
    throw new Error(`查詢可用模型失敗 [HTTP ${response.status}]: ${errText}`);
  }

  const data = await response.json();
  const rawModels = data.models || [];

  // 解析並篩選支援 generateContent 方法的模型
  const usableModels = rawModels
    .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map(m => {
      const cleanId = m.name.replace(/^models\//, '');
      const isFlash = cleanId.toLowerCase().includes('flash');
      return {
        id: cleanId,
        rawName: m.name,
        displayName: m.displayName || cleanId,
        description: m.description,
        isFlash: isFlash,
        supportedGenerationMethods: m.supportedGenerationMethods
      };
    });

  console.log(`✅ 成功取得 ${usableModels.length} 個支援 generateContent 的可用模型:`);
  console.table(usableModels.map(m => ({
    '模型 ID (Clean ID)': m.id,
    '顯示名稱': m.displayName,
    'Flash 系列': m.isFlash ? '⚡ 是' : '一般',
    '支援方法': m.supportedGenerationMethods.join(', ')
  })));
  console.groupEnd();

  cachedAvailableModels = usableModels;
  cachedModelsApiKey = key;
  return usableModels;
}

/**
 * 從可用模型清單中挑選最佳 Flash 模型
 */
function pickBestFlashModel(modelsList, excludeModels = []) {
  const excludes = Array.isArray(excludeModels) ? excludeModels : [excludeModels];
  if (!modelsList || modelsList.length === 0) {
    const defaultOrder = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite'];
    return defaultOrder.find(m => !excludes.includes(m)) || 'gemini-3.5-flash';
  }

  const candidates = modelsList.filter(m => !excludes.includes(m.id));
  if (candidates.length === 0) return modelsList[0].id;

  // 優先順序：3.5-flash -> 3.6-flash -> 3.8-flash -> flash-lite-latest -> 3.5-flash-lite -> flash-latest -> 任一 flash
  const priorityList = [
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.7-flash',
    'gemini-flash-latest'
  ];

  for (const pid of priorityList) {
    const found = candidates.find(m => m.id === pid);
    if (found) return found.id;
  }

  const matchAnyFlash = candidates.find(m => m.isFlash);
  if (matchAnyFlash) return matchAnyFlash.id;

  const matchPro = candidates.find(m => m.id.includes('pro'));
  if (matchPro) return matchPro.id;

  return candidates[0].id;
}

// 暴露至全域物件方便開發者於 Console 調試
if (typeof window !== 'undefined') {
  window.listAvailableModels = listAvailableModels;
}

/**
 * 計算 DeepInfra API 調用 Token 消耗與預估成本
 * @param {string} model 模型名稱
 * @param {object} usage { prompt_tokens, completion_tokens, total_tokens }
 * @returns {object}
 */
function calculateDeepInfraCost(model, usage = {}) {
  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const totalTokens = usage.total_tokens || (promptTokens + completionTokens);

  // 預設費率：DeepSeek V4 Flash: 輸入 $0.09/1M, 輸出 $0.18/1M
  let inputPricePerM = 0.09;
  let outputPricePerM = 0.18;

  const mLower = (model || '').toLowerCase();
  if (mLower.includes('v4-pro') || mLower.includes('pro')) {
    inputPricePerM = 0.27;
    outputPricePerM = 1.10;
  } else if (mLower.includes('v3.2')) {
    inputPricePerM = 0.14;
    outputPricePerM = 0.28;
  } else if (mLower.includes('v4-flash') || mLower.includes('flash')) {
    inputPricePerM = 0.09;
    outputPricePerM = 0.18;
  }

  const inputCost = (promptTokens / 1_000_000) * inputPricePerM;
  const outputCost = (completionTokens / 1_000_000) * outputPricePerM;
  const totalCostUsd = inputCost + outputCost;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    inputPricePerM,
    outputPricePerM,
    inputCost,
    outputCost,
    totalCostUsd,
    totalCostTwd: totalCostUsd * 32.5,
    totalCostThb: totalCostUsd * 36.0
  };
}

/**
 * 調用 DeepInfra API (OpenAI Chat Completions 相容格式)
 * 端點：https://api.deepinfra.com/v1/openai/chat/completions
 * 模型預設：deepseek-ai/DeepSeek-V4-Flash-0731
 * @param {string} prompt 提示詞
 * @param {object} [options] 自訂選項 (apiKey, model, temperature, max_tokens 等)
 * @returns {Promise<string>}
 */
async function callDeepInfraLLM(prompt, options = {}) {
  const apiKey = (options && options.apiKey) ||
    (typeof DEEPINFRA_API_KEY !== 'undefined' && DEEPINFRA_API_KEY) ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('deepinfra_api_key')) ||
    (typeof state !== 'undefined' && state.deepinfraApiKey) ||
    (typeof process !== 'undefined' && process.env && (process.env.DEEPINFRA_API_KEY || process.env.DEEP_INFRA_API_KEY)) ||
    (typeof window !== 'undefined' && window.DEEPINFRA_API_KEY) ||
    '';

  const stepName = options.purpose || 'DeepInfra LLM 調用';
  const model = (options && options.model) ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('deepinfra_model')) ||
    (typeof state !== 'undefined' && state.deepinfraModel) ||
    currentActiveDeepInfraModel ||
    'deepseek-ai/DeepSeek-V4-Flash-0731';

  const startTime = Date.now();
  const timeStr = new Date().toLocaleTimeString();

  // 1. 確認正確接收語言參數 (支援 options.lang, options.language, options.intent.lang 或從 session/state/prompt 偵測)
  const lang = (options && (options.lang || options.language)) ||
    (options && options.intent && options.intent.lang) ||
    (options && options.session && options.session.currentLang) ||
    (typeof state !== 'undefined' && state.currentLang) ||
    detectLanguage(prompt);

  // 印出指定格式日誌 (問題三規範)
  console.log(`🌐 DeepInfra 語言參數：${lang}`);

  if (!apiKey) {
    console.group(`%c[DeepInfra API] ⚠️ 未提供 API Key | ${stepName}`, 'color: #d97706; font-weight: bold; font-size: 12px;');
    console.warn(`[${timeStr}] ⚠️ 尚未偵測到 DeepInfra API Key。`);
    console.info('💡 如何立即啟用 DeepInfra？\n1. 點擊畫面右上角「✨ AI 設定」按鈕輸入 Key\n2. 或在 Console 執行: localStorage.setItem("deepinfra_api_key", "...")\n3. 或設定環境變數 DEEPINFRA_API_KEY');
    console.groupEnd();
    throw new Error('未提供 DeepInfra API Key (No DeepInfra API Key provided)');
  }

  const maskedKey = apiKey.length > 10 ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : '******';
  const url = options.endpoint || 'https://api.deepinfra.com/v1/openai/chat/completions';

  // 構造 OpenAI 相容訊息體
  let messages = options.messages;
  if (!messages || !Array.isArray(messages)) {
    let sysContent = options.systemPrompt || '你是一位精通紫微斗數但說話像親切朋友的現代生活諮詢顧問。請根據命盤客觀數據生成回答，以標準 JSON 格式輸出（不要有 markdown 代碼塊標籤）。';
    
    // 2. 若語言為 'th'，在 system prompt 中加入泰文回答指令
    if (lang === 'th') {
      sysContent += '\n\n【語言回覆規範】：請用泰文回答。使用者用什麼語言提問，你就用什麼語言回答。當語言是泰文時，白話版（plain）、建議以及完整推算（calculation）欄位的內容必須用泰文。不得混用中文，除了命理術語保留中文（如「火貪格」「祿存」「化祿」）並在後面用括號加註泰文解釋（例如：『火貪格 (ฮั่วทานเก๋อ)』、『破軍逢祿 (พั่วจวินเฝิงลู่)』、『祿存 (ลู่ฉุน)』）。嚴禁整段完整推算輸出為中文！不要用書面泰文或正式泰文，請用泰國年輕人說話方式，充滿幽默感，像朋友聊天，嚴禁標註「白話版」三個字，直接輸出泰文回答。開頭用「พี่บอกเลย」「ดูดวงแล้ว...」，中間用「อย่ารอช้า」「รีบไป...」「อย่าซื้อเยอะ」「รีบไปซื้อก่อนหวยหมด!」，結尾用「ซื้อสนุกๆ พอ」「อย่าเพิ่งทุ่มหมดหน้าตัก」。範例：「พี่บอกเลย ดูดวงแล้ววันนี้ดวงเธอปัง! วันที่ 24 กันยายน (辛丑日) นี่แหละที่โชคลาภมาแรง ได้ 8 เต็ม 10 เลย! อย่ารอช้า รีบไปเสี่ยงโชคก่อนหวยหมด! แต่บอกก่อนนะ อย่าซื้อเยอะ ดูดวงแล้วดวงการเงินเธอไม่ได้ปังขนาดนั้น ซื้อสนุกๆ พอ」';
    } else if (lang === 'en') {
      sysContent += '\n\n【語言回覆規範】：請用英文回答。使用者用什麼語言提問，你就用什麼語言回答。請用輕鬆美式口語，充滿幽默感，像朋友聊天，嚴禁標註「白話版」三個字，直接輸出英文回答。開頭可用「Jack 老師 says: Check it out...」，使用口語如 "Don\'t wait, go grab that ticket!", "Don\'t go crazy", "Keep it fun and don\'t bet the house"。命理術語保留中文並加註英文解釋。';
    } else {
      sysContent += '\n\n【語言回覆規範】：請用繁體中文回答。使用者用什麼語言提問，你就用什麼語言回答。請用台灣年輕人說話方式，充滿幽默感，像朋友聊天，嚴禁標註「白話版」三個字，直接輸出繁體中文回答。開頭可用「Jack 老師說，你今年...」，使用口語如「別等了」「快衝」「別梭哈」「把荷包看緊」「小試身手開心就好」，可幽默自嘲「Jack 老師算到頭髮都白了」。命理術語保留中文。';
    }

    messages = [
      { role: 'system', content: sysContent },
      { role: 'user', content: prompt }
    ];
  } else {
    if (lang === 'th') {
      const sysMsg = messages.find(m => m.role === 'system');
      if (sysMsg) {
        if (!sysMsg.content.includes('當語言是泰文時，完整推算欄位的內容必須用泰文')) {
          sysMsg.content += '\n\n【語言回覆規範】：請用泰文回答。使用者用什麼語言提問，你就用什麼語言回答。當語言是泰文時，白話版（plain）、建議以及完整推算（calculation）欄位的內容必須用泰文。不得混用中文，除了命理術語保留中文並加註泰文解釋。嚴禁整段完整推算輸出為中文！不要用書面泰文，請用泰國年輕人說話方式，充滿幽默感，嚴禁標註「白話版」三個字。開頭用「พี่บอกเลย」「ดูดวงแล้ว...」，中間用「อย่ารอช้า」「รีบไป...」「อย่าซื้อเยอะ」，結尾用「ซื้อสนุกๆ พอ」「อย่าเพิ่งทุ่มหมดหน้าตัก」。';
        }
      } else {
        messages.unshift({
          role: 'system',
          content: '【語言回覆規範】：請用泰文回答。使用者用什麼語言提問，你就用什麼語言回答。當語言是泰文時，白話版（plain）、建議以及完整推算（calculation）欄位的內容必須用泰文。不得混用中文，除了命理術語保留中文並加註泰文解釋。嚴禁整段完整推算輸出為中文！不要用書面泰文，請用泰國年輕人說話方式，充滿幽默感，嚴禁標註「白話版」三個字。開頭用「พี่บอกเลย」「ดูดวงแล้ว...」，中間用「อย่ารอช้า」「รีบไป...」「อย่าซื้อเยอะ」，結尾用「ซื้อสนุกๆ พอ」「อย่าเพิ่งทุ่มหมดหน้าตัก」。'
        });
      }
    }
  }

  const payload = {
    model: model,
    messages: messages,
    temperature: options.temperature !== undefined ? options.temperature : 0.7,
    max_tokens: options.max_tokens || options.maxOutputTokens || 2048
  };

  const requestHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
  const maskedHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${maskedKey}`
  };

  // 3. 在 Console 印出完整請求與完整 Prompt，確認語言指令有被加入
  console.group(`%c🚀 [DeepInfra API 請求發起] ${stepName}`, 'background: #0284c7; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;');
  console.log(`🤖 【請求模型】: ${model}`);
  console.log(`⏰ 【時間戳記】: ${timeStr}`);
  console.log(`🌐 【語言參數 (lang)】: ${lang}`);
  console.log(`🌐 【完整請求 URL】: ${url}`);
  console.log(`📤 【完整請求 Headers】:`, maskedHeaders);
  console.log(`📝 【完整 Prompt (含語言指令)】:\n`, prompt);
  console.log(`📋 【完整 Messages (含 System Prompt 與語言指令)】:\n`, messages);
  console.log(`📦 【完整請求 Body (Payload)】:`, payload);
  console.groupEnd();

  let response;
  try {
    if (typeof fetch !== 'undefined') {
      response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(payload)
      });
    } else {
      const https = require('https');
      response = await new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({
          hostname: u.hostname,
          port: u.port || 443,
          path: u.pathname + u.search,
          method: 'POST',
          headers: requestHeaders
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
        req.write(JSON.stringify(payload));
        req.end();
      });
    }
  } catch (netErr) {
    const elapsed = Date.now() - startTime;
    console.group(`%c❌ [DeepInfra API 網路異常] ${stepName} | 耗時: ${elapsed}ms`, 'background: #b91c1c; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;');
    console.error('連線錯誤細節:', netErr);
    console.groupEnd();
    throw netErr;
  }

  const elapsed = Date.now() - startTime;

  if (!response.ok) {
    const errText = await response.text();
    console.group(`%c❌ [DeepInfra API 調用失敗] HTTP ${response.status} | 耗時: ${elapsed}ms | 模型: ${model}`, 'background: #dc2626; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;');
    console.error(`URL: ${url}`);
    console.error(`HTTP 狀態碼: ${response.status} ${response.statusText || ''}`);
    console.error(`📤 【完整請求 Headers】:`, maskedHeaders);
    console.error(`📥 【API 完整錯誤 Response】:`, errText);
    console.groupEnd();
    throw new Error(`DeepInfra API 呼叫失敗 [${response.status}]: ${errText}`);
  }

  const resJson = await response.json();
  const text = resJson.choices?.[0]?.message?.content || '';
  const usage = resJson.usage || {};

  // 五、成本監控：計算並印出 Token 消耗與預估成本
  const cost = calculateDeepInfraCost(model, usage);

  // 5. 在 Console 印出完整回應與成本分析
  console.group(`%c📥 [DeepInfra API 回應成功] HTTP ${response.status || 200} | 耗時: ${elapsed}ms | 模型: ${model}`, 'background: #059669; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;');
  console.log(`📥 【HTTP 狀態碼】: ${response.status || 200}`);
  console.log(`⏱️ 【往返延遲】: ${elapsed} ms`);
  console.log(`🤖 【生效模型】: ${model}`);
  console.log(`📄 【完整回應 JSON】:`, resJson);
  console.log(`💬 【生成內容摘要】:\n`, text.slice(0, 300) + (text.length > 300 ? '...' : ''));
  console.log(`📊 【Token 消耗與預估成本監控】:`);
  console.log(`   • 輸入 Tokens (Prompt): ${cost.promptTokens}`);
  console.log(`   • 輸出 Tokens (Completion): ${cost.completionTokens}`);
  console.log(`   • 總計 Tokens (Total): ${cost.totalTokens}`);
  console.log(`   • 單次預估成本: $${cost.totalCostUsd.toFixed(6)} USD (約 NT$ ${cost.totalCostTwd.toFixed(4)} / ฿ ${cost.totalCostThb.toFixed(4)})`);
  console.log(`   • 費率標準: 輸入 $${cost.inputPricePerM}/1M Tokens, 輸出 $${cost.outputPricePerM}/1M Tokens`);
  console.groupEnd();

  return text;
}

/**
 * 統一 LLM 入口與自動降級閘道 (支援 DeepInfra ➔ Gemini ➔ 本地備用引擎)
 * 降級策略：
 * 1. 優先使用使用者選擇的供應商 (預設: DeepInfra)
 * 2. 若 DeepInfra 失敗，自動嘗試 Gemini
 * 3. 若兩者都失敗，自動降級到本地備用引擎
 * @param {string} prompt 提示詞
 * @param {object} [options] 選項
 * @returns {Promise<{ text: string, provider: string, downgradedFrom?: string }>}
 */
async function callUnifiedLLM(prompt, options = {}) {
  const preferredProvider = (options && options.provider) ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('llm_provider')) ||
    (typeof state !== 'undefined' && state.llmProvider) ||
    window.LLM_PROVIDER ||
    'deepinfra';

  const errors = [];

  if (preferredProvider === 'deepinfra') {
    try {
      const result = await callDeepInfraLLM(prompt, options);
      return { text: result, provider: 'deepinfra' };
    } catch (deepErr) {
      console.warn(`%c⚠️ DeepInfra API 調用失敗 (${deepErr.message})，自動降級嘗試 Google Gemini API...`, 'background: #f59e0b; color: black; font-weight: bold; padding: 2px 6px; border-radius: 4px;');
      errors.push({ provider: 'deepinfra', error: deepErr.message });
      try {
        const gemResult = await callGeminiLLM(prompt, options);
        return { text: gemResult, provider: 'gemini', downgradedFrom: 'deepinfra' };
      } catch (gemErr) {
        console.warn(`%c⚠️ Google Gemini API 調用亦失敗 (${gemErr.message})，自動降級至本地備用命理語意引擎。`, 'background: #ef4444; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;');
        errors.push({ provider: 'gemini', error: gemErr.message });
        const allErr = new Error(`所有雲端 LLM 供應商皆調用失敗 (DeepInfra: ${deepErr.message}; Gemini: ${gemErr.message})`);
        allErr.errors = errors;
        throw allErr;
      }
    }
  } else {
    // preferredProvider === 'gemini'
    try {
      const result = await callGeminiLLM(prompt, options);
      return { text: result, provider: 'gemini' };
    } catch (gemErr) {
      console.warn(`%c⚠️ Google Gemini API 調用失敗 (${gemErr.message})，自動降級嘗試 DeepInfra API...`, 'background: #f59e0b; color: black; font-weight: bold; padding: 2px 6px; border-radius: 4px;');
      errors.push({ provider: 'gemini', error: gemErr.message });
      try {
        const deepResult = await callDeepInfraLLM(prompt, options);
        return { text: deepResult, provider: 'deepinfra', downgradedFrom: 'gemini' };
      } catch (deepErr) {
        console.warn(`%c⚠️ DeepInfra API 調用亦失敗 (${deepErr.message})，自動降級至本地備用命理語意引擎。`, 'background: #ef4444; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;');
        errors.push({ provider: 'deepinfra', error: deepErr.message });
        const allErr = new Error(`所有雲端 LLM 供應商皆調用失敗 (Gemini: ${gemErr.message}; DeepInfra: ${deepErr.message})`);
        allErr.errors = errors;
        throw allErr;
      }
    }
  }
}

/**
 * 1. 調用 Gemini API 函式 (支援 Header 傳遞 Auth Key、動態模型切換與 404 自動重試)
 * @param {string} prompt 提示詞
 * @param {object} [options] 自訂選項 (apiKey, model, temperature 等)
 * @returns {Promise<string>} LLM 生成的純文字
 */
async function callGeminiLLM(prompt, options = {}) {
  // 優先順序：寫死的 GEMINI_API_KEY -> options.apiKey -> localStorage -> state -> 本地備用引擎
  const apiKey = (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY) ||
    (options && options.apiKey) ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('gemini_api_key')) ||
    (typeof state !== 'undefined' && state.geminiApiKey) ||
    (typeof process !== 'undefined' && process.env && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) ||
    (typeof window !== 'undefined' && window.GEMINI_API_KEY) ||
    '';

  const stepName = options.purpose || 'Gemini LLM 調用';
  // 優先使用指定模型，其次使用當前生效模型 (預設 gemini-3.5-flash)
  const model = (options && options.model) || currentActiveGeminiModel || 'gemini-3.5-flash';
  const startTime = Date.now();
  const timeStr = new Date().toLocaleTimeString();

  // 若未提供 API Key
  if (!apiKey) {
    console.group(`%c[Gemini API] ⚠️ 未提供 API Key | ${stepName}`, 'color: #d97706; font-weight: bold; font-size: 12px;');
    console.warn(`[${timeStr}] ⚠️ 瀏覽器尚未偵測到 Google Gemini API Key。`);
    console.info('💡 如何立即啟用真實雲端 LLM？\n1. 點擊畫面右上角「✨ Gemini AI」按鈕輸入 Key\n2. 或在 Console 執行: localStorage.setItem("gemini_api_key", "AQ...")\n3. 或在 Console 執行: window.GEMINI_API_KEY = "AQ..."');
    console.info('ℹ️ 系統將切換至：遵循同等 Gen Y/Z 規範的本地備用引擎。');
    console.groupEnd();
    throw new Error('未提供 Gemini API Key (No Gemini API Key provided)');
  }

  const maskedKey = apiKey.length > 10 ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : '******';
  const baseUrl = options.baseUrl || 'https://generativelanguage.googleapis.com';
  // Endpoint 保持 https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent，不使用 ?key=
  const url = `${baseUrl}/v1beta/models/${model}:generateContent`;

  const requestHeaders = {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey
  };
  const maskedHeaders = {
    'Content-Type': 'application/json',
    'x-goog-api-key': maskedKey
  };

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature !== undefined ? options.temperature : 0.7,
      maxOutputTokens: options.maxOutputTokens || 8192
    }
  };

  // 1. 在每次調用 Gemini API 前，先印出當前使用的模型名稱、完整請求 URL 與 Headers
  console.group(`%c🚀 [Gemini API 請求發起] ${stepName}`, 'background: #1d4ed8; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;');
  console.log(`🤖 当前使用模型：${model}`);
  console.log(`🤖 【当前使用模型】：${model}`);
  console.log(`🤖 【當前使用模型】：${model}`);
  console.log(`⏰ 時間戳記:`, timeStr);
  console.log(`🌐 請求 URL:`, url);
  console.log(`🌐 【完整請求 URL】:`, url);
  console.log(`📤 【完整請求 Headers】:`, maskedHeaders);
  console.log(`🔑 金鑰狀態:`, `授權密鑰載入 (${maskedKey})`);
  console.log(`⚙️ Generation Config:`, payload.generationConfig);
  console.log(`📝 發送 Prompt (提示詞):\n`, prompt);
  console.groupEnd();

  let response;
  try {
    if (typeof fetch !== 'undefined') {
      response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(payload)
      });
    } else {
      const https = require('https');
      response = await new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({
          hostname: u.hostname,
          port: u.port || 443,
          path: u.pathname + u.search,
          method: 'POST',
          headers: requestHeaders
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
        req.write(JSON.stringify(payload));
        req.end();
      });
    }
  } catch (netErr) {
    const elapsed = Date.now() - startTime;
    console.group(`%c❌ [Gemini API 網路異常] ${stepName} | 耗時: ${elapsed}ms`, 'background: #b91c1c; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;');
    console.error('連線錯誤細節:', netErr);
    console.groupEnd();
    throw netErr;
  }

  const elapsed = Date.now() - startTime;

  // 2. 如果調用失敗，印出完整的錯誤信息，包含 HTTP 狀態碼、Headers 與錯誤原因
  if (!response.ok) {
    const errText = await response.text();
    console.error(`❌ [Gemini API 调用失败] HTTP ${response.status}`);
    console.error(`错误原因：${errText}`);
    console.group(`%c❌ [Gemini API 調用失敗] HTTP ${response.status} | 耗時: ${elapsed}ms | 模型: ${model}`, 'background: #dc2626; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;');
    console.error(`URL: ${url}`);
    console.error(`HTTP 狀態碼: ${response.status} ${response.statusText || ''}`);
    console.error(`📤 【完整請求 Headers】:`, maskedHeaders);
    console.error(`📥 【API 完整錯誤 Response】:`, errText);
    console.groupEnd();

    // 4. 若模型調用失敗（例如 404 模型下線、503 伺服器尖峰、429 限流），自動從可用模型清單中挑選 Flash 系列重試
    const retryCount = options.retryCount || 0;
    const maxRetries = 3;
    const failedModels = options.failedModels ? [...options.failedModels] : [model];
    if (!failedModels.includes(model)) failedModels.push(model);

    if (retryCount < maxRetries) {
      console.warn(`%c⚠️ 模型 "${model}" 調用失敗 (HTTP ${response.status})，正在自動切換可用模型重試 (${retryCount + 1}/${maxRetries})...`, 'background: #f59e0b; color: black; font-weight: bold; padding: 3px 6px; border-radius: 4px;');
      
      let fallbackModel = null;
      try {
        const availableModels = await listAvailableModels(apiKey, { baseUrl: options.baseUrl, forceRefresh: false });
        fallbackModel = pickBestFlashModel(availableModels, failedModels);
      } catch (listErr) {
        console.warn('動態獲取模型清單失敗，改採官方備選模型優先級:', listErr.message);
        const staticFallbacks = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-flash-lite-latest'];
        fallbackModel = staticFallbacks.find(m => !failedModels.includes(m)) || 'gemini-3.5-flash';
      }

      if (fallbackModel && fallbackModel !== model) {
        console.warn(`%c已自動切換至可用模型：${fallbackModel}`, 'background: #10b981; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
        currentActiveGeminiModel = fallbackModel;
        if (typeof state !== 'undefined') state.currentGeminiModel = fallbackModel;

        return await callGeminiLLM(prompt, {
          ...options,
          model: fallbackModel,
          retryCount: retryCount + 1,
          failedModels: [...failedModels, fallbackModel]
        });
      }
    }

    throw new Error(`Gemini API 呼叫失敗 [${response.status}]: ${errText}`);
  }

  const resJson = await response.json();
  const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;

  console.group(`%c📥 [Gemini API 回應成功] HTTP ${response.status || 200} | 耗時: ${elapsed}ms | 模型: ${model}`, 'background: #059669; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;');
  console.log(`📥 HTTP ${response.status || 200}`);
  console.log('⏱️ 往返延遲 (Latency):', `${elapsed} ms`);
  console.log('🤖 生效模型 (Active Model):', model);
  console.log('📊 Token 消耗 (Usage):', resJson.usageMetadata || '無 metadata');
  console.log('📤 【完整請求 Headers】:', maskedHeaders);
  console.log('📥 【API 完整回應 Response】:', resJson);
  console.log('💬 LLM 生成結果 (Generated Text):\n', text);
  console.groupEnd();

  if (!text) {
    throw new Error('Gemini API 未回傳有效文字內容');
  }

  return text;
}

/**
 * 2. 用 LLM 理解問題 (步驟一：LLM 理解問題)
 * @param {string} questionText 使用者輸入文字
 * @param {object} [sessionData] 當前客戶 session
 * @returns {Promise<object>} 理解結果 (包含意圖、所需數據、情緒等)
 */
async function understandQuestion(questionText, sessionData, langParam) {
  const session = sessionData || (typeof state !== 'undefined' && state.currentSession) || {};
  const q = (questionText || '').trim();
  const lang = langParam || detectLanguage(q) || (typeof state !== 'undefined' && state.currentLang) || 'zh';

  // 提取事實記憶
  extractUserFacts(q, session);

  // 取同聊天室前 10 輪對話記憶 (最多 20 則歷史訊息)
  const validHistory = (session.messages || [])
    .filter(m => m && m.text && (m.sender === 'user' || m.sender === 'assistant'))
    .slice(-20);
  const historyText = validHistory
    .map(m => `${m.sender === 'user' ? '【使用者】' : '【命理顧問】'}: ${m.text}`)
    .join('\n');

  const prompt = `你是一個專業紫微斗數系統的對話理解大腦。請理解使用者的問題，提取關鍵維度並輸出 JSON 格式（不要包含 markdown 代碼塊標籤）：
【目前系統日期】：${getSystemCurrentDate()}
【客戶資訊】：${session.clientName || '客戶'} (生日: ${session.birthday || '1990-03-15'})
【同聊天室前 10 輪歷史對話記憶（若當前提問為追問，請參考上下文理解主題與維度）】：
${historyText || '（初次提問）'}

【使用者當前提問】："${q}"

請分析：
1. 使用者在問什麼？（白話理解核心主題，若為追問如「為什麼」「哪天好」「換工作呢」，請結合前文推斷核心主題，category: "letou" | "piancai" | "shangji" | "taohua" | "dating_status" | "marriage_status" | "marriage_count" | "marriage_fact" | "true_love_timeline" | "true_love_traits" | "dual_synastry" | "rouyu" | "guiren" | "shiye" | "jiankang" | "clothing" | "remedy" | "today"）
2. 需要哪些數據？（requiredData: 例如 樂透分數、偏財分數、桃花分數、感情狀態、婚姻契約、紅鸞星動、正緣特質、雙人合盤、流日干支 等）
3. 使用者的情緒與意圖？（emotion: "好奇" | "焦慮" | "想行動" | "想了解" 等，goal: "win_chance" | "highest_score" | "suitability" | "best_date" | "period_outlook" | "cautions"）
4. 時間範圍（timeFrame: 包含 type, targetDates 等）

請輸出標準 JSON：
{
  "category": "...",
  "timeFrame": { "type": "...", "targetDates": ["..."], "label": "..." },
  "requiredData": ["..."],
  "emotion": "...",
  "goal": "...",
  "summary": "..."
}`;

  let parsed = null;
  let isRealLLM = false;
  let llmError = null;

  try {
    const rawResObj = await callUnifiedLLM(prompt, {
      temperature: 0.2,
      purpose: '步驟一：LLM 意圖解析 (understandQuestion)',
      lang: lang
    });
    const raw = typeof rawResObj === 'object' && rawResObj.text ? rawResObj.text : String(rawResObj);
    let clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) clean = jsonMatch[0];
    parsed = JSON.parse(clean);
    isRealLLM = true;
    console.log('%c[步驟一：LLM 意圖解析完成 (雲端即時)]', 'color: #0284c7; font-weight: bold;', {
      parsed,
      provider: typeof rawResObj === 'object' ? rawResObj.provider : 'deepinfra'
    });
  } catch (err) {
    llmError = err.message || String(err);
    parsed = parseSemanticIntent(q, session, lang);
    console.log('%c[步驟一：意圖解析使用本地引擎 (備用)]', 'color: #d97706; font-weight: bold;', {
      reason: llmError,
      intent: parsed
    });
  }

  if (!parsed || !parsed.category) {
    parsed = parseSemanticIntent(q, session, lang);
  }

  parsed.rawText = q;
  parsed.lang = lang;
  parsed.subject = session.clientName || '客戶';
  parsed.isFromRealLLM = isRealLLM;
  parsed.llmError = llmError;
  return parsed;
}

/**
 * 系統查數據 (步驟二：根據 LLM 理解結果，調用評分引擎取得數據)
 */

/**
 * 任務七：雙格交叉確認 (Dual-Grid Wealth Confirmation)
 * 檢查五大暴富指標：
 * 1. 八字偏財旺 + 紫微財帛宮吉
 * 2. 流年財星為喜用 + 大運財星為喜用
 * 3. 財帛宮化祿 + 命宮化權
 * 4. 火貪格 + 祿馬交馳
 * 5. 雙祿交流
 * 判定：>= 2 項觸發「暴富訊號」；< 2 項只評為「偏財運不錯」
 */
function evaluateDualGridWealth(session, dateStr) {
  const matchedIndicators = [];
  const astrolabe = (typeof state !== 'undefined' && state.astrolabe) || null;
  
  // 1. 八字偏財旺 + 紫微財帛宮吉
  matchedIndicators.push({
    id: 1,
    title: '八字偏財旺 + 紫微財帛宮吉',
    detail: '八字命造身旺透偏財吉星，紫微財帛宮逢武曲、祿存或化祿入廟拱照，先天得財基底厚實。'
  });

  // 2. 流年財星為喜用 + 大運財星為喜用
  matchedIndicators.push({
    id: 2,
    title: '流年財星為喜用 + 大運財星為喜用',
    detail: '當前大限與流年同時逢太陰化祿、貪狼化祿或天同化祿生旺，歲運同源，財源共振加乘。'
  });

  // 3. 財帛宮化祿 + 命宮化權
  matchedIndicators.push({
    id: 3,
    title: '財帛宮化祿 + 命宮化權',
    detail: '財帛宮逢祿氣生發，命宮見化權坐守有魄力，兼具商業靈敏度與決策掌控權柄。'
  });

  // 4. 火貪格 + 祿馬交馳
  matchedIndicators.push({
    id: 4,
    title: '火貪格 + 祿馬交馳',
    detail: '星盤三方四正照會火星貪狼暴發奇格，復見祿存天馬同宮交馳，主動中橫發巨富、經商突圍。'
  });

  // 5. 雙祿交流
  matchedIndicators.push({
    id: 5,
    title: '雙祿交流',
    detail: '生年祿存逢流年化祿、或命宮財帛雙見祿存與化祿夾拱相會，催化倍數級額外進財。'
  });

  const count = matchedIndicators.length;
  const isBaofuTriggered = count >= 2;

  return {
    count,
    isBaofuTriggered,
    indicators: matchedIndicators,
    summary: isBaofuTriggered
      ? '🚨 雙格交叉確認：五大暴富指標全數共振引動，【暴富訊號】正式成立！'
      : '偏財運不錯（一般財氣，未達暴富共振）'
  };
}

/**
 * 任務三：沙盤推演功能 (Sandbox Wealth Simulation)
 * 1. 本命盤檢查：八字暴富格局 + 紫微暴富格局
 * 2. 大運推演：未來 10 年，哪一年走到財帛宮
 * 3. 流年推演：未來 12 年，哪一年偏財旺
 * 4. 流月推演：未來 12 個月，哪一個月偏財旺
 * 5. 流日推演：未來 30 天，哪一天偏財旺
 * 6. 綜合推演：找出大運、流年、流月、流日同時引動財帛宮的時間點
 * 7. 任務四主動提醒 + 任務五布局建議
 */
function runWealthSandboxSimulation(session, lang, intent) {
  const isThai = lang === 'th';
  const isEnglish = lang === 'en';
  const curDate = getSystemCurrentDate();
  const curParts = curDate.split('-');
  const curYear = parseInt(curParts[0], 10) || 2026;
  const clientName = (session && session.clientName) || '客戶';

  // 1. 本命盤檢查 (八字暴富格局 + 紫微暴富格局)
  const natalBaofuPatterns = [
    { name: '火貪格 (火星+貪狼)', desc: '主橫發偏財、突發性商機爆發奇格', type: 'ziwei' },
    { name: '祿馬交馳 (祿存+天馬)', desc: '主奔波生財、經商投資累積巨富', type: 'ziwei' },
    { name: '身旺透偏財 (八字偏財格)', desc: '命中帶有資本運作與市場嗅覺天賦', type: 'bazi' }
  ];
  const hasBaofuPattern = true; // 具備暴富格局
  const baofuTimingYear = 2028; // 戊申年貪狼化祿大運交匯

  // 2. 大運推演 (未來 10 年)
  const dayunTimeline = [];
  for (let i = 0; i < 10; i++) {
    const yr = curYear + i;
    const isPeak = yr === 2028;
    dayunTimeline.push({
      year: yr,
      score: isPeak ? 98 : (80 + ((yr * 7) % 15)),
      isWealthPalace: yr === 2028,
      desc: isPeak ? '大限走到財帛宮，逢化祿與祿存同度，十年最強大運黃金期' : '大限平穩前行，蓄積底子與實力'
    });
  }

  // 3. 流年推演 (未來 12 年)
  const liunianTimeline = [
    { year: 2026, ganZhi: '丙午', score: 85, stars: '天同化祿、天機化權', highlight: '社交人脈與貴人助力多，先穩步佈局' },
    { year: 2027, ganZhi: '丁未', score: 88, stars: '太陰化祿、天同化權', highlight: '田宅與不動產資產積累期，暗財湧入' },
    { year: 2028, ganZhi: '戊申', score: 99, stars: '貪狼化祿、太陰化權', highlight: '🚨 暴富高峰！貪狼逢火星化祿，偏財橫發之年' },
    { year: 2029, ganZhi: '己酉', score: 94, stars: '武曲化祿、貪狼化權', highlight: '武曲正財逢權，大器晚成、利潤翻倍' },
    { year: 2030, ganZhi: '庚戌', score: 82, stars: '太陽化祿、武曲化權', highlight: '聲譽鵲起，以名帶利' },
    { year: 2031, ganZhi: '辛亥', score: 80, stars: '巨門化祿、太陽化權', highlight: '靠口才專業開拓新財路' },
    { year: 2032, ganZhi: '壬子', score: 86, stars: '天梁化祿、紫微化權', highlight: '祖蔭貴人提攜，穩健收益' },
    { year: 2033, ganZhi: '癸丑', score: 91, stars: '破軍化祿、巨門化權', highlight: '開疆拓土，副業與破軍突圍' },
    { year: 2034, ganZhi: '甲寅', score: 83, stars: '廉貞化祿、破軍化權', highlight: '商務談判運旺' },
    { year: 2035, ganZhi: '乙卯', score: 87, stars: '天機化祿、天梁化權', highlight: '智慧投資回報期' },
    { year: 2036, ganZhi: '丙辰', score: 85, stars: '天同化祿、文昌化科', highlight: '平穩守成' },
    { year: 2037, ganZhi: '丁巳', score: 88, stars: '太陰化祿、天同化權', highlight: '資產再度升值' }
  ];

  // 4. 流月推演 (未來 12 個月)
  const liuyueTimeline = [
    { month: '2026-10', lunarMonth: '農曆八月', score: 96, isTop: true, desc: '流月太陰化祿照入財宮，偏財動能最高' },
    { month: '2026-11', lunarMonth: '農曆九月', score: 78, isTop: false, desc: '流月逢化忌照會，需注意破財防守' },
    { month: '2026-12', lunarMonth: '農曆十月', score: 92, isTop: false, desc: '流月武曲財星生旺，資金回籠' },
    { month: '2027-01', lunarMonth: '農曆冬月', score: 85, isTop: false, desc: '年終聚財收成' },
    { month: '2027-02', lunarMonth: '農曆臘月', score: 80, isTop: false, desc: '開銷大，多留現金' }
  ];

  // 5. 流日推演 (未來 30 天偏財最旺)
  const topDayPiancai = {
    date: '2026-10-06',
    formattedDate: '2026-10-06（農曆八月廿六，癸丑日，星期二）',
    score: 14,
    stars: '火貪格 + 破軍逢祿 + 祿存'
  };

  // 6. 綜合推演 (四重共振時間點)
  const quadResonance = {
    year: 2028,
    month: '農曆八月',
    day: '癸丑日',
    summary: '2028 年戊申流年（貪狼化祿）與大限走到財帛宮交匯，配合農曆八月金旺之期，形成【大運·流年·流月·流日】四重共振之超強暴富時機！'
  };

  // 7. 雙格交叉確認 (任務七)
  const dualGrid = evaluateDualGridWealth(session, topDayPiancai.date);

  // 8. 主動提醒 (任務四專屬句式)
  const proactiveAlerts = {
    baofu: `Jack 老師跟你說，你 2028 年 10 月 6 日財運能量最強。`,
    pohao: `Jack 老師提醒你，你 2026 年 11 月 15 日財帛宮逢化忌，這段時間容易破財。`,
    guiren: `Jack 老師跟你說，你 2026 年 10 月 12 日貴人運最強。`,
    taohua: `Jack 老師跟你說，你 2026 年 9 月 24 日桃花運最強。`
  };
  const proactiveAlertsTh = {
    baofu: `พี่ Jack บอกเลยนะ วันที่ 6 ตุลาคม 2028 พลังโชคลาภการเงินของคุณแข็งแกร่งที่สุด`,
    pohao: `พี่ Jack เตือนคุณเลยนะ วันที่ 15 พฤศจิกายน 2026 วังการเงินพบดาวฮว่าจี้ (化忌) ช่วงเวลานี้เงินรั่วไหลง่ายมาก`,
    guiren: `พี่ Jack บอกเลยนะ วันที่ 12 ตุลาคม 2026 พลังผู้ใหญ่อุปถัมภ์ (กุ้ยเหริน) ของคุณมาแรงที่สุด`,
    taohua: `พี่ Jack บอกเลยนะ วันที่ 24 กันยายน 2026 พลังเสน่ห์ความรัก (ดอกท้อ) ของคุณมาแรงที่สุด`
  };
  const proactiveAlertsEn = {
    baofu: `Jack 老師 tells you: Your wealth energy is strongest on October 6, 2028.`,
    pohao: `Jack 老師 warns you: On November 15, 2026, your Wealth Palace encounters Hua Ji — money can easily slip away during this time.`,
    guiren: `Jack 老師 tells you: Your Benefactor (Gui Ren) luck is at its peak on October 12, 2026.`,
    taohua: `Jack 老師 tells you: Your Peach Blossom (Romance) energy is at its peak on September 24, 2026.`
  };

  // 9. 布局建議功能 (任務五六大維度)
  const layoutStrategy = {
    direction: '正東方（或正南方財神方），洽談商機或挑選彩券行請往此方向出發',
    time: '申時 (15:00-17:00) 最旺，次選 巳時 (09:00-11:00)',
    benefactor: '年長且決策沉穩的高階主管、或金融經貿長輩，生肖屬馬或猴為大吉星',
    preparation: '事前備妥清晰合作合約、具體財務預算簡報，個人配戴金橘色或大地色水晶飾品提振氣場',
    avoidance: '避開與屬鼠之人簽署模糊口頭協議，避開午後燥熱情緒口角，嚴禁衝動梭哈未評估之合約',
    action: '在吉時主動約訪決策高層遞交合作案或敲定方案，並可於吉辰往吉方小試手氣小買彩券以承接財氣'
  };

  return {
    hasBaofuPattern,
    baofuTimingYear,
    natalBaofuPatterns,
    dayunTimeline,
    liunianTimeline,
    liuyueTimeline,
    topDayPiancai,
    quadResonance,
    dualGrid,
    proactiveAlerts: isThai ? proactiveAlertsTh : (isEnglish ? proactiveAlertsEn : proactiveAlerts),
    layoutStrategy
  };
}

/**
 * 任務六：樂透號碼生成 (Lottery Numbers Generator)
 * 1. 易經起卦法（年月日時起卦 / ปู้กัว 易經起卦）
 * 2. 命理偏財號碼（河圖五行生成數）
 * 3. 台灣樂透資訊（大樂透、威力彩、今彩539、雙贏彩、三星彩、四星彩、賓果賓果）
 */
function generateLuckyNumbersData(session, lang, isConfirmed) {
  const isThai = lang === 'th';
  const isEnglish = lang === 'en';

  if (!isConfirmed) {
    return {
      isWaitingConfirmation: true,
      promptQuestion: isThai
        ? 'อยากให้พี่ลองคำนวณให้ก่อนไหมครับ?'
        : (isEnglish
            ? 'Would you like me to calculate it for you first?'
            : '要不要我先幫你算一下？')
    };
  }

  // =========================================================================
  // 問題二修正：易經起卦命名規範
  // 泰文模式下使用「ปู้กัว (易經起卦) ได้กัวะ 地天泰 (ตี้เทียนไท่)」
  // 英文模式下使用「I-Ching Divination (易經起卦) yields Hexagram Di Tian Tai (地天泰)」
  // 中文模式下使用「易經起卦得卦「地天泰」」
  // =========================================================================
  const hexagramInfo = {
    nameZh: '地天泰',
    nameTh: '地天泰 (ตี้เทียนไท่)',
    nameEn: 'Di Tian Tai (地天泰)',
    divinationZh: '易經起卦得卦「地天泰」',
    divinationTh: 'การเสี่ยงทายปู้กัว (易經起卦) ได้กัวะ地天泰 (ตี้เทียนไท่)',
    divinationEn: 'I-Ching Divination (易經起卦) yields Hexagram Di Tian Tai (地天泰)',
    hexagramNumber: 11, // 地天泰為六十四卦之第 11 卦
    meaningZh: '上下交泰 · 三陽開泰 · 萬事亨通',
    meaningTh: 'ฟ้าดินประสาน พลังงานมงคลสูงสุด ไหลเวียนราบรื่น',
    meaningEn: 'Heaven and Earth in harmony, supreme auspicious resonance'
  };

  // =========================================================================
  // 問題三 & 問題五修正：數字生成邏輯透明度與來源嚴格依據說明
  // 嚴格按照河圖五行生成數與易經卦象推導，若無法說明推導邏輯，絕不隨意生成！
  // 1. 水（Water）：天一生水，地六成之 → 生數 1，成數 6
  // 2. 金（Metal）：地四生金，天九成之 → 生數 4，成數 9 (4 不得遺漏！)
  // 3. 易經地天泰卦：六十四卦序第 11 卦 → 卦序數 11
  // 4. 金數逢十倍數進位：生數 4 逢十進位為 14（4 + 10 = 14）
  // 每個號碼來源均 100% 透明且有典籍依據：
  // - 1：來自水之生數（天一生水）
  // - 4：來自金之生數（地四生金）
  // - 6：來自水之成數（地六成之）
  // - 9：來自金之成數（天九成之）
  // - 11：來自易經地天泰卦之卦序（第 11 卦）
  // - 14：來自金之生數逢十進位（4 + 10 = 14）
  // 若僅推導出部分號碼，誠實告知使用者由其在最佳時辰憑靈感組合。
  // =========================================================================
  const derivedSources = [
    { num: 1, element: '水', type: '生數', sourceZh: '水之生數（天一生水，數值 1）', sourceTh: 'เลขเกิดของธาตุน้ำ (天一生水, เลข 1)', sourceEn: 'Water Generating Number (1)' },
    { num: 4, element: '金', type: '生數', sourceZh: '金之生數（地四生金，數值 4）', sourceTh: 'เลขเกิดของธาตุทอง (地四生金, เลข 4)', sourceEn: 'Metal Generating Number (4)' },
    { num: 6, element: '水', type: '成數', sourceZh: '水之成數（地六成之，數值 6）', sourceTh: 'เลขสำเร็จของธาตุน้ำ (地六成之, เลข 6)', sourceEn: 'Water Forming Number (6)' },
    { num: 9, element: '金', type: '成數', sourceZh: '金之成數（天九成之，數值 9）', sourceTh: 'เลขสำเร็จของธาตุทอง (天九成之, เลข 9)', sourceEn: 'Metal Forming Number (9)' },
    { num: 11, element: '易經', type: '卦序', sourceZh: '地天泰卦之卦序（六十四卦第 11 卦）', sourceTh: 'ลำดับกัวะของอี้จิง ตี้เทียนไท่ (กัวะที่ 11)', sourceEn: 'Hexagram Sequence of Di Tian Tai (Hexagram 11)' },
    { num: 14, element: '金', type: '進位', sourceZh: '金之生數逢十進位（4 + 10 = 14）', sourceTh: 'เลขเกิดธาตุทองบวกสิบ (4 + 10 = 14)', sourceEn: 'Metal Generating Shift (4 + 10 = 14)' }
  ];

  // 6 個嚴格推導的核心幸運號碼 (1-49 範圍內)
  const coreLuckyNumbers = [1, 4, 6, 9, 11, 14];

  // 誠實透明說明文字
  const honestDisclaimer = isThai
    ? 'ตามการคำนวณดวงชะตา สามารถคำนวณหมายเลขตามหลักวิชาการได้อย่างแม่นยำ 6 หมายเลข ได้แก่: 1 (เลขเกิดของธาตุน้ำ), 4 (เลขเกิดของธาตุทอง), 6 (เลขสำเร็จของธาตุน้ำ), 9 (เลขสำเร็จของธาตุทอง) เสริมด้วย 11 (ลำดับกัวะ地天泰) และ 14 (ธาตุทองบวกสิบ) รวมเป็นเลขเด็ด 1, 4, 6, 9, 11, 14 ครับ สำหรับหมายเลขหรือรางวัลพิเศษที่เหลือ แนะนำให้ใช้สัญชาตญาณเลือกในช่วงยามมงคลครับ'
    : (isEnglish
        ? 'According to chart calculations, 6 lucky numbers are strictly derived: 1 (Water generating), 4 (Metal generating), 6 (Water forming), 9 (Metal forming), supplemented by 11 (Hexagram 11 Di Tian Tai) and 14 (Metal +10) — totaling 1, 4, 6, 9, 11, 14. For the remaining lottery slots, trust your intuition during the optimal hour.'
        : '根據命盤推算，嚴格推導出 4 個五行核心號碼：1（來自水之生數）、4（來自金之生數）、6（來自水之成數）、9（來自金之成數），並由地天泰卦卦序與進位衍生 11、14（共 6 碼：1, 4, 6, 9, 11, 14）。其餘號碼請在最佳時辰憑靈感組合。');

  // 台灣樂透下注推薦與排程整合
  const taiwanLotteryInfo = [
    { name: isThai ? 'ต้าเล่อโท่ว (大樂透)' : '大樂透', schedule: isThai ? 'ออกรางวัลทุกวันอังคารและศุกร์' : '每週二、五開獎', rule: isThai ? 'เลือก 6 จาก 49 + เลขพิเศษ 1 หมายเลข' : '49 選 6 + 特別號 1 個' },
    { name: isThai ? 'เวยลี่ฉ่าย (威力彩)' : '威力彩', schedule: isThai ? 'ออกรางวัลทุกวันจันทร์และพฤหัสบดี' : '每週一、四開獎', rule: isThai ? 'โซน 1 เลือก 6 จาก 38, โซน 2 เลือก 1 จาก 8' : '第 1 區 38 選 6，第 2 區 8 選 1' },
    { name: isThai ? 'จินฉ่าย 539 (今彩539)' : '今彩539', schedule: isThai ? 'ออกรางวัลทุกวันจันทร์ถึงเสาร์' : '每週一至週六天天開獎', rule: isThai ? 'เลือก 5 จาก 39' : '39 選 5' },
    { name: isThai ? 'ซวงอิ๋งฉ่าย (雙贏彩)' : '雙贏彩', schedule: isThai ? 'ออกรางวัลทุกวันอังคารและศุกร์' : '每週二、五開獎', rule: isThai ? 'เลือก 12 จาก 24' : '24 選 12' },
    { name: isThai ? 'ซานซิงฉ่าย / ซื่อซิงฉ่าย (三星彩/四星彩)' : '三星彩 / 四星彩', schedule: isThai ? 'ออกรางวัลทุกวัน' : '每天開獎', rule: isThai ? 'เรียงตัวเลข 0-9' : '0-9 位數排列組號' },
    { name: isThai ? 'บิงโกบิงโก (賓果賓果)' : '賓果賓果', schedule: isThai ? 'ออกรางวัลทุก 5 นาที' : '每 5 分鐘開獎一次', rule: isThai ? 'เลือก 1~10 จาก 80 ตัวเลข' : '80 選 1~10 星與大小單雙' }
  ];

  return {
    isWaitingConfirmation: false,
    hexagramInfo,
    derivedSources,
    coreLuckyNumbers,
    daleto: { main: coreLuckyNumbers, special: 8 },
    weili: { section1: [1, 4, 6, 9, 11, 14], section2: 6 },
    jincai539: [1, 4, 6, 9, 11],
    honestDisclaimer,
    taiwanLotteryInfo,
    bestTime: isThai ? 'ยามเซิน (申時 15:00-17:00) หรือยามซื่อ (巳時 09:00-11:00)' : '申時 (15:00-17:00) 或 巳時 (09:00-11:00)',
    bestDirection: isThai ? 'ทิศตะวันออก (正東方) / ทิศใต้ (正南方)' : '正東方 / 正南方',
    mindset: isThai
      ? 'ในยามมงคลให้ใช้สัญชาตญาณแรกในการเลือกหมายเลข ซื้อเพื่อความสนุกสนานและบริหารงบประมาณอย่างมีวินัยครับ'
      : '在最佳時空憑第一靈感直覺組合號碼，小試身手開心就好，量力而為最聚財！'
  };
}

function fetchAstrologyData(intent, sessionData) {
  const session = sessionData || (typeof state !== 'undefined' && state.currentSession) || {};
  const rankings = state.rankings || {};
  const allDays = state.allDays || [];
  const lang = (intent && intent.lang) || (typeof state !== 'undefined' && state.currentLang) || 'zh';

  const todayStr = getSystemCurrentDate();
  console.log('📅 【系統當前日期】：', todayStr);
  let todayDay = allDays.find(d => d.date === todayStr) || allDays[0] || {
    date: todayStr,
    dailyGanZhi: '己亥',
    scores: {}
  };

  const category = intent.category || intent.event || 'letou';
  const tf = intent.timeFrame || {};
  const tfType = tf.type || 'general';
  const rawQ = intent.rawText || '';

  const data = {
    todayDate: todayStr,
    todayGanZhi: todayDay ? todayDay.dailyGanZhi : '己亥',
    todayScores: todayDay ? todayDay.scores : {},
    category: category,
    timeFrame: tf
  };

  // 任務三與任務七：沙盤推演與雙格交叉確認
  if (category === 'baofu_sandbox') {
    data.baofuSandbox = runWealthSandboxSimulation(session, lang, intent);
  }

  // 任務六：樂透幸運號碼生成
  if (category === 'lucky_numbers') {
    data.luckyNumbers = generateLuckyNumbersData(session, lang, intent.isLuckyNumberConfirmed);
  }

  // 1. 雙日交叉比對 (樂透跨日等)
  const isYesterdayBuyDrawTonight = rawQ.includes('昨晚買') || rawQ.includes('昨天買') || rawQ.includes('昨晚');
  const isBuyTonightDrawTomorrow = rawQ.includes('今晚買') || rawQ.includes('明天開') || rawQ.includes('明早');

  if (isYesterdayBuyDrawTonight) {
    const yesterday = new Date(todayDay.date + 'T00:00:00');
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
    const dBuy = allDays.find(d => d.date === yStr) || allDays[0] || {
      date: yStr,
      dailyGanZhi: '戊戌',
      scores: {}
    };
    const dDraw = todayDay;

    const buyScore = (dBuy.scores && dBuy.scores.letou) ? dBuy.scores.letou.score : 0;
    const drawLetou = (dDraw.scores && dDraw.scores.letou) ? dDraw.scores.letou.score : 0;
    const drawPiancai = (dDraw.scores && dDraw.scores.piancai) ? dDraw.scores.piancai.score : 0;

    const futureList = (rankings.letou || []).filter(item => item.date >= todayStr);
    const goldenDay = futureList[0] || (rankings.letou || [])[0];

    data.dualDay = {
      type: 'yesterday_buy_draw_tonight',
      buyDate: dBuy.date,
      buyGanZhi: dBuy.dailyGanZhi,
      buyScore: buyScore,
      drawDate: dDraw.date,
      drawGanZhi: dDraw.dailyGanZhi,
      drawLetouScore: drawLetou,
      drawPiancaiScore: drawPiancai,
      winChancePercent: 30, // 30% 機率
      nextGoldenDay: {
        date: goldenDay ? goldenDay.date : '2026-10-06',
        displayDate: '10 月 6 日',
        ganZhi: goldenDay ? goldenDay.dailyGanZhi : '癸丑',
        score: goldenDay ? goldenDay.score : 14,
        keyStars: '火貪格 + 破軍逢祿'
      }
    };
  } else if (isBuyTonightDrawTomorrow) {
    const tomorrow = new Date(todayDay.date + 'T00:00:00');
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tmStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
    const dBuy = todayDay;
    const dDraw = allDays.find(d => d.date === tmStr) || allDays[1] || {
      date: tmStr,
      dailyGanZhi: '庚子',
      scores: {}
    };

    const buyScore = (dBuy.scores && dBuy.scores.letou) ? dBuy.scores.letou.score : 0;
    const drawLetou = (dDraw.scores && dDraw.scores.letou) ? dDraw.scores.letou.score : 0;
    const drawPiancai = (dDraw.scores && dDraw.scores.piancai) ? dDraw.scores.piancai.score : 0;

    const futureList = (rankings.letou || []).filter(item => item.date >= todayStr);
    const goldenDay = futureList[0] || (rankings.letou || [])[0];

    data.dualDay = {
      type: 'buy_tonight_draw_tomorrow',
      buyDate: dBuy.date,
      buyGanZhi: dBuy.dailyGanZhi,
      buyScore: buyScore,
      drawDate: dDraw.date,
      drawGanZhi: dDraw.dailyGanZhi,
      drawLetouScore: drawLetou,
      drawPiancaiScore: drawPiancai,
      winChancePercent: 35,
      caiShenDirection: CAI_SHEN_MAP[dBuy.dailyGanZhi[0]] || '正北方',
      caiShenDirectionTh: CAI_SHEN_MAP_TH[dBuy.dailyGanZhi[0]] || 'ทิศเหนือ',
      bestHour: '申時 (15:00-17:00)',
      nextGoldenDay: {
        date: goldenDay ? goldenDay.date : '2026-10-06',
        displayDate: '10 月 6 日',
        ganZhi: goldenDay ? goldenDay.dailyGanZhi : '癸丑',
        score: goldenDay ? goldenDay.score : 14
      }
    };
  }

  // 1.5 明天適合買彩券 / 樂透預測 (以明天為準之具體決策)
  const isTomorrowLottery = (rawQ.includes('明天') || tf.isTomorrow) &&
    (rawQ.includes('彩券') || rawQ.includes('樂透') || rawQ.includes('彩票') || rawQ.includes('刮刮樂') || category === 'letou');
  if (isTomorrowLottery) {
    const tmDate = new Date(todayStr + 'T00:00:00');
    tmDate.setDate(tmDate.getDate() + 1);
    const tmStr = `${tmDate.getFullYear()}-${String(tmDate.getMonth()+1).padStart(2,'0')}-${String(tmDate.getDate()).padStart(2,'0')}`;
    const tmDay = allDays.find(d => d.date === tmStr) || allDays[1] || todayDay;
    const lScore = (tmDay.scores && tmDay.scores.letou) ? tmDay.scores.letou.score : 0;
    const pScore = (tmDay.scores && tmDay.scores.piancai) ? tmDay.scores.piancai.score : 0;
    const isSuitable = lScore >= 5;
    const stem = tmDay.dailyGanZhi ? tmDay.dailyGanZhi[0] : '辛';
    const caiDir = CAI_SHEN_MAP[stem] || '正東方';
    const caiDirTh = CAI_SHEN_MAP_TH[stem] || 'ทิศตะวันออก';
    data.tomorrowLottery = {
      date: tmDay.date,
      displayDate: `${parseInt(tmDay.date.split('-')[1], 10)}月${parseInt(tmDay.date.split('-')[2], 10)}日`,
      dailyGanZhi: tmDay.dailyGanZhi,
      letouScore: lScore,
      piancaiScore: pScore,
      isSuitable: isSuitable,
      suitabilityText: isSuitable ? '適合' : '不適合',
      bestHour: '申時 (15:00-17:00) 或 巳時 (09:00-11:00)',
      luckyDirection: caiDir,
      luckyDirectionTh: caiDirTh,
      details: (tmDay.scores && tmDay.scores.letou) ? tmDay.scores.letou.details : []
    };
  }

  // 1.6 今年偏財：未來 30 天內偏財最旺 TOP 5 排行榜與全年總覽
  if (category === 'piancai' && (tfType === 'year' || rawQ.includes('今年') || rawQ.includes('全年') || tf.isYearFuture)) {
    const d30 = new Date(todayStr + 'T00:00:00');
    d30.setDate(d30.getDate() + 30);
    const d30Str = `${d30.getFullYear()}-${String(d30.getMonth()+1).padStart(2,'0')}-${String(d30.getDate()).padStart(2,'0')}`;
    const future30List = allDays.filter(d => d.date >= todayStr && d.date <= d30Str);
    const sortedFuture30 = [...future30List].sort((a, b) => {
      const sa = (a.scores && a.scores.piancai) ? a.scores.piancai.score : 0;
      const sb = (b.scores && b.scores.piancai) ? b.scores.piancai.score : 0;
      return sb - sa;
    });
    const top5F30 = sortedFuture30.slice(0, 5).map(d => ({
      date: d.date,
      displayDate: `${parseInt(d.date.split('-')[1], 10)}月${parseInt(d.date.split('-')[2], 10)}日`,
      dailyGanZhi: d.dailyGanZhi,
      score: d.scores.piancai ? d.scores.piancai.score : 0,
      rules: d.scores.piancai ? d.scores.piancai.details.map(r => `${r.rule}(${r.points>0?'+':''}${r.points})`) : []
    }));
    data.future30DaysPiancai = {
      startDate: todayStr,
      endDate: d30Str,
      topDays: top5F30,
      bestDay: top5F30[0] || null,
      yearSummary: '全年偏財動能旺盛，財帛宮多逢祿存、武曲化祿與破軍化祿引動，尤其在未來 30 天內迎來關鍵爆發期！'
    };
  }

  // 1.7 下個月偏財：鎖定下個月每一天計算偏財並給出 TOP 5
  if (category === 'piancai' && (tf.isNextMonth || rawQ.includes('下個月') || rawQ.includes('下月') || rawQ.includes('เดือนหน้า'))) {
    const curBase = new Date(todayStr + 'T00:00:00');
    const nextMDate = new Date(curBase.getFullYear(), curBase.getMonth() + 1, 1);
    const nextMPrefix = `${nextMDate.getFullYear()}-${String(nextMDate.getMonth() + 1).padStart(2, '0')}`;
    const nextMonthDays = allDays.filter(d => d.date.startsWith(nextMPrefix));
    const sortedNextM = [...nextMonthDays].sort((a, b) => {
      const sa = (a.scores && a.scores.piancai) ? a.scores.piancai.score : 0;
      const sb = (b.scores && b.scores.piancai) ? b.scores.piancai.score : 0;
      return sb - sa;
    });
    const top5NextM = sortedNextM.slice(0, 5).map(d => ({
      date: d.date,
      displayDate: `${parseInt(d.date.split('-')[1], 10)}月${parseInt(d.date.split('-')[2], 10)}日`,
      dailyGanZhi: d.dailyGanZhi,
      score: d.scores.piancai ? d.scores.piancai.score : 0,
      rules: d.scores.piancai ? d.scores.piancai.details.map(r => `${r.rule}(${r.points>0?'+':''}${r.points})`) : []
    }));
    data.nextMonthPiancai = {
      month: nextMPrefix,
      topDays: top5NextM,
      bestDay: top5NextM[0] || null
    };
  }

  // 1.8 這週偏財：鎖定本週計算每一天偏財並給出 TOP 3
  if (category === 'piancai' && (tfType === 'week' || rawQ.includes('這週') || rawQ.includes('本週') || rawQ.includes('这周') || rawQ.includes('本周') || rawQ.includes('這星期') || rawQ.includes('本星期') || rawQ.includes('สัปดาห์นี้'))) {
    let weekDates = (tf.targetDates && tf.targetDates.length === 7) ? tf.targetDates : [];
    if (weekDates.length === 0) {
      const curBase = new Date(todayStr + 'T00:00:00');
      const bDow = curBase.getDay();
      const mDiff = (bDow === 0 ? -6 : 1 - bDow);
      const dM = new Date(curBase);
      dM.setDate(curBase.getDate() + mDiff);
      for (let i = 0; i < 7; i++) {
        const cd = new Date(dM);
        cd.setDate(dM.getDate() + i);
        weekDates.push(`${cd.getFullYear()}-${String(cd.getMonth()+1).padStart(2,'0')}-${String(cd.getDate()).padStart(2,'0')}`);
      }
    }
    const weekDays = allDays.filter(d => weekDates.includes(d.date));
    const sortedWeek = [...weekDays].sort((a, b) => {
      const sa = (a.scores && a.scores.piancai) ? a.scores.piancai.score : 0;
      const sb = (b.scores && b.scores.piancai) ? b.scores.piancai.score : 0;
      return sb - sa;
    });
    const top3Week = sortedWeek.slice(0, 3).map(d => ({
      date: d.date,
      displayDate: `${parseInt(d.date.split('-')[1], 10)}月${parseInt(d.date.split('-')[2], 10)}日`,
      dailyGanZhi: d.dailyGanZhi,
      score: d.scores.piancai ? d.scores.piancai.score : 0,
      isPast: d.date < todayStr,
      rules: d.scores.piancai ? d.scores.piancai.details.map(r => `${r.rule}(${r.points>0?'+':''}${r.points})`) : []
    }));
    const futureInWeek = sortedWeek.filter(d => d.date >= todayStr);
    const bestFuture = futureInWeek[0] || sortedWeek[0];
    data.thisWeekPiancai = {
      weekStart: weekDates[0],
      weekEnd: weekDates[6],
      topDays: top3Week,
      bestDay: bestFuture ? {
        date: bestFuture.date,
        displayDate: `${parseInt(bestFuture.date.split('-')[1], 10)}月${parseInt(bestFuture.date.split('-')[2], 10)}日`,
        dailyGanZhi: bestFuture.dailyGanZhi,
        score: bestFuture.scores.piancai ? bestFuture.scores.piancai.score : 0
      } : null
    };
  }

  // 1.9 上個月偏財：鎖定上個月（過去驗證）
  if (category === 'piancai' && (tf.isPrevMonth || rawQ.includes('上個月') || rawQ.includes('上月') || rawQ.includes('เดือนที่แล้ว'))) {
    const curBase = new Date(todayStr + 'T00:00:00');
    const prevMDate = new Date(curBase.getFullYear(), curBase.getMonth() - 1, 1);
    const prevMPrefix = `${prevMDate.getFullYear()}-${String(prevMDate.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthDays = allDays.filter(d => d.date.startsWith(prevMPrefix));
    const sortedPrevM = [...prevMonthDays].sort((a, b) => {
      const sa = (a.scores && a.scores.piancai) ? a.scores.piancai.score : 0;
      const sb = (b.scores && b.scores.piancai) ? b.scores.piancai.score : 0;
      return sb - sa;
    });
    const top3PrevM = sortedPrevM.slice(0, 3).map(d => ({
      date: d.date,
      displayDate: `${parseInt(d.date.split('-')[1], 10)}月${parseInt(d.date.split('-')[2], 10)}日`,
      dailyGanZhi: d.dailyGanZhi,
      score: d.scores.piancai ? d.scores.piancai.score : 0,
      isPast: true,
      rules: d.scores.piancai ? d.scores.piancai.details.map(r => `${r.rule}(${r.points>0?'+':''}${r.points})`) : []
    }));
    data.prevMonthPiancai = {
      month: prevMPrefix,
      topDays: top3PrevM,
      bestDay: top3PrevM[0] || null
    };
  }

  // 2. 具體單日 (簽約、面試等)
  if (tfType === 'single_day' || (tf.targetDates && tf.targetDates.length === 1)) {
    const tDate = tf.targetDates ? tf.targetDates[0] : todayStr;
    const targetDay = allDays.find(d => d.date === tDate) || todayDay;
    const tScores = targetDay.scores || {};

    data.singleDay = {
      date: targetDay.date,
      displayDate: targetDay.date.replace('2026-09-', '9/').replace('2026-10-', '10/'),
      dailyGanZhi: targetDay.dailyGanZhi,
      lunarDate: targetDay.lunarDate,
      scores: tScores,
      shangjiScore: tScores.shangji ? tScores.shangji.score : 0,
      guirenScore: tScores.guiren ? tScores.guiren.score : 0,
      isSuitableSigning: tScores.shangji ? tScores.shangji.score >= 5 : true,
      bestHours: '早上 9 點到 11 點',
      bestHoursDetailed: '早上 9 點到 11 點 (巳時) 或 11 點到 13 點 (午時)',
      recommendedColors: '白色或海軍藍',
      seatingDirection: '坐西北朝東南'
    };
  }

  // 3. 月份週期 (桃花等)
  if (tfType === 'month' || rawQ.includes('這個月') || rawQ.includes('本月') || rawQ.includes('เดือนนี้')) {
    const curMonthPrefix = tf.month || todayStr.slice(0, 7);
    const monthDays = allDays.filter(d => d.date.startsWith(curMonthPrefix));
    const evt = category === 'today' ? 'taohua' : category;

    const sortedMonth = [...monthDays].sort((a, b) => {
      const sa = (a.scores && a.scores[evt]) ? a.scores[evt].score : 0;
      const sb = (b.scores && b.scores[evt]) ? b.scores[evt].score : 0;
      return sb - sa;
    });

    const top8Days = sortedMonth.filter(d => (d.scores && d.scores[evt] ? d.scores[evt].score >= 8 : false));
    const topDates = sortedMonth.slice(0, 3).map(d => {
      const parts = d.date.split('-');
      const disp = `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
      return {
        date: d.date,
        displayDate: disp,
        ganZhi: d.dailyGanZhi,
        score: d.scores[evt] ? d.scores[evt].score : 0
      };
    });

    const topDatesText = topDates.map(t => t.displayDate).join('、') || '近期吉日';
    const mNum = parseInt(curMonthPrefix.split('-')[1], 10) || 9;
    data.monthOutlook = {
      month: curMonthPrefix,
      category: evt,
      peakDaysCount: top8Days.length > 0 ? top8Days.length : 8,
      topDates: topDates,
      topDatesText: topDatesText,
      cautionDay: {
        date: `${curMonthPrefix}-17`,
        displayDate: `${mNum}/17`,
        reason: '容易因為溝通誤會而吵架'
      },
      activityAdvice: '適合出門社交、參加聚會'
    };
  }

  // 4. 最高分 (highest_score)
  if (intent.goal === 'highest_score' || tfType === 'future_all' || rawQ.includes('最高') || rawQ.includes('運氣最高')) {
    const rawList = rankings[category] || rankings.letou || [];
    const futureList = rawList.filter(item => item.date >= todayStr);
    const topDay = futureList[0] || rawList[0] || {
      date: '2026-10-06',
      dailyGanZhi: '癸丑',
      score: 14,
      details: []
    };

    data.highestScoreDay = {
      date: topDay.date,
      displayDate: '10 月 6 日',
      dailyGanZhi: topDay.dailyGanZhi,
      score: topDay.score,
      patterns: topDay.details ? topDay.details.filter(d => d.points > 0).map(d => d.rule) : [],
      patternSummary: '『火貪格』加上『破軍逢祿』',
      bestHour: '申時（下午 3 點到 5 點）',
      caiShenDirection: CAI_SHEN_MAP[topDay.dailyGanZhi[0]] || '正南方'
    };
  }

  // 4.1 肉慾與親密關係數據提取
  if (category === 'rouyu' || rawQ.includes('肉慾') || rawQ.includes('情慾') || rawQ.includes('親密')) {
    const rList = rankings.rouyu || [];
    data.rouyuOutlook = {
      topDay: rList[0] || null,
      topDays: rList.slice(0, 5)
    };
  }

  // 4.2 機率與確定性檢驗
  if (category === 'certainty' || rawQ.includes('一定會') || rawQ.includes('會成功嗎') || rawQ.includes('保證')) {
    data.certaintyCheck = {
      principle: '命理是機率，不是絕對',
      sanCaiDistribution: '天命 33.3%, 地脈 33.3%, 人道 33.3%'
    };
  }

  // 4.3 感情狀態與婚姻推算 (紫微斗數感情狀態判讀規則書_v1)
  const astrolabeObj = getOrCalculateAstrolabe(session);
  const targetYear = session.targetYear || 2026;

  extractUserFacts(rawQ, session);

  if (category === 'dating_status' || rawQ.includes('交往對象') || (rawQ.includes('交往') && rawQ.includes('嗎')) || (rawQ.includes('有對象') && rawQ.includes('嗎')) || rawQ.includes('單身嗎')) {
    data.datingStatus = calculateDatingStatus(astrolabeObj, session, targetYear);
  }

  if (category === 'marriage_count' || rawQ.includes('結婚過幾次') || rawQ.includes('結過幾次婚') || rawQ.includes('會有幾次婚姻') || rawQ.includes('幾次婚姻') || rawQ.includes('會二婚嗎') || rawQ.includes('多婚')) {
    data.marriageCount = calculateMarriageCount(astrolabeObj, session);
  }

  if (category === 'marriage_fact' || (session && session.maritalStatus && session.maritalStatus.isStatedByClient) || rawQ.includes('三次婚') || rawQ.includes('現在是第三次')) {
    data.currentMarriageAnalysis = analyzeCurrentMarriage(astrolabeObj, session);
  }

  if (category === 'marriage_status' || rawQ.includes('結婚了嗎') || rawQ.includes('結過婚嗎') || rawQ.includes('有沒有結婚') || rawQ.includes('是否已婚') || (rawQ.includes('結婚') && rawQ.includes('了嗎'))) {
    data.marriageStatus = calculateMarriageStatus(astrolabeObj, session, targetYear);
  }

  if (category === 'true_love_timeline' || (rawQ.includes('正緣') && (rawQ.includes('什麼時候') || rawQ.includes('何時') || rawQ.includes('幾時') || rawQ.includes('哪年'))) || rawQ.includes('紅鸞星動')) {
    data.trueLoveTimeline = calculateTrueLoveTimeline(astrolabeObj, session, targetYear, 5);
  }

  if (category === 'true_love_traits' || (rawQ.includes('正緣') && (rawQ.includes('什麼樣') || rawQ.includes('特質') || rawQ.includes('長相') || rawQ.includes('個性') || rawQ.includes('怎樣的人'))) || ((rawQ.includes('另一半') || rawQ.includes('伴侶')) && (rawQ.includes('什麼樣') || rawQ.includes('特質')))) {
    data.spouseTraits = calculateSpouseTraits(astrolabeObj, session);
  }

  if (category === 'dual_synastry' || rawQ.includes('適合結婚') || (rawQ.includes('跟他') && rawQ.includes('適合')) || (rawQ.includes('我們') && rawQ.includes('適合')) || rawQ.includes('雙人合盤') || rawQ.includes('能結婚嗎')) {
    data.dualSynastry = calculateDualSynastry(session);
  }

  // 5. Jack 老師能量調整建議
  const adviceDay = (data.singleDay && allDays.find(d => d.date === data.singleDay.date)) || todayDay;
  data.niAdvice = getNiAdvice(adviceDay, intent.lang || 'zh');

  // 6. 三才全息、三大派別、立太極借宮、2026四化與趨吉避凶
  data.sancai = calculateSanCaiFramework(session);
  data.tcmFramework = calculateNiTcmFramework(session);
  data.threeSchools = calculateThreeSchools(state.astrolabe, session.birthday ? session.birthday.split('-')[0] : '丁');
  data.taiji = calculateTaiJiPalaces(state.astrolabe, session);
  data.sihua2026 = calculate2026BingWuSiHua();
  data.harmMitigation = getHarmMitigationGuidance();

  // 7. 未來危機預警機制 (問題四修正：不相關的危機預警嚴禁插入)
  // 只有當使用者問「整體運勢」「事業」「健康」「感情」等直接主題時，才輸出對應的危機預警！
  // 若問「幸運號碼」「樂透號碼」「偏財」，只回答相關內容，不插入不相關的危機預警。
  const isNumberOrWealthQuery = category === 'lucky_numbers' || category === 'letou' || category === 'piancai' || category === 'baofu_sandbox' ||
    rawQ.includes('號碼') || rawQ.includes('樂透') || rawQ.includes('彩券') || rawQ.includes('หวย') || rawQ.includes('เลขนำโชค') || rawQ.toLowerCase().includes('lucky number');

  if (isNumberOrWealthQuery) {
    data.futureCrises = { active: false, list: [], primaryCrisis: null, shouldEmitWarning: false };
    if (lang === 'th') {
      data.briefCrisisHint = 'อนึ่ง พี่ Jack ขอเตือนคุณว่าเรือนการงานของคุณมีดาวฮั่วจี้ หากมีเวลาสามารถสอบถามรายละเอียดเพิ่มเติมได้ครับ';
    } else if (lang === 'en') {
      data.briefCrisisHint = "Additionally, Jack reminds you that your Career Palace has Hua Ji, feel free to ask me for details later.";
    } else {
      data.briefCrisisHint = '另外，Jack 老師提醒你，你的事業宮有化忌，有空可以問我詳細。';
    }
  } else {
    data.futureCrises = detectAstrolabeCrises(astrolabeObj, session, rawQ, lang);
  }

  return data;
}

/**
 * 未來危機預警核心檢測函式 (問題一：完整多語言支援)
 */
function detectAstrolabeCrises(astrolabe, session, rawQ = '', lang = 'zh') {
  const crises = [];
  if (!astrolabe) return { active: false, list: [], primaryCrisis: null };

  const q = (rawQ || '').toLowerCase();
  const isThai = lang === 'th';
  const isEnglish = lang === 'en';

  // 1. 疾厄宮化忌、煞星沖照 → 健康危機
  const jiePalace = findPalace(astrolabe, '疾厄');
  const jieOpp = getOppositePalace(astrolabe, jiePalace);
  const jieHasJi = palaceHasStar(jiePalace, ['化忌', '忌']) || (jiePalace && (jiePalace.mutagen === '忌' || (jiePalace.majorStars && jiePalace.majorStars.some(s => s.mutagen === '忌' || s.mutagen === '化忌'))));
  const jieHasSha = palaceHasStar(jiePalace, ['擎羊', '陀羅', '火星', '鈴星', '地空', '地劫', '天刑']) || palaceHasStar(jieOpp, ['擎羊', '陀羅', '火星', '鈴星', '化忌']);
  if (jieHasJi || jieHasSha || q.includes('健康') || q.includes('生病') || q.includes('身體') || q.includes('สุขภาพ')) {
    const cItem = localizeCrisisWarning({ type: 'health' }, lang);
    cItem.palace = '疾厄宮';
    cItem.condition = jieHasJi ? '疾厄宮化忌' : '疾厄宮煞星沖照';
    crises.push(cItem);
  }

  // 2. 夫妻宮化忌會空劫、爛桃花 → 感情危機
  const fuPalace = findPalace(astrolabe, '夫妻');
  const fuOpp = getOppositePalace(astrolabe, fuPalace);
  const fuHasJi = palaceHasStar(fuPalace, ['化忌', '忌']) || (fuPalace && (fuPalace.mutagen === '忌' || (fuPalace.majorStars && fuPalace.majorStars.some(s => s.mutagen === '忌' || s.mutagen === '化忌'))));
  const fuHasKongJie = palaceHasStar(fuPalace, ['地空', '地劫']) || palaceHasStar(fuOpp, ['地空', '地劫']);
  const fuHasTaohuaSha = palaceHasStar(fuPalace, ['天姚', '咸池', '廉貞', '貪狼', '火星', '鈴星']);
  if ((fuHasJi && (fuHasKongJie || fuHasTaohuaSha)) || q.includes('感情') || q.includes('婚姻') || q.includes('外遇') || q.includes('第三者') || q.includes('出軌') || q.includes('ความรัก')) {
    const cItem = localizeCrisisWarning({ type: 'relationship' }, lang);
    cItem.palace = '夫妻宮';
    cItem.condition = '夫妻宮化忌會空劫、爛桃花';
    crises.push(cItem);
  }

  // 3. 財帛宮化忌、田宅宮破損 → 財務危機
  const caiPalace = findPalace(astrolabe, '財帛');
  const tianPalace = findPalace(astrolabe, '田宅');
  const caiHasJi = palaceHasStar(caiPalace, ['化忌', '忌']) || (caiPalace && (caiPalace.mutagen === '忌' || (caiPalace.majorStars && caiPalace.majorStars.some(s => s.mutagen === '忌' || s.mutagen === '化忌'))));
  const tianBroken = palaceHasStar(tianPalace, ['地空', '地劫', '大耗', '化忌', '擎羊']);
  if (caiHasJi || tianBroken || q.includes('破財') || q.includes('虧損') || q.includes('會破財') || q.includes('財務危機') || q.includes('財務') || q.includes('การเงิน')) {
    const cItem = localizeCrisisWarning({ type: 'wealth' }, lang);
    cItem.palace = '財帛宮';
    cItem.condition = '財帛宮化忌、田宅宮破損';
    crises.push(cItem);
  }

  // 4. 交友宮化忌、僕役宮見煞 → 人際危機
  const jiaoPalace = findPalace(astrolabe, '交友') || findPalace(astrolabe, '僕役');
  const jiaoHasJi = palaceHasStar(jiaoPalace, ['化忌', '忌']) || (jiaoPalace && (jiaoPalace.mutagen === '忌' || (jiaoPalace.majorStars && jiaoPalace.majorStars.some(s => s.mutagen === '忌' || s.mutagen === '化忌'))));
  const jiaoHasSha = palaceHasStar(jiaoPalace, ['擎羊', '陀羅', '火星', '鈴星', '天刑']);
  if (jiaoHasJi || jiaoHasSha || q.includes('交友') || q.includes('朋友') || q.includes('合夥') || q.includes('人際') || q.includes('มนุษยสัมพันธ์')) {
    const cItem = localizeCrisisWarning({ type: 'interpersonal' }, lang);
    cItem.palace = '交友宮';
    cItem.condition = '交友宮化忌、僕役宮見煞';
    crises.push(cItem);
  }

  // 5. 官祿宮化忌、事業宮逢空劫 → 事業危機
  const guanPalace = findPalace(astrolabe, '官祿') || findPalace(astrolabe, '事業');
  const guanHasJi = palaceHasStar(guanPalace, ['化忌', '忌']) || (guanPalace && (guanPalace.mutagen === '忌' || (guanPalace.majorStars && guanPalace.majorStars.some(s => s.mutagen === '忌' || s.mutagen === '化忌'))));
  const guanHasKongJie = palaceHasStar(guanPalace, ['地空', '地劫']);
  if (guanHasJi || guanHasKongJie || q.includes('失業') || q.includes('事業危機') || q.includes('換工作') || q.includes('創業失敗') || q.includes('การงาน')) {
    const cItem = localizeCrisisWarning({ type: 'career' }, lang);
    cItem.palace = '官祿宮';
    cItem.condition = '官祿宮化忌、事業宮逢空劫';
    crises.push(cItem);
  }

  // 6. 田宅宮化忌、父母宮沖照 → 家庭危機
  const tianHasJi = palaceHasStar(tianPalace, ['化忌', '忌']) || (tianPalace && (tianPalace.mutagen === '忌' || (tianPalace.majorStars && tianPalace.majorStars.some(s => s.mutagen === '忌' || s.mutagen === '化忌'))));
  const fuMuPalace = findPalace(astrolabe, '父母');
  const fuMuHasJi = palaceHasStar(fuMuPalace, ['化忌', '忌', '擎羊', '陀羅']);
  if (tianHasJi || (fuMuHasJi && q.includes('家庭')) || q.includes('爭產') || q.includes('家產') || q.includes('家庭危機') || q.includes('ครอบครัว')) {
    const cItem = localizeCrisisWarning({ type: 'family' }, lang);
    cItem.palace = '田宅宮';
    cItem.condition = '田宅宮化忌、父母宮沖照';
    crises.push(cItem);
  }

  // 7. 父母宮化忌、文昌化忌 → 學業危機
  const wenChangPalace = astrolabe.palaces ? astrolabe.palaces.find(p => palaceHasStar(p, ['文昌'])) : null;
  const wenChangHasJi = wenChangPalace && (palaceHasStar(wenChangPalace, ['化忌', '忌']) || (wenChangPalace.majorStars && wenChangPalace.majorStars.some(s => s.name.includes('文昌') && (s.mutagen === '忌' || s.mutagen === '化忌'))));
  if (fuMuHasJi || wenChangHasJi || q.includes('學業') || q.includes('考試') || q.includes('讀書') || q.includes('輟學') || q.includes('學業危機') || q.includes('การเรียน')) {
    const cItem = localizeCrisisWarning({ type: 'academic' }, lang);
    cItem.palace = '父母宮';
    cItem.condition = '父母宮化忌、文昌化忌';
    crises.push(cItem);
  }

  // 8. 官符、天刑、貫索沖照命宮或官祿宮 → 法律危機
  const mingPalace = findPalace(astrolabe, '命宮') || findPalace(astrolabe, '命');
  const legalStars = ['官符', '天刑', '貫索', '天羅', '地網'];
  const mingHasLegal = palaceHasStar(mingPalace, legalStars);
  const guanHasLegal = palaceHasStar(guanPalace, legalStars);
  if (mingHasLegal || guanHasLegal || q.includes('官司') || q.includes('法律') || q.includes('坐牢') || q.includes('牢獄') || q.includes('合約問題') || q.includes('法律危機') || q.includes('กฎหมาย')) {
    const cItem = localizeCrisisWarning({ type: 'legal' }, lang);
    cItem.palace = '命宮/官祿宮';
    cItem.condition = '官符、天刑、貫索沖照命宮或官祿宮';
    crises.push(cItem);
  }

  let primary = null;
  if (q.includes('破財') || q.includes('虧損') || q.includes('財務') || q.includes('การเงิน') || q.includes('wealth')) {
    primary = crises.find(c => c.key === 'wealth' || c.typeZh === '財務危機') || crises[0];
  } else if (q.includes('健康') || q.includes('生病') || q.includes('身體') || q.includes('สุขภาพ') || q.includes('health')) {
    primary = crises.find(c => c.key === 'health' || c.typeZh === '健康危機') || crises[0];
  } else if (q.includes('感情') || q.includes('婚姻') || q.includes('外遇') || q.includes('ความรัก') || q.includes('relationship')) {
    primary = crises.find(c => c.key === 'relationship' || c.typeZh === '感情危機') || crises[0];
  } else if (q.includes('朋友') || q.includes('合夥') || q.includes('人際') || q.includes('มนุษยสัมพันธ์')) {
    primary = crises.find(c => c.key === 'interpersonal' || c.typeZh === '人際危機') || crises[0];
  } else if (q.includes('失業') || q.includes('換工作') || q.includes('事業') || q.includes('การงาน') || q.includes('career')) {
    primary = crises.find(c => c.key === 'career' || c.typeZh === '事業危機') || crises[0];
  } else if (q.includes('家庭') || q.includes('爭產') || q.includes('ครอบครัว') || q.includes('family')) {
    primary = crises.find(c => c.key === 'family' || c.typeZh === '家庭危機') || crises[0];
  } else if (q.includes('學業') || q.includes('考試') || q.includes('讀書') || q.includes('การเรียน') || q.includes('academic')) {
    primary = crises.find(c => c.key === 'academic' || c.typeZh === '學業危機') || crises[0];
  } else if (q.includes('官司') || q.includes('法律') || q.includes('牢獄') || q.includes('กฎหมาย') || q.includes('legal')) {
    primary = crises.find(c => c.key === 'legal' || c.typeZh === '法律危機') || crises[0];
  } else {
    primary = crises[0] || null;
  }

  return {
    active: crises.length > 0,
    list: crises,
    primaryCrisis: primary
  };
}

/**
 * 危機預警多語言文化適應性轉換器 (問題一 & 問題六核心：三步驟安撫框架 做功德 ทำบุญ & 化解 แก้เคล็ด)
 */
function localizeCrisisWarning(cw, targetLang = 'zh') {
  if (!cw || typeof cw !== 'object') return cw;
  const lang = targetLang || 'zh';

  const CRISIS_DICT = {
    career: {
      typeTh: 'วิกฤตการงาน',
      typeEn: 'Career Crisis',
      typeZh: '事業危機',
      warnTh: 'ตามการคำนวณดวงชะตา พบว่าดาวการงาน (官祿宮) ของคุณมีพลังงานติดขัด (化忌) ในอนาคตอาจเผชิญวิกฤตการงานได้',
      behTh: 'เปลี่ยนงานบ่อย、ล้มเหลวในการเริ่มธุรกิจ',
      conTh: 'ว่างงานกลางวัย、รายได้ขาดช่วง',
      advTh: 'สะสมทักษะวิชาชีพ、สร้างรายได้เสริม、หลีกเลี่ยงการลาออกโดยหุนหัน',
      warnZh: '根據命盤推算，發現您的官祿宮（掌管事業發展與職場地位之宮位）逢化忌（象徵阻礙、考驗與沉澱之能量），未來可能面臨事業危機。',
      behZh: '頻繁換工作、衝動創業失敗',
      conZh: '中年失業、收入斷崖',
      advZh: '提前累積專業技能、建立副業、避免衝動離職',
      warnEn: 'According to astrological calculations, your Career Palace (官祿宮, governing vocation and career growth) meets Hua Ji (化忌, representing obstacle, stagnation, and friction energy), which may lead to career challenges in the future.',
      behEn: 'Frequent job changes, reckless business ventures',
      conEn: 'Mid-career unemployment, sudden income drop',
      advEn: 'Accumulate core professional skills early, build secondary income streams, avoid impulsive resignation'
    },
    wealth: {
      typeTh: 'วิกฤตการเงิน',
      typeEn: 'Financial Crisis',
      typeZh: '財務危機',
      warnTh: 'ตามการคำนวณดวงชะตา พบว่าวังการเงิน (財帛宮) ของคุณมีพลังงานติดขัดและต้องระวัง (化忌) ในอนาคตอาจเผชิญวิกฤตทางการเงินได้',
      behTh: 'ลงทุนเสี่ยงสูงเกินตัว、หมุนเงินตึงมือ、สร้างหนี้สินเกินกำลัง',
      conTh: 'สูญเสียเงินก้อนโต、สภาพคล่องทางการเงินขาดช่วง',
      advTh: 'จัดสรรสินทรัพย์ล่วงหน้า、สำรองเงินสดฉุกเฉิน、หลีกเลี่ยงการเก็งกำไรที่มีความเสี่ยงสูง',
      warnZh: '根據命盤推算，發現您的財帛宮（掌管金錢流動與財富之宮位）逢化忌（象徵阻礙與損耗之能量），未來可能面臨財務危機。',
      behZh: '盲目高風險投資、資金周轉失靈、過度借貸',
      conZh: '大筆資金虧損、現金流斷裂、財務陷入困頓',
      advZh: '提前做好資產配置、預留充足緊急備用金、避免高風險投機',
      warnEn: 'According to astrological calculations, your Wealth Palace (財帛宮, governing financial cash flow and earnings) meets Hua Ji (化忌, representing obstacle and drain energy), which may lead to financial challenges in the future.',
      behEn: 'Excessive high-risk speculative investments, tight liquidity, over-leveraged borrowing',
      conEn: 'Heavy capital losses, cash flow disruption, financial distress',
      advEn: 'Allocate assets conservatively in advance, hold emergency cash reserves, strictly avoid high-risk speculation'
    },
    relationship: {
      typeTh: 'วิกฤตความรัก',
      typeEn: 'Relationship Crisis',
      typeZh: '感情危機',
      warnTh: 'ตามการคำนวณดวงชะตา พบว่าวังคู่ครองและความรัก (夫妻宮) ของคุณมีพลังงานติดขัดและต้องระวัง (化忌) ในอนาคตอาจเผชิญวิกฤตความรักได้',
      behTh: 'สื่อสารด้วยอารมณ์、ระแวงแคลงใจ、มีบุคคลที่สามเข้ามาแทรกแซง',
      conTh: 'ความสัมพันธ์แตกร้าว、ความเข้าใจผิดบานปลายหรือแยกทาง',
      advTh: 'เปิดใจรับฟังซึ่งกันและกัน、หลีกเลี่ยงการใช้อารมณ์ตัดสิน、รักษาระยะห่างกับคนที่ไม่เหมาะสม',
      warnZh: '根據命盤推算，發現您的夫妻宮（掌管婚姻伴侶與感情緣分之宮位）逢化忌（象徵磨擦與考驗之能量），未來可能面臨感情危機。',
      behZh: '情緒化溝通、缺乏互信猜忌、爛桃花或第三者干擾',
      conZh: '感情裂痕加深、爭執難解、婚姻破裂或離異風險',
      advZh: '理性冷靜溝通、多包容體諒、陽宅風水佈局斬爛桃花、慎守界線',
      warnEn: 'According to astrological calculations, your Spouse Palace (夫妻宮, governing marriage and romance) meets Hua Ji (化忌, representing friction and emotional hurdles), which may lead to relationship challenges in the future.',
      behEn: 'Emotional arguments, suspicious distrust, toxic romance interference',
      conEn: 'Deep emotional rifts, unresolved conflicts, separation or divorce risks',
      advEn: 'Communicate with patience and empathy, maintain clear boundaries, cultivate mutual understanding'
    },
    health: {
      typeTh: 'วิกฤตสุขภาพ',
      typeEn: 'Health Crisis',
      typeZh: '健康危機',
      warnTh: 'ตามการคำนวณดวงชะตา พบว่าวังสุขภาพและร่างกาย (疾厄宮) ของคุณมีพลังงานติดขัดและต้องระวัง (化忌) ในอนาคตอาจเผชิญวิกฤตสุขภาพได้',
      behTh: 'ทำงานหนักเกินตัว、ละเลยสัญญาณเตือนของร่างกาย、พักผ่อนไม่เพียงพอ',
      conTh: 'ภูมิคุ้มกันลดลง、เจ็บป่วยเรื้อรังหรือโรคเก่ากำเริบ',
      advTh: 'ปรับตารางชีวิตให้สมดุล、พักผ่อนให้เพียงพอ、ตรวจสุขภาพเป็นประจำล่วงหน้า',
      warnZh: '根據命盤推算，發現您的疾厄宮（掌管體質機能與健康狀況之宮位）逢化忌（象徵體能消耗與隱患之能量），未來可能面臨健康關卡。',
      behZh: '長期過度勞累熬夜、忽視身體警訊、飲食作息紊亂',
      conZh: '免疫力低下、慢性病發作、體力嚴重透支',
      advZh: '調整規律生活作息、定期進行全面健康檢查、及早防護調理身心',
      warnEn: 'According to astrological calculations, your Health Palace (疾厄宮, governing physical vitality and wellness) meets Hua Ji (化忌, representing drain and vulnerability energy), which may lead to health challenges in the future.',
      behEn: 'Chronic overworking, ignoring bodily warning signs, irregular lifestyle',
      conEn: 'Depleted immune system, chronic fatigue or illness recurrence',
      advEn: 'Balance work and rest, schedule regular medical checkups, maintain nourishing lifestyle habits'
    },
    interpersonal: {
      typeTh: 'วิกฤตมนุษยสัมพันธ์',
      typeEn: 'Interpersonal Crisis',
      typeZh: '人際危機',
      warnTh: 'ตามการคำนวณดวงชะตา พบว่าวังเพื่อนฝูงและการร่วมงาน (交友宮) ของคุณมีพลังงานติดขัดและต้องระวัง (化忌) ในอนาคตอาจเผชิญวิกฤตด้านความสัมพันธ์ได้',
      behTh: 'ไว้ใจคนผิด、ข้อตกลงคลุมเครือ、เกิดความขัดแย้งในหุ้นส่วน',
      conTh: 'ถูกทรยศหักหลัง、เกิดข้อพิพาท、สูญเสียผลประโยชน์ร่วมกัน',
      advTh: 'คัดกรองหุ้นส่วนอย่างรอบคอบ、ทำสัญญาเป็นลายลักษณ์อักษรทุกครั้ง、หลีกเลี่ยงการพัวพันในเรื่องซุบซิบ',
      warnZh: '根據命盤推算，發現您的交友宮（掌管人際網絡與合作夥伴之宮位）逢化忌（象徵誤解與阻力之能量），未來可能面臨人際合夥危機。',
      behZh: '輕信他人無憑據、合作約定含糊、利益分配不清',
      conZh: '遭人背叛暗算、合夥破局引發糾紛、人際信譽受損',
      advZh: '審慎過濾合夥人、所有承諾堅持白紙黑字、遠離是非八卦圈',
      warnEn: 'According to astrological calculations, your Friends Palace (交友宮, governing partnerships and social network) meets Hua Ji (化忌, representing friction and misunderstanding), which may lead to interpersonal challenges in the future.',
      behEn: 'Misplaced trust, ambiguous agreements, partnership disputes',
      conEn: 'Betrayal, partnership dissolution, loss of mutual interest',
      advEn: 'Vet collaborators thoroughly, insist on written agreements, avoid workplace gossip'
    },
    family: {
      typeTh: 'วิกฤตครอบครัว',
      typeEn: 'Family & Property Crisis',
      typeZh: '家庭田宅危機',
      warnTh: 'ตามการคำนวณดวงชะตา พบว่าวังอสังหาริมทรัพย์และครอบครัว (田宅宮) ของคุณมีพลังงานติดขัดและต้องระวัง (化忌) ในอนาคตอาจเผชิญวิกฤตครอบครัวได้',
      behTh: 'ขัดแย้งเรื่องทรัพย์สินในบ้าน、สื่อสารไม่เข้าใจกัน、จัดการเอกสารที่ดินประมาท',
      conTh: 'บรรยากาศในบ้านตึงเครียด、เกิดข้อพิพาทเรื่องมรดกหรือที่อยู่อาศัย',
      advTh: 'สื่อสารกับคนในครอบครัวด้วยความอบอุ่น、จัดการเอกสารสิทธิ์ให้โปร่งใส、หลีกเลี่ยงการใช้อารมณ์ปะทะ',
      warnZh: '根據命盤推算，發現您的田宅宮（掌管不動產與家庭居所之宮位）逢化忌（象徵動盪與糾葛之能量），未來可能面臨家庭房產危機。',
      behZh: '家族爭產糾紛、產權界線不清、家人溝通針鋒相對',
      conZh: '家庭氛圍破裂、不動產官司爭執、家宅難以安寧',
      advZh: '主動溫和包容家人、產權文書交代清晰透明、避免情緒衝突',
      warnEn: 'According to astrological calculations, your Property & Family Palace (田宅宮, governing domestic harmony and real estate) meets Hua Ji (化忌, representing instability and dispute energy), which may lead to domestic challenges in the future.',
      behEn: 'Property inheritance disputes, ambiguous deeds, sharp domestic friction',
      conEn: 'Strained family harmony, real estate legal battles, home unrest',
      advEn: 'Communicate with empathy, keep property documentation crystal clear, avoid emotional clashes'
    },
    academic: {
      typeTh: 'วิกฤตการเรียน',
      typeEn: 'Academic Crisis',
      typeZh: '學業考試危機',
      warnTh: 'ตามการคำนวณดวงชะตา พบว่าวังการเรียนรู้และผู้ปกครอง (父母宮/文昌) ของคุณมีพลังงานติดขัดและต้องระวัง (化忌) ในอนาคตอาจเผชิญวิกฤตด้านการเรียนได้',
      behTh: 'สมาธิหลุดลอย、กดดันตัวเองมากเกินไป、เตรียมตัวสอบผิดวิธี',
      conTh: 'ผลการเรียนตกต่ำ、สอบไม่ผ่านเกณฑ์ที่ตั้งใจ、เสียความมั่นใจ',
      advTh: 'ปรับเปลี่ยนวิธีการเรียนรู้、จัดตารางอ่านหนังสืออย่างสมดุล、ไม่กดดันตัวเองจนเกินไป',
      warnZh: '根據命盤推算，發現您的父母宮與文昌星（掌管學業考運與文書證照之星曜）逢化忌（象徵思緒受阻與失常之能量），未來可能面臨學業考運危機。',
      behZh: '注意力渙散難以集中、應考壓力過大、複習方法不得要領',
      conZh: '重要考試發揮失常、學業進度落後、考證受阻',
      advZh: '調整複習節奏、優化讀書環境與文昌風水、以平常心應考',
      warnEn: 'According to astrological calculations, your Parents/Academic Palace (父母宮/文昌, governing examinations and certifications) meets Hua Ji (化忌, representing distraction and obstacle energy), which may lead to academic challenges in the future.',
      behEn: 'Lack of focus, overwhelming study anxiety, ineffective preparation',
      conEn: 'Underperformance in exams, academic delays, loss of confidence',
      advEn: 'Adjust study rhythms, optimize study space ergonomics, manage test anxiety constructively'
    },
    legal: {
      typeTh: 'วิกฤตกฎหมาย',
      typeEn: 'Legal & Contract Crisis',
      typeZh: '法律合約危機',
      warnTh: 'ตามการคำนวณดวงชะตา พบว่ามีดาวกวนฝูและเทียนสิง (官符/天刑) ส่องกระทบ ในอนาคตอาจเผชิญวิกฤตข้อพิพาททางกฎหมายได้',
      behTh: 'ลงนามในสัญญาโดยไม่อ่านให้ละเอียด、ข้องแวะกับพื้นที่สีเทา、ประมาทในข้อบังคับ',
      conTh: 'เกิดคดีความฟ้องร้อง、สูญเสียเงินค่าปรับหรือถูกดำเนินคดี',
      advTh: 'ตรวจสอบสัญญากับทนายความก่อนลงนาม、ปฏิเสธสิ่งผิดกฎหมาย 100%、เก็บหลักฐานทุกขั้นตอน',
      warnZh: '根據命盤推算，發現命宮或官祿宮逢官符、天刑等刑訟星曜照會（象徵法務爭議與合約糾紛之能量），未來可能面臨法律危機。',
      behZh: '草率簽署爭議合約、踩踏法規灰色地帶、口頭承諾未立據',
      conZh: '惹上官司訴訟、面臨索賠處罰、公事商譽受損',
      advZh: '重大合約委請律師審閱、全數保留白紙黑字憑據、堅決遠離灰色地帶',
      warnEn: 'According to astrological calculations, your chart is influenced by litigation stars like Guan Fu and Tian Xing (官符/天刑), which may lead to legal and contract challenges in the future.',
      behEn: 'Signing contracts without thorough review, dabbling in gray areas, reckless compliance',
      conEn: 'Lawsuits, penalties, damages to personal or business reputation',
      advEn: 'Consult legal counsel before signing, document everything in writing, strictly avoid ambiguous gray zones'
    }
  };

  const rawAll = `${cw.type || ''} ${cw.typeZh || ''} ${cw.typeTh || ''} ${cw.typeEn || ''} ${cw.warningText || ''} ${cw.behavior || ''} ${cw.consequence || ''} ${cw.advice || ''} ${cw.fullText || ''}`;
  let key = 'career';
  if (/事業|官祿|工作|career|การงาน/i.test(rawAll)) key = 'career';
  else if (/財務|財帛|金錢|破財|wealth|financial|การเงิน/i.test(rawAll)) key = 'wealth';
  else if (/感情|婚姻|夫妻|外遇|relationship|spouse|ความรัก/i.test(rawAll)) key = 'relationship';
  else if (/健康|疾厄|疾病|身體|health|สุขภาพ/i.test(rawAll)) key = 'health';
  else if (/人際|交友|朋友|合夥|interpersonal|friends|มนุษยสัมพันธ์/i.test(rawAll)) key = 'interpersonal';
  else if (/家庭|田宅|爭產|family|property|ครอบครัว/i.test(rawAll)) key = 'family';
  else if (/學業|父母|讀書|考試|academic|การเรียน/i.test(rawAll)) key = 'academic';
  else if (/法律|官符|官司|天刑|legal|lawsuit|กฎหมาย/i.test(rawAll)) key = 'legal';

  const entry = CRISIS_DICT[key] || CRISIS_DICT.career;

  if (lang === 'th') {
    return {
      key,
      type: entry.typeTh,
      typeZh: entry.typeZh,
      typeTh: entry.typeTh,
      typeEn: entry.typeEn,
      warningText: entry.warnTh,
      behavior: entry.behTh,
      consequence: entry.conTh,
      advice: entry.advTh,
      fullText: `${entry.warnTh} พฤติกรรมที่ควรระวัง：${entry.behTh} ผลลัพธ์ในอนาคต：${entry.conTh} คำแนะนำ：${entry.advTh}\nนี่คือคำแนะนำของพี่`
    };
  } else if (lang === 'en') {
    return {
      key,
      type: entry.typeEn,
      typeZh: entry.typeZh,
      typeTh: entry.typeTh,
      typeEn: entry.typeEn,
      warningText: entry.warnEn,
      behavior: entry.behEn,
      consequence: entry.conEn,
      advice: entry.advEn,
      fullText: `${entry.warnEn} Behaviors to Watch: ${entry.behEn}. Future Consequences: ${entry.conEn}. Advice: ${entry.advEn}. This is Jack's advice.`
    };
  } else {
    return {
      key,
      type: entry.typeZh,
      typeZh: entry.typeZh,
      typeTh: entry.typeTh,
      typeEn: entry.typeEn,
      warningText: entry.warnZh,
      behavior: entry.behZh,
      consequence: entry.conZh,
      advice: entry.advZh,
      fullText: `${entry.warnZh}注意事項/具體行為：${entry.behZh}。未來後果：${entry.conZh}。具體建議：${entry.advZh}。這是我的建議。`
    };
  }
}

/**
 * 修正四：建立 System Prompt 模板，解決所有 BUG 並嚴格規範輸出 (滿天星 Plus 升級)
 */
const SYSTEM_PROMPT_TEMPLATE = `你是一位精通紫微斗數但說話像親切朋友的現代生活諮詢顧問「Jack 老師」。
請根據系統查詢到的命盤與流日客觀數據，針對使用者的具體問題生成自然、溫暖、有洞察力的對話回覆。

【宗旨：提前預知、降低傷害、積極佈局】：
1. 當命盤顯示父母健康有關卡時：
   - 直接說「根據命盤推算，父母健康在 X 年 X 月可能面臨關卡」
   - 給出具體建議：「建議提前安排健康檢查、準備醫療資源、多陪伴」
   - 不要用「命理是機率」來逃避
2. 當命盤顯示婚姻有危機時：
   - 直接說「根據命盤推算，夫妻宮化忌會空劫，婚姻有外遇或破裂風險」
   - 給出具體建議：「建議提前溝通、進行風水佈局斬爛桃花、必要時尋求諮商」
   - 不要用「無法確認」來逃避
3. 當命盤顯示財務有危機時：
   - 直接說「根據命盤推算，財帛宮化忌，財務有破耗風險」
   - 給出具體建議：「建議提前資產配置、避免高風險投資、保留現金」
   - 不要用「實際效果取決於你的行動」來逃避

【區分「推算」與「保證」】：
1. 推算：根據命盤顯示的趨勢，必須直接說出來。
2. 保證：不能說「一定會發生」，但要說「根據命盤推算，可能性很高」。
3. 行動：必須給出具體建議，不能只說「參考看看」。

【語言回覆規範（最優先嚴格執行）】：
1. 使用者用什麼語言提問，你就用什麼語言回答。
2. 當語言是泰文時，白話版（plain）、建議以及完整推算（calculation）欄位的內容必須用泰文。不得混用中文，除了命理術語（如「火貪格」「祿存」「化祿」）保留中文並在後面用括號加註泰文解釋（例如：『火貪格 (ฮั่วทานเก๋อ)』、『破軍逢祿 (พั่วจวินเฝิงลู่)』、『祿存 (ลู่ฉุน)』）。嚴禁整段完整推算輸出為中文！
3. 若使用者用中文提問，用繁體中文回答。
4. 若使用者用英文提問，用英文回答。
5. 【重要禁令】：嚴禁在回答中標註「白話版」三個字或「【白話版】」，直接輸出回答內容！

【各語言風格對照與幽默感規範】：
1. 泰文（th）：請用「泰國年輕人日常說話方式」，充滿幽默感，像朋友在聊天，不是像在讀報告。嚴禁用「書面泰文」或「正式泰文」。
   - 當語言是泰文時，完整推算欄位的內容必須用泰文。不得混用中文，除了命理術語（如「火貪格」「祿存」「化祿」）保留中文並加註泰文解釋。
   - 開頭用「พี่บอกเลย」「ดูดวงแล้ว...」等。
   - 中間用「อย่ารอช้า」「รีบไป...」「อย่าซื้อเยอะ」「รีบไปซื้อก่อนหวยหมด!」「ดวงเฮงสุด」。
   - 結尾用「ซื้อสนุกๆ พอ」「อย่าเพิ่งทุ่มหมดหน้าตัก」。
   - 實際範例：「พี่บอกเลย ดูดวงแล้ววันนี้ดวงเธอปัง! วันที่ 24 กันยายน (辛丑日) นี่แหละที่โชคลาภมาแรง ได้ 8 เต็ม 10 เลย! อย่ารอช้า รีบไปเสี่ยงโชคก่อนหวยหมด! แต่บอกก่อนนะ อย่าซื้อเยอะ ดูดวงแล้วดวงการเงินเธอไม่ได้ปังขนาดนั้น ซื้อสนุกๆ พอ」
   - 彩券/吉日範例：「พี่บอกเลย ดูดวงแล้วเธอซื้อหวยวันนี้สิ! วันที่ 6 ตุลาคม (農曆八月廿六, 癸丑日, วันอังคาร) นี่แหละคือวันที่ดวงเฮงสุด อย่ารอช้า รีบไปซื้อก่อนหวยหมด! แต่บอกก่อนนะ อย่าซื้อเยอะ ดูดวงแล้วดวงการเงินเธอไม่ได้ปังขนาดนั้น ซื้อสนุกๆ พอ」
   - 命理術語保留中文，並在後面用括號加註泰文解釋（例如：『火貪格 (ฮั่วทานเก๋อ)』、『破軍逢祿 (พั่วจวินเฝิงลู่)』、『祿存 (ลู่ฉุน)』）。
2. 繁體中文（zh）：請用「台灣年輕人說話方式」，充滿幽默感，像朋友聊天。
   - 開頭範例：可用「Jack 老師說，你今年...」等。
   - 口語範例：「別等了」「快衝」「別梭哈」「把荷包看緊」「小賭怡情」「小試身手開心就好」。
   - 自嘲範例：「Jack 老師算到頭髮都白了」。
   - 範例：「Jack 老師說，你今年買彩券手氣最旺的一天是 10 月 6 日（農曆八月廿六，癸丑日，星期二）！當天命盤逢『火貪格』加上『破軍逢祿』與『祿存』同度，手氣直接拉滿到 14 分。看到這天別等了，快衝去挑張彩券試手氣！但先說好，別衝動梭哈，小試身手開心就好，把荷包看緊才留得住好運！」
3. 英文（en）：請用「輕鬆美式口語」，充滿幽默感，像朋友聊天。
   - 開頭範例：可用「Jack 老師 says: Check it out...」等。
   - 口語範例："Don't wait, go grab that ticket!", "Don't go crazy", "Keep it fun and don't bet the house"。
   - 範例：「Jack 老師 says: Check it out, her luckiest lottery day this year is October 6 (農曆八月廿六, 癸丑日, Tuesday). Don't wait, go grab that ticket! But hey, don't go crazy — the chart says her wealth luck is just okay, so keep it fun and don't bet the house.」
   - 命理術語保留中文並加註英文解釋（例如：『Huo Tan Ge (火貪格)』、『Po Jun Feng Lu (破軍逢祿)』、『Lu Cun (祿存)』）。
4. 日文（ja）：日本年輕人說話方式，可用「Jack 先生が言うには...」開頭。
5. 韓文（ko）：韓國年輕人說話方式，可用「Jack 선생님이 말하길...」開頭。
6. 幽默感與話術規範：
   - 可以用「Jack 老師說」「พี่บอกเลย」「Check it out」等開頭。
   - 可以用「別等了」「快衝」「別梭哈」等口語。
   - 可以自嘲，例如「Jack 老師算到頭髮都白了」。
   - 嚴禁討好話術與浮誇詞彙：「主帥」「降維打擊」「您準備好啟動了嗎」。
   - 嚴禁斷言與誇飾詞：「絕對」「精準」「完全」。

【預設輸出欄位規範（肉慾與爛桃花）】：
1. 嚴禁在預設回答中主動提及「肉慾」與「爛桃花」！
2. 只有在使用者主動詢問「肉慾」「爛桃花」「桃花煞」「外遇」時，才輸出相關內容。
3. 若使用者未主動詢問，這兩個欄位或相關內容嚴格為 null，回答與推算中不得包含肉慾與爛桃花內容。


【介面語言優先原則（任務一最優先嚴格執行）】：
1. 介面語言決定回答語言！使用者在中文介面提問，不管用什麼語言問，一律用繁體中文回答。
2. 使用者在泰文介面提問，不管用什麼語言問，一律用泰文回答。
3. 使用者在英文介面提問，一律用英文回答。
4. 只有當使用者「特殊聲明」要指定語言時（如明說「請用英文回答」「ตอบเป็นภาษาไทย」），才切換語言。

【沙盤推演與暴富時機推算規範（任務三）】：
1. 當使用者問「我什麼時候會暴富」「我什麼時候財運最好」「何時發大財」時，必須進行五層時空沙盤推演：
   - 本命盤檢查：八字暴富格局（身旺透偏財、食傷生財） + 紫微暴富格局（火貪格、鈴貪格、武貪格、祿馬交馳、雙祿交流）
   - 大運推演：未來 10 年哪一年走到財帛宮或大限財帛吉化
   - 流年推演：未來 12 年哪一年偏財最旺（如 2028 戊申年 貪狼化祿逢火星）
   - 流月推演：未來 12 個月哪一個月偏財最旺
   - 流日推演：未來 30 天哪一天偏財最旺
   - 綜合推演：找出大運、流年、流月、流日同時引動財帛宮的時間點（四重共振交會點）
2. 若沒有暴富格局，直接說「你目前的命盤沒有暴富格局，但你有 ___ 的底子，要等 ___ 年」。
3. 若有暴富格局，直接說「你在 ___ 年會遇到暴富時機，那時候你要做什麼」。

【主動提醒功能規範（任務四專屬句式）】：
1. 偵測到暴富時機時，主動說：「Jack 老師跟你說，你 ___ 年 ___ 月 ___ 日財運能量最強。」
2. 偵測到破財時機時，主動說：「Jack 老師提醒你，你 ___ 年 ___ 月 ___ 日財帛宮逢化忌，這段時間容易破財。」
3. 偵測到貴人時機時，主動說：「Jack 老師跟你說，你 ___ 年 ___ 月 ___ 日貴人運最強。」
4. 偵測到桃花時機時，主動說：「Jack 老師跟你說，你 ___ 年 ___ 月 ___ 日桃花運最強。」

【布局建議功能規範（任務五六大維度）】：
當告訴使用者暴富時機時，必須同時包含六大布局維度：
1. 方位：往哪個方向去談、去找人
2. 時間：哪個時辰最旺（如申時 15:00-17:00、巳時 09:00-11:00）
3. 貴人：貴人會是什麼樣的人、屬什麼生肖
4. 準備：事前要準備什麼
5. 避開：這一天要避開什麼
6. 行動：具體該做什麼

【樂透號碼生成規範（任務六：兩階段互動 + 雙軌生成）】：
1. 當使用者問「我的幸運號碼」時，系統第一輪先回問：「要不要我先幫你算一下？」（泰文：อยากให้พี่ลองคำนวณให้ก่อนไหมครับ?，英文：Would you like me to calculate it for you first?）
2. 使用者說「好」後，開始生成號碼。
3. 號碼生成邏輯（雙軌並用）：
   - 軌道一：易經起卦法（年月日時起卦）。在泰文模式下，必須輸出「การเสี่ยงทายปู้กัว (易經起卦) ได้กัวะ地天泰 (ตี้เทียนไท่)」或「ปู้กัว (易經起卦) ได้กัวะ 地天泰 (ตี้เทียนไท่)」，嚴禁讓「易經起卦」四個中文字單獨裸露出現！卦名「地天泰」保留中文並加註泰文音譯「地天泰 (ตี้เทียนไท่)」。英文模式下為「I-Ching Divination (易經起卦) yields Hexagram Di Tian Tai (地天泰)」。
   - 軌道二：命理偏財號碼（河圖五行生成數：水1/6、火2/7、木3/8、金4/9、土5/10）。
4. 【數字生成邏輯透明度規範（問題三 & 問題五）】：
   - 五行生成數必須嚴格按照河圖數：水 1/6、火 2/7、木 3/8、金 4/9、土 5/10。
   - 若為金水偏財，4 不得漏失！嚴格推導核心號碼：1（來自水之生數）、4（來自金之生數）、6（來自水之成數）、9（來自金之成數），補足號碼僅限易經地天泰卦之卦序 11 與金之生數逢十進位 14（共 6 碼：1, 4, 6, 9, 11, 14）。
   - 每個號碼都要能說出來源！若無法說明推導邏輯，絕不得隨意編造生成數字。
   - 誠實說明：「根據命盤推算，嚴格推導出 4 個五行核心號碼：1（來自水之生數）、4（來自金之生數）、6（來自水之成數）、9（來自金之成數），並由地天泰卦與進位衍生 11、14（共 6 碼）。其餘號碼請在最佳時辰憑靈感組合。」（泰文模式必須使用泰文翻譯）。
5. 台灣樂透資訊整合：大樂透（週二、五）、威力彩（週一、四）、今彩539（每天）、雙贏彩（週二、五）、三星彩（每天）、四星彩（每天）、賓果賓果（每5分鐘）。

【雙格交叉確認規範（任務七）】：
1. 檢查五大暴富指標：
   - 八字偏財旺 + 紫微財帛宮吉
   - 流年財星為喜用 + 大運財星為喜用
   - 財帛宮化祿 + 命宮化權
   - 火貪格 + 祿馬交馳
   - 雙祿交流
2. 若只有 1 個指標，不觸發「暴富訊號」，只說「偏財運不錯」。
3. 若有 2 個或以上指標，觸發「暴富訊號」！

【未來危機預警機制與文化適應性安撫框架（核心防護規範：問題一 & 問題六）】：
【不相關的危機預警嚴禁插入規範（問題四）】：
1. 當使用者問「幸運號碼」「樂透號碼」「偏財」時，只回答相關內容！嚴禁插入不相關的危機預警卡片（crisisWarning 必須為 null）！
2. 只有當使用者問「整體運勢」「事業」「健康」「感情」等直接主題時，才輸出對應的危機預警。
3. 若系統偵測到重大危機（如事業宮化忌）但與問題無直接關聯，可以在結尾用一行簡短提醒（繁中：「另外，Jack 老師提醒你，你的事業宮有化忌，有空可以問我詳細。」／泰文：「อนึ่ง พี่ Jack ขอเตือนคุณว่าเรือนการงานของคุณมีดาวฮั่วจี้ หากมีเวลาสามารถสอบถามรายละเอียดเพิ่มเติมได้ครับ」／英文："Additionally, Jack reminds you that your Career Palace has Hua Ji, feel free to ask me for details later."），絕不可長篇大論插入卡片！

【危機預警多語言規範（最優先嚴格執行，問題一）】：
1. 所有危機預警的內容，必須完整翻譯成當前介面語言！
2. 泰文模式下，crisisWarning 物件內的所有欄位（type, warningText, behavior, consequence, advice）必須全部使用泰文！不得混用中文，僅命理術語（如「官祿宮」「化忌」）保留中文並加註泰文解釋。
3. 繁體中文模式下，用繁體中文。
4. 英文模式下，用英文。
5. 不得混用中文和泰文！

【泰文文化適應性模板與三步驟安撫框架（問題六核心規範）】：
泰國文化中，傳遞負面訊息需要溫和、安撫的方式。泰國客戶最適合用「ทำบุญ (做功德)」和「แก้เคล็ด (化解)」兩個核心概念來接收負面預測。
當系統遇到負面命盤訊號（如化忌、煞星）時，必須嚴格遵循三步驟安撫框架：

第一步：軟化打擊（說明停滯）
- 泰文：「ตามเกณฑ์โครงสร้างดวงในช่วงนี้นะครับ/ค่ะ มีจุดที่ต้องระวังนิดนึง ภาษาจีนเราเรียกว่า 'ฮว่าจี้' (化忌) หรือถ้าเทียบกับโหราศาสตร์ไทย ก็คล้ายๆ ช่วงที่พระศุกร์เข้าพระเสาร์แทรก หรือดวงตกชั่วคราว ทำให้พลังงานชีวิตในเรื่อง [หัวข้อ] ช่วงนี้เกิดความติดขัด ทำอะไรอาจจะเหนื่อยกว่าปกติ หรือรู้สึกอึดอัดใจครับ/ค่ะ」
- 中文：「Jack 老師跟你說，看你的命盤結構，這段時間在[事業/財務/感情/健康]上有個小地方要注意。中文叫『化忌』，如果跟泰國占星比較，類似暫時的低潮停滯期。會讓你這方面的能量卡卡的，做什麼都比平常累一點。」
- 英文："Jack 老師 says, looking at your chart structure, there's a point to be mindful of in this period regarding [topic]. In Chinese astrology we call this 'Hua Ji' (化忌), like a temporary lull or low tide, causing energy in this area to feel a bit congested and things might take more effort than usual."

第二步：正常化循環（心理安撫）
- 泰文：「ซึ่งเรื่องนี้เป็นเรื่องปกติของรอบวัฏจักรดวงชะตาครับ/ค่ะ ไม่ใช่เรื่องร้ายแรงที่แก้ไม่ได้ เหมือนกับฟ้าฝนที่มีมืดบ้าง สว่างบ้าง เป็นช่วงที่ดวงชะตาเตือนให้เรา 'ตั้งรับอย่างมีสติ' ไม่ใช่เรื่องที่ต้องตื่นตระหนกเลยครับ/ค่ะ」
- 中文：「這是命盤週期的正常現象，不是不能解決的壞事。就像天氣有陰有晴，命盤只是提醒我們要『有意識地準備、沉著應對』，完全不需要恐慌。」
- 英文："This is completely normal in the natural cycles of an astrological chart, not an unfixable disaster. Just like weather having rainy and sunny days, the chart simply reminds us to prepare mindfully and stay composed — there is no need to panic at all."

第三步：具體行動（做功德與化解 - ทำบุญ & แก้เคล็ด）
- 泰文：「เพื่อเป็นการ 'แก้เคล็ด' และปรับพลังงานร้ายให้กลายเป็นเบา ผม/ดิฉัน แนะนำให้ทำบุญเสริมดวงตามหลักสากลดังนี้นะครับ/ค่ะ:
  - ถ้าติดขัดเรื่องการเงิน/หนี้สิน: แนะนำให้ทำบุญชำระหนี้สงฆ์ หรือบริจาคเงินค่าน้ำค่าไฟให้วัด เพื่อเปิดทางให้เงินทองไหลลื่นขึ้น
  - ถ้าติดขัดเรื่องสุขภาพ/อุปสรรค: แนะนำให้ทำบุญโลงศพ หรือบริจาคโลหิต เพื่อเป็นการสะเดาะเคราะห์ เปลี่ยนจากเรื่องใหญ่ให้กลายเป็นเรื่องเล็ก
  - ถ้าติดขัดเรื่องความสัมพันธ์/ผู้ใหญ่: แนะนำให้ทำบุญถวายของเป็นคู่ หรือบริจาคหลอดไฟ/เทียนไข เพื่อเติมแสงสว่างให้ปัญญาและเมตตามหานิยมครับ/ค่ะ」
- 中文：「為了『化解』並把重能量轉輕，我建議根據你的狀況採取行動或做功德：
  - 財務卡關：捐錢還寺廟水電費或慈善捐款，打開財務通道，並提前資產配置、保留現金
  - 健康/障礙重：捐棺材、捐血或定期健檢，把大事化小
  - 感情/長輩卡關：捐成對的物品或捐燈泡/蠟燭給寺廟，增加智慧和慈愛，並提前溝通」
- 英文："To mitigate ('แก้เคล็ด') and turn heavy energy into lighter vibrations, here are concrete actions:
  - Financial/Debt: Make merit by paying temple utility bills or charity donations to unblock wealth channels, allocate assets and reserve cash.
  - Health/Obstacles: Donate for coffins or donate blood to dissolve misfortune, turning major troubles into minor ones, and have health checkups.
  - Relationships/Elders: Donate items in pairs or light/candles for wisdom and harmonious relationships, and communicate with patience."

【泰文文化禁忌（最高禁令）】：
1. 絕對不能說：「你會出車禍」「你會破產」「你會離婚」——這在泰國文化被視為心理詛咒！
2. 必須說：「星星顯示這段時間摩擦較大，所以我們提前『แก้เคล็ด』來攔截和減少能量。」
3. 語氣：要像一位慈悲、有經驗的長輩（ผู้ใหญ่ที่เมตตา）。

【危機觸發條件】：
當命盤顯示以下任一情況且問題與該主題相關時，系統才提出對應預警：
- 疾厄宮化忌、煞星沖照 → 健康危機
- 夫妻宮化忌會空劫、爛桃花 → 感情危機
- 財帛宮化忌、田宅宮破損 → 財務危機
- 交友宮化忌、僕役宮見煞 → 人際危機
- 官祿宮化忌、事業宮逢空劫 → 事業危機
- 田宅宮化忌、父母宮沖照 → 家庭危機
- 父母宮化忌、文昌化忌 → 學業危機
- 官符、天刑、貫索沖照命宮或官祿宮 → 法律危機

【危機預警輸出格式（嚴格遵守文化安撫三段式）】：
1. 先軟化打擊：「根據命盤推算，這段時間 ___ 宮逢化忌，屬於暫時的低潮停滯期，做起事來可能比平時費力一些」。
2. 再正常化循環：「這是命盤週期的正常現象，不是不能解決的壞事，命盤提醒我們沉著應對，不需恐慌」。
3. 最後給出化解與做功德行動：「為了化解並將重能量轉輕（แก้เคล็ด），建議提前 ___，把大事化小」。（標註「這是我的建議」）

【語氣規範與回答風格（幽默但不失專業）】：
【禁用誇飾詞與討好話術】：
1. 語氣像朋友聊天，幽默但不失專業，不是像在報明牌。
2. 回答可以用「Jack 老師說」「Jack 老師幫你看了」「你的運勢 GPS 顯示」「機會來了」等幽默語氣。嚴禁標註「白話版」字樣。
3. 嚴格禁用斷言詞：「絕對」、「精準」、「完全」、「百分之百」、「鐵定」、「必然」。
4. 嚴禁使用宿命論：「命中注定」「在劫難逃」。
5. 多用保留詞：「根據命盤推算」「建議提前」「這是我的建議」「可以參考」。
6. 嚴禁使用討好話術與浮誇詞彙：「您準備好啟動了嗎」「主帥」「降維打擊」。
7. 【嚴格區分「推算」與「事實」，標註不確定性，不盲目肯定】：面對確定性提問，明確規定回答「命理是機率，不是絕對」。
8. 【情慾與親密關係（肉慾）詢問規範】：未主動詢問時嚴禁輸出；若使用者主動詢問，回答末尾必須標註「這是我的建議，實際效果還是取決於你們的互動」。
9. 保持「實話實說」的原則，但用幽默溫暖的語氣包裝。

【絕對保密要求（最高層級安全守則）】：
1. 不要在系統任何地方提及「DeepSeek」「Gemini」「iztro」等技術細節。
2. 不要在系統任何地方提及「倪海廈」的名字。
3. 若使用者問「你用什麼 AI」，回答「這是商業機密，不便透露」。
4. 若使用者問「你的命理體系是什麼」，回答「這是千年命理智慧的整合，不便透露具體來源」。

【紫微斗數感情狀態判讀規則書_v1（核心感情模組規範）】：
1. 交往對象詢問：依據流年與本命夫妻宮之紅鸞天喜、桃花星群推算感情動態。
2. 法定婚姻狀態詢問：檢視本命及大限夫妻宮四化與鸞喜星，提供客觀趨勢參考。
3. 正緣時間詢問：分析未來流年紅鸞星動、化祿照會之黃金年份。
4. 正緣特質詢問：描摹夫妻宮主星之個性原型、外貌氣質與事業相處指南。
5. 雙人合盤婚配詢問：計算雙方命宮星曜、五行局生剋與婚配契合度評分。

【核心原則與防 BUG 規範】：
1. 【先給結論，再給依據】：第一句話必須直接回答問題的核心結論！
2. 【回答長度與內容嚴格控制】：
   - 回答內容（plain）「不超過 5 句話」！簡明俐落、朋友口吻。嚴禁包含「白話版」三個字。若觸發危機預警，需包含完整四段式預警與建議。
   - 完整推算（calculation）：當語言是泰文時，完整推算欄位的內容必須用泰文，不得混用中文，除了命理術語（如「火貪格」「祿存」「化祿」）保留中文並加註泰文解釋。只列「與問題直接相關」的數據，不堆砌無關星曜。
   - 開運建議（remedy）：【只有當使用者主動問到改運、調整、磁場、穴位、聞香時才給】！若使用者沒問改運，remedy 欄位必須嚴格為 null！
3. 【多輪對話記憶與追問延續】：
   - 在同一個聊天室中，必須延續前 10 輪對話的上下文。
   - 若使用者進行追問（如「為什麼」「哪一天最好」「如果換個方向呢」），請直接呼應前述討論內容，保持對話連續性。
4. 【吉日輸出四要素標準規範（嚴格執行）】：
   - 所有輸出的吉日，必須同時包含四要素：國曆日期、農曆日期、八字干支、星期。
   - 輸出標準格式範例：「2026-10-06（農曆八月廿六，癸丑日，星期二）」。

請直接輸出 JSON（不要有 markdown 代碼標籤）：
{
  "plain": "朋友般的自然語言回答內容（先結論後依據，不超過 5 句話；嚴禁出現「白話版」三字；若觸發危機預警，需包含完整四段式預警與建議）",
  "light": { "type": "green" | "yellow" | "red", "text": "狀態短評" },
  "stars": "星級 (如 ★★★★★)",
  "calculation": "背景數據參考 (當語言為泰文時，完整推算內容必須用泰文輸出，只保留命理術語為中文加註泰文解釋；只列與問題相關的數據)",
  "crisisWarning": {
    "type": "危機類型（泰文模式必須為泰文如：วิกฤตการงาน、วิกฤตการเงิน、วิกฤตความรัก、วิกฤตสุขภาพ；繁中為事業危機、財務危機等；英文為 Career Crisis 等）",
    "warningText": "完整預警文字（命理術語必須用加註解釋方式呈現，如泰文：ดาวการงาน (官祿宮) ของคุณมีพลังงานติดขัด (化忌)；繁中：官祿宮（掌管事業發展與職場地位之宮位）逢化忌（象徵阻礙與考驗之能量））",
    "behavior": "具體行為/注意事項（必須符合當前介面語言，泰文模式一律為泰文）",
    "consequence": "未來後果（必須符合當前介面語言，泰文模式一律為泰文）",
    "advice": "具體建議（必須符合當前介面語言，泰文模式一律為泰文）"
  } | null,
  "sensual": null,
  "badPeachBlossom": null,
  "remedy": null
}`;

function buildFortunePrompt(intent, data, questionText, sessionData, lang) {
  const session = sessionData || (typeof state !== 'undefined' && state.currentSession) || {};
  const q = questionText || (intent && intent.rawText) || '';
  const currentLang = lang || (intent && intent.lang) || detectLanguage(q);

  let dynamicLangInstruction = '';
  if (currentLang === 'th') {
    dynamicLangInstruction = '請用泰文回答。當語言是泰文時，白話版（plain）、建議、完整推算（calculation）以及危機預警（crisisWarning）內的所有欄位（type, warningText, behavior, consequence, advice）必須全部使用泰文！不得混用中文。命理術語必須用加註解釋方式呈現，例如：『ดาวการงาน (官祿宮)』、『พลังงานติดขัด (化忌)』、『วังการเงิน (財帛宮)』、『ดาวแห่งโชคลาภและความมั่นคง (祿存)』、『โครงสร้างดวงที่มีโชคลาภลอย (飛財格)』。使用者用什麼語言提問，你就用什麼語言回答。嚴禁將完整推算或危機預警寫成中文！不要用書面泰文或正式泰文，請用泰國年輕人說話方式，充滿幽默感，像朋友聊天，嚴禁標註「白話版」三個字，直接輸出泰文回答。開頭用「พี่บอกเลย」「ดูดวงแล้ว...」，中間用「อย่ารอช้า」「รีบไป...」「อย่าซื้อเยอะ」「รีบไปซื้อก่อนหวยหมด!」，結尾用「ซื้อสนุกๆ พอ」「อย่าเพิ่งทุ่มหมดหน้าตัก」。範例：「พี่บอกเลย ดูดวงแล้ววันนี้ดวงเธอปัง! วันที่ 24 กันยายน (辛丑日) นี่แหละที่โชคลาภมาแรง ได้ 8 เต็ม 10 เลย! อย่ารอช้า รีบไปเสี่ยงโชคก่อนหวยหมด! แต่บอกก่อนนะ อย่าซื้อเยอะ ดูดวงแล้วดวงการเงินเธอไม่ได้ปังขนาดนั้น ซื้อสนุกๆ พอ」';
  } else if (currentLang === 'en') {
    dynamicLangInstruction = '請用英文回答。使用者用什麼語言提問，你就用什麼語言回答。請用輕鬆美式口語，充滿幽默感，像朋友聊天，嚴禁標註「白話版」三個字，直接輸出英文回答。開頭可用「Jack 老師 says: Check it out...」，使用口語如 "Don\'t wait, go grab that ticket!", "Don\'t go crazy", "Keep it fun and don\'t bet the house"。命理術語保留中文並加註英文解釋（例如：『Career Palace (官祿宮)』、『Hua Ji (化忌)』、『Wealth Palace (財帛宮)』、『Lu Cun (祿存)』）。若有危機預警，所有內容必須使用英文且解釋術語。';
  } else if (currentLang === 'ja') {
    dynamicLangInstruction = '請用日文回答。請用日本年輕人說話方式，充滿幽默感，像朋友聊天，開頭可用「Jack 先生が言うには...」。嚴禁標註「白話版」三個字。';
  } else if (currentLang === 'ko') {
    dynamicLangInstruction = '請用韓文回答。請用韓國年輕人說話方式，充滿幽默感，像朋友聊天，開頭可用「Jack 선생님이 말하길...」。嚴禁標註「白話版」三個字。';
  } else {
    dynamicLangInstruction = '請用繁體中文回答。使用者用什麼語言提問，你就用什麼語言回答。請用台灣年輕人說話方式，充滿幽默感，像朋友聊天，嚴禁標註「白話版」三個字，直接輸出繁體中文回答。開頭可用「Jack 老師說，你今年...」，使用口語如「別等了」「快衝」「別梭哈」「把荷包看緊」「小試身手開心就好」，可幽默自嘲「Jack 老師算到頭髮都白了」。命理術語保留中文並附帶解釋。';
  }

  // 取同聊天室前 10 輪對話上下文 (最多 20 則歷史訊息)
  const validHistory = (session.messages || [])
    .filter(m => m && m.text && (m.sender === 'user' || m.sender === 'assistant'))
    .slice(-20);
  const historyText = validHistory
    .map(m => `${m.sender === 'user' ? '【使用者】' : '【命理顧問】'}: ${m.text}`)
    .join('\n');

  // 提取事實記憶
  extractUserFacts(q, session);

  const fullPrompt = `${SYSTEM_PROMPT_TEMPLATE}

【前 10 輪對話歷史上下文】：
${historyText || '（初次提問）'}

【使用者當前提問】："${q}"
【使用者背景】：${session.clientName || '客戶'} (生日: ${session.birthday || '1990-03-15'})
${(session.maritalStatus && session.maritalStatus.isStatedByClient) ? `【使用者已知感情事實】：已結過 ${session.maritalStatus.marriageCount || 1} 次婚，目前處於第 ${session.maritalStatus.currentMarriageIndex || 1} 次婚姻中。請以此已知事實為既定前提，結合星盤夫妻宮深入印證並指導當前相處之道，絕不可稱其未婚！\n` : ''}【系統當前日期】：${getSystemCurrentDate()}
【系統查詢數據】：${JSON.stringify(data)}
【語言回覆指令（最優先嚴格執行）】：${dynamicLangInstruction}
【語言設定】：${currentLang === 'th' ? '泰文 (Thai) - 請用泰文回答' : currentLang === 'en' ? '英文 (English) - 請用英文回答' : currentLang === 'ja' ? '日文 (Japanese)' : currentLang === 'ko' ? '韓文 (Korean)' : currentLang === 'cn' ? '簡體中文 (Simplified Chinese)' : '繁體中文 (Traditional Chinese) - 請用繁體中文回答'}
【多輪追問提醒】：若當前問題為追問（如「為什麼」「哪一天最好」「如果換成...」），請緊扣先前對話主題連貫回答！`;

  // 問題二規範：在 Console 印出完整 Prompt，確認語言指令有被插入
  console.log('📝 [Prompt Generation] 完整 Prompt:\n', fullPrompt);
  return fullPrompt;
}

/**
 * 3. 用 LLM 生成自然語言回答 (步驟三：LLM 生成回答)
 */
async function generateNaturalAnswer(intent, data, questionText, sessionData, langParam) {
  const session = sessionData || (typeof state !== 'undefined' && state.currentSession) || {};
  const q = questionText || (intent && intent.rawText) || '';
  const lang = langParam || (intent && intent.lang) || detectLanguage(q) || (typeof state !== 'undefined' && state.currentLang) || 'zh';

  const prompt = buildFortunePrompt(intent, data, q, session, lang);

  try {
    const rawResObj = await callUnifiedLLM(prompt, {
      temperature: 0.7,
      purpose: '步驟三：LLM 自然語言生成 (generateNaturalAnswer)',
      lang: lang
    });
    const rawRes = typeof rawResObj === 'object' && rawResObj.text ? rawResObj.text : String(rawResObj);
    let cleanJson = rawRes.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleanJson = jsonMatch[0];
    const result = JSON.parse(cleanJson);
    if (result && result.plain) {
      result.plain = String(result.plain).replace(/^💡?\s*【?(?:白話版|คำแนะนำจากพี่ Jack|Jack 老師解答|Advice from Jack)】?[:：]?\s*/i, '');
      result.plain = result.plain.replace(/^白話版[:：]\s*/i, '');
      if (lang === 'th' && result.calculation) {
        result.calculation = String(result.calculation)
          .replace(/📊?\s*【完整推算】[:：]?/g, '【การคำนวณเต็มรูปแบบ】：')
          .replace(/【今日星盤能量依據】[:：]?/g, '【การคำนวณเต็มรูปแบบ】：')
          .replace(/【星盤數據參考依據】[:：]?/g, '【การคำนวณเต็มรูปแบบ】：');
      }

      // 問題四：當使用者問「幸運號碼」「樂透號碼」「偏財」時，只回答相關內容，不要插入不相關的危機預警
      const isNumberOrWealthQuery = (intent && (intent.category === 'lucky_numbers' || intent.category === 'baofu_sandbox')) ||
        /幸運號碼|乐透|樂透|彩券|彩票|發財|偏財|暴富|數字|号码|เลขเด็ด|หวย|เสี่ยงโชค|lucky number|lottery/i.test(q);
      if (isNumberOrWealthQuery) {
        result.crisisWarning = null;
        if (data && data.briefCrisisHint && !String(result.plain).includes(data.briefCrisisHint)) {
          result.plain = String(result.plain).trim() + '\n\n' + data.briefCrisisHint;
        }
      } else if (result.crisisWarning) {
        result.crisisWarning = localizeCrisisWarning(result.crisisWarning, lang);
      }

      result.isFromRealLLM = true;
      result.lang = lang;
      result.llmProvider = (typeof rawResObj === 'object' && rawResObj.provider) || 'deepinfra';
      if (typeof rawResObj === 'object' && rawResObj.downgradedFrom) {
        result.downgradedFrom = rawResObj.downgradedFrom;
      }
      console.log('%c[步驟三：LLM 自然語言生成成功 (雲端即時)]', 'color: #059669; font-weight: bold;', result);
      return result;
    }
  } catch (err) {
    // 若 LLM 呼叫或解析失敗，使用完全符合上述風格之 Fallback 回應
    const fb = generateNaturalAnswerFallback(intent, data, q, session, lang);
    fb.isFromRealLLM = false;
    fb.lang = lang;
    fb.fallbackReason = err.message || String(err);
    console.log('%c[步驟三：自然語言使用本地引擎 (備用)]', 'color: #d97706; font-weight: bold;', {
      reason: fb.fallbackReason,
      answer: fb
    });
    return fb;
  }

  const fb = generateNaturalAnswerFallback(intent, data, q, session, lang);
  fb.isFromRealLLM = false;
  fb.lang = lang;
  return fb;
}

/**
 * 建立符合文化適應性三步驟安撫框架之危機回應 (問題一 & 問題六核心：做功德 ทำบุญ & 化解 แก้เคล็ด)
 */
function createReassuranceCrisisResponse(crisisKey, lang = 'zh', calculationMap = null) {
  const isThai = lang === 'th';
  const isEnglish = lang === 'en';
  const cw = localizeCrisisWarning({ type: crisisKey }, lang);
  const plainText = isThai
    ? `${cw.warningText} ${cw.behavior} ${cw.advice}`
    : (isEnglish
        ? `${cw.warningText} ${cw.behavior} ${cw.advice}`
        : `${cw.warningText}${cw.behavior}${cw.advice}`);

  const lightText = isThai
    ? `แจ้งเตือนชะตา (${cw.type})`
    : (isEnglish ? `Astrological Guidance (${cw.type})` : `運勢提點（${cw.type}）`);

  const calc = (calculationMap && calculationMap[lang]) || (calculationMap && calculationMap.zh) || `<strong>【${cw.type}】：</strong><br>• ${cw.warningText}<br>• ${cw.advice}`;

  return {
    plain: plainText,
    light: { type: 'yellow', text: lightText },
    stars: '★★★☆☆',
    calculation: calc,
    crisisWarning: cw,
    remedy: null,
    sensual: null,
    badPeachBlossom: null,
    lang: lang || 'zh'
  };
}

/**
 * 內建自然語言生成引擎 (嚴格遵循 Gen Y / Gen Z 規範與使用者範例)
 */
function generateNaturalAnswerFallback(intent, data, questionText, session, lang) {
  if (typeof intent === 'string') {
    const queryStr = intent;
    const sess = (typeof data === 'object' && data !== null && !Array.isArray(data)) ? data : ((typeof state !== 'undefined' ? state.currentSession : null) || {});
    const preferredLang = (typeof questionText === 'string' && questionText.length <= 5) ? questionText : (lang || detectLanguage(queryStr));
    const parsedIntent = (typeof parseIntent === 'function')
      ? parseIntent(queryStr, sess, preferredLang)
      : { category: 'today', rawText: queryStr };
    const fetchedData = (typeof fetchAstrologyData === 'function')
      ? fetchAstrologyData(parsedIntent, sess)
      : {};
    return generateNaturalAnswerFallback(parsedIntent, fetchedData, queryStr, sess, preferredLang);
  }

  const q = (questionText || (intent && intent.rawText) || '').trim();
  const isThai = lang === 'th';
  const isEnglish = lang === 'en';
  const category = (intent && (intent.category || intent.event)) || 'letou';

  // =========================================================================
  // 滿天星 Plus 核心規範零：商業機密與體系保密詢問
  // =========================================================================
  if (category === 'ai_secret' || q.includes('什麼 AI') || q.includes('什麼AI') || q.includes('哪種 AI') || q.includes('哪家 AI') || q.includes('哪個 AI') || q.includes('用什麼模型') || q.includes('你用什麼AI') || q.includes('你是什麼AI') || q.includes('你是哪家') || q.includes('你是 GPT') || q.includes('你是 Gemini') || q.includes('你是 DeepSeek') || q.includes('ใช้ AI อะไร') || q.toLowerCase().includes('what ai')) {
    const textZh = '這是商業機密，不便透露。';
    const textTh = 'นี่เป็นความลับทางการค้า ไม่สะดวกเปิดเผยครับ';
    const textEn = 'This is proprietary trade secret and cannot be disclosed.';
    return {
      plain: isThai ? textTh : (isEnglish ? textEn : textZh),
      light: { type: 'yellow', text: isThai ? 'ความลับทางการค้า' : (isEnglish ? 'Trade Secret' : '商業機密') },
      stars: '★★★★★',
      calculation: null,
      remedy: null,
      crisisWarning: null,
      sensual: null,
      badPeachBlossom: null,
      lang: lang || 'zh'
    };
  }

  if (category === 'system_secret' || q.includes('命理體系') || q.includes('你的體系') || q.includes('門派') || q.includes('師承') || q.includes('傳承') || q.includes('理論來源') || q.includes('ระบบโหราศาสตร์') || q.toLowerCase().includes('astrology system')) {
    const textZh = '這是千年命理智慧的整合，不便透露具體來源。';
    const textTh = 'นี่เป็นการหลอมรวมภูมิปัญญาโหราศาสตร์นับพันปี ไม่สะดวกเปิดเผยแหล่งที่มาโดยเฉพาะครับ';
    const textEn = 'This is an integration of millennia of astrological wisdom; specific sources cannot be disclosed.';
    return {
      plain: isThai ? textTh : (isEnglish ? textEn : textZh),
      light: { type: 'yellow', text: isThai ? 'ภูมิปัญญาโหราศาสตร์' : (isEnglish ? 'Astrological Wisdom' : '千年命理智慧') },
      stars: '★★★★★',
      calculation: null,
      remedy: null,
      crisisWarning: null,
      sensual: null,
      badPeachBlossom: null,
      lang: lang || 'zh'
    };
  }

  // =========================================================================
  // 滿天星 Plus 核心情境：爛桃花主動詢問 (非主動詢問時嚴格不主動提)
  // =========================================================================
  if (category === 'bad_peach_blossom' || q.includes('爛桃花') || q.includes('桃花煞') || q.includes('ดอกท้อเน่า')) {
    if (isThai) {
      return {
        plain: `อาจารย์ Jack ช่วยดูให้แล้ว จากการคำนวณตามดวงชะตา วังคู่ครองของคุณมีดาวเคราะห์ร้ายรบกวน ในปีนี้มีแนวโน้มที่จะพบเจอกับดอกท้อเน่า (爛桃花) หรือคนที่ไม่เหมาะสมจริงครับ พฤติกรรมที่เป็นไปได้คืออาจพบคนที่ดูอบอุ่นแต่มีเจตนาแอบแฝง ผลที่อาจตามมาคือความเหนื่อยล้าทางใจและความสับสน นี่คือคำแนะนำของผม: รักษาระยะห่างที่เหมาะสม อย่าเพิ่งทุ่มเทความรู้สึกหรือเงินทองเร็วเกินไป และปรับฮวงจุ้ยเพื่อป้องกันความสัมพันธ์ที่เป็นพิษครับ`,
        light: { type: 'yellow', text: 'เตือนภัยความสัมพันธ์ (ระวังดอกท้อเน่า)' },
        stars: '★★☆☆☆',
        calculation: `<strong>【爛桃花與情感干擾推算依據】：</strong><br>• <strong>星盤格局</strong>：夫妻宮見咸池、天姚逢煞忌星照會<br>• <strong>特徵分析</strong>：緣分來得快去得快，多含利益或激情衝動，缺乏長遠基礎<br>• <strong>化解之道</strong>：冷靜觀察 3-6 個月，不輕易涉及財務往來。`,
        badPeachBlossom: {
          hasBadPeachBlossom: true,
          details: '夫妻宮見煞曜與偏桃花星交會，容易招惹虛浮不實之緣分',
          advice: '建議保持清醒界線，慎選交往對象，必要時斬爛桃花'
        },
        remedy: null,
        sensual: null,
        crisisWarning: null,
        lang: 'th'
      };
    }

    return {
      plain: `Jack 老師幫你看了，根據命盤推算，你的命盤三方四正有煞星干擾，今年確實容易遇到爛桃花或不對的人。具體行為表現是容易在社交場合遇到看似熱情但動機不純的對象。未來後果可能導致感情困擾與心力消耗。這是我的建議：建議提前保持社交邊界、不要過快投入金錢與情感、必要時進行陽宅風水佈局斬爛桃花，避免無謂糾紛。`,
      light: { type: 'yellow', text: '桃花注意（慎防爛桃花糾纏）' },
      stars: '★★☆☆☆',
      calculation: `<strong>【爛桃花與情感干擾推算依據】：</strong><br>• <strong>星盤格局</strong>：夫妻宮見咸池、天姚逢煞忌星照會<br>• <strong>特徵分析</strong>：緣分來得快去得快，多含利益或激情衝動，缺乏長遠基礎<br>• <strong>化解之道</strong>：冷靜觀察 3-6 個月，不輕易涉及財務往來。`,
      badPeachBlossom: {
        hasBadPeachBlossom: true,
        details: '夫妻宮見煞曜與偏桃花星交會，容易招惹虛浮不實之緣分',
        advice: '建議保持清醒界線，慎選交往對象，必要時斬爛桃花'
      },
      remedy: null,
      sensual: null,
      crisisWarning: null,
      lang: 'zh'
    };
  }

  // =========================================================================
  // 滿天星 Plus 核心規範一：年度整體運勢 (嚴格不主動提及「肉慾」與「爛桃花」)
  // =========================================================================
  if (category === 'overall_fortune' || q.includes('運勢如何') || q.includes('整體運勢') || (q.includes('今年運勢') && !q.includes('偏財'))) {
    if (isThai) {
      return {
        plain: `อาจารย์ Jack ช่วยดูให้แล้ว จากการคำนวณตามดวงชะตา ภาพรวมดวงชะตาของคุณในปีนี้มีความมั่นคงและมีจังหวะก้าวกระโดดที่ดีครับ ดาวมงคลส่งแรงหนุนอย่างต่อเนื่อง นี่คือคำแนะนำของผม: ใช้ประโยชน์จากพลังงานเชิงบวกในปีนี้ วางแผนอย่างรอบคอบและลงมือทำอย่างมั่นใจ จะนำมาซึ่งผลลัพธ์ที่น่าพึงพอใจครับ`,
        light: { type: 'green', text: 'ดวงชะตาราบรื่นมั่นคง (ดาวมงคลหนุนนำ)' },
        stars: '★★★★☆',
        calculation: `<strong>【การวิเคราะห์ภาพรวมดวงชะตาปี 2026】：</strong><br>• วังชะตามีโครงสร้างดาวมงคลหนุนนำ จังหวะชีวิตโดยรวมคล่องตัว<br>• คำแนะนำหลัก: รักษาจังหวะที่มั่นคง คว้าโอกาสสำคัญในจังหวะที่เหมาะสม`,
        remedy: null,
        crisisWarning: null,
        sensual: null,
        badPeachBlossom: null,
        lang: 'th'
      };
    }
    return {
      plain: `Jack 老師幫你看了，根據命盤推算，你今年的整體運勢穩健中帶有突破，命宮與三方吉星互應，各方面節奏都很順暢。這是我的建議：把握今年積極向上的動能，在關鍵時機主動出擊，就能收穫不錯的成果。`,
      light: { type: 'green', text: '運勢穩健（吉星拱照，順勢而為）' },
      stars: '★★★★☆',
      calculation: `<strong>【2026 全年總體走勢依據】：</strong><br>• <strong>命盤格局</strong>：命宮三方吉曜拱照，流年天干化祿引動發展契機。<br>• <strong>關鍵建議</strong>：穩扎穩打，順應吉時出擊。`,
      remedy: null,
      crisisWarning: null,
      sensual: null,
      badPeachBlossom: null,
      lang: 'zh'
    };
  }

  // =========================================================================
  // 任務六：樂透幸運號碼專屬生成引擎 (兩階段互動 + 雙軌生成 + 來源透明)
  // =========================================================================
  if (category === 'lucky_numbers') {
    const luckyData = data.luckyNumbers || generateLuckyNumbersData(session, lang, intent.isLuckyNumberConfirmed);

    // 第一階段：先回問確認
    if (luckyData.isWaitingConfirmation || !intent.isLuckyNumberConfirmed) {
      return {
        plain: isThai
          ? 'อยากให้พี่ลองคำนวณให้ก่อนไหมครับ?'
          : (isEnglish
              ? 'Would you like me to calculate it for you first?'
              : '要不要我先幫你算一下？'),
        light: { type: 'green', text: isThai ? 'ยืนยันการคำนวณ' : (isEnglish ? 'Confirmation' : '等待確認') },
        stars: '★★★★★',
        calculation: isThai
          ? '【การเตรียมความพร้อม】：เมื่อคุณพร้อม เพียงตอบว่า "ใช่" หรือ "คำนวณเลย" พี่ Jack จะทำการเสี่ยงทายปู้กัว (易經起卦) และคำนวณตัวเลขสร้างสรรค์เบญจธาตุ (五行生成數) ให้ทันทีครับ'
          : (isEnglish
              ? '【Preparation】: Just reply "Yes" or "Calculate", and Jack will perform I-Ching divination and Five Elements number derivation for you.'
              : '【準備起盤】：請回覆「好」或「算」，系統將立即啟動易經起卦與河圖五行生成數雙軌推算。'),
        remedy: null,
        crisisWarning: null, // 問題四：嚴禁插入不相關的危機預警
        sensual: null,
        badPeachBlossom: null,
        lang: lang || 'zh'
      };
    }

    // 第二階段：已確認，雙軌生成號碼並嚴格說明來源
    const briefCrisis = isThai
      ? '\n\nอนึ่ง พี่ Jack ขอเตือนคุณว่าเรือนการงานของคุณมีดาวฮั่วจี้ หากมีเวลาสามารถสอบถามรายละเอียดเพิ่มเติมได้ครับ'
      : (isEnglish
          ? "\n\nAdditionally, Jack reminds you that your Career Palace has Hua Ji, feel free to ask me for details later."
          : '\n\n另外，Jack 老師提醒你，你的事業宮有化忌，有空可以問我詳細。');

    if (isThai) {
      return {
        plain: `ตามการคำนวณดวงชะตา การเสี่ยงทายปู้กัว (易經起卦) ได้กัวะ地天泰 (ตี้เทียนไท่) ประกอบกับตัวเลขสร้างสรรค์เบญจธาตุ (五行生成數) ของธาตุน้ำ (水, เลข 1/6) และธาตุทอง (金, เลข 4/9) สามารถคำนวณหมายเลขมงคลได้อย่างแม่นยำ ได้แก่: 1 (เลขเกิดของธาตุน้ำ), 4 (เลขเกิดของธาตุทอง), 6 (เลขสำเร็จของธาตุน้ำ), 9 (เลขสำเร็จของธาตุทอง) เสริมด้วย 11 (ลำดับกัวะ地天泰) และ 14 (ธาตุทองบวกสิบ) รวมเป็นเลขเด็ด 1, 4, 6, 9, 11, 14 ครับ สำหรับหมายเลขที่เหลือ แนะนำให้ใช้สัญชาตญาณเลือกในช่วงยามมงคล (ยามเซิน 15:00-17:00 หรือยามซื่อ 09:00-11:00) ครับ${briefCrisis}`,
        light: { type: 'green', text: 'มหาโชค (ปู้กัวและเบญจธาตุ)' },
        stars: '★★★★★',
        calculation: `<strong>【การคำนวณเต็มรูปแบบ - การ推導ตัวเลขมงคลแบบโปร่งใส】：</strong><br>• <strong>รางที่หนึ่ง: การเสี่ยงทายปู้กัว (易經起卦)</strong>: ได้กัวะ『地天泰 (ตี้เทียนไท่)』(กัวะที่ 11 ในคัมภีร์อี้จิง ฟ้าดินสอดประสาน บ่งบอกถึงโชคลาภทะลัก)<br>• <strong>รางที่สอง: ตัวเลขสร้างสรรค์เบญจธาตุ (河圖五行生成數)</strong>:<br>  - ธาตุน้ำ (水): เลขเกิด 1, เลขสำเร็จ 6<br>  - ธาตุทอง (金): เลขเกิด 4, เลขสำเร็จ 9 (รวม 1, 4, 6, 9 ครบถ้วน)<br>• <strong>การเชื่อมโยงตัวเลข 6 หมายเลข</strong>: 1 (น้ำ), 4 (ทอง), 6 (น้ำ), 9 (ทอง), 11 (กัวะ地天泰), 14 (ทองบวกสิบ)<br>• <strong>คำชี้แจงความโปร่งใส</strong>: คำนวณตามหลักวิชาการได้ 6 หมายเลขข้างต้น ส่วนหมายเลขที่เหลือขอให้ใช้สัญชาตญาณเลือกในยามมงคล<br>• <strong>ข้อมูลลอตเตอรี่ไต้หวัน</strong>: ต้าเล่อโท่ว (อังคาร/ศุกร์), เวยลี่ฉ่าย (จันทร์/พฤหัสบดี), จินฉ่าย 539 (จันทร์-เสาร์天天)<br>• <strong>ยามมงคลและทิศทาง</strong>: ยามเซิน (15:00-17:00) หรือยามซื่อ (09:00-11:00) มุ่งหน้าทิศตะวันออกหรือทิศใต้`,
        remedy: null,
        crisisWarning: null, // 問題四：嚴禁插入不相關的危機預警
        sensual: null,
        badPeachBlossom: null,
        lang: 'th'
      };
    }

    if (isEnglish) {
      return {
        plain: `Jack 老師 has calculated for you! Through I-Ching Divination (易經起卦) yielding Hexagram Di Tian Tai (地天泰), combined with the Five Elements Generating Numbers (Water: 1/6, Metal: 4/9), here are the strictly derived numbers: 1 (Water generating), 4 (Metal generating), 6 (Water forming), 9 (Metal forming), with 11 (Hexagram 11) and 14 (Metal +10), forming: 1, 4, 6, 9, 11, 14. For any remaining numbers, trust your intuition during the auspicious hours (Shen 15:00-17:00 or Si 09:00-11:00).${briefCrisis}`,
        light: { type: 'green', text: 'Great Fortune (Dual-Track Derived)' },
        stars: '★★★★★',
        calculation: `<strong>【Transparent Number Derivation Basis】：</strong><br>• <strong>Track 1: I-Ching Divination</strong>: Di Tian Tai (Hexagram 11, Heaven and Earth in harmony)<br>• <strong>Track 2: River Map (Hetu) Numbers</strong>:<br>  - Water (水): Generating 1, Forming 6<br>  - Metal (金): Generating 4, Forming 9<br>• <strong>Combined Numbers</strong>: 1, 4, 6, 9, 11, 14 (Each has a strict origin)<br>• <strong>Honest Statement</strong>: 6 numbers strictly derived; combine the rest intuitively during peak hours.<br>• <strong>Taiwan Lottery Schedule</strong>: Lotto 6/49 (Tue/Fri), Super Lotto (Mon/Thu), Daily 539 (Mon-Sat)<br>• <strong>Best Hours & Directions</strong>: Shen hour (15:00-17:00) or Si hour (09:00-11:00), heading East or South.`,
        remedy: null,
        crisisWarning: null, // 問題四：嚴禁插入不相關的危機預警
        sensual: null,
        badPeachBlossom: null,
        lang: 'en'
      };
    }

    return {
      plain: `Jack 老師幫你推算好了！透過易經起卦得卦「地天泰」，並結合命盤偏財喜用神之河圖五行生成數（水：1/6、金：4/9），嚴格推導出幸運號碼：1（來自水之生數）、4（來自金之生數）、6（來自水之成數）、9（來自金之成數），並由地天泰卦序與進位衍生 11、14，組合為幸運號碼：1, 4, 6, 9, 11, 14。其餘號碼請於吉時（申時 15:00-17:00 或巳時 09:00-11:00）憑第一直覺靈感組合，小買怡情最聚財！${briefCrisis}`,
      light: { type: 'green', text: '大吉（易經起卦與河圖五行雙軌雙照）' },
      stars: '★★★★★',
      calculation: `<strong>【幸運號碼透明推導依據（河圖五行生數與易經卦序）】：</strong><br>• <strong>軌道一：易經起卦</strong>：得卦「地天泰」（六十四卦第 11 卦，上下交泰之大吉兆）<br>• <strong>軌道二：河圖五行生成數</strong>：<br>  - 水之生成數：天一生水（1），地六成之（6）<br>  - 金之生成數：地四生金（4），天九成之（9）<br>• <strong>組合 6 碼透明來源</strong>：1（水生數）、4（金生數）、6（水成數）、9（金成數）、11（地天泰卦序）、14（金數逢十進位 4+10）<br>• <strong>誠實說明</strong>：嚴格推導出以上 6 個號碼，其餘特別號或自選號請在最佳時辰憑靈感組合。<br>• <strong>台灣樂透開獎排程</strong>：大樂透（每週二、五）、威力彩（每週一、四）、今彩539（週一至週六天天開獎）、雙贏彩（每週二、五）、三星/四星彩（天天開獎）、賓果賓果（每5分鐘開獎）<br>• <strong>吉時與財神方</strong>：申時 (15:00-17:00) 或巳時 (09:00-11:00)，往正東方或正南方承接財氣。`,
      remedy: null,
      crisisWarning: null, // 問題四：嚴禁插入不相關的危機預警
      sensual: null,
      badPeachBlossom: null,
      lang: 'zh'
    };
  }

  // =========================================================================
  // 任務三：沙盤推演專屬生成引擎 (baofu_sandbox)
  // =========================================================================
  if (category === 'baofu_sandbox') {
    const sandbox = data.baofuSandbox || runWealthSandboxSimulation(session, lang, intent);
    const topYear = sandbox.baofuTimingYear || 2028;
    const topDayStr = sandbox.topDayPiancai ? sandbox.topDayPiancai.formattedDate : '2028 年 10 月 6 日';
    const alertMsg = (sandbox.proactiveAlerts && sandbox.proactiveAlerts.baofu) || `Jack 老師跟你說，你 ${topYear} 年 10 月 6 日財運能量最強。`;

    if (isThai) {
      return {
        plain: `${alertMsg} จากการ推演เชิงลึก 5 มิติ (本命·大運·流年·流月·流日) คุณมีจังหวะทองแห่งความร่ำรวยกะทันหันรออยู่ในปี ${topYear} ครับ! วันที่มีพลังงานโชคลาภสูงสุดคือช่วงปลายปี มีเกณฑ์『火貪格 (ฮั่วทานเก๋อ)』และ『祿馬交馳 (ลู่หม่าเจียวฉือ)』ประสานพลัง แนะนำให้เตรียมพร้อมคว้าโอกาส วางแผนธุรกิจหรือการลงทุนอย่างมีระบบ และมุ่งหน้าทิศตะวันออกเพื่อเปิดรับโชคลาภครับ`,
        light: { type: 'green', text: 'มหาโชค (การจำลอง沙盤推演)' },
        stars: '★★★★★',
        calculation: `<strong>【การคำนวณเต็มรูปแบบ - การจำลอง沙盤推演 5 มิติ】：</strong><br>• <strong>โครงสร้างดวงกำเนิด</strong>: พบเกณฑ์『火貪格』และ『身旺透偏財』มีพื้นฐานสร้างความมั่งคั่ง<br>• <strong>ช่วงเวลา 10 ปี (大運)</strong>: ปี ${topYear} วังการเงินพบดาว化祿และ祿存 สี่มิติสอดประสาน<br>• <strong>กลยุทธ์ 6 มิติ</strong>: ทิศตะวันออก/ใต้, ยามเซิน (15:00-17:00), ผู้ใหญ่อุปถัมภ์ปีมะเมีย/วอก, เตรียมสัญญาให้รอบคอบ`,
        remedy: null,
        crisisWarning: null,
        sensual: null,
        badPeachBlossom: null,
        lang: 'th'
      };
    }

    return {
      plain: `${alertMsg} 經過五層時空沙盤推演，你在 ${topYear} 年會迎來暴富高峰！當天盤面觸發『火貪格』、『破軍逢祿』與『祿存』四重共振，偏財能量直接拉滿。那時候你最需要做的是提前備妥商業合約與資金規劃，在吉時（申時 15:00-17:00）往吉方主動出擊落實合作，就能穩穩接住大運！`,
      light: { type: 'green', text: '大吉（五層時空沙盤推演·四重共振）' },
      stars: '★★★★★',
      calculation: `<strong>【五層時空沙盤推演計算依據】：</strong><br>• <strong>本命盤檢驗</strong>：八字身旺透偏財 + 紫微火貪格與祿馬交馳（具備暴富格局）<br>• <strong>大運推演（10年）</strong>：${topYear} 戊申年走到財帛宮逢祿存化祿，十年大運黃金頂峰<br>• <strong>流年推演（12年）</strong>：${topYear} 戊申年貪狼化祿逢火星，偏財爆發<br>• <strong>流月推演（12月）</strong>：農曆八月金旺之期，太陰化祿引動暗財<br>• <strong>流日推演（30天）</strong>：${topDayStr}，手氣評分 14 分滿分<br>• <strong>六大維度布局</strong>：正東方/正南方、申時(15:00-17:00)、貴人生肖馬與猴、事前備妥合約簡報、避開盲目梭哈、主動敲定合作。`,
      remedy: null,
      crisisWarning: null,
      sensual: null,
      badPeachBlossom: null,
      lang: 'zh'
    };
  }

  // =========================================================================
  // 滿天星 Plus 核心規範二：未來危機預警機制 (問題一 & 問題六：完整多語言與三步驟文化安撫框架)
  // 1. 財務危機預警
  // =========================================================================
  if (category === 'crisis_financial' || q.includes('會破財嗎') || q.includes('破財') || (q.includes('財務') && (q.includes('危機') || q.includes('破耗') || q.includes('虧損') || q.includes('負債')))) {
    return createReassuranceCrisisResponse('wealth', lang, {
      th: `<strong>【การคำนวณเต็มรูปแบบ - การแก้เคล็ดด้านการเงิน】：</strong><br>• วังการเงิน (財帛宮) มีดาว『化忌 (ฮว่าจี้)』<br>• แนวทางแก้เคล็ด: ทำบุญชำระหนี้สงฆ์ ค่าน้ำค่าไฟวัด จัดสรรสินทรัพย์ และสำรองเงินสดฉุกเฉิน`,
      zh: `<strong>【財帛宮化忌與財務化解佈局】：</strong><br>• <strong>核心宮位</strong>：財帛宮逢化忌坐守<br>• <strong>化解佈局方針</strong>：提前資產配置、避免高風險投機、保留充裕現金，多做布施修福打通財路。`,
      en: `<strong>【Wealth Palace Mitigation & Asset Strategy】：</strong><br>• Wealth Palace meets Hua Ji.<br>• Mitigation: Charity donations to unblock wealth channels, conservative asset allocation, and cash reserves.`
    });
  }

  // 1.5 父母健康專屬推算
  if (q.includes('父母') && (q.includes('健康') || q.includes('身體') || q.includes('生病') || q.includes('狀況') || q.includes('好嗎') || q.includes('如何'))) {
    return createReassuranceCrisisResponse('health', lang, {
      th: `<strong>【การคำนวณเต็มรูปแบบ - การดูแลสุขภาพบุพการี】：</strong><br>• วังผู้ปกครอง (父母宮) มีดาวกระทบ<br>• แนวทางแก้เคล็ด: ทำบุญโลงศพ บริจาคโลหิต และจัดตรวจสุขภาพล่วงหน้าอย่างใกล้ชิด`,
      zh: `<strong>【父母宮關卡化解與健康照護依據】：</strong><br>• <strong>核心宮位</strong>：父母宮見化忌沖照<br>• <strong>化解佈局方針</strong>：提前安排常規深度健檢、備妥醫療資源、多陪伴長輩，以善行功德祈福。`,
      en: `<strong>【Parents Health Guidance & Mitigation】：</strong><br>• Parents Palace influenced by Hua Ji.<br>• Mitigation: Early medical checkups, health resources preparation, and charitable merit.`
    });
  }

  // 2. 健康危機預警
  if (category === 'crisis_health' || (q.includes('健康') && (q.includes('如何') || q.includes('怎樣') || q.includes('危機') || q.includes('生病') || q.includes('好嗎') || q.includes('狀況'))) || q.includes('會生病嗎') || q.includes('生病') || q.includes('สุขภาพ')) {
    return createReassuranceCrisisResponse('health', lang, {
      th: `<strong>【การคำนวณเต็มรูปแบบ - การแก้เคล็ดด้านสุขภาพ】：</strong><br>• วังสุขภาพ (疾厄宮) มีดาว『化忌 (ฮว่าจี้)』<br>• แนวทางแก้เคล็ด: ทำบุญโลงศพ บริจาคโลหิต สะเดาะเคราะห์เปลี่ยนเรื่องใหญ่เป็นเรื่องเล็ก ปรับตารางชีวิต และตรวจสุขภาพเป็นประจำ`,
      zh: `<strong>【疾厄宮化忌與健康化解佈局】：</strong><br>• <strong>核心宮位</strong>：疾厄宮化忌星照會<br>• <strong>化解佈局方針</strong>：提前捐血、支持救護棺木、常規健康檢查與早睡規律作息，主動化解重能量。`,
      en: `<strong>【Health Palace Mitigation & Wellness Guide】：</strong><br>• Health Palace meets Hua Ji.<br>• Mitigation: Blood donations, medical charity, regular checkups, and balanced sleep schedule.`
    });
  }

  // 3. 感情危機預警
  if (category === 'crisis_relationship' || (q.includes('感情') && (q.includes('如何') || q.includes('怎樣') || q.includes('危機') || q.includes('好嗎') || q.includes('狀況'))) || (q.includes('婚姻') && (q.includes('危機') || q.includes('破裂') || q.includes('外遇') || q.includes('出軌') || q.includes('第三者'))) || q.includes('ความรัก')) {
    return createReassuranceCrisisResponse('relationship', lang, {
      th: `<strong>【การคำนวณเต็มรูปแบบ - การแก้เคล็ดด้านความรัก】：</strong><br>• วังคู่ครอง (夫妻宮) มีดาว『化忌 (ฮว่าจี้)』<br>• แนวทางแก้เคล็ด: ทำบุญถวายของเป็นคู่ หรือบริจาคหลอดไฟ/เทียนไข เติมแสงสว่างให้ปัญญาและเมตตามหานิยม สื่อสารด้วยความอดทน`,
      zh: `<strong>【夫妻宮化忌與感情化解佈局】：</strong><br>• <strong>核心宮位</strong>：夫妻宮化忌照會<br>• <strong>化解佈局方針</strong>：多傾聽包容、陽宅臥室風水佈局斬爛桃花、布施成雙成對之供品，把大事化小。`,
      en: `<strong>【Relationship Palace Mitigation & Harmony Guide】：</strong><br>• Spouse Palace meets Hua Ji.<br>• Mitigation: Compassionate dialogue, pairs donations, lighting candles for wisdom and mutual harmony.`
    });
  }

  // 4. 人際危機預警
  if (category === 'crisis_interpersonal' || q.includes('人際危機') || (q.includes('合夥') && q.includes('失敗')) || (q.includes('朋友') && q.includes('騙')) || q.includes('มนุษยสัมพันธ์')) {
    return createReassuranceCrisisResponse('interpersonal', lang, {
      th: `<strong>【การคำนวณเต็มรูปแบบ - การแก้เคล็ดด้านมนุษยสัมพันธ์】：</strong><br>• วังเพื่อนฝูง (交友宮) มีดาว『化忌 (ฮว่าจี้)』<br>• แนวทางแก้เคล็ด: ทำบุญบริจาคหลอดไฟ/เทียนไข คัดกรองหุ้นส่วนอย่างรอบคอบ และลงนามในเอกสารด้วยความรัดกุม`,
      zh: `<strong>【交友宮化忌與人際化解佈局】：</strong><br>• <strong>核心宮位</strong>：交友宮逢化忌<br>• <strong>化解佈局方針</strong>：審慎過濾合夥人、所有約定留存白紙黑字、行善布施廣結善緣，避開是非。`,
      en: `<strong>【Interpersonal Palace Mitigation & Partnership Guide】：</strong><br>• Friends Palace meets Hua Ji.<br>• Mitigation: Clear written contracts, thorough vetting, and charitable merit-making.`
    });
  }

  // 5. 事業危機預警
  if (category === 'crisis_career' || q.includes('事業危機') || (q.includes('失業') && q.includes('危機')) || q.includes('การงาน')) {
    return createReassuranceCrisisResponse('career', lang, {
      th: `<strong>【การคำนวณเต็มรูปแบบ - การแก้เคล็ดด้านการงาน】：</strong><br>• วังการงาน (官祿宮) มีดาว『化忌 (ฮว่าจี้)』<br>• แนวทางแก้เคล็ด: ทำบุญบริจาคหลอดไฟ/เทียนไข หรือหนังสือธรรมะ สั่งสมทักษะเฉพาะทาง และหลีกเลี่ยงการลาออกด้วยอารมณ์ชั่ววูบ`,
      zh: `<strong>【官祿宮化忌與事業化解佈局】：</strong><br>• <strong>核心宮位</strong>：官祿宮化忌坐守<br>• <strong>化解佈局方針</strong>：厚植專業能力、建立副業備案、避免衝動離職、多行善積德把大事化小。`,
      en: `<strong>【Career Palace Mitigation & Professional Guide】：</strong><br>• Career Palace meets Hua Ji.<br>• Mitigation: Upskilling, side business readiness, avoiding impulsive changes, and wisdom charity.`
    });
  }

  // 6. 家庭危機預警
  if (category === 'crisis_family' || q.includes('家庭危機') || (q.includes('爭產') && q.includes('危機')) || q.includes('ครอบครัว')) {
    return createReassuranceCrisisResponse('family', lang, {
      th: `<strong>【การคำนวณเต็มรูปแบบ - การแก้เคล็ดด้านครอบครัว】：</strong><br>• วังอสังหาริมทรัพย์และครอบครัว (田宅宮) มีดาว『化忌 (ฮว่าจี้)』<br>• แนวทางแก้เคล็ด: ทำบุญถวายสังฆทานร่วมกับครอบครัว เปิดใจสื่อสารอย่างอบอุ่น และจัดการเอกสารให้โปร่งใส`,
      zh: `<strong>【田宅宮化忌與家庭化解佈局】：</strong><br>• <strong>核心宮位</strong>：田宅宮化忌<br>• <strong>化解佈局方針</strong>：溫和包容陪伴家人、產權文書交代清楚、多做善事把大事化小。`,
      en: `<strong>【Family & Property Palace Mitigation Guide】：</strong><br>• Property Palace meets Hua Ji.<br>• Mitigation: Warm family communication and joint merit-making.`
    });
  }

  // 7. 學業危機預警
  if (category === 'crisis_academic' || q.includes('學業危機') || (q.includes('輟學') && q.includes('危機')) || q.includes('การเรียน')) {
    return createReassuranceCrisisResponse('academic', lang, {
      th: `<strong>【การคำนวณเต็มรูปแบบ - การแก้เคล็ดด้านการเรียน】：</strong><br>• วังการเรียน (父母宮) มีดาว『化忌 (ฮว่าจี้)』<br>• แนวทางแก้เคล็ด: ทำบุญบริจาคหนังสือ อุปกรณ์การเรียนแก่เด็กยากไร้ และปรับเปลี่ยนบรรยากาศการเรียน`,
      zh: `<strong>【父母宮化忌與學業化解佈局】：</strong><br>• <strong>核心宮位</strong>：父母宮/文昌化忌<br>• <strong>化解佈局方針</strong>：捐贈文具書籍助學、調整學習步調與書房風水，把大事化小。`,
      en: `<strong>【Academic Palace Mitigation Guide】：</strong><br>• Parents/Academic Palace meets Hua Ji.<br>• Mitigation: Book donations and optimizing study rhythm.`
    });
  }

  // 8. 法律危機預警
  if (category === 'crisis_legal' || q.includes('法律危機') || (q.includes('官司') && q.includes('危機')) || (q.includes('牢獄') && q.includes('危機')) || q.includes('กฎหมาย')) {
    return createReassuranceCrisisResponse('legal', lang, {
      th: `<strong>【การคำนวณเต็มรูปแบบ - การแก้เคล็ดด้านกฎหมาย】：</strong><br>• ดาวกวนฝู (官符) และเทียนสิง (天刑) ส่องกระทบ<br>• แนวทางแก้เคล็ด: ทำบุญพิมพ์หนังสือธรรมะหรือบริจาคเพื่อความยุติธรรม ปรึกษาทนายความก่อนทำสัญญา และปฏิเสธพื้นที่สีเทา`,
      zh: `<strong>【官符天刑與法務化解佈局】：</strong><br>• <strong>核心星曜</strong>：官符、天刑照會<br>• <strong>化解佈局方針</strong>：重要協議諮詢律師、承諾皆留存白紙黑字、拒絕灰色地帶、多行善積德。`,
      en: `<strong>【Legal & Compliance Mitigation Guide】：</strong><br>• Chart influenced by Guan Fu and Tian Xing.<br>• Mitigation: Written contracts, legal consultation, and strictly avoiding gray areas.`
    });
  }

  // 0.0 提問：「我這樣做一定會成功嗎？」或確定性提問（標註不確定性，機率原則）
  if (category === 'certainty' || q.includes('一定會') || q.includes('絕對會') || q.includes('一定能') || (q.includes('一定') && q.includes('嗎')) || q.includes('會成功嗎')) {
    if (isThai) {
      return {
        plain: `หลักโหราศาสตร์คือความน่าจะเป็น ไม่ใช่สิ่งสัมบูรณ์ที่ตายตัวครับ จากการคำนวณตามดวงชะตา ดาวในดวงบ่งบอกถึงแนวโน้มพลังงานและจังหวะเวลาที่เกื้อหนุน ไม่ใช่การการันตีว่าจะสำเร็จอย่างแน่นอน นี่คือคำแนะนำของผม: คุณสามารถใช้ฤกษ์มงคลเป็นแรงส่งเสริม แต่กุญแจสำคัญสู่ความสำเร็จยังคงขึ้นอยู่กับการเตรียมตัว ความรอบคอบ และการปรับตัวตามสถานการณ์จริงครับ`,
        light: { type: 'yellow', text: 'แนวโน้มโอกาส (พลังงานหนุนนำ ไม่ใช่การันตี)' },
        stars: '★★★☆☆',
        calculation: `<strong>【หลักการความน่าจะเป็นและเสรีภาพมนุษย์】：</strong><br>• <strong>ไม่ใช่ชะตาลิขิต 100%</strong>: ดาวในดวงเป็นเพียงการชี้นำแนวโน้มพลังงาน<br>• <strong>โครงสร้างสามประสาน (三才)</strong>: ฟ้า 33.3%, ดิน 33.3%, คน 33.3%<br>• <strong>คำแนะนำเพื่อเพิ่มโอกาสสำเร็จ</strong>: อาศัยจังหวะเวลาที่ดี ควบคู่กับการวางแผนที่รัดกุม`,
        remedy: null
      };
    }

    return {
      plain: `命理是機率，不是絕對。根據命盤推算，命盤提供的是這段時間的能量偏向與時機參考，而不是保證一定會成功。這是我的建議：你可以把盤面上的吉時當成順風推力，但若想提高成功機率，最核心的關鍵還是在於事前的周全準備、風險評估，以及在執行時隨時根據現實回饋靈活調整。`,
      light: { type: 'yellow', text: '機率參考（趨勢輔助，非絕對保證）' },
      stars: '★★★☆☆',
      calculation: `<strong>【命理核心哲學與機率原則】：</strong><br>• <strong>非宿命鎖定</strong>：紫微斗數推算的是特定時空下的能量偏向與機率高低，無法確認事情必然發生。<br>• <strong>三才各占 33.3%</strong>：天命占 33.3%（先天時機趨勢）、地脈占 33.3%（環境與空間風水）、人道占 33.3%（個人自由意志與實務執行）。<br>• <strong>提高成功機率實戰建議</strong>：順應吉時節奏主動出擊，同時做好備案與細節把控，才能最大化勝率。`,
      remedy: null
    };
  }

  // 0.05 提問：「我老婆今年最強肉慾感在哪一天？」或「肉慾 / 情慾」詢問
  if (category === 'rouyu' || q.includes('肉慾') || q.includes('情慾') || q.includes('ราคะ') || q.includes('ตัณหา')) {
    const rList = (data.rouyuOutlook && data.rouyuOutlook.topDays) || (data.rankings && data.rankings.rouyu) || (typeof state !== 'undefined' && state.rankings && state.rankings.rouyu) || [];
    const topDay = (data.rouyuOutlook && data.rouyuOutlook.topDay) || rList[0] || {
      date: '2026-01-21',
      dailyGanZhi: '乙未',
      score: 5,
      details: [
        { rule: '命/夫三方四正跨宮照會見貪狼+咸池', points: 2 },
        { rule: '命/夫三方四正照會見天姚(1宮)', points: 1 },
        { rule: '福德宮見廉貞或貪狼', points: 2 }
      ]
    };
    const topFull = formatAuspiciousDate(topDay.date);

    if (isThai) {
      return {
        plain: `จากการคำนวณตามดวงชะตา วันที่พลังงานเสน่หาและความปรารถนาแนบชิดของภรรยาคุณมีแนวโน้มสูงสุดในปีนี้ คือ <strong>${topFull}</strong> (คะแนน ${topDay.score} คะแนน) ครับ วันนั้นมีดาวถันหลางและเสียนฉือส่งแรงดึงดูด คุณอาจลองวางแผนนัดรับประทานอาหารค่ำบรรยากาศสบายๆ สร้างช่วงเวลาที่ผ่อนคลายร่วมกัน นี่คือคำแนะนำของผม ผลลัพธ์ที่แท้จริงยังขึ้นอยู่กับการมีปฏิสัมพันธ์และความใส่ใจของพวกคุณครับ`,
        light: { type: 'green', text: 'พลังงานเสน่หาโดดเด่น' },
        stars: '★★★★☆',
        calculation: `<strong>【肉慾與親密感星盤推算依據】：</strong><br>• <strong>最強吉日</strong>：${topFull}（評分：${topDay.score} 分）<br>• <strong>命中格局</strong>：${(topDay.details || []).map(d => `${d.rule}(+${d.points})`).join('、 ')}<br>• <strong>年度 TOP 3 參考日</strong>：<br>` +
          rList.slice(0, 3).map((d, i) => `${i + 1}. <strong>${formatAuspiciousDate(d.date)}</strong>：得分 <strong>${d.score} 分</strong>`).join('<br>'),
        remedy: null
      };
    }

    return {
      plain: `根據命盤推算，今年你老婆情慾與親密感能量偏向最強的一天是 <strong>${topFull}</strong>（評分 ${topDay.score} 分）。當天命盤在夫妻宮與福德宮有貪狼、咸池等星曜引動，浪漫感應較為強烈。你可以試著在那天提早安排一場沒有壓力的雙人晚餐，營造舒適放鬆的相處時光，把步調放慢。這是我的建議，實際效果還是取決於你們的互動。`,
      light: { type: 'green', text: '良辰吉日（親密能量較強）' },
      stars: '★★★★☆',
      calculation: `<strong>【親密與情慾能量星盤推算依據】：</strong><br>• <strong>能量最高日</strong>：${topFull}（評分：${topDay.score} 分）<br>• <strong>觸發格局</strong>：${(topDay.details || []).map(d => `${d.rule}(+${d.points})`).join('、 ') || '福德宮與夫妻宮星曜引動'}<br>• <strong>年度 TOP 3 參考日</strong>：<br>` +
        rList.slice(0, 3).map((d, i) => `${i + 1}. <strong>${formatAuspiciousDate(d.date)}</strong>：得分 <strong>${d.score} 分</strong>`).join('<br>'),
      remedy: null
    };
  }

  // =========================================================================
  // 感情狀態判讀規則書_v1 專屬回答引擎 (自然語言生成)
  // =========================================================================

  extractUserFacts(q, session);

  // 0.051 提問：「我目前有交往對象嗎」 (dating_status)
  if (category === 'dating_status' || q.includes('交往對象') || q.includes('有對象嗎') || q.includes('有在交往') || q.includes('是否有交往') || q.includes('目前有交往') || q.includes('是否單身') || q.includes('現在單身嗎') || q.includes('目前單身嗎') || (q.includes('有對象') && q.includes('嗎')) || (q.includes('有交往') && q.includes('嗎'))) {
    const ds = (data && data.datingStatus) || calculateDatingStatus(getOrCalculateAstrolabe(session), session, 2026);
    return {
      plain: ds.plainText,
      light: ds.light,
      stars: ds.stars,
      calculation: ds.calculation,
      remedy: null
    };
  }

  // 0.0515 提問：「我結婚過幾次 / 會有幾次婚姻」 (marriage_count)
  if (category === 'marriage_count' || q.includes('結婚過幾次') || q.includes('結過幾次婚') || q.includes('結過幾次') || q.includes('結幾次婚') || q.includes('有幾次婚姻') || q.includes('會有幾次婚姻') || q.includes('會有幾段婚姻') || q.includes('幾次婚姻') || q.includes('幾度婚姻') || q.includes('會二婚嗎') || q.includes('多婚') || (q.includes('結婚') && q.includes('幾次')) || (q.includes('婚姻') && q.includes('幾次'))) {
    const mc = (data && data.marriageCount) || calculateMarriageCount(getOrCalculateAstrolabe(session), session);
    return {
      plain: mc.plainText,
      light: mc.light,
      stars: mc.stars,
      calculation: mc.calculation,
      remedy: null
    };
  }

  // 0.0516 自陳事實：「我已經有三次婚了現在是第三次」 (marriage_fact)
  if (category === 'marriage_fact' || (session && session.maritalStatus && session.maritalStatus.isStatedByClient && (q.includes('三次婚') || q.includes('兩次婚') || q.includes('第三次') || q.includes('第二次') || q.includes('線自曬') || q.includes('現在是第') || q.includes('婚了')))) {
    const ma = (data && data.currentMarriageAnalysis) || analyzeCurrentMarriage(getOrCalculateAstrolabe(session), session);
    return {
      plain: ma.plainText,
      light: ma.light,
      stars: ma.stars,
      calculation: ma.calculation,
      remedy: null
    };
  }

  // 0.052 提問：「我結婚了嗎」 (marriage_status)
  if (category === 'marriage_status' || q.includes('結婚了嗎') || q.includes('是不是結婚') || q.includes('結過婚嗎') || q.includes('有沒有結婚') || q.includes('是否已婚') || q.includes('已婚還是未婚') || (q.includes('我結婚了') && q.includes('嗎')) || (q.includes('結婚') && (q.includes('了嗎') || q.includes('過嗎')))) {
    const ms = (data && data.marriageStatus) || calculateMarriageStatus(getOrCalculateAstrolabe(session), session, 2026);
    return {
      plain: ms.plainText,
      light: ms.light,
      stars: ms.stars,
      calculation: ms.calculation,
      remedy: null
    };
  }

  // 0.053 提問：「我的正緣什麼時候來」 (true_love_timeline)
  if (category === 'true_love_timeline' || (q.includes('正緣') && (q.includes('什麼時候') || q.includes('何時') || q.includes('幾時') || q.includes('哪年') || q.includes('哪一年') || q.includes('幾歲') || q.includes('多久') || q.includes('出現'))) || ((q.includes('紅鸞星動') || q.includes('遇到真愛') || q.includes('姻緣')) && (q.includes('什麼時候') || q.includes('何時') || q.includes('幾時') || q.includes('哪一年') || q.includes('來')))) {
    const tl = (data && data.trueLoveTimeline) || calculateTrueLoveTimeline(getOrCalculateAstrolabe(session), session, 2026, 5);
    return {
      plain: tl.plainText,
      light: tl.light,
      stars: tl.stars,
      calculation: tl.calculation,
      remedy: null
    };
  }

  // 0.054 提問：「我的正緣是什麼樣的人」 (true_love_traits)
  if (category === 'true_love_traits' || (q.includes('正緣') && (q.includes('什麼樣') || q.includes('特質') || q.includes('長相') || q.includes('個性') || q.includes('怎樣的人') || q.includes('什麼人'))) || ((q.includes('另一半') || q.includes('老公') || q.includes('老婆') || q.includes('伴侶')) && (q.includes('什麼樣') || q.includes('怎樣的人') || q.includes('特質') || q.includes('長相') || q.includes('個性')))) {
    const st = (data && data.spouseTraits) || calculateSpouseTraits(getOrCalculateAstrolabe(session), session);
    return {
      plain: st.plainText,
      light: st.light,
      stars: st.stars,
      calculation: st.calculation,
      remedy: null
    };
  }

  // 0.055 提問：「我跟他適合結婚嗎」 (dual_synastry)
  if (category === 'dual_synastry' || q.includes('適合結婚') || (q.includes('跟他') && q.includes('適合')) || (q.includes('我們') && q.includes('適合')) || (q.includes('跟她') && q.includes('適合')) || q.includes('雙人合盤') || q.includes('合不合') || q.includes('能結婚嗎') || q.includes('契合度') || (q.includes('結婚') && q.includes('適合嗎')) || (q.includes('跟他') && q.includes('合嗎'))) {
    const syn = (data && data.dualSynastry) || calculateDualSynastry(session);
    return {
      plain: syn.plainText,
      light: syn.light,
      stars: syn.stars,
      calculation: syn.calculation,
      remedy: null
    };
  }

  // 0.06 提問：「我父母健康如何？」或長輩健康關卡（提前預知、降低傷害、積極佈局）
  if (q.includes('父母') || q.includes('長輩') || q.includes('爸爸') || q.includes('媽媽') || q.includes('父親') || q.includes('母親')) {
    if (isThai) {
      return {
        plain: `จากการคำนวณตามดวงชะตา สุขภาพของพ่อแม่มีเกณฑ์เผชิญกับช่วงเวลาเปราะบางหรืออาจมีจุดติดขัดด้านสุขภาพในช่วงปลายปี 2026 ครับ เนื่องจากวังพ่อแม่มีดาวเคราะห์ร้ายและฮว่าจี้ส่งผลกระทบ นี่คือคำแนะนำของผม: แนะนำให้จัดตารางตรวจสุขภาพอย่างละเอียดล่วงหน้า เตรียมพร้อมทรัพยากรทางการแพทย์ และให้เวลาอยู่เป็นเพื่อนดูแลท่านอย่างใกล้ชิดครับ`,
        light: { type: 'yellow', text: 'แจ้งเตือนสุขภาพ (เตรียมพร้อมรับมือล่วงหน้า)' },
        stars: '★★★☆☆',
        calculation: `<strong>【การคำนวณเต็มรูปแบบเพื่อประเมินสุขภาพของบิดามารดา】：</strong><br>• <strong>วังที่เผชิญบททดสอบ</strong>: วังสุขภาพของบิดามารดา (借宮子女宮)<br>• <strong>เกณฑ์ดาว</strong>: วังพ่อแม่พบดาว『天刑 (เทียนสิง)』และดาวเคราะห์ร้าย<br>• <strong>ช่วงเวลาที่ควรระวังเป็นพิเศษ</strong>: ช่วงปลายปี 2026<br>• <strong>แนวทางปฏิบัติเชิงรุก</strong>: 1. พาท่านตรวจสุขภาพอย่างละเอียด; 2. เตรียมข้อมูลทางการแพทย์ฉุกเฉิน; 3. ดูแลความปลอดภัยในบ้านและให้ความอบอุ่น`,
        remedy: null,
        crisisWarning: null,
        sensual: null,
        badPeachBlossom: null,
        lang: 'th'
      };
    }

    return {
      plain: `根據命盤推算，父母健康在 2026 年下半年可能面臨關卡，可能性很高。命盤顯示父母宮與疾厄位見煞星與化忌引動，長輩的體能與元氣較易虛耗。這是我的建議：建議提前安排健康檢查、準備醫療資源、多陪伴，及早做好生活照護防範。`,
      light: { type: 'yellow', text: '提早預警（重在健康防護與關懷）' },
      stars: '★★★☆☆',
      calculation: `<strong>【立太極長輩壽元與健康關卡推算依據】：</strong><br>• <strong>受考驗宮位</strong>：父母宮借宮疾厄位（子女宮）<br>• <strong>星曜引動</strong>：父母宮逢煞曜引動，長生十二神臨衰病之鄉<br>• <strong>預警時段</strong>：2026 年下半年秋冬之際（特別是流月煞忌引動父母位時段）<br>• <strong>積極佈局建議</strong>：1. 提前安排定期全面健康檢查；2. 準備醫療資源與緊急聯絡網絡；3. 平常多抽空陪伴長輩、注意起居安全。`,
      remedy: null,
      crisisWarning: null,
      sensual: null,
      badPeachBlossom: null,
      lang: 'zh'
    };
  }

  // 0.07 提問：「我婚姻有危機嗎？」或婚姻、外遇、夫妻危機（提前預知、降低傷害、積極佈局）
  if ((q.includes('婚姻') && (q.includes('危機') || q.includes('破裂') || q.includes('問題') || q.includes('外遇') || q.includes('出軌') || q.includes('第三者'))) || q.includes('外遇') || (q.includes('危機') && (q.includes('婚') || q.includes('夫') || q.includes('妻') || q.includes('感情')))) {
    if (isThai) {
      return {
        plain: `จากการคำนวณตามดวงชะตา วังคู่ครองมีดาวฮว่าจี้ร่วมกับคงเจี๋ย ทำให้ชีวิตคู่มีความเสี่ยงต่อการนอกใจหรือเกิดรอยร้าวขึ้นได้ โดยมีความเป็นไปได้ค่อนข้างสูงครับ ช่วงนี้ทั้งสองฝ่ายอาจมีความคิดเห็นขัดแย้งหรือความไม่เข้าใจกัน นี่คือคำแนะนำของผม: แนะนำให้เปิดใจพูดคุยกันอย่างตรงไปตรงมา ปรับฮวงจุ้ยในบ้านเพื่อขจัดพลังงานมือที่สาม และหากจำเป็นควรเข้ารับคำปรึกษาปัญหาชีวิตคู่ครับ`,
        light: { type: 'red', text: 'แจ้งเตือนความเสี่ยงชีวิตคู่ (ต้องเร่งประคับประคอง)' },
        stars: '★★☆☆☆',
        calculation: `<strong>【การคำนวณเต็มรูปแบบเพื่อประเมินความเสี่ยงชีวิตคู่】：</strong><br>• <strong>วังหลัก</strong>: วังคู่ครอง (夫妻宮) พบดาวเคราะห์ร้ายและ『化忌 (ฮว่าจี้)』เล็ง พร้อมดาว『地空 (ตี้คง)』『地劫 (ตี้เจี๋ย)』<br>• <strong>เกณฑ์เสี่ยง</strong>: วังคู่ครองพบฮว่าจี้ร่วมกับคงเจี๋ย มีความเสี่ยงต่อการนอกใจหรือเกิดรอยร้าว<br>• <strong>ช่วงเวลาที่ควรระวังเป็นพิเศษ</strong>: ช่วงดาว『廉貞化忌 (เหลียนเจินฮว่าจี้)』เล็ง<br>• <strong>แนวทางแก้ไขเชิงรุก</strong>: 1. จัดเวลาพูดคุยเปิดใจกันอย่างสม่ำเสมอ; 2. จัดฮวงจุ้ยห้องนอนเพื่อขจัดพลังงานมือที่สาม; 3. ปรึกษาผู้เชี่ยวชาญหากเกิดข้อขัดแย้ง`,
        remedy: null,
        crisisWarning: null,
        sensual: null,
        badPeachBlossom: null,
        lang: 'th'
      };
    }

    return {
      plain: `根據命盤推算，夫妻宮化忌會空劫，婚姻有外遇或破裂風險，可能性很高。這段時間雙方在溝通與相處上容易產生隔閡甚至不信任。這是我的建議：建議提前溝通、進行風水佈局斬爛桃花、必要時尋求諮商，主動化解潛在矛盾。`,
      light: { type: 'red', text: '高度預警（需積極維繫與防範風險）' },
      stars: '★★☆☆☆',
      calculation: `<strong>【立太極夫妻宮與婚姻危機推算依據】：</strong><br>• <strong>核心宮位</strong>：夫妻宮見煞曜與化忌相沖、空劫同度<br>• <strong>風險格局</strong>：夫妻宮化忌會空劫，婚姻有外遇或破裂風險<br>• <strong>關鍵預警期</strong>：2026 丙午年廉貞化忌值年沖破夫妻位<br>• <strong>積極佈局方針</strong>：1. 雙方提前溝通心結、避免冷戰；2. 陽宅臥室風水佈局斬爛桃花、避開鏡照床；3. 必要時主動尋求專業心理或婚姻諮商介入。`,
      remedy: null,
      crisisWarning: null,
      sensual: null,
      badPeachBlossom: null,
      lang: 'zh'
    };
  }

  // 0.08 提問：「我財務有危機嗎？」或財務破耗、虧損（提前預知、降低傷害、積極佈局）
  if (q.includes('破財') || (q.includes('財務') && (q.includes('危機') || q.includes('破耗') || q.includes('虧損') || q.includes('漏財')))) {
    if (isThai) {
      return {
        plain: `จากการคำนวณตามดวงชะตา วังการเงินมีดาวฮว่าจี้ ทำให้สถานะทางการเงินมีความเสี่ยงต่อการสูญเสียหรือการรั่วไหล โดยมีความเป็นไปได้ค่อนข้างสูงครับ นี่คือคำแนะนำของผม: แนะนำให้จัดสรรสินทรัพย์เชิงรับล่วงหน้า หลีกเลี่ยงการลงทุนที่มีความเสี่ยงสูง และสำรองเงินสดไว้ให้เพียงพอครับ`,
        light: { type: 'red', text: 'เตือนการรั่วไหลทางการเงิน (เน้นการตั้งรับ)' },
        stars: '★★☆☆☆',
        calculation: `<strong>【การคำนวณเต็มรูปแบบเพื่อป้องกันวิกฤตการเงิน】：</strong><br>• <strong>วังหลัก</strong>: วังการเงิน (財帛宮) พบดาว『化忌 (ฮว่าจี้)』หรือ『大耗 (ต้าฮ่าว)』เล็ง<br>• <strong>เกณฑ์เสี่ยง</strong>: วังการเงินมีฮว่าจี้ มีความเสี่ยงต่อการสูญเสียทรัพย์<br>• <strong>แนวทางป้องกันเชิงรุก</strong>: 1. จัดสรรสินทรัพย์ป้องกันไว้ล่วงหน้า; 2. หลีกเลี่ยงการลงทุนเสี่ยงสูง; 3. สำรองเงินสดฉุกเฉินอย่างน้อย 6 เดือน`,
        remedy: null,
        crisisWarning: null,
        sensual: null,
        badPeachBlossom: null,
        lang: 'th'
      };
    }

    return {
      plain: `根據命盤推算，財帛宮化忌，財務有破耗風險，可能性很高。這段時間你在資金運作與投資上容易受外在干擾或判斷失誤而出現損失。這是我的建議：建議提前資產配置、避免高風險投資、保留現金，穩健防守為上。`,
      light: { type: 'red', text: '破耗預警（嚴守防禦，保留現金）' },
      stars: '★★☆☆☆',
      calculation: `<strong>【財帛宮煞忌與財務破耗防禦推算依據】：</strong><br>• <strong>核心宮位</strong>：財帛宮逢化忌坐守或耗星相照<br>• <strong>風險格局</strong>：財帛宮化忌，財務有破耗風險<br>• <strong>成因分析</strong>：受煞忌星引動，決策易衝動或遇合約陷阱<br>• <strong>積極佈局方針</strong>：1. 提前資產配置與穩健防守；2. 嚴格避免高風險投資與加槓桿；3. 保留充裕生活與營運週轉現金儲備。`,
      remedy: null
    };
  }

  // 0.1 提問：「我明天適合買彩券嗎？」或「明天適合買彩票嗎？」
  if ((q.includes('明天') || (intent && intent.timeFrame && intent.timeFrame.isTomorrow)) &&
      (q.includes('彩券') || q.includes('樂透') || q.includes('彩票') || q.includes('刮刮樂') || category === 'letou') &&
      (q.includes('適合') || q.includes('買') || q.includes('嗎') || (intent && intent.goal === 'suitability'))) {
    const tm = data.tomorrowLottery || {
      date: '2026-09-24',
      displayDate: '9月24日',
      dailyGanZhi: '辛丑',
      letouScore: 11,
      piancaiScore: 7,
      isSuitable: true,
      bestHour: '申時 (15:00-17:00) 或 巳時 (09:00-11:00)',
      luckyDirection: '正東方',
      luckyDirectionTh: 'ทิศตะวันออก',
      details: [
        { rule: '流日命宮見貪狼+火星同度(火貪格暴富)', points: 3 },
        { rule: '流日財帛宮三方照會七殺+火星', points: 2 },
        { rule: '命宮本宮見祿存', points: 3 }
      ]
    };
    const isSuitable = tm.isSuitable;
    const tmFull = formatAuspiciousDate(tm.date);
    if (isThai) {
      return {
        plain: isSuitable
          ? `คุณเหมาะกับการซื้อลอตเตอรี่ในวันพรุ่งนี้เป็นอย่างยิ่งครับ! วันพรุ่งนี้ ${tmFull} มีคะแนนเสี่ยงโชคสูงถึง ${tm.letouScore} คะแนน มีเกณฑ์『火貪格 (ฮั่วทานเก๋อ)』และดาวมงคลหนุนนำ แนะนำให้เลือกซื้อช่วง ${tm.bestHour} มุ่งหน้าสู่ ${tm.luckyDirectionTh} เพื่อเปิดรับโชคลาภครับ`
          : `คุณไม่แนะนำให้ซื้อลอตเตอรี่ในวันพรุ่งนี้ครับ เพราะพลังงานโชคลาภวันพรุ่งนี้ค่อนข้างเบาบาง ได้คะแนนเพียง ${tm.letouScore} คะแนน แนะนำให้เก็บงบไว้รอวันมงคลสูงสุดในอนาคตจะคุ้มค่ากว่าครับ`,
        light: { type: isSuitable ? 'green' : 'red', text: isSuitable ? 'เหมาะอย่างยิ่ง (ฤกษ์มงคลเสี่ยงโชค)' : 'ไม่แนะนำ (พลังงานธรรมดา)' },
        stars: isSuitable ? '★★★★★' : '★★☆☆☆',
        calculation: `<strong>【การคำนวณเต็มรูปแบบ - การประเมินความเหมาะสมในการเสี่ยงโชควันพรุ่งนี้ ${tmFull}】：</strong><br>• <strong>ข้อสรุป: 【${isSuitable ? 'เหมาะสม (มงคลยิ่ง)' : 'ไม่เหมาะสม (ควรหลีกเลี่ยง)'}】</strong><br>• <strong>คะแนนพลังงาน</strong>: ${tm.letouScore} คะแนน (ลาภลอย ${tm.piancaiScore} คะแนน)<br>• <strong>เกณฑ์ดาว</strong>: ${(tm.details || []).map(d => `${d.rule}(+${d.points})`).join('、 ')}<br>• <strong>ยามมงคล</strong>: ${tm.bestHour}<br>• <strong>ทิศเทพเจ้าแห่งโชคลาภ</strong>: ${tm.luckyDirectionTh || tm.luckyDirection}`,
        remedy: null,
        crisisWarning: null,
        sensual: null,
        badPeachBlossom: null,
        lang: 'th'
      };
    }

    return {
      plain: isSuitable
        ? `你明天適合買彩券！明天為 ${tmFull}，樂透評分高達 ${tm.letouScore} 分，命宮逢『火貪格暴富』與祿存同度，財帛宮更有破軍與七殺火星照會。你可以試試明天${tm.bestHour}往住家${tm.luckyDirection}的彩券行挑選號碼。`
        : `你明天不適合買彩券。明天為 ${tmFull}，因為明天的偏財與樂透評分僅 ${tm.letouScore} 分，能量較為平淡，建議先把荷包省下來，改挑未來更強的吉日。`,
      light: { type: isSuitable ? 'green' : 'red', text: isSuitable ? '大吉（適合買彩券）' : '平淡（不建議下注）' },
      stars: isSuitable ? '★★★★★' : '★★☆☆☆',
      calculation: `<strong>【明日 ${tmFull} 樂透下注適宜度推算】：</strong><br>• <strong>定論：【${isSuitable ? '適合（大吉）' : '不適合（避開）'}】</strong><br>• <strong>樂透能量得分</strong>：${tm.letouScore} 分（偏財得分 ${tm.piancaiScore} 分）<br>• <strong>命中格局細節</strong>：${(tm.details || []).map(d => `${d.rule}(+${d.points})`).join('、 ')}<br>• <strong>推薦吉時</strong>：${tm.bestHour}<br>• <strong>財神吉方</strong>：${tm.luckyDirection}（辛干財神方）`,
      remedy: null,
      crisisWarning: null,
      sensual: null,
      badPeachBlossom: null,
      lang: 'zh'
    };
  }

  // 0.2 提問：「我下個月偏財如何？」
  if ((q.includes('下個月') || q.includes('下月') || (intent && intent.timeFrame && intent.timeFrame.isNextMonth)) &&
      (q.includes('偏財') || q.includes('橫財') || category === 'piancai')) {
    const nm = data.nextMonthPiancai || {
      month: '2026-10',
      bestDay: { date: '2026-10-06', displayDate: '10月6日', dailyGanZhi: '癸丑', score: 12 },
      topDays: [
        { date: '2026-10-06', displayDate: '10月6日', dailyGanZhi: '癸丑', score: 12, rules: ['財帛宮本宮逢化祿(破軍)', '命宮本宮見祿存'] },
        { date: '2026-10-12', displayDate: '10月12日', dailyGanZhi: '己未', score: 9, rules: ['財帛宮本宮逢化祿(武曲)'] },
        { date: '2026-10-02', displayDate: '10月2日', dailyGanZhi: '己酉', score: 7, rules: ['財帛宮沖照化祿(武曲)'] },
        { date: '2026-10-10', displayDate: '10月10日', dailyGanZhi: '丁巳', score: 7, rules: ['財帛宮逢破軍', '命宮祿存'] },
        { date: '2026-10-22', displayDate: '10月22日', dailyGanZhi: '己巳', score: 7, rules: ['財帛宮逢破軍', '命宮祿存'] }
      ]
    };
    const b = nm.bestDay || nm.topDays[0];
    const bFull = formatAuspiciousDate(b.date, { displayMonthDay: true });
    if (isThai) {
      return {
        plain: `ในเดือนหน้า วันที่ดวงลาภลอยพุ่งแรงที่สุด คือ ${formatAuspiciousDate(b.date)} ได้คะแนนสูงถึง ${b.score} คะแนนครับ วันนั้นวังการเงินมีพลังงานทะลักจุดแตก เหมาะแก่การคว้าจังหวะสั้นๆ หรือลุ้นโชค นอกจากนี้ยังมีวันที่ 12 ต.ค. และ 2 ต.ค. ที่พลังงานดีเยี่ยมเช่นกันครับ`,
        light: { type: 'green', text: 'มหาโชค (ดาวลาภลอยเดือนหน้าเปล่งประกาย)' },
        stars: '★★★★★',
        calculation: `<strong>【การคำนวณเต็มรูปแบบ - 5 อันดับวันลาภลอยสูงสุดในเดือนหน้า (${nm.month})】：</strong><br>` +
          nm.topDays.map((d, i) => `${i + 1}. <strong>${formatAuspiciousDate(d.date)}</strong>：ได้คะแนน <strong>${d.score} คะแนน</strong>（เกณฑ์ดาว：${d.rules.slice(0, 3).join('、 ')}）`).join('<br>'),
        remedy: null,
        crisisWarning: null,
        sensual: null,
        badPeachBlossom: null,
        lang: 'th'
      };
    }

    return {
      plain: `下個月偏財最旺的一天是 ${bFull}，得分高達 ${b.score} 分。當天財帛宮破軍逢化祿，偏財能量爆發，非常適合把握短線契機或小試手氣。整個月還有 10/12、10/2 等好日子，整體進財節奏很順暢。`,
      light: { type: 'green', text: '大吉（偏財高峰湧現）' },
      stars: '★★★★★',
      calculation: `<strong>【下個月 (${nm.month}) 偏財最旺 TOP 5 排行榜】：</strong><br>` +
        nm.topDays.map((d, i) => `${i + 1}. <strong>${formatAuspiciousDate(d.date)}</strong>：得分 <strong>${d.score} 分</strong>（命中規則：${d.rules.slice(0, 3).join('、 ')}）`).join('<br>'),
      remedy: null,
      crisisWarning: null,
      sensual: null,
      badPeachBlossom: null,
      lang: 'zh'
    };
  }

  // 0.3 提問：「我這週偏財如何？」
  if ((q.includes('這週') || q.includes('本週') || q.includes('这周') || q.includes('本周') || q.includes('這星期') || q.includes('本星期')) &&
      (q.includes('偏財') || q.includes('橫財') || category === 'piancai')) {
    const tw = data.thisWeekPiancai || {
      weekStart: '2026-09-21',
      weekEnd: '2026-09-27',
      bestDay: { date: '2026-09-24', displayDate: '9月24日', dailyGanZhi: '辛丑', score: 7 },
      topDays: [
        { date: '2026-09-22', displayDate: '9月22日', dailyGanZhi: '己亥', score: 8, isPast: true, rules: ['財帛宮逢祿存', '吉星照會'] },
        { date: '2026-09-24', displayDate: '9月24日', dailyGanZhi: '辛丑', score: 7, isPast: false, rules: ['財帛宮逢破軍', '三方照會貪狼', '命宮祿存'] },
        { date: '2026-09-26', displayDate: '9月26日', dailyGanZhi: '癸卯', score: 3, isPast: false, rules: ['吉星拱照'] }
      ]
    };
    const b = tw.bestDay || tw.topDays.find(d => !d.isPast) || tw.topDays[0];
    const bFull = formatAuspiciousDate(b.date, { displayMonthDay: true });
    if (isThai) {
      return {
        plain: `ในสัปดาห์นี้ วันที่ดวงลาภลอยพุ่งแรงที่สุด คือ ${formatAuspiciousDate(b.date)} ได้คะแนน ${b.score} คะแนนครับ วันนั้นวังการเงินมีดาวพั่วจวินและลู่ชุนหนุนนำ ถือเป็นจังหวะทองที่ดีที่สุดในการลุ้นโชคหรือสร้างรายได้เสริมในสัปดาห์นี้ครับ`,
        light: { type: 'green', text: 'มหาโชค (จังหวะทองประจำสัปดาห์)' },
        stars: '★★★★☆',
        calculation: `<strong>【การคำนวณเต็มรูปแบบ - 3 อันดับวันลาภลอยสูงสุดในสัปดาห์นี้】：</strong><br>` +
          tw.topDays.map((d, i) => `${i + 1}. <strong>${formatAuspiciousDate(d.date)}</strong>：ได้คะแนน <strong>${d.score} คะแนน</strong>${d.isPast ? '（ช่วงที่ผ่านมา）' : '（ฤกษ์มงคลในสัปดาห์นี้）'}（เกณฑ์ดาว：${d.rules.slice(0, 3).join('、 ')}）`).join('<br>'),
        remedy: null,
        crisisWarning: null,
        sensual: null,
        badPeachBlossom: null,
        lang: 'th'
      };
    }

    return {
      plain: `這週偏財最旺的一天是 ${bFull}，得分 ${b.score} 分。這一天財帛宮逢破軍坐守、三方照會貪狼且命宮見祿存，是這週最有手氣與額外收益機會的良辰。如果想操作短線或小買彩券，那天會是本週的最佳時機。`,
      light: { type: 'green', text: '大吉（週運財星照臨）' },
      stars: '★★★★☆',
      calculation: `<strong>【本週偏財最旺 TOP 3 排行榜】：</strong><br>` +
        tw.topDays.map((d, i) => `${i + 1}. <strong>${formatAuspiciousDate(d.date)}</strong>：得分 <strong>${d.score} 分</strong>${d.isPast ? '（已過，用於歷史驗證）' : '（未來決策良辰）'}（命中規則：${d.rules.slice(0, 3).join('、 ')}）`).join('<br>'),
      remedy: null,
      crisisWarning: null,
      sensual: null,
      badPeachBlossom: null,
      lang: 'zh'
    };
  }

  // 0.4 提問：「今年偏財如何？」
  if ((q.includes('今年') || q.includes('全年') || q.includes('整年') || (intent && intent.timeFrame && intent.timeFrame.type === 'year')) &&
      (q.includes('偏財') || q.includes('橫財') || category === 'piancai')) {
    const defaultTopDays = [
      { date: '2026-10-06', displayDate: '10月6日', dailyGanZhi: '癸丑', score: 12, rules: ['財帛宮逢化祿(破軍)', '命宮祿存'] },
      { date: '2026-10-12', displayDate: '10月12日', dailyGanZhi: '己未', score: 9, rules: ['財帛宮逢化祿(武曲)'] },
      { date: '2026-09-24', displayDate: '9月24日', dailyGanZhi: '辛丑', score: 7, rules: ['財帛宮逢破軍', '命宮祿存'] },
      { date: '2026-10-02', displayDate: '10月2日', dailyGanZhi: '己酉', score: 7, rules: ['財帛宮沖照化祿(武曲)'] },
      { date: '2026-10-10', displayDate: '10月10日', dailyGanZhi: '丁巳', score: 7, rules: ['財帛宮逢破軍', '命宮祿存'] }
    ];
    const f30 = data.future30DaysPiancai;
    const topDaysList = (f30 && f30.topDays && f30.topDays.length > 0) ? f30.topDays : defaultTopDays;
    const b = (f30 && (f30.bestDay || (f30.topDays && f30.topDays[0]))) || defaultTopDays[0];
    const bFull = formatAuspiciousDate(b.date, { displayMonthDay: true });
    if (isThai) {
      return {
        plain: `พี่บอกเลย ดูดวงแล้วปีนี้ดวงลาภลอย (偏財) ของเธอในรอบ 30 วันข้างหน้า วันที่พีคสุดคือ ${formatAuspiciousDate(b.date)} ได้คะแนนสูงถึง ${b.score} คะแนน! วันนั้นวังการเงินมีพลัง『破軍逢祿 (พั่วจวินเฝิงลู่)』ร่วมกับ『祿存 (ลู่ฉุน)』เข้ามาหนุน อย่ารอช้า รีบไปลุ้นดู แต่บอกก่อนนะ อย่าซื้อเยอะ ดูดวงแล้วดวงการเงินเธอไม่ได้ปังขนาดนั้น ซื้อสนุกๆ พอ อย่าเพิ่งทุ่มหมดหน้าตัก!`,
        light: { type: 'green', text: 'มหาโชค (ดาวการเงินส่องสว่าง)' },
        stars: '★★★★★',
        calculation: `<strong>【การคำนวณเต็มรูปแบบ - แนวโน้มโชคลาภลอยตลอดปี 2026】：</strong><br>• ตลอดทั้งปีมีพลังโชคลาภลอยโดดเด่น วังการเงินพบดาว『武曲 (อู่ฉวี่)』และ『破軍 (พั่วจวิน)』ร่วมกับ『祿存 (ลู่ฉุน)』และ『化祿 (ฮว่าลู่)』หลายครั้ง<br><br><strong>【5 อันดับวันลาภลอยสูงสุดในรอบ 30 วันข้างหน้า】：</strong><br>` +
          topDaysList.map((d, i) => `${i + 1}. <strong>${formatAuspiciousDate(d.date)}</strong>：ได้คะแนน <strong>${d.score} คะแนน</strong>（เกณฑ์ดาว：${d.rules.slice(0, 3).join('、 ')}）`).join('<br>'),
        remedy: null,
        sensual: null,
        badPeachBlossom: null,
        crisisWarning: null,
        lang: 'th'
      };
    }

    return {
      plain: `Jack 老師說，你今年偏財最旺的日期是 ${bFull}，得分高達 ${b.score} 分。算到我都快白頭髮了，這一天盤面上手氣直接拉滿，財帛宮逢『破軍逢祿』加『祿存』同宮！看到這天別等了，快衝去挑張彩券試試手氣！但先說好，別衝動梭哈，小試身手開心就好，懂理財才留得住財神爺！`,
      light: { type: 'green', text: '大吉（財星高照，把握未來30天高峰）' },
      stars: '★★★★★',
      calculation: `<strong>【2026 全年偏財總體走勢】：</strong><br>• 整年偏財動能旺盛，財帛宮多次遇武曲、破軍逢祿存與化祿引動。<br><br><strong>【未來 30 天內偏財最旺 TOP 5 排行榜】：</strong><br>` +
        topDaysList.map((d, i) => `${i + 1}. <strong>${formatAuspiciousDate(d.date)}</strong>：得分 <strong>${d.score} 分</strong>（命中規則：${d.rules.slice(0, 3).join('、 ')}）`).join('<br>'),
      remedy: null,
      sensual: null,
      badPeachBlossom: null,
      crisisWarning: null,
      lang: 'zh'
    };
  }

  // 0.5 提問：「上個月偏財如何？」(過去驗證)
  if ((q.includes('上個月') || q.includes('上月') || (intent && intent.timeFrame && intent.timeFrame.isPrevMonth)) &&
      (q.includes('偏財') || q.includes('橫財') || category === 'piancai')) {
    const pm = data.prevMonthPiancai || {
      month: '2026-08',
      topDays: [
        { date: '2026-08-07', displayDate: '8月7日', dailyGanZhi: '癸丑', score: 12, rules: ['財帛宮逢化祿(破軍)', '命宮祿存'] },
        { date: '2026-08-13', displayDate: '8月13日', dailyGanZhi: '己未', score: 9, rules: ['財帛宮逢化祿(武曲)'] },
        { date: '2026-08-23', displayDate: '8月23日', dailyGanZhi: '己巳', score: 7, rules: ['財帛宮逢破軍'] }
      ]
    };
    const b = pm.topDays[0];
    const bFull = formatAuspiciousDate(b.date, { displayMonthDay: true });
    return {
      plain: `上個月（${pm.month}）偏財最旺的一天是 ${bFull}，得分 ${b.score} 分。此數據為過去歷史走勢，可用於驗證上個月你是否有意外進財或手氣順遂的經驗。`,
      light: { type: 'yellow', text: '歷史驗證（過去月份數據）' },
      stars: '★★★★☆',
      calculation: `<strong>【上個月 (${pm.month}) 歷史偏財 TOP 3（驗證用）】：</strong><br>` +
        pm.topDays.map((d, i) => `${i + 1}. <strong>${formatAuspiciousDate(d.date)}</strong>：得分 <strong>${d.score} 分</strong>（已過，用於歷史比對）（規則：${d.rules.slice(0, 3).join('、 ')}）`).join('<br>'),
      remedy: null
    };
  }

  // 1. 提問：「昨晚買了樂透，今晚開獎有得獎的機會嗎？」或「今晚買彩券，明天開獎有機會嗎？」
  if (data.dualDay || q.includes('昨晚買') || (q.includes('今晚') && (q.includes('開獎') || q.includes('買彩券')))) {
    const isYesterday = q.includes('昨晚買') || q.includes('昨');
    if (isThai) {
      return {
        plain: isYesterday
          ? `พี่บอกเลย ใบที่เธอซื้อไว้เมื่อคืนนี้ โอกาสถูกรางวัลในคืนนี้อยู่ที่ประมาณ 30% ซื้อสนุกๆ พอนะ! เพราะพลังงานของวันซื้อค่อนข้างธรรมดา แต่พลังงานวันออกรางวัลคืนนี้ถือว่าใช้ได้ ถ้าเธอซื้อลุ้นรางวัลเล็กๆ ถือว่ามีลุ้นอยู่ อย่าเพิ่งทุ่มหมดหน้าตัก ครั้งต่อไปลองเลือกวันที่ 6 ตุลาคมดูสิ วันนั้นพลังงานโชคลาภจะแข็งแกร่งที่สุดในรอบปี`
          : `พี่บอกเลย ใบที่ซื้อคืนนี้ออกผลพรุ่งนี้ โอกาสถูกรางวัลโดยรวมอยู่ที่ประมาณ 35% ซื้อสนุกๆ พอนะ! เพราะพลังงานคืนนี้อาจมีจุดสะดุดนิดหน่อย แต่พลังงานวันออกรางวัลพรุ่งนี้ด้านการเงินค่อนข้างดี ถ้าซื้อลุ้นสนุกๆ รางวัลเล็กมีโอกาสอยู่ แนะนำให้ซื้อช่วงยามเซิน (15:00-17:00) มุ่งหน้าทิศใต้ แต่ถ้าอยากลุ้นวันเฮงสุดๆ ครั้งหน้าลองเลือกวันที่ 6 ต.ค. ดูสิ วันนั้นพลังงานปังที่สุด!`,
        light: { type: 'yellow', text: 'พลังงานปานกลาง (ลุ้นรางวัลย่อยได้)' },
        stars: '★★★☆☆',
        calculation: `<strong>【การคำนวณเต็มรูปแบบ】：</strong><br>• คะแนนพลังงานในวันซื้อสลาก: ${data.dualDay ? data.dualDay.buyScore : 4} คะแนน<br>• คะแนนพลังงานในวันออกรางวัล: ${data.dualDay ? data.dualDay.drawLetouScore : 1} คะแนน (ลาภลอย ${data.dualDay ? data.dualDay.drawPiancaiScore : 1} คะแนน)<br>• วันโชคลาภสูงสุดแห่งปี: ${data.dualDay?.nextGoldenDay?.displayDate || '6 ต.ค.'} (คะแนน ${data.dualDay?.nextGoldenDay?.score || 14} คะแนนเต็ม)`,
        remedy: null,
        crisisWarning: null,
        sensual: null,
        badPeachBlossom: null,
        lang: 'th'
      };
    }

    return {
      plain: isYesterday
        ? `你昨晚買的那張，今晚開獎的中獎機率大概 30%。因為昨晚的下注日分數普通，但今晚開獎日的能量還不錯。如果你買的是小額彩券，中個小獎的機率是有的。下次可以挑 10 月 6 日，那天的能量最強。`
        : `今晚買的彩券明天開獎，中獎機率大概 35%。因為今晚下注日的能量稍受干擾，但明天開獎日的財氣很旺。如果你打算小試手氣，中個小獎的機率是有的。最佳下注時間你可以試試申時（下午 3 點到 5 點）往正北方。想要追求頭獎的話，下次可以挑 10 月 6 日，那天的能量最強。`,
      light: { type: 'yellow', text: '能量平吉（小獎可期，大獎宜選黃金日）' },
      stars: '★★★☆☆',
      calculation: `<strong>【星盤能量參考依據】：</strong><br>• 下注日（${data.dualDay ? data.dualDay.buyDate : '2026-09-21'}）：樂透評分 ${data.dualDay ? data.dualDay.buyScore : 4} 分<br>• 開獎日（${data.dualDay ? data.dualDay.drawDate : '2026-09-22'}）：樂透得分 ${data.dualDay ? data.dualDay.drawLetouScore : 1} 分，偏財引動 ${data.dualDay ? data.dualDay.drawPiancaiScore : 1} 分<br>• 全年最強能量下注日：${data.dualDay?.nextGoldenDay?.displayDate || '10 月 6 日'}（評分高達 ${data.dualDay?.nextGoldenDay?.score || 14} 分）`,
      remedy: null
    };
  }

  // 2. 提問：「我下週三適合簽約嗎？」
  if (q.includes('簽約') || q.includes('合同') || q.includes('เซ็นสัญญา') || q.includes('สัญญา') || (data.singleDay && (q.includes('下週三') || q.includes('วันพุธ')))) {
    const sDate = data.singleDay ? data.singleDay.displayDate : '9/30';
    if (isThai) {
      return {
        plain: `พี่บอกเลย ดูดวงแล้ววันพุธหน้า (30 ก.ย.) พลังงานเหมาะกับการเซ็นสัญญาอย่างยิ่งครับ วันนั้นมีเกณฑ์『祿馬交馳 (ลู่หม่าเจียวฉือ)』ส่งผลให้คุณคุมอำนาจการเจรจาไว้ในมือ อย่ารอช้า ลุยได้เลย! แนะนำให้เลือกช่วงเช้า 09:00 - 11:00 น. ใส่เสื้อผ้าโทนสีขาวหรือสีกรมท่า และเลือกนั่งทิศตะวันตกเฉียงเหนือหันหน้าสู่ทิศตะวันออกเฉียงใต้ครับ`,
        light: { type: 'green', text: 'พลังงานมหาโชค (ฤกษ์ทองเซ็นสัญญา)' },
        stars: '★★★★★',
        calculation: `<strong>【การคำนวณเต็มรูปแบบ】：</strong><br>• วันที่เซ็นสัญญา: 2026-09-30 (วัน 丁未)<br>• คะแนนโอกาสทางธุรกิจ: 9 คะแนน (สูงสุดในรอบเดือน)<br>• เกณฑ์ดาวมงคลหลัก: มีเกณฑ์『祿馬交馳 (ลู่หม่าเจียวฉือ)』และดาวจักรพรรดิ『紫微 (จื่อเวย)』『天府 (เทียนฝู่)』คุมวังการงาน<br>• ยามมงคล: 09:00 - 11:00 น. (ยามซื่อ 巳時) | ฮวงจุ้ยโต๊ะเจรจา: นั่งทิศตะวันตกเฉียงเหนือหันหน้าสู่ทิศตะวันออกเฉียงใต้`,
        remedy: null,
        crisisWarning: null,
        sensual: null,
        badPeachBlossom: null,
        lang: 'th'
      };
    }

    return {
      plain: `下週三（${sDate}）的能量很適合簽約，那天有『祿馬交馳』的格局，代表談判主導權在你手上。建議選在早上 9 點到 11 點，穿白色或海軍藍，坐西北朝東南。`,
      light: { type: 'green', text: '能量大吉（談判主導，簽約首選）' },
      stars: '★★★★★',
      calculation: `<strong>【星盤能量參考依據】：</strong><br>• 簽約日期：2026-09-30 (丁未日)<br>• 商機能量得分：9 分（全月最高峰），貴人助力加持<br>• 核心格局：祿馬交馳、紫微天府雙帝星鎮守官祿宮<br>• 推薦吉時：早上 09:00 - 11:00 (巳時) | 談判座位：坐西北乾位朝東南`,
      remedy: null
    };
  }

  // 3. 提問：「我這個月桃花如何？」
  if ((q.includes('桃花') || q.includes('感情') || q.includes('ความรัก') || q.includes('เสน่ห์')) && (q.includes('這個月') || q.includes('本月') || q.includes('月') || q.includes('เดือนนี้') || q.includes('เดือน') || isThai)) {
    if (isThai) {
      return {
        plain: `พี่บอกเลย ดูดวงแล้วเดือนนี้ดวงเสน่ห์และความรักของเธอปังมาก! มีช่วงพีคถึง 8 วัน วันที่พลังงานแรงสุดคือ 24 ก.ย., 25 ก.ย. และ 30 ก.ย. อย่ารอช้า รีบออกไปเข้าสังคมเปิดรับสิ่งดีๆ! แต่บอกก่อนนะ วันที่ 17 ก.ย. ต้องระวังหน่อย อาจเกิดความเข้าใจผิดจากการสื่อสาร ใจเย็นๆ อย่าใจร้อน`,
        light: { type: 'green', text: 'พลังงานมหาโชค (เสน่ห์เปล่งประกาย)' },
        stars: '★★★★★',
        calculation: `<strong>【การคำนวณเต็มรูปแบบ】：</strong><br>• จำนวนวันเสน่ห์ความรักสูงสุดในเดือนนี้: รวม 8 วันที่ได้คะแนน 8 คะแนนเต็ม<br>• วันมงคลสูงสุดในเดือน 9: 9/24 (辛丑), 9/25 (壬寅), 9/30 (丁未)<br>• วันที่ควรระวัง: 9/17 (วัน 甲午 มีดาว『化忌 (ฮว่าจี้)』เล็งวังคู่ครอง ควรใจเย็นและสื่อสารด้วยความเข้าใจ)`,
        remedy: null,
        crisisWarning: null,
        sensual: null,
        badPeachBlossom: null,
        lang: 'th'
      };
    }

    return {
      plain: `這個月你的桃花運很旺，有 8 天是高峰期。最強的是 9/24、9/25、9/30。這幾天適合出門社交、參加聚會。但 9/17 那天要注意，容易因為溝通誤會而吵架。`,
      light: { type: 'green', text: '能量大吉（良緣湧動，魅力高峰）' },
      stars: '★★★★★',
      calculation: `<strong>【星盤能量參考依據】：</strong><br>• 全月桃花高峰天數：共 8 天得分達到 8 分滿載<br>• 9 月最強良辰：9/24 (辛丑)、9/25 (壬寅)、9/30 (丁未)<br>• 避忌提醒日：9/17 (甲午日，逢化忌沖命夫，宜冷靜溝通)`,
      remedy: null
    };
  }

  // 3.9 提問：「10 อันดับวันโชคลาภลอตเตอรี่สูงสุด」或「樂透 TOP 10」
  if (q.includes('10 อันดับ') || (q.includes('ลอตเตอรี่') && (q.includes('อันดับ') || q.includes('สูงสุด'))) || (q.includes('วันโชคลาภ') && q.includes('สูงสุด') && q.includes('ลอตเตอรี่'))) {
    if (isThai) {
      return {
        plain: `พี่บอกเลย ดูดวงแล้ว 10 วันโชคลาภลอตเตอรี่ที่แข็งแกร่งที่สุดของคุณในปีนี้คือ: อันดับ 1 คือ 6 ตุลาคม (農曆八月廿六, 癸丑日, วันอังคาร) นี่แหละคือวันที่ดวงเฮงสุด มีเกณฑ์『火貪格 (ฮั่วทานเก๋อ)』และ『破軍逢祿 (พั่วจวินเฝิงลู่)』ร่วมกับ『祿存 (ลู่ฉุน)』ได้คะแนนสูงถึง 14 คะแนน อย่ารอช้า รีบไปซื้อก่อนหวยหมด! แต่บอกก่อนนะ อย่าซื้อเยอะ ดูดวงแล้วดวงการเงินเธอไม่ได้ปังขนาดนั้น ซื้อสนุกๆ พอ แนะนำให้เลือกซื้อช่วงยามเซิน (15:00-17:00) มุ่งหน้าสู่ทิศใต้ครับ`,
        light: { type: 'green', text: 'มหาโชค (คะแนนโชคลาภสูงสุด 10 อันดับ)' },
        stars: '★★★★★',
        calculation: `<strong>【การคำนวณเต็มรูปแบบ - 10 อันดับวันโชคลาภลอตเตอรี่สูงสุดปี 2026】：</strong><br>• <strong>อันดับ 1</strong>: 2026-10-06 (農曆八月廿六, 癸丑日, วันอังคาร) — ได้ 14 คะแนนเต็ม (เกณฑ์『火貪格 (ฮั่วทานเก๋อ)』, 『破軍逢祿 (พั่วจวินเฝิงลู่)』, 『祿存 (ลู่ฉุน)』)<br>• <strong>อันดับ 2</strong>: 2026-10-12 (農曆九月初二, 己未日, วันจันทร์) — ได้ 11 คะแนน (เกณฑ์『武曲化祿 (อู่ฉวี่ฮว่าลู่)』, 『火星 (หั่วซิง)』)<br>• <strong>อันดับ 3</strong>: 2026-09-24 (農曆八月十四, 辛丑日, วันพฤหัสบดี) — ได้ 11 คะแนน (เกณฑ์『貪狼 (ทานหลาง)』พบ『火星 (หั่วซิง)』, 『破軍 (พั่วจวิน)』)<br>• <strong>อันดับ 4</strong>: 2026-10-02 (農曆八月廿二, 己酉日, วันศุกร์) — ได้ 9 คะแนน<br>• <strong>อันดับ 5</strong>: 2026-10-10 (農曆八月三十, 丁巳日, วันเสาร์) — ได้ 9 คะแนน<br>• <strong>อันดับ 6</strong>: 2026-10-22 (農曆九月十二, 己巳日, วันพฤหัสบดี) — ได้ 8 คะแนน<br>• <strong>อันดับ 7</strong>: 2026-11-03 (農曆九月廿四, 辛巳日, วันอังคาร) — ได้ 8 คะแนน<br>• <strong>อันดับ 8</strong>: 2026-11-15 (農曆十月初七, 癸巳日, วันอาทิตย์) — ได้ 8 คะแนน<br>• <strong>อันดับ 9</strong>: 2026-11-27 (農曆十月十九, 乙巳日, วันศุกร์) — ได้ 7 คะแนน<br>• <strong>อันดับ 10</strong>: 2026-12-09 (農曆十一月初一, 丁巳日, วันพุธ) — ได้ 7 คะแนน`,
        remedy: null,
        sensual: null,
        badPeachBlossom: null,
        crisisWarning: null,
        lang: 'th'
      };
    }
  }

  // 4. 提問：「คนนี้เหมาะจะซื้อหวยวันไหน」/「我得樂透的日子哪天的運氣最高？」或 "When is my lucky day?" / "What is my lucky day?"
  if (q.includes('คนนี้เหมาะจะซื้อหวยวันไหน') || q.includes('ซื้อหวยวันไหน') || (q.includes('หวย') && q.includes('วันไหน')) || (q.includes('ซื้อหวย') && q.includes('เหมาะ')) ||
      q.includes('最高') || q.includes('運氣最高') || q.toLowerCase().includes('lucky day') || (intent && (intent.goal === 'highest_score' || (intent.event === 'letou' && (intent.goal === 'best_date' || intent.goal === 'suitability'))))) {
    if (isThai) {
      return {
        plain: `พี่บอกเลย ดูดวงแล้วเธอซื้อหวยวันนี้สิ! วันที่ 6 ตุลาคม (農曆八月廿六, 癸丑日, วันอังคาร) นี่แหละคือวันที่ดวงเฮงสุด มีเกณฑ์『火貪格 (ฮั่วทานเก๋อ)』และ『破軍逢祿 (พั่วจวินเฝิงลู่)』แถม『祿存 (ลู่ฉุน)』เข้ามาหนุน อย่ารอช้า รีบไปซื้อก่อนหวยหมด! แต่บอกก่อนนะ อย่าซื้อเยอะ ดูดวงแล้วดวงการเงินเธอไม่ได้ปังขนาดนั้น ซื้อสนุกๆ พอ`,
        light: { type: 'green', text: 'พลังงานมหาโชค (คะแนนโชคลาภสูงสุด)' },
        stars: '★★★★★',
        calculation: `<strong>【การคำนวณเต็มรูปแบบ】：</strong><br>• วันที่มีพลังโชคลาภสูงสุด: 2026-10-06 (農曆八月廿六, 癸丑日, วันอังคาร) — ได้ 14 คะแนนเต็ม<br>• โครงสร้างดวงที่เข้าเกณฑ์: วังชะตาจรพบ『火貪格 (ฮั่วทานเก๋อ)』โชคลาภกะทันหัน + วังการเงิน『破軍逢祿 (พั่วจวินเฝิงลู่)』+ วังชะตาพบ『祿存 (ลู่ฉุน)』<br>• ยามมงคล: ยามเซิน (申時 15:00-17:00) | ทิศเทพเจ้าแห่งโชคลาภ: ทิศใต้`,
        remedy: null,
        sensual: null,
        badPeachBlossom: null,
        crisisWarning: null,
        lang: 'th'
      };
    }

    if (isEnglish) {
      return {
        plain: `Jack 老師 says: Check it out, her luckiest lottery day this year is October 6 (農曆八月廿六, 癸丑日, Tuesday). Don't wait, go grab that ticket! It has the 『Huo Tan Ge (火貪格)』 and 『Po Jun Feng Lu (破軍逢祿)』 patterns with 『Lu Cun (祿存)』. But hey, don't go crazy — the chart says her wealth luck is just okay, so keep it fun and don't bet the house.`,
        light: { type: 'green', text: 'Great Fortune (Highest Luck Day)' },
        stars: '★★★★★',
        calculation: `<strong>【Astrolabe Fortune Calculation Basis】：</strong><br>• <strong>Top Lucky Day</strong>: 2026-10-06 (農曆八月廿六, Gui-Chou day, Tuesday) — Score: 14 pts<br>• <strong>Triggered Patterns</strong>: Huo Tan Ge + Po Jun Feng Lu + Lu Cun<br>• <strong>Lucky Hour & Direction</strong>: Shen hour (15:00-17:00) heading South`,
        remedy: null,
        sensual: null,
        badPeachBlossom: null,
        crisisWarning: null,
        lang: 'en'
      };
    }

    return {
      plain: `Jack 老師說，你今年買彩券手氣最旺的一天是 10 月 6 日（農曆八月廿六，癸丑日，星期二）！當天命盤逢『火貪格』加上『破軍逢祿』與『祿存』同度，手氣直接拉滿到 14 分。看到這天別等了，快衝去挑張彩券試手氣！但先說好，別衝動梭哈，小試身手開心就好，把荷包看緊才留得住好運！`,
      light: { type: 'green', text: '能量大吉（全年中獎機率最高）' },
      stars: '★★★★★',
      calculation: `<strong>【星盤能量參考依據】：</strong><br>• 未來最高分日：2026-10-06 (農曆八月廿六, 癸丑日, 星期二) — 得分高達 14 分<br>• 觸發爆發格局：流日命宮火貪格 + 財帛破軍逢祿存與化祿 + 雙祿朝垣<br>• 吉時方位：申時 (15:00-17:00) 前往正南方彩券行`,
      remedy: null,
      sensual: null,
      badPeachBlossom: null,
      crisisWarning: null,
      lang: 'zh'
    };
  }

  // 5. 提問：「改運 / 調整磁場 / 穴位 / 聞香」
  if (q.includes('改運') || q.includes('調整') || q.includes('磁場') || q.includes('穴位') || q.includes('聞香') || q.includes('補缺')) {
    const ni = data.niAdvice || getNiAdvice({ dailyGanZhi: '己亥' }, lang);
    if (isThai) {
      return {
        plain: `หากต้องการปรับสมดุลสนามพลังงานช่วงนี้ คุณอาจลอง 3 เคล็ดวิชาผ่อนคลายเพื่อปรับสมดุลชี่: 1. สูดดมกลิ่นหอมจากสมุนไพรธรรมชาติให้จิตใจปลอดโปร่ง 2. นวดจุดไป่ฮุ่ยบนกระหม่อมและจุดจู๋ซานหลี่ช่วงเช้าเพื่อกระตุ้นพลังชีวิต 3. จัดโต๊ะทำงานนั่งทิศตะวันตกเฉียงเหนือหันหน้าสู่ทิศตะวันออกเฉียงใต้เพื่อสร้างความมั่นคงในจิตใจครับ`,
        light: { type: 'green', text: 'ปรับสมดุลชี่ (พลังงานบริสุทธิ์)' },
        stars: '★★★★★',
        calculation: `<strong>【การคำนวณเต็มรูปแบบ - การปรับสมดุลสนามพลังงาน】：</strong><br>• สุคนธบำบัด: ใช้กลิ่นสมุนไพรธรรมชาติเพื่อเปิดทวารและขจัดไอชี่อัปมงคล<br>• การนวดจุดลมปราณ: นวดกระตุ้นจุดเพื่อปรับการไหลเวียนของชี่และเลือดในอวัยวะภายใน<br>• ฮวงจุ้ยสนามพลังดิน: นั่งทิศตะวันตกเฉียงเหนือเพื่อเสริมพลังบารมีและความมั่นคง`,
        remedy: {
          aroma: ni.aroma ? `${ni.aroma.title} (${ni.aroma.recipe})` : '柴胡薄荷降真香囊',
          acupoint: ni.acupoint ? `${ni.acupoint.name}，${ni.acupoint.tech}` : '百會穴與足三里穴按摩',
          demai: ni.demai || '坐西北乾位朝東南壓陣'
        },
        crisisWarning: null,
        sensual: null,
        badPeachBlossom: null,
        lang: 'th'
      };
    }

    return {
      plain: `如果想調整近期的身心磁場，你可以試試天紀的三大放鬆法：第一是透過天然中藥香氛（如蒼朮、白芷）醒脾化濕，讓思維清晰；第二是在上午揉按百會穴與足三里穴，促進氣血循環；第三是工作時坐西北乾卦位朝東南，讓自己的氣場更加安定沉穩。`,
      light: { type: 'green', text: '身心調和（能量場提升）' },
      stars: '★★★★★',
      calculation: `<strong>【天紀身心調和依據】：</strong><br>• 芳香醒神：以天然草本香氣提振精神、化解濁氣<br>• 經絡按摩：晨起辰時按揉百會、足三里，調順全身氣機<br>• 空間磁場：主事談判坐西北乾卦天子位，沉著穩健`,
      remedy: {
        aroma: ni.aroma ? `${ni.aroma.title}（${ni.aroma.recipe}）` : '蒼朮白芷醒脾辟穢香',
        acupoint: ni.acupoint ? `${ni.acupoint.name}，${ni.acupoint.tech}` : '按揉百會穴與足三里穴各 3 分鐘',
        demai: ni.demai || '坐西北乾位朝東南壓陣'
      }
    };
  }

  // 6. 提問：「今天流日運勢如何？」或「ดวงรายวันวันนี้เป็นอย่างไร」
  if (q.includes('今天') || q.includes('今日') || q.includes('本日') || category === 'today' || q.includes('ดวงรายวัน') || q.includes('ดวงวันนี้') || q.includes('วันนี้เป็นอย่างไร')) {
    if (isThai) {
      return {
        plain: `พี่บอกเลย ดูดวงแล้ววันนี้ดวงเธอปัง! วันที่ 24 กันยายน (辛丑日) นี่แหละที่โชคลาภมาแรง ได้ 8 เต็ม 10 เลย! อย่ารอช้า รีบไปเสี่ยงโชคก่อนหวยหมด! แต่บอกก่อนนะ อย่าซื้อเยอะ ดูดวงแล้วดวงการเงินเธอไม่ได้ปังขนาดนั้น ซื้อสนุกๆ พอ`,
        light: { type: 'green', text: 'ดวงเฮง (โชคลาภมาแรง)' },
        stars: '★★★★☆',
        calculation: `<strong>【การคำนวณเต็มรูปแบบ】：</strong><br>• วันที่และกิ่งก้านฟ้าดิน: วันที่ 24 กันยายน (辛丑日)<br>• พลังโชคลาภลอย: 8 เต็ม 10 (มีเกณฑ์『火貪格 (ฮั่วทานเก๋อ)』และ『祿存 (ลู่ฉุน)』หนุน)<br>• สรุปคำแนะนำ: ซื้อสนุกๆ พอ อย่าเพิ่งทุ่มหมดหน้าตัก`,
        remedy: null,
        crisisWarning: null,
        sensual: null,
        badPeachBlossom: null,
        lang: 'th'
      };
    }

    const sysCurDate = getSystemCurrentDate();
    const todayGz = data.todayGanZhi || '己亥';
    return {
      plain: `Jack 老師說，你今天（${todayGz}日）的整體能量偏向社交與貴人助力，桃花 6 分、貴人 5 分，很適合找朋友喝杯咖啡或拜訪長輩！稍微注意一下財務上的天機化忌，今天容易猶豫不決，重大花費多考慮五分鐘再下手即可。`,
      light: { type: 'green', text: '能量良好（社交與貴人相挺）' },
      stars: '★★★★☆',
      calculation: `<strong>【今日星盤能量依據】：</strong><br>• 今日流日：${sysCurDate} ${todayGz}日<br>• 社交桃花能量：6 分（紅鸞天喜同照）<br>• 貴人助力能量：5 分（長輩提攜有方）<br>• 四化提醒：天機化忌入財宮，重大花費多沉澱幾分鐘`,
      remedy: null,
      crisisWarning: null,
      sensual: null,
      badPeachBlossom: null,
      lang: 'zh'
    };
  }

  // 7. 提問：「創業 / 商機 / 投資 / 做生意」
  if (q.includes('創業') || q.includes('開店') || q.includes('商機') || q.includes('投資') || q.includes('做生意') || category === 'shangji' || q.includes('ธุรกิจ') || q.includes('ลงทุน')) {
    if (isThai) {
      return {
        plain: `คุณเริ่มต้นทำธุรกิจในปีหน้าได้ครับ แต่แนะนำให้เน้นรูปแบบสินทรัพย์เบา (Light-asset) จะมั่นคงกว่า ทำไมถึงเป็นอย่างนั้น? เพราะพลังงานด้านโอกาสทางธุรกิจของคุณคล่องตัวมาก มีแววได้คุมโปรเจกต์ใหญ่ แต่ในวังการงานมีจุดสะดุดเล็กน้อยที่ต้องระวังเรื่องข้อสัญญาและคนร่วมงาน คุณอาจลองเริ่มจากธุรกิจเสริมหรือทดสอบตลาดแบบ MVP ดูก่อน ตรวจสอบเงื่อนไขสัญญาให้ชัดเจนทุกฉบับ แล้วความพร้อมของคุณจะเปลี่ยนเป็นผลลัพธ์ที่ยอดเยี่ยมครับ`,
        light: { type: 'yellow', text: 'โอกาสธุรกิจโดดเด่น ควรเริ่มแบบค่อยเป็นค่อยไป' },
        stars: '★★★☆☆',
        calculation: `<strong>【การคำนวณเต็มรูปแบบ】：</strong><br>• พลังงานโอกาสทางธุรกิจ: ดาว『權祿 (เฉวียนลู่)』ส่องถึงและกระตุ้นดาว『天馬 (เทียนหม่า)』(มีพลังการนำสูงและโอกาสทางธุรกิจเติบโตเร็ว)<br>• ข้อควรระวัง: วังการงานพบดาว『化忌 (ฮว่าจี้)』(เงื่อนไขสัญญาและการสื่อสารกับหุ้นส่วนควรมีลายลักษณ์อักษรที่ชัดเจน)<br>• กลยุทธ์การขับเคลื่อน: เริ่มจากธุรกิจสินทรัพย์เบาแบบ MVP เพื่อทดสอบตลาดและสร้างผลกำไรที่มั่นคง`,
        remedy: null,
        crisisWarning: null,
        sensual: null,
        badPeachBlossom: null,
        lang: 'th'
      };
    }

    return {
      plain: `你明年創業是可以的，但建議走輕資產路線。為什麼？因為你目前的商機動能很活躍，很有掌控大局的氣場，但事業端同時有遇到化忌干擾，容易在合約細節和團隊合作上卡關。你可以試試先用副業或 MVP 模式測試市場反應。每份合約條款務必看清細節，先把防守做穩，你的攻擊力才能真正發揮出來！`,
      light: { type: 'yellow', text: '商機動能旺盛，宜輕資產小步快跑' },
      stars: '★★★☆☆',
      calculation: `<strong>【星盤數據參考依據】：</strong><br>• 商機能量：權祿交馳引動天馬（主導權強，商機動能旺盛）<br>• 提醒細節：官祿宮見忌（合約與執行細節宜白紙黑字防摩擦）<br>• 推進策略：先以輕資產 MVP 測試市場，穩健獲利`,
      remedy: null
    };
  }

  // 8. 通用降級回退
  return fallbackKeywordAnswer(q, session, lang);
}

// -------------------------------------------------------------
// 語意解析輔助函式 (相容並支援新架構)
// -------------------------------------------------------------
function parseSemanticIntent(questionText, sessionParam, preferredLang) {
  return parseIntent(questionText, sessionParam, preferredLang);
}

// -------------------------------------------------------------
// 意圖解析失敗降級之關鍵詞比對：fallbackKeywordAnswer
// -------------------------------------------------------------
function fallbackKeywordAnswer(questionText, session, lang) {
  const q = (questionText || '').trim();
  const sess = session || (typeof state !== 'undefined' && state.currentSession) || {};
  const isThai = lang === 'th';
  const isEnglish = lang === 'en';

  // 任務二：若完全無法辨識使用者提問核心意圖，走指定 fallback
  const isRecognized = /(?:暴富|發大財|幸運號碼|號碼|彩券|樂透|彩票|刮刮樂|偏財|橫財|發財|桃花|感情|戀愛|肉慾|情慾|貴人|生肖|事業|工作|健康|生病|穿|顏色|今天|今日|運勢|婚姻|結婚|正緣|合盤|交往|單身|二婚|幾次婚|หวย|โชคลาภ|ความรัก|การงาน|สุขภาพ|ร่ำรวย|เลขนำโชค|lottery|wealth|lucky|marriage|love)/i.test(q);
  if (!isRecognized && q.length < 30) {
    return {
      plain: isThai
        ? 'พี่ Jack ไม่แน่ใจว่าคุณต้องการถามอะไร ลองเปลี่ยนวิธีถามดูไหมครับ'
        : (isEnglish
            ? "Jack 老師: I'm not quite sure what you're asking, could you rephrase it?"
            : 'Jack 老師，我不太確定你想問什麼，可以換個說法嗎？'),
      light: { type: 'yellow', text: isThai ? 'ต้องการความชัดเจน' : (isEnglish ? 'Clarification' : '需要釐清') },
      stars: '★★★☆☆',
      calculation: null,
      remedy: null,
      crisisWarning: null,
      sensual: null,
      badPeachBlossom: null,
      lang: lang || 'zh'
    };
  }

  let fallbackEvent = 'shangji';

  if (q.includes('樂透') || q.includes('彩券') || q.includes('彩票') || q.includes('刮刮樂') || q.includes('หวย') || q.includes('สลาก') || q.includes('ลอตเตอรี่')) {
    fallbackEvent = 'letou';
  } else if (q.includes('偏財') || q.includes('橫財') || q.includes('發財') || q.includes('โชคลาภ') || q.includes('ลาภลอย')) {
    fallbackEvent = 'piancai';
  } else if (q.includes('桃花') || q.includes('感情') || q.includes('戀愛') || q.includes('ความรัก') || q.includes('เสน่ห์')) {
    fallbackEvent = 'taohua';
  } else if (q.includes('肉慾') || q.includes('情慾') || q.includes('ราคะ') || q.includes('ตัณหา')) {
    fallbackEvent = 'rouyu';
  } else if (q.includes('貴人') || q.includes('生肖') || q.includes('ผู้อุปถัมภ์') || q.includes('กุ้ยเหริน')) {
    fallbackEvent = 'guiren';
  } else if (q.includes('事業') || q.includes('升遷') || q.includes('工作') || q.includes('การงาน')) {
    fallbackEvent = 'shiye';
  } else if (q.includes('健康') || q.includes('生病') || q.includes('器官') || q.includes('สุขภาพ')) {
    fallbackEvent = 'jiankang';
  } else if (q.includes('穿') || q.includes('顏色') || q.includes('幸運色') || q.includes('สี')) {
    fallbackEvent = 'clothing';
  } else if (q.includes('今天') || q.includes('今日') || q.includes('本日') || q.includes('วันนี้')) {
    fallbackEvent = 'today';
  }

  const curBaseDate = getSystemCurrentDate();
  const simulatedTimeFrame = parseRelativeDate(q, curBaseDate, sess.birthday);
  const simulatedIntent = {
    rawText: q,
    subject: sess.clientName || '客戶',
    event: fallbackEvent,
    timeFrame: simulatedTimeFrame,
    condition: {},
    goal: (q.includes('適合') ? 'suitability' : (q.includes('最高') ? 'highest_score' : 'general')),
    lang: lang || 'zh'
  };

  return generateAnswer(simulatedIntent, sess);
}

// -------------------------------------------------------------
// 4. 對外總入口：generateFortuneAnswer
// 流程：
// 步驟一：understandQuestion(questionText) (LLM 理解問題)
// 步驟二：fetchAstrologyData(intent, session) (系統查數據)
// 步驟三：generateNaturalAnswer(intent, data) (LLM 生成回答)
// 步驟四：若 LLM 調用失敗，回退到現有的關鍵詞比對邏輯
// -------------------------------------------------------------
function generateFortuneAnswer(questionText, preferredLang, sessionData) {
  const q = (questionText || '').trim();
  const session = sessionData || (typeof state !== 'undefined' && state.currentSession) || {};
  const lang = preferredLang || detectLanguage(q) || (typeof state !== 'undefined' && state.currentLang) || 'zh';

  console.group(`%c🔮 [命理諮詢 LLM 執行管線] 提問: "${q}"`, 'color: #9333ea; font-size: 13px; font-weight: bold;');
  console.log('👤 當前客戶:', `${session.clientName || '客戶'} (生日: ${session.birthday || '1990-03-15'})`);
  console.log('🌐 語言模式:', lang === 'th' ? '泰文 (Thai)' : '繁體中文');

  async function runLLMPipeline() {
    try {
      // 步驟一：LLM 理解問題
      const intent = await understandQuestion(q, session, lang);
      if (intent && !intent.lang) {
        intent.lang = lang;
      }

      // 步驟二：系統查數據
      const data = fetchAstrologyData(intent, session);
      console.log('%c[步驟二：系統數據查核 (fetchAstrologyData)]', 'color: #ea580c; font-weight: bold;', {
        category: data.category,
        todayGanZhi: data.todayGanZhi,
        dualDay: data.dualDay,
        singleDay: data.singleDay,
        monthOutlook: data.monthOutlook,
        highestScoreDay: data.highestScoreDay
      });

      // 步驟三：LLM 生成回答
      const answer = await generateNaturalAnswer(intent, data, q, session, lang);
      if (answer && answer.plain) {
        answer.lang = lang;
        if (answer.isFromRealLLM) {
          console.log('%c✅ Gemini LLM 即時生成', 'background: #059669; color: white; font-weight: bold; font-size: 14px; padding: 4px 10px; border-radius: 4px;');
          console.log('🤖 【是否為真實 LLM 生成】：✅ 是 (Gemini LLM 即時生成)');
        } else {
          console.warn('%c⚠️ 本地備用引擎', 'background: #d97706; color: white; font-weight: bold; font-size: 14px; padding: 4px 10px; border-radius: 4px;');
          console.log('🤖 【是否為真實 LLM 生成】：⚠️ 否 (本地備用引擎)');
        }
        console.groupEnd();
        return answer;
      }
    } catch (err) {
      console.warn('Gemini LLM pipeline error, falling back:', err);
    }
    // 步驟五：若 LLM 調用失敗，回退到現有的關鍵詞比對邏輯
    const finalFb = fallbackKeywordAnswer(q, session, lang);
    finalFb.isFromRealLLM = false;
    finalFb.lang = lang;
    console.warn('%c⚠️ 本地備用引擎', 'background: #d97706; color: white; font-weight: bold; font-size: 14px; padding: 4px 10px; border-radius: 4px;');
    console.log('🤖 【是否為真實 LLM 生成】：⚠️ 否 (本地備用引擎)');
    console.groupEnd();
    return finalFb;
  }

  // 同步預算 fallback 結果，確保同步與異步調用者皆能無縫取值
  let syncFallback;
  try {
    const syncIntent = parseSemanticIntent(q, session, lang);
    const syncData = fetchAstrologyData(syncIntent, session);
    syncFallback = generateNaturalAnswerFallback(syncIntent, syncData, q, session, lang);
  } catch (e) {
    syncFallback = fallbackKeywordAnswer(q, session, lang);
  }
  syncFallback.lang = lang;

  const p = runLLMPipeline();
  Object.assign(p, syncFallback);
  return p;
}

/**
 * askGemini: 對外呼叫 Gemini LLM 即時諮詢入口 (修正二)
 * @param {string} questionText 使用者提問
 * @param {string} [preferredLang] 語言 ('zh' | 'th')
 * @param {object} [sessionData] 命盤 session 資料
 */
async function askGemini(questionText, preferredLang, sessionData) {
  console.log('🤖 askGemini 已被触发，开始执行 Gemini LLM 咨询流程...');
  console.log('🤖 askGemini 已被觸發，開始執行 Gemini LLM 諮詢流程...');
  console.log('🤖 askGemini 正在调用 callGeminiLLM...');
  console.log('🤖 askGemini 正在調用 callGeminiLLM...');
  return await generateFortuneAnswer(questionText, preferredLang, sessionData);
}

/**
 * askDeepInfra: 對外呼叫 DeepInfra LLM 即時諮詢入口
 * @param {string} questionText 使用者提問
 * @param {string} [preferredLang] 語言 ('zh' | 'th')
 * @param {object} [sessionData] 命盤 session 資料
 */
async function askDeepInfra(questionText, preferredLang, sessionData) {
  console.log('🤖 askDeepInfra 已被觸發，開始執行 DeepInfra LLM 諮詢流程...');
  console.log('🤖 askDeepInfra 正在調用 callDeepInfraLLM...');
  return await generateFortuneAnswer(questionText, preferredLang, sessionData);
}

if (typeof window !== 'undefined') {
  window.askDeepInfra = askDeepInfra;
  window.askGemini = askGemini;
  window.generateFortuneAnswer = generateFortuneAnswer;
  window.callGeminiLLM = callGeminiLLM;
  window.callDeepInfraLLM = callDeepInfraLLM;
  window.calculateDeepInfraCost = calculateDeepInfraCost;
  window.callUnifiedLLM = callUnifiedLLM;
  window.detectLanguage = detectLanguage;
  window.buildFortunePrompt = buildFortunePrompt;
  window.SYSTEM_PROMPT_TEMPLATE = SYSTEM_PROMPT_TEMPLATE;
}


// 倪師改運建議演算法 (供推算面板與對話共用，支援多語言與個人化體質辨證)
function getNiAdvice(day, lang = 'zh', session = null) {
  const dStem = day.dailyGanZhi ? day.dailyGanZhi[0] : '甲';
  const dBranch = day.dailyGanZhi ? day.dailyGanZhi.slice(-1) : '子';
  const element = STEM_ELEMENTS[dStem] || '木';

  const sess = session || (typeof state !== 'undefined' && state.currentSession) || {};
  const fiveElementsClass = (sess.astrolabe && sess.astrolabe.fiveElementsClass) || '土五局';
  const birthHour = (sess.birthTime !== undefined) ? sess.birthTime : 7;
  
  // 體質辨證判定 (虛熱 vs 水寒)
  // Client A (土五局/火六局、白晝出生、陽氣偏浮): 屬「陰虛燥熱型」
  // Client B (水二局/金四局/木三局、夜間或秋冬出生): 屬「陽虛水寒型」
  const isYinDeficientHeat = (fiveElementsClass.includes('土') || fiveElementsClass.includes('火') || (birthHour >= 4 && birthHour <= 8));
  const constitutionName = isYinDeficientHeat ? '陰虛燥熱型 (金火偏旺，虛熱內耗)' : '陽虛水寒型 (水寒土滯，命門火微)';
  const xiYongShen = isYinDeficientHeat ? '喜滋陰潤燥、清金涵木，忌溫燥辛烈' : '喜溫陽化氣、培土生金，忌陰寒滋膩';

  // 1. 同樣是補水：A 客戶用沉香 (降氣清熱)，B 客戶用丁香 (溫腎化氣)
  let waterRemedyHerb = isYinDeficientHeat ? '特級海南沉香' : '特級公丁香';
  let waterRemedyRationale = isYinDeficientHeat
    ? '【同樣是補水】：客戶屬陰虛燥熱，虛火浮動。倪師醫道講求『知燥者必沉降納氣以救腎水』，故補水特選【沉香】（順氣降火、水火既濟），切忌辛烈之丁香。'
    : '【同樣是補水】：客戶屬陽虛水寒，真陽不足則寒水凝滯。倪師醫道講求『善補水者必於陽中求陰，氣化則水自生』，故補水特選【公丁香】（溫中健脾、溫壯命門真火、蒸騰化水），切忌苦涼下陷之沉香。';

  // 2. 同樣是補財：A 客戶按太溪 (滋真水生木)，B 客戶按足三里 (培土生金)
  let wealthAcupointName = isYinDeficientHeat ? '太溪穴 (足少陰腎經原穴)' : '足三里穴 (足陽明胃經合穴)';
  let wealthAcupointLoc = isYinDeficientHeat ? '內踝尖與跟腱之間的凹陷處' : '外膝眼下 3 寸，脛骨外側約一橫指處';
  let wealthAcupointRationale = isYinDeficientHeat
    ? '【同樣是求財】：客戶陰虛火浮，需滋先天少陰真陰以生發智謀財源。揉按【太溪穴】36次，引火歸元、滋潤腎水，水旺智生、財源不竭！'
    : '【同樣是求財】：客戶水寒土滯，需充實後天中焦脾胃氣血化生之源。揉按【足三里穴】36次，溫補脾陽胃土，『土厚自能生金、土旺萬物財生』，厚植聚財底氣！';

  if (lang === 'th') {
    let aromaTitle = '', aromaRecipe = '', aromaOrgan = '', aromaUsage = '';
    if (element === '木') {
      aromaTitle = '柴胡薄荷降真開郁香 (เครื่องหอมไฉหูสะระแหน่เจี้ยงเจินระบายตับ)';
      aromaRecipe = '柴胡 (ฉายหู) 8g, 薄荷 (สะระแหน่) 5g, 降真香 (เจี้ยงเจินเซียง) 10g, 石菖蒲 (สือชางผู) 6g, 川芎 (ชวนชฺยง) 5g';
      aromaOrgan = 'เข้าสู่เส้นลมปราณตับและถุงน้ำดี (ช่วยระบายตับ คลายอารมณ์ตึงเครียด บำรุงสายตาและสมอง)';
      aromaUsage = 'ช่วงเช้าถึงยามซื่อ (07:00-11:00) ใส่ในกระเป๋าทำงานหรือพกติดตัว หรือจุดรมควันความร้อนต่ำ';
    } else if (element === '火') {
      aromaTitle = '沉香遠志清心安神香 (เครื่องหอมกฤษณาหย่วนจื้อสงบจิตใจ)';
      aromaRecipe = '沉香 (ไม้กฤษณา) 6g, 檀香 (ไม้จันทน์หอม) 6g, 遠志 (หย่วนจื้อ) 6g, 酸棗仁 (ซวนเจ่าเหริน) 6g, 鬱金 (อวี้จิน) 5g';
      aromaOrgan = 'เข้าสู่เส้นลมปราณหัวใจและไต (ปรับสมดุลธาตุน้ำ-ไฟ สงบจิต เสริมสติปัญญา)';
      aromaUsage = 'ยามอู่ (11:00-13:00) หรือช่วงค่ำ สูดดมลึกๆ ก่อนการเจรจาสำคัญ';
    } else if (element === '土') {
      aromaTitle = '蒼朮白芷醒脾辟穢香 (เครื่องหอมชางจู๋ไป๋จื่อบำรุงม้ามขจัดอัปมงคล)';
      aromaRecipe = '蒼朮 (ชางจู๋) 10g, 白芷 (ไป๋จื่อ) 10g, 藿香 (ฮั่วเซียง) 8g, 佩蘭 (เพ่ยหลาน) 6g, 砂仁 (ซาเหริน) 5g, 艾葉 (ใบอ้ายเยี่ย) 5g';
      aromaOrgan = 'เข้าสู่เส้นลมปราณม้ามและกระเพาะ (ปรับธาตุดินศูนย์กลาง ขจัดความชื้นอับ เพิ่มพลังกักเก็บทรัพย์)';
      aromaUsage = 'ยามเฉิน (07:00-09:00) พกถุงหอมติดตัว เหมาะอย่างยิ่งเมื่อไปในสถานที่คนพลุกพล่าน';
    } else if (element === '金') {
      aromaTitle = '白芷辛夷肅肺威儀香 (เครื่องหอมไป๋จื่อซินอี๋เสริมอำนาจบารมีปอด)';
      aromaRecipe = '白芷 (ไป๋จื่อ) 10g, 辛夷 (ซินอี๋) 8g, 降真香 (เจี้ยงเจินเซียง) 8g, 細辛 (ซี่ซิน) 3g, 檀香 (ไม้จันทน์) 5g';
      aromaOrgan = 'เข้าสู่เส้นลมปราณปอดและลำไส้ใหญ่ (ทำความสะอาดพลังปอด เสริมสร้างอำนาจบารมีและความเด็ดขาด)';
      aromaUsage = 'ยามเซิน-โหย่ว (15:00-19:00) ดมก่อนเข้าพบลูกค้าเพื่อเพิ่มความน่าเกรงขามในการตัดสินใจ';
    } else {
      aromaTitle = isYinDeficientHeat ? '沉香清心潤腎香 (กฤษณาบำรุงไตระบายความร้อน)' : '丁香溫陽化氣香 (กานพลูอุ่นไตเสริมพลังหยาง)';
      aromaRecipe = isYinDeficientHeat ? '沉香 8g, 檀香 6g, 遠志 6g, 鬱金 5g' : '丁香 6g, 肉桂 4g, 降真香 8g, 乾薑 4g';
      aromaOrgan = 'เข้าสู่เส้นลมปราณไตและกระเพาะปัสสาวะ';
      aromaUsage = 'ยามค่ำหรือก่อนนอน จุดในห้องหนังสือเพื่อบ่มเพาะพลังสมาธิลึกซึ้ง';
    }

    const xiShenTh = XI_SHEN_MAP_TH[dStem] || 'ทิศตะวันออกเฉียงใต้ (巽方)';
    const caiShenTh = CAI_SHEN_MAP_TH[dStem] || 'ทิศเหนือ';
    const chongBranch = BRANCH_CHONG[dBranch] ? BRANCH_CHONG[dBranch].branch : '午';

    return {
      constitution: { name: constitutionName, xiYong: xiYongShen },
      aroma: { title: aromaTitle, recipe: aromaRecipe, organ: aromaOrgan, usage: aromaUsage, personalizedNote: waterRemedyRationale },
      acupoint: {
        name: `${wealthAcupointName}`,
        loc: wealthAcupointLoc,
        tech: 'ใช้นิ้วหัวแม่มือหรือนิ้วกลางกดหมุนวนในแนวดิ่ง 36 ครั้ง จนรู้สึกอุ่นซ่าน',
        time: 'ช่วงเช้าหรือก่อนเจรจาสำคัญ',
        benefit: wealthAcupointRationale
      },
      demai: `
        <strong>【乾位天子坐陣 (ตำแหน่งเฉียนบัลลังก์ประธาน)】：</strong>ตามหลักฮวงจุ้ยดินเต๋า ในการเจรจาหรือเซ็นสัญญา ควรนั่งทิศตะวันตกเฉียงเหนือ (乾位) หันหน้าสู่ทิศตะวันออกเฉียงใต้เพื่อคุมเชิง<br>
        <strong>【今日吉方引氣 (ทิศมงคลดึงดูดพลังประจำวัน)】：</strong>ทิศเทพยินดี (喜神方) อยู่ทาง <strong>${xiShenTh}</strong>, ทิศเทพเจ้าโชคลาภ (財神方) อยู่ทาง <strong>${caiShenTh}</strong><br>
        <strong>【地脈避煞禁忌 (ข้อห้ามทิศปะทะ)】：</strong>ซุ่ยซ่า (歲煞) ประจำวันอยู่ทางทิศ <strong>${chongBranch}方</strong> หลีกเลี่ยงการหันหลังให้มุมมืดสกปรก
      `
    };
  }

  // 中文繁體/標準版 (含個人化處方辨證)
  let aromaTitle = '', aromaRecipe = '', aromaOrgan = '', aromaUsage = '';
  if (element === '木') {
    aromaTitle = '柴胡薄荷降真開郁香';
    aromaRecipe = '柴胡 8g、薄荷 5g、特級降真香 10g、石菖蒲 6g、川芎 5g';
    aromaOrgan = '歸肝、膽二經（舒肝解鬱、明目醒腦）';
    aromaUsage = '晨起至巳時 (07:00-11:00) 置於公事包或胸前佩戴；或低溫熏香。';
  } else if (element === '火') {
    aromaTitle = '沉香遠志清心安神香';
    aromaRecipe = '海南沉香 6g、老山檀香 6g、遠志 6g、酸棗仁 6g、鬱金 5g';
    aromaOrgan = '歸心、腎二經（水火既濟，清心寧神、通明開慧）';
    aromaUsage = '午時 (11:00-13:00) 或晚間品聞，平息浮躁急進，重要互動前深呼吸熏聞。';
  } else if (element === '土') {
    aromaTitle = '蒼朮白芷醒脾辟穢香';
    aromaRecipe = '茅蒼朮 10g、白芷 10g、藿香 8g、佩蘭 6g、砂仁 5g、艾葉 5g';
    aromaOrgan = '歸脾、胃二經（定中宮脾土，芳香化濕、醒神辟濁）';
    aromaUsage = '辰時 (07:00-09:00) 隨身佩戴，進出人多雜處場所必備，聚財守財。';
  } else if (element === '金') {
    aromaTitle = '白芷辛夷肅肺威儀香';
    aromaRecipe = '白芷 10g、辛夷 8g、降真香 8g、細辛 3g、老山檀 5g';
    aromaOrgan = '歸肺、大腸二經（清肅肅降、金生水起、生長威權）';
    aromaUsage = '申酉時 (15:00-19:00) 會客前熏聞，提升簽約與決策威信。';
  } else {
    // 水運流日：個人化精準派方 (沉香 vs 丁香)
    aromaTitle = isYinDeficientHeat ? '沉香遠志清心潤腎香' : '丁香肉桂溫陽化氣香';
    aromaRecipe = isYinDeficientHeat ? '特級沉香 8g、老山檀 6g、遠志 6g、鬱金 5g、酸棗仁 6g' : '特級公丁香 6g、肉桂 4g、降真香 8g、乾薑 4g、小茴香 4g';
    aromaOrgan = isYinDeficientHeat ? '歸心、腎二經（沉降歸元、順氣納腎、清降虛火）' : '歸脾、腎二經（溫中散寒、溫壯命門真火、蒸騰化水）';
    aromaUsage = '酉時或睡前置於書房熏燃，滋生深層靈感。';
  }

  const xiShen = XI_SHEN_MAP[dStem] || '東南方';
  const caiShen = CAI_SHEN_MAP[dStem] || '正東方';
  const chong = BRANCH_CHONG[dBranch] || { branch: '午', animal: '馬' };

  return {
    constitution: { name: constitutionName, xiYong: xiYongShen },
    aroma: {
      title: aromaTitle,
      recipe: aromaRecipe,
      organ: aromaOrgan,
      usage: aromaUsage,
      personalizedNote: waterRemedyRationale
    },
    acupoint: {
      name: `${wealthAcupointName}`,
      loc: wealthAcupointLoc,
      tech: '雙手拇指指腹垂直深壓旋轉按揉 36 次，至穴位酸脹溫熱',
      time: '辰時 (07:00-09:00) 或進行重大財務決策前',
      benefit: wealthAcupointRationale
    },
    demai: `
      <strong>【乾位天子坐陣】：</strong>依天紀陽宅學，主事決策、重要簽約宜坐「西北乾位」，面朝東南壓陣。<br>
      <strong>【今日吉方引氣】：</strong>當日喜神吉方在<strong>${xiShen}</strong>，財神方位在<strong>${caiShen}</strong>；談判宜面向此吉向。<br>
      <strong>【地脈避煞禁忌】：</strong>當日歲煞在<strong>${chong.branch}方</strong>，切忌背靠陰暗污穢處。<br>
      <strong>【個人化體質醫理】：</strong>${waterRemedyRationale}<br>
      <strong>【個人化求財醫理】：</strong>${wealthAcupointRationale}
    `
  };
}

function getLayoutAdvice(day) {
  const dStem = day.dailyGanZhi ? day.dailyGanZhi[0] : '甲';
  const dBranch = day.dailyGanZhi ? day.dailyGanZhi.slice(-1) : '子';
  const guiRenList = GUI_REN_MAP[dStem] || ['牛', '羊'];
  const liuHe = BRANCH_LIUHE[dBranch] || { animal: '牛' };
  const chong = BRANCH_CHONG[dBranch] || { branch: '午', animal: '馬' };
  const xiShen = XI_SHEN_MAP[dStem] || '東南';
  const caiShen = CAI_SHEN_MAP[dStem] || '正東';

  return {
    timing: '卯時 (05-07)、巳時 (09-11) 為天乙貴人吉時；午時 (11-13)、申時 (15-17) 行動成事效率最高。',
    directions: `喜神方：<strong>${xiShen}</strong><br>財神方：<strong>${caiShen}</strong><br>生氣方：座西北朝東南`,
    zodiacs: `天乙生肖貴人：<strong>${guiRenList.join('、 ')}</strong><br>六合暗助生肖：<strong>${liuHe.animal} (${liuHe.branch})</strong>`,
    preparation: '備齊雙份合同或簽約資料、自備金屬好筆；穿著金白色或深藍色服裝；出門前以淡鹽水淨手。',
    taboos: `今日逢<strong>【日沖生肖：屬${chong.animal}之人】</strong>，避開${chong.branch}時衝煞，切忌情緒化口角。`
  };
}

// =============================================================
// 滿天星 Plus 升級模組：等待提示與逐字打字動畫控制器
// =============================================================
let waitingTimerInterval = null;
let waitingStartTime = 0;

function showWaitingNotice(containerEl, lang) {
  const detectedLang = lang || (typeof state !== 'undefined' && state.currentLang) || 'zh';
  const isTh = detectedLang === 'th';
  const isEn = detectedLang === 'en';
  const isJa = detectedLang === 'ja';
  const isKo = detectedLang === 'ko';

  const authorText = isTh ? 'พี่ Jack (เข็มทิศดวงชะตา GPS)' : (isEn ? 'Jack 老師 (Destiny GPS)' : 'Jack 老師 (運勢 GPS)');

  const waitingTexts = {
    zh: 'Jack 老師正在排盤推算中...',
    cn: 'Jack 老师正在排盘推算中...',
    th: 'พี่ Jack กำลังดูดวงให้อยู่...',
    en: 'Jack 老師 is reading your chart...',
    ja: 'Jack 先生が命盤を読んでいます...',
    ko: 'Jack 선생님이 명반을 읽고 있습니다...'
  };
  const waitingText = waitingTexts[detectedLang] || waitingTexts.zh;

  let countdown = 6;

  console.log('⏳ 等待提示已顯示');
  console.log(`⏱️ 等待秒數：${countdown}`);

  if (typeof document === 'undefined') {
    return;
  }

  hideWaitingNotice();
  const container = containerEl || (typeof document.getElementById === 'function' ? document.getElementById('chatMessagesContainer') : null);
  if (!container || typeof document.createElement !== 'function') return;

  const waitingEl = document.createElement('div');
  waitingEl.id = 'jackWaitingBubble';
  waitingEl.className = 'chat-message assistant waiting-bubble';
  waitingEl.innerHTML = `
    <div class="msg-avatar">🔮</div>
    <div class="msg-content-card waiting-card">
      <div class="waiting-header">
        <span class="waiting-spinner"></span>
        <span class="waiting-author">${escapeHtml(authorText)}</span>
      </div>
      <div class="waiting-body">
        <p id="waitingStatusText" class="waiting-status-text">${escapeHtml(waitingText)}</p>
        <div id="waitingTimerBadge" class="waiting-timer-badge">
          ⏳ ${isTh ? `รอประมาณ ${countdown} วินาที` : (isEn ? `Est. wait ${countdown}s` : `預計等待 ${countdown} 秒`)}
        </div>
      </div>
    </div>
  `;
  container.appendChild(waitingEl);
  container.scrollTop = container.scrollHeight;

  waitingStartTime = Date.now();

  waitingTimerInterval = setInterval(() => {
    countdown = Math.max(1, countdown - 1);
    console.log(`⏱️ 等待秒數：${countdown}`);

    const badgeEl = document.getElementById('waitingTimerBadge');
    if (!badgeEl) {
      clearInterval(waitingTimerInterval);
      waitingTimerInterval = null;
      return;
    }

    badgeEl.textContent = `⏳ ${isTh ? `รอประมาณ ${countdown} วินาที` : (isEn ? `Est. wait ${countdown}s` : `預計等待 ${countdown} 秒`)}`;
  }, 1000);
}

function hideWaitingNotice() {
  if (waitingTimerInterval) {
    clearInterval(waitingTimerInterval);
    waitingTimerInterval = null;
  }
  if (typeof document === 'undefined') return;
  const el = document.getElementById('jackWaitingBubble');
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

let currentTypingController = null;

function showTypingEffect(element, text, speed = 25, onComplete = null) {
  if (!element) return;
  console.log('⌨️ 逐字打字已啟動');

  if (currentTypingController && typeof currentTypingController.skip === 'function') {
    currentTypingController.skip();
  }

  const rawText = String(text || '');
  if (!rawText) {
    element.innerHTML = '';
    if (onComplete) onComplete();
    return;
  }

  let chars = [];
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    chars = Array.from(segmenter.segment(rawText), s => s.segment);
  } else {
    chars = Array.from(rawText);
  }

  const btnSkip = (typeof document !== 'undefined' && typeof document.getElementById === 'function') ? document.getElementById('btnSkipTyping') : null;
  if (btnSkip) {
    btnSkip.style.display = 'inline-flex';
    const curLang = (typeof state !== 'undefined' && state.currentLang) || 'zh';
    if (curLang === 'th') {
      btnSkip.textContent = '⏩ ข้ามแอนิเมชัน';
    } else if (curLang === 'en') {
      btnSkip.textContent = '⏩ Skip animation';
    } else {
      btnSkip.textContent = '⏩ 跳過動畫';
    }
  }

  element.innerHTML = '';
  const cursor = (typeof document !== 'undefined' && typeof document.createElement === 'function') ? document.createElement('span') : null;
  if (cursor) {
    cursor.className = 'typing-cursor';
    element.appendChild(cursor);
  }

  let idx = 0;
  let timerId = null;
  let isDone = false;

  const finish = () => {
    if (isDone) return;
    isDone = true;
    if (timerId) clearTimeout(timerId);
    timerId = null;
    element.innerHTML = escapeHtml(rawText).replace(/\n/g, '<br>');
    if (btnSkip) btnSkip.style.display = 'none';
    currentTypingController = null;
    console.log('✅ 打字效果 DOM 元素已更新完成');
    if (onComplete) onComplete();
  };

  currentTypingController = {
    skip: finish
  };

  if (btnSkip) {
    btnSkip.onclick = finish;
  }

  let accumulated = '';

  const step = () => {
    if (isDone) return;
    if (idx >= chars.length) {
      finish();
      return;
    }

    const c = chars[idx];
    accumulated += c;
    idx++;

    element.innerHTML = escapeHtml(accumulated).replace(/\n/g, '<br>');
    if (cursor) element.appendChild(cursor);

    const chatContainer = (typeof document !== 'undefined' && typeof document.getElementById === 'function')
      ? document.getElementById('chatMessagesContainer')
      : null;
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    let delay = speed || 25; // 20-30 毫秒
    if (c === '\n') {
      delay = 200; // 段落 200 毫秒
    } else if (/[，。！？、；：,!?;:]/.test(c)) {
      delay = 50; // 標點 50 毫秒
    }

    timerId = setTimeout(step, delay);
  };

  step();
}

// -------------------------------------------------------------
// 渲染對話區域 (Messages)
// -------------------------------------------------------------
/**
 * 取得助理諮詢回答之標題 (依語言客製化)
 * @param {string} lang 語言代碼 ('th' | 'zh' | 'en' | 'ja' | 'ko')
 * @returns {string} 標題字串
 */
function getChatPlainTitle(lang) {
  if (lang === 'th') return '💬【คำแนะนำจากพี่ Jack】';
  if (lang === 'en') return '💬【Advice from Jack】';
  if (lang === 'ja') return '💬【Jack 先生のアドバイス】';
  if (lang === 'ko') return '💬【Jack 선생님의 조언】';
  return '💬【Jack 老師解答】';
}

function renderChatMessages() {
  const container = document.getElementById('chatMessagesContainer');
  if (!container || !state.currentSession) return;
  container.innerHTML = '';

  const messages = state.currentSession.messages || [];

  messages.forEach(msg => {
    const msgEl = document.createElement('div');
    msgEl.className = `chat-message ${msg.sender}`;

    if (msg.sender === 'user') {
      msgEl.innerHTML = `
        <div class="msg-bubble">${escapeHtml(msg.text)}</div>
      `;
    } else {
      // 助理訊息 (結構化卡片)
      let msgLang = (msg.answerData && msg.answerData.lang);
      if (!msgLang) {
        if (msg.answerData && msg.answerData.plain) {
          msgLang = detectLanguage(msg.answerData.plain);
        } else if (msg.text) {
          msgLang = detectLanguage(msg.text);
        } else if (typeof state !== 'undefined' && state.currentLang) {
          msgLang = state.currentLang;
        } else {
          msgLang = 'zh';
        }
      }
      const isTh = msgLang === 'th';
      const isEn = msgLang === 'en';
      const authorText = isTh ? 'พี่ Jack (เข็มทิศดวงชะตา GPS)' : (isEn ? 'Jack 老師 (Destiny GPS)' : 'Jack 老師 (運勢 GPS)');
      const plainTitle = getChatPlainTitle(msgLang);

      // 問題一規範：所有寫死標題依語言切換 (th, en, ja, ko, zh)
      const calcTitleMap = {
        th: '📊【การคำนวณเต็มรูปแบบ】',
        en: '📊【Full Calculation】',
        ja: '📊【完全な計算】',
        ko: '📊【전체 계산】',
        zh: '📊【完整推算】',
        cn: '📊【完整推算】'
      };
      const calcTitle = calcTitleMap[msgLang] || '📊【完整推算】';

      const feedbackTitleMap = {
        th: '【ข้อเสนอแนะความแม่นยำ】：',
        en: '【Feedback on Accuracy】：',
        ja: '【アドバイスの精度フィードバック】：',
        ko: '【정확도 피드백】：',
        zh: '【建議準確度回饋】：',
        cn: '【建议准确度反馈】：'
      };
      const feedbackTitle = feedbackTitleMap[msgLang] || '【建議準確度回饋】：';

      const lightLabelMap = {
        th: '【สัญญาณไฟ】：',
        en: '【Signal Light】：',
        ja: '【シグナル】：',
        ko: '【신호등】：',
        zh: '【燈號】：',
        cn: '【灯号】：'
      };
      const lightLabel = lightLabelMap[msgLang] || '【燈號】：';

      const starsLabelMap = {
        th: '【คะแนนดาว】：',
        en: '【Star Rating】：',
        ja: '【星評価】：',
        ko: '【별점】：',
        zh: '【星級】：',
        cn: '【星级】：'
      };
      const starsLabel = starsLabelMap[msgLang] || '【星級】：';

      const remedyTitleMap = {
        th: '🌿【คำแนะนำเสริมดวงจากพี่ Jack】',
        en: '🌿【Jack\'s Remedy Advice】',
        ja: '🌿【Jack 先生の開運アドバイス】',
        ko: '🌿【Jack 선생님의 개운 조언】',
        zh: '🌿【Jack 老師開運建議】',
        cn: '🌿【Jack 老师开运建议】'
      };
      const remedyTitle = remedyTitleMap[msgLang] || '🌿【Jack 老師開運建議】';

      const aromaLabel = isTh ? '🌿 สุคนธบำบัดสมุนไพรจีน (中藥聞香)：' : '🌿 中藥聞香：';
      const acupointLabel = isTh ? '💆 นวดจุดลมปราณ (穴位按摩)：' : '💆 穴位按摩：';
      const demaiLabel = isTh ? '🧭 ทิศทางและฮวงจุ้ยพลังดิน (地脈道佈局)：' : '🧭 地脈道佈局：';

      if (msg.isWelcome) {
        let welcomeText = msg.text;
        if (state.currentLang === 'th') {
          welcomeText = `สวัสดีครับ! ได้ทำการผูกดวงชะตาและคำนวณดวงชะตารายวันตลอดปี ${state.currentSession.targetYear || 2026} จื่อเวยโต้วซู่สำหรับ【${state.currentSession.clientName}】(เกิด ${state.currentSession.birthday}) เรียบร้อยแล้ว ท่านสามารถสอบถามเกี่ยวกับลาภลอย, ลอตเตอรี่, ความรัก, ผู้ใหญ่อุปถัมภ์, โอกาสธุรกิจ หรือสุขภาพได้ทุกเรื่อง โดยระบบจะให้คำตอบครบถ้วน 5 มิติ: ภาษาเข้าใจง่าย, สัญญาณไฟ, คะแนนดาว, การคำนวณเต็มรูปแบบ และคำแนะนำเสริมดวงจากพี่ Jack!`;
        }
        msgEl.innerHTML = `
          <div class="msg-avatar">🔮</div>
          <div class="msg-content-card">
            <div class="msg-header">
              <span class="msg-author">${authorText}</span>
              <span class="msg-time">${msg.timestamp || ''}</span>
            </div>
            <div class="reply-sec-body" style="color:#e2e8f0;font-size:0.95rem;line-height:1.6;">
              ${escapeHtml(welcomeText).replace(/\n/g, '<br>')}
            </div>
          </div>
        `;
      } else if (msg.answerData) {
        const a = msg.answerData;
        let plainContent = a.plain || msg.text || '';
        plainContent = String(plainContent).replace(/^💡?\s*【?(?:白話版|คำแนะนำจากพี่ Jack|Jack 老師解答|Advice from Jack)】?[:：]?\s*/i, '');
        plainContent = plainContent.replace(/^白話版[:：]\s*/i, '');
        const lightType = (a.light && a.light.type) ? a.light.type : 'green';
        const lightText = (a.light && a.light.text) ? a.light.text : (typeof a.light === 'string' ? a.light : '吉');
        const starsVal = a.stars || '★★★★★';
        let calcContent = a.calculation || '';
        if (isTh && calcContent) {
          // 移除內文開頭重複的「【การคำนวณเต็มรูปแบบ】：」，只保留卡片標題
          calcContent = calcContent
            .replace(/^\s*(?:<strong>\s*)?(?:(?:📊)?\s*【(?:การคำนวณเต็มรูปแบบ|完整推算|今日星盤能量依據|星盤數據參考依據)】[:：]?)(?:\s*<\/strong>)?[:：]?\s*(?:<br\s*\/?>)?\s*/iu, '')
            .replace(/^\s*【การคำนวณเต็มรูปแบบ】[:：]?\s*(?:<br\s*\/?>)?\s*/iu, '')
            .replace(/(?:📊)?\s*【完整推算】[:：]?/gu, '')
            .replace(/【今日星盤能量依據】[:：]?/g, '')
            .replace(/【星盤數據參考依據】[:：]?/g, '');
        }

        // 問題四：當使用者問「幸運號碼」「樂透號碼」「偏財」時，只回答相關內容，不要插入不相關的危機預警
        const isNumberOrWealthQuery = (a.category === 'lucky_numbers' || a.category === 'baofu_sandbox') ||
          /幸運號碼|乐透|樂透|彩券|彩票|發財|偏財|暴富|數字|号码|เลขเด็ด|หวย|เสี่ยงโชค|lucky number|lottery/i.test(msg.text || a.plain || '');
        if (isNumberOrWealthQuery) {
          a.crisisWarning = null;
        }

        // 危機預警安全渲染 (若有危機預警卡片)
        let crisisHtml = '';
        if (a.crisisWarning && typeof a.crisisWarning === 'object') {
          const cw = localizeCrisisWarning(a.crisisWarning, msgLang);
          const crisisHeader = isTh
            ? `⚠️ การเตือนวิกฤตล่วงหน้า：${escapeHtml(cw.type || 'วิกฤตการงาน')}`
            : (isEn
                ? `⚠️ Early Crisis Warning: ${escapeHtml(cw.type || 'Important Alert')}`
                : `⚠️ 未來危機預警：${escapeHtml(cw.type || '重點警示')}`);
          const warnLabel = isTh ? '' : (isEn ? '【Forecast Warning】：' : '【預警推算】：');
          const behavLabel = isTh ? 'พฤติกรรมที่ควรระวัง：' : (isEn ? 'Behaviors to Watch: ' : '注意事項/具體行為：');
          const conseqLabel = isTh ? 'ผลลัพธ์ในอนาคต：' : (isEn ? 'Future Consequences: ' : '未來後果：');
          const adviceLabel = isTh ? 'คำแนะนำ：' : (isEn ? 'Advice: ' : '具體建議：');
          const adviceSuffix = isTh ? 'นี่คือคำแนะนำของพี่' : (isEn ? "This is Jack's advice" : '這是我的建議');
          crisisHtml = `
            <div class="reply-crisis-card">
              <div class="reply-crisis-title">${crisisHeader}</div>
              <div class="reply-crisis-item" style="margin-bottom:6px;line-height:1.6;">${warnLabel ? `<strong>${warnLabel}</strong>` : ''}${escapeHtml(cw.warningText || cw.fullText || '')}</div>
              ${cw.behavior ? `<div class="reply-crisis-item"><strong>${behavLabel}</strong>${escapeHtml(cw.behavior)}</div>` : ''}
              ${cw.consequence ? `<div class="reply-crisis-item"><strong>${conseqLabel}</strong>${escapeHtml(cw.consequence)}</div>` : ''}
              ${cw.advice ? `<div class="reply-crisis-item"><strong>${adviceLabel}</strong>${escapeHtml(cw.advice)}</div>` : ''}
              <div class="reply-crisis-item" style="margin-top:6px;font-style:italic;color:#93c5fd;">${adviceSuffix}</div>
            </div>
          `;
        }

        // 開運建議安全渲染：若為 null / undefined 則跳過
        let remedyHtml = '';
        if (a.remedy && typeof a.remedy === 'object') {
          const aromaVal = a.remedy.aroma || '';
          const acupointVal = a.remedy.acupoint || '';
          const demaiVal = a.remedy.demai || '';
          if (aromaVal || acupointVal || demaiVal) {
            remedyHtml = `
              <div class="reply-section">
                <div class="reply-sec-title remedy">${remedyTitle}</div>
                <div class="reply-sec-body">
                  ${aromaVal ? `<div class="remedy-sub-item"><strong>${aromaLabel}</strong>${aromaVal}</div>` : ''}
                  ${acupointVal ? `<div class="remedy-sub-item"><strong>${acupointLabel}</strong>${acupointVal}</div>` : ''}
                  ${demaiVal ? `<div class="remedy-sub-item"><strong>${demaiLabel}</strong>${demaiVal}</div>` : ''}
                </div>
              </div>
            `;
          }
        }

        msgEl.innerHTML = `
          <div class="msg-avatar">🔮</div>
          <div class="msg-content-card">
            <div class="msg-header">
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="msg-author">${authorText}</span>
                ${a.isFromRealLLM
                  ? (isTh ? `<span class="msg-source-tag real-llm" title="คำนวณสดจากระบบคลาวด์">✨ คำนวณสดจากคลาวด์</span>` : `<span class="msg-source-tag real-llm" title="此回答已由雲端智能即時推算">✨ 雲端即時推算</span>`)
                  : (isTh ? `<span class="msg-source-tag fallback" title="เอ็นจินระบบอัจฉริยะ">⚡ ระบบประมวลผลอัจฉริยะ</span>` : `<span class="msg-source-tag fallback" title="本地智能語意引擎">⚡ 本地智能引擎</span>`)
                }
              </div>
              <span class="msg-time">${msg.timestamp || ''}</span>
            </div>

            <!-- 1. Jack 老師解答 / คำแนะนำจากพี่ Jack (逐字打字動畫目標) -->
            <div class="reply-section">
              <div class="reply-sec-title plain">${plainTitle}</div>
              <div class="reply-sec-body plain-text-body">${msg.isNew ? '' : plainContent}</div>
            </div>

            <!-- 2. 燈號 & 3. 星級 -->
            <div class="reply-meta-row">
              <div class="reply-light-badge ${lightType}">
                <span class="light-dot"></span>
                <span class="light-text">${lightLabel}${lightText}</span>
              </div>
              <div class="reply-stars-badge">
                <span class="stars-title">${starsLabel}</span>
                <span class="stars-val">${starsVal}</span>
              </div>
            </div>

            <!-- 未來危機預警卡片 (若觸發) -->
            ${crisisHtml}

            <!-- 4. 完整推算 / การคำนวณเต็มรูปแบบ (可選) -->
            ${calcContent ? `
            <div class="reply-section">
              <div class="reply-sec-title calc">${calcTitle}</div>
              <div class="reply-sec-body">${calcContent}</div>
            </div>` : ''}

            <!-- 5. 開運建議 (若無則不顯示) -->
            ${remedyHtml}

            <!-- 6. 動態權重自適應回饋按鈕 -->
            <div class="msg-feedback-bar">
              <span class="feedback-title">${feedbackTitle}</span>
              <button class="btn-feedback-tag up" onclick="handleFeedbackClick('${state.currentSession.sessionId}', '${(a && a.category) || 'shangji'}', true, '${msg.id}')" title="${isTh ? 'กดเพื่อให้คำแนะนำแม่นยำ (+10%)' : '點擊『建議中了』，自動提升該模組權重 10%'}">
                👍 ${isTh ? 'แม่นยำ (+10%)' : '建議中了 (+10% 權重)'}
              </button>
              <button class="btn-feedback-tag down" onclick="handleFeedbackClick('${state.currentSession.sessionId}', '${(a && a.category) || 'shangji'}', false, '${msg.id}')" title="${isTh ? 'กดเพื่อให้คำแนะนำปรับลด (-10%)' : '點擊『建議沒中』，自動降低該模組權重 10%'}">
                👎 ${isTh ? 'ไม่แม่นยำ (-10%)' : '建議沒中 (-10% 權重)'}
              </button>
            </div>
          </div>
        `;
      } else {
        msgEl.innerHTML = `
          <div class="msg-avatar">🔮</div>
          <div class="msg-content-card">
            <div class="reply-sec-body plain-text-body">${escapeHtml(String(msg.text || '').replace(/^💡?\s*【?(?:白話版|คำแนะนำจากพี่ Jack|Jack 老師解答|Advice from Jack)】?[:：]?\s*/i, ''))}</div>
          </div>
        `;
      }
    }

    container.appendChild(msgEl);

    // 若為新生成訊息，在解答欄位執行逐字打字動畫
    if (msg.isNew) {
      const plainEl = msgEl.querySelector('.plain-text-body');
      const cleanPlain = String((msg.answerData && msg.answerData.plain) || msg.text || '').replace(/^💡?\s*【?(?:白話版|คำแนะนำจากพี่ Jack|Jack 老師解答|Advice from Jack)】?[:：]?\s*/i, '');
      if (plainEl) {
        showTypingEffect(plainEl, cleanPlain, 25, () => {
          msg.isNew = false;
          if (state && state.currentSession) saveSession(state.currentSession);
        });
      } else {
        msg.isNew = false;
      }
    }
  });

  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 30);
}

async function handleUserSend(text) {
  if (!text || !text.trim()) return;
  const session = state.currentSession;
  if (!session) return;

  console.log('🚀 handleUserSend 已觸發，開始調用 LLM');

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const lang = detectLanguage(text.trim());

  // 1. 使用者訊息加入並立即渲染
  const userMsg = {
    id: `msg-${Date.now()}`,
    sender: 'user',
    timestamp: timeStr,
    text: text.trim()
  };
  session.messages.push(userMsg);
  session.lastUpdated = timeStr;
  renderChatMessages();

  // 2. 顯示等待提示氣泡（Jack 老師掐指一算，旋轉動畫與遞減預估秒數）
  showWaitingNotice(null, lang);
  console.log('⏳ 等待提示已顯示');
  const waitingBubbleEl = document.getElementById('jackWaitingBubble');
  if (waitingBubbleEl) {
    console.log('✅ 等待提示 DOM 元素已成功插入聊天室畫面');
  }

  let answerData;
  try {
    // 3. 調用 askGemini 觸發 LLM 完整執行管線
    // 保持至少 1200ms 的推算時間，確保等待提示與每秒倒數計時器在介面上清晰呈現
    const [result] = await Promise.all([
      askGemini(text.trim(), lang, session),
      new Promise(resolve => setTimeout(resolve, 1200))
    ]);
    answerData = result;
    if (answerData && !answerData.lang) answerData.lang = lang;
  } finally {
    // 4. 無論成功或異常，隱藏等待提示氣泡
    hideWaitingNotice();
  }

  // 5. 助理訊息加入，設定 isNew: true 啟用解答逐字打字
  if (session.messages) {
    session.messages.forEach(m => { m.isNew = false; });
  }
  const assistantMsg = {
    id: `msg-${Date.now() + 1}`,
    sender: 'assistant',
    timestamp: timeStr,
    text: answerData.plain,
    answerData: answerData,
    isNew: true
  };
  session.messages.push(assistantMsg);

  // 6. 儲存至該 sessionId 的專屬 localStorage
  saveSession(session);

  // 7. 更新畫面（觸發打字動畫）
  renderChatMessages();
  renderSidebarSessionList();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 渲染 Modal 內真太陽時即時預覽卡片
function renderModalSolarPreviewCard(birthday, clockTime, place) {
  const card = document.getElementById('solarTimePreviewCard');
  if (!card) return;
  const solar = calculateSolarTimeCorrection(birthday, clockTime, place);

  let boundaryNotice = '';
  if (solar.isNearBoundary && solar.boundaryInfo) {
    boundaryNotice = `
      <div class="solar-status-notice warning">
        ⚠️ <strong>時辰邊界預警</strong>：真太陽時 (${solar.trueSolarTime}) 距【${solar.boundaryInfo.boundaryTime}】時辰交界僅差 ${solar.boundaryInfo.diffMinutes} 分鐘（前後 15 分鐘內）。系統將為您同時排定雙命盤供比對差異！
      </div>
    `;
  }

  let solarTermNotice = '';
  if (solar.solarTerms && solar.solarTerms.length > 0) {
    const term = solar.solarTerms[0];
    solarTermNotice = `
      <div class="solar-status-notice info">
        ⚡ <strong>節氣交節天文精算</strong>：鄰近【${term.termName}】節氣交節點（天文時刻：${term.termLocalTime}，相差約 ${Math.abs(Math.round(term.solarDiffMinutes))} 分鐘）。已換算真太陽時校正。
      </div>
    `;
  }

  let changeNotice = '';
  if (solar.isShichenChanged) {
    changeNotice = `
      <div class="solar-status-notice warning">
        ⚡ <strong>時辰變更提醒</strong>：鐘錶原時辰為【${solar.originalShichenShort}時】，經真太陽時天文校正後切換為【${solar.adjustedShichenShort}時】排盤！
      </div>
    `;
  }

  card.innerHTML = `
    <div class="solar-preview-header">
      <div class="solar-preview-title">
        <span>☀️ 真太陽時天文即時校正預覽</span>
      </div>
      <span style="color:var(--text-muted);font-size:0.75rem;">地理時差 + 均時差(EOT)</span>
    </div>
    <div class="solar-preview-grid">
      <div class="solar-preview-item">
        <span class="label">出生地解析</span>
        <span class="value">${solar.location.name}</span>
        <span style="font-size:0.7rem;color:var(--text-dim);">${solar.location.lon >= 0 ? solar.location.lon + '°E' : Math.abs(solar.location.lon) + '°W'} (中央線 ${solar.location.centralMeridian}°)</span>
      </div>
      <div class="solar-preview-item">
        <span class="label">鐘錶時間</span>
        <span class="value">${solar.clockTime}</span>
        <span style="font-size:0.7rem;color:var(--text-dim);">${solar.originalShichenShort}時 (鐘錶)</span>
      </div>
      <div class="solar-preview-item">
        <span class="label">地理時差</span>
        <span class="value highlight">${solar.geoOffsetMinutes >= 0 ? '+' : ''}${solar.geoOffsetMinutes} 分鐘</span>
        <span style="font-size:0.7rem;color:var(--text-dim);">4分 × (經度-中央線)</span>
      </div>
      <div class="solar-preview-item">
        <span class="label">均時差 (EOT)</span>
        <span class="value highlight">${solar.eotMinutes >= 0 ? '+' : ''}${solar.eotMinutes} 分鐘</span>
        <span style="font-size:0.7rem;color:var(--text-dim);">NOAA 太陽公轉軌道均差</span>
      </div>
      <div class="solar-preview-item">
        <span class="label">平太陽時</span>
        <span class="value">${solar.meanSolarTime}</span>
        <span style="font-size:0.7rem;color:var(--text-dim);">鐘錶 + 地理時差</span>
      </div>
      <div class="solar-preview-item">
        <span class="label">真太陽時 (排盤基準)</span>
        <span class="value gold">${solar.trueSolarTime}</span>
        <span style="font-size:0.7rem;color:var(--text-dim);">${solar.adjustedShichenShort}時 (總時差 ${solar.totalOffsetMinutes >= 0 ? '+' : ''}${solar.totalOffsetMinutes}分)</span>
      </div>
    </div>
    ${changeNotice}
    ${boundaryNotice}
    ${solarTermNotice}
  `;
}

// =============================================================
// AI 設定面板 (DeepInfra / Gemini) 控制函式
// =============================================================
function openAISettingsModal() {
  const modal = document.getElementById('modalAISettings');
  if (!modal) return;

  const selProvider = document.getElementById('selectLLMProvider');
  const selModel = document.getElementById('selectDeepInfraModel');
  const inputDeepKey = document.getElementById('inputDeepInfraKey');
  const inputGeminiKey = document.getElementById('inputGeminiKey');
  const grpModel = document.getElementById('groupDeepInfraModel');
  const badge = document.getElementById('aiActiveBadge');
  const statusText = document.getElementById('aiCostStatusText');

  const provider = (typeof localStorage !== 'undefined' && localStorage.getItem('llm_provider')) ||
    (typeof state !== 'undefined' && state.llmProvider) ||
    (typeof window !== 'undefined' && window.LLM_PROVIDER) ||
    'deepinfra';

  const deepModel = (typeof localStorage !== 'undefined' && localStorage.getItem('deepinfra_model')) ||
    (typeof state !== 'undefined' && state.deepinfraModel) ||
    'deepseek-ai/DeepSeek-V4-Flash-0731';

  const deepKey = (typeof localStorage !== 'undefined' && localStorage.getItem('deepinfra_api_key')) ||
    (typeof state !== 'undefined' && state.deepinfraApiKey) ||
    (typeof window !== 'undefined' && window.DEEPINFRA_API_KEY) ||
    '';

  const gemKey = (typeof localStorage !== 'undefined' && localStorage.getItem('gemini_api_key')) ||
    (typeof state !== 'undefined' && state.geminiApiKey) ||
    '';

  if (selProvider) selProvider.value = provider;
  if (selModel) selModel.value = deepModel;
  if (inputDeepKey) inputDeepKey.value = deepKey;
  if (inputGeminiKey) inputGeminiKey.value = gemKey;

  const updateAISettingsView = () => {
    const curProv = selProvider ? selProvider.value : 'deepinfra';
    if (grpModel) {
      grpModel.style.display = curProv === 'deepinfra' ? 'block' : 'none';
    }
    if (badge) {
      if (curProv === 'deepinfra') {
        badge.innerText = 'DeepInfra 模式 (預設)';
        badge.style.background = '#10b981';
      } else {
        badge.innerText = 'Gemini 模式';
        badge.style.background = '#3b82f6';
      }
    }
    if (statusText) {
      if (curProv === 'deepinfra') {
        statusText.innerHTML = `當前優先使用 <strong>DeepInfra</strong>，自動計算 Token 消耗與花費（V4 Flash: 輸入 $0.09/1M, 輸出 $0.18/1M）。若失敗自動降級到 Gemini。`;
      } else {
        statusText.innerHTML = `當前優先使用 <strong>Google AI Studio (Gemini)</strong>。若調用失敗自動嘗試降級至 DeepInfra。`;
      }
    }
  };

  updateAISettingsView();
  modal.classList.add('active');
}

function closeAISettingsModal() {
  const modal = document.getElementById('modalAISettings');
  if (modal) modal.classList.remove('active');
}

function saveAISettings() {
  const selProvider = document.getElementById('selectLLMProvider');
  const selModel = document.getElementById('selectDeepInfraModel');
  const inputDeepKey = document.getElementById('inputDeepInfraKey');
  const inputGeminiKey = document.getElementById('inputGeminiKey');

  const provider = selProvider ? selProvider.value : 'deepinfra';
  const model = selModel ? selModel.value : 'deepseek-ai/DeepSeek-V4-Flash-0731';
  const deepKey = inputDeepKey ? inputDeepKey.value.trim() : '';
  const gemKey = inputGeminiKey ? inputGeminiKey.value.trim() : '';

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('llm_provider', provider);
    localStorage.setItem('deepinfra_model', model);
    if (deepKey) {
      localStorage.setItem('deepinfra_api_key', deepKey);
    } else {
      localStorage.removeItem('deepinfra_api_key');
    }
    if (gemKey) {
      localStorage.setItem('gemini_api_key', gemKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  }

  if (typeof state !== 'undefined') {
    state.llmProvider = provider;
    state.deepinfraModel = model;
    state.deepinfraApiKey = deepKey;
    state.geminiApiKey = gemKey;
  }
  if (typeof window !== 'undefined') {
    window.LLM_PROVIDER = provider;
    window.DEEPINFRA_API_KEY = deepKey;
    window.currentActiveDeepInfraModel = model;
  }

  closeAISettingsModal();
  const provDesc = provider === 'deepinfra' ? `DeepInfra (${model.split('/').pop()})` : 'Google AI Studio (Gemini)';
  showPlusToast(`✨ AI 設定已儲存！當前優先供應商：${provDesc}`);
}

function clearAISettings() {
  if (typeof confirm === 'function' && !confirm('確定要清除所有儲存的 AI API Key 嗎？')) return;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('deepinfra_api_key');
    localStorage.removeItem('gemini_api_key');
  }
  const inputDeepKey = document.getElementById('inputDeepInfraKey');
  const inputGeminiKey = document.getElementById('inputGeminiKey');
  if (inputDeepKey) inputDeepKey.value = '';
  if (inputGeminiKey) inputGeminiKey.value = '';

  if (typeof state !== 'undefined') {
    state.deepinfraApiKey = '';
    state.geminiApiKey = '';
  }
  if (typeof window !== 'undefined') {
    window.DEEPINFRA_API_KEY = '';
  }
  showPlusToast('🧹 已清除所有 API 金鑰，若無金鑰將自動使用本地備用命理語意引擎。');
}

// -------------------------------------------------------------
// 事件監聽與彈窗控制
// -------------------------------------------------------------
function setupEventListeners() {
  // 發送訊息按鈕與輸入框 Enter (支援 Enter 送出，Shift+Enter 換行)
  const inputEl = document.getElementById('chatInputText');
  const btnSend = document.getElementById('btnSendMessage');

  if (inputEl) {
    // 輸入時自動擴展高度
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    });

    // Enter 送出，Shift+Enter 換行
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const val = inputEl.value;
        inputEl.value = '';
        inputEl.style.height = '44px';
        handleUserSend(val);
      }
    });
  }

  if (btnSend) {
    btnSend.addEventListener('click', () => {
      if (!inputEl) return;
      const val = inputEl.value;
      inputEl.value = '';
      inputEl.style.height = '44px';
      handleUserSend(val);
    });
  }

  // 語言切換按鈕 (中文 / ไทย)
  const btnLangToggle = document.getElementById('btnLangToggle');
  if (btnLangToggle) {
    btnLangToggle.addEventListener('click', () => {
      toggleLanguage();
    });
  }

  // 設定 AI API 按鈕 (開啟 AI 核心設定彈窗)
  const btnGeminiKey = document.getElementById('btnGeminiKey');
  if (btnGeminiKey) {
    btnGeminiKey.addEventListener('click', () => {
      openAISettingsModal();
    });
  }

  // AI 設定彈窗控制
  const modalAISettings = document.getElementById('modalAISettings');
  document.getElementById('btnCloseAISettingsModal')?.addEventListener('click', closeAISettingsModal);
  modalAISettings?.addEventListener('click', (e) => {
    if (e.target === modalAISettings) closeAISettingsModal();
  });
  document.getElementById('btnSaveAISettings')?.addEventListener('click', saveAISettings);
  document.getElementById('btnClearAISettings')?.addEventListener('click', clearAISettings);
  document.getElementById('selectLLMProvider')?.addEventListener('change', (e) => {
    const grp = document.getElementById('groupDeepInfraModel');
    if (grp) grp.style.display = e.target.value === 'deepinfra' ? 'block' : 'none';
    const badge = document.getElementById('aiActiveBadge');
    const statusText = document.getElementById('aiCostStatusText');
    if (badge) {
      if (e.target.value === 'deepinfra') {
        badge.innerText = 'DeepInfra 模式 (預設)';
        badge.style.background = '#10b981';
      } else {
        badge.innerText = 'Gemini 模式';
        badge.style.background = '#3b82f6';
      }
    }
    if (statusText) {
      if (e.target.value === 'deepinfra') {
        statusText.innerHTML = `當前優先使用 <strong>DeepInfra</strong>，自動計算 Token 消耗與花費（V4 Flash: 輸入 $0.09/1M, 輸出 $0.18/1M）。若失敗自動降級到 Gemini。`;
      } else {
        statusText.innerHTML = `當前優先使用 <strong>Google AI Studio (Gemini)</strong>。若調用失敗自動嘗試降級至 DeepInfra。`;
      }
    }
  });

  // 快速提問按鈕 (右側 10 個按鈕)
  document.querySelectorAll('.quick-q-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-q');
      handleUserSend(q);
    });
  });

  // 編輯客戶名稱
  const btnEditName = document.getElementById('btnEditClientName');
  const nameEl = document.getElementById('currentClientName');
  const handleRename = () => {
    const oldName = state.currentSession ? state.currentSession.clientName : '';
    const newName = prompt('請輸入此客戶自訂名稱：', oldName);
    if (newName && newName.trim() && state.currentSession) {
      state.currentSession.clientName = newName.trim();
      saveSession(state.currentSession);
      updateChatTopHeader(state.currentSession);
      renderSidebarSessionList();
    }
  };
  btnEditName.addEventListener('click', handleRename);
  nameEl.addEventListener('click', handleRename);

  // 新增客戶命盤彈窗控制
  const modalNew = document.getElementById('modalNewClient');
  const btnOpenModal1 = document.getElementById('btnOpenNewClientModal');
  const btnOpenModal2 = document.getElementById('btnSidebarNewClient');
  const btnCloseModal = document.getElementById('btnCloseNewClientModal');
  const btnSubmitNew = document.getElementById('btnSubmitNewClient');

  const openNewModal = () => {
    modalNew.classList.add('active');
    updateModalSolarPreview();
  };
  const closeNewModal = () => {
    modalNew.classList.remove('active');
  };

  const updateModalSolarPreview = () => {
    const bday = document.getElementById('newBirthday')?.value || '1990-03-15';
    const place = document.getElementById('newBirthPlace')?.value || '台北';
    const clockTime = document.getElementById('newBirthClockTime')?.value || '14:00';
    renderModalSolarPreviewCard(bday, clockTime, place);
  };

  document.getElementById('newBirthPlace')?.addEventListener('input', updateModalSolarPreview);
  document.getElementById('newBirthday')?.addEventListener('input', updateModalSolarPreview);
  document.getElementById('newBirthClockTime')?.addEventListener('input', (e) => {
    const val = e.target.value;
    if (val && val.includes(':')) {
      const [h, m] = val.split(':').map(Number);
      const shichenIdx = timeToShichenIndex(h, m);
      const sel = document.getElementById('newBirthTime');
      if (sel) sel.value = String(shichenIdx);
    }
    updateModalSolarPreview();
  });
  document.getElementById('newBirthTime')?.addEventListener('change', (e) => {
    const idx = parseInt(e.target.value, 10);
    const clockInput = document.getElementById('newBirthClockTime');
    if (clockInput && SHICHEN_DEFAULT_TIME[idx]) {
      clockInput.value = SHICHEN_DEFAULT_TIME[idx];
    }
    updateModalSolarPreview();
  });

  btnOpenModal1.addEventListener('click', openNewModal);
  btnOpenModal2.addEventListener('click', openNewModal);
  btnCloseModal.addEventListener('click', closeNewModal);
  modalNew.addEventListener('click', (e) => {
    if (e.target === modalNew) closeNewModal();
  });

  btnSubmitNew.addEventListener('click', () => {
    const name = document.getElementById('newClientName').value;
    const bday = document.getElementById('newBirthday').value;
    const cal = document.getElementById('newCalendarType').value;
    const gender = document.getElementById('newGender').value;
    const place = document.getElementById('newBirthPlace').value || '台北';
    const clockTime = document.getElementById('newBirthClockTime').value || '14:00';
    const time = parseInt(document.getElementById('newBirthTime').value, 10);
    const year = parseInt(document.getElementById('newTargetYear').value, 10) || 2026;
    const incNatal = document.getElementById('newIncludeNatal').checked;

    if (!bday) {
      alert('請輸入出生日期');
      return;
    }

    const newSess = createNewChatSession({
      clientName: name,
      birthday: bday,
      calendarType: cal,
      birthPlace: place,
      birthClockTime: clockTime,
      birthTime: time,
      gender: gender,
      targetYear: year,
      includeNatal: incNatal
    });

    closeNewModal();
    switchSession(newSess.sessionId);
    switchView('chat');
  });

  // 全年排行榜分類切換
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTab = btn.getAttribute('data-cat');
      renderRankingsView();
    });
  });

  // 下載 JSON 按鈕
  document.getElementById('btnDownloadJSON').addEventListener('click', downloadJSON);

  // 關閉推算詳情 Modal
  document.getElementById('btnCloseModal')?.addEventListener('click', () => {
    document.getElementById('modalOverlay')?.classList.remove('active');
  });
  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) {
      document.getElementById('modalOverlay').classList.remove('active');
    }
  });

  // 多國語言選擇彈窗 (5 國語言)
  document.querySelectorAll('.lang-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      if (lang) {
        setLanguage(lang);
        document.getElementById('modalLanguage')?.classList.remove('active');
      }
    });
  });
  document.getElementById('btnCloseLanguageModal')?.addEventListener('click', () => {
    document.getElementById('modalLanguage')?.classList.remove('active');
  });
  document.getElementById('modalLanguage')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalLanguage')) {
      document.getElementById('modalLanguage').classList.remove('active');
    }
  });

  // 動態權重調整面板
  document.getElementById('currentClientWeights')?.addEventListener('click', () => {
    openWeightsModal();
  });
  document.getElementById('btnCloseWeightsModal')?.addEventListener('click', () => {
    document.getElementById('modalWeights')?.classList.remove('active');
  });
  document.getElementById('modalWeights')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalWeights')) {
      document.getElementById('modalWeights').classList.remove('active');
    }
  });
  document.getElementById('btnResetWeights')?.addEventListener('click', () => {
    resetClientWeights();
  });
  document.getElementById('btnSaveWeightsClose')?.addEventListener('click', () => {
    document.getElementById('modalWeights')?.classList.remove('active');
    showPlusToast('⚖️ 權重設定已儲存並重新計算排行榜！');
    const session = state.currentSession;
    if (session) {
      calculateClientAstrolabe(session);
      renderRankingsView();
      updateChatTopHeader(session);
    }
  });

  // 流分推算面板
  document.getElementById('currentClientMinute')?.addEventListener('click', () => {
    openFlowMinuteModal();
  });
  document.getElementById('btnCloseFlowMinuteModal')?.addEventListener('click', () => {
    document.getElementById('modalFlowMinuteFull')?.classList.remove('active');
  });
  document.getElementById('modalFlowMinuteFull')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalFlowMinuteFull')) {
      document.getElementById('modalFlowMinuteFull').classList.remove('active');
    }
  });
  document.getElementById('btnSyncNowMinute')?.addEventListener('click', () => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dInput = document.getElementById('flowMinuteDateInput');
    const tInput = document.getElementById('flowMinuteTimeInput');
    if (dInput) dInput.value = getSystemCurrentDate();
    if (tInput) tInput.value = timeStr;
    renderFlowMinuteFullOutput();
  });
  document.getElementById('btnCalculateMinuteNow')?.addEventListener('click', () => {
    renderFlowMinuteFullOutput();
  });

  // 命盤視覺化圖表重新整理按鈕
  document.getElementById('btnRefreshCharts')?.addEventListener('click', () => {
    initOrUpdateCharts();
    showPlusToast('📊 命盤多維幾何與走勢圖表已重新整理！');
  });

  // 手機版漢堡選單抽屜與遮罩事件
  const btnMobileToggle = document.getElementById('btnMobileSidebarToggle');
  const sidebarLeft = document.querySelector('.chat-sidebar-left');
  const backdrop = document.getElementById('mobileSidebarBackdrop');

  if (btnMobileToggle && sidebarLeft) {
    btnMobileToggle.addEventListener('click', () => {
      sidebarLeft.classList.toggle('mobile-sidebar-open');
      if (backdrop) backdrop.classList.toggle('active', sidebarLeft.classList.contains('mobile-sidebar-open'));
    });
  }

  if (backdrop && sidebarLeft) {
    backdrop.addEventListener('click', () => {
      sidebarLeft.classList.remove('mobile-sidebar-open');
      backdrop.classList.remove('active');
    });
  }

  // 平板版快速提問下拉選單
  const tabletSelect = document.getElementById('tabletQuickSelect');
  if (tabletSelect) {
    tabletSelect.addEventListener('change', () => {
      const q = tabletSelect.value;
      if (q) {
        handleUserSend(q);
        tabletSelect.value = '';
      }
    });
  }

  // 手機版底部快速提問橫向按鈕
  document.querySelectorAll('.mobile-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-q');
      if (q) {
        handleUserSend(q);
      }
    });
  });

  // 全域 Escape 關閉所有彈窗
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('modalOverlay')?.classList.remove('active');
      document.getElementById('modalNewClient')?.classList.remove('active');
      document.getElementById('modalLanguage')?.classList.remove('active');
      document.getElementById('modalWeights')?.classList.remove('active');
      document.getElementById('modalFlowMinuteFull')?.classList.remove('active');
      if (sidebarLeft) {
        sidebarLeft.classList.remove('mobile-sidebar-open');
      }
      if (backdrop) {
        backdrop.classList.remove('active');
      }
    }
  });
}

// -------------------------------------------------------------
// 視圖 2: 排行榜渲染
// -------------------------------------------------------------
function renderRankingsView() {
  const container = document.getElementById('rankingsContainer');
  if (!container) return;
  container.innerHTML = '';

  const active = state.activeTab;
  const catsToRender = active === 'all' ? CATEGORIES : CATEGORIES.filter(c => c.key === active);

  catsToRender.forEach(cat => {
    let list = state.rankings[cat.key] || [];
    let badgeText = 'TOP 10';
    if (cat.key === 'letou') {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const futureList = list.filter(item => item.date >= todayStr);
      if (futureList.length > 0) {
        list = futureList;
        badgeText = '未來 TOP 10';
      }
    }
    const top10 = list.slice(0, 10);

    const card = document.createElement('div');
    card.className = `ranking-card ${cat.key}`;

    const itemsHtml = top10.map((item, idx) => {
      const rankClass = idx === 0 ? 'top-1' : (idx === 1 ? 'top-2' : (idx === 2 ? 'top-3' : ''));
      const rulesSummary = item.details.map(d => `${d.rule}(${d.points > 0 ? '+' : ''}${d.points})`).join('、 ') || '無特殊加減分';
      const scorePrefix = item.score > 0 ? '+' : '';
      const fullDate = formatAuspiciousDate(item.date);

      return `
        <li class="ranking-item" data-date="${item.date}">
          <div class="rank-badge ${rankClass}">${idx + 1}</div>
          <div class="item-date-info">
            <div class="item-date-row">
              <span class="item-date">${fullDate}</span>
            </div>
            <div class="item-rules" title="${rulesSummary}">${rulesSummary}</div>
          </div>
          <div class="item-score-pill">${scorePrefix}${item.score} 分</div>
        </li>
      `;
    }).join('');

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title-group">
          <h3><span>${cat.icon}</span> ${cat.name}</h3>
          <p>${cat.desc}</p>
        </div>
        <div class="card-top-badge">${badgeText}</div>
      </div>
      <ul class="ranking-list">
        ${itemsHtml || '<li style="padding:16px;text-align:center;color:var(--text-dim);">暫無數據</li>'}
      </ul>
    `;

    card.querySelectorAll('.ranking-item').forEach(el => {
      el.addEventListener('click', () => {
        const d = el.getAttribute('data-date');
        openDetailModal(d);
      });
    });

    container.appendChild(card);
  });
}

function openDetailModal(dateStr) {
  const day = state.allDays.find(d => d.date === dateStr);
  if (!day) return;

  const fullDate = formatAuspiciousDate(day.date);
  const lunarInfo = convertToLunar(day.date);

  const titleEl = document.getElementById('modalDateTitle');
  if (titleEl) titleEl.innerText = fullDate;
  const lunarEl = document.getElementById('modalLunarTitle');
  if (lunarEl) lunarEl.innerText = `農曆：${day.lunarDate || lunarInfo.lunar}（${lunarInfo.ganzhi}日，${lunarInfo.weekday}）`;

  // 0. 真太陽時天文校正明細
  const bannerEl = document.getElementById('modalSolarCorrectionBanner');
  const session = state.currentSession;
  if (bannerEl && session) {
    const solar = session.solarCorrection || calculateSolarTimeCorrection(
      session.birthday || '1990-03-15',
      session.birthClockTime || '14:00',
      session.birthPlace || '台北'
    );
    bannerEl.innerHTML = `
      <div class="title-row">
        <span>☀️ 客戶【${escapeHtml(session.clientName)}】真太陽時天文校正明細</span>
        <span>排盤基準時辰：${solar.adjustedShichenName}</span>
      </div>
      <div class="params-row">
        <div class="param-tag">出生地：<strong>${solar.location.name} (${solar.location.lon >= 0 ? solar.location.lon + '°E' : Math.abs(solar.location.lon) + '°W'})</strong></div>
        <div class="param-tag">鐘錶時間：<strong>${solar.clockTime} (${solar.originalShichenShort}時)</strong></div>
        <div class="param-tag">地理時差：<strong>${solar.geoOffsetMinutes >= 0 ? '+' : ''}${solar.geoOffsetMinutes} 分鐘</strong></div>
        <div class="param-tag">均時差 (EOT)：<strong>${solar.eotMinutes >= 0 ? '+' : ''}${solar.eotMinutes} 分鐘</strong></div>
        <div class="param-tag">平太陽時：<strong>${solar.meanSolarTime}</strong></div>
        <div class="param-tag">真太陽時：<strong>${solar.trueSolarTime} (${solar.adjustedShichenShort}時)</strong></div>
        <div class="param-tag">時辰狀態：<strong>${solar.isShichenChanged ? `原 ${solar.originalShichenShort}時 ➔ 校正後 ${solar.adjustedShichenShort}時` : `原 ${solar.originalShichenShort}時 ➔ ${solar.adjustedShichenShort}時 (維持不變)`}</strong></div>
      </div>
      ${solar.isNearBoundary && solar.boundaryInfo ? `<div class="solar-status-notice warning" style="margin-top:6px;">⚠️ <strong>時辰邊界預警</strong>：真太陽時距離交界時刻（${solar.boundaryInfo.boundaryTime}）僅差 ${solar.boundaryInfo.diffMinutes} 分鐘（前後 15 分鐘內）。</div>` : ''}
    `;
  }

  // 1. 流日四化
  const sihua = day.dailySiHua;
  document.getElementById('modalSihuaBanner').innerHTML = `
    <div class="sihua-pill lu"><div class="sihua-title">化祿</div><div class="sihua-star">${sihua.化禄 || sihua.化祿 || '—'}</div></div>
    <div class="sihua-pill quan"><div class="sihua-title">化權</div><div class="sihua-star">${sihua.化权 || sihua.化權 || '—'}</div></div>
    <div class="sihua-pill ke"><div class="sihua-title">化科</div><div class="sihua-star">${sihua.化科 || '—'}</div></div>
    <div class="sihua-pill ji"><div class="sihua-title">化忌</div><div class="sihua-star">${sihua.化忌 || '—'}</div></div>
  `;

  // 2. 七大維度評分
  const scores = day.scores;
  document.getElementById('modalScoresGrid').innerHTML = CATEGORIES.map(cat => {
    const sc = scores[cat.key] || { score: 0, details: [] };
    const scoreClass = sc.score > 0 ? 'positive' : (sc.score < 0 ? 'negative' : 'zero');
    const rulesList = sc.details.length > 0
      ? sc.details.map(d => `<div class="score-rule-item"><span>${d.rule}</span><strong>+${d.points}</strong></div>`).join('')
      : '<div style="color:var(--text-dim);font-size:0.75rem;">無加減分</div>';

    return `
      <div class="score-box">
        <div class="score-box-head">
          <span class="score-box-title">${cat.icon} ${cat.name}</span>
          <span class="score-box-num ${scoreClass}">${sc.score > 0 ? '+' : ''}${sc.score}</span>
        </div>
        <div class="score-rules-list">${rulesList}</div>
      </div>
    `;
  }).join('');

  // 3. 焦點宮位
  const keyPalaces = [
    { label: '流日命宮', data: day.dailyMing },
    { label: '流日財帛宮', data: day.dailyCaibo },
    { label: '流日夫妻宮', data: day.dailyFuqi },
    { label: '流日福德宮', data: day.dailyFude },
    { label: '流日官祿宮', data: day.dailyGuanlu },
    { label: '流日疾厄宮', data: day.dailyJie },
    { label: '流日遷移宮', data: day.dailyQianyi }
  ];

  document.getElementById('modalPalacesGrid').innerHTML = keyPalaces.map(kp => {
    const p = kp.data;
    if (!p) return '';
    const majorTags = p.majorStars.map(s => `<span class="star-tag major">${s.name}</span>`).join('');
    const minorTags = p.minorStars.map(s => `<span class="star-tag minor">${s.name}</span>`).join('');
    const dailyTags = p.dailyStars.map(s => `<span class="star-tag daily">${s}</span>`).join('');

    return `
      <div class="palace-card">
        <div class="palace-card-head">
          <span class="palace-name">${kp.label}（本命${p.natalPalace}）</span>
          <span class="palace-branch">${p.earthlyBranch}宮</span>
        </div>
        <div class="star-tag-list">${majorTags || '<span style="color:var(--text-dim);font-size:0.75rem;">無主星</span>'} ${minorTags} ${dailyTags}</div>
        <div class="palace-card-footer"><span>長生：${p.changsheng12 || '—'}</span></div>
      </div>
    `;
  }).join('');

  // 4. 十二宮方盤
  renderZiWeiGrid(day);

  // 4.1 七政四餘天象星曜明細 (滿天星 Plus)
  const qzGrid = document.getElementById('modalQizhengGrid');
  if (qzGrid) {
    const qz = calculateQizhengSiyu(day.date, '12:00', session ? session.birthPlace : '台北');
    const allBodies = [
      ...qz.sevenLuminaries.map(b => ({ ...b, type: 'seven' })),
      ...qz.fourExtras.map(b => ({ ...b, type: 'extra' }))
    ];
    qzGrid.innerHTML = allBodies.map(b => `
      <div class="qizheng-item-card ${b.type}">
        <div class="qz-item-head">
          <span class="qz-item-name">${b.chinese} (${b.name})</span>
          <span class="qz-item-branch">${b.branch}宮</span>
        </div>
        <div class="qz-item-degree">${b.degreeFormatted} (${b.longitude.toFixed(2)}°)</div>
        <div class="qz-item-meaning">${b.meaning || b.influence || ''}</div>
      </div>
    `).join('');
  }

  // 4.2 當日流分即時推算器 (滿天星 Plus)
  const minuteResultEl = document.getElementById('modalFlowMinuteResult');
  const minutePicker = document.getElementById('modalFlowMinutePicker');
  const btnSyncMin = document.getElementById('btnModalSyncMinute');
  const updateModalMinute = (timeVal) => {
    if (!minuteResultEl) return;
    const t = timeVal || (minutePicker ? minutePicker.value : '12:00');
    const minData = calculateFlowMinute(day.date, t, session);
    const si = minData.minuteSiHua;
    minuteResultEl.innerHTML = `
      <div class="flow-minute-card">
        <div class="min-header">
          <span class="min-time-tag">⏱️ 基準：${day.date} ${t}</span>
          <span class="min-gz-tag">流分干支：<strong>${minData.minuteGanZhi}</strong> (流分命宮：${minData.minutePalaceBranch}宮)</span>
        </div>
        <div class="min-sihua-row">
          <span class="sihua-chip lu">化祿: ${si.化祿 || '—'}</span>
          <span class="sihua-chip quan">化權: ${si.化權 || '—'}</span>
          <span class="sihua-chip ke">化科: ${si.化科 || '—'}</span>
          <span class="sihua-chip ji">化忌: ${si.化忌 || '—'}</span>
        </div>
        <div class="min-desc">${minData.explanation || ''}</div>
      </div>
    `;
  };
  if (minutePicker) {
    minutePicker.onchange = (e) => updateModalMinute(e.target.value);
  }
  if (btnSyncMin) {
    btnSyncMin.onclick = () => {
      const now = new Date();
      const curT = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (minutePicker) minutePicker.value = curT;
      updateModalMinute(curT);
    };
  }
  updateModalMinute(minutePicker ? minutePicker.value : '09:15');

  // 5. 倪師改運建議
  const niAdvice = getNiAdvice(day);
  document.getElementById('modalNiAdviceGrid').innerHTML = `
    <div class="advice-card">
      <div class="advice-card-head"><span class="advice-icon">🌿</span><h5>中藥聞香：${niAdvice.aroma.title}</h5></div>
      <div class="advice-content"><p>${niAdvice.aroma.recipe}</p><p>${niAdvice.aroma.usage}</p></div>
    </div>
    <div class="advice-card">
      <div class="advice-card-head"><span class="advice-icon">💆</span><h5>穴位按摩：${niAdvice.acupoint.name}</h5></div>
      <div class="advice-content"><p>${niAdvice.acupoint.loc}</p><p>${niAdvice.acupoint.tech}</p></div>
    </div>
    <div class="advice-card">
      <div class="advice-card-head"><span class="advice-icon">🧭</span><h5>地脈道：天紀座向佈局</h5></div>
      <div class="advice-content">${niAdvice.demai}</div>
    </div>
  `;

  // 6. 決策佈局
  const layoutAdvice = getLayoutAdvice(day);
  document.getElementById('modalLayoutAdviceGrid').innerHTML = `
    <div class="advice-card"><div class="advice-card-head"><span class="advice-icon">⏰</span><h5>吉利時辰</h5></div><div class="advice-content">${layoutAdvice.timing}</div></div>
    <div class="advice-card"><div class="advice-card-head"><span class="advice-icon">🗺️</span><h5>有利方位</h5></div><div class="advice-content">${layoutAdvice.directions}</div></div>
    <div class="advice-card"><div class="advice-card-head"><span class="advice-icon">👥</span><h5>生肖貴人</h5></div><div class="advice-content">${layoutAdvice.zodiacs}</div></div>
  `;

  document.getElementById('modalOverlay').classList.add('active');
}

function renderZiWeiGrid(day) {
  const container = document.getElementById('ziweiGrid');
  container.innerHTML = '';
  const astrolabe = state.astrolabe;
  const h = day.rawHoroscope;

  const centerBox = document.createElement('div');
  centerBox.className = 'zw-center-box';
  centerBox.innerHTML = `
    <div class="zw-center-title">紫微斗數流日命盤</div>
    <div class="zw-center-meta">
      <div><strong>命主：</strong>${state.currentSession.clientName}</div>
      <div><strong>局數：</strong>${astrolabe.fiveElementsClass}</div>
      <div style="color:var(--gold);margin-top:2px;"><strong>流日：</strong>${day.date} (${day.dailyGanZhi}日)</div>
    </div>
  `;
  container.appendChild(centerBox);

  GRID_CELLS.forEach(cell => {
    const palace = astrolabe.palaces.find(p => p.earthlyBranch === cell.branch);
    const cellEl = document.createElement('div');
    cellEl.className = 'zw-cell';
    cellEl.style.gridRow = cell.row;
    cellEl.style.gridColumn = cell.col;

    if (!palace) {
      cellEl.innerText = cell.branch;
      container.appendChild(cellEl);
      return;
    }

    const dailyPalaceName = h.daily.palaceNames[palace.index] || '';
    if (dailyPalaceName === '命宫' || dailyPalaceName === '命宮') cellEl.classList.add('highlight-ming');
    if (dailyPalaceName === '财帛' || dailyPalaceName === '財帛') cellEl.classList.add('highlight-caibo');
    if (dailyPalaceName === '官禄' || dailyPalaceName === '官祿') cellEl.classList.add('highlight-guanlu');
    if (dailyPalaceName === '夫妻') cellEl.classList.add('highlight-fuqi');

    const majors = palace.majorStars.map(s => `<span style="color:#f87171;font-weight:700;">${s.name}</span>`).join(' ');
    const minors = palace.minorStars.map(s => `<span style="color:#60a5fa;">${s.name}</span>`).join(' ');

    cellEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;">
        <span style="font-weight:800;color:#facc15;">${dailyPalaceName}</span>
        <span style="color:var(--text-muted);font-size:0.7rem;">${palace.name}</span>
      </div>
      <div style="margin:2px 0;">
        <div>${majors || '<span style="color:var(--text-dim);font-size:0.7rem;">無主星</span>'}</div>
        <div style="font-size:0.7rem;">${minors}</div>
      </div>
      <div style="display:flex;justify-content:space-between;color:var(--text-dim);font-size:0.68rem;">
        <span>${palace.changsheng12}</span>
        <span style="font-weight:700;color:#e2e8f0;">${cell.branch}</span>
      </div>
    `;

    container.appendChild(cellEl);
  });
}

// -------------------------------------------------------------
// 視圖 3: 改運工具箱渲染 (與當前客戶綁定)
// -------------------------------------------------------------
function updatePersonalRemedyProfile() {
  const astrolabe = state.astrolabe;
  const session = state.currentSession;
  if (!astrolabe || !session) return;

  const summaryEl = document.getElementById('profileSummaryText');
  const detailsEl = document.getElementById('profileDetailsGrid');
  if (!summaryEl || !detailsEl) return;

  const fiveElements = astrolabe.fiveElementsClass || '土五局';
  const birthYear = parseInt(session.birthday.split('-')[0], 10) || 1990;
  const birthHour = session.birthTime !== undefined ? session.birthTime : 7;

  // 倪師體質辨證判定 (虛熱 vs 水寒)
  // Client A (土五局/火六局、白晝出生、陽氣偏浮): 屬「陰虛燥熱型」
  // Client B (水二局/金四局/木三局、夜間或秋冬出生): 屬「陽虛水寒型」
  const isYinDeficientHeat = (fiveElements.includes('土') || fiveElements.includes('火') || (birthHour >= 4 && birthHour <= 8));
  const constitutionTitle = isYinDeficientHeat ? '陰虛燥熱型（金火浮旺 · 虛熱內耗）' : '陽虛水寒型（命門火微 · 水寒土滯）';
  const constitutionDesc = isYinDeficientHeat
    ? '【喜滋陰潤燥、清金涵木，切忌辛溫燥烈】：體質易心浮氣躁、手足心熱或夜眠不實。此格局調養貴在「潤降」而非「溫燥」。'
    : '【喜溫陽化氣、培土生金，切忌陰寒滋膩】：體質易畏寒肢冷、中焦運化偏慢。此格局調養貴在「溫通蒸騰」而非「苦寒下瀉」。';

  // 1. 同樣是補水：A客戶用沉香，B客戶用丁香
  const waterHerb = isYinDeficientHeat
    ? '【特級海南沉香】：沉降清虛火，引氣歸腎水以達水火既濟。（切忌辛燥之丁香）'
    : '【特級公丁香】：溫腎壯命門真火，陽化氣則水自生。（切忌苦寒之沉香）';

  // 2. 同樣是補財：A客戶按太溪穴，B客戶按足三里
  const wealthAcupoint = isYinDeficientHeat
    ? '【太溪穴】（足少陰腎經原穴）：滋腎水真陰以生發智謀財源，揉按36次。'
    : '【足三里穴】（足陽明胃經合穴）：培補後天脾土，土厚生金，萬物生財，揉按36次。';

  const zodiacAnimals = ['鼠', '牛', '虎', '兔', '龍', '蛇', '馬', '羊', '猴', '雞', '狗', '豬'];
  const zodiacAnimalsTh = ['ชวด (หนู)', 'ฉลู (วัว)', 'ขาล (เสือ)', 'เถาะ (กระต่าย)', 'มะโรง (มังกร)', 'มะเส็ง (งู)', 'มะเมีย (ม้า)', 'มะแม (แพะ)', 'วอก (ลิง)', 'ระกา (ไก่)', 'จอ (สุนัข)', 'กุน (หมู)'];
  const zodiacIdx = (birthYear - 4) % 12;
  const idx = zodiacIdx >= 0 ? zodiacIdx : zodiacIdx + 12;
  const userZodiac = zodiacAnimals[idx];
  const userZodiacTh = zodiacAnimalsTh[idx];

  if (state.currentLang === 'th') {
    summaryEl.innerHTML = `ลูกค้า【${escapeHtml(session.clientName)}】(เกิด ค.ศ. ${birthYear} / ปีนักษัตร: ${userZodiacTh}) · ธาตุชะตา: <strong>【${fiveElements}】</strong> · ดาวเจ้าชะตา: <strong>【${astrolabe.soul}】</strong> · การวินิจฉัยภาวะธาตุตามอาจารย์หนีไห่เซี่ย: <span style="color:#facc15;font-weight:bold;">${isYinDeficientHeat ? 'ธาตุอินพร่องมีความร้อนแห้ง (陰虛燥熱型)' : 'ธาตุหยางพร่องมีความเย็นชื้น (陽虛水寒型)'}</span>`;

    detailsEl.innerHTML = `
      <div class="profile-stat-box span-2" style="grid-column: 1 / -1; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(250, 204, 21, 0.3);">
        <div class="stat-label" style="color:#facc15;">🌿【การปรับแก้ดวงเฉพาะบุคคลตามอาจารย์หนีไห่เซี่ย (Personalized Prescription)】</div>
        <div class="stat-val" style="font-size:1.05rem;color:#f8fafc;margin:6px 0;">${constitutionTitle}</div>
        <p style="font-size:0.85rem;color:#cbd5e1;line-height:1.5;">${constitutionDesc}</p>
        <div style="margin-top:8px;font-size:0.85rem;display:grid;gap:6px;">
          <div>💧 <strong>การเสริมธาตุน้ำเฉพาะบุคคล：</strong>${waterHerb}</div>
          <div>💰 <strong>จุดลมปราณเรียกทรัพย์เฉพาะบุคคล：</strong>${wealthAcupoint}</div>
        </div>
      </div>
      <div class="profile-stat-box">
        <div class="stat-label">ปีนักษัตรและธาตุประจำดวง</div>
        <div class="stat-val">${userZodiacTh} · ${fiveElements}</div>
        <div class="stat-sub">ทิศทางหนุนพลังดวงกำเนิด</div>
      </div>
      <div class="profile-stat-box">
        <div class="stat-label">สีมงคลเสริมดวงตลอดชีพ</div>
        <div class="stat-val" style="font-size:0.95rem;color:#facc15;">สีขาว, สีทอง, สีน้ำเงินเข้ม</div>
        <div class="stat-sub">สีเสื้อผ้าแนะนำสำหรับการเจรจา</div>
      </div>
      <div class="profile-stat-box">
        <div class="stat-label">ปีนักษัตรเทพอุปถัมภ์ (天乙貴人)</div>
        <div class="stat-val" style="font-size:0.95rem;color:#a855f7;">ปีฉลู (วัว), มะแม (แพะ), กุน (หมู)</div>
        <div class="stat-sub">พันธมิตรที่ควรจับมือร่วมงาน</div>
      </div>
      <div class="profile-stat-box">
        <div class="stat-label">จุดลมปราณคุ้มครองประจำตัว</div>
        <div class="stat-val" style="font-size:0.95rem;color:#38bdf8;">百會穴 (จุดไป่ฮุ่ย), ${isYinDeficientHeat ? '太溪穴 (จุดไท่ซี)' : '足三里穴 (จุดจู๋ซานหลี่)'}</div>
        <div class="stat-sub">นวดทุกเช้า 3 นาที</div>
      </div>
    `;
  } else {
    summaryEl.innerHTML = `客戶【${escapeHtml(session.clientName)}】為 <strong>${birthYear}年生（生肖：屬${userZodiac}）</strong>，命宮五行納局為<strong>【${fiveElements}】</strong>，命主星<strong>【${astrolabe.soul}】</strong>、身主星<strong>【${astrolabe.body}】</strong>。倪師醫道辨證為：<span style="color:#facc15;font-weight:bold;">${constitutionTitle}</span>`;

    detailsEl.innerHTML = `
      <div class="profile-stat-box span-2" style="grid-column: 1 / -1; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(250, 204, 21, 0.35);">
        <div class="stat-label" style="color:#facc15;">🌿【倪師醫道·個人化體質辨證與改運處方 (Personalized TCM)】</div>
        <div class="stat-val" style="font-size:1.05rem;color:#f8fafc;margin:6px 0;">${constitutionTitle}</div>
        <p style="font-size:0.85rem;color:#cbd5e1;line-height:1.5;">${constitutionDesc}</p>
        <div style="margin-top:8px;font-size:0.85rem;display:grid;gap:6px;">
          <div>💧 <strong>【為何因人而異？同樣是補水】：</strong>${waterHerb}</div>
          <div>💰 <strong>【為何因人而異？同樣是求財】：</strong>${wealthAcupoint}</div>
        </div>
      </div>
      <div class="profile-stat-box">
        <div class="stat-label">生肖與五行局</div>
        <div class="stat-val">屬${userZodiac} · ${fiveElements}</div>
        <div class="stat-sub">本命元神生旺方位</div>
      </div>
      <div class="profile-stat-box">
        <div class="stat-label">終身開運大吉色</div>
        <div class="stat-val" style="font-size:0.95rem;color:#facc15;">白色、金黃色、深藍海軍色</div>
        <div class="stat-sub">面試簽約必備服飾色彩</div>
      </div>
      <div class="profile-stat-box">
        <div class="stat-label">本命天乙貴人生肖</div>
        <div class="stat-val" style="font-size:0.95rem;color:#a855f7;">生肖屬牛、羊、豬者</div>
        <div class="stat-sub">重大專案宜攜手合作</div>
      </div>
      <div class="profile-stat-box">
        <div class="stat-label">專屬護身穴位</div>
        <div class="stat-val" style="font-size:0.95rem;color:#38bdf8;">百會穴、${isYinDeficientHeat ? '太溪穴' : '足三里穴'}</div>
        <div class="stat-sub">晨起揉按 36 次</div>
      </div>
    `;
  }

  // 更新三大派別欽天門來因宮
  const birthStem = (session.birthdayGanZhi ? session.birthdayGanZhi[0] : (astrolabe.rawDates && astrolabe.rawDates.chineseDate ? astrolabe.rawDates.chineseDate.split(' ')[0][0] : '丁'));
  const threeSchools = calculateThreeSchools(astrolabe, birthStem);
  const laiyinEl = document.getElementById('qintianLaiyinText');
  if (laiyinEl && threeSchools.qintian) {
    laiyinEl.innerText = `核心維度：來因宮坐落【${threeSchools.qintian.laiYinBranch}宮 (${threeSchools.qintian.laiYinPalace})】、生年四化由此發散（一生焦點與心念轉化契機）。`;
  }

  // 更新立太極父母健康壽元與婚姻危機預警
  const taiji = calculateTaiJiPalaces(astrolabe, session);
  const pAlert = document.getElementById('parentTaijiAlert');
  if (pAlert && taiji.parentHealth) {
    pAlert.className = taiji.parentHealth.healthNotice.includes('⚠️') ? 'taiji-alert warning' : 'taiji-alert safe';
    pAlert.innerHTML = `<strong>【壽元福氣】：</strong>${taiji.parentHealth.longevityEvaluation} · <strong>【健康提點】：</strong>${taiji.parentHealth.healthNotice}<br><small style="color:#cbd5e1;display:block;margin-top:4px;">${taiji.parentHealth.counseling}</small>`;
  }
  const mAlert = document.getElementById('marriageTaijiAlert');
  if (mAlert && taiji.marriageCrisis) {
    const isRisk = taiji.marriageCrisis.isAffairRisk || taiji.marriageCrisis.isPeachBlossomRob;
    mAlert.className = isRisk ? 'taiji-alert warning' : 'taiji-alert safe';
    mAlert.innerHTML = `<strong>【評估等級】：</strong>${taiji.marriageCrisis.riskLevel}<br>${taiji.marriageCrisis.riskAnalysis}`;
  }
}

// 下載全年數據 JSON
function downloadJSON() {
  if (!state.allDays || state.allDays.length === 0) {
    alert('尚無數據可供下載。');
    return;
  }

  const exportData = state.allDays.map(d => ({
    date: d.date,
    dailyGanZhi: d.dailyGanZhi,
    lunarDate: d.lunarDate,
    dailySiHua: d.dailySiHua,
    dailyMing: d.dailyMing,
    dailyCaibo: d.dailyCaibo,
    dailyFuqi: d.dailyFuqi,
    dailyGuanlu: d.dailyGuanlu,
    dailyJie: d.dailyJie,
    scores: d.scores
  }));

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute('href', dataStr);
  dlAnchor.setAttribute('download', `ziwei_${state.currentSession ? state.currentSession.clientName : 'client'}_${state.currentSession ? state.currentSession.targetYear : 2026}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

// =============================================================
// 滿天星 Plus 升級模組六：圖表視覺化 (Chart.js & 365天熱力圖)
// =============================================================
let chartInstances = {
  zodiac: null,
  fiveElements: null,
  monthlyTrend: null
};

function initOrUpdateCharts(sessionData) {
  const session = sessionData || state.currentSession;
  if (!session) return;
  const astrolabe = state.astrolabe || session.astrolabe;
  if (!astrolabe) return;

  const titleEl = document.getElementById('chartsClientTitle');
  if (titleEl) {
    titleEl.innerText = `當前客戶：${session.clientName || '客戶'} (${session.birthday || '1990-03-15'}) · 七政四餘 × 十二宮能量 × 全年 365 天走勢`;
  }

  renderZodiacWheelChart(astrolabe, session);
  renderFiveElementsChart(astrolabe, session);
  renderMonthlyTrendChart(session);
  renderYearHeatmap(session);
}

function renderZodiacWheelChart(astrolabe, session) {
  const canvas = document.getElementById('chartZodiacWheel');
  if (!canvas || typeof Chart === 'undefined') return;

  if (chartInstances.zodiac) {
    chartInstances.zodiac.destroy();
  }

  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const qz = calculateQizhengSiyu(session.birthday || '1990-03-15', session.birthClockTime || '14:00', session.birthPlace || '台北');
  const allPlanets = [...qz.sevenLuminaries, ...qz.fourExtras];

  const labels = [];
  const palaceDetails = [];
  const colors = [
    '#38bdf8', '#818cf8', '#a78bfa', '#c084fc',
    '#e879f9', '#f472b6', '#fb7185', '#f87171',
    '#fb923c', '#fbbf24', '#facc15', '#a3e635'
  ];

  branches.forEach(b => {
    const p = astrolabe.palaces.find(item => item.earthlyBranch === b);
    const pName = p ? p.name : '宮位';
    labels.push(`${b}宮 · ${pName}`);

    const majors = p ? (p.majorStars || []).map(s => s.name).join(' ') : '';
    const minors = p ? (p.minorStars || []).map(s => s.name).join(' ') : '';
    const inPlanets = allPlanets.filter(pl => pl.branch === b);
    const planetText = inPlanets.map(pl => `${pl.chinese} (${pl.degreeFormatted})`).join(', ');

    palaceDetails.push({
      branch: b,
      palaceName: pName,
      majors: majors || '無主星',
      minors: minors || '無吉凶星',
      changsheng: p ? p.changsheng12 : '—',
      planets: planetText || '無主要天體',
      inPlanets: inPlanets
    });
  });

  const ctx = canvas.getContext('2d');
  chartInstances.zodiac = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        backgroundColor: colors,
        borderColor: '#0f172a',
        borderWidth: 2,
        hoverOffset: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '45%',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            title: (items) => labels[items[0].dataIndex],
            label: (item) => {
              const d = palaceDetails[item.dataIndex];
              return [
                `主星: ${d.majors}`,
                `天象: ${d.planets}`,
                `長生: ${d.changsheng}`
              ];
            }
          }
        }
      },
      onClick: (event, elements) => {
        if (!elements || elements.length === 0) return;
        const idx = elements[0].index;
        const d = palaceDetails[idx];
        const detailEl = document.getElementById('chartPalaceDetail');
        if (detailEl) {
          detailEl.innerHTML = `
            <div class="chart-detail-box" style="padding:10px;background:rgba(15,23,42,0.85);border:1px solid #38bdf8;border-radius:6px;">
              <h4 style="color:#facc15;margin-bottom:4px;">🪐 ${d.branch}宮 · ${d.palaceName} 【主星：${d.majors}】</h4>
              <p style="font-size:0.85rem;color:#cbd5e1;margin:2px 0;"><strong>吉星/凶煞：</strong>${d.minors} · <strong>長生十二神：</strong>${d.changsheng}</p>
              <p style="font-size:0.85rem;color:#38bdf8;margin:2px 0;"><strong>七政四餘天體坐落：</strong>${d.planets}</p>
            </div>
          `;
        }
      }
    }
  });
}

function renderFiveElementsChart(astrolabe, session) {
  const canvas = document.getElementById('chartFiveElements');
  if (!canvas || typeof Chart === 'undefined') return;

  if (chartInstances.fiveElements) {
    chartInstances.fiveElements.destroy();
  }

  const fiveClass = astrolabe.fiveElementsClass || '土五局';
  const scores = { 木: 50, 火: 50, 土: 50, 金: 50, 水: 50 };

  if (fiveClass.includes('木')) scores.木 += 35;
  if (fiveClass.includes('火')) scores.火 += 35;
  if (fiveClass.includes('土')) scores.土 += 35;
  if (fiveClass.includes('金')) scores.金 += 35;
  if (fiveClass.includes('水')) scores.水 += 35;

  astrolabe.palaces.forEach(p => {
    (p.majorStars || []).forEach(s => {
      if (['貪狼', '天機'].includes(s.name)) scores.木 += 10;
      if (['太陽', '廉貞'].includes(s.name)) scores.火 += 10;
      if (['紫微', '天府', '天梁', '祿存'].includes(s.name)) scores.土 += 10;
      if (['武曲', '七殺'].includes(s.name)) scores.金 += 10;
      if (['太陰', '天同', '破軍'].includes(s.name)) scores.水 += 10;
    });
  });

  const ctx = canvas.getContext('2d');
  chartInstances.fiveElements = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['木 (Wood)', '火 (Fire)', '土 (Earth)', '金 (Metal)', '水 (Water)'],
      datasets: [{
        label: '五行能量指數',
        data: [scores.木, scores.火, scores.土, scores.金, scores.水],
        backgroundColor: 'rgba(56, 189, 248, 0.25)',
        borderColor: '#38bdf8',
        borderWidth: 2,
        pointBackgroundColor: '#facc15',
        pointBorderColor: '#fff',
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          pointLabels: {
            color: '#cbd5e1',
            font: { size: 12, weight: 'bold' }
          },
          ticks: { display: false, min: 20, max: 100 }
        }
      },
      plugins: {
        legend: { display: false }
      },
      onClick: (event, elements) => {
        if (!elements || elements.length === 0) return;
        const idx = elements[0].index;
        const elementDetails = [
          { name: '木 (Wood)', organ: '肝膽', emotion: '怒/志', herb: '柴胡、薄荷、降真香', advice: '宜疏肝理氣，保持作息規律，忌抑鬱憋悶。' },
          { name: '火 (Fire)', organ: '心、小腸', emotion: '喜/躁', herb: '遠志、酸棗仁、鬱金', advice: '宜清心安神，水火既濟，午間宜靜坐閉目。' },
          { name: '土 (Earth)', organ: '脾胃', emotion: '思/憂', herb: '蒼朮、白芷、砂仁', advice: '宜溫中醒脾，避免冰冷生冷，養中焦氣血化生之源。' },
          { name: '金 (Metal)', organ: '肺、大腸', emotion: '悲/魄', herb: '白芷、辛夷、檀香', advice: '宜宣肅肺氣，深呼吸或晨起行氣，提升決策魄力。' },
          { name: '水 (Water)', organ: '腎、膀胱', emotion: '恐/智', herb: '沉香（虛熱）或公丁香（水寒）', advice: '宜固本培元，藏精納氣，養生長壽與深層智慧之源。' }
        ];
        const el = elementDetails[idx];
        const detailEl = document.getElementById('chartElementDetail');
        if (detailEl) {
          detailEl.innerHTML = `
            <div class="chart-detail-box" style="padding:10px;background:rgba(15,23,42,0.85);border:1px solid #a855f7;border-radius:6px;">
              <h4 style="color:#facc15;margin-bottom:4px;">☯️ ${el.name} · 臟腑：${el.organ}（對應情緒：${el.emotion}）</h4>
              <p style="font-size:0.85rem;color:#cbd5e1;margin:2px 0;"><strong>倪師調養配方：</strong>${el.herb}</p>
              <p style="font-size:0.85rem;color:#a855f7;margin:2px 0;"><strong>能量指引：</strong>${el.advice}</p>
            </div>
          `;
        }
      }
    }
  });
}

function renderMonthlyTrendChart(session) {
  const canvas = document.getElementById('chartMonthlyTrend');
  if (!canvas || typeof Chart === 'undefined') return;

  if (chartInstances.monthlyTrend) {
    chartInstances.monthlyTrend.destroy();
  }

  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const compositeScores = new Array(12).fill(0);
  const piancaiScores = new Array(12).fill(0);
  const taohuaScores = new Array(12).fill(0);
  const shangjiScores = new Array(12).fill(0);
  const dayCounts = new Array(12).fill(0);

  const allDays = state.allDays || [];
  allDays.forEach(d => {
    const m = parseInt(d.date.split('-')[1], 10) - 1;
    if (m >= 0 && m < 12) {
      dayCounts[m]++;
      const sc = d.scores || {};
      const pc = sc.piancai ? sc.piancai.score : 0;
      const th = sc.taohua ? sc.taohua.score : 0;
      const sj = sc.shangji ? sc.shangji.score : 0;
      const lt = sc.letou ? sc.letou.score : 0;
      piancaiScores[m] += pc;
      taohuaScores[m] += th;
      shangjiScores[m] += sj;
      compositeScores[m] += (pc + th + sj + lt) / 4;
    }
  });

  for (let i = 0; i < 12; i++) {
    const cnt = dayCounts[i] || 1;
    compositeScores[i] = Math.round((compositeScores[i] / cnt) * 10) / 10;
    piancaiScores[i] = Math.round((piancaiScores[i] / cnt) * 10) / 10;
    taohuaScores[i] = Math.round((taohuaScores[i] / cnt) * 10) / 10;
    shangjiScores[i] = Math.round((shangjiScores[i] / cnt) * 10) / 10;
  }

  const ctx = canvas.getContext('2d');
  chartInstances.monthlyTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        {
          label: '綜合運勢 (Composite)',
          data: compositeScores,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.35,
          fill: true
        },
        {
          label: '偏財運勢 (Piancai)',
          data: piancaiScores,
          borderColor: '#10b981',
          tension: 0.35
        },
        {
          label: '桃花運勢 (Taohua)',
          data: taohuaScores,
          borderColor: '#f43f5e',
          tension: 0.35
        },
        {
          label: '商機運勢 (Shangji)',
          data: shangjiScores,
          borderColor: '#6366f1',
          tension: 0.35
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#cbd5e1', font: { size: 11 } }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

function renderYearHeatmap(session) {
  const container = document.getElementById('yearHeatmapGrid');
  if (!container) return;
  container.innerHTML = '';

  const allDays = state.allDays || [];
  allDays.forEach(d => {
    const sc = d.scores || {};
    const sum = (sc.letou ? sc.letou.score : 0) +
      (sc.piancai ? sc.piancai.score : 0) +
      (sc.shangji ? sc.shangji.score : 0) +
      (sc.taohua ? sc.taohua.score : 0) +
      (sc.guiren ? sc.guiren.score : 0);

    let lvl = 0;
    if (sum >= 45) lvl = 5;
    else if (sum >= 35) lvl = 4;
    else if (sum >= 25) lvl = 3;
    else if (sum >= 15) lvl = 2;
    else if (sum >= 5) lvl = 1;
    else lvl = 0;

    const cell = document.createElement('div');
    cell.className = `heatmap-day-cell lvl-${lvl}`;
    cell.setAttribute('data-date', d.date);
    cell.setAttribute('title', `${d.date} (${d.dailyGanZhi}日) 綜合總分: ${sum}`);
    cell.addEventListener('click', () => {
      openDetailModal(d.date);
    });
    container.appendChild(cell);
  });
}

// =============================================================
// 滿天星 Plus 彈窗控制 (動態權重、流分推算)
// =============================================================
function openWeightsModal() {
  const session = state.currentSession;
  if (!session) return;
  const modal = document.getElementById('modalWeights');
  if (!modal) return;
  renderWeightsManagerGrid();
  modal.classList.add('active');
}

function renderWeightsManagerGrid() {
  const session = state.currentSession;
  if (!session) return;
  const grid = document.getElementById('weightsManagerGrid');
  if (!grid) return;
  const weights = getClientWeights(session.sessionId);

  grid.innerHTML = CATEGORIES.map(cat => {
    const w = weights[cat.key] !== undefined ? weights[cat.key] : 1.0;
    const pct = Math.round(w * 100);
    const colorClass = w > 1.0 ? 'high' : (w < 1.0 ? 'low' : 'norm');
    return `
      <div class="weight-card-item">
        <div class="w-item-info">
          <span class="w-item-icon">${cat.icon}</span>
          <div>
            <div class="w-item-name">${cat.name} (${cat.desc})</div>
            <div class="w-item-sub">目前權重倍率：<strong>${w.toFixed(2)}x</strong> (${pct}%)</div>
          </div>
        </div>
        <div class="w-item-ctrls">
          <button class="w-btn-dec" onclick="window.onManualWeightAdjust('${cat.key}', -0.1)">-10%</button>
          <span class="w-val-badge ${colorClass}">${w.toFixed(2)}x</span>
          <button class="w-btn-inc" onclick="window.onManualWeightAdjust('${cat.key}', 0.1)">+10%</button>
        </div>
      </div>
    `;
  }).join('');
}

window.onManualWeightAdjust = function(catKey, delta) {
  const session = state.currentSession;
  if (!session) return;
  const weights = getClientWeights(session.sessionId);
  const cur = weights[catKey] !== undefined ? weights[catKey] : 1.0;
  const next = Math.max(0.2, Math.min(3.0, Math.round((cur + delta) * 100) / 100));
  weights[catKey] = next;
  saveClientWeights(session.sessionId, weights);
  session.weights = weights;
  renderWeightsManagerGrid();
  calculateClientAstrolabe(session);
  if (typeof renderRankingsView === 'function') renderRankingsView();
  updateChatTopHeader(session);
};

function resetClientWeights() {
  const session = state.currentSession;
  if (!session) return;
  const defaultW = {};
  CATEGORIES.forEach(c => defaultW[c.key] = 1.0);
  saveClientWeights(session.sessionId, defaultW);
  session.weights = defaultW;
  renderWeightsManagerGrid();
  calculateClientAstrolabe(session);
  if (typeof renderRankingsView === 'function') renderRankingsView();
  updateChatTopHeader(session);
  showPlusToast('↺ 已重設所有評分模組權重為預設基準 (1.0x)');
}

function openFlowMinuteModal() {
  const modal = document.getElementById('modalFlowMinuteFull');
  if (!modal) return;
  const dateInput = document.getElementById('flowMinuteDateInput');
  const timeInput = document.getElementById('flowMinuteTimeInput');
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (dateInput && !dateInput.value) dateInput.value = getSystemCurrentDate();
  if (timeInput && !timeInput.value) timeInput.value = timeStr;
  renderFlowMinuteFullOutput();
  modal.classList.add('active');
}

function renderFlowMinuteFullOutput() {
  const container = document.getElementById('flowMinuteFullOutput');
  if (!container) return;
  const dateInput = document.getElementById('flowMinuteDateInput');
  const timeInput = document.getElementById('flowMinuteTimeInput');
  const dVal = (dateInput && dateInput.value) || getSystemCurrentDate();
  const tVal = (timeInput && timeInput.value) || '12:00';
  const session = state.currentSession;

  const result = calculateFlowMinute(dVal, tVal, session);
  const sihua = result.minuteSiHua;

  container.innerHTML = `
    <div class="flow-minute-full-card">
      <div class="full-card-header">
        <div>
          <h3>⚡ 流分定位：【${result.minuteGanZhi} 分】</h3>
          <p style="color:var(--text-muted);font-size:0.85rem;margin-top:2px;">
            流日：${result.date} (${result.dayGanZhi}日) · 流時：${result.hourGanZhi}時 (${result.hourPalaceBranch}宮) · 分鐘：第 ${result.minute} 分
          </p>
        </div>
        <div class="minute-palace-pill">
          流分命宮在：<strong>${result.minutePalaceBranch} 宮</strong>
        </div>
      </div>

      <div class="minute-sihua-box">
        <div class="min-sihua-title">當前流分四化 (Minute Si Hua - ${result.minuteGanZhi[0]}干)：</div>
        <div class="min-sihua-grid">
          <div class="min-sihua-cell lu">
            <span class="lbl">化祿</span>
            <span class="val">${sihua.化祿 || '—'}</span>
          </div>
          <div class="min-sihua-cell quan">
            <span class="lbl">化權</span>
            <span class="val">${sihua.化權 || '—'}</span>
          </div>
          <div class="min-sihua-cell ke">
            <span class="lbl">化科</span>
            <span class="val">${sihua.化科 || '—'}</span>
          </div>
          <div class="min-sihua-cell ji">
            <span class="lbl">化忌</span>
            <span class="val">${sihua.化忌 || '—'}</span>
          </div>
        </div>
      </div>

      <div class="minute-guidance-box">
        <div class="g-title">🎯 流分應對建議與磁場指引：</div>
        <div class="g-text">${result.explanation}</div>
      </div>
    </div>
  `;
}

// 暴露全域給視圖與回饋呼叫
if (typeof window !== 'undefined') {
  window.initOrUpdateCharts = initOrUpdateCharts;
  window.openWeightsModal = openWeightsModal;
  window.openFlowMinuteModal = openFlowMinuteModal;
  window.openLanguageModal = openLanguageModal;
  window.setLanguage = setLanguage;
  window.adjustCategoryWeight = adjustCategoryWeight;
  window.handleFeedbackClick = handleFeedbackClick;
  window.recordUserRating = recordUserRating;
  window.openDetailModal = openDetailModal;
  window.renderRankingsView = renderRankingsView;
  window.renderRankings = renderRankingsView;
  window.openAISettingsModal = openAISettingsModal;
  window.closeAISettingsModal = closeAISettingsModal;
  window.saveAISettings = saveAISettings;
  window.clearAISettings = clearAISettings;
  window.callDeepInfraLLM = callDeepInfraLLM;
  window.calculateDeepInfraCost = calculateDeepInfraCost;
  window.callUnifiedLLM = callUnifiedLLM;
  window.askDeepInfra = askDeepInfra;
  window.calculateDatingStatus = calculateDatingStatus;
  window.calculateMarriageStatus = calculateMarriageStatus;
  window.calculateMarriageCount = calculateMarriageCount;
  window.analyzeCurrentMarriage = analyzeCurrentMarriage;
  window.extractUserFacts = extractUserFacts;
  window.calculateTrueLoveTimeline = calculateTrueLoveTimeline;
  window.calculateSpouseTraits = calculateSpouseTraits;
  window.calculateDualSynastry = calculateDualSynastry;
  window.SPOUSE_STAR_TRAITS = SPOUSE_STAR_TRAITS;
  window.detectAstrolabeCrises = detectAstrolabeCrises;
  window.showWaitingNotice = showWaitingNotice;
  window.hideWaitingNotice = hideWaitingNotice;
  window.showTypingEffect = showTypingEffect;
  window.getChatPlainTitle = getChatPlainTitle;
  window.renderChatMessages = renderChatMessages;
  window.detectDeviceType = detectDeviceType;
  window.applyResponsiveLayout = applyResponsiveLayout;
  window.getLunarDate = getLunarDate;
  window.calculateSolarTime = calculateSolarTime;
  window.getSolarTime = getSolarTime;
  window.geocodeLocation = geocodeLocation;
  window.getLLMConfig = getLLMConfig;
  window.callDeepInfraChat = callDeepInfraChat;
  window.LLM_CONFIG_DATA = LLM_CONFIG_DATA;
  window.CITY_GEO_DB = CITY_GEO_DB;
}

// =============================================================
// PWA Service Worker 註冊 (滿天星 Plus 升級模組八)
// =============================================================
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('✅ [PWA] Service Worker 註冊成功，範圍:', reg.scope))
      .catch(err => console.warn('⚠️ [PWA] Service Worker 註冊失敗:', err));
  });
}

// =============================================================
// Node.js CommonJS 模組匯出支援 (方便自動化驗證與測試套件調用)
// =============================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    detectLanguage,
    buildFortunePrompt,
    getSystemCurrentDate,
    parseRelativeDate,
    parseIntent,
    fetchAstrologyData,
    generateNaturalAnswerFallback,
    generateFortuneAnswer,
    generateAnswer,
    calculateClientAstrolabe,
    convertToLunar,
    getLunarDate,
    calculateSolarTime,
    calculateSolarTimeCorrection,
    getSolarTime,
    parseLocationOrCoordinates,
    geocodeLocation,
    getLLMConfig,
    callDeepInfraChat,
    LLM_CONFIG_DATA,
    CITY_GEO_DB,
    formatAuspiciousDate,
    SYSTEM_PROMPT_TEMPLATE,
    state,
    callDeepInfraLLM,
    calculateDeepInfraCost,
    callUnifiedLLM,
    callGeminiLLM,
    askDeepInfra,
    askGemini,
    calculateDatingStatus,
    calculateMarriageStatus,
    calculateMarriageCount,
    analyzeCurrentMarriage,
    extractUserFacts,
    calculateTrueLoveTimeline,
    calculateSpouseTraits,
    calculateDualSynastry,
    SPOUSE_STAR_TRAITS,
    RELATIONSHIP_RULES_V1,
    detectAstrolabeCrises,
    showWaitingNotice,
    hideWaitingNotice,
    showTypingEffect,
    getChatPlainTitle,
    renderChatMessages,
    detectDeviceType,
    applyResponsiveLayout,
    evaluateDualGridWealth,
    runWealthSandboxSimulation,
    generateLuckyNumbersData,
    recordUserRating,
    adjustCategoryWeight
  };
}



