# 紫微斗數 AI 算命 Webapp — 專案藍圖與進度追蹤

## 📌 專案概述
- **基底專案**：`ziwei-doushu` (Next.js 16 + TypeScript + Tailwind)
- **授權合規**：程式碼 MIT、資料集 CC BY 4.0（倪師原話 CC BY-NC-SA 4.0 僅限本地自用）
- **AI 引擎**：DeepInfra 的 `deepseek-ai/DeepSeek-V4-Flash`（支援 Flex 檔位）
- **核心目標**：命盤靜態不閃爍，聊天框流式輸出；整合「三合派星曜」與「飛星四化」的動態能量。
- **GitHub 倉庫**：`https://github.com/JackYangHT/ziwei-fortune-system.git` (`main` 分支，舊版備份於 `legacy-v1` 分支)
- **Firebase 線上環境**：
  - 首頁：`https://ziwei-fortune-v3-cf867.web.app`
  - 排盤工作台：`https://ziwei-fortune-v3-cf867.web.app/chart`
  - Firebase 專案 ID：`ziwei-fortune-v3-cf867`

---

## 🗺️ 系統架構藍圖

### 1. 資料與排盤層 (Data & Engine)
- **紫微排盤**：沿用 `lib/ziwei/` 自研引擎。
- **八字排盤**：`lib/bazi/`，基於 `lunar-javascript`，四柱直取 `lunarInfo`（不重算四柱），含十神、藏干、十二長生、神煞、十步大運、前後 5 年流年。
- **三飛四化**：`lib/ziwei-flying/matrix.ts`，計算生年/大限/流年三層宮干飛化原始矩陣（12×12）。
- **磁場化引擎**：`lib/ziwei-flying/magnetic-field.ts` 整合四維度（體、用、方向、雙軌權重）。

### 2. AI 解讀層 (AI & Prompt)
- **API 接口**：`/api/interpret`（單盤）、`/api/heming`（合盤）、`/api/magnetic`（磁場化計算）、`/api/bazi`（八字計算）。
- **解說骨架**（六步）：① 來因宮與使命群組 → ② 生年四化落點與祿隨忌走終點 → ③ 當前大限四化疊宮 → ④ 流年四化觸發宮位 → ⑤ Vectors 最強因果鏈（`same-palace > clamp > opposite > sanhe`）與命中規則 → ⑥ 雙軌制合成指數與核心共振 Top 3 宮位。
- **規則庫**：`lib/ziwei-flying/patterns.ts` `FLYING_RULES` 涵蓋全部 8 大人生領域（共 43 條：事業 6、財富 6、感情 6、學業 5、健康 5、六親 5、人際 5、時間應期 5）。

### 3. 前端展示層 (UI & Interaction)
- **佈局**：`/chart` 頁面左側命盤（`ChartBoard` 以 `React.memo` 鎖定 `chart` 引用），右側 `400px` 面板（`ChartSidePanel` + `InsightPanel`）。
- **資料獲取**：右側面板優先透過 `fetch('/api/bazi')` 與 `fetch('/api/magnetic')` 取得數據，並內建靜態託管環境（如 Firebase Hosting）本地計算自動回退。
- **狀態隔離**：AI 流式輸出狀態完全封閉在 `InsightPanel` 葉子組件內，確保命盤零 Re-render。

### 4. 部署與維運 (Deployment)
- **環境變數**：`DEEPINFRA_API_KEY` 等寫入 `.env.local`（已被 `.gitignore` 與 `.dockerignore` 排除）。
- **Firebase Hosting**：透過 `scripts/prepare-firebase-hosting.mjs` 與 `firebase.json` 打包發佈至 `ziwei-fortune-v3-cf867`。
- **Google Cloud Run**：已配置多階段 `Dockerfile` 與 `.dockerignore`（監聽 `PORT=8080`）。

---

## 📊 任務進度追蹤表（全階段已完成）

| 階段 | 任務內容 | 產出與驗證狀態 |
| :--- | :--- | :--- |
| **Phase 0** | 資產盤點、移除舊彈窗與促銷貼紙 | ✅ 已清除 `AnnouncementModal`、首頁限時回饋貼紙、左下角 Next.js `N` 圖標 |
| **Phase 1** | 資產遷移 | ✅ 城市庫併入、PWA 圖標遷移 |
| **Phase 2** | 八字完整盤 `lib/bazi/` | ✅ 四柱不重算、5 項單元測試全綠 |
| **Phase 3** | 三飛四化與磁場化 `lib/ziwei-flying/` | ✅ 建立 12×12 矩陣、磁場四維度、單元測試全綠 |
| **Phase A** | 5,000 盤全枚舉驗證 | ✅ 崩潰數 0，`computeMagneticField` 單盤平均耗時 0.51ms |
| **Phase C1** | 飛星規則 1（事業、財富、感情） | ✅ 18 條，觸發率全部落於健康區間 |
| **Phase C2** | 飛星規則 2（學業、健康、六親、人際） | ✅ 新增 20 條，觸發率全部落於健康區間 |
| **Phase B** | 前端掛載 `ChartSidePanel` | ✅ 解決 SW 攔截與 `server-only` 衝突，三 Tab 面板與大限切換聯動驗證通過 |
| **Phase C3** | 飛星規則 3（時間應期 `timing-01~05`） | ✅ `enumerate-natal.ts` 流年隨機化；新增 5 條時間應期規則（共 43 條），觸發率 25.2%–33.2% |
| **專案清理** | 已知隱患修復 | ✅ 修復 `lib/ziwei/patterns.ts` 文昌/文曲化忌入命遷 4 個格局死鎖；修正 `social-04` 等級；確認 `.env.local` 不進 Git |
| **AI 解讀整合** | 43 條規則與磁場化數據注入 Prompt | ✅ `lib/ai-client.ts`、`app/api/interpret/route.ts`、`components/InsightPanel.tsx` 六步骨架整合完成 |
| **GitHub & Firebase 部署** | 遠端版本庫與線上站點發佈 | ✅ 已推送至 `JackYangHT/ziwei-fortune-system` (`main`) 並部署至 `https://ziwei-fortune-v3-cf867.web.app` (`HTTP 200`) |

---

## 🛠️ 常用維護與部署指令

```bash
# 1. 型別檢查與測試
npm run typecheck
npx tsx lib/bazi/chart.test.ts
npx tsx lib/ziwei-flying/magnetic-field.test.ts

# 2. 更新部署至 Firebase Hosting
npx next build
node scripts/prepare-firebase-hosting.mjs
firebase deploy --only hosting --project ziwei-fortune-v3-cf867

# 3. 部署至 Google Cloud Run（含完整後端 AI 流式接口）
gcloud run deploy ziwei-doushu \
  --source . \
  --region asia-east1 \
  --allow-unauthenticated \
  --set-env-vars="AI_PROVIDER=deepinfra,DEEPINFRA_MODEL=deepseek-ai/DeepSeek-V4-Flash,DEEPINFRA_SERVICE_TIER=flex"
```
