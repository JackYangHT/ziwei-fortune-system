# 紫微斗數流日命理運算系統 — 滿天星 Plus

結合 iztro 排盤引擎、七政四餘天體曆算、Gemini LLM 自然語言對話、倪海廈天紀改運體系與多維幾何視覺化的全方位現代命理運算平台。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-blue.svg)](webapp/manifest.json)
[![Vercel Ready](https://img.shields.io/badge/Deploy-Vercel-black.svg)](vercel.json)
[![Netlify Ready](https://img.shields.io/badge/Deploy-Netlify-00ad9f.svg)](netlify.toml)

---

## 專案願景

建立一套「知命 → 造命 → 修命」的完整命理系統，讓使用者能：
1. **知命**：精準排出本命盤、大限、流年、流月、流日、流時、流分與七政四餘天象。
2. **造命**：找出偏財日、桃花日、貴人日、商機日、樂透日，提前佈局，善用時間槓桿。
3. **修命**：透過倪師改運體系（個人化體質辨證中藥聞香、經絡穴位、天紀地脈道）調整人體與環境磁場。

---

## 滿天星 Plus 八大升級模組

### 🌟 模組一：七政四餘 (Seven Luminaries & Four Extras)
- **天體星曆推算**：採用嚴謹開普勒軌道力學與日心座標投影算法。
- **七政**：日（太陽）、月（太陰）、木（歲星）、火（熒惑）、土（鎮星）、金（太白）、水（辰星）。
- **四餘**：紫氣（木餘）、月孛（水餘）、羅睺（火餘）、計都（土餘）。
- **黃道十二宮坐落**：輸出各天體精確度數、黃道宮位（如 1977-07-26 08:00 曼谷：太陽午宮 2°56'、太陰寅宮 2°25'、羅睺辰宮與計都戌宮 180° 對沖）。

### ⏱️ 模組二：流分推算 (Minute-level Fate Tracker)
- **時間層級延伸**：由「流日、流時」精細延伸至「流分（每 1 分鐘）」。
- **流分命宮定位**：從流時命宮起，順數至該分鐘對應宮位。
- **時干五鼠遁**：以流時天干為引，推算流分干支與流分命宮。
- **流分四化**：即時輸出流分化祿、化權、化科、化忌，提供決策下單、談判簽約的分秒級指引。

### 💬 模組三：多輪對話記憶 (Multi-turn Memory)
- **上下文繼承**：同一個聊天室內自動保存前 10 輪對話（最多 20 則對話記憶）。
- **語意連貫**：對話理解引擎（`understandQuestion`）與生成引擎（`generateNaturalAnswer`）皆參考歷史脈絡。
- **追問識別**：若使用者進行追問（如「那換個方向呢？」、「哪一天最好？」、「為什麼？」），系統精準辨識先前主題並連貫作答。

### ⚖️ 模組四：動態權重自適應學習 (Adaptive Learning Weights)
- **回饋學習機制**：助理訊息下方內建「👍 建議中了 (+10% 權重)」與「👎 建議沒中 (-10% 權重)」即時回饋按鈕。
- **客戶專屬持久化**：權重係數儲存於 `localStorage`，隨使用者互動動態微調（0.2x 至 3.0x 範圍限制）。
- **權重管理面板**：可隨時點擊頂部權重標籤手動微調 8 大分類權重或一鍵重設。

### 🌿 模組五：個人化處方辨證 (Personalized Master Ni Prescription)
- **因人而異的體質辨證**：打破單一固定處方，區分「陰虛燥熱型」與「陽虛水寒型」。
- **補水選藥**：
  - A 客戶（陰虛燥熱）：特選**特級海南沉香**（清虛火、順氣降納歸腎水，切忌辛溫之丁香）。
  - B 客戶（陽虛水寒）：特選**特級公丁香**（溫腎壯命門真火、蒸騰化水，切忌苦寒之沉香）。
- **補財穴位**：
  - A 客戶（陰虛燥熱）：按**太溪穴**（足少陰腎經原穴，引火歸元、滋水生財）。
  - B 客戶（陽虛水寒）：按**足三里穴**（足陽明胃經合穴，培土生金、厚德載物以生財）。

### 📊 模組六：圖表視覺化 (Chart.js 4-Grid Dashboard)
1. **命盤圓圖（十二宮輪盤）**：以圓盤展示十二地支宮位主星、吉凶煞曜與七政四餘天體，點擊扇形可展開該宮詳情。
2. **五行能量雷達平衡圖**：直觀呈現木、火、土、金、水本命五行強弱分佈，點擊端點檢視臟腑與調養心法。
3. **全年運勢走勢折線圖**：跨越 12 個月平滑曲線，展示綜合運勢、偏財、桃花、商機走勢。
4. **全年 365 天流年熱力圖矩陣**：類似 GitHub contribution graph，顏色深淺代表吉利分數，點擊任意日期方格立即展開推算詳情面板。

### 🌐 模組七：五語支援 (5 Languages & Astrological Glossary)
- 支援 5 種主要語言：
  - 繁體中文 (`zh`)
  - 簡體中文 (`cn`)
  - English (`en`)
  - 日本語 (`ja`)
  - 한국어 (`ko`)
  - （另相容保留泰語 `th`）
- 紫微斗數與七政四餘專有名詞（如紫微星、天機、七殺、擎羊、化祿、羅睺等）保留原汁原味中文，並附上在地語言釋義。

### 📱 模組八：PWA + 雲端部署 (PWA & Cloud Deploy)
- **PWA 支援**：完整的 `manifest.json`、高解析圖標與 `service-worker.js` 離線快取，支援手機與桌面「安裝為獨立應用 / 加到主畫面」。
- **雲端部署配置**：內建 `vercel.json` 與 `netlify.toml`，支援環境變數注入與無伺服器託管。

---

## 系統架構

```
ziwei-fortune/
├── webapp/                      # 前端網頁應用與後端服務
│   ├── index.html               # 滿天星 Plus 響應式介面 (SPA)
│   ├── app.js                   # 核心前端邏輯、七政四餘、流分、多輪記憶、動態權重與圖表
│   ├── server.js                # Node.js 伺服器與 RESTful API 端點
│   ├── styles.css               # 深色系玻璃擬物風格 UI
│   ├── iztro.min.js             # 紫微斗數開源排盤引擎
│   ├── manifest.json            # PWA 應用清單設定檔
│   ├── service-worker.js        # PWA 離線快取工作線程
│   ├── icon.svg                 # 高向量天體星盤圖標
│   ├── icon-192.png             # 192x192 PWA 圖標
│   └── icon-512.png             # 512x512 PWA 圖標
├── test_mantianxing_plus.js     # 滿天星 Plus 29 項自動化驗證測試套件
├── vercel.json                  # Vercel 一鍵部署設定檔
├── netlify.toml                 # Netlify 一鍵部署設定檔
├── .env.example                 # 環境變數範本
├── .gitignore                   # Git 忽略設定
├── LICENSE                      # MIT 開源授權條款
├── PROJECT_BLUEPRINT.md         # 專案完整藍圖
└── README.md                    # 專案技術文件
```

---

## 快速開始

### 1. 本地啟動

```bash
# 複製專案
git clone https://github.com/JackYangHT/ziwei-fortune-system.git
cd ziwei-fortune-system

# 執行驗證測試 (通過 29 項功能驗證)
node test_mantianxing_plus.js

# 啟動 Web 服務
node webapp/server.js
```

瀏覽器開啟 [http://localhost:3000/](http://localhost:3000/) 即可體驗。

---

## 雲端一鍵部署指南 (Cloud Deployment Guide)

本系統完全符合雲端現代化架構，可直接一鍵部署至 **Vercel** 或 **Netlify**：

### 方案 A：部署至 Vercel

1. **連動 GitHub**：
   - 登入 [Vercel 控制台](https://vercel.com/)。
   - 點擊 **"Add New..."** ➔ **"Project"**，選擇本專案儲存庫（Repository）。
2. **專案配置**：
   - Framework Preset 選擇：`Other`。
   - Root Directory 填入：`./`（根目錄）。
   - Vercel 將自動讀取根目錄下的 `vercel.json` 進行靜態資源路由映射。
3. **設定環境變數（選填）**：
   - 在 **Environment Variables** 新增：
     - `GEMINI_API_KEY`: 您的 Google Gemini API Key（亦可留空，由使用者在前端網頁右上角自行設定）。
4. **完成部署**：
   - 點擊 **"Deploy"**，約 30 秒即可取得專屬 `*.vercel.app` 網址。

### 方案 B：部署至 Netlify

1. **連動 GitHub**：
   - 登入 [Netlify 控制台](https://www.netlify.com/)。
   - 點擊 **"Add new site"** ➔ **"Import an existing project"** ➔ 選擇 GitHub。
2. **自動讀取設定**：
   - Netlify 會自動偵測並讀取專案內的 `netlify.toml`：
     - Base directory: `.`
     - Publish directory: `webapp`
3. **設定環境變數（選填）**：
   - 前往 **Site configuration** ➔ **Environment variables**，新增：
     - `GEMINI_API_KEY`: 您的 Google Gemini API Key。
4. **完成部署**：
   - 點擊 **"Deploy site"** 即可正式上線。

---

## PWA 安裝與離線使用

1. **桌面端（Chrome / Edge / Safari）**：
   - 瀏覽網站時，網址列右側會出現「**安裝應用程式**」圖示。
   - 點擊即可安裝至桌面，享受如同原生 Desktop App 的全螢幕沈浸式體驗。
2. **行動端（iOS / Android）**：
   - iOS Safari：點擊分享按鈕 ➔ 選擇「**加入主畫面**」。
   - Android Chrome：點擊右上角選單 ➔ 選擇「**安裝應用程式**」。
3. **離線快取**：
   - 內建 `service-worker.js`，在沒有網路的環境下仍可查看歷史排盤、十二宮方盤與倪師改運處方。

---

## 測試驗證

本專案提供完備的自動化測試腳本：

```bash
# 1. 滿天星 Plus 升級模組全套驗證 (七政四餘、流分、多輪記憶、動態權重、個人處方、圖表、語言、PWA)
node test_mantianxing_plus.js

# 2. 真太陽時天文校正全套測試 (NOAA 均時差、經度時差、時辰邊界預警)
node webapp/test_solar_system.js
```

---

## 授權條款

本專案採用 [MIT License](LICENSE) 開源授權。  
Copyright (c) 2026 Jack Yang.
