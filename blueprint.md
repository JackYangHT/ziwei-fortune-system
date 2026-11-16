# 紫微斗數 AI 算命 Webapp — 專案藍圖與進度追蹤

## 📌 專案概述
- **基底專案**：`ziwei-doushu` (Next.js 16 + TypeScript + Tailwind)
- **授權合規**：程式碼 MIT、資料集 CC BY 4.0（倪師原話 CC BY-NC-SA 4.0 僅限本地自用）
- **AI 引擎**：DeepInfra 的 `deepseek-ai/DeepSeek-V4-Flash`（支援 Flex 檔位）
- **核心目標**：命盤靜態不閃爍，聊天框流式輸出；整合「三合派星曜」與「飛星四化」的動態能量。

---

## 🗺️ 系統架構藍圖

### 1. 資料與排盤層 (Data & Engine)
- **紫微排盤**：沿用 `lib/ziwei/` 自研引擎（不引入 `iztro`）。
- **八字排盤**：新建 `lib/bazi/`，基於 `lunar-javascript`，四柱直取 `lunarInfo`。
- **三飛四化**：新建 `lib/ziwei-flying/`，計算生年/大限/流年三層宮干飛化。
- **磁場化引擎**：`magnetic-field.ts` 整合四維度（體、用、方向、權重）。

### 2. AI 解讀層 (AI & Prompt)
- **API 接口**：`/api/interpret`（單盤）、`/api/heming`（合盤）、**`/api/magnetic`（磁場化計算）**、**`/api/bazi`（八字計算）**。
- **解說骨架**（六步）：來因宮 → 生年四化 → 大限四化 → 流年四化 → Vectors 軌跡 → 雙軌權重。
- **規則庫**：`FLYING_RULES` 全部 8 大人生領域動態匹配（共 43 條：事業 6、財富 6、感情 6、學業 5、健康 5、六親 5、人際 5、時間應期 5）。

### 3. 前端展示層 (UI & Interaction)
- **佈局**：`/chart` 頁面左側命盤（`React.memo` 鎖定），右側 400px 面板（`ChartSidePanel`）。
- **資料獲取**：右側面板透過 `fetch('/api/bazi')` 和 `fetch('/api/magnetic')` 取得數據，避免將 `server-only` 模組打包進客戶端。
- **狀態隔離**：AI 流式輸出狀態封閉在 `InsightPanel` 葉子組件內，確保命盤零 Re-render。

### 4. 部署與維運 (Deployment)
- **環境變數**：`DEEPINFRA_API_KEY` 等寫入 `.env.local`（已被 `.gitignore` 與 `.dockerignore` 排除）。
- **部署目標**：Google Cloud Run（已配置多階段 `Dockerfile` 與 `.dockerignore`，監聽 `PORT=8080`）。

---

## 📊 任務進度追蹤表

### ✅ 已完成 (Completed)
| 階段 | 任務內容 | 產出與驗證狀態 |
| :--- | :--- | :--- |
| **Phase 0** | 資產盤點、移除舊彈窗与促銷貼紙 | 清除 `AnnouncementModal`、移除首頁限時回饋便利貼、隱藏左下角 Next.js `N` 圖標 |
| **Phase 1** | 資產遷移 | 城市庫併入、PWA 圖標遷移 |
| **Phase 2** | 八字完整盤 `lib/bazi/` | 四柱不重算、單元測試綠 |
| **Phase 3** | 三飛四化與磁場化 `lib/ziwei-flying/` | 建立 12×12 矩陣、磁場四維度 |
| **Phase A** | 5,000 盤全枚舉驗證 | 崩潰數 0，`computeMagneticField` 耗時 0.5ms |
| **Phase C1** | 飛星規則 1（事業、財富、感情） | 18 條，觸發率健康區間 |
| **Phase C2** | 飛星規則 2（學業、健康、六親、人際） | 新增 20 條，觸發率健康區間 |
| **Phase B** | 前端掛載 `ChartSidePanel` | 解決 SW 攔截與 `server-only` 衝突，改用 `/api/bazi` 與 `/api/magnetic` API Route |
| **Phase C3** | 飛星規則 3（時間應期 `timing-01~05`） | `scripts/enumerate-natal.ts` 流年隨機化；新增 5 條時間應期規則（總計 43 條），觸發率全部落於健康區間 |
| **專案清理** | 已知隱患修復 | 1. 修復 `lib/ziwei/patterns.ts` 文昌/文曲化忌入命遷 4 個格局死鎖<br>2. 修正 `social-04` 等級與負權重矛盾（統一為 `inauspicious`）<br>3. 確認 `.env.local` 受 `.gitignore` 保護不進 Git |
| **AI 解讀整合** | 43 條規則與磁場化數據注入 Prompt | `lib/ai-client.ts`、`app/api/interpret/route.ts`、`components/InsightPanel.tsx` 完成六步骨架注入 |
| **GCP 部署準備** | Cloud Run 容器化配置 | 新增多階段 `Dockerfile` 與 `.dockerignore`（`PORT=8080`） |

---

## 🚀 GCP Cloud Run 部署指令參考
```bash
# 1. 本地構建驗證
npm run typecheck
npm run build

# 2. 部署至 Google Cloud Run (替換為實際 GCP Project ID)
gcloud run deploy ziwei-doushu \
  --source . \
  --region asia-east1 \
  --allow-unauthenticated \
  --set-env-vars="AI_PROVIDER=deepinfra,DEEPINFRA_MODEL=deepseek-ai/DeepSeek-V4-Flash,DEEPINFRA_SERVICE_TIER=flex"
```
