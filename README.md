# 紫微斗數流日命理運算系統

結合 iztro 排盤引擎、Gemini LLM 自然語言理解、倪海廈天紀改運體系的完整命理運算系統。

---

## 專案簡介

這是一套「知命 → 造命 → 修命」的完整命理系統，包含：

- **排盤引擎**：八字四柱 + 紫微斗數十二宮方盤，精準推算本命、大限、流年、流月、流日。
- **評分引擎**：偏財日、桃花日、肉慾日、貴人日、事業日、健康日、樂透運、巨大商機日等全年 365 天精算排行。
- **LLM 對話**：Google Gemini 意圖解析 + 自然語言生成，跳脫死板模板，以現代自然語調精準解盤。
- **倪師改運**：結合倪海廈天紀中醫與陽宅學，提供中藥聞香、穴位按摩、地脈道空間佈局。
- **多聊天室**：每個客戶獨立記憶與排盤隔離，支援多客戶同時諮詢，不互相干擾。
- **中泰雙語**：支援繁體中文（zh-TW）與泰文（th）無縫即時切換。

---

## 核心功能

### 1. 真太陽時校正 (True Solar Time)
- **地理時差計算**：$4 \times (\text{當地經度} - \text{時區中央經線})$ 分鐘。支援全球主要城市名稱或經緯度（如 `121.5, 25.0`）。
- **均時差計算**：採用 NOAA 太陽公轉軌道均差公式精確推算（範圍約 $\pm 16$ 分鐘）。
- **真太陽時排盤**：排盤時辰嚴格基於真太陽時（鐘錶時間 + 地理時差 + 均時差），跨日自動轉換。
- **時辰邊界預警**：真太陽時若落在時辰交界前後 15 分鐘以內，系統自動排定前後雙時辰命盤、對照格局差異並提醒確認出生時間。
- **節氣交節校正**：內建 24 節氣太陽黃經天文交節時刻計算，前後 2 小時精算是否跨越交節（影響年柱、八字月柱與節氣分野）。

### 2. 七大運勢評分 (Daily Fortune Rankings)
- **偏財日**：財帛宮化祿、祿存、天馬、貪狼、破軍、武曲等星曜加權。
- **桃花日**：紅鸞、天喜、貪狼、廉貞、天姚星曜交會。
- **肉慾日**：貪狼+咸池、天姚、沐浴、廉貞貪狼桃花星曜組合。
- **貴人日**：天魁、天鉞、左輔、右弼、流日化科等相助星曜。
- **事業日**：官祿宮化權、化科、紫微、天府、文昌、文曲等升遷吉曜。
- **健康日**：疾厄宮化科、天梁、祿存、化忌吉凶判定與養生時機。
- **樂透運**：八字飛財格、火貪格、鈴貪格、破軍化祿強烈爆發偏財運日。
- **巨大商機日**：祿馬交馳、權祿交馳、紫府帝星同度之重大決策投資日。

### 3. LLM 自然語言對話 (Gemini LLM Integration)
- **語意意圖解析**：提取使用者問題的主體、事件、時間維度與心理動機。
- **自然語言生成**：符合現代風格（Gen Y / Gen Z），先給明確結論，再給星盤數據與命理依據。
- **模型容錯切換**：優先調用 `gemini-3.5-flash`，若遇 404 / 503 / 429 狀況自動容錯重試 `gemini-2.5-flash`、`gemini-2.0-flash` 或回退至本地智能備用語意引擎。

### 4. 倪師改運體系 (Ni Haisha Remedy Framework)
- **中藥聞香**：依日干五行調配專屬香囊配方（柴胡薄荷降真開郁香、沉香遠志清心安神香、蒼朮白芷醒脾辟穢香等）。
- **穴位按摩**：百會、足三里、太衝、內關、湧泉等經絡導引時間與手法。
- **地脈道空間佈局**：主事談判坐西北乾卦天子位壓陣、喜神方、財神方與當日歲煞避忌方位。

---

## 技術架構

```
ziwei-fortune/
├── webapp/                      # 前端網頁應用與 Node.js 伺服器
│   ├── index.html               # 現代化單頁式應用 (SPA) 視圖介面
│   ├── app.js                   # 前端核心邏輯、真太陽時校正、LLM 管線與多聊天室管理
│   ├── server.js                # 本地靜態伺服器與 RESTful API 端點
│   ├── styles.css               # 深色系響應式 UI 與視覺化佈局
│   ├── iztro.min.js             # 紫微斗數開源核心排盤引擎
│   ├── test_solar_system.js     # 真太陽時天文校正全套單元測試腳本
│   └── data/                    # 預先計算之流日評分快取數據
├── scripts/                     # 數據批次生成與命理評分測試工具
├── .env.example                 # 環境變數範本
├── .gitignore                   # Git 忽略設定
├── LICENSE                      # MIT 開源授權條款
└── README.md                    # 專案技術文件
```

