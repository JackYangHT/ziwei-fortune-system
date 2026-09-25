const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 全域自定義環境與 iztro 引擎初始化
global.self = global;
let iztro;
try {
  iztro = require('./iztro.min.js');
} catch (e) {
  try {
    iztro = require(path.join(__dirname, 'iztro.min.js'));
  } catch (e2) {}
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function convertToLunar(solarDate) {
  const d = new Date(solarDate + 'T00:00:00');
  const weekday = WEEKDAYS[d.getDay()];
  let lunar = '';
  let ganzhi = '';
  const iz = iztro || (typeof global !== 'undefined' ? global.iztro : null);
  if (iz && iz.astro && iz.astro.bySolar) {
    try {
      const ast = iz.astro.bySolar(solarDate, 0, '男', true);
      lunar = (ast && ast.lunarDate) ? ast.lunarDate.replace(/^.*?年/, '') : '';
      ganzhi = (ast && ast.rawDates && ast.rawDates.chineseDate && ast.rawDates.chineseDate.daily)
        ? ast.rawDates.chineseDate.daily.join('')
        : '';
    } catch (e) {
      console.warn('convertToLunar error:', e.message);
    }
  }
  return {
    solar: solarDate,
    lunar,
    ganzhi,
    weekday
  };
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// =========================================================================
// 常用城市經緯度與時區資料庫 (涵蓋台灣、港澳、東南亞、中國大陸與全球主要城市)
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
  '泰國': { name: '泰國', lon: 100.50, lat: 13.75, tz: 7, country: 'TH' },
  'Thailand': { name: '泰國', lon: 100.50, lat: 13.75, tz: 7, country: 'TH' },
  '曼谷': { name: '曼谷', lon: 100.50, lat: 13.75, tz: 7, country: 'TH' },
  'Bangkok': { name: '曼谷', lon: 100.50, lat: 13.75, tz: 7, country: 'TH' },
  '清邁': { name: '清邁', lon: 98.98, lat: 18.79, tz: 7, country: 'TH' },
  'Chiang Mai': { name: '清邁', lon: 98.98, lat: 18.79, tz: 7, country: 'TH' },
  '普吉': { name: '普吉', lon: 98.39, lat: 7.88, tz: 7, country: 'TH' },
  'Phuket': { name: '普吉', lon: 98.39, lat: 7.88, tz: 7, country: 'TH' },
  '芭達雅': { name: '芭達雅', lon: 100.88, lat: 12.92, tz: 7, country: 'TH' },
  'Pattaya': { name: '芭達雅', lon: 100.88, lat: 12.92, tz: 7, country: 'TH' },
  'ไทย': { name: '泰國', lon: 100.50, lat: 13.75, tz: 7, country: 'TH' },
  'ประเทศไทย': { name: '泰國', lon: 100.50, lat: 13.75, tz: 7, country: 'TH' },
  'กรุงเทพ': { name: '曼谷', lon: 100.50, lat: 13.75, tz: 7, country: 'TH' },
  'กรุงเทพมหานคร': { name: '曼谷', lon: 100.50, lat: 13.75, tz: 7, country: 'TH' },
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

/**
 * 解析使用者輸入之出生地或經緯度
 */
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
    // 若經度在第二位（常見於緯度, 經度輸入習慣）
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

  // 3. 字典完全匹配優先 (case-insensitive)
  const lowerInput = s.toLowerCase();
  for (const key in CITY_GEO_DB) {
    if (key.toLowerCase() === lowerInput) {
      const c = CITY_GEO_DB[key];
      const res = {
        name: c.name,
        lon: c.lon,
        lat: c.lat,
        tz: c.tz,
        centralMeridian: c.tz * 15,
        isCustomCoords: false,
        notFound: false
      };
      console.log(`✅ [地理編碼結果] 精確匹配城市 "${key}":`, res);
      return res;
    }
  }

  // 4. 字典包含匹配 (如「泰國曼谷」匹配「泰國」或「曼谷」；「曼谷市」匹配「曼谷」)
  for (const key in CITY_GEO_DB) {
    const lowerKey = key.toLowerCase();
    if (lowerInput.includes(lowerKey) || (lowerInput.length >= 2 && lowerKey.includes(lowerInput))) {
      const c = CITY_GEO_DB[key];
      const res = {
        name: c.name,
        lon: c.lon,
        lat: c.lat,
        tz: c.tz,
        centralMeridian: c.tz * 15,
        isCustomCoords: false,
        notFound: false
      };
      console.log(`✅ [地理編碼結果] 模糊匹配城市 "${key}":`, res);
      return res;
    }
  }

  // 5. 若城市名稱不在資料庫中，顯示「找不到該城市，請輸入經緯度」，不要用預設值（如台北）代替
  console.warn(`⚠️ [地理編碼結果] 找不到該城市「${s}」，請輸入經緯度`);
  return {
    name: '找不到該城市，請輸入經緯度',
    query: s,
    error: '找不到該城市，請輸入經緯度',
    lon: null,
    lat: null,
    tz: null,
    centralMeridian: null,
    isCustomCoords: false,
    notFound: true
  };
}

// 取得年積日 (Day of Year)
function getDayOfYear(year, month, day) {
  const start = new Date(Date.UTC(year, 0, 1));
  const target = new Date(Date.UTC(year, month - 1, day));
  return Math.floor((target - start) / 86400000) + 1;
}

// NOAA 天文均時差公式 (Equation of Time, EOT)
function calculateEOT(year, month, day, hour = 12) {
  const d = getDayOfYear(year, month, day);
  const gamma = (2 * Math.PI / 365) * (d - 1 + (hour - 12) / 24);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  return eqtime;
}

// 時辰對照
const SHICHEN_NAMES = [
  '早子時 (00:00-01:00)', '丑時 (01:00-03:00)', '寅時 (03:00-05:00)',
  '卯時 (05:00-07:00)', '辰時 (07:00-09:00)', '巳時 (09:00-11:00)',
  '午時 (11:00-13:00)', '未時 (13:00-15:00)', '申時 (15:00-17:00)',
  '酉時 (17:00-19:00)', '戌時 (19:00-21:00)', '亥時 (21:00-23:00)',
  '晚子時 (23:00-24:00)'
];

const SHICHEN_SHORT = ['早子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '晚子'];

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

// 二十四節氣定義 (太陽黃經角度)
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

    // 若在交接前後 120 分鐘 (2 小時) 內
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

/**
 * 完整真太陽時推算演算法
 */
function calculateSolarTime(birthday, clockTimeStr, placeStr) {
  const geo = parseLocationOrCoordinates(placeStr);
  const [y, m, d] = (birthday || '1990-03-15').split('-').map(Number);
  const timeParts = (clockTimeStr || '14:00').split(':').map(Number);
  const h = timeParts[0] || 0;
  const min = timeParts[1] || 0;

  const centralMeridian = geo.centralMeridian;
  const geoOffset = 4 * (geo.lon - centralMeridian); // 分鐘
  const eot = calculateEOT(y, m, d, h); // 分鐘
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

  // 時辰交界檢查 (前後 15 分鐘)
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

  // 節氣交接檢查 (前後 2 小時)
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
// 滿天星 Plus 升級模組一：七政四餘天象推算引擎
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

/**
 * 七政四餘天文星曆推算函式
 * @param {number} year 西元年
 * @param {number} month 月份 (1-12)
 * @param {number} day 日期 (1-31)
 * @param {number} hour 小時 (0-23)
 * @param {number} minute 分鐘 (0-59)
 * @param {number} tz 時區偏移 (UTC+, 例如 8, 泰國為 7)
 */
function calculateQizhengSiyu(yearOrBirthday, monthOrTime = 12, dayOrPlace = 1, hour = 12, minute = 0, tz = 8) {
  let year, month, day;
  if (typeof yearOrBirthday === 'string' && yearOrBirthday.includes('-')) {
    const parts = yearOrBirthday.split('-').map(Number);
    year = parts[0];
    month = parts[1];
    day = parts[2];
    if (typeof monthOrTime === 'string' && monthOrTime.includes(':')) {
      const tparts = monthOrTime.split(':').map(Number);
      hour = tparts[0];
      minute = tparts[1] || 0;
    }
    const place = dayOrPlace || '台北';
    tz = CITY_GEO_DB[place] ? CITY_GEO_DB[place].tz : 8;
  } else {
    year = Number(yearOrBirthday) || 1990;
    month = Number(monthOrTime) || 3;
    day = Number(dayOrPlace) || 15;
  }

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
  // 羅睺 (Rahu): 黃白升交點 (逆行，週期約 18.61 年)
  const rahuLon = normalizeDeg(125.04452 - 1934.136261 * T + 0.0020708 * T * T);
  // 計都 (Ketu): 降交點 (對衝羅睺 180 度)
  const ketuLon = normalizeDeg(rahuLon + 180);
  // 月孛 (Yuebo / Lilith): 月球遠地點 (順行，週期約 8.85 年)
  const yueboLon = normalizeDeg(83.35324 + 4069.0137287 * T - 0.01032 * T * T);
  // 紫氣 (Ziqi): 果老星宗廿八宿順行虛星 (週期 28 年)
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
    sevenLuminaries: [
      results.sun, results.moon, results.wood, results.fire, results.earth, results.metal, results.water
    ],
    fourExtras: [
      results.ziqi, results.yuebo, results.rahu, results.ketu
    ],
    planetaryBodies: results,
    palaceDistribution,
    countSeven: 7,
    countFour: 4
  };
}

// =========================================================================
// 滿天星 Plus 升級模組二：流分推算引擎
// =========================================================================
const STEMS_LIST = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES_LIST = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function getStemByWuShuDunRule(leaderStem, branchIdx) {
  const startStemMap = { '甲': 2, '己': 2, '乙': 4, '庚': 4, '丙': 6, '辛': 6, '丁': 8, '壬': 8, '戊': 0, '癸': 0 };
  const startStemIdx = startStemMap[leaderStem] !== undefined ? startStemMap[leaderStem] : 0;
  return STEMS_LIST[(startStemIdx + branchIdx) % 10];
}

const SIHUA_LOOKUP = {
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

/**
 * 流分推算函式 (支援字串日期時間與干支兩種呼叫簽名)
 */
function calculateFlowMinute(flowDayBranchOrDate = '子', flowDayStemOrTime = '甲', hourOrSession = 12, minuteParam = 0) {
  let flowDayBranch = flowDayBranchOrDate;
  let flowDayStem = flowDayStemOrTime;
  let hour = typeof hourOrSession === 'number' ? hourOrSession : 12;
  let minute = typeof minuteParam === 'number' ? minuteParam : 0;

  if (typeof flowDayBranchOrDate === 'string' && flowDayBranchOrDate.includes('-')) {
    if (typeof flowDayStemOrTime === 'string' && flowDayStemOrTime.includes(':')) {
      const parts = flowDayStemOrTime.split(':').map(Number);
      hour = parts[0];
      minute = parts[1] || 0;
    }
    const dObj = new Date(flowDayBranchOrDate + 'T00:00:00');
    const dayOffset = Math.floor((dObj.getTime() - new Date('2026-01-01T00:00:00').getTime()) / 86400000);
    const stemIdx = (1 + (dayOffset % 10) + 10) % 10;
    const branchIdx = (7 + (dayOffset % 12) + 12) % 12;
    flowDayStem = STEMS_LIST[stemIdx];
    flowDayBranch = BRANCHES_LIST[branchIdx];
  }

  const hourBranchIdx = Math.floor((hour + 1) / 2) % 12;
  const hourBranch = BRANCHES_LIST[hourBranchIdx];
  const hourStem = getStemByWuShuDunRule(flowDayStem, hourBranchIdx);
  const hourGanZhi = hourStem + hourBranch;

  // 流時命宮: 從流日命宮起流日子時，順數至該時辰
  const dayBranchIdx = Math.max(0, BRANCHES_LIST.indexOf(flowDayBranch));
  const hourPalaceIdx = (dayBranchIdx + hourBranchIdx) % 12;
  const hourPalaceBranch = BRANCHES_LIST[hourPalaceIdx];

  // 流分命宮: 從流時命宮起，順數至該分鐘 (minute 0-59)
  const minutePalaceIdx = (hourPalaceIdx + minute) % 12;
  const minutePalaceBranch = BRANCHES_LIST[minutePalaceIdx];

  // 流分干支: 以時干五鼠遁起分干，配分宮地支
  const minuteStem = getStemByWuShuDunRule(hourStem, minute % 12);
  const minuteGanZhi = minuteStem + minutePalaceBranch;

  // 流分四化
  const minuteSihua = SIHUA_LOOKUP[minuteStem] || { lu: '太陽', quan: '武曲', ke: '太陰', ji: '天同' };

  // 該分鐘決策建議
  let advice = '';
  if (minuteSihua.lu === '祿存' || minuteSihua.lu === '武曲' || minuteSihua.lu === '太陰') {
    advice = '此分鐘逢正財化祿能量，極利於急件簽約、投資下單或轉帳結算。';
  } else if (minuteSihua.ji === '廉貞' || minuteSihua.ji === '太陽' || minuteSihua.ji === '天機') {
    advice = '此分鐘化忌引動思慮干擾，重要訊息傳送前宜沉澱三思，忌衝動決定。';
  } else {
    advice = '此分鐘四化氣場平穩和諧，宜按部就班推進各項事務。';
  }

  return {
    date: typeof flowDayBranchOrDate === 'string' && flowDayBranchOrDate.includes('-') ? flowDayBranchOrDate : '當日',
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    minute: minute,
    dayGanZhi: flowDayStem + flowDayBranch,
    hourGanZhi: hourGanZhi,
    hourPalaceBranch: hourPalaceBranch,
    minuteGanZhi: minuteGanZhi,
    minutePalaceBranch: minutePalaceBranch,
    minuteSiHua: {
      化祿: minuteSihua.lu,
      化權: minuteSihua.quan,
      化科: minuteSihua.ke,
      化忌: minuteSihua.ji
    },
    hour: {
      ganzhi: hourGanZhi,
      palace: `${hourPalaceBranch}宮`,
      branch: hourBranch,
      stem: hourStem
    },
    explanation: advice
  };
}

// =========================================================================
// 模組一：倪海廈《天紀》與《人紀》三才全息架構
// =========================================================================
function calculateSanCaiFramework(session = {}) {
  const bday = session.birthday || '1977-07-26';
  const place = session.birthPlace || '曼谷';
  const name = session.clientName || '客戶';
  const fiveElements = (session.astrolabe && session.astrolabe.fiveElementsClass) || '金四局';
  const soul = (session.astrolabe && session.astrolabe.soul) || '文曲';
  const body = (session.astrolabe && session.astrolabe.body) || '文昌';

  return {
    title: '倪海廈《天紀》與《人紀》天·地·人三才全息架構',
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
// HTTP 伺服器
// =========================================================================
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // CORS 支援
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }


  // API 路由 3: /api/qizheng (滿天星 Plus 七政四餘)
  if (pathname === '/api/qizheng') {
    const q = parsedUrl.query;
    const birthday = q.birthday || '1977-07-26';
    const timeStr = q.time || '08:00';
    const place = q.place || '曼谷';
    const tz = q.tz ? parseFloat(q.tz) : (CITY_GEO_DB[place] ? CITY_GEO_DB[place].tz : 8);

    try {
      const parts = birthday.split('-').map(Number);
      const tparts = timeStr.split(':').map(Number);
      const result = calculateQizhengSiyu(parts[0], parts[1], parts[2], tparts[0], tparts[1], tz);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, birthday, time: timeStr, place, timezone: tz, ...result }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API 路由 4: /api/flow-minute (滿天星 Plus 流分推算)
  if (pathname === '/api/flow-minute') {
    const q = parsedUrl.query;
    const dayBranch = q.dayBranch || '辰';
    const dayStem = q.dayStem || '庚';
    const timeStr = q.time || `${new Date().getHours()}:${new Date().getMinutes()}`;
    const tparts = timeStr.split(':').map(Number);

    try {
      const result = calculateFlowMinute(dayBranch, dayStem, tparts[0], tparts[1]);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, dayBranch, dayStem, ...result }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API 路由 5: /api/sancai (倪海廈天地人三才與中醫五味)
  if (pathname === '/api/sancai') {
    const q = parsedUrl.query;
    const session = {
      birthday: q.birthday || '1977-07-26',
      birthPlace: q.place || '曼谷',
      clientName: q.name || '客戶'
    };
    try {
      const sancai = calculateSanCaiFramework(session);
      const tcm = calculateNiTcmFramework(session);
      const harmMitigation = getHarmMitigationGuidance();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, sancai, tcm, harmMitigation }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API 路由 6: /api/taiji (立太極父母健康壽元與婚姻危機)
  if (pathname === '/api/taiji') {
    const q = parsedUrl.query;
    const birthStem = q.birthStem || '丁';
    try {
      const taiji = calculateTaiJiPalaces(null, { birthStem });
      const threeSchools = calculateThreeSchools(null, birthStem);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, taiji, threeSchools }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API 路由 7: /api/iching (易經起卦與河圖五行生成數)
  if (pathname === '/api/iching') {
    const q = parsedUrl.query;
    const dateStr = q.date || '2026-09-23';
    const timeStr = q.time || '12:00';
    try {
      const result = calculateIChingAndNumerology(dateStr, timeStr);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, date: dateStr, time: timeStr, ...result }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API 路由 8: /api/peach-blossom (桃花煞判斷與風水斬桃花)
  if (pathname === '/api/peach-blossom') {
    const q = parsedUrl.query;
    const dailyGanZhi = q.dailyGanZhi || '庚辰';
    try {
      const result = calculatePeachBlossomSha({ dailyGanZhi });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, dailyGanZhi, ...result }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API 路由 9: /api/investment (投資理財財帛田宅聯動)
  if (pathname === '/api/investment') {
    try {
      const result = calculateInvestmentLinkage({}, {});
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API 路由 10: /api/2026-sihua (2026 丙午年四化)
  if (pathname === '/api/2026-sihua') {
    try {
      const result = calculate2026BingWuSiHua();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API 路由 11: /api/harm-mitigation (趨吉避凶哲學與主動佈局)
  if (pathname === '/api/harm-mitigation') {
    try {
      const result = getHarmMitigationGuidance();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }


  // 靜態檔案服務與後台路由
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin' || pathname === '/admin/') pathname = '/admin.html';
  let filePath = path.join(PUBLIC_DIR, pathname);
  if (pathname === '/admin.html' && !fs.existsSync(filePath)) {
    const parentAdmin = path.join(__dirname, '..', 'admin.html');
    if (fs.existsSync(parentAdmin)) {
      filePath = parentAdmin;
    }
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(content);
    }
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Open http://localhost:${PORT}/ in your browser to use the Zi Wei Dou Shu system with True Solar Time.`);
  });
}

module.exports = {
  CITY_GEO_DB,
  parseLocationOrCoordinates,
  calculateEOT,
  calculateSolarTime,
  checkSolarTermCrossing,
  calculateQizhengSiyu,
  calculateFlowMinute,
  calculateSanCaiFramework,
  calculateNiTcmFramework,
  calculateThreeSchools,
  calculateTaiJiPalaces,
  calculate2026BingWuSiHua,
  calculateIChingAndNumerology,
  calculatePeachBlossomSha,
  calculateInvestmentLinkage,
  getHarmMitigationGuidance,
  convertToLunar
};
