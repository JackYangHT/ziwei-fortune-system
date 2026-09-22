const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
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

  // 預設為台北
  return { name: s || '台北', lon: 121.50, lat: 25.03, tz: 8, centralMeridian: 120, isCustomCoords: false };
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

  // API 路由 1: /api/solar-time
  if (pathname === '/api/solar-time') {
    const q = parsedUrl.query;
    const birthday = q.birthday || '1990-03-15';
    const clockTime = q.time || '14:00';
    const place = q.place || '台北';

    try {
      const result = calculateSolarTime(birthday, clockTime, place);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API 路由 2: /api/geocode
  if (pathname === '/api/geocode') {
    const q = parsedUrl.query;
    const query = q.query || q.place || '台北';
    try {
      const geo = parseLocationOrCoordinates(query);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, location: geo }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 靜態檔案服務
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(PUBLIC_DIR, pathname);
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
  checkSolarTermCrossing
};