- **核心排盤庫**：[iztro](https://github.com/SylarLong/iztro) (紫微斗數開源計算庫)
- **天文精算**：NOAA 太陽均時差演算法 (Equation of Time) + 太陽黃經 24 節氣交節推算
- **前端架構**：原生 Vanilla JavaScript (ES6+)、HTML5、CSS3 (Glassmorphism UI)
- **後端架構**：Node.js 原生 HTTP / REST API（支援 `/api/solar-time` 與 `/api/geocode`）
- **AI / LLM 串接**：Google Gemini REST API (`x-goog-api-key` 端點，支援動態讀取與模型降級)

---

## 快速開始

### 1. 環境需求
- [Node.js](https://nodejs.org/) v18 或以上版本。

### 2. 下載專案
```bash
git clone https://github.com/JackYangHT/ziwei-fortune-system.git
cd ziwei-fortune-system
```

### 3. 設定環境變數（選填）
複製 `.env.example` 為 `.env`（或於網頁開啟後由右上角介面輸入）：
```bash
cp .env.example .env
```

### 4. 啟動伺服器
```bash
node webapp/server.js
```
啟動成功後，終端機將顯示：
```text
Server running at http://localhost:3000/
Open http://localhost:3000/ in your browser to use the Zi Wei Dou Shu system with True Solar Time.
```

### 5. 瀏覽體驗
於瀏覽器開啟 [http://localhost:3000/](http://localhost:3000/)：
- **新建客戶命盤**：輸入客戶名稱、出生年月日、出生地（如「曼谷」、「台北」或「`121.5, 25.0`」）與出生鐘錶時間。
- **真太陽時即時預覽**：系統即時計算地理時差、均時差、真太陽時、排盤時辰與時辰邊界預警。
- **設定 Gemini AI**：點擊右上角「**✨ Gemini AI**」按鈕輸入您的 Google Gemini API Key，即可啟用 LLM 即時生成。

---

## RESTful API 端點說明

後端提供兩組輕量快速的 HTTP GET 查詢端點：

### 1. 真太陽時天文校正 (`/api/solar-time`)
```http
GET /api/solar-time?birthday=1977-07-26&time=08:00&place=曼谷
```
**回應範例 (JSON)**：
```json
{
  "success": true,
  "location": {
    "name": "曼谷",
    "lon": 100.5,
    "lat": 13.75,
    "tz": 7,
    "centralMeridian": 105
  },
  "clockTime": "08:00",
  "geoOffsetMinutes": -18,
  "eotMinutes": -6.6,
  "totalOffsetMinutes": -24.6,
  "meanSolarTime": "07:42",
  "trueSolarTime": "07:35",
  "originalShichenName": "辰時 (07:00-09:00)",
  "adjustedShichenName": "辰時 (07:00-09:00)",
  "isShichenChanged": false,
  "isNearBoundary": false,
  "boundaryInfo": null,
  "solarTerms": []
}
```

### 2. 城市座標查詢 (`/api/geocode`)
```http
GET /api/geocode?query=台北
```
**回應範例 (JSON)**：
```json
{
  "success": true,
  "location": {
    "name": "台北",
    "lon": 121.5,
    "lat": 25.03,
    "tz": 8,
    "centralMeridian": 120
  }
}
```

---

## 測試驗證

執行內建的真太陽時全套天文校正單元測試：
```bash
node webapp/test_solar_system.js
```
測試範圍涵蓋：
1. **曼谷測試案例**：1977-07-26 08:00（鐘錶 08:00 ➔ 真太陽時 07:35 ➔ 辰時）。
2. **台北測試案例**：1990-03-15 14:00（鐘錶 14:00 ➔ 台北經度 121.5° 時差 +6m ➔ 未時）。
3. **時辰邊界檢測**：前後 15 分鐘邊界判定與雙時辰雙盤比對。
4. **跨時辰校正**：真太陽時校正引發的時辰變更處理。
5. **節氣交節比對**：出生時間在節氣前後 2 小時內的精確判定。
6. **自訂經緯度解析**：字串與座標自動轉換測試。

---

## 授權條款

本專案採用 [MIT License](LICENSE) 開源授權。  
Copyright (c) 2026 Jack Yang.
